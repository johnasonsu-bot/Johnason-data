const path = require("path");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const AppError = require("../../common/errors/app-error");
const dataSourceRepository = require("../data-sources/data-source.repository");
const ingestionAiConfigService = require("../ingestion-ai-configs/ingestion-ai-config.service");
const modelProviderService = require("../model-providers/model-provider.service");
const apiIngestionService = require("../../services/apiIngestionService");
const { extractPdfTextFromBuffer } = require("../data-lab/data-lab.pdf-extractor");

const MAX_TEXT_LENGTH = 40000;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".xls", ".json", ".yaml", ".yml", ".md", ".txt", ".html", ".htm"]);
const DEFAULT_SYSTEM_PROMPT = [
  "你是数据接入平台的 API 接口文档解析助手。",
  "基于用户文字和接口文档提取可执行的 API 接入配置；不得编造参数、认证信息或响应字段。",
  "认证密钥、Token、密码仅识别名称、位置和类型，value 必须返回空字符串。",
  "只输出 JSON 对象，不要 Markdown。若信息不足，在 missingItems 和 assumptions 中说明。",
  "输出字段固定为 summary、confidence、assumptions、missingItems、reasoning、sourceConfig、parseConfig、errorConfig。",
].join("\n");

async function parseApiDocument({ sourceId, inputText, file }) {
  const source = await dataSourceRepository.getDataSourceById(Number(sourceId));
  if (!source) throw new AppError("来源数据源不存在或不属于当前项目", 404);
  if (String(source.sourceType || "").toLowerCase() !== "api") {
    throw new AppError("AI 接口文档解析仅支持 API 类型来源数据源", 400);
  }

  const document = file ? await extractDocumentText(file) : { text: "", fileName: null, fileType: null };
  const userText = String(inputText || "").trim();
  if (!userText && !document.text) throw new AppError("请输入接口调用说明或上传接口文档", 400);

  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("api_document_parser");
  const provider = await resolveProvider(aiConfig);
  const response = await modelProviderService.generateChatCompletion(provider, buildPrompt({
    source,
    userText,
    documentText: document.text,
    systemPrompt: String(aiConfig?.systemPrompt || "").trim() || DEFAULT_SYSTEM_PROMPT,
  }), {
    temperature: aiConfig?.temperature ?? 0.1,
    maxTokens: Number(aiConfig?.maxTokens || 4000),
    timeoutMs: Number(aiConfig?.timeoutMs || 120000),
    responseFormat: { type: "json_object" },
  });

  const proposal = normalizeProposal(parseJson(response.content), `${userText}\n${document.text}`, source);
  return {
    proposal,
    document: {
      fileName: document.fileName,
      fileType: document.fileType,
      extractedTextLength: document.text.length,
    },
    model: {
      providerName: provider.configName,
      modelName: provider.modelName,
    },
  };
}

async function extractDocumentText(file) {
  const fileName = String(file.originalname || "").trim();
  const extension = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new AppError("仅支持 PDF、Word、Excel、JSON、YAML、Markdown、文本和 HTML 格式的接口文档", 400);
  }
  let text = "";
  if (extension === ".pdf") {
    text = (await extractPdfTextFromBuffer(file.buffer)).text;
  } else if (extension === ".docx") {
    text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
  } else if ([".xlsx", ".xls"].includes(extension)) {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    text = workbook.SheetNames.slice(0, 8).map((sheetName) => `# ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}`).join("\n\n");
  } else {
    text = file.buffer.toString("utf8");
  }
  text = String(text || "").replace(/\u0000/g, "").trim().slice(0, MAX_TEXT_LENGTH);
  if (!text) throw new AppError("未能从文档提取可解析文本；扫描版 PDF 请上传可复制文本版或粘贴接口说明", 400);
  return { text, fileName, fileType: extension.slice(1) };
}

async function resolveProvider(aiConfig) {
  if (aiConfig?.defaultModelProviderId) {
    const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
    return modelProviderService.applyModelSelection(provider, {
      modelName: aiConfig.defaultModelName,
      modelVersion: aiConfig.defaultModelVersion,
    });
  }
  const providers = await modelProviderService.getActiveChatModelProviders();
  if (!providers.length) throw new AppError("未找到可用对话模型，请先在模型管理中配置“API 接口文档解析”场景", 400);
  return providers[0];
}

function buildPrompt({ source, userText, documentText, systemPrompt }) {
  const connection = source.connectionConfig || {};
  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: JSON.stringify({
        apiDataSource: {
          sourceName: source.sourceName,
          sourceCode: source.sourceCode,
          baseUrl: connection.baseUrl || connection.apiBaseUrl || connection.url || "",
          defaultPath: connection.defaultPath || connection.endpointPath || "",
        },
        userInput: userText.slice(0, 12000),
        documentText: documentText.slice(0, MAX_TEXT_LENGTH),
        outputSchema: {
          summary: "接口用途",
          confidence: "high | medium | low",
          assumptions: ["保守假设"],
          missingItems: ["待确认信息"],
          reasoning: ["识别依据"],
          sourceConfig: {
            endpointPath: "/path",
            method: "GET | POST | PUT | PATCH",
            contentType: "application/json | application/x-www-form-urlencoded | text/plain",
            auth: { type: "none | bearer | basic | api_key", apiKeyName: "", apiKeyIn: "header | query | body" },
            headers: [{ name: "", value: "", valueMode: "custom", valueType: "text", description: "" }],
            queryParams: [{ name: "", value: "", valueMode: "custom | system | checkpoint", valueType: "text", description: "" }],
            bodyParams: [{ name: "", value: "", valueMode: "custom | system | checkpoint", valueType: "text", description: "" }],
            bodyType: "json | form | text | none",
            bodyTemplate: "",
            pagination: { type: "none | page | offset | cursor", injectInto: "query | header | body", pageParam: "page", pageSizeParam: "pageSize", offsetParam: "offset", limitParam: "limit", cursorParam: "cursor", pageSize: 100, startPage: 1, maxPages: 100, nextCursorPath: "" },
            incremental: { enabled: false, cursorField: "", startParam: "startTime", endParam: "endTime", injectInto: "query | header | body", startValue: "" }
          },
          parseConfig: { responseFormat: "json | text", recordPath: "data", flattenJson: true, skipErrorRows: true },
          errorConfig: { successStatusCodes: [200], retryStatusCodes: [429, 500, 502, 503, 504], maxRetries: 2, retryIntervalMs: 2000 }
        },
      }),
    },
  ];
}

function parseJson(content) {
  const text = String(content || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("模型未返回合法的接口配置 JSON，请调整提示词或重新解析", 400);
  }
}

function normalizeProposal(raw, inputText = "", source = null) {
  const sourceConfig = apiIngestionService.normalizeApiSourceConfig(raw?.sourceConfig || {}, raw?.sourceConfig?.endpointPath || "");
  const parseConfig = apiIngestionService.normalizeApiParseConfig(raw?.parseConfig || {});
  const errorConfig = apiIngestionService.normalizeApiErrorConfig(raw?.errorConfig || {});
  sourceConfig.auth = { ...sourceConfig.auth, bearerToken: "", password: "", apiKeyValue: "" };
  [sourceConfig.headers, sourceConfig.queryParams, sourceConfig.bodyParams].forEach((items) => items.forEach((item) => {
    if (/(authorization|token|secret|password|api[-_]?key)/i.test(item.name)) item.value = "";
  }));
  mergeExplicitInput(sourceConfig, parseConfig, inputText);
  sourceConfig.endpointPath = normalizeEndpointPath(sourceConfig.endpointPath, source?.connectionConfig || {});
  if (!/(增量|incremental|位点|cursor)/i.test(String(inputText || ""))) {
    sourceConfig.incremental = { ...sourceConfig.incremental, enabled: false };
  }
  normalizeRequestParamModes(sourceConfig);
  configureIncrementalParams(sourceConfig, raw?.sourceConfig?.incremental || {});
  if (sourceConfig.bodyParams.length > 0) {
    sourceConfig.bodyTemplate = "";
  }
  return {
    summary: String(raw?.summary || "已根据接口说明生成参数配置方案。"),
    confidence: ["high", "medium", "low"].includes(String(raw?.confidence || "")) ? raw.confidence : "medium",
    assumptions: normalizeTextList(raw?.assumptions),
    missingItems: normalizeTextList(raw?.missingItems),
    reasoning: normalizeTextList(raw?.reasoning),
    sourceConfig,
    parseConfig,
    errorConfig,
  };
}

function normalizeRequestParamModes(sourceConfig) {
  const validSystemKeys = new Set(["now", "today", "yesterday", "timestamp", "value_range"]);
  const incrementalStartParam = sourceConfig.incremental?.enabled
    ? String(sourceConfig.incremental.startParam || "").trim()
    : "";
  [sourceConfig.headers, sourceConfig.queryParams, sourceConfig.bodyParams].forEach((items) => items.forEach((item) => {
    if (item.valueMode === "system" && !validSystemKeys.has(String(item.systemKey || ""))) {
      item.valueMode = "custom";
    }
    if (item.valueMode === "dataset" && !String(item.datasetField || "").trim()) {
      item.valueMode = "custom";
    }
    if (item.valueMode === "checkpoint" && String(item.name || "").trim() !== incrementalStartParam) {
      item.valueMode = "custom";
    }
  }));
}

function normalizeEndpointPath(value, connectionConfig = {}) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return raw || "/";
  try {
    const endpoint = new URL(raw);
    const baseUrl = String(connectionConfig.baseUrl || connectionConfig.apiBaseUrl || connectionConfig.url || "").trim();
    if (/^https?:\/\//i.test(baseUrl)) {
      const base = new URL(baseUrl);
      const basePath = base.pathname.replace(/\/+$/, "");
      if (endpoint.origin === base.origin && basePath && endpoint.pathname.startsWith(`${basePath}/`)) {
        return `${endpoint.pathname.slice(basePath.length)}${endpoint.search}` || "/";
      }
    }
    return `${endpoint.pathname}${endpoint.search}` || "/";
  } catch {
    return raw;
  }
}

function mergeExplicitInput(sourceConfig, parseConfig, inputText) {
  const text = String(inputText || "");
  const methodAndPath = text.match(/\b(GET|POST|PUT|PATCH)\s+(\/[^\s,，;；]+)/i);
  if (methodAndPath) {
    sourceConfig.method = methodAndPath[1].toUpperCase();
    if (!sourceConfig.endpointPath || sourceConfig.endpointPath === "/") sourceConfig.endpointPath = methodAndPath[2];
  }
  const recordPathMatch = text.match(/\b(?:data|result|response)(?:\.[A-Za-z_][\w]*)+/i);
  if (recordPathMatch && (!parseConfig.recordPath || parseConfig.recordPath === "data")) {
    parseConfig.recordPath = recordPathMatch[0];
  }
  const headerNames = extractNamedParams(text, /(?:Header|请求头)\s*(?:参数)?\s*([^；;。\n]*?)(?=，\s*(?:Query|查询|URL)|[；;。\n]|$)/i);
  const queryNames = extractNamedParams(text, /(?:Query|查询参数|URL\s*参数)\s*(?:参数)?\s*([^；;。\n]*?)(?=[；;。\n]|$)/i);
  headerNames.forEach((name) => addInputParam(sourceConfig.headers, name));
  queryNames.forEach((name) => addInputParam(sourceConfig.queryParams, name));
  if (headerNames.some((name) => /token|api[-_]?key|app[-_]?token|authorization/i.test(name)) && sourceConfig.auth.authType === "none") {
    const keyName = headerNames.find((name) => /token|api[-_]?key|app[-_]?token|authorization/i.test(name));
    sourceConfig.auth = { ...sourceConfig.auth, authType: "api_key", apiKeyName: keyName, apiKeyIn: "header", apiKeyValue: "" };
  }
  const hasPageParams = queryNames.includes("page") && queryNames.some((name) => /page.?size|size|limit/i.test(name));
  if (hasPageParams && sourceConfig.pagination.type === "none") {
    sourceConfig.pagination = { ...sourceConfig.pagination, type: "page", pageParam: "page", pageSizeParam: queryNames.find((name) => /page.?size|size|limit/i.test(name)) || "pageSize" };
  }
  const incrementalParam = queryNames.find((name) => /updated|start|since|cursor|time/i.test(name));
  if (incrementalParam || /增量|incremental/i.test(text)) {
    sourceConfig.incremental = {
      ...sourceConfig.incremental,
      enabled: true,
      startParam: incrementalParam || sourceConfig.incremental.startParam || "startTime",
      injectInto: "query",
    };
  }
}

function extractNamedParams(text, pattern) {
  const match = String(text || "").match(pattern);
  if (!match) return [];
  return String(match[1] || "")
    .split(/[、,，\s]+/)
    .map((value) => value.replace(/[（(].*?[）)]/g, "").trim())
    .filter((value) => /^[A-Za-z_][\w.-]*$/.test(value));
}

function addInputParam(params, name) {
  if (!name || params.some((item) => item.name === name)) return;
  params.push({ name, value: "", enabled: true, valueMode: "custom", valueType: "text" });
}

function configureIncrementalParams(sourceConfig, rawIncremental) {
  if (!sourceConfig.incremental?.enabled) return;
  const injectInto = rawIncremental.injectInto || sourceConfig.incremental.injectInto || "query";
  const startParam = String(rawIncremental.startParam || sourceConfig.incremental.startParam || "startTime").trim();
  const endParam = String(rawIncremental.endParam || "").trim();
  sourceConfig.incremental.injectInto = injectInto;
  sourceConfig.incremental.startParam = startParam;
  sourceConfig.incremental.endParam = endParam;
  const params = injectInto === "header"
    ? sourceConfig.headers
    : injectInto === "body"
      ? sourceConfig.bodyParams
      : sourceConfig.queryParams;
  upsertGeneratedParam(params, startParam, {
    valueMode: "checkpoint",
    checkpointKey: "last_cursor",
    valueType: "datetime",
    description: "增量同步起始位点",
  });
  if (endParam) {
    upsertGeneratedParam(params, endParam, {
      valueMode: "system",
      systemKey: "now",
      systemFormat: "YYYY-MM-DD HH:mm:ss",
      valueType: "datetime",
      description: "增量同步结束时间",
    });
  }
}

function upsertGeneratedParam(params, name, patch) {
  if (!name) return;
  const existing = params.find((item) => item.name === name);
  if (existing) {
    Object.assign(existing, patch, { value: "", enabled: true });
    return;
  }
  params.push({ name, value: "", enabled: true, ...patch });
}

function normalizeTextList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20) : [];
}

module.exports = { parseApiDocument };
