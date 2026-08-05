const AppError = require("../../common/errors/app-error");
const modelProviderService = require("../model-providers/model-provider.service");
const repository = require("./reporting-ai-config.repository");

async function validateDefaultProvider(defaultModelProviderId, defaultModelName, defaultModelVersion) {
  if (!defaultModelProviderId) {
    return {
      defaultModelProviderId: null,
      defaultModelName: null,
      defaultModelVersion: null,
    };
  }

  const provider = await modelProviderService.getModelProviderById(defaultModelProviderId);
  if (!provider) {
    throw new AppError("默认模型配置不存在", 400);
  }
  if (provider.modelCategory !== "chat") {
    throw new AppError("默认模型必须选择对话模型", 400);
  }

  return {
    defaultModelProviderId: Number(defaultModelProviderId),
    defaultModelName: String(defaultModelName || provider.modelName || "").trim() || provider.modelName,
    defaultModelVersion: String(defaultModelVersion || provider.modelVersion || provider.modelName || "").trim()
      || provider.modelVersion
      || provider.modelName,
  };
}

async function listConfigs() {
  return repository.listConfigs();
}

async function getActiveConfigByCode(sceneCode) {
  const row = await repository.getConfigByCode(sceneCode);
  if (!row || row.status !== "active") {
    return null;
  }
  return row;
}

async function updateConfig(id, payload) {
  const existing = await repository.getConfigById(id);
  if (!existing) {
    throw new AppError("报表 AI 场景配置不存在", 404);
  }

  const normalizedModel = await validateDefaultProvider(
    payload.defaultModelProviderId ?? existing.defaultModelProviderId,
    payload.defaultModelName ?? existing.defaultModelName,
    payload.defaultModelVersion ?? existing.defaultModelVersion
  );

  const row = await repository.updateConfig(id, {
    ...existing,
    defaultModelProviderId: normalizedModel.defaultModelProviderId,
    defaultModelName: normalizedModel.defaultModelName,
    defaultModelVersion: normalizedModel.defaultModelVersion,
    temperature: payload.temperature ?? existing.temperature ?? null,
    maxTokens: payload.maxTokens ?? existing.maxTokens ?? null,
    timeoutMs: payload.timeoutMs ?? existing.timeoutMs ?? null,
    inputSchema: payload.inputSchema || existing.inputSchema || {},
    systemPrompt: payload.systemPrompt || null,
  });

  if (!row) {
    throw new AppError("报表 AI 场景配置不存在", 404);
  }
  return row;
}

async function ensureBuiltinConfig(payload) {
  const existing = await repository.getConfigByCode(payload.sceneCode);
  if (existing) {
    if (!existing.systemPrompt) {
      return repository.updateConfig(existing.id, {
        ...existing,
        systemPrompt: payload.systemPrompt || existing.systemPrompt,
        inputSchema: existing.inputSchema && Object.keys(existing.inputSchema).length ? existing.inputSchema : payload.inputSchema,
      });
    }
    return existing;
  }
  return repository.createConfig(payload);
}

module.exports = {
  ensureBuiltinConfig,
  getActiveConfigByCode,
  listConfigs,
  updateConfig,
};
