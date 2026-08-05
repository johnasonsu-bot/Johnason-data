const { pool } = require("../../config/database");
const modelProviderService = require("../model-providers/model-provider.service");

function queryFirst(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function stringifyPromptVariable(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderPromptTemplate(template, variables = {}) {
  const raw = String(template || "");
  if (!raw) {
    return "";
  }
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => stringifyPromptVariable(variables[key]));
}

async function getActivePromptTemplate(promptType) {
  const [rows] = await pool.query(
    `SELECT id, prompt_type AS promptType, template_name AS templateName, template_code AS templateCode,
            content, user_content AS userContent, temperature, max_tokens AS maxTokens, default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            is_default AS isDefault, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_prompt_template
     WHERE prompt_type = ?
       AND status = 'active'
     ORDER BY is_default DESC, updated_at DESC
     LIMIT 1`,
    [promptType]
  );
  return queryFirst(rows) || null;
}

function normalizePromptParameterNumber(value, fallback, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  if (options.integer) {
    return Math.max(options.min ?? 1, Math.min(options.max ?? 8000, Math.trunc(number)));
  }
  const limited = Math.max(options.min ?? 0, Math.min(options.max ?? 2, number));
  return Number(limited.toFixed(2));
}

async function resolvePromptTemplateProvider(defaultModelProviderId) {
  if (!defaultModelProviderId) {
    return null;
  }
  const provider = await modelProviderService.getModelProviderById(Number(defaultModelProviderId));
  if (!provider || provider.modelCategory !== "chat" || provider.status !== "active") {
    return null;
  }
  return provider;
}

async function resolveRuntimePromptConfig(promptType, defaults = {}, variables = {}) {
  const template = await getActivePromptTemplate(promptType);
  const provider = await resolvePromptTemplateProvider(template?.defaultModelProviderId);
  const selectedProvider = provider
    ? modelProviderService.applyModelSelection(provider, {
        modelName: template?.defaultModelName,
        modelVersion: template?.defaultModelVersion,
      })
    : null;
  const systemPrompt = renderPromptTemplate(
    template?.content || defaults.systemPrompt || "",
    variables
  );
  const userPrompt = renderPromptTemplate(
    template?.userContent || defaults.userPrompt || "{{input}}",
    variables
  ) || stringifyPromptVariable(variables.input);
  return {
    template,
    provider: selectedProvider,
    systemPrompt,
    userPrompt,
    temperature: normalizePromptParameterNumber(template?.temperature, defaults.temperature ?? 0.2, { min: 0, max: 2 }),
    maxTokens: normalizePromptParameterNumber(template?.maxTokens, defaults.maxTokens ?? 1200, { min: 1, max: 8000, integer: true }),
  };
}

module.exports = {
  stringifyPromptVariable,
  renderPromptTemplate,
  getActivePromptTemplate,
  normalizePromptParameterNumber,
  resolvePromptTemplateProvider,
  resolveRuntimePromptConfig,
};
