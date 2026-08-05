const AppError = require("../../common/errors/app-error");
const repository = require("./data-development.repository");
const { getAdapter } = require("./adapters");
const {
  decryptSecret,
  isQuerySql,
  normalizeDatasourceStorageType,
  quoteIdentifier,
  resolveRuntimeDatasourceConfig,
} = require("./data-development.utils");
const sqlParser = require("./data-development.sql-parser");
const modelProviderService = require("../model-providers/model-provider.service");
const devAiConfigService = require("../dev-ai-configs/dev-ai-config.service");

const TASK_TYPES = new Set(["generate_sql", "analyze_sql", "rewrite_sql", "optimize_sql", "explain_sql", "data_research"]);
const MAX_AVAILABLE_TABLES = 80;
const MAX_SCHEMA_TABLES = 8;
const MAX_COLUMNS_PER_TABLE = 24;
const MAX_SELECTED_TABLES = 5;
const MAX_SAMPLE_ROWS_PER_TABLE = 50;
const MAX_SAMPLE_COLUMNS_PER_TABLE = 16;
const MAX_SAMPLE_VALUE_LENGTH = 120;
const MAX_CONVERSATION_ITEMS = 8;
const TASK_SCENE_CODE_MAP = {
  generate_sql: "sql_generate",
  analyze_sql: "sql_analyze",
  rewrite_sql: "sql_rewrite",
  optimize_sql: "sql_optimize",
  explain_sql: "sql_explain",
  data_research: "sql_data_research",
};

function materializeDatasource(datasource) {
  const password = decryptSecret(datasource.passwordEncrypted);
  const resolved = resolveRuntimeDatasourceConfig({
    ...datasource,
    password,
  });
  return {
    ...datasource,
    type: resolved.dialect,
    storageType: normalizeDatasourceStorageType(datasource.type),
    host: resolved.host,
    port: resolved.port,
    databaseName: resolved.databaseName,
    username: resolved.username,
    extraConfig: resolved.extraConfig,
    password,
  };
}

async function requireDatasource(id, includePassword = false) {
  const datasource = await repository.getDatasourceById(id, includePassword);
  if (!datasource) {
    throw new AppError("Datasource not found", 404);
  }
  return datasource;
}

async function resolveProvider(modelProviderId) {
  if (modelProviderId) {
    return modelProviderService.getModelProviderById(Number(modelProviderId));
  }

  const providers = await modelProviderService.getActiveChatModelProviders();
  if (!providers.length) {
    throw new AppError("未找到可用的对话模型，请先在系统模型管理中启用一个聊天模型", 400);
  }

  return providers[0];
}

async function resolveTaskConfig(taskType) {
  if (!TASK_TYPES.has(taskType)) {
    return null;
  }
  return devAiConfigService.getActiveConfigByCode(TASK_SCENE_CODE_MAP[taskType]);
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeText(value) {
  return String(value || "").trim();
}

function inferTaskType(payload) {
  if (payload.taskType && payload.taskType !== "auto") {
    return payload.taskType;
  }

  const prompt = normalizeText(payload.prompt).toLowerCase();
  if (!prompt && uniqueStrings(payload.selectedTables).length > 0) {
    return "data_research";
  }
  if (payload.errorMessage || /(报错|错误|失败|异常|为什么.*(为空|没有|只有)|字段不存在|语法)/i.test(prompt)) {
    return "analyze_sql";
  }
  if (/(优化|性能|太慢|耗时|索引|扫描)/i.test(prompt)) {
    return "optimize_sql";
  }
  if (/(生成|写一条|写一个|创建.*sql|给出.*sql)/i.test(prompt)) {
    return "generate_sql";
  }
  if (/(解释|说明|口径|粒度|什么意思|做什么)/i.test(prompt)) {
    return "explain_sql";
  }
  if ((payload.selectedSql || payload.editorSql) && /(修改|改成|增加|新增|调整|替换|继续|基于|改写)/i.test(prompt)) {
    return "rewrite_sql";
  }
  return "generate_sql";
}

function buildSessionTitle(payload) {
  if (payload.taskType === "data_research" && !normalizeText(payload.prompt)) {
    return `已选 ${uniqueStrings(payload.selectedTables).length} 张表的数据调研`;
  }
  const source = normalizeText(payload.prompt)
    || normalizeText(payload.selectedSql).split(/\r?\n/)[0]
    || "SQL 智能辅助";
  return source.length > 36 ? `${source.slice(0, 36)}…` : source;
}

function buildConversationFromMessages(messages) {
  return (Array.isArray(messages) ? messages : []).slice(-MAX_CONVERSATION_ITEMS).map((item) => {
    if (item.role === "user") {
      return { role: "user", content: item.messageText };
    }
    const result = item.payload?.result || item.payload || {};
    const content = [
      result.summary,
      result.explanation,
      result.generatedSql ? `SQL:\n${result.generatedSql}` : "",
      Array.isArray(result.risks) && result.risks.length ? `风险: ${result.risks.join("；")}` : "",
    ].filter(Boolean).join("\n\n");
    return { role: "assistant", content: content || item.messageText };
  });
}

function addProgress(streamContext, processSteps, phase, title, detail) {
  const step = { phase, title, detail: detail || "", status: "completed" };
  processSteps.push(step);
  streamContext.write?.({ type: "progress", data: step });
}

function buildActiveExecutionContext(history) {
  if (!history) return null;
  const preview = history.resultPreview || {};
  const fields = (Array.isArray(preview.fields) ? preview.fields : []).slice(0, 24);
  const rows = (Array.isArray(preview.rows) ? preview.rows : []).slice(0, 12).map((row) => {
    const normalized = {};
    fields.slice(0, 16).forEach((field) => {
      const value = row?.[field];
      normalized[field] = typeof value === "string" && value.length > 200 ? `${value.slice(0, 200)}…` : value;
    });
    return normalized;
  });
  return {
    historyId: history.id,
    status: history.status,
    sqlText: history.sqlText,
    databaseName: history.databaseName,
    durationMs: history.durationMs,
    errorMessage: history.errorMessage || null,
    fields,
    rows,
    rowCount: Number(preview.rowCount || 0),
    affectedRows: Number(preview.affectedRows || 0),
    previewTruncated: Number(preview.rowCount || 0) > rows.length,
  };
}

function buildPromptKeywords(payload) {
  const source = [
    payload.prompt,
    payload.selectedSql,
    payload.editorSql,
    payload.errorMessage,
  ]
    .map((item) => normalizeText(item).toLowerCase())
    .join(" ");

  return uniqueStrings(
    source
      .split(/[^a-z0-9_]+/i)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
  );
}

function matchTableByReference(tables, reference) {
  const normalizedReference = String(reference || "").toLowerCase();
  if (!normalizedReference) return null;

  return tables.find((item) => {
    const name = String(item.name || "").toLowerCase();
    return name === normalizedReference || name.endsWith(`.${normalizedReference}`);
  }) || null;
}

function scoreTable(tableName, keywords) {
  const normalized = String(tableName || "").toLowerCase();
  if (!keywords.length) return 0;

  return keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    if (normalized === keyword) return score + 12;
    if (normalized.endsWith(`.${keyword}`)) return score + 10;
    if (normalized.includes(keyword)) return score + 6;
    return score;
  }, 0);
}

function selectCandidateTables(tables, payload, dialect) {
  const keywords = buildPromptKeywords(payload);
  const referencedTables = uniqueStrings([
    ...sqlParser.extractTables(payload.selectedSql, dialect),
    ...sqlParser.extractTables(payload.editorSql, dialect),
  ]);

  const directMatches = referencedTables
    .map((reference) => matchTableByReference(tables, reference))
    .filter(Boolean);

  const scoredTables = tables
    .map((item) => ({ item, score: scoreTable(item.name, keywords) }))
    .sort((left, right) => right.score - left.score || String(left.item.name).localeCompare(String(right.item.name)))
    .map((entry) => entry.item);

  const merged = [];
  const seen = new Set();
  for (const item of [...directMatches, ...scoredTables, ...tables]) {
    const key = String(item?.name || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return {
    referencedTables,
    availableTables: merged.slice(0, MAX_AVAILABLE_TABLES),
    schemaTables: merged.slice(0, MAX_SCHEMA_TABLES),
  };
}

function normalizeSelectedTables(values) {
  return uniqueStrings(values).slice(0, MAX_SELECTED_TABLES);
}

function resolveScopedTables(tables, selectedTables) {
  const normalizedSelections = normalizeSelectedTables(selectedTables);
  if (!normalizedSelections.length) {
    return [];
  }

  return normalizedSelections
    .map((reference) => matchTableByReference(tables, reference))
    .filter(Boolean);
}

async function loadTableSchemas(adapter, datasource, databaseName, tables) {
  const results = [];

  for (const table of tables) {
    try {
      const columns = await adapter.getColumns(datasource, databaseName, table.name);
      results.push({
        tableName: table.name,
        tableType: table.type,
        columns: (Array.isArray(columns) ? columns : []).slice(0, MAX_COLUMNS_PER_TABLE).map((column) => ({
          name: column.name,
          dataType: column.dataType,
          columnType: column.columnType,
          nullable: Boolean(column.nullable),
          primaryKey: Boolean(column.primaryKey),
          comment: column.comment || "",
        })),
      });
    } catch (error) {
      results.push({
        tableName: table.name,
        tableType: table.type,
        columns: [],
        loadError: error.message || "failed to load columns",
      });
    }
  }

  return results;
}

function buildRandomFunction(dialect) {
  switch (String(dialect || "").toLowerCase()) {
    case "postgresql":
    case "postgres":
    case "gaussdb":
      return "RANDOM()";
    case "clickhouse":
      return "rand()";
    case "hive":
      return "rand()";
    case "oracle":
      return "DBMS_RANDOM.VALUE";
    case "dm":
      return "RAND()";
    case "mysql":
    default:
      return "RAND()";
  }
}

function sanitizeSampleValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[binary:${value.length}]`;
  }

  if (typeof value === "string") {
    return value.length > MAX_SAMPLE_VALUE_LENGTH
      ? `${value.slice(0, MAX_SAMPLE_VALUE_LENGTH)}...`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  try {
    const text = JSON.stringify(value);
    return text.length > MAX_SAMPLE_VALUE_LENGTH
      ? `${text.slice(0, MAX_SAMPLE_VALUE_LENGTH)}...`
      : text;
  } catch (error) {
    const text = String(value);
    return text.length > MAX_SAMPLE_VALUE_LENGTH
      ? `${text.slice(0, MAX_SAMPLE_VALUE_LENGTH)}...`
      : text;
  }
}

function buildSampleQuery(tableName, columns, dialect) {
  const tableSql = quoteIdentifier(tableName, dialect);
  const selectedColumns = Array.isArray(columns) && columns.length
    ? columns.map((column) => quoteIdentifier(column, dialect)).join(", ")
    : "*";
  return `SELECT ${selectedColumns}\nFROM ${tableSql}\nORDER BY ${buildRandomFunction(dialect)}\nLIMIT ${MAX_SAMPLE_ROWS_PER_TABLE}`;
}

async function sampleTableRows(adapter, datasource, databaseName, tableSchema) {
  const selectedColumns = (tableSchema.columns || [])
    .slice(0, MAX_SAMPLE_COLUMNS_PER_TABLE)
    .map((column) => column.name);
  const truncated = (tableSchema.columns || []).length > selectedColumns.length;

  const randomSql = buildSampleQuery(tableSchema.tableName, selectedColumns, datasource.type);

  try {
    const result = await adapter.executeQuery(datasource, randomSql, {
      databaseName: databaseName || datasource.databaseName,
      resultLimit: MAX_SAMPLE_ROWS_PER_TABLE,
    });
    const effectiveColumns = selectedColumns.length ? selectedColumns : (result.fields || []).slice(0, MAX_SAMPLE_COLUMNS_PER_TABLE);
    return {
      tableName: tableSchema.tableName,
      rowCount: Number(result.rowCount || (result.rows || []).length || 0),
      columns: effectiveColumns,
      truncated,
      sampleRows: (result.rows || []).map((row) => Object.fromEntries(
        effectiveColumns.map((column) => [column, sanitizeSampleValue(row?.[column])])
      )),
      sampleError: null,
    };
  } catch (randomError) {
    const fallbackSql = `SELECT ${selectedColumns.length ? selectedColumns.map((column) => quoteIdentifier(column, datasource.type)).join(", ") : "*"}\nFROM ${quoteIdentifier(tableSchema.tableName, datasource.type)}\nLIMIT ${MAX_SAMPLE_ROWS_PER_TABLE}`;
    try {
      const result = await adapter.executeQuery(datasource, fallbackSql, {
        databaseName: databaseName || datasource.databaseName,
        resultLimit: MAX_SAMPLE_ROWS_PER_TABLE,
      });
      const effectiveColumns = selectedColumns.length ? selectedColumns : (result.fields || []).slice(0, MAX_SAMPLE_COLUMNS_PER_TABLE);
      return {
        tableName: tableSchema.tableName,
        rowCount: Number(result.rowCount || (result.rows || []).length || 0),
        columns: effectiveColumns,
        truncated,
        sampleRows: (result.rows || []).map((row) => Object.fromEntries(
          effectiveColumns.map((column) => [column, sanitizeSampleValue(row?.[column])])
        )),
        sampleError: `随机抽样失败，已回退为顺序抽样: ${randomError.message || "unknown error"}`,
      };
    } catch (fallbackError) {
      return {
        tableName: tableSchema.tableName,
        rowCount: 0,
        columns: selectedColumns,
        truncated,
        sampleRows: [],
        sampleError: fallbackError.message || randomError.message || "样本数据读取失败",
      };
    }
  }
}

async function loadTableSamples(adapter, datasource, databaseName, tableSchemas) {
  const sampledTables = [];
  for (const tableSchema of tableSchemas) {
    sampledTables.push(await sampleTableRows(adapter, datasource, databaseName, tableSchema));
  }
  return sampledTables;
}

function buildTaskInstructions(taskType) {
  switch (taskType) {
    case "generate_sql":
      return "按用户需求生成 SQL。";
    case "analyze_sql":
      return "分析 SQL 报错、逻辑问题或语义问题；只有确实需要修复时才给出修复 SQL。";
    case "rewrite_sql":
      return "在原 SQL 基础上按新增需求最小改动改写。";
    case "optimize_sql":
      return "分析主要性能问题并给出优化 SQL 或优化建议。";
    case "explain_sql":
      return "只解释 SQL 的作用、处理逻辑、结果粒度和关键条件，不要原样复述或重新输出 SQL。";
    case "data_research":
      return "基于用户选定表的真实表结构、字段注释和样例数据开展数据调研，只输出三条聚焦实际业务决策、可直接实施的完整分析需求。";
    default:
      return "完成 SQL 辅助任务。";
  }
}

function requiresGeneratedSql(taskType) {
  return ["generate_sql", "rewrite_sql", "optimize_sql"].includes(taskType);
}

function buildTaskOutputInstructions(taskType, stream = false) {
  if (taskType === "data_research") {
    return stream
      ? [
        "数据调研任务禁止输出【SQL】段落，必须严格输出【分析方向1】【分析方向2】【分析方向3】三个段落，不能多也不能少。",
        "每个分析方向段落必须逐行包含：标题、业务问题、分析对象、分析维度、核心指标、统计口径、数据依据、业务价值。",
        "每一条都必须是一项聚焦实际业务需求、能够直接用于后续生成 SQL 的完整分析需求；禁止把字段名、维度、指标或机构名称单独拆成分析方向。",
        "分析方向必须依据真实表结构、字段注释和样例值推断业务含义，三条方向应分别回答不同且明确的业务决策问题，避免泛化的规模、趋势、异常模板。",
      ].join("\n")
      : [
        "数据调研任务的 generatedSql 必须为空字符串，analysisDirections 必须严格包含三个对象。",
        "每个对象必须完整填写 title、businessQuestion、analysisObject、dimensions、metrics、statisticalScope、sourceFields、businessValue。",
        "禁止把字段名、维度、指标或机构名称单独拆成分析方向；每条都必须是可直接实施的完整业务分析需求。",
      ].join("\n");
  }
  if (taskType === "explain_sql") {
    return stream
      ? "解释任务只输出摘要、分析说明和必要的表/假设/风险/建议，禁止输出【SQL】段落，禁止复述原 SQL。"
      : "解释任务的 generatedSql 必须为空字符串，只返回解释逻辑，禁止复述原 SQL。";
  }
  if (taskType === "analyze_sql") {
    return stream
      ? "分析任务以问题诊断为主；仅在存在明确、可落地的修复方案时输出【SQL】段落，否则省略该段落。"
      : "分析任务以问题诊断为主；仅在存在明确、可落地的修复方案时填写 generatedSql，否则返回空字符串。";
  }
  return stream
    ? "必须输出【SQL】段落，且只放可执行 SQL 内容。"
    : "generatedSql 必须填写可执行 SQL，且只返回 SQL 内容。";
}

function buildSystemPrompt(taskType, datasourceType, configuredPrompt = "") {
  const basePrompt = [
    "你是企业数据开发 SQL分析中的 SQL Copilot。",
    "必须严格依据当前数据源元数据回答，不允许臆造不存在的表或字段。",
    `当前数据库类型/SQL 方言: ${datasourceType}。`,
    `当前任务类型: ${taskType}。`,
    buildTaskInstructions(taskType),
    buildTaskOutputInstructions(taskType),
    "优先直接回答用户问题，不要过度发散，不要补充无关背景。",
    "所有 SQL 必须符合当前数据库类型/方言，不允许使用其他数据库的语法。",
    "如果无法确认，明确说明信息不足，不要猜测。",
    "返回 JSON 对象，不要输出 Markdown，不要输出额外说明。",
    JSON.stringify({
      summary: "string",
      explanation: "string",
      generatedSql: "string",
      assumptions: ["string"],
      risks: ["string"],
      suggestions: ["string"],
      analysisDirections: [{
        title: "string",
        businessQuestion: "string",
        analysisObject: "string",
        dimensions: ["string"],
        metrics: ["string"],
        statisticalScope: "string",
        sourceFields: ["table.field"],
        businessValue: "string",
      }],
      usedTables: [{ tableName: "string", reason: "string", columns: ["string"] }],
      diagnostics: [{ severity: "high|medium|low", title: "string", detail: "string" }],
    }),
  ].join("\n");

  return configuredPrompt ? `${configuredPrompt}\n\n${basePrompt}` : basePrompt;
}

function buildStreamSystemPrompt(taskType, datasourceType, configuredPrompt = "") {
  const omitsSql = ["explain_sql", "data_research"].includes(taskType);
  const sectionTitles = [
    "【摘要】",
    "【分析说明】",
    ...(omitsSql ? [] : ["【SQL】"]),
    ...(taskType === "data_research" ? ["【分析方向1】", "【分析方向2】", "【分析方向3】"] : []),
    "【使用表】",
    "【问题诊断】",
    "【关键假设】",
    "【风险提示】",
    ...(taskType === "data_research" ? [] : ["【后续建议】"]),
  ];
  const basePrompt = [
    "你是企业数据开发 SQL分析中的 SQL Copilot。",
    "必须严格依据当前数据源元数据回答，不允许臆造不存在的表或字段。",
    `当前数据库类型/SQL 方言: ${datasourceType}。`,
    `当前任务类型: ${taskType}。`,
    buildTaskInstructions(taskType),
    buildTaskOutputInstructions(taskType, true),
    "优先直接回答用户问题，不要过度发散，不要补充无关背景。",
    "所有 SQL 必须符合当前数据库类型/方言，不允许使用其他数据库的语法。",
    "请使用纯文本分段输出，不要输出 JSON，不要输出 Markdown 代码块。",
    "使用以下段落标题组织回答：",
    ...sectionTitles,
  ].join("\n");

  return configuredPrompt ? `${configuredPrompt}\n\n${basePrompt}` : basePrompt;
}

function buildConversationPrompt(conversation) {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return "";
  }

  return conversation
    .slice(-MAX_CONVERSATION_ITEMS)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n\n");
}

function buildUserPrompt(payload, context) {
  const blocks = [
    `任务类型: ${payload.taskType}`,
    `当前数据库: ${payload.databaseName || context.datasource.databaseName || ""}`,
    `当前数据库类型/方言: ${context.datasource.type}`,
    "可用表清单:",
    JSON.stringify(context.availableTableNames),
    "重点表结构:",
    JSON.stringify(context.tableSchemas),
  ];

  if (context.selectedTables?.length) {
    blocks.push("用户指定表范围:");
    blocks.push(JSON.stringify(context.selectedTables));
  }

  if (context.sampledTables?.length) {
    blocks.push("重点表样本数据:");
    blocks.push(JSON.stringify(context.sampledTables));
  }

  if (payload.prompt) {
    blocks.push(`用户问题:\n${payload.prompt}`);
  }
  if (payload.selectedSql) {
    blocks.push(`用户选中的 SQL:\n${payload.selectedSql}`);
  }
  if (payload.editorSql && payload.editorSql !== payload.selectedSql) {
    blocks.push(`编辑器当前 SQL:\n${payload.editorSql}`);
  }
  if (payload.errorMessage) {
    blocks.push(`最近执行错误:\n${payload.errorMessage}`);
  }
  if (context.activeExecution) {
    blocks.push("当前激活执行结果:");
    blocks.push(JSON.stringify(context.activeExecution));
  }

  const conversationPrompt = buildConversationPrompt(payload.conversation);
  if (conversationPrompt) {
    blocks.push(`最近多轮上下文:\n${conversationPrompt}`);
  }

  const generatedSqlRequirement = payload.taskType === "data_research"
    ? "2. 禁止输出 SQL；必须结合表结构、字段注释和样例值生成且仅生成三条完整业务分析需求，每条都包含标题、业务问题、分析对象、分析维度、核心指标、统计口径、数据依据和业务价值，禁止将字段、维度或指标拆成独立方向。"
    : payload.taskType === "explain_sql"
      ? "2. 只返回解释逻辑，禁止输出或复述原 SQL。"
    : payload.taskType === "analyze_sql"
      ? "2. 仅在确实需要修复时返回修复 SQL，不需要修复时不要输出 SQL。"
      : "2. 返回的 SQL 只包含 SQL 内容，不要带代码块。";
  blocks.push([
    "要求:",
    "1. 生成/分析时必须基于当前数据库类型/方言。",
    generatedSqlRequirement,
    "3. usedTables 必须来自给定元数据。",
    "4. 如果提供了样本数据，优先结合样本值语义理解业务字段和枚举含义。",
    "5. 如果提供了当前激活执行结果，必须在回答中明确利用其字段、行数、预览值、状态或错误，不得假装看到了未提供的完整结果。",
    "6. 如果信息不足，直接说明。",
  ].join("\n"));

  return blocks.join("\n\n");
}

function parseJsonObject(content) {
  const raw = normalizeText(content);
  if (!raw) return null;

  const candidates = [raw];
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    candidates.push(objectMatch[0].trim());
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

function extractSqlSnippet(rawText) {
  const raw = normalizeText(rawText);
  if (!raw) return "";

  const fenced = raw.match(/```sql\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  if (isQuerySql(raw) || /^(insert|update|delete|create|alter|drop)\b/i.test(raw)) {
    return raw.replace(/```/g, "").trim();
  }

  return "";
}

function resolveGeneratedSql(taskType, candidate, rawText) {
  if (["explain_sql", "data_research"].includes(taskType)) return "";
  return normalizeText(candidate) || extractSqlSnippet(rawText);
}

function parseSectionedContent(rawText) {
  const raw = String(rawText || "").replace(/\r/g, "").trim();
  if (!raw) return {};

  const sectionMatches = Array.from(raw.matchAll(/【([^】]+)】/g));
  if (!sectionMatches.length) {
    return {};
  }

  const sections = {};
  for (let index = 0; index < sectionMatches.length; index += 1) {
    const match = sectionMatches[index];
    const title = String(match[1] || "").trim();
    const start = match.index + match[0].length;
    const end = index + 1 < sectionMatches.length ? sectionMatches[index + 1].index : raw.length;
    sections[title] = raw.slice(start, end).trim();
  }
  return sections;
}

function parseBulletList(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "").trim())
    .filter(Boolean);
}

function normalizeDiagnostics(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      severity: ["high", "medium", "low"].includes(String(item?.severity || "").toLowerCase())
        ? String(item.severity).toLowerCase()
        : "medium",
      title: normalizeText(item?.title),
      detail: normalizeText(item?.detail),
    }))
    .filter((item) => item.title || item.detail);
}

function parseDiagnosticsFromSections(value) {
  return parseBulletList(value)
    .map((line) => {
      const [severityRaw, titleRaw, detailRaw] = line.split("|").map((item) => String(item || "").trim());
      return {
        severity: ["high", "medium", "low"].includes(severityRaw.toLowerCase()) ? severityRaw.toLowerCase() : "medium",
        title: titleRaw || "",
        detail: detailRaw || "",
      };
    })
    .filter((item) => item.title || item.detail);
}

function normalizeUsedTables(value, availableTableNames) {
  if (!Array.isArray(value)) return [];
  const available = new Set((availableTableNames || []).map((item) => String(item)));

  return value
    .map((item) => ({
      tableName: normalizeText(item?.tableName),
      reason: normalizeText(item?.reason),
      columns: uniqueStrings(item?.columns),
    }))
    .filter((item) => item.tableName && available.has(item.tableName));
}

function parseUsedTablesFromSections(value, availableTableNames) {
  const available = new Set((availableTableNames || []).map((item) => String(item)));
  return parseBulletList(value)
    .map((line) => {
      const [tableNameRaw, reasonRaw, columnsRaw] = line.split("|").map((item) => String(item || "").trim());
      return {
        tableName: tableNameRaw,
        reason: reasonRaw || "",
        columns: uniqueStrings(String(columnsRaw || "").split(",").map((item) => item.trim())),
      };
    })
    .filter((item) => item.tableName && available.has(item.tableName));
}

async function validateGeneratedSql(generatedSql, session) {
  const sqlText = normalizeText(generatedSql);
  if (!sqlText) {
    return {
      valid: false,
      syntaxValid: false,
      objectValid: false,
      explainValid: false,
      messages: ["AI 未返回可执行 SQL"],
    };
  }

  const messages = [];
  let syntaxValid = true;
  let objectValid = true;
  let explainValid = false;

  try {
    sqlParser.parseSql(sqlText, session.datasource.type);
  } catch (error) {
    syntaxValid = false;
    objectValid = false;
    messages.push(error.message || "SQL 语法校验失败");
    return { valid: false, syntaxValid, objectValid, explainValid, messages };
  }

  const referencedTables = uniqueStrings(sqlParser.extractTables(sqlText, session.datasource.type));
  const availableTables = new Set(
    (session.context.availableTableNames || []).map((item) => String(item).toLowerCase())
  );

  for (const tableName of referencedTables) {
    const normalized = String(tableName || "").toLowerCase();
    const exists = availableTables.has(normalized)
      || Array.from(availableTables).some((item) => item.endsWith(`.${normalized}`));
    if (!exists) {
      objectValid = false;
      messages.push(`未在当前${session.datasource.type}数据源中识别到表: ${tableName}`);
    }
  }

  if (syntaxValid && objectValid && isQuerySql(sqlText)) {
    try {
      await session.adapter.executeQuery(session.datasource, `EXPLAIN ${sqlText}`, {
        databaseName: session.databaseName || session.datasource.databaseName,
        resultLimit: 20,
      });
      explainValid = true;
    } catch (error) {
      messages.push(`Explain 校验未通过: ${error.message || "未知错误"}`);
    }
  } else if (syntaxValid && objectValid) {
    explainValid = true;
  }

  if (syntaxValid && objectValid && explainValid) {
    messages.push(`已基于当前${session.datasource.type}方言完成 SQL 校验`);
  }

  return {
    valid: syntaxValid && objectValid && explainValid,
    syntaxValid,
    objectValid,
    explainValid,
    messages,
  };
}

function buildDefaultUsedTables(context) {
  return context.tableSchemas.slice(0, 3).map((item) => ({
    tableName: item.tableName,
    reason: "作为当前任务的候选上下文表",
    columns: item.columns.slice(0, 6).map((column) => column.name),
  }));
}

function summarizeSampledTables(context) {
  return (context.sampledTables || []).map((item) => ({
    tableName: item.tableName,
    rowCount: item.rowCount,
    columns: item.columns,
    truncated: Boolean(item.truncated),
    sampleError: item.sampleError || null,
  }));
}

function normalizeDirectionList(value) {
  if (Array.isArray(value)) return uniqueStrings(value);
  return uniqueStrings(String(value || "").split(/[、,，;；]/).map((item) => item.trim()));
}

function normalizeAnalysisDirection(value) {
  if (!value || typeof value !== "object") return null;
  const direction = {
    title: normalizeText(value.title),
    businessQuestion: normalizeText(value.businessQuestion),
    analysisObject: normalizeText(value.analysisObject),
    dimensions: normalizeDirectionList(value.dimensions),
    metrics: normalizeDirectionList(value.metrics),
    statisticalScope: normalizeText(value.statisticalScope),
    sourceFields: normalizeDirectionList(value.sourceFields),
    businessValue: normalizeText(value.businessValue),
  };
  return direction.title && direction.businessQuestion ? direction : null;
}

function parseAnalysisDirectionSection(value) {
  const fieldMap = {
    "标题": "title",
    "业务问题": "businessQuestion",
    "分析对象": "analysisObject",
    "分析维度": "dimensions",
    "核心指标": "metrics",
    "统计口径": "statisticalScope",
    "数据依据": "sourceFields",
    "业务价值": "businessValue",
  };
  const parsed = {};
  let currentField = null;
  for (const rawLine of String(value || "").split("\n")) {
    const line = rawLine.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "").replace(/\*\*/g, "").trim();
    if (!line) continue;
    const match = line.match(/^(标题|业务问题|分析对象|分析维度|核心指标|统计口径|数据依据|业务价值)\s*[：:]\s*(.*)$/);
    if (match) {
      currentField = fieldMap[match[1]];
      parsed[currentField] = match[2].trim();
    } else if (currentField) {
      parsed[currentField] = `${parsed[currentField] || ""}${parsed[currentField] ? "；" : ""}${line}`;
    }
  }
  return normalizeAnalysisDirection(parsed);
}

function buildFallbackAnalysisDirections(context) {
  const tableNames = context.tableSchemas.map((item) => item.tableName);
  const fields = context.tableSchemas.flatMap((table) => table.columns.map((column) => ({
    tableName: table.tableName,
    name: column.name,
    dataType: String(column.dataType || column.columnType || "").toLowerCase(),
    comment: String(column.comment || ""),
  })));
  const findFields = (pattern, typePattern = null) => fields.filter((field) => (
    pattern.test(`${field.name} ${field.comment}`)
    || (typePattern ? typePattern.test(field.dataType) : false)
  ));
  const timeFields = findFields(/时间|日期|创建|提交|完成|time|date|created|updated/i, /date|time/);
  const statusFields = findFields(/状态|结果|阶段|类型|渠道|机构|区域|部门|status|result|type|channel|org|region/i);
  const numericFields = fields.filter((field) => /int|number|numeric|decimal|float|double/.test(field.dataType));
  const identifierFields = findFields(/编号|编码|流水|主键|标识|(^|_)id($|_)|code|no$/i);
  const source = (items) => uniqueStrings(items.slice(0, 8).map((item) => `${item.tableName}.${item.name}`));
  const tableScope = tableNames.join("、") || "所选业务表";
  const dimensionFields = source(statusFields.length ? statusFields : fields);
  const metricFields = source(numericFields.length ? numericFields : identifierFields.length ? identifierFields : fields);
  const timeSource = source(timeFields);
  return [
    {
      title: "核心业务办理结构与差异分析",
      businessQuestion: `当前 ${tableScope} 所反映的核心业务量主要集中在哪些类型、渠道或组织，结构差异是否需要调整资源配置？`,
      analysisObject: `所选表中的核心业务记录及其所属类型、渠道或组织`,
      dimensions: dimensionFields,
      metrics: ["业务记录数", "各分类占比", "分类间差异"],
      statisticalScope: `按业务唯一标识去重后统计；分类口径以 ${dimensionFields.join("、") || "可识别的分类字段"} 的实际取值为准。`,
      sourceFields: uniqueStrings([...dimensionFields, ...source(identifierFields)]),
      businessValue: "识别业务量集中区域和结构失衡，为人员、渠道或服务资源配置提供依据。",
    },
    {
      title: "业务处理时效与积压环节分析",
      businessQuestion: `各类业务从发生到完成需要多长时间，哪些状态、组织或渠道存在明显积压或处理偏慢？`,
      analysisObject: "具有时间和处理状态信息的业务记录",
      dimensions: uniqueStrings([...dimensionFields, ...(timeSource.length ? ["日/周/月"] : [])]),
      metrics: ["处理业务量", "平均处理时长", "超时业务量", "完成率"],
      statisticalScope: `以 ${timeSource.join("、") || "可识别的业务时间字段"} 确定发生与完成时间；完成状态以样例数据中的实际状态值为准。`,
      sourceFields: uniqueStrings([...timeSource, ...dimensionFields]),
      businessValue: "定位办理瓶颈和积压环节，为流程优化与服务时效考核提供依据。",
    },
    {
      title: "业务结果质量与重点风险识别",
      businessQuestion: `哪些业务类型、组织或渠道的失败、退回、异常或低质量结果更集中，主要风险组合是什么？`,
      analysisObject: "具有结果、状态或质量特征的业务记录",
      dimensions: dimensionFields,
      metrics: ["异常业务量", "异常率", "失败或退回率", "风险组合占比"],
      statisticalScope: `异常口径仅依据 ${source(statusFields).join("、") || "可识别的状态和结果字段"} 的真实取值定义，不推断样例中不存在的异常类型。`,
      sourceFields: uniqueStrings([...source(statusFields), ...metricFields]),
      businessValue: "识别高风险业务组合，支持质量治理、问题排查和重点对象跟进。",
    },
  ];
}

function normalizeAnalysisDirections(values, legacySuggestions, context) {
  const directions = (Array.isArray(values) ? values : [])
    .map(normalizeAnalysisDirection)
    .filter(Boolean);
  const legacyDirections = uniqueStrings(legacySuggestions).slice(0, 3).map((item, index) => normalizeAnalysisDirection({
    title: item.split(/[：:]/, 1)[0] || `分析方向 ${index + 1}`,
    businessQuestion: item,
    analysisObject: context.tableSchemas.map((table) => table.tableName).join("、") || "所选业务表",
    dimensions: [],
    metrics: [],
    statisticalScope: "以所选表中的真实字段和样例值为准。",
    sourceFields: [],
    businessValue: "用于形成后续可执行的数据分析需求。",
  })).filter(Boolean);
  return [...directions, ...legacyDirections, ...buildFallbackAnalysisDirections(context)].slice(0, 3);
}

function normalizeResult(taskType, rawText, parsed, context, provider) {
  const availableTableNames = context.tableSchemas.map((item) => item.tableName);
  const generatedSql = resolveGeneratedSql(taskType, parsed?.generatedSql, rawText);
  const usedTables = normalizeUsedTables(parsed?.usedTables, availableTableNames);

  const analysisDirections = taskType === "data_research"
    ? normalizeAnalysisDirections(parsed?.analysisDirections, parsed?.suggestions, context)
    : [];
  const suggestions = taskType === "data_research"
    ? analysisDirections.map((item) => item.businessQuestion)
    : uniqueStrings(parsed?.suggestions);

  return {
    taskType,
    provider: {
      id: provider.id,
      configName: provider.configName,
      modelName: provider.modelName,
      modelVersion: provider.modelVersion || null,
      providerType: provider.providerType,
    },
    summary: normalizeText(parsed?.summary) || (taskType === "data_research" ? "已完成所选表的数据调研" : "AI 已返回 SQL 辅助结果"),
    explanation: normalizeText(parsed?.explanation) || normalizeText(rawText),
    generatedSql,
    assumptions: uniqueStrings(parsed?.assumptions),
    risks: uniqueStrings(parsed?.risks),
    suggestions,
    analysisDirections,
    diagnostics: normalizeDiagnostics(parsed?.diagnostics),
    usedTables: usedTables.length ? usedTables : buildDefaultUsedTables(context),
    referencedTables: context.referencedTables,
    metadataTables: context.tableSchemas.map((item) => ({
      tableName: item.tableName,
      tableType: item.tableType,
      columnCount: item.columns.length,
    })),
    sampledTables: summarizeSampledTables(context),
    activeExecution: context.activeExecution,
    validation: context.validation,
    rawText: normalizeText(rawText),
  };
}

function normalizeResultFromSections(taskType, rawText, context, provider) {
  const sections = parseSectionedContent(rawText);
  const availableTableNames = context.tableSchemas.map((item) => item.tableName);
  const generatedSql = resolveGeneratedSql(taskType, sections.SQL, rawText);
  const usedTables = parseUsedTablesFromSections(sections["使用表"], availableTableNames);

  const parsedDirections = taskType === "data_research"
    ? [1, 2, 3].map((index) => parseAnalysisDirectionSection(sections[`分析方向${index}`])).filter(Boolean)
    : [];
  const analysisDirections = taskType === "data_research"
    ? normalizeAnalysisDirections(parsedDirections, parseBulletList(sections["分析方向"]), context)
    : [];
  const suggestions = taskType === "data_research"
    ? analysisDirections.map((item) => item.businessQuestion)
    : uniqueStrings(parseBulletList(sections["后续建议"]));

  return {
    taskType,
    provider: {
      id: provider.id,
      configName: provider.configName,
      modelName: provider.modelName,
      modelVersion: provider.modelVersion || null,
      providerType: provider.providerType,
    },
    summary: normalizeText(sections["摘要"]) || (taskType === "data_research" ? "已完成所选表的数据调研" : "AI 已返回 SQL 辅助结果"),
    explanation: normalizeText(sections["分析说明"]) || normalizeText(rawText),
    generatedSql,
    assumptions: uniqueStrings(parseBulletList(sections["关键假设"])),
    risks: uniqueStrings(parseBulletList(sections["风险提示"])),
    suggestions,
    analysisDirections,
    diagnostics: parseDiagnosticsFromSections(sections["问题诊断"]),
    usedTables: usedTables.length ? usedTables : buildDefaultUsedTables(context),
    referencedTables: context.referencedTables,
    metadataTables: context.tableSchemas.map((item) => ({
      tableName: item.tableName,
      tableType: item.tableType,
      columnCount: item.columns.length,
    })),
    sampledTables: summarizeSampledTables(context),
    activeExecution: context.activeExecution,
    validation: context.validation,
    rawText: normalizeText(rawText),
  };
}

async function prepareConversation(payload, user, streamContext) {
  const actualPayload = { ...payload, taskType: inferTaskType(payload) };
  if (!TASK_TYPES.has(actualPayload.taskType)) {
    throw new AppError("不支持的 Copilot 任务类型", 400);
  }
  if (actualPayload.taskType === "data_research" && uniqueStrings(actualPayload.selectedTables).length === 0) {
    throw new AppError("数据调研请至少选择 1 张表", 400);
  }

  const userId = Number(user?.id || user?.sub || 0);
  if (!userId) {
    return { payload: actualPayload, session: null };
  }

  let session = null;
  let previousMessages = [];
  if (payload.sessionId) {
    session = await repository.getCopilotSessionById(payload.sessionId, userId);
    if (!session) {
      throw new AppError("SQL 智能辅助会话不存在或无权访问", 404);
    }
    if (Number(session.datasourceId) !== Number(payload.datasourceId)) {
      throw new AppError("当前会话与所选数据源不一致，请新建会话", 400);
    }
    previousMessages = await repository.listCopilotMessages(session.id, userId, 100);
  } else {
    session = await repository.createCopilotSession({
      userId,
      datasourceId: payload.datasourceId,
      databaseName: payload.databaseName,
      sessionTitle: buildSessionTitle(actualPayload),
    });
  }

  actualPayload.sessionId = session.id;
  actualPayload.conversation = previousMessages.length
    ? buildConversationFromMessages(previousMessages)
    : (payload.conversation || []);

  await repository.createCopilotMessage({
    sessionId: session.id,
    role: "user",
    taskType: actualPayload.taskType,
    messageText: normalizeText(payload.prompt) || (actualPayload.taskType === "data_research"
      ? `请基于已选 ${uniqueStrings(payload.selectedTables).length} 张表的结构与样例数据开展数据调研。`
      : "请基于当前 SQL 上下文继续处理。"),
    context: {
      datasourceId: payload.datasourceId,
      databaseName: payload.databaseName || null,
      selectedTables: payload.selectedTables || [],
      hasSelectedSql: Boolean(payload.selectedSql),
      hasEditorSql: Boolean(payload.editorSql),
      activeExecutionHistoryId: payload.activeExecutionHistoryId || null,
    },
  });
  await repository.touchCopilotSession(session.id, userId, {
    sessionTitle: previousMessages.length ? null : buildSessionTitle(actualPayload),
    datasourceId: payload.datasourceId,
    databaseName: payload.databaseName,
  });
  streamContext.write?.({ type: "session", data: { sessionId: session.id } });
  return { payload: actualPayload, session };
}

async function resolveCopilotSession(payload, streamContext = {}, processSteps = []) {
  addProgress(streamContext, processSteps, "intent", "识别任务", `已识别为${buildTaskInstructions(payload.taskType).replace(/。$/, "")}任务`);
  const datasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
  const adapter = getAdapter(datasource);
  const databaseName = payload.databaseName || datasource.databaseName || undefined;
  const taskConfig = await resolveTaskConfig(payload.taskType);
  addProgress(streamContext, processSteps, "datasource", "读取工作台上下文", `${datasource.name} / ${databaseName || "默认数据库"} / ${datasource.type}`);

  let activeExecution = null;
  if (payload.activeExecutionHistoryId) {
    const history = await repository.getQueryHistoryById(payload.activeExecutionHistoryId);
    if (history && Number(history.datasourceId) === Number(payload.datasourceId)) {
      activeExecution = buildActiveExecutionContext(history);
      addProgress(
        streamContext,
        processSteps,
        "execution",
        "引用当前执行结果",
        `${history.status === "success" ? "执行成功" : "执行失败"} · ${activeExecution.rowCount} 行 · ${activeExecution.fields.length} 个字段`
      );
    }
  }

  let provider;
  if (payload.modelProviderId) {
    provider = await resolveProvider(payload.modelProviderId);
  } else if (taskConfig?.defaultModelProviderId) {
    const configuredProvider = await modelProviderService.getModelProviderById(Number(taskConfig.defaultModelProviderId));
    provider = modelProviderService.applyModelSelection(configuredProvider, {
      modelName: taskConfig.defaultModelName,
      modelVersion: taskConfig.defaultModelVersion,
    });
  } else {
    provider = await resolveProvider(null);
  }

  const tables = await adapter.getTables(datasource, databaseName);
  const tableList = Array.isArray(tables) ? tables : [];
  const selectedTables = resolveScopedTables(tableList, payload.selectedTables);
  const candidatePayload = activeExecution?.sqlText && !payload.selectedSql && !payload.editorSql
    ? { ...payload, editorSql: activeExecution.sqlText }
    : payload;
  const candidates = selectCandidateTables(tableList, candidatePayload, datasource.type);
  const schemaScope = selectedTables.length ? selectedTables : candidates.schemaTables;
  addProgress(
    streamContext,
    processSteps,
    "scope",
    "确定表范围",
    selectedTables.length
      ? `使用用户指定的 ${selectedTables.length} 张表`
      : `自动匹配 ${schemaScope.length} 张候选表`
  );
  const tableSchemas = await loadTableSchemas(adapter, datasource, databaseName, schemaScope);
  addProgress(streamContext, processSteps, "metadata", "读取表结构", `已读取 ${tableSchemas.length} 张表的字段结构`);
  const sampledTables = selectedTables.length
    ? await loadTableSamples(adapter, datasource, databaseName, tableSchemas)
    : [];
  if (sampledTables.length) {
    addProgress(
      streamContext,
      processSteps,
      "sample",
      "读取样本数据",
      `已读取 ${sampledTables.length} 张表、${sampledTables.reduce((sum, item) => sum + Number(item.rowCount || 0), 0)} 行样本`
    );
  }

  return {
    datasource,
    databaseName,
    adapter,
    provider,
    taskConfig,
    context: {
      datasource,
      referencedTables: candidates.referencedTables,
      availableTableNames: candidates.availableTables.map((item) => item.name),
      tableSchemas,
      sampledTables,
      selectedTables: selectedTables.map((item) => item.name),
      activeExecution,
      validation: null,
    },
  };
}

async function persistAssistantMessage(chatSession, user, payload, result, processSteps) {
  if (!chatSession) return null;
  const message = await repository.createCopilotMessage({
    sessionId: chatSession.id,
    role: "assistant",
    taskType: payload.taskType,
    messageText: result.explanation || result.summary || result.generatedSql || "SQL 智能辅助已完成",
    payload: { result, processSteps },
    context: {
      datasourceId: payload.datasourceId,
      databaseName: payload.databaseName || null,
      selectedTables: payload.selectedTables || [],
      activeExecutionHistoryId: payload.activeExecutionHistoryId || null,
    },
  });
  await repository.touchCopilotSession(chatSession.id, Number(user?.id || user?.sub), {});
  return message;
}

async function runCopilotTask(payload, options = {}) {
  const prepared = await prepareConversation(payload, options.user, options);
  const actualPayload = prepared.payload;
  const processSteps = [];
  const session = await resolveCopilotSession(actualPayload, options, processSteps);
  const { datasource, provider, taskConfig, context } = session;
  addProgress(options, processSteps, "generate", "生成回答", "正在结合历史对话、SQL 和元数据生成结果");

  const completion = await modelProviderService.generateChatCompletion(
    provider,
    [
      { role: "system", content: buildSystemPrompt(actualPayload.taskType, datasource.type, taskConfig?.systemPrompt || "") },
      { role: "user", content: buildUserPrompt(actualPayload, context) },
    ],
    {
      temperature: taskConfig?.temperature ?? 0.1,
      maxTokens: taskConfig?.maxTokens ?? 1800,
      timeoutMs: taskConfig?.timeoutMs ?? 30000,
      responseFormat: { type: "json_object" },
    }
  );

  const rawText = completion?.content || "";
  const parsed = parseJsonObject(rawText);
  const generatedSql = resolveGeneratedSql(actualPayload.taskType, parsed?.generatedSql, rawText);
  if (generatedSql || requiresGeneratedSql(actualPayload.taskType)) {
    context.validation = await validateGeneratedSql(generatedSql, session);
    addProgress(options, processSteps, "validate", "校验 SQL", context.validation.messages.join("；"));
  }
  const result = normalizeResult(actualPayload.taskType, rawText, parsed, context, provider);
  const assistantMessage = await persistAssistantMessage(prepared.session, options.user, actualPayload, result, processSteps);
  return { ...result, sessionId: prepared.session?.id || null, assistantMessage };
}

async function runCopilotTaskStream(payload, streamContext = {}) {
  const prepared = await prepareConversation(payload, streamContext.user, streamContext);
  const actualPayload = prepared.payload;
  const processSteps = [];
  const session = await resolveCopilotSession(actualPayload, streamContext, processSteps);
  const { datasource, provider, taskConfig, context } = session;

  streamContext.write?.({
    type: "meta",
    data: {
      taskType: actualPayload.taskType,
      provider: {
        id: provider.id,
        configName: provider.configName,
        modelName: provider.modelName,
        modelVersion: provider.modelVersion || null,
        providerType: provider.providerType,
      },
      dialect: datasource.type,
      referencedTables: context.referencedTables,
      metadataTables: context.tableSchemas.map((item) => ({
        tableName: item.tableName,
        tableType: item.tableType,
        columnCount: item.columns.length,
      })),
      sampledTables: summarizeSampledTables(context),
      activeExecution: context.activeExecution,
    },
  });

  let rawText = "";
  addProgress(streamContext, processSteps, "generate", "生成回答", "正在结合历史对话、SQL、执行结果和元数据生成结果");
  await modelProviderService.generateChatCompletionStream(
    provider,
    [
      { role: "system", content: buildStreamSystemPrompt(actualPayload.taskType, datasource.type, taskConfig?.systemPrompt || "") },
      { role: "user", content: buildUserPrompt(actualPayload, context) },
    ],
    {
      temperature: taskConfig?.temperature ?? 0.1,
      maxTokens: taskConfig?.maxTokens ?? 1800,
      timeoutMs: taskConfig?.timeoutMs ?? 30000,
      signal: streamContext.signal,
    },
    async (delta) => {
      rawText += delta;
      streamContext.write?.({ type: "delta", delta });
    }
  );

  const sections = parseSectionedContent(rawText);
  const generatedSql = resolveGeneratedSql(actualPayload.taskType, sections.SQL, rawText);
  if (generatedSql || requiresGeneratedSql(actualPayload.taskType)) {
    context.validation = await validateGeneratedSql(generatedSql, session);
    addProgress(streamContext, processSteps, "validate", "校验 SQL", context.validation.messages.join("；"));
  }
  const result = normalizeResultFromSections(actualPayload.taskType, rawText, context, provider);
  const assistantMessage = await persistAssistantMessage(prepared.session, streamContext.user, actualPayload, result, processSteps);
  streamContext.write?.({
    type: "done",
    data: {
      sessionId: prepared.session?.id || null,
      assistantMessage,
      result,
    },
  });
  return result;
}

async function listCopilotSessions(user, filters = {}) {
  const userId = Number(user?.id || user?.sub || 0);
  if (!userId) return [];
  return repository.listCopilotSessions(userId, filters.limit);
}

async function listCopilotSessionMessages(user, sessionId) {
  const userId = Number(user?.id || user?.sub || 0);
  const session = await repository.getCopilotSessionById(sessionId, userId);
  if (!session) {
    throw new AppError("SQL 智能辅助会话不存在或无权访问", 404);
  }
  const messages = await repository.listCopilotMessages(sessionId, userId, 200);
  return { session, messages };
}

module.exports = {
  listCopilotSessionMessages,
  listCopilotSessions,
  runCopilotTask,
  runCopilotTaskStream,
};
