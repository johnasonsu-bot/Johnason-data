const AppError = require("../../common/errors/app-error");
const repository = require("./model-provider.repository");
const {
  applyModelSelection,
  buildModelCatalogFromRemoteModels,
  encryptProviderSecret,
  normalizeDisplayProvider,
  normalizeModelCatalog,
  normalizeRuntimeProvider,
  parseExtraConfig,
} = require("./model-provider.utils");

async function listModelProviders() {
  const rows = await repository.listModelProviders();
  return rows.map((item) => normalizeDisplayProvider(item));
}

async function getModelProviderById(id) {
  const row = await repository.getModelProviderById(id);

  if (!row) {
    throw new AppError("模型配置不存在", 404);
  }

  return normalizeRuntimeProvider(row);
}

async function getActiveChatModelProviders() {
  const rows = await repository.listModelProviders();
  return rows
    .filter((item) => item.status === "active" && item.modelCategory === "chat")
    .map((item) => normalizeRuntimeProvider(item));
}

function normalizeProviderPayload(payload, existing = null) {
  const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
  const extraConfig = parseExtraConfig(payload.extraConfig);
  const selectedModelName = String(payload.modelName || existingRuntime?.modelName || "").trim();
  const selectedModelVersion = String(payload.modelVersion || existingRuntime?.modelVersion || selectedModelName).trim();

  return {
    ...payload,
    modelName: selectedModelName,
    modelVersion: selectedModelVersion || selectedModelName,
    apiKey: payload.apiKey ? encryptProviderSecret(payload.apiKey) : (existing?.apiKey || ""),
    extraConfig: {
      ...extraConfig,
      modelCatalog: normalizeModelCatalog(
        extraConfig.modelCatalog,
        selectedModelName,
        selectedModelVersion || selectedModelName
      ),
    },
  };
}

async function resolveRuntimePayload(payload) {
  const existing = payload.id ? await repository.getModelProviderById(Number(payload.id)) : null;
  if (payload.id && !existing) {
    throw new AppError("模型配置不存在", 404);
  }

  const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
  return {
    ...payload,
    providerType: payload.providerType || existingRuntime?.providerType,
    modelCategory: payload.modelCategory || existingRuntime?.modelCategory || "chat",
    baseUrl: payload.baseUrl || existingRuntime?.baseUrl,
    apiKey: payload.apiKey || existingRuntime?.apiKey,
    organizationId: Object.prototype.hasOwnProperty.call(payload, "organizationId") ? payload.organizationId : existingRuntime?.organizationId,
    extraConfig: {
      ...(existingRuntime?.extraConfig || {}),
      ...parseExtraConfig(payload.extraConfig),
    },
  };
}

async function createModelProvider(payload) {
  try {
    if (!payload.apiKey) {
      throw new AppError("API Key 不能为空", 400);
    }

    const row = await repository.createModelProvider(normalizeProviderPayload(payload));
    return normalizeDisplayProvider(row);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("模型配置编码已存在", 409);
    }

    throw error;
  }
}

async function updateModelProvider(id, payload) {
  try {
    const existing = await repository.getModelProviderById(id);
    if (!existing) {
      throw new AppError("模型配置不存在", 404);
    }

    const row = await repository.updateModelProvider(id, normalizeProviderPayload(payload, existing));

    if (!row) {
      throw new AppError("模型配置不存在", 404);
    }

    return normalizeDisplayProvider(row);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("模型配置编码已存在", 409);
    }

    throw error;
  }
}

async function deleteModelProvider(id) {
  const deleted = await repository.deleteModelProvider(id);

  if (!deleted) {
    throw new AppError("模型配置不存在", 404);
  }
}

async function testModelProvider(payload) {
  const runtimePayload = await resolveRuntimePayload(payload);
  const extraConfig = runtimePayload.extraConfig || {};

  try {
    if (runtimePayload.providerType === "anthropic") {
      return await testAnthropicProvider(runtimePayload, extraConfig);
    }

    return await testOpenAICompatibleProvider(runtimePayload, extraConfig);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(`模型测试失败: ${error.message || "未知错误"}`, 400);
  }
}

async function generateChatCompletion(providerConfig, messages, options = {}) {
  const runtimeProvider = normalizeRuntimeProvider(providerConfig);
  if (!runtimeProvider) {
    throw new AppError("模型配置不存在", 404);
  }

  if (runtimeProvider.status !== "active") {
    throw new AppError("当前模型配置未启用", 400);
  }

  if (runtimeProvider.modelCategory !== "chat") {
    throw new AppError("当前模型配置不是对话模型", 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError("消息内容不能为空", 400);
  }

  const extraConfig = runtimeProvider.extraConfig || {};

  try {
    if (runtimeProvider.providerType === "anthropic") {
      return await generateAnthropicCompletion(runtimeProvider, messages, options, extraConfig);
    }

    if (resolveInferenceWireApi(extraConfig) === "responses") {
      return await generateResponsesCompletion(runtimeProvider, messages, options, extraConfig);
    }

    return await generateOpenAICompatibleCompletion(runtimeProvider, messages, options, extraConfig);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(`模型调用失败: ${error.message || "未知错误"}`, 400);
  }
}

async function generateChatCompletionStream(providerConfig, messages, options = {}, onDelta) {
  const runtimeProvider = normalizeRuntimeProvider(providerConfig);
  if (!runtimeProvider) {
    throw new AppError("模型配置不存在", 404);
  }

  if (runtimeProvider.status !== "active") {
    throw new AppError("当前模型配置未启用", 400);
  }

  if (runtimeProvider.modelCategory !== "chat") {
    throw new AppError("当前模型配置不是对话模型", 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError("消息内容不能为空", 400);
  }

  const extraConfig = runtimeProvider.extraConfig || {};

  try {
    if (runtimeProvider.providerType === "anthropic") {
      return await generateAnthropicCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
    }

    if (resolveInferenceWireApi(extraConfig) === "responses") {
      return await generateResponsesCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
    }

    return await generateOpenAICompatibleCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(`模型流式调用失败: ${error.message || "未知错误"}`, 400);
  }
}

async function testOpenAICompatibleProvider(payload, extraConfig) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "model_list");
  const timeoutMs = Number(extraConfig.timeoutMs || 20000);
  const { models, checkedEndpoint } = await fetchRemoteModelList({
    providerType: payload.providerType,
    baseUrl,
    headers,
    timeoutMs,
    extraConfig,
  });
  const modelCatalog = buildModelCatalogFromRemoteModels(models);

  return {
    success: true,
    message: "模型连接测试成功，已拉取模型列表",
    providerType: payload.providerType,
    modelName: null,
    modelVersion: null,
    checkedEndpoint,
    models,
    modelCatalog,
  };
}

async function generateOpenAICompatibleCompletion(payload, messages, options, extraConfig) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
  const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 30000);
  const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
  const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig);

  const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
    endpointCandidates,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    },
    timeoutMs,
    (parsed) => Boolean(extractOpenAICompatibleContent(parsed)),
    "模型调用失败",
    {
      disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
      primaryEndpointOnly: Boolean(options.primaryEndpointOnly),
    }
  );

  const content = extractOpenAICompatibleContent(data);

  if (!content) {
    throw buildModelCallAppError("模型调用失败", checkedEndpoint, endpointCandidates, 200, data, adapted, {
      contentMissing: true,
    });
  }

  return {
    providerId: payload.id,
    providerType: payload.providerType,
    modelName: payload.modelName,
    content,
    raw: {
      ...data,
      checkedEndpoint,
      adapted,
    },
  };
}

async function generateOpenAICompatibleCompletionStream(payload, messages, options, extraConfig, onDelta) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
  const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 30000);
  const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
  const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig, true);

  const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
    endpointCandidates,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    },
    timeoutMs
  );

  const decoder = new TextDecoder("utf-8");
  const reader = response.body.getReader();
  let content = "";
  let buffer = "";
  let streamErrorMessage = "";

  async function consumeFrame(rawFrame) {
    const line = String(rawFrame || "").trim();
    if (!line) return;
    const dataText = line.startsWith("data:") ? line.slice(5).trim() : line;
    if (!dataText || dataText === "[DONE]") return;

    let parsed;
    try {
      parsed = JSON.parse(dataText);
    } catch {
      return;
    }

    const parsedError = extractErrorMessage(parsed);
    if (parsedError) {
      streamErrorMessage = parsedError;
    }

    const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : null;
    const deltaValue = choice?.delta?.content;
    const deltaText =
      typeof deltaValue === "string"
        ? deltaValue
        : Array.isArray(deltaValue)
          ? deltaValue.map((item) => (typeof item?.text === "string" ? item.text : "")).join("")
          : extractOpenAICompatibleContent(parsed);

    if (deltaText) {
      content += deltaText;
      if (typeof onDelta === "function") {
        await onDelta(deltaText);
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      await consumeFrame(frame);
    }
  }

  buffer += decoder.decode();
  await consumeFrame(buffer);

  if (!content) {
    throw buildModelCallAppError("模型流式调用失败", checkedEndpoint, buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType), 200, streamErrorMessage ? { error: streamErrorMessage } : {}, null, {
      contentMissing: true,
      interfaceLabel: "OpenAI chat.completions",
    });
  }

  return {
    providerId: payload.id,
    providerType: payload.providerType,
    modelName: payload.modelName,
    content,
    raw: null,
  };
}

async function generateResponsesCompletion(payload, messages, options, extraConfig) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
  const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 30000);
  const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
  const body = buildResponsesRequestBody(payload, messages, options, extraConfig);

  const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
    endpointCandidates,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    },
    timeoutMs,
    (parsed) => Boolean(extractResponsesContent(parsed)),
    "模型调用失败",
    {
      interfaceLabel: "OpenAI Responses API",
      disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
      primaryEndpointOnly: Boolean(options.primaryEndpointOnly),
    }
  );

  const content = extractResponsesContent(data);

  if (!content) {
    throw buildModelCallAppError("模型调用失败", checkedEndpoint, endpointCandidates, 200, data, adapted, {
      contentMissing: true,
      interfaceLabel: "OpenAI Responses API",
    });
  }

  return {
    providerId: payload.id,
    providerType: payload.providerType,
    modelName: payload.modelName,
    content,
    raw: {
      ...data,
      checkedEndpoint,
      adapted,
    },
  };
}

async function generateResponsesCompletionStream(payload, messages, options, extraConfig, onDelta) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
  const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 30000);
  const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
  const body = buildResponsesRequestBody(payload, messages, options, extraConfig, true);

  const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
    endpointCandidates,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    },
    timeoutMs
  );

  const { content, finalResponse } = await readResponsesSseStream(response, onDelta);

  if (!content) {
    throw buildModelCallAppError("模型流式调用失败", checkedEndpoint, endpointCandidates, 200, finalResponse || {}, null, {
      contentMissing: true,
      interfaceLabel: "OpenAI Responses API",
    });
  }

  return {
    providerId: payload.id,
    providerType: payload.providerType,
    modelName: payload.modelName,
    content,
    raw: finalResponse || null,
  };
}

async function testAnthropicProvider(payload, extraConfig) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const timeoutMs = Number(extraConfig.timeoutMs || 20000);
  const headers = mergeExtraHeaders({
    "Content-Type": "application/json",
    "x-api-key": payload.apiKey,
    "anthropic-version": extraConfig.anthropicVersion || "2023-06-01",
  }, extraConfig, "model_list");
  const { models, checkedEndpoint } = await fetchRemoteModelList({
    providerType: payload.providerType,
    baseUrl,
    headers,
    timeoutMs,
    extraConfig,
  });
  const modelCatalog = buildModelCatalogFromRemoteModels(models);

  return {
    success: true,
    message: "模型连接测试成功，已拉取模型列表",
    providerType: payload.providerType,
    modelName: null,
    modelVersion: null,
    checkedEndpoint,
    models,
    modelCatalog,
  };
}

async function generateAnthropicCompletion(payload, messages, options, extraConfig) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 30000);
  const systemMessage = messages.find((item) => item.role === "system")?.content || "";
  const userMessages = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content,
    }));

  const response = await fetchWithTimeoutRespectAbort(
    `${baseUrl}/v1/messages`,
    {
      method: "POST",
      headers: mergeExtraHeaders({
        "Content-Type": "application/json",
        "x-api-key": payload.apiKey,
        "anthropic-version": extraConfig.anthropicVersion || "2023-06-01",
      }, extraConfig, "inference"),
      body: JSON.stringify({
        model: payload.modelName,
        system: systemMessage || undefined,
        max_tokens: options.maxTokens ?? 1200,
        messages: userMessages,
      }),
      signal: options.signal,
    },
    timeoutMs
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new AppError(`模型调用失败: ${extractErrorMessage(data) || response.statusText}`, 400);
  }

  const content = extractAnthropicContent(data);

  if (!content) {
    throw new AppError("模型调用失败: 未返回有效内容", 400);
  }

  return {
    providerId: payload.id,
    providerType: payload.providerType,
    modelName: payload.modelName,
    content,
    raw: data,
  };
}

async function generateAnthropicCompletionStream(payload, messages, options, extraConfig, onDelta) {
  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 30000);
  const systemMessage = messages.find((item) => item.role === "system")?.content || "";
  const userMessages = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content,
    }));

  const response = await fetchWithTimeout(
    `${baseUrl}/v1/messages`,
    {
      method: "POST",
      headers: mergeExtraHeaders({
        "Content-Type": "application/json",
        "x-api-key": payload.apiKey,
        "anthropic-version": extraConfig.anthropicVersion || "2023-06-01",
      }, extraConfig, "inference"),
      body: JSON.stringify({
        model: payload.modelName,
        system: systemMessage || undefined,
        max_tokens: options.maxTokens ?? 1200,
        messages: userMessages,
        stream: true,
      }),
      signal: options.signal,
    },
    timeoutMs
  );

  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new AppError(`模型流式调用失败: ${extractErrorMessage(data) || response.statusText}`, 400);
  }

  if (!response.body) {
    throw new AppError("模型流式调用失败: 未返回有效流", 400);
  }

  const decoder = new TextDecoder("utf-8");
  const reader = response.body.getReader();
  let content = "";
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const dataText = line.slice(5).trim();
      if (!dataText || dataText === "[DONE]") continue;
      let parsed;
      try {
        parsed = JSON.parse(dataText);
      } catch {
        continue;
      }
      const deltaText = parsed?.delta?.text || parsed?.content_block?.text || "";
      if (deltaText) {
        content += deltaText;
        if (typeof onDelta === "function") {
          await onDelta(deltaText);
        }
      }
    }
  }

  return {
    providerId: payload.id,
    providerType: payload.providerType,
    modelName: payload.modelName,
    content,
    raw: null,
  };
}

function buildInferenceEndpoints(baseUrl, resourcePath, providerType = "", extraConfig = {}) {
  const defaultEndpoints = buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType);
  return resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, getInferenceEndpointConfigKeys(resourcePath), "inference");
}

function buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType = "") {
  const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, "");
  if (/\/v1$/i.test(normalizedBaseUrl)) {
    return [`${normalizedBaseUrl}/${resourcePath}`];
  }

  if (String(providerType).toLowerCase() === "custom") {
    return [`${normalizedBaseUrl}/v1/${resourcePath}`, `${normalizedBaseUrl}/${resourcePath}`];
  }

  return [`${normalizedBaseUrl}/${resourcePath}`, `${normalizedBaseUrl}/v1/${resourcePath}`];
}

function getInferenceEndpointConfigKeys(resourcePath = "") {
  const keys = [
    "inferencePath",
    "inference_path",
    "endpoints.inference",
  ];

  if (resourcePath === "responses") {
    keys.push("responsesPath", "responses_path", "endpoints.responses");
  }

  if (resourcePath === "chat/completions") {
    keys.push("chatCompletionsPath", "chat_completions_path", "endpoints.chatCompletions", "endpoints.chat_completions");
  }

  return keys;
}

function resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, configKeys, scope = "inference") {
  const configuredEndpoints = resolveConfiguredEndpoints(extraConfig, configKeys)
    .map((item) => resolveEndpointUrl(baseUrl, item))
    .filter(Boolean);
  const disableFallback = resolveDisableFallback(extraConfig, scope);

  if (configuredEndpoints.length) {
    return [...new Set(disableFallback ? configuredEndpoints : [...configuredEndpoints, ...defaultEndpoints])];
  }

  if (disableFallback && defaultEndpoints.length > 1) {
    return [...new Set(defaultEndpoints.slice(0, 1))];
  }

  return [...new Set(defaultEndpoints)];
}

function resolveConfiguredEndpoints(extraConfig = {}, configKeys = []) {
  const rawValue = resolveConfigValue(extraConfig, configKeys);

  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item || "").trim()).filter(Boolean);
        }
      } catch {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  if (isPlainObject(rawValue)) {
    const candidate = rawValue.url || rawValue.path || rawValue.endpoint;
    return candidate ? [String(candidate).trim()].filter(Boolean) : [];
  }

  return [];
}

function resolveEndpointUrl(baseUrl, rawEndpoint) {
  const endpoint = String(rawEndpoint || "").trim();
  if (!endpoint) {
    return "";
  }

  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint.replace(/\/+$/, "");
  }

  const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
  if (!normalizedBaseUrl) {
    return endpoint;
  }

  try {
    return new URL(endpoint, `${normalizedBaseUrl}/`).toString().replace(/\/+$/, "");
  } catch {
    return `${normalizedBaseUrl}/${endpoint.replace(/^\/+/, "")}`;
  }
}

function resolveDisableFallback(extraConfig = {}, scope = "inference") {
  const scopeKeys = scope === "model_list"
    ? [
      "disableModelListFallback",
      "disable_model_list_fallback",
      "endpoints.disableModelListFallback",
      "endpoints.disable_model_list_fallback",
    ]
    : [
      "disableInferenceFallback",
      "disable_inference_fallback",
      "endpoints.disableInferenceFallback",
      "endpoints.disable_inference_fallback",
    ];
  const scopedValue = resolveBooleanConfig(extraConfig, scopeKeys);
  if (typeof scopedValue === "boolean") {
    return scopedValue;
  }

  return resolveBooleanConfig(extraConfig, [
    "disableFallbackEndpoints",
    "disable_fallback_endpoints",
    "endpoints.disableFallback",
    "endpoints.disable_fallback",
  ]) === true;
}

function resolveBooleanConfig(extraConfig = {}, keys = []) {
  const rawValue = resolveConfigValue(extraConfig, keys);
  if (rawValue === undefined) {
    return undefined;
  }

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "number") {
    return rawValue !== 0;
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return Boolean(rawValue);
}

function resolveConfigValue(source, keyPaths = []) {
  for (const keyPath of keyPaths) {
    const resolved = resolveConfigPathValue(source, keyPath);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return undefined;
}

function resolveConfigPathValue(source, keyPath) {
  const segments = String(keyPath || "").split(".").filter(Boolean);
  let current = source;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

async function requestOpenAICompatibleJson(endpointCandidates, init, timeoutMs, validator, errorPrefix, errorOptions = {}) {
  let lastError = null;
  const activeEndpointCandidates = errorOptions.primaryEndpointOnly
    ? endpointCandidates.slice(0, 1)
    : endpointCandidates;

  for (const endpoint of activeEndpointCandidates) {
    const adaptiveInit = errorOptions.disableAdaptiveRetry ? null : buildAdaptiveRetryInit(init);

    try {
      const response = await fetchWithTimeoutRespectAbort(endpoint, init, timeoutMs);
      const data = await parseJsonSafely(response);

      if (!response.ok) {
        if (adaptiveInit && shouldRetrySameModel(response.status, data)) {
          const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
          if (retried) {
            return { ...retried, adapted: true };
          }
        }

        lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, errorOptions);
        continue;
      }

      if (typeof validator === "function" && !validator(data)) {
        if (adaptiveInit) {
          const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
          if (retried) {
            return { ...retried, adapted: true };
          }
        }

        lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, {
          ...errorOptions,
          contentMissing: true,
        });
        continue;
      }

      return {
        data,
        checkedEndpoint: endpoint,
        adapted: false,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
      if (adaptiveInit && shouldRetrySameModel(undefined, { error: error?.message || error })) {
        const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
        if (retried) {
          return { ...retried, adapted: true };
        }
      }

      lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, undefined, { error: error?.message || error }, adaptiveInit, errorOptions);
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }

  throw new AppError(`${errorPrefix}: ${lastError?.message || "未知错误"}`, 400);
}

async function tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator) {
  try {
    const response = await fetchWithTimeout(endpoint, adaptiveInit, timeoutMs);
    const data = await parseJsonSafely(response);

    if (!response.ok) {
      return null;
    }

    if (typeof validator === "function" && !validator(data)) {
      return null;
    }

    return {
      data,
      checkedEndpoint: endpoint,
    };
  } catch {
    return null;
  }
}

function buildAdaptiveRetryInit(init) {
  const bodyText = typeof init?.body === "string" ? init.body : "";
  if (!bodyText) {
    return null;
  }

  try {
    const parsed = JSON.parse(bodyText);
    const nextBody = { ...parsed };
    let changed = false;

    if (typeof nextBody.max_tokens === "number" && nextBody.max_tokens > 512) {
      nextBody.max_tokens = 512;
      changed = true;
    }

    if (typeof nextBody.max_output_tokens === "number" && nextBody.max_output_tokens > 512) {
      nextBody.max_output_tokens = 512;
      changed = true;
    }

    if (typeof nextBody.temperature === "number" && nextBody.temperature > 0.1) {
      nextBody.temperature = 0.1;
      changed = true;
    }

    if (nextBody.response_format) {
      delete nextBody.response_format;
      changed = true;
    }

    if (nextBody.text && typeof nextBody.text === "object" && !Array.isArray(nextBody.text) && nextBody.text.format) {
      nextBody.text = { ...nextBody.text };
      delete nextBody.text.format;
      if (Object.keys(nextBody.text).length === 0) {
        delete nextBody.text;
      }
      changed = true;
    }

    if (!changed) {
      return null;
    }

    return {
      ...init,
      body: JSON.stringify(nextBody),
    };
  } catch {
    return null;
  }
}

function shouldRetrySameModel(status, data) {
  const normalizedError = String(extractErrorMessage(data) || data?.raw || data?.error || "").toLowerCase();
  return status === 502
    || status === 503
    || status === 504
    || normalizedError.includes("timeout")
    || normalizedError.includes("timed out")
    || normalizedError.includes("超时")
    || normalizedError.includes("terminated")
    || normalizedError.includes("bad gateway")
    || normalizedError.includes("<!doctype html>")
    || normalizedError.includes("<html");
}

function buildModelCallAppError(errorPrefix, attemptedEndpoint, endpointCandidates, status, data, adaptiveInit, options = {}) {
  const rawText = typeof data?.raw === "string" ? data.raw : "";
  const extractedMessage = extractErrorMessage(data) || rawText || (status ? `HTTP ${status}` : "unknown error");
  const lowerMessage = String(extractedMessage).toLowerCase();
  const suggestions = [];
  const interfaceLabel = options.interfaceLabel || "OpenAI chat.completions";

  if (lowerMessage.includes("<!doctype html>") || lowerMessage.includes("<html")) {
    suggestions.push("接口返回了 HTML 页面，请检查模型地址是否应包含 /v1，或确认该地址确实是 OpenAI 兼容 API。");
  }

  if (status === 502 || status === 503 || status === 504 || lowerMessage.includes("terminated") || lowerMessage.includes("bad gateway")) {
    suggestions.push("上游网关中断了当前请求，建议缩短输入上下文、减少返回长度，或稍后重试。");
  }

  if (options.contentMissing) {
    suggestions.push("模型已返回响应，但当前返回结构未被识别为有效内容，请检查网关返回格式是否完全兼容 OpenAI chat.completions。");
  }

  if (adaptiveInit) {
    suggestions.push("系统已尝试使用同模型的保守参数重试一次：降低 max_tokens、降低 temperature，并移除 response_format。");
  }

  return new AppError(`${errorPrefix}: ${extractedMessage}`, 400, {
    attemptedEndpoint,
    endpointCandidates,
    suggestions,
    recommendedMaxTokens: 512,
  });
}

async function requestOpenAICompatibleStream(endpointCandidates, init, timeoutMs) {
  let lastError = null;

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetchWithTimeout(endpoint, init, timeoutMs);

      if (!response.ok) {
        const data = await parseJsonSafely(response);
        lastError = buildModelCallAppError("模型流式调用失败", endpoint, endpointCandidates, response.status, data, null, {
          interfaceLabel: "OpenAI chat.completions",
        });
        continue;
      }

      if (!response.body) {
        lastError = new AppError("模型流式调用失败: 未返回有效流", 400);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }

  throw new AppError(`模型流式调用失败: ${lastError?.message || "未知错误"}`, 400);
}

async function requestOpenAICompatibleStreamDetailed(endpointCandidates, init, timeoutMs) {
  let lastError = null;

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetchWithTimeout(endpoint, init, timeoutMs);

      if (!response.ok) {
        const data = await parseJsonSafely(response);
        lastError = buildModelCallAppError("模型流式调用失败", endpoint, endpointCandidates, response.status, data, null, {
          interfaceLabel: "OpenAI chat.completions",
        });
        continue;
      }

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("text/html")) {
        const data = await parseJsonSafely(response);
        lastError = new AppError(`模型流式调用失败: ${extractErrorMessage(data) || "接口返回 HTML 页面"}`, 400);
        continue;
      }

      if (!response.body) {
        lastError = new AppError("模型流式调用失败: 未返回有效流", 400);
        continue;
      }

      return {
        response,
        checkedEndpoint: endpoint,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }

  throw new AppError(`模型流式调用失败: ${lastError?.message || "未知错误"}`, 400);
}

async function fetchRemoteModelList({ providerType, baseUrl, headers, timeoutMs, extraConfig }) {
  const endpointCandidates = buildModelListEndpoints(providerType, baseUrl, extraConfig);
  let lastError = null;

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "GET",
          headers,
        },
        timeoutMs
      );
      const data = await parseJsonSafely(response);

      if (!response.ok) {
        lastError = new AppError(`模型列表获取失败: ${extractErrorMessage(data) || response.statusText}`, 400);
        continue;
      }

      const models = normalizeRemoteModelList(data);
      if (!models.length) {
        lastError = new AppError("模型列表获取失败: 远端未返回可用模型列表", 400);
        continue;
      }

      return {
        checkedEndpoint: endpoint,
        models,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }

  throw new AppError(`模型列表获取失败: ${lastError?.message || "未知错误"}`, 400);
}

function buildModelListEndpoints(providerType, baseUrl, extraConfig = {}) {
  const endpoints = [];
  const normalizedProviderType = String(providerType || "").toLowerCase();

  if (normalizedProviderType === "anthropic") {
    endpoints.push(`${baseUrl}/v1/models`);
    return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
      "modelListPath",
      "model_list_path",
      "endpoints.modelList",
      "endpoints.model_list",
    ], "model_list");
  }

  if (normalizedProviderType === "azure_openai") {
    const apiVersion = String(extraConfig.apiVersion || "2024-10-21");
    endpoints.push(`${baseUrl}/openai/models?api-version=${encodeURIComponent(apiVersion)}`);
    endpoints.push(`${baseUrl}/openai/deployments?api-version=${encodeURIComponent(apiVersion)}`);
  }

  if (normalizedProviderType === "custom") {
    if (/\/v1$/i.test(baseUrl)) {
      endpoints.push(`${baseUrl}/models`);
    } else {
      endpoints.push(`${baseUrl}/v1/models`);
      endpoints.push(`${baseUrl}/models`);
    }
    return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
      "modelListPath",
      "model_list_path",
      "endpoints.modelList",
      "endpoints.model_list",
    ], "model_list");
  }

  endpoints.push(`${baseUrl}/models`);

  if (!/\/v1$/i.test(baseUrl)) {
    endpoints.push(`${baseUrl}/v1/models`);
  }

  return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
    "modelListPath",
    "model_list_path",
    "endpoints.modelList",
    "endpoints.model_list",
  ], "model_list");
}

function normalizeRemoteModelList(data) {
  const source = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data?.result)
          ? data.result
          : Array.isArray(data?.items)
            ? data.items
            : [];

  const models = source
    .map((item) => normalizeRemoteModel(item))
    .filter(Boolean);

  const unique = new Map();
  models.forEach((item) => {
    if (!unique.has(item.value)) {
      unique.set(item.value, item);
    }
  });

  return Array.from(unique.values());
}

function normalizeRemoteModel(item) {
  if (typeof item === "string") {
    return { value: item, label: item };
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const value = String(item.id || item.name || item.model || item.model_name || item.deployment_id || item.deploymentId || "").trim();
  if (!value) {
    return null;
  }

  const displayName = String(item.display_name || item.displayName || item.name || item.id || item.model || value).trim();
  return {
    value,
    label: displayName === value ? value : `${displayName} (${value})`,
  };
}

function buildOpenAICompatibleHeaders(payload, extraConfig, scope = "inference") {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${payload.apiKey}`,
  };

  if (payload.organizationId && payload.providerType === "openai") {
    headers["OpenAI-Organization"] = payload.organizationId;
  }

  if (payload.providerType === "azure_openai") {
    delete headers.Authorization;
    headers["api-key"] = payload.apiKey;
  }

  return mergeExtraHeaders(headers, extraConfig, scope);
}

function mergeExtraHeaders(baseHeaders, extraConfig, scope = "inference") {
  const commonHeaders = resolveConfiguredHeaders(extraConfig, [
    "defaultHeaders",
    "default_headers",
    "headers.default",
    "headers.common",
    "headers",
  ]);
  const scopedHeaders = scope === "model_list"
    ? resolveConfiguredHeaders(extraConfig, [
      "modelListHeaders",
      "model_list_headers",
      "headers.modelList",
      "headers.model_list",
    ])
    : resolveConfiguredHeaders(extraConfig, [
      "inferenceHeaders",
      "inference_headers",
      "requestHeaders",
      "request_headers",
      "headers.inference",
    ]);

  return mergeHeaderMaps(baseHeaders, commonHeaders, scopedHeaders);
}

function resolveConfiguredHeaders(extraConfig, keyPaths = []) {
  const rawValue = resolveConfigValue(extraConfig, keyPaths);
  return isHeaderMapObject(rawValue) ? rawValue : {};
}

function isHeaderMapObject(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return false;
  }

  return Object.values(headers).every((value) => (
    value == null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ));
}

function mergeHeaderMaps(...headerMaps) {
  const merged = new Map();

  headerMaps.forEach((headers) => {
    if (!isHeaderMapObject(headers)) {
      return;
    }

    Object.entries(headers).forEach(([key, value]) => {
      const headerKey = String(key || "").trim();
      if (!headerKey) {
        return;
      }

      const normalizedHeaderKey = headerKey.toLowerCase();
      if (value == null) {
        merged.delete(normalizedHeaderKey);
        return;
      }

      merged.set(normalizedHeaderKey, {
        key: headerKey,
        value: String(value),
      });
    });
  });

  return Array.from(merged.values()).reduce((result, item) => {
    result[item.key] = item.value;
    return result;
  }, {});
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseConfigObject(value) {
  if (isPlainObject(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cloneConfigValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneConfigValue(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((result, [key, itemValue]) => {
      result[key] = cloneConfigValue(itemValue);
      return result;
    }, {});
  }

  return value;
}

function mergeConfigObjects(target, override) {
  const base = isPlainObject(target) ? cloneConfigValue(target) : {};
  const nextOverride = parseConfigObject(override);

  if (!nextOverride) {
    return base;
  }

  Object.entries(nextOverride).forEach(([key, value]) => {
    if (value == null) {
      delete base[key];
      return;
    }

    if (isPlainObject(base[key]) && isPlainObject(value)) {
      base[key] = mergeConfigObjects(base[key], value);
      return;
    }

    base[key] = cloneConfigValue(value);
  });

  return base;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    throw new AppError("接口地址不能为空", 400);
  }

  return String(baseUrl).replace(/\/+$/, "");
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError("请求超时，请检查网络、接口地址或鉴权信息", 400);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithTimeoutRespectAbort(url, init, timeoutMs) {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  let abortedByCaller = false;
  const handleExternalAbort = () => {
    abortedByCaller = true;
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortedByCaller = true;
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      if (abortedByCaller) {
        throw error;
      }
      throw new AppError("请求超时，请检查网络、接口地址或鉴权信息", 400);
    }

    throw error;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", handleExternalAbort);
    }
  }
}

async function parseJsonSafely(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

function extractErrorMessage(data) {
  if (!data) {
    return "";
  }

  if (typeof data.message === "string") {
    return sanitizeErrorText(data.message);
  }

  if (typeof data.error === "string") {
    return sanitizeErrorText(data.error);
  }

  if (data.error && typeof data.error.message === "string") {
    return sanitizeErrorText(data.error.message);
  }

  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  const message = choice?.message || {};
  const content = typeof message.content === "string" ? message.content.trim() : "";
  const reasoningContent = typeof message.reasoning_content === "string" ? message.reasoning_content.trim() : "";
  if (!content && reasoningContent) {
    return choice?.finish_reason === "length"
      ? "模型的思考令牌已耗尽，尚未生成最终答案；请关闭深度思考或提高输出 Token 上限"
      : "模型仅返回了思考过程，未生成最终答案；请检查深度思考参数与输出 Token 上限";
  }

  if (typeof data.raw === "string") {
    return sanitizeErrorText(data.raw);
  }

  return "";
}

function sanitizeErrorText(value) {
  const raw = String(value || "");
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.includes("<!doctype html>") || lower.includes("<html")) {
    return "接口返回 HTML 页面，请检查模型地址是否为 OpenAI 兼容 API（通常需要 /v1）。";
  }
  return raw.replace(/\s+/g, " ").trim().slice(0, 300);
}

function extractOpenAICompatibleContent(data) {
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const messageContent = choice?.message?.content;

  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (messageContent && typeof messageContent === "object" && !Array.isArray(messageContent)) {
    return JSON.stringify(messageContent);
  }

  if (Array.isArray(messageContent)) {
    const text = messageContent
      .map((item) => {
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.output_text === "string") return item.output_text;
        if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
        return "";
      })
      .filter(Boolean)
      .join("\n");
    if (text) return text;

    const firstJsonLike = messageContent.find((item) => item && typeof item === "object" && !Array.isArray(item));
    if (firstJsonLike) return JSON.stringify(firstJsonLike);
  }

  if (typeof choice?.text === "string") {
    return choice.text;
  }

  return "";
}

function extractResponsesContent(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      if (Array.isArray(item.content)) return item.content;
      return [item];
    })
    .map((item) => {
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.output_text === "string") return item.output_text;
      if (typeof item?.refusal === "string") return item.refusal;
      if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function resolveInferenceWireApi(extraConfig = {}) {
  const wireApi = String(extraConfig?.wireApi || extraConfig?.wire_api || "").trim().toLowerCase();
  return wireApi === "responses" ? "responses" : "chat_completions";
}

function buildChatCompletionsRequestBody(payload, messages, options, extraConfig, stream = false) {
  const body = {
    model: payload.modelName,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1200,
  };

  if (stream) {
    body.stream = true;
  }

  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  return applyReasoningRequestControls(
    applyInferenceRequestBodyOverrides(body, extraConfig, "chat_completions"),
    payload,
    options,
    "chat_completions"
  );
}

function buildResponsesRequestBody(payload, messages, options, extraConfig, stream = false) {
  const inputMode = resolveResponsesInputMode(extraConfig);
  const body = {
    model: payload.modelName,
    input: buildResponsesInput(messages, inputMode),
    temperature: options.temperature ?? 0.2,
    max_output_tokens: options.maxTokens ?? 1200,
  };
  const instructions = buildResponsesInstructions(messages, inputMode);

  if (instructions) {
    body.instructions = instructions;
  }

  if (stream) {
    body.stream = true;
  }

  const textFormat = normalizeResponsesTextFormat(options.responseFormat);
  if (textFormat) {
    body.text = { format: textFormat };
  }

  if (resolveBooleanConfig(extraConfig, [
    "disableResponseStorage",
    "disable_response_storage",
    "responses.disableResponseStorage",
    "responses.disable_response_storage",
  ]) === true) {
    body.store = false;
  }

  return applyReasoningRequestControls(
    applyInferenceRequestBodyOverrides(body, extraConfig, "responses"),
    payload,
    options,
    "responses"
  );
}

function resolveReasoningProviderFamily(payload = {}) {
  const providerType = String(payload.providerType || "").trim().toLowerCase();
  const identity = [payload.baseUrl, payload.modelName, payload.modelVersion, payload.configName, payload.configCode]
    .map((item) => String(item || "").toLowerCase())
    .join(" ");

  if (providerType === "deepseek" || identity.includes("deepseek")) return "deepseek";
  if (providerType === "qwen" || identity.includes("qwen") || identity.includes("dashscope")) return "qwen";
  if (providerType === "openai" || providerType === "azure_openai") return "openai";
  if (/\b(gpt|o1|o3|o4)[-_a-z0-9.]*/i.test(identity) || identity.includes("openai")) return "openai";
  return null;
}

function normalizeReasoningEffort(value, family) {
  const normalized = String(value || "medium").trim().toLowerCase();
  const supported = new Set(["low", "medium", "high", "xhigh", "max"]);
  const effort = supported.has(normalized) ? normalized : "medium";
  if (family === "deepseek") {
    if (effort === "low") return "low";
    if (effort === "max" || effort === "xhigh") return "max";
    return "high";
  }
  return effort;
}

function applyReasoningRequestControls(body, payload, options = {}, protocol = "chat_completions") {
  if (typeof options.thinkingEnabled !== "boolean") return body;
  const family = resolveReasoningProviderFamily(payload);
  if (!family) return body;

  const enabled = options.thinkingEnabled;
  const effort = normalizeReasoningEffort(options.reasoningEffort, family);
  const thinkingBudget = Number(options.thinkingBudget || 0);

  if (family === "qwen") {
    body.enable_thinking = enabled;
    if (enabled && Number.isInteger(thinkingBudget) && thinkingBudget > 0) {
      body.thinking_budget = thinkingBudget;
    } else {
      delete body.thinking_budget;
    }
    return body;
  }

  if (protocol === "responses") {
    body.reasoning = {
      ...(body.reasoning && typeof body.reasoning === "object" ? body.reasoning : {}),
      effort: enabled ? effort : "none",
    };
    return body;
  }

  if (family === "deepseek") {
    body.thinking = { type: enabled ? "enabled" : "disabled" };
    if (enabled) body.reasoning_effort = effort;
    else delete body.reasoning_effort;
    return body;
  }

  body.reasoning_effort = enabled ? effort : "none";
  return body;
}

function buildReasoningOptions(config = {}) {
  const rawThinkingEnabled = config.thinkingEnabled ?? config.thinking_enabled;
  return {
    thinkingEnabled: rawThinkingEnabled === undefined || rawThinkingEnabled === null ? undefined : Boolean(rawThinkingEnabled),
    reasoningEffort: config.reasoningEffort || config.reasoning_effort || "medium",
    thinkingBudget: config.thinkingBudget ?? config.thinking_budget ?? null,
  };
}

function applyInferenceRequestBodyOverrides(body, extraConfig, protocol) {
  const commonOverride = resolveConfiguredObject(extraConfig, [
    "requestBody",
    "request_body",
    "inferenceBody",
    "inference_body",
    "body.request",
    "body.inference",
  ]);
  const protocolOverride = protocol === "responses"
    ? resolveConfiguredObject(extraConfig, [
      "responsesBody",
      "responses_body",
      "body.responses",
    ])
    : resolveConfiguredObject(extraConfig, [
      "chatCompletionsBody",
      "chat_completions_body",
      "body.chatCompletions",
      "body.chat_completions",
    ]);

  return mergeConfigObjects(mergeConfigObjects(body, commonOverride), protocolOverride);
}

function resolveConfiguredObject(extraConfig, keyPaths = []) {
  return parseConfigObject(resolveConfigValue(extraConfig, keyPaths)) || {};
}

function resolveResponsesInputMode(extraConfig = {}) {
  const rawValue = resolveConfigValue(extraConfig, [
    "responsesInputMode",
    "responses_input_mode",
    "responses.inputMode",
    "responses.input_mode",
  ]);
  const normalizedValue = String(rawValue || "").trim().toLowerCase();

  if (["string", "text", "instructions"].includes(normalizedValue)) {
    return normalizedValue;
  }

  return "messages";
}

function buildResponsesInput(messages, inputMode = "messages") {
  const sourceMessages = Array.isArray(messages) ? messages : [];

  if (inputMode === "string" || inputMode === "text") {
    return serializeMessagesToPrompt(sourceMessages);
  }

  if (inputMode === "instructions") {
    return normalizeResponsesInput(sourceMessages.filter((item) => {
      const normalizedRole = normalizeResponsesRole(item?.role);
      return normalizedRole !== "system" && normalizedRole !== "developer";
    }));
  }

  return normalizeResponsesInput(sourceMessages);
}

function buildResponsesInstructions(messages, inputMode = "messages") {
  if (inputMode !== "instructions") {
    return "";
  }

  return (Array.isArray(messages) ? messages : [])
    .filter((item) => {
      const normalizedRole = normalizeResponsesRole(item?.role);
      return normalizedRole === "system" || normalizedRole === "developer";
    })
    .map((item) => stringifyContentForPrompt(item?.content))
    .filter(Boolean)
    .join("\n\n");
}

function normalizeResponsesInput(messages) {
  return (Array.isArray(messages) ? messages : []).map((item) => ({
    role: normalizeResponsesRole(item?.role),
    content: normalizeResponsesContent(item?.content),
  }));
}

function normalizeResponsesRole(role) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  if (["assistant", "system", "developer"].includes(normalizedRole)) {
    return normalizedRole;
  }
  return "user";
}

function normalizeResponsesContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const items = content
      .map((item) => {
        if (typeof item === "string") {
          return { type: "input_text", text: item };
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        if ((item.type === "text" || item.type === "input_text" || item.type === "output_text") && typeof item.text === "string") {
          return { type: "input_text", text: item.text };
        }

        if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
          return { type: "input_image", image_url: item.image_url.url };
        }

        if (item.type === "input_image" && typeof item.image_url === "string") {
          return { type: "input_image", image_url: item.image_url };
        }

        return null;
      })
      .filter(Boolean);

    if (items.length) {
      return items;
    }
  }

  if (content && typeof content === "object") {
    return JSON.stringify(content);
  }

  return String(content || "");
}

function serializeMessagesToPrompt(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((item) => {
      const content = stringifyContentForPrompt(item?.content);
      if (!content) {
        return "";
      }
      return `${normalizeResponsesRole(item?.role)}:\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function stringifyContentForPrompt(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (!item || typeof item !== "object") {
          return "";
        }
        if (typeof item.text === "string") {
          return item.text;
        }
        if (typeof item.output_text === "string") {
          return item.output_text;
        }
        if (typeof item.refusal === "string") {
          return item.refusal;
        }
        if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
          return `[image] ${item.image_url.url}`;
        }
        if (item.type === "input_image" && typeof item.image_url === "string") {
          return `[image] ${item.image_url}`;
        }
        return isPlainObject(item) ? JSON.stringify(item) : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content === "object") {
    return JSON.stringify(content);
  }

  return String(content || "");
}

function normalizeResponsesTextFormat(responseFormat) {
  if (!responseFormat || typeof responseFormat !== "object" || Array.isArray(responseFormat)) {
    return null;
  }

  const formatType = String(responseFormat.type || "").trim();
  if (!formatType) {
    return null;
  }

  return { ...responseFormat };
}

async function readResponsesSseStream(response, onDelta) {
  if (!response.body) {
    throw new AppError("模型流式调用失败: 未返回有效流", 400);
  }

  const decoder = new TextDecoder("utf-8");
  const reader = response.body.getReader();
  let content = "";
  let buffer = "";
  let eventName = "";
  let dataLines = [];
  let finalResponse = null;

  const flushEvent = async () => {
    const rawData = dataLines.join("\n").trim();
    const currentEventName = eventName.trim();
    eventName = "";
    dataLines = [];

    if (!rawData || rawData === "[DONE]") {
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return;
    }

    const eventType = currentEventName || parsed?.type || "";
    if (eventType === "response.error" || parsed?.error) {
      throw new AppError(`模型流式调用失败: ${extractErrorMessage(parsed) || "未知错误"}`, 400);
    }

    if (eventType === "response.completed") {
      finalResponse = parsed?.response || parsed;
      return;
    }

    const deltaText = extractResponsesStreamDelta(eventType, parsed);
    if (deltaText) {
      content += deltaText;
      if (typeof onDelta === "function") {
        await onDelta(deltaText);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line) {
        await flushEvent();
        continue;
      }

      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
  }

  await flushEvent();

  if (!content && finalResponse) {
    content = extractResponsesContent(finalResponse);
  }

  return {
    content,
    finalResponse,
  };
}

function extractResponsesStreamDelta(eventType, payload) {
  if ((eventType === "response.output_text.delta" || payload?.type === "response.output_text.delta") && typeof payload?.delta === "string") {
    return payload.delta;
  }

  if ((eventType === "response.refusal.delta" || payload?.type === "response.refusal.delta") && typeof payload?.delta === "string") {
    return payload.delta;
  }

  return "";
}

function extractAnthropicContent(data) {
  if (!Array.isArray(data?.content)) {
    return "";
  }

  return data.content
    .map((item) => (item?.type === "text" && typeof item.text === "string" ? item.text : ""))
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  applyModelSelection,
  buildReasoningOptions,
  listModelProviders,
  getModelProviderById,
  getActiveChatModelProviders,
  normalizeRuntimeProvider,
  createModelProvider,
  updateModelProvider,
  deleteModelProvider,
  testModelProvider,
  generateChatCompletion,
  generateChatCompletionStream,
};
