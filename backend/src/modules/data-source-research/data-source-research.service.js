const AppError = require("../../common/errors/app-error");
const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");
const dataSourceRepository = require("../data-sources/data-source.repository");
const metadataService = require("../data-sources/data-source.metadata");
const previewService = require("../data-sources/data-source.preview");
const { testDatabaseConnection } = require("../data-sources/data-source.test-connection");
const ingestionAiConfigService = require("../ingestion-ai-configs/ingestion-ai-config.service");
const modelProviderService = require("../model-providers/model-provider.service");
const repository = require("./data-source-research.repository");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
} = require("../../common/utils/datasource-dialect");

const SUPPORTED_RESEARCH_SOURCE_TYPES = new Set(["mysql", "postgresql", "oracle", "dm", "hive", "ftp", "kafka"]);
const RESEARCH_ITEM_ALIASES = {
  metadata_inspection: "quality_inspection",
};
const TABLE_CLASSIFICATION_PROMPT = `
你是资深数据接入架构师。你会收到一批经过规则引擎压缩后的表证据卡。
你只负责“表分类”调研，判断每张表的业务角色、接入优先级、分类证据和风险。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 证据卡已经覆盖所有字段的统计摘要，不要假设只分析了部分字段。
3. 分类必须从 business、dictionary、relation、log、temporary、low_value 中选择。
4. 如果无法确定，保持保守分类并说明依据，不要编造输入中不存在的业务背景。

输出结构固定为：
{
  "summary": "表分类总体结论",
  "tableDecisions": [
    {
      "tableName": "表名",
      "category": "business|dictionary|relation|log|temporary|low_value",
      "confidence": 0.82,
      "priority": "high|medium|low",
      "evidence": ["判断依据"],
      "risks": ["风险提示"],
      "suggestedMode": "full|incremental|partition|manual_review"
    }
  ]
}`.trim();
const REPORT_AGGREGATION_PROMPT = `
你是资深数据接入负责人。你会收到多批表分类结果和规则画像。
你只负责“调研报告汇总”，提炼整体结论、优先级和后续接入/治理的归纳，不重新编造表分类。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 输出面向数据接入负责人，结论要明确、可执行。
3. 不要重复枚举所有表，只保留关键表和高价值风险。

输出结构固定为：
{
  "summary": "总体结论",
  "tableDecisions": [],
  "recommendedTables": ["建议优先接入表"],
  "deferredTables": ["建议暂缓表"],
  "governanceSuggestions": ["治理建议"],
  "ingestionSuggestions": ["接入建议"]
}`.trim();
const DATA_SCALE_PROMPT = `
你是数据容量评估专家。你只负责“数据规模”调研。
请基于表行数、字段数、样本数、索引约束数量和行数统计策略，识别大表、空表/小表、结构复杂表和容量风险。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 不要修改表分类，只给规模层面的判断。
3. 结论要能支撑接入资源评估和同步窗口规划。

输出结构固定为：
{
  "summary": "规模调研结论",
  "largeTables": ["大表"],
  "smallOrEmptyTables": ["小表或空表"],
  "complexTables": ["字段或约束较复杂的表"],
  "suggestions": ["容量、并发、同步窗口建议"]
}`.trim();
const DATA_QUALITY_PROMPT = `
你是数据质量和元数据治理专家。你只负责“数据质量”调研。
请合并分析字段空值率、去重率、样例值、字段注释、表注释、主键、增量字段和元数据问题。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 问题类型必须使用中文，例如“字段注释缺失”“高空值率”“低基数字段”“高基数字段”“缺少主键”“缺少增量字段”。
3. 字段级发现必须带 tableName、columnName、issueTypes、evidence、suggestion。
4. 不要输出无证据的质量问题。

输出结构固定为：
{
  "summary": "数据质量结论",
  "issueTypeStats": [{"issueType": "中文问题类型", "count": 3}],
  "tableFindings": [{"tableName": "表名", "issueTypes": ["中文问题类型"], "evidence": ["证据"], "suggestion": "建议"}],
  "fieldFindings": [{"tableName": "表名", "columnName": "字段名", "issueTypes": ["中文问题类型"], "evidence": ["证据"], "suggestion": "建议"}],
  "suggestions": ["质量整改建议"]
}`.trim();
const INGESTION_ADVICE_PROMPT = `
你是数据接入方案架构师。你只负责“接入建议”调研。
请基于表分类、数据规模、增量字段、质量风险和依赖关系，给出首批接入表、暂缓表、同步模式和任务编排建议。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 建议必须能直接指导接入任务配置。
3. 对每张建议接入表说明接入模式、依赖和风险。

输出结构固定为：
{
  "summary": "接入建议结论",
  "recommendedTables": ["优先接入表"],
  "deferredTables": ["建议暂缓表"],
  "tableModes": [{"tableName": "表名", "mode": "full|incremental|partition|manual_review", "reason": "原因", "risk": "风险"}],
  "ingestionSuggestions": ["同步策略、任务拆分、落库建议"]
}`.trim();
const GOVERNANCE_ADVICE_PROMPT = `
你是数据治理顾问。你只负责“治理建议”调研。
请基于元数据缺失、字段质量、主键/增量字段缺失、关系可信度和分类风险，输出治理优先级和整改动作。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 治理建议要区分“接入前必须处理”和“接入后可持续优化”。
3. 问题类型必须使用中文。

输出结构固定为：
{
  "summary": "治理建议结论",
  "mustFixBeforeIngestion": ["接入前必须处理"],
  "continuousImprovements": ["接入后持续优化"],
  "tableTasks": [{"tableName": "表名", "issueTypes": ["中文问题类型"], "priority": "high|medium|low", "action": "治理动作"}],
  "governanceSuggestions": ["治理建议"]
}`.trim();
const ANALYSIS_ADVICE_PROMPT = `
你是数据分析顾问。你只负责“分析建议”调研。
请基于表分类、数据规模、字段语义、质量风险和表关系，优先围绕核心业务表判断可以支持哪些业务分析、报表主题和后续探索问题。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 先识别核心业务表，字典表只能作为维度解释或编码翻译，不要把字典表当成业务分析主表。
3. 必须结合字段样例值、字段注释、空值率、去重率和表关系，推断可用维度、可观察状态、可能的指标口径和异常识别方向。
4. 分析建议必须落到业务分析主题、核心业务表、关联维表、关键字段、样例证据、分析价值和需要确认的数据口径。
5. 不要编造字段和样例中没有体现的业务指标。

输出结构固定为：
{
  "summary": "分析建议结论",
  "coreBusinessTables": [{"tableName": "核心业务表", "reason": "选择依据", "analysisValue": "业务分析价值", "suggestedSubjects": ["可做的业务分析"], "dimensions": ["可用维度或关键字段"]}],
  "analysisDirections": [{"direction": "分析方向", "coreTable": "核心业务表", "relatedTables": ["关联表"], "measures": ["建议指标"], "dimensions": ["分析维度"], "sampleEvidence": ["样例证据"], "analysisQuestions": ["可回答的业务问题"], "outputSuggestions": ["报表或看板建议"], "caveats": ["口径限制"]}],
  "analysisThemes": [{"theme": "分析主题", "tables": ["表名"], "keyFields": ["字段名"], "value": "分析价值", "limitations": ["限制"]}],
  "watchItems": ["需要持续关注的数据变化"],
  "followUpQuestions": ["需要业务确认的问题"],
  "analysisSuggestions": ["分析建议"]
}`.trim();
const TABLE_RELATIONSHIP_PROMPT = `
你是资深数据建模专家。你会收到用户本次选定表范围内的表结构摘要和规则候选关系。
请只基于输入范围分析表之间的稳定关联关系，不要补充输入中不存在的表。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 优先保留显式外键和高置信命名规则关系；对不确定关系保持保守。
3. 关系方向使用 fromTable/fromField 指向 toTable/toField，其中 from 侧通常是外键或引用字段，to 侧通常是主键、编码或业务唯一字段。

输出结构固定为：
{
  "summary": "表关系总体结论",
  "relations": [
    {
      "fromTable": "引用方表",
      "fromField": "引用方字段",
      "toTable": "被引用表",
      "toField": "被引用字段",
      "relationType": "1:1|1:N|N:1|N:N",
      "confidence": 0.86,
      "source": "constraint|name_rule|ai",
      "evidence": ["判断依据"]
    }
  ]
}`.trim();
const REPORT_COMPARISON_PROMPT = `
你是资深数据治理顾问。你会收到同一个数据源调研任务的两个报告批次结构化差异。
请识别数据质量、表结构、字段质量和表关系的关键变化，输出给数据接入负责人可直接使用的结论。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 不要重复枚举全部明细，只提炼高价值变化、风险和建议。
3. 需要区分变好、变差和需要人工确认的变化。

输出结构固定为：
{
  "summary": "总体变化结论",
  "tableClassificationChanges": ["表分类变化"],
  "tableRelationshipChanges": ["表关系变化"],
  "dataScaleChanges": ["数据规模变化"],
  "dataQualityChanges": ["数据质量变化"],
  "ingestionAdviceChanges": ["接入建议变化"],
  "governanceAdviceChanges": ["治理建议变化"],
  "analysisAdviceChanges": ["分析建议变化"],
  "risks": ["风险"],
  "suggestions": ["建议"],
  "confidence": 0.86
}`.trim();
const TRANSPARENT_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);
const activeResearchRuns = new Map();

function createResearchRunCancelledError() {
  const error = new Error("调研任务已手动终止");
  error.code = "RESEARCH_RUN_CANCELLED";
  return error;
}

function isResearchRunCancelledError(error) {
  return error?.code === "RESEARCH_RUN_CANCELLED" || error?.name === "AbortError";
}

function getActiveResearchRun(runId) {
  return activeResearchRuns.get(Number(runId)) || null;
}

function isResearchRunCancellationRequested(runId) {
  return Boolean(getActiveResearchRun(runId)?.cancelRequested);
}

function assertResearchRunNotCancelled(runId) {
  if (isResearchRunCancellationRequested(runId)) {
    throw createResearchRunCancelledError();
  }
}

function registerActiveResearchRun(runId) {
  const state = {
    controller: new AbortController(),
    cancelRequested: false
  };
  activeResearchRuns.set(Number(runId), state);
  return state;
}

function unregisterActiveResearchRun(runId) {
  activeResearchRuns.delete(Number(runId));
}

function normalizeSourceType(sourceType, connectionConfig = {}) {
  const normalized = normalizeDatasourceType(sourceType);
  const dialect = inferDatasourceDialect(normalized, connectionConfig || {});
  return dialect === "unknown" ? normalized : dialect;
}

function supportsResearch(dataSource) {
  return SUPPORTED_RESEARCH_SOURCE_TYPES.has(normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {}));
}

function isObjectPreviewSource(dataSource) {
  return ["ftp", "kafka"].includes(normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {}));
}

function researchObjectLabel(dataSource) {
  const type = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {});
  if (type === "ftp") return "文件";
  if (type === "kafka") return "Topic";
  return "表";
}

function buildRunName(dataSource) {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  return `${dataSource.sourceName} 数据源调研 ${stamp}`;
}

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)));
}

function hasResearchItem(config, key) {
  return Array.isArray(config?.researchItems) && config.researchItems.includes(key);
}

function normalizeResearchItems(items = []) {
  const supported = new Set([
    "table_classification",
    "table_relationship",
    "data_scale",
    "quality_inspection",
    "ingestion_advice",
    "governance_advice",
    "analysis_advice",
  ]);
  return uniqueStrings(items.map((item) => RESEARCH_ITEM_ALIASES[item] || item)).filter((item) => supported.has(item));
}

function pickDatabaseName(dataSource) {
  return String(dataSource?.connectionConfig?.database || "").trim() || null;
}

function pickSchemaName(dataSource) {
  return String(dataSource?.connectionConfig?.schema || "").trim() || null;
}

function chunkArray(items, size) {
  const chunks = [];
  const safeSize = Math.max(1, Number(size || 1));
  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }
  return chunks;
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const safeConcurrency = Math.max(1, Number(concurrency || 1));

  async function consume() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(safeConcurrency, items.length) }, () => consume()));
  return results;
}

function detectIncrementalColumn(columns = []) {
  const names = ["updated_at", "update_time", "modified_at", "modify_time", "last_update_time", "etl_time", "batch_time", "created_at", "create_time", "id"];
  const normalizedMap = new Map(columns.map((column) => [String(column.columnName || "").trim().toLowerCase(), column.columnName]));
  for (const name of names) {
    if (normalizedMap.has(name)) return normalizedMap.get(name);
  }
  return null;
}

function detectLowValueByName(tableName) {
  return /(tmp|temp|bak|backup|test|demo|copy|old|history_tmp|_tmp$|_bak$)/i.test(String(tableName || ""));
}

function detectLogTable(tableName, tableComment) {
  return /(log|logs|history|audit|trace|message|event|journal)/i.test(`${tableName} ${tableComment || ""}`);
}

function detectRelationTable(tableName, columns = []) {
  if (/(relation|mapping|map|bridge|link|xref)/i.test(String(tableName || ""))) {
    return true;
  }
  const idColumns = columns.filter((column) => /_id$/i.test(String(column.columnName || "")));
  return columns.length > 0 && columns.length <= 10 && idColumns.length >= 2;
}

function ensureJsonObjectPrompt(messages = [], provider = null) {
  const providerText = `${provider?.providerType || ""} ${provider?.configName || ""} ${provider?.modelName || ""}`.toLowerCase();
  if (!providerText.includes("deepseek")) {
    return messages;
  }
  return (Array.isArray(messages) ? messages : []).map((item, index, list) => {
    if (!item || typeof item !== "object") return item;
    if (index === 0 || index === list.length - 1) {
      return {
        ...item,
        content: `${String(item.content || "").trim()}\n\nReturn valid JSON only. The response must be a JSON object.`,
      };
    }
    return item;
  });
}

function extractJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("模型未返回有效内容");
  }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  throw new Error("模型响应中未找到 JSON 对象");
}

function parseJsonObjectWithRecovery(text = "") {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    return JSON.parse(extractJsonObject(text));
  }
}

async function resolveResearchProvider(aiConfig) {
  const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
  if (!provider) {
    throw new AppError("数据源调研模型不存在", 400);
  }
  return modelProviderService.applyModelSelection(provider, {
    modelName: aiConfig.defaultModelName,
    modelVersion: aiConfig.defaultModelVersion,
  });
}

async function log(runId, stageKey, message, options = {}) {
  await repository.appendLog(runId, {
    stageKey,
    logLevel: options.logLevel || "info",
    message,
    detail: options.detail || null
  });
}

async function setRunState(runId, patch, logPayload) {
  const run = await repository.updateRun(runId, patch);
  if (logPayload?.message) {
    await log(runId, logPayload.stageKey || patch.currentStage || "run", logPayload.message, logPayload);
  }
  return run;
}

async function markResearchRunCancelled(runId, message = "调研任务已手动终止") {
  const current = await repository.getRunById(runId);
  if (!current) return null;
  if (!["pending", "running"].includes(String(current.status || ""))) {
    return current;
  }
  const cancelledRun = await setRunState(runId, {
    status: "cancelled",
    progressPercent: 100,
    currentStage: "cancelled",
    errorMessage: message,
    finishedAt: new Date()
  }, {
    stageKey: "cancelled",
    message,
    logLevel: "warn"
  });
  if (current.taskId) {
    await repository.updateTask(current.taskId, {
      lastRunId: runId,
      lastRunStatus: cancelledRun.status,
      lastRunAt: cancelledRun.finishedAt || new Date()
    });
  }
  return cancelledRun;
}

function computeSampleMetrics(sampleRows = [], columns = []) {
  const sampleCount = sampleRows.length;
  const nullRates = {};
  let highNullColumns = 0;

  for (const column of columns) {
    const columnName = column.columnName;
    const nullCount = sampleRows.reduce((sum, row) => {
      const value = row?.[columnName];
      return sum + (value === null || value === undefined || value === "" ? 1 : 0);
    }, 0);
    const nullRate = sampleCount > 0 ? Number((nullCount / sampleCount).toFixed(6)) : 0;
    nullRates[columnName] = nullRate;
    if (nullRate >= 0.8) {
      highNullColumns += 1;
    }
  }

  return {
    sampleCount,
    nullRates,
    highNullColumns
  };
}

function buildFieldProfiles(columns = [], sampleRows = []) {
  const sampleCount = sampleRows.length;
  return columns.map((column) => {
    const values = sampleRows
      .map((row) => row?.[column.columnName])
      .filter((value) => value !== null && value !== undefined && value !== "");
    const distinctValues = new Set(values.map((value) => String(value)));
    const nullCount = sampleRows.length - values.length;
    const nullRate = sampleCount > 0 ? Number((nullCount / sampleCount).toFixed(6)) : 0;
    const distinctRatio = values.length > 0 ? Number((distinctValues.size / values.length).toFixed(6)) : 0;
    const examples = Array.from(distinctValues).slice(0, 5);
    const issueTags = [];

    if (!String(column.columnComment || "").trim()) issueTags.push("字段注释缺失");
    if (nullRate >= 0.8) issueTags.push("高空值率");
    if (distinctRatio <= 0.1 && examples.length > 0 && examples.length <= 10) issueTags.push("低基数字段");
    if (distinctRatio >= 0.95 && values.length >= 10) issueTags.push("高基数字段");

    return {
      columnName: column.columnName,
      ordinalPosition: Number(column.ordinalPosition || 0),
      dataType: column.dataType,
      columnType: column.columnType,
      isNullable: Boolean(column.isNullable),
      isPrimaryKey: Boolean(column.isPrimaryKey),
      columnComment: column.columnComment || "",
      nullRate,
      distinctRatio,
      sampleValues: examples,
      issueTags
    };
  });
}

function buildFieldSummary(fieldProfiles = []) {
  const primaryKeys = [];
  const timeFields = [];
  const codeLikeFields = [];
  const statusLikeFields = [];
  const typeLikeFields = [];
  const nameLikeFields = [];
  const highNullFields = [];
  const highCardinalityFields = [];
  const lowCardinalityFields = [];
  let missingCommentCount = 0;
  const dataTypeDistribution = {};

  for (const field of fieldProfiles) {
    const columnName = String(field.columnName || "");
    const lowerName = columnName.toLowerCase();
    const dataType = String(field.dataType || "").toLowerCase() || "unknown";
    dataTypeDistribution[dataType] = Number(dataTypeDistribution[dataType] || 0) + 1;
    if (field.isPrimaryKey) primaryKeys.push(columnName);
    if (/(time|date|timestamp|created_at|updated_at|create_time|update_time)/i.test(lowerName) || /(date|time|timestamp)/i.test(dataType)) timeFields.push(columnName);
    if (/(code|no|num|number|id)$/i.test(lowerName)) codeLikeFields.push(columnName);
    if (/(status|state|flag|result)/i.test(lowerName)) statusLikeFields.push(columnName);
    if (/(type|kind|category|level|grade)/i.test(lowerName)) typeLikeFields.push(columnName);
    if (/(name|title|label|desc|remark|comment)/i.test(lowerName)) nameLikeFields.push(columnName);
    if (!String(field.columnComment || "").trim()) missingCommentCount += 1;
    if (field.nullRate >= 0.8) highNullFields.push(columnName);
    if (field.distinctRatio >= 0.95) highCardinalityFields.push(columnName);
    if (field.distinctRatio <= 0.1 && field.sampleValues?.length) lowCardinalityFields.push(columnName);
  }

  return {
    totalFields: fieldProfiles.length,
    primaryKeys,
    timeFields,
    codeLikeFields,
    statusLikeFields,
    typeLikeFields,
    nameLikeFields,
    missingCommentCount,
    highNullFields,
    highCardinalityFields,
    lowCardinalityFields,
    dataTypeDistribution
  };
}

function detectDictionaryTable(tableName, tableComment, columns = [], fieldSummary = null) {
  const combined = `${tableName} ${tableComment || ""}`.toLowerCase();
  if (/(dict|dictionary|lookup|enum|code|type|status|level|category|dim)/i.test(combined) || /字典|枚举|代码|状态|分类/.test(tableComment || "")) {
    return true;
  }
  const codeLikeFields = fieldSummary?.codeLikeFields || [];
  const statusLikeFields = fieldSummary?.statusLikeFields || [];
  const nameLikeFields = fieldSummary?.nameLikeFields || [];
  return columns.length > 0 && columns.length <= 12 && (codeLikeFields.length + statusLikeFields.length) > 0 && nameLikeFields.length > 0;
}

function buildMetadataIssues(profile, fieldSummary, metrics) {
  const issues = [];
  const columns = Array.isArray(profile.columns) ? profile.columns : [];
  const primaryKeyCount = columns.filter((column) => column.isPrimaryKey).length;
  if (!profile.tableComment) issues.push("缺少表注释");
  if (primaryKeyCount === 0) issues.push("缺少主键");
  if (fieldSummary.missingCommentCount > 0) issues.push(`字段注释缺失 ${fieldSummary.missingCommentCount} 个`);
  if (!detectIncrementalColumn(columns)) issues.push("缺少明显增量字段");
  if (metrics.highNullColumns >= Math.max(3, Math.ceil(columns.length * 0.4))) issues.push("样本显示高空值字段较多");
  return issues;
}

function classifyTableByRules(profile, metrics, rowCount, fieldSummary) {
  const tableName = profile.tableName || "";
  const tableComment = profile.tableComment || "";
  const columns = Array.isArray(profile.columns) ? profile.columns : [];
  const issues = buildMetadataIssues(profile, fieldSummary, metrics);
  let category = "business";
  let priority = "medium";
  const evidence = [];
  const risks = [...issues];

  if (detectLowValueByName(tableName)) {
    category = "low_value";
    priority = "low";
    evidence.push("表名命中临时/备份/测试模式");
  } else if (detectDictionaryTable(tableName, tableComment, columns, fieldSummary)) {
    category = "dictionary";
    priority = "medium";
    evidence.push("字段结构和注释特征符合字典表模式");
  } else if (detectRelationTable(tableName, columns)) {
    category = "relation";
    priority = "medium";
    evidence.push("字段结构更像关联或映射表");
  } else if (detectLogTable(tableName, tableComment)) {
    category = "log";
    priority = "low";
    evidence.push("表名或注释命中日志/审计模式");
  } else {
    category = "business";
    priority = rowCount && rowCount > 100000 ? "high" : "medium";
    evidence.push("主键、时间字段和字段结构更接近业务表");
  }

  if (rowCount === null || rowCount === undefined || rowCount === 0) {
    risks.push("表数据量为空或未统计到");
    if (priority === "high") priority = "medium";
  }
  if (metrics.highNullColumns > 0) evidence.push(`样本中高空值字段 ${metrics.highNullColumns} 个`);
  if (fieldSummary.timeFields.length > 0) evidence.push(`识别到 ${fieldSummary.timeFields.length} 个时间类字段`);
  if (fieldSummary.primaryKeys.length > 0) evidence.push(`识别到主键字段 ${fieldSummary.primaryKeys.join("、")}`);

  return {
    category,
    priority,
    confidence: category === "business" ? 0.72 : 0.82,
    evidence: uniqueStrings(evidence),
    risks: uniqueStrings(risks),
    suggestedMode: detectIncrementalColumn(columns) ? "incremental" : "full"
  };
}

function summarizeTables(tableProfiles = []) {
  const categoryStats = {};
  let totalRowCount = 0;
  for (const item of tableProfiles) {
    categoryStats[item.category] = Number(categoryStats[item.category] || 0) + 1;
    if (typeof item.rowCount === "number") totalRowCount += item.rowCount;
  }
  return { totalTables: tableProfiles.length, totalRowCount, categoryStats };
}
function buildAiTableCard(tableProfile, options = {}) {
  const fieldProfiles = Array.isArray(tableProfile.fieldProfiles) ? tableProfile.fieldProfiles : [];
  const card = {
    tableName: tableProfile.tableName,
    tableComment: tableProfile.tableComment,
    rowCountMode: tableProfile.rowCountMode,
    rowCount: tableProfile.rowCount,
    columnCount: tableProfile.columnCount,
    sampleCount: tableProfile.sampleCount,
    categoryByRule: tableProfile.category,
    priorityByRule: tableProfile.priority,
    incrementalColumn: tableProfile.incrementalColumn,
    metadataIssues: tableProfile.metadataIssues,
    qualitySummary: { highNullColumns: tableProfile.quality?.highNullColumns || 0 },
    fieldSummary: tableProfile.fieldSummary,
  };
  if (options.includeFieldEvidence) {
    card.fieldEvidence = fieldProfiles.slice(0, 40).map((field) => ({
      columnName: field.columnName,
      dataType: field.dataType || field.columnType || "",
      columnComment: field.columnComment || "",
      isPrimaryKey: Boolean(field.isPrimaryKey),
      nullRate: typeof field.nullRate === "number" ? field.nullRate : undefined,
      distinctRatio: typeof field.distinctRatio === "number" ? field.distinctRatio : undefined,
      sampleValues: Array.isArray(field.sampleValues) ? field.sampleValues.slice(0, 5) : [],
      issueTags: Array.isArray(field.issueTags) ? field.issueTags.slice(0, 5) : [],
    }));
  }
  return card;
}

function buildBatchPromptPayload(source, config, tableCards) {
  return {
    source: {
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      databaseName: pickDatabaseName(source),
      schemaName: pickSchemaName(source)
    },
    config: {
      rowCountMode: config.rowCountMode || "estimated",
      sampleSize: config.sampleSize,
      researchItems: config.researchItems
    },
    tables: tableCards
  };
}

function normalizeAiCategory(category) {
  const normalized = String(category || "").trim().toLowerCase();
  return ["business", "dictionary", "relation", "log", "temporary", "low_value"].includes(normalized) ? normalized : null;
}

function normalizePriority(priority) {
  const normalized = String(priority || "").trim().toLowerCase();
  return ["high", "medium", "low"].includes(normalized) ? normalized : null;
}

function mergeAiDecision(tableProfiles, aiDecision) {
  if (!aiDecision || !Array.isArray(aiDecision.tableDecisions)) return tableProfiles;
  const decisionMap = new Map(aiDecision.tableDecisions.filter((item) => item?.tableName).map((item) => [String(item.tableName), item]));
  return tableProfiles.map((item) => {
    const decision = decisionMap.get(item.tableName);
    if (!decision) return item;
    return {
      ...item,
      category: normalizeAiCategory(decision.category) || item.category,
      priority: normalizePriority(decision.priority) || item.priority,
      confidence: typeof decision.confidence === "number" ? decision.confidence : item.confidence,
      evidence: uniqueStrings([...(item.evidence || []), ...(Array.isArray(decision.evidence) ? decision.evidence : [])]),
      risks: uniqueStrings([...(item.risks || []), ...(Array.isArray(decision.risks) ? decision.risks : [])]),
      suggestedMode: String(decision.suggestedMode || "").trim() || item.suggestedMode
    };
  });
}

function clampConfidence(value, fallback = 0.75) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, Number(number.toFixed(4))));
}

function getUnqualifiedTableName(tableName = "") {
  const parts = String(tableName || "")
    .replace(/[`"]/g, "")
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(tableName || "").trim();
}

function normalizeIdentifier(value = "") {
  return getUnqualifiedTableName(value)
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fa5]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitIdentifierTokens(value = "") {
  return normalizeIdentifier(value).split("_").map((item) => item.trim()).filter(Boolean);
}

function singularizeToken(token = "") {
  const normalized = String(token || "").trim();
  if (/ies$/.test(normalized) && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (/s$/.test(normalized) && normalized.length > 3) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function buildTableAliases(tableName = "") {
  const ignoredTokens = new Set(["ods", "dwd", "dws", "dim", "fact", "tmp", "temp", "t", "tb", "sys", "biz", "base", "info", "detail", "list", "main", "data"]);
  const normalized = normalizeIdentifier(tableName);
  const rawTokens = splitIdentifierTokens(tableName);
  const businessTokens = rawTokens.filter((token) => !ignoredTokens.has(token));
  const candidates = [
    normalized,
    businessTokens.join("_"),
    rawTokens.slice(-2).join("_"),
    rawTokens.slice(-1).join("_"),
    businessTokens.slice(-2).join("_"),
    businessTokens.slice(-1).join("_"),
    ...businessTokens,
  ];
  return uniqueStrings(candidates.flatMap((item) => [item, singularizeToken(item)]))
    .map((item) => normalizeIdentifier(item))
    .filter((item) => item && item.length >= 2);
}

function getProfileFields(profile) {
  const fields = Array.isArray(profile?.fieldProfiles) && profile.fieldProfiles.length
    ? profile.fieldProfiles
    : (Array.isArray(profile?.columns) ? profile.columns : []);
  return fields
    .map((field) => ({
      columnName: String(field?.columnName || "").trim(),
      dataType: String(field?.dataType || field?.columnType || "").trim(),
      columnType: String(field?.columnType || field?.dataType || "").trim(),
      ordinalPosition: Number(field?.ordinalPosition || 0),
      isPrimaryKey: Boolean(field?.isPrimaryKey),
      columnComment: String(field?.columnComment || "").trim(),
    }))
    .filter((field) => field.columnName);
}

function getPrimaryFields(profile) {
  const fields = getProfileFields(profile);
  const primaryFields = fields.filter((field) => field.isPrimaryKey);
  if (primaryFields.length) return primaryFields;
  const idField = fields.find((field) => normalizeIdentifier(field.columnName) === "id");
  if (idField) return [idField];
  const codeField = fields.find((field) => /(code|no|number|key)$/i.test(String(field.columnName || "")));
  return codeField ? [codeField] : fields.slice(0, 1);
}

function pickRelationshipFields(profile) {
  const fields = getProfileFields(profile);
  const selected = [];
  for (const field of fields) {
    const name = normalizeIdentifier(field.columnName);
    if (
      field.isPrimaryKey
      || /(id|code|no|num|number|key)$/i.test(name)
      || /(name|title|label|type|status|state|time|date)$/i.test(name)
      || Number(field.ordinalPosition || 0) <= 8
    ) {
      selected.push(field);
    }
  }
  const deduped = [];
  const seen = new Set();
  for (const field of [...selected, ...fields]) {
    const key = normalizeIdentifier(field.columnName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(field);
    if (deduped.length >= 24) break;
  }
  return deduped;
}

function buildRelationshipEntities(tableProfiles = []) {
  return tableProfiles.map((profile) => ({
    tableName: profile.tableName,
    tableComment: profile.tableComment || "",
    category: profile.category || "business",
    priority: profile.priority || "medium",
    rowCount: profile.rowCount ?? null,
    fields: pickRelationshipFields(profile).map((field) => ({
      columnName: field.columnName,
      dataType: field.dataType || field.columnType || "",
      isPrimaryKey: Boolean(field.isPrimaryKey),
      columnComment: field.columnComment || "",
    })),
  }));
}

function buildProfileLookupMap(tableProfiles = []) {
  const map = new Map();
  for (const profile of tableProfiles) {
    const keys = uniqueStrings([
      profile.tableName,
      getUnqualifiedTableName(profile.tableName),
      normalizeIdentifier(profile.tableName),
      normalizeIdentifier(getUnqualifiedTableName(profile.tableName)),
    ]);
    keys.forEach((key) => map.set(String(key), profile));
  }
  return map;
}

function findProfileByTableReference(tableMap, tableName = "") {
  if (!tableName) return null;
  return tableMap.get(String(tableName)) || tableMap.get(getUnqualifiedTableName(tableName)) || tableMap.get(normalizeIdentifier(tableName)) || null;
}

function buildRelationKey(relation) {
  return [
    normalizeIdentifier(relation.fromTable),
    normalizeIdentifier(relation.fromField),
    normalizeIdentifier(relation.toTable),
    normalizeIdentifier(relation.toField),
  ].join(".");
}

function normalizeRelationType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ["1:1", "1:N", "N:1", "N:N"].includes(normalized) ? normalized : "N:1";
}

function normalizeRelationSource(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["constraint", "name_rule", "ai"].includes(normalized) ? normalized : "ai";
}

function inferConstraintRelations(tableProfiles = []) {
  const tableMap = buildProfileLookupMap(tableProfiles);
  const relations = [];
  for (const profile of tableProfiles) {
    const constraints = Array.isArray(profile.constraintDetails) ? profile.constraintDetails : [];
    for (const constraint of constraints) {
      const type = String(constraint?.constraintType || "").toLowerCase();
      if (!type.includes("foreign")) continue;
      const columns = Array.isArray(constraint.columns) ? constraint.columns : [];
      const references = Array.isArray(constraint.references) ? constraint.references : [];
      references.forEach((reference, index) => {
        const target = findProfileByTableReference(tableMap, reference?.tableName);
        const fromField = String(columns[index] || columns[0] || "").trim();
        const toField = String(reference?.columnName || "").trim();
        if (!target || target.tableName === profile.tableName || !fromField || !toField) return;
        relations.push({
          fromTable: profile.tableName,
          fromField,
          toTable: target.tableName,
          toField,
          relationType: "N:1",
          confidence: 0.98,
          source: "constraint",
          evidence: uniqueStrings([
            `显式外键 ${constraint.constraintName || ""}`.trim(),
            `${profile.tableName}.${fromField} 引用 ${target.tableName}.${toField}`,
          ]),
        });
      });
    }
  }
  return relations;
}

function findLikelyTargetField(targetProfile, suffix) {
  const primaryFields = getPrimaryFields(targetProfile);
  const normalizedSuffix = normalizeIdentifier(suffix);
  const exactPrimary = primaryFields.find((field) => normalizeIdentifier(field.columnName) === normalizedSuffix);
  if (exactPrimary) return exactPrimary;
  if (normalizedSuffix === "id") {
    return primaryFields.find((field) => /(^id$|_id$)/i.test(normalizeIdentifier(field.columnName))) || primaryFields[0] || null;
  }
  if (["code", "no", "num", "number", "key"].includes(normalizedSuffix)) {
    const matched = primaryFields.find((field) => normalizeIdentifier(field.columnName).endsWith(`_${normalizedSuffix}`) || normalizeIdentifier(field.columnName).endsWith(normalizedSuffix));
    if (matched) return matched;
    return getProfileFields(targetProfile).find((field) => normalizeIdentifier(field.columnName).endsWith(`_${normalizedSuffix}`) || normalizeIdentifier(field.columnName).endsWith(normalizedSuffix)) || primaryFields[0] || null;
  }
  return primaryFields[0] || null;
}

function matchFieldAgainstTarget(field, targetProfile) {
  const fieldName = normalizeIdentifier(field.columnName);
  if (!fieldName) return null;
  const aliases = buildTableAliases(targetProfile.tableName);
  const primaryFields = getPrimaryFields(targetProfile);
  const normalizedPrimaryNames = primaryFields.map((item) => normalizeIdentifier(item.columnName));
  const suffixes = ["id", "code", "no", "num", "number", "key"];

  for (const alias of aliases) {
    for (const suffix of suffixes) {
      if (fieldName === `${alias}_${suffix}` || fieldName === `${singularizeToken(alias)}_${suffix}`) {
        const targetField = findLikelyTargetField(targetProfile, suffix);
        if (!targetField) continue;
        return {
          toField: targetField.columnName,
          confidence: suffix === "id" ? 0.88 : 0.82,
          evidence: `字段名 ${field.columnName} 命中 ${targetProfile.tableName} 的 ${alias}_${suffix} 引用模式`,
        };
      }
    }
  }

  if (fieldName !== "id" && normalizedPrimaryNames.includes(fieldName) && /(code|no|num|number|key)$/i.test(fieldName)) {
    const targetField = primaryFields.find((item) => normalizeIdentifier(item.columnName) === fieldName);
    return {
      toField: targetField?.columnName || field.columnName,
      confidence: 0.72,
      evidence: `字段名 ${field.columnName} 与 ${targetProfile.tableName} 的业务键名称一致`,
    };
  }

  return null;
}

function inferNameRuleRelations(tableProfiles = [], existingRelations = []) {
  const existingKeys = new Set(existingRelations.map(buildRelationKey));
  const relations = [];
  for (const sourceProfile of tableProfiles) {
    const fields = getProfileFields(sourceProfile);
    for (const field of fields) {
      if (field.isPrimaryKey) continue;
      const fieldName = normalizeIdentifier(field.columnName);
      if (!/(^|_)(id|code|no|num|number|key)$/i.test(fieldName) && !/(id|code|no|num|number|key)$/i.test(fieldName)) continue;
      for (const targetProfile of tableProfiles) {
        if (targetProfile.tableName === sourceProfile.tableName) continue;
        const matched = matchFieldAgainstTarget(field, targetProfile);
        if (!matched?.toField) continue;
        const relation = {
          fromTable: sourceProfile.tableName,
          fromField: field.columnName,
          toTable: targetProfile.tableName,
          toField: matched.toField,
          relationType: "N:1",
          confidence: matched.confidence,
          source: "name_rule",
          evidence: [matched.evidence],
        };
        const key = buildRelationKey(relation);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        relations.push(relation);
        break;
      }
    }
  }
  return relations.sort((left, right) => right.confidence - left.confidence).slice(0, 300);
}

function dedupeRelations(relations = []) {
  const map = new Map();
  for (const relation of relations) {
    if (!relation?.fromTable || !relation?.fromField || !relation?.toTable || !relation?.toField) continue;
    const key = buildRelationKey(relation);
    const current = map.get(key);
    const normalized = {
      fromTable: relation.fromTable,
      fromField: relation.fromField,
      toTable: relation.toTable,
      toField: relation.toField,
      relationType: normalizeRelationType(relation.relationType),
      confidence: clampConfidence(relation.confidence),
      source: normalizeRelationSource(relation.source),
      evidence: uniqueStrings(Array.isArray(relation.evidence) ? relation.evidence : [relation.evidence].filter(Boolean)),
    };
    if (!current || normalized.confidence > current.confidence) {
      map.set(key, {
        ...normalized,
        evidence: uniqueStrings([...(current?.evidence || []), ...normalized.evidence]),
      });
    } else {
      current.evidence = uniqueStrings([...(current.evidence || []), ...normalized.evidence]);
    }
  }
  return Array.from(map.values()).sort((left, right) => {
    if (right.confidence !== left.confidence) return right.confidence - left.confidence;
    return `${left.fromTable}.${left.fromField}`.localeCompare(`${right.fromTable}.${right.fromField}`, "zh-CN");
  });
}

function buildRuleRelationshipReport(tableProfiles = []) {
  const constraintRelations = inferConstraintRelations(tableProfiles);
  const nameRuleRelations = inferNameRuleRelations(tableProfiles, constraintRelations);
  return dedupeRelations([...constraintRelations, ...nameRuleRelations]);
}

function buildRelationshipSummary(entities = [], relations = []) {
  if (!entities.length) return "当前调研范围内没有可用于表关系分析的表结构。";
  if (!relations.length) {
    return `当前调研范围包含 ${entities.length} 张表，未识别到稳定的显式外键或高置信命名关联。`;
  }
  const constraintCount = relations.filter((item) => item.source === "constraint").length;
  const nameRuleCount = relations.filter((item) => item.source === "name_rule").length;
  const aiCount = relations.filter((item) => item.source === "ai").length;
  return `当前调研范围包含 ${entities.length} 张表，识别 ${relations.length} 条表关系，其中显式约束 ${constraintCount} 条、命名规则 ${nameRuleCount} 条、模型补充 ${aiCount} 条。`;
}

function buildRelationshipPromptPayload(source, config, entities, candidateRelations) {
  return {
    source: {
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      databaseName: pickDatabaseName(source),
      schemaName: pickSchemaName(source),
    },
    config: {
      tableScope: config.tableScope,
      selectedTableCount: entities.length,
      notes: config.notes || "",
    },
    tables: entities.map((entity) => ({
      ...entity,
      fields: entity.fields.slice(0, 24),
    })),
    candidateRelations: candidateRelations.slice(0, 300),
  };
}

function normalizeAiRelationships(parsed, entities, candidateRelations = []) {
  const tableMap = new Map();
  const fieldMap = new Map();
  for (const entity of entities) {
    const tableKeys = uniqueStrings([entity.tableName, getUnqualifiedTableName(entity.tableName), normalizeIdentifier(entity.tableName)]);
    tableKeys.forEach((key) => tableMap.set(String(key), entity.tableName));
    const fields = new Map();
    for (const field of entity.fields || []) {
      fields.set(String(field.columnName), field.columnName);
      fields.set(normalizeIdentifier(field.columnName), field.columnName);
    }
    fieldMap.set(entity.tableName, fields);
  }

  const aiRelations = (Array.isArray(parsed?.relations) ? parsed.relations : [])
    .map((item) => {
      const fromTable = tableMap.get(String(item?.fromTable || "")) || tableMap.get(getUnqualifiedTableName(item?.fromTable || "")) || tableMap.get(normalizeIdentifier(item?.fromTable || ""));
      const toTable = tableMap.get(String(item?.toTable || "")) || tableMap.get(getUnqualifiedTableName(item?.toTable || "")) || tableMap.get(normalizeIdentifier(item?.toTable || ""));
      if (!fromTable || !toTable || fromTable === toTable) return null;
      const fromField = fieldMap.get(fromTable)?.get(String(item?.fromField || "")) || fieldMap.get(fromTable)?.get(normalizeIdentifier(item?.fromField || "")) || String(item?.fromField || "").trim();
      const toField = fieldMap.get(toTable)?.get(String(item?.toField || "")) || fieldMap.get(toTable)?.get(normalizeIdentifier(item?.toField || "")) || String(item?.toField || "").trim();
      if (!fromField || !toField) return null;
      return {
        fromTable,
        fromField,
        toTable,
        toField,
        relationType: normalizeRelationType(item?.relationType),
        confidence: clampConfidence(item?.confidence, 0.76),
        source: normalizeRelationSource(item?.source || "ai"),
        evidence: uniqueStrings(Array.isArray(item?.evidence) ? item.evidence : [item?.evidence].filter(Boolean)),
      };
    })
    .filter(Boolean);

  return {
    summary: normalizeSummaryText(parsed?.summary || "", 1200),
    relations: dedupeRelations([...candidateRelations, ...aiRelations]),
  };
}

async function analyzeTableRelationships(runId, source, config, tableProfiles, signal) {
  const entities = buildRelationshipEntities(tableProfiles);
  const candidateRelations = buildRuleRelationshipReport(tableProfiles);
  const batch = {
    stageKey: "table_relationship",
    batchNo: 1,
    batchSize: entities.length,
    inputSummary: {
      tableCount: entities.length,
      candidateRelationCount: candidateRelations.length,
    },
    status: "pending",
  };
  const startedAt = Date.now();

  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
  if (!aiConfig?.defaultModelProviderId) {
    batch.status = "succeeded";
    batch.durationMs = Date.now() - startedAt;
    batch.output = {
      summary: buildRelationshipSummary(entities, candidateRelations),
      relations: candidateRelations,
      mode: "rule_only",
    };
    await log(runId, "table_relationship", "未配置数据源调研模型，表关系已使用规则候选结果生成", { logLevel: "warn" });
    return {
      report: {
        summary: batch.output.summary,
        entities,
        relations: candidateRelations,
      },
      batch,
    };
  }

  let provider = null;
  try {
    provider = await resolveResearchProvider(aiConfig);
  } catch (error) {
    batch.status = "succeeded";
    batch.durationMs = Date.now() - startedAt;
    batch.output = {
      summary: buildRelationshipSummary(entities, candidateRelations),
      relations: candidateRelations,
      mode: "rule_only",
    };
    await log(runId, "table_relationship", `${error.message || "数据源调研模型不存在"}，表关系已回退到规则候选结果`, { logLevel: "warn" });
    return {
      report: {
        summary: batch.output.summary,
        entities,
        relations: candidateRelations,
      },
      batch,
    };
  }

  try {
    assertResearchRunNotCancelled(runId);
    await log(runId, "table_relationship", "开始模型表关系调研", {
      detail: {
        tableCount: entities.length,
        candidateRelationCount: candidateRelations.length,
      },
    });
    const messages = ensureJsonObjectPrompt([
      { role: "system", content: `${TABLE_RELATIONSHIP_PROMPT}\n\n${aiConfig.systemPrompt ? `平台补充要求：${aiConfig.systemPrompt}` : ""}\n\n当前任务为表关系调研，只输出 JSON 对象。` },
      { role: "user", content: JSON.stringify(buildRelationshipPromptPayload(source, { ...config, tableScope: config.tableScope }, entities, candidateRelations), null, 2) },
    ], provider);
    const completion = await modelProviderService.generateChatCompletion(provider, messages, {
      temperature: aiConfig.temperature ?? 0.1,
      maxTokens: Number(aiConfig.maxTokens || 2200),
      signal,
      responseFormat: { type: "json_object" },
    });
    assertResearchRunNotCancelled(runId);
    const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
    const normalized = normalizeAiRelationships(parsed, entities, candidateRelations);
    const relations = normalized.relations;
    const summary = normalized.summary || buildRelationshipSummary(entities, relations);
    batch.status = "succeeded";
    batch.output = { summary, relations };
    batch.durationMs = Date.now() - startedAt;
    await log(runId, "table_relationship", "模型表关系调研完成");
    return {
      report: {
        summary,
        entities,
        relations,
      },
      batch,
    };
  } catch (error) {
    if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
      throw createResearchRunCancelledError();
    }
    batch.status = "failed";
    batch.errorMessage = error.message || "模型表关系调研失败";
    batch.durationMs = Date.now() - startedAt;
    await log(runId, "table_relationship", `模型表关系调研失败，已使用规则候选关系: ${error.message || "unknown"}`, { logLevel: "warn" });
    return {
      report: {
        summary: buildRelationshipSummary(entities, candidateRelations),
        entities,
        relations: candidateRelations,
      },
      batch,
    };
  }
}

const DOC_CATEGORY_LABELS = {
  business: "业务表",
  dictionary: "字典表",
  relation: "关联表",
  log: "日志表",
  temporary: "临时表",
  low_value: "低价值表",
};

const DOC_PRIORITY_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
};

const DOC_STAGE_LABELS = {
  table_classification: "表分类",
  report_aggregation: "全局汇总",
  table_relationship: "表关系",
  data_scale: "数据规模",
  quality_inspection: "数据质量",
  ingestion_advice: "接入建议",
  governance_advice: "治理建议",
  analysis_advice: "分析建议",
};

const DOC_RELATION_SOURCE_LABELS = {
  constraint: "显式约束",
  name_rule: "命名规则",
  ai: "模型判断",
};

function escapeXml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateText(value = "", maxLength = 80) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatDocDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function sanitizeDownloadFileName(value = "") {
  const normalized = String(value || "data_source_research_report")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "data_source_research_report";
}

function formatDownloadDateTime(value) {
  const date = new Date(value || Date.now());
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (part) => String(part).padStart(2, "0");
  return `${validDate.getFullYear()}${pad(validDate.getMonth() + 1)}${pad(validDate.getDate())}_${pad(validDate.getHours())}${pad(validDate.getMinutes())}${pad(validDate.getSeconds())}`;
}

function createResearchDocTextRun(value, options = {}) {
  return new TextRun({
    text: String(value ?? ""),
    bold: Boolean(options.bold),
    size: Number(options.size || 21),
    font: options.font || "Microsoft YaHei",
    color: options.color || "1F2937",
  });
}

function createResearchDocParagraph(value, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    pageBreakBefore: Boolean(options.pageBreakBefore),
    spacing: {
      before: Number(options.before || 0),
      after: Number(options.after ?? 120),
      line: Number(options.line || 280),
    },
    children: [
      createResearchDocTextRun(value, {
        bold: options.bold,
        size: options.size,
        font: options.font,
        color: options.color,
      }),
    ],
  });
}

function createResearchDocBullet(value) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70, line: 260 },
    children: [createResearchDocTextRun(value, { size: 20 })],
  });
}

function createResearchDocBulletList(values = [], fallback = "无。", max = 40) {
  const list = uniqueStrings(Array.isArray(values) ? values : []).slice(0, max);
  return list.length
    ? list.map((item) => createResearchDocBullet(item))
    : [createResearchDocParagraph(fallback, { size: 20, color: "64748B" })];
}

function formatDocInlineList(values = []) {
  return uniqueStrings(Array.isArray(values) ? values : []).join("、") || "-";
}

function formatDocIssueTypes(values = []) {
  return formatDocInlineList((Array.isArray(values) ? values : []).map(translateFieldIssueTag));
}

function createResearchDocTable(headers, rows, options = {}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: options.fixed ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D7DDE5" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D7DDE5" },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) => new TableCell({
          width: Array.isArray(options.widths) && options.widths[index]
            ? { size: Number(options.widths[index]), type: WidthType.PERCENTAGE }
            : undefined,
          shading: { fill: options.headerFill || "EEF2FF" },
          margins: { top: 90, bottom: 90, left: 100, right: 100 },
          children: [
            new Paragraph({
              spacing: { after: 40 },
              children: [createResearchDocTextRun(header, { bold: true, size: Number(options.headerFontSize || 19), color: options.headerColor || "1E3A8A" })],
            }),
          ],
        })),
      }),
      ...(Array.isArray(rows) ? rows : []).map((row, rowIndex) => new TableRow({
        children: row.map((cell, index) => new TableCell({
          width: Array.isArray(options.widths) && options.widths[index]
            ? { size: Number(options.widths[index]), type: WidthType.PERCENTAGE }
            : undefined,
          shading: options.zebra !== false && rowIndex % 2 === 1 ? { fill: "F8FAFC" } : undefined,
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              spacing: { after: 40, line: 250 },
              children: [createResearchDocTextRun(String(cell ?? "-"), {
                size: options.codeColumns?.includes(index)
                  ? Number(options.codeFontSize || 16)
                  : Number(options.fontSize || 18),
                font: options.codeColumns?.includes(index) ? "Consolas" : "Microsoft YaHei",
              })],
            }),
          ],
        })),
      })),
    ],
  });
}

function buildRelationshipErSvg(tableRelationships) {
  const entities = Array.isArray(tableRelationships?.entities) ? tableRelationships.entities : [];
  if (!entities.length) return null;
  const relations = Array.isArray(tableRelationships?.relations) ? tableRelationships.relations : [];
  const palette = ["#2563EB", "#7C3AED", "#0891B2", "#059669", "#D97706", "#DC2626", "#4F46E5"];
  const nodeWidth = 270;
  const nodeHeight = 178;
  const gapX = 100;
  const gapY = 86;
  const columns = entities.length <= 4 ? 2 : 3;
  const rows = Math.ceil(entities.length / columns);
  const width = Math.max(900, 64 + columns * nodeWidth + (columns - 1) * gapX + 64);
  const height = Math.max(420, 70 + rows * nodeHeight + (rows - 1) * gapY + 70);
  const positions = new Map();
  entities.forEach((entity, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions.set(entity.tableName, {
      x: 64 + col * (nodeWidth + gapX),
      y: 70 + row * (nodeHeight + gapY),
      color: palette[index % palette.length],
    });
  });

  const relationCountMap = new Map();
  relations.forEach((relation) => {
    relationCountMap.set(relation.fromTable, Number(relationCountMap.get(relation.fromTable) || 0) + 1);
    relationCountMap.set(relation.toTable, Number(relationCountMap.get(relation.toTable) || 0) + 1);
  });

  const edgeSvg = relations
    .filter((relation) => positions.has(relation.fromTable) && positions.has(relation.toTable))
    .map((relation, index) => {
      const source = positions.get(relation.fromTable);
      const target = positions.get(relation.toTable);
      const forward = target.x >= source.x;
      const sx = forward ? source.x + nodeWidth : source.x;
      const tx = forward ? target.x : target.x + nodeWidth;
      const sy = source.y + 58 + (index % 4) * 18;
      const ty = target.y + 58 + (index % 4) * 18;
      const curve = Math.max(70, Math.abs(tx - sx) * 0.36);
      const c1x = forward ? sx + curve : sx - curve;
      const c2x = forward ? tx - curve : tx + curve;
      const labelX = (sx + tx) / 2;
      const labelY = (sy + ty) / 2 - 8;
      return `
        <path d="M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}" fill="none" stroke="#475569" stroke-width="2.3" marker-end="url(#arrow)" opacity="0.78"/>
        <rect x="${labelX - 26}" y="${labelY - 13}" width="52" height="24" rx="12" fill="#FFFFFF" stroke="#CBD5E1"/>
        <text x="${labelX}" y="${labelY + 4}" text-anchor="middle" font-family="Arial, Microsoft YaHei" font-size="12" font-weight="700" fill="#334155">${escapeXml(relation.relationType || "N:1")}</text>
      `;
    })
    .join("");

  const nodeSvg = entities.map((entity, index) => {
    const position = positions.get(entity.tableName);
    const fields = Array.isArray(entity.fields) ? entity.fields.slice(0, 5) : [];
    const hiddenCount = Math.max(0, Number(entity.fields?.length || 0) - fields.length);
    const color = position.color;
    const fieldsSvg = fields.map((field, fieldIndex) => {
      const y = position.y + 100 + fieldIndex * 18;
      const pk = field.isPrimaryKey ? "PK" : "";
      return `
        <text x="${position.x + 18}" y="${y}" font-family="Consolas, Menlo, monospace" font-size="11" fill="#0F172A">${escapeXml(truncateText(field.columnName, 24))}</text>
        <text x="${position.x + nodeWidth - 18}" y="${y}" text-anchor="end" font-family="Arial, Microsoft YaHei" font-size="10" fill="${field.isPrimaryKey ? color : "#64748B"}">${escapeXml(pk || truncateText(field.dataType || "", 14))}</text>
      `;
    }).join("");
    return `
      <g filter="url(#shadow)">
        <rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" fill="#FFFFFF" stroke="#D6DEE8"/>
        <path d="M ${position.x} ${position.y + 12} Q ${position.x} ${position.y} ${position.x + 12} ${position.y} H ${position.x + nodeWidth - 12} Q ${position.x + nodeWidth} ${position.y} ${position.x + nodeWidth} ${position.y + 12} V ${position.y + 72} H ${position.x} Z" fill="${color}"/>
        <text x="${position.x + 18}" y="${position.y + 28}" font-family="Arial, Microsoft YaHei" font-size="11" font-weight="700" fill="#DBEAFE">${escapeXml(DOC_CATEGORY_LABELS[entity.category] || "数据表")}</text>
        <text x="${position.x + 18}" y="${position.y + 52}" font-family="Consolas, Menlo, monospace" font-size="15" font-weight="700" fill="#FFFFFF">${escapeXml(truncateText(entity.tableName, 28))}</text>
        <text x="${position.x + 18}" y="${position.y + 72}" font-family="Arial, Microsoft YaHei" font-size="11" fill="#E0F2FE">${escapeXml(truncateText(entity.tableComment || "未补充说明", 32))}</text>
        <rect x="${position.x + 16}" y="${position.y + 86}" width="${nodeWidth - 32}" height="70" rx="8" fill="#F8FAFC" stroke="#E2E8F0"/>
        ${fieldsSvg}
        <text x="${position.x + 18}" y="${position.y + 168}" font-family="Arial, Microsoft YaHei" font-size="11" fill="#64748B">字段 ${Number(entity.fields?.length || 0)} · 关系 ${Number(relationCountMap.get(entity.tableName) || 0)}${hiddenCount ? ` · +${hiddenCount}` : ""}</text>
      </g>
    `;
  }).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#475569"/>
        </marker>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.12"/>
        </filter>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#CBD5E1" opacity="0.75"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#F8FAFC"/>
      <rect width="100%" height="100%" fill="url(#dots)"/>
      ${edgeSvg}
      ${nodeSvg}
    </svg>
  `.trim();
  return { svg, width, height };
}

function createRelationshipErImageParagraph(tableRelationships) {
  const payload = buildRelationshipErSvg(tableRelationships);
  if (!payload) {
    return createResearchDocParagraph("当前报告没有可生成 ER 图的表关系数据。", { size: 20 });
  }
  const imageWidth = 900;
  const imageHeight = Math.max(280, Math.min(680, Math.round((payload.height / payload.width) * imageWidth)));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 160 },
    children: [
      new ImageRun({
        type: "svg",
        data: Buffer.from(payload.svg),
        transformation: {
          width: imageWidth,
          height: imageHeight,
        },
        fallback: {
          type: "png",
          data: TRANSPARENT_PNG_BUFFER,
        },
      }),
    ],
  });
}

async function buildResearchReportWordBuffer(report) {
  const tables = Array.isArray(report.tables) ? report.tables : [];
  const insights = report.insights || {};
  const recommendations = report.recommendations || {};
  const scaleInsight = insights.dataScale || {};
  const qualityInsight = insights.dataQuality || {};
  const ingestionInsight = insights.ingestionAdvice || {};
  const governanceInsight = insights.governanceAdvice || {};
  const analysisInsight = insights.analysisAdvice || {};
  const largeTables = Array.isArray(scaleInsight.largeTables) && scaleInsight.largeTables.length
    ? scaleInsight.largeTables
    : tables.filter((item) => Number(item.rowCount || 0) >= 100000).map((item) => item.tableName);
  const smallOrEmptyTables = Array.isArray(scaleInsight.smallOrEmptyTables) && scaleInsight.smallOrEmptyTables.length
    ? scaleInsight.smallOrEmptyTables
    : tables.filter((item) => Number(item.rowCount || 0) <= 10).map((item) => item.tableName);
  const complexTables = Array.isArray(scaleInsight.complexTables) && scaleInsight.complexTables.length
    ? scaleInsight.complexTables
    : tables.filter((item) => Number(item.columnCount || 0) >= 30 || Number(item.constraints || 0) >= 5).map((item) => item.tableName);
  const scaleSuggestions = Array.isArray(scaleInsight.suggestions) && scaleInsight.suggestions.length
    ? scaleInsight.suggestions
    : ["大表优先采用增量或分区策略，小表和字典表可合并到低频同步批次，复杂表接入前先确认主键、索引和字段口径。"];
  const children = [
    createResearchDocParagraph(`${report.run?.runName || "数据源调研报告"}`, {
      alignment: AlignmentType.CENTER,
      bold: true,
      size: 34,
      color: "0F172A",
      after: 90,
    }),
    createResearchDocParagraph("Data Source Research Report", {
      alignment: AlignmentType.CENTER,
      size: 20,
      color: "64748B",
      after: 260,
    }),
    createResearchDocTable(
      ["项目项", "内容"],
      [
        ["数据源", report.source?.sourceName || "-"],
        ["数据源类型", report.source?.sourceType || "-"],
        ["数据库/Schema", [report.source?.databaseName, report.source?.schemaName].filter(Boolean).join(" / ") || "-"],
        ["调研表数", String(report.overview?.totalTables ?? "-")],
        ["累计行数", String(report.overview?.totalRowCount ?? "-")],
        ["生成时间", formatDocDateTime(report.run?.startedAt || report.run?.createdAt)],
      ],
      { widths: [24, 76] }
    ),
    createResearchDocParagraph("1. 调研概览", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 160, after: 140 }),
    createResearchDocParagraph(report.overview?.summary || "无。", { size: 21 }),
  ];

  children.push(
    createResearchDocParagraph("2. 表分类", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 160, after: 140 }),
    createResearchDocTable(
      ["序号", "表名", "表注释", "分类", "优先级", "行数", "增量字段", "主要问题"],
      tables.map((table, index) => [
        String(index + 1),
        table.tableName || "-",
        table.tableComment || "-",
        DOC_CATEGORY_LABELS[table.category] || table.category || "-",
        DOC_PRIORITY_LABELS[table.priority] || table.priority || "-",
        String(table.rowCount ?? "-"),
        table.incrementalColumn || "-",
        formatDocIssueTypes(table.metadataIssues || []),
      ]),
      { widths: [5, 18, 19, 10, 8, 9, 11, 20], fontSize: 16, codeFontSize: 14, codeColumns: [1, 6] }
    )
  );

  children.push(createResearchDocParagraph("3. 表关系", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }));
  if (report.tableRelationships) {
    const relations = Array.isArray(report.tableRelationships.relations) ? report.tableRelationships.relations : [];
    children.push(
      createResearchDocParagraph(report.tableRelationships.summary || buildRelationshipSummary(report.tableRelationships.entities || [], relations), { size: 21 }),
      createRelationshipErImageParagraph(report.tableRelationships),
      relations.length
        ? createResearchDocTable(
          ["序号", "引用方", "被引用方", "关系", "来源", "置信度", "依据"],
          relations.map((relation, index) => [
            String(index + 1),
            `${relation.fromTable || "-"}.${relation.fromField || "-"}`,
            `${relation.toTable || "-"}.${relation.toField || "-"}`,
            relation.relationType || "-",
            DOC_RELATION_SOURCE_LABELS[relation.source] || relation.source || "-",
            `${Math.round(Number(relation.confidence || 0) * 100)}%`,
            (relation.evidence || []).join("；") || "-",
          ]),
          { widths: [6, 21, 21, 8, 10, 10, 24], fontSize: 16, codeFontSize: 14, codeColumns: [1, 2] }
        )
        : createResearchDocParagraph("当前未识别到稳定表关系。", { size: 20 })
    );
  } else {
    children.push(createResearchDocParagraph("当前批次未选择或未生成表关系调研结果。", { size: 20, color: "64748B" }));
  }

  children.push(
    createResearchDocParagraph("4. 数据规模", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
    createResearchDocParagraph(scaleInsight.summary || `本次调研覆盖 ${report.overview?.totalTables ?? tables.length} 张表，累计行数 ${report.overview?.totalRowCount ?? "-" }。`, { size: 21 }),
    createResearchDocTable(
      ["项目", "内容"],
      [
        ["大表", formatDocInlineList(largeTables)],
        ["小表/空表", formatDocInlineList(smallOrEmptyTables)],
        ["复杂表", formatDocInlineList(complexTables)],
        ["规模建议", formatDocInlineList(scaleSuggestions)],
      ],
      { widths: [20, 80], fontSize: 17 }
    ),
    createResearchDocTable(
      ["序号", "表名", "行数", "字段数", "样本数", "索引数", "约束数"],
      tables.map((table, index) => [
        String(index + 1),
        table.tableName || "-",
        String(table.rowCount ?? "-"),
        String(table.columnCount ?? "-"),
        String(table.sampleCount ?? "-"),
        String(table.indexes ?? "-"),
        String(table.constraints ?? "-"),
      ]),
      { widths: [6, 26, 14, 12, 12, 12, 12], fontSize: 16, codeFontSize: 14, codeColumns: [1] }
    )
  );

  children.push(
    createResearchDocParagraph("5. 数据质量", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
    createResearchDocParagraph(qualityInsight.summary || "数据质量结果已合并元数据缺失、字段质量和样本质量问题。", { size: 21 })
  );
  if (Array.isArray(qualityInsight.issueTypeStats) && qualityInsight.issueTypeStats.length) {
    children.push(createResearchDocTable(
      ["问题类型", "数量"],
      qualityInsight.issueTypeStats.map((item) => [translateFieldIssueTag(item.issueType), String(item.count ?? 0)]),
      { widths: [70, 30], fontSize: 17 }
    ));
  }
  if (Array.isArray(qualityInsight.tableFindings) && qualityInsight.tableFindings.length) {
    children.push(createResearchDocParagraph("表级质量发现", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
    children.push(createResearchDocTable(
      ["表名", "问题类型", "证据", "建议"],
      qualityInsight.tableFindings.slice(0, 80).map((item) => [
        item.tableName || "-",
        formatDocIssueTypes(item.issueTypes || []),
        formatDocInlineList(item.evidence || []),
        item.suggestion || "-",
      ]),
      { widths: [24, 22, 28, 26], fontSize: 16, codeFontSize: 14, codeColumns: [0] }
    ));
  }
  if (Array.isArray(qualityInsight.fieldFindings) && qualityInsight.fieldFindings.length) {
    children.push(createResearchDocParagraph("字段级质量发现", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
    children.push(createResearchDocTable(
      ["表名", "字段", "问题类型", "证据", "建议"],
      qualityInsight.fieldFindings.slice(0, 120).map((item) => [
        item.tableName || "-",
        item.columnName || "-",
        formatDocIssueTypes(item.issueTypes || []),
        formatDocInlineList(item.evidence || []),
        item.suggestion || "-",
      ]),
      { widths: [20, 18, 20, 22, 20], fontSize: 16, codeFontSize: 14, codeColumns: [0, 1] }
    ));
  }
  children.push(
    createResearchDocParagraph("质量整改建议", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(qualityInsight.suggestions || [])
  );

  children.push(
    createResearchDocParagraph("6. 接入建议", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
    createResearchDocParagraph(ingestionInsight.summary || "接入建议基于表分类、数据规模、增量字段和质量风险生成。", { size: 21 }),
    createResearchDocTable(
      ["项目", "内容"],
      [
        ["优先接入表", formatDocInlineList(ingestionInsight.recommendedTables || recommendations.recommendedTables || [])],
        ["建议暂缓表", formatDocInlineList(ingestionInsight.deferredTables || recommendations.deferredTables || [])],
      ],
      { widths: [24, 76], fontSize: 17 }
    ),
    createResearchDocParagraph("接入策略建议", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(ingestionInsight.ingestionSuggestions || recommendations.ingestionSuggestions || [])
  );
  if (Array.isArray(ingestionInsight.tableModes) && ingestionInsight.tableModes.length) {
    children.push(createResearchDocTable(
      ["表名", "接入模式", "原因", "风险"],
      ingestionInsight.tableModes.slice(0, 100).map((item) => [
        item.tableName || "-",
        item.mode || "-",
        item.reason || "-",
        item.risk || "-",
      ]),
      { widths: [24, 16, 36, 24], fontSize: 16, codeFontSize: 14, codeColumns: [0] }
    ));
  }

  children.push(
    createResearchDocParagraph("7. 治理建议", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
    createResearchDocParagraph(governanceInsight.summary || "治理建议覆盖接入前必须处理项和接入后持续优化项。", { size: 21 }),
    createResearchDocParagraph("接入前必须处理", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(governanceInsight.mustFixBeforeIngestion || []),
    createResearchDocParagraph("接入后持续优化", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(governanceInsight.continuousImprovements || []),
    createResearchDocParagraph("治理建议", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(governanceInsight.governanceSuggestions || recommendations.governanceSuggestions || [])
  );
  if (Array.isArray(governanceInsight.tableTasks) && governanceInsight.tableTasks.length) {
    children.push(createResearchDocTable(
      ["表名", "问题类型", "优先级", "治理动作"],
      governanceInsight.tableTasks.slice(0, 100).map((item) => [
        item.tableName || "-",
        formatDocIssueTypes(item.issueTypes || []),
        DOC_PRIORITY_LABELS[item.priority] || item.priority || "-",
        item.action || "-",
      ]),
      { widths: [24, 28, 12, 36], fontSize: 16, codeFontSize: 14, codeColumns: [0] }
    ));
  }

  children.push(
    createResearchDocParagraph("8. 分析建议", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
    createResearchDocParagraph(analysisInsight.summary || "分析建议基于表分类、字段语义、质量风险和表关系生成。", { size: 21 })
  );
  if (Array.isArray(analysisInsight.coreBusinessTables) && analysisInsight.coreBusinessTables.length) {
    children.push(createResearchDocParagraph("核心业务表分析建议", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
    children.push(createResearchDocTable(
      ["核心业务表", "选择依据", "可做分析", "可用维度/字段", "分析价值"],
      analysisInsight.coreBusinessTables.slice(0, 30).map((item) => [
        item.tableName || "-",
        item.reason || "-",
        formatDocInlineList(item.suggestedSubjects || []),
        formatDocInlineList(item.dimensions || []),
        item.analysisValue || "-",
      ]),
      { widths: [18, 24, 22, 18, 18], fontSize: 16, codeFontSize: 14, codeColumns: [0, 3] }
    ));
  }
  if (Array.isArray(analysisInsight.analysisDirections) && analysisInsight.analysisDirections.length) {
    children.push(createResearchDocParagraph("深度分析方向", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
    children.push(createResearchDocTable(
      ["分析方向", "核心表", "指标口径", "分析维度", "样例证据", "报表建议"],
      analysisInsight.analysisDirections.slice(0, 40).map((item) => [
        item.direction || "-",
        item.coreTable || "-",
        formatDocInlineList(item.measures || []),
        formatDocInlineList(item.dimensions || []),
        formatDocInlineList(item.sampleEvidence || []),
        formatDocInlineList(item.outputSuggestions || []),
      ]),
      { widths: [16, 15, 17, 18, 20, 14], fontSize: 15, codeFontSize: 13, codeColumns: [1, 3] }
    ));
  }
  if (Array.isArray(analysisInsight.analysisThemes) && analysisInsight.analysisThemes.length) {
    children.push(createResearchDocParagraph("业务分析主题", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
    children.push(createResearchDocTable(
      ["分析主题", "相关表", "关键字段", "分析价值", "限制"],
      analysisInsight.analysisThemes.slice(0, 60).map((item) => [
        item.theme || "-",
        formatDocInlineList(item.tables || []),
        formatDocInlineList(item.keyFields || []),
        item.value || "-",
        formatDocInlineList(item.limitations || []),
      ]),
      { widths: [16, 24, 20, 24, 16], fontSize: 16, codeFontSize: 14, codeColumns: [1, 2] }
    ));
  }
  children.push(
    createResearchDocParagraph("分析建议", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(analysisInsight.analysisSuggestions || recommendations.analysisSuggestions || []),
    createResearchDocParagraph("持续关注项", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(analysisInsight.watchItems || []),
    createResearchDocParagraph("待业务确认", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
    ...createResearchDocBulletList(analysisInsight.followUpQuestions || [])
  );

  if (Array.isArray(report.analysisBatches) && report.analysisBatches.length > 0) {
    children.push(
      createResearchDocParagraph("9. AI 分析批次", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 160, after: 140 }),
      createResearchDocTable(
        ["阶段", "批次", "表数", "状态", "耗时(ms)", "错误信息"],
        report.analysisBatches.map((item) => [
          DOC_STAGE_LABELS[item.stageKey] || item.stageKey || "-",
          String(item.batchNo ?? "-"),
          String(item.batchSize ?? "-"),
          item.status || "-",
          String(item.durationMs ?? "-"),
          item.errorMessage || "-",
        ]),
        { widths: [22, 8, 8, 12, 14, 36], fontSize: 17 }
      )
    );
  }

  children.push(
    createResearchDocParagraph("附录：字段明细", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, pageBreakBefore: true, before: 120, after: 140 }),
    createResearchDocParagraph("字段明细按表展开，长字段表建议在平台页面内继续查看完整交互结果。", { size: 20, color: "64748B" })
  );

  tables.forEach((table, tableIndex) => {
    const fields = Array.isArray(table.fieldProfiles) && table.fieldProfiles.length ? table.fieldProfiles : (table.columns || []);
    children.push(
      createResearchDocParagraph(`${tableIndex + 1}. ${table.tableName || `表${tableIndex + 1}`}`, {
        heading: HeadingLevel.HEADING_2,
        bold: true,
        size: 23,
        before: 150,
        after: 100,
      }),
      createResearchDocTable(
        ["字段名", "类型", "主键", "可空", "字段注释", "问题类型"],
        fields.map((field) => [
          field.columnName || "-",
          field.dataType || field.columnType || "-",
          field.isPrimaryKey ? "是" : "否",
          field.isNullable === undefined ? "-" : (field.isNullable ? "是" : "否"),
          field.columnComment || "-",
          formatDocIssueTypes(field.issueTags || []),
        ]),
        { widths: [22, 15, 7, 7, 35, 14], fontSize: 16, codeFontSize: 14, codeColumns: [0, 1] }
      )
    );
  });

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

function buildSummaryText(source, tables, recommendedTables, deferredTables) {
  const businessCount = tables.filter((item) => item.category === "business").length;
  const dictCount = tables.filter((item) => item.category === "dictionary").length;
  const issueCount = tables.reduce((sum, item) => sum + item.metadataIssues.length, 0);
  return `${source.sourceName} 共调研 ${tables.length} 张表，识别业务表 ${businessCount} 张、字典表 ${dictCount} 张。建议优先接入 ${recommendedTables.length} 张表，暂缓 ${deferredTables.length} 张表，累计发现 ${issueCount} 项元数据或质量提示。`;
}

function normalizeSummaryText(text, maxLength = 4000) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function buildGovernanceSuggestions(tables = []) {
  const suggestions = [];
  if (tables.some((item) => item.metadataIssues.some((issue) => issue.includes("缺少主键")))) {
    suggestions.push("优先补齐主键或业务唯一键定义，避免后续增量同步和去重失真。");
  }
  if (tables.some((item) => item.metadataIssues.some((issue) => issue.includes("字段注释缺失")))) {
    suggestions.push("建议在接入前补齐表注释和字段注释，降低字段映射成本。");
  }
  if (tables.some((item) => item.metadataIssues.includes("缺少明显增量字段"))) {
    suggestions.push("对于缺少更新时间字段的表，需提前确认全量同步窗口或补充审计字段。");
  }
  return suggestions;
}

function buildIngestionSuggestions(tables = []) {
  const suggestions = [];
  const highPriorityTables = tables.filter((item) => item.priority === "high");
  if (highPriorityTables.length > 0) {
    suggestions.push(`建议优先围绕 ${highPriorityTables.slice(0, 5).map((item) => item.tableName).join("、")} 构建首批接入任务。`);
  }
  if (tables.some((item) => item.incrementalColumn)) {
    suggestions.push("优先选择存在更新时间或创建时间字段的表走增量接入，减少全量重刷成本。");
  } else {
    suggestions.push("当前未识别到稳定增量字段，建议首批任务采用全量或人工确认增量策略。");
  }
  if (tables.some((item) => item.category === "dictionary")) {
    suggestions.push("字典表可作为附属任务同步，优先保证业务表与字典编码口径一致。");
  }
  return suggestions;
}

const FIELD_ISSUE_LABELS = {
  missing_comment: "字段注释缺失",
  high_null_rate: "高空值率",
  low_cardinality: "低基数字段",
  high_cardinality: "高基数字段",
};

function translateFieldIssueTag(tag) {
  return FIELD_ISSUE_LABELS[String(tag || "").trim()] || String(tag || "").trim() || "其他问题";
}

function collectIssueTypeStats(issueGroups = []) {
  const map = new Map();
  for (const issueTypes of issueGroups) {
    uniqueStrings(issueTypes).forEach((issueType) => {
      map.set(issueType, Number(map.get(issueType) || 0) + 1);
    });
  }
  return Array.from(map.entries()).map(([issueType, count]) => ({ issueType, count }));
}

function buildQualityInsights(tables = []) {
  const fieldFindings = [];
  const tableFindings = [];
  for (const table of tables) {
    const tableIssueTypes = uniqueStrings([
      ...(table.metadataIssues || []),
      ...(!table.incrementalColumn ? ["缺少增量字段"] : []),
    ]);
    if (tableIssueTypes.length) {
      tableFindings.push({
        tableName: table.tableName,
        issueTypes: tableIssueTypes,
        evidence: tableIssueTypes,
        suggestion: tableIssueTypes.some((item) => item.includes("字段注释") || item.includes("表注释"))
          ? "补齐表和字段业务说明后再沉淀到数据资产目录。"
          : "接入前确认主键、增量口径和质量风险处理方式。",
      });
    }
    for (const field of table.fieldProfiles || []) {
      const issueTypes = uniqueStrings((field.issueTags || []).map(translateFieldIssueTag));
      if (!issueTypes.length) continue;
      const evidence = [];
      if (typeof field.nullRate === "number") evidence.push(`空值率 ${Math.round(field.nullRate * 10000) / 100}%`);
      if (typeof field.distinctRatio === "number") evidence.push(`去重率 ${Math.round(field.distinctRatio * 10000) / 100}%`);
      if (!field.columnComment) evidence.push("字段注释为空");
      fieldFindings.push({
        tableName: table.tableName,
        columnName: field.columnName,
        issueTypes,
        evidence: uniqueStrings(evidence),
        suggestion: issueTypes.includes("字段注释缺失") ? "补充字段业务含义和口径说明。" : "确认字段质量规则和业务可用性。",
      });
    }
  }
  const issueTypeStats = collectIssueTypeStats([
    ...tableFindings.map((item) => item.issueTypes),
    ...fieldFindings.map((item) => item.issueTypes),
  ]);
  return {
    summary: `识别 ${tableFindings.length} 张表存在表级质量或元数据问题，${fieldFindings.length} 个字段存在字段级质量提示。`,
    issueTypeStats,
    tableFindings: tableFindings.slice(0, 100),
    fieldFindings: fieldFindings.slice(0, 300),
    suggestions: uniqueStrings([
      ...buildGovernanceSuggestions(tables),
      "对高空值率、低基数和高基数字段补充字段级质量规则，区分字典值、枚举值和业务唯一标识。",
    ]),
  };
}

function buildIngestionAdviceInsight(tables = [], recommendedTables = [], deferredTables = []) {
  const tableModes = tables
    .filter((item) => recommendedTables.includes(item.tableName) || deferredTables.includes(item.tableName) || item.priority === "high")
    .map((item) => ({
      tableName: item.tableName,
      mode: item.suggestedMode || (item.incrementalColumn ? "incremental" : "full"),
      reason: item.incrementalColumn ? `识别到增量字段 ${item.incrementalColumn}` : "未识别稳定增量字段，建议先按全量或人工确认模式接入。",
      risk: (item.risks || []).slice(0, 2).join("；") || "-",
    }));
  return {
    summary: `建议优先接入 ${recommendedTables.length} 张表，暂缓 ${deferredTables.length} 张表，并按增量字段、质量风险和表关系拆分接入批次。`,
    recommendedTables,
    deferredTables,
    tableModes,
    ingestionSuggestions: buildIngestionSuggestions(tables),
  };
}

function buildGovernanceAdviceInsight(tables = []) {
  const tableTasks = tables
    .filter((item) => item.metadataIssues?.length || item.risks?.length)
    .map((item) => ({
      tableName: item.tableName,
      issueTypes: uniqueStrings([...(item.metadataIssues || []), ...(item.risks || [])]),
      priority: item.priority === "high" ? "high" : "medium",
      action: item.metadataIssues?.some((issue) => issue.includes("字段注释") || issue.includes("表注释"))
        ? "补齐元数据说明、字段口径和负责人后纳入资产目录。"
        : "确认主键、增量字段和质量规则后再进入稳定接入。",
    }));
  return {
    summary: `识别 ${tableTasks.length} 张表需要治理动作，优先处理高优先级表的主键、注释、增量字段和质量规则。`,
    mustFixBeforeIngestion: tableTasks.filter((item) => item.priority === "high").slice(0, 20).map((item) => `${item.tableName}：${item.action}`),
    continuousImprovements: [
      "建立表注释、字段注释、主键、增量字段的接入前检查清单。",
      "将高空值率、枚举值漂移和唯一性风险纳入后续质量监控。",
    ],
    tableTasks: tableTasks.slice(0, 100),
    governanceSuggestions: buildGovernanceSuggestions(tables),
  };
}

function buildAnalysisAdviceInsight(tables = [], tableRelationships = null) {
  function fieldLabel(fieldName) {
    const lower = String(fieldName || "").toLowerCase();
    if (/(status|state|flag|result)/i.test(lower)) return "状态";
    if (/(type|kind|category|level|grade)/i.test(lower)) return "类型";
    if (/(code|no|num|number)$/i.test(lower)) return "编码";
    if (/(date|time|created|updated|apply|approval|reg)/i.test(lower)) return "时间";
    if (/(region|city|area|county|province|dept|office|org)/i.test(lower)) return "区域/机构";
    return "维度";
  }

  function buildSampleEvidence(table, fields = []) {
    return fields.slice(0, 6).map((fieldName) => {
      const field = (table.fieldProfiles || []).find((item) => item.columnName === fieldName);
      const samples = Array.isArray(field?.sampleValues) ? field.sampleValues.slice(0, 3).join("、") : "";
      const comment = field?.columnComment ? `（${field.columnComment}）` : "";
      return `${fieldName}${comment}${samples ? ` 样例：${samples}` : ""}`;
    });
  }

  const businessTables = tables
    .filter((item) => item.category === "business")
    .sort((left, right) => {
      const priorityWeight = { high: 1, medium: 2, low: 3 };
      const leftPriority = priorityWeight[left.priority] || 9;
      const rightPriority = priorityWeight[right.priority] || 9;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return Number(right.rowCount || 0) - Number(left.rowCount || 0);
    })
    .slice(0, 6);
  const dictionaryTables = tables.filter((item) => item.category === "dictionary").slice(0, 8);
  const analysisThemes = [];
  const analysisDirections = [];
  const relations = Array.isArray(tableRelationships?.relations) ? tableRelationships.relations : [];
  const relatedTableMap = new Map();
  relations.forEach((relation) => {
    if (relation.fromTable && relation.toTable) {
      relatedTableMap.set(relation.fromTable, uniqueStrings([...(relatedTableMap.get(relation.fromTable) || []), relation.toTable]));
      relatedTableMap.set(relation.toTable, uniqueStrings([...(relatedTableMap.get(relation.toTable) || []), relation.fromTable]));
    }
  });
  const coreBusinessTables = businessTables.map((table) => {
    const summary = table.fieldSummary || {};
    const dimensions = uniqueStrings([
      ...(summary.timeFields || []),
      ...(summary.statusLikeFields || []),
      ...(summary.typeLikeFields || []),
      ...(summary.codeLikeFields || []),
      ...(summary.nameLikeFields || []),
      ...(relatedTableMap.get(table.tableName) || []),
    ]).slice(0, 10);
    const suggestedSubjects = uniqueStrings([
      ...(summary.timeFields?.length ? ["业务量趋势分析"] : []),
      ...(summary.statusLikeFields?.length ? ["状态分布与异常状态监测"] : []),
      ...(summary.typeLikeFields?.length || summary.codeLikeFields?.length ? ["业务类型/编码维度分布分析"] : []),
      ...(relatedTableMap.get(table.tableName)?.length ? ["关联维表下钻分析"] : []),
      "核心明细追踪与异常样本定位",
    ]).slice(0, 6);
    return {
      tableName: table.tableName,
      reason: `${table.priority === "high" ? "高优先级业务表" : "业务主表"}，行数 ${table.rowCount ?? "-"}，字段 ${table.columnCount ?? "-"} 个。`,
      analysisValue: "可作为业务分析主表，承载趋势、分布、状态、维度拆分和异常明细追踪类分析。",
      suggestedSubjects,
      dimensions,
    };
  });
  if (businessTables.length) {
    businessTables.forEach((table) => {
      const summary = table.fieldSummary || {};
      const timeFields = summary.timeFields || [];
      const statusFields = summary.statusLikeFields || [];
      const typeFields = summary.typeLikeFields || [];
      const codeFields = summary.codeLikeFields || [];
      const nameFields = summary.nameLikeFields || [];
      const keyFields = uniqueStrings([
        ...timeFields,
        ...statusFields,
        ...typeFields,
        ...codeFields,
      ]).slice(0, 10);
      const dimensions = uniqueStrings([
        ...statusFields.map((item) => `${item}（${fieldLabel(item)}分布）`),
        ...typeFields.map((item) => `${item}（${fieldLabel(item)}分布）`),
        ...codeFields.slice(0, 4).map((item) => `${item}（编码维度）`),
        ...nameFields.slice(0, 4).map((item) => `${item}（名称/描述维度）`),
        ...(relatedTableMap.get(table.tableName) || []).map((item) => `${item} 关联下钻`),
      ]).slice(0, 10);
      const measures = uniqueStrings([
        "记录数/业务量",
        ...(timeFields.length ? ["按日/周/月新增量", "处理周期或登记周期"] : []),
        ...(statusFields.length ? ["各状态数量占比", "异常状态数量"] : []),
        ...(table.incrementalColumn ? [`基于 ${table.incrementalColumn} 的增量变化量`] : []),
      ]).slice(0, 8);
      analysisDirections.push({
        direction: `${table.tableComment || table.tableName}核心业务分析`,
        coreTable: table.tableName,
        relatedTables: (relatedTableMap.get(table.tableName) || []).slice(0, 6),
        measures,
        dimensions,
        sampleEvidence: buildSampleEvidence(table, keyFields),
        analysisQuestions: uniqueStrings([
          `可以观察 ${table.tableComment || table.tableName} 的业务量趋势和周期波动吗？`,
          ...(statusFields.length ? ["不同状态的占比、积压和异常状态是否稳定？"] : []),
          ...(dimensions.length ? ["不同维度下业务量和异常分布是否存在明显差异？"] : []),
          ...(relatedTableMap.get(table.tableName)?.length ? ["关联维表下钻后，机构、区域或编码口径是否一致？"] : []),
        ]).slice(0, 6),
        outputSuggestions: uniqueStrings([
          "核心指标卡：总量、增量、异常量、最新更新时间。",
          ...(timeFields.length ? ["趋势图：按登记/创建/更新时间展示业务量变化。"] : []),
          ...(statusFields.length || typeFields.length ? ["分布图：按状态、类型、编码展示占比和异常分布。"] : []),
          "明细表：保留主键、时间、状态、编码和关键说明字段用于追溯。",
        ]).slice(0, 6),
        caveats: uniqueStrings([
          "需要业务确认统计时间字段和主指标口径。",
          ...(statusFields.length ? ["状态编码需要与字典表或业务口径对齐。"] : []),
          ...(table.metadataIssues?.length ? ["存在元数据或质量问题，分析前需复核字段含义。"] : []),
        ]).slice(0, 6),
      });
      analysisThemes.push({
        theme: `${table.tableComment || table.tableName}业务分析`,
        tables: uniqueStrings([table.tableName, ...(relatedTableMap.get(table.tableName) || []).slice(0, 4)]),
        keyFields,
        value: "结合字段样例、时间字段、状态/类型字段和关联表，形成业务量趋势、状态分布、维度拆分和异常明细追踪分析。",
        limitations: ["需确认业务指标口径、主键唯一性、时间字段含义和状态编码解释。"],
      });
    });
  }
  if (dictionaryTables.length) {
    analysisThemes.push({
      theme: "字典口径校验",
      tables: dictionaryTables.map((item) => item.tableName),
      keyFields: uniqueStrings(dictionaryTables.flatMap((item) => [...(item.fieldSummary?.codeLikeFields || []), ...(item.fieldSummary?.nameLikeFields || [])])).slice(0, 10),
      value: "用于支撑业务表编码翻译、状态解释和维度过滤。",
      limitations: ["需保证字典编码与业务表引用字段一致。"],
    });
  }
  return {
    summary: `围绕 ${coreBusinessTables.length} 张核心业务表形成 ${analysisThemes.length} 类业务分析主题，表关系 ${tableRelationships?.relations?.length || 0} 条可用于关联下钻和维度解释。`,
    coreBusinessTables,
    analysisDirections: analysisDirections.slice(0, 30),
    analysisThemes: analysisThemes.slice(0, 20),
    watchItems: [
      "关注业务表行数、增量字段和高空值字段的批次变化。",
      "关注表关系新增、消失或置信度下降对报表关联口径的影响。",
    ],
    followUpQuestions: [
      "核心业务指标口径和统计周期是否已有统一定义？",
      "字典表编码是否与业务表字段保持一一对应？",
    ],
    analysisSuggestions: [
      "优先围绕核心业务表建立业务量趋势、状态分布、维度拆分和异常明细追踪报表。",
      "将字典表作为维度解释层，用于编码翻译、状态解释和报表筛选条件。",
      "对核心业务表先确认统计时间字段、业务主键、状态字段和指标口径，再进入报表建模。",
    ],
  };
}

function buildScaleInsights(tables = []) {
  const sortedByRows = [...tables].sort((left, right) => Number(right.rowCount || 0) - Number(left.rowCount || 0));
  return {
    summary: `本次调研覆盖 ${tables.length} 张表，最大表 ${sortedByRows[0]?.tableName || "-"} 行数 ${sortedByRows[0]?.rowCount ?? 0}。`,
    largeTables: sortedByRows.filter((item) => Number(item.rowCount || 0) >= 100000).map((item) => item.tableName),
    smallOrEmptyTables: sortedByRows.filter((item) => Number(item.rowCount || 0) <= 10).map((item) => item.tableName),
    complexTables: tables.filter((item) => Number(item.columnCount || 0) >= 30 || Number(item.constraints || 0) >= 5).map((item) => item.tableName),
    suggestions: ["大表优先采用增量或分区策略，小表和字典表可合并到低频同步批次。"],
  };
}

function mergeStringList(base = [], addition = []) {
  return uniqueStrings([...(base || []), ...(Array.isArray(addition) ? addition : [])]);
}

async function callModulePrompt({ runId, source, config, provider, aiConfig, signal, stageKey, prompt, payload, maxTokens = 1800 }) {
  const batch = {
    stageKey,
    batchNo: 1,
    batchSize: Array.isArray(payload?.tables) ? payload.tables.length : 1,
    inputSummary: { tableCount: Array.isArray(payload?.tables) ? payload.tables.length : undefined },
    status: "pending",
  };
  const startedAt = Date.now();
  try {
    assertResearchRunNotCancelled(runId);
    await log(runId, stageKey, `开始${stageKey}模型分析`);
    const messages = ensureJsonObjectPrompt([
      { role: "system", content: `${prompt}\n\n${aiConfig.systemPrompt ? `平台补充要求：${aiConfig.systemPrompt}` : ""}\n\n只输出 JSON 对象。` },
      { role: "user", content: JSON.stringify({ ...payload, config }, null, 2) },
    ], provider);
    const completion = await modelProviderService.generateChatCompletion(provider, messages, {
      temperature: aiConfig.temperature ?? 0.1,
      maxTokens: Number(aiConfig.maxTokens || maxTokens),
      signal,
      responseFormat: { type: "json_object" },
    });
    assertResearchRunNotCancelled(runId);
    const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
    batch.status = "succeeded";
    batch.output = parsed;
    batch.durationMs = Date.now() - startedAt;
    await log(runId, stageKey, `${stageKey}模型分析完成`);
    return { output: parsed, batch };
  } catch (error) {
    if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
      throw createResearchRunCancelledError();
    }
    batch.status = "failed";
    batch.errorMessage = error.message || "模型调用失败";
    batch.durationMs = Date.now() - startedAt;
    await log(runId, stageKey, `${stageKey}模型分析失败，已使用规则兜底: ${error.message || "unknown"}`, { logLevel: "warn" });
    return { output: null, batch };
  }
}

async function runModuleInsights(runId, source, config, tables, tableRelationships, signal) {
  const recommendedTables = uniqueStrings(tables.filter((item) => item.priority === "high" && item.category === "business").map((item) => item.tableName));
  const deferredTables = uniqueStrings(tables.filter((item) => ["low_value", "temporary", "log"].includes(item.category)).map((item) => item.tableName));
  const insights = {
    dataScale: buildScaleInsights(tables),
    dataQuality: buildQualityInsights(tables),
    ingestionAdvice: buildIngestionAdviceInsight(tables, recommendedTables, deferredTables),
    governanceAdvice: buildGovernanceAdviceInsight(tables),
    analysisAdvice: buildAnalysisAdviceInsight(tables, tableRelationships),
  };
  const batches = [];

  const requestedAiStages = [
    ["data_scale", "data_scale", DATA_SCALE_PROMPT, "dataScale"],
    ["quality_inspection", "quality_inspection", DATA_QUALITY_PROMPT, "dataQuality"],
    ["ingestion_advice", "ingestion_advice", INGESTION_ADVICE_PROMPT, "ingestionAdvice"],
    ["governance_advice", "governance_advice", GOVERNANCE_ADVICE_PROMPT, "governanceAdvice"],
    ["analysis_advice", "analysis_advice", ANALYSIS_ADVICE_PROMPT, "analysisAdvice"],
  ].filter(([itemKey]) => hasResearchItem(config, itemKey));

  if (!requestedAiStages.length) {
    return { insights, batches };
  }

  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
  if (!aiConfig?.defaultModelProviderId) {
    return { insights, batches };
  }

  let provider = null;
  try {
    provider = await resolveResearchProvider(aiConfig);
  } catch (_error) {
    return { insights, batches };
  }

  const tableCards = tables.map((table) => buildAiTableCard(table, { includeFieldEvidence: true }));
  for (const [, stageKey, prompt, insightKey] of requestedAiStages) {
    const result = await callModulePrompt({
      runId,
      source,
      config,
      provider,
      aiConfig,
      signal,
      stageKey,
      prompt,
      payload: {
        source: { sourceName: source.sourceName, sourceType: source.sourceType, databaseName: pickDatabaseName(source), schemaName: pickSchemaName(source) },
        tables: tableCards,
        tableRelationships,
        currentInsight: insights[insightKey],
      },
    });
    batches.push(result.batch);
    if (result.output && typeof result.output === "object") {
      insights[insightKey] = { ...insights[insightKey], ...result.output };
    }
  }

  insights.ingestionAdvice.recommendedTables = mergeStringList(insights.ingestionAdvice.recommendedTables, recommendedTables);
  insights.ingestionAdvice.deferredTables = mergeStringList(insights.ingestionAdvice.deferredTables, deferredTables);
  return { insights, batches };
}

async function runAiResearch(runId, source, config, tableProfiles, signal) {
  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
  if (!aiConfig?.defaultModelProviderId) {
    await log(runId, "ai_research", "未配置数据源调研模型，已使用规则结果生成报告", { logLevel: "warn" });
    return { aiDecision: null, batches: [] };
  }

  let provider = null;
  try {
    provider = await resolveResearchProvider(aiConfig);
  } catch (error) {
    await log(runId, "ai_research", `${error.message || "数据源调研模型不存在"}，已回退到规则结果`, { logLevel: "warn" });
    return { aiDecision: null, batches: [] };
  }

  const tableCards = tableProfiles.map(buildAiTableCard);
  const chunkedCards = chunkArray(tableCards, Number(config.aiBatchSize || 15));
  const batches = [];
  const collectedDecisions = [];
  const collectedRecommendedTables = [];
  const collectedDeferredTables = [];
  const collectedGovernanceSuggestions = [];
  const collectedIngestionSuggestions = [];
  const batchSummaries = [];

  for (let index = 0; index < chunkedCards.length; index += 1) {
    assertResearchRunNotCancelled(runId);
    const batchNo = index + 1;
    const cards = chunkedCards[index];
    const batch = {
      stageKey: "table_classification",
      batchNo,
      batchSize: cards.length,
      inputSummary: { tableNames: cards.map((item) => item.tableName), rowCountMode: config.rowCountMode || "estimated" },
      status: "pending"
    };
    const startedAt = Date.now();
    try {
      assertResearchRunNotCancelled(runId);
      await log(runId, "ai_research", `开始第 ${batchNo}/${chunkedCards.length} 批模型分类分析`, { detail: batch.inputSummary });
      const messages = ensureJsonObjectPrompt([
        { role: "system", content: `${TABLE_CLASSIFICATION_PROMPT}\n\n${aiConfig.systemPrompt ? `平台补充要求：${aiConfig.systemPrompt}` : ""}\n\n当前任务为表分类批次分析，只输出 JSON 对象。` },
        { role: "user", content: JSON.stringify(buildBatchPromptPayload(source, config, cards), null, 2) }
      ], provider);
      const completion = await modelProviderService.generateChatCompletion(provider, messages, {
        temperature: aiConfig.temperature ?? 0.1,
        maxTokens: Number(aiConfig.maxTokens || 1800),
        signal,
        responseFormat: { type: "json_object" }
      });
      assertResearchRunNotCancelled(runId);
      const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
      batch.status = "succeeded";
      batch.output = parsed;
      batch.durationMs = Date.now() - startedAt;
      collectedDecisions.push(...(Array.isArray(parsed.tableDecisions) ? parsed.tableDecisions : []));
      collectedRecommendedTables.push(...(Array.isArray(parsed.recommendedTables) ? parsed.recommendedTables : []));
      collectedDeferredTables.push(...(Array.isArray(parsed.deferredTables) ? parsed.deferredTables : []));
      collectedGovernanceSuggestions.push(...(Array.isArray(parsed.governanceSuggestions) ? parsed.governanceSuggestions : []));
      collectedIngestionSuggestions.push(...(Array.isArray(parsed.ingestionSuggestions) ? parsed.ingestionSuggestions : []));
      if (parsed.summary) batchSummaries.push(String(parsed.summary));
      await log(runId, "ai_research", `第 ${batchNo}/${chunkedCards.length} 批模型分类完成`);
    } catch (error) {
      if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
        throw createResearchRunCancelledError();
      }
      batch.status = "failed";
      batch.errorMessage = error.message || "模型调用失败";
      batch.durationMs = Date.now() - startedAt;
      await log(runId, "ai_research", `第 ${batchNo}/${chunkedCards.length} 批模型分类失败，已回退到规则结果`, {
        logLevel: "warn",
        detail: { error: error.message || "unknown", batchNo }
      });
    }
    batches.push(batch);
  }

  if (!collectedDecisions.length && !collectedRecommendedTables.length && !collectedDeferredTables.length) {
    return { aiDecision: null, batches };
  }

  const aggregateBatch = {
    stageKey: "report_aggregation",
    batchNo: 1,
    batchSize: tableProfiles.length,
    inputSummary: { tableCount: tableProfiles.length, batchCount: chunkedCards.length },
    status: "pending"
  };
  const startedAt = Date.now();
  try {
    assertResearchRunNotCancelled(runId);
    await log(runId, "ai_research", "开始模型全局汇总分析");
    const messages = ensureJsonObjectPrompt([
      { role: "system", content: `${REPORT_AGGREGATION_PROMPT}\n\n${aiConfig.systemPrompt ? `平台补充要求：${aiConfig.systemPrompt}` : ""}\n\n当前任务为全局汇总分析，只输出 JSON 对象。` },
      {
        role: "user",
        content: JSON.stringify({
          source: { sourceName: source.sourceName, sourceType: source.sourceType, databaseName: pickDatabaseName(source), schemaName: pickSchemaName(source) },
          config,
          batchSummaries,
          tableDecisions: collectedDecisions
        }, null, 2)
      }
    ], provider);
    const completion = await modelProviderService.generateChatCompletion(provider, messages, {
      temperature: aiConfig.temperature ?? 0.1,
      maxTokens: Number(aiConfig.maxTokens || 1800),
      signal,
      responseFormat: { type: "json_object" }
    });
    assertResearchRunNotCancelled(runId);
    const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
    aggregateBatch.status = "succeeded";
    aggregateBatch.output = parsed;
    aggregateBatch.durationMs = Date.now() - startedAt;
    await log(runId, "ai_research", "模型全局汇总分析完成");
    return {
      aiDecision: {
        summary: parsed.summary || batchSummaries.join(" "),
        tableDecisions: Array.isArray(parsed.tableDecisions) && parsed.tableDecisions.length ? parsed.tableDecisions : collectedDecisions,
        recommendedTables: uniqueStrings((parsed.recommendedTables || []).concat(collectedRecommendedTables)),
        deferredTables: uniqueStrings((parsed.deferredTables || []).concat(collectedDeferredTables)),
        governanceSuggestions: uniqueStrings((parsed.governanceSuggestions || []).concat(collectedGovernanceSuggestions)),
        ingestionSuggestions: uniqueStrings((parsed.ingestionSuggestions || []).concat(collectedIngestionSuggestions))
      },
      batches: [...batches, aggregateBatch]
    };
  } catch (error) {
    if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
      throw createResearchRunCancelledError();
    }
    aggregateBatch.status = "failed";
    aggregateBatch.errorMessage = error.message || "模型汇总失败";
    aggregateBatch.durationMs = Date.now() - startedAt;
    await log(runId, "ai_research", `模型全局汇总失败，已使用批次结果回退: ${error.message || "unknown"}`, { logLevel: "warn" });
    return {
      aiDecision: {
        summary: batchSummaries.join(" "),
        tableDecisions: collectedDecisions,
        recommendedTables: uniqueStrings(collectedRecommendedTables),
        deferredTables: uniqueStrings(collectedDeferredTables),
        governanceSuggestions: uniqueStrings(collectedGovernanceSuggestions),
        ingestionSuggestions: uniqueStrings(collectedIngestionSuggestions)
      },
      batches: [...batches, aggregateBatch]
    };
  }
}
function buildResearchConfigFromPayload(payload = {}, fallback = {}) {
  const rawResearchItems = Array.isArray(payload.researchItems) ? payload.researchItems : (Array.isArray(fallback.researchItems) ? fallback.researchItems : []);
  return {
    sampleSize: payload.sampleSize ?? fallback.sampleSize ?? 50,
    maxTables: payload.maxTables ?? fallback.maxTables ?? 50,
    rowCountMode: payload.rowCountMode || fallback.rowCountMode || "estimated",
    metadataConcurrency: payload.metadataConcurrency ?? fallback.metadataConcurrency ?? 3,
    aiBatchSize: payload.aiBatchSize ?? fallback.aiBatchSize ?? 15,
    researchItems: normalizeResearchItems(rawResearchItems),
    notes: payload.notes ?? fallback.notes ?? ""
  };
}

function assertValidResearchScope(tableScope, selectedTables) {
  if (tableScope === "manual" && selectedTables.length === 0) {
    throw new AppError("手工选表模式下至少选择一张表", 400);
  }
}

async function createResearchRunFromSource(source, payload, user, options = {}) {
  if (!source) throw new AppError("数据源不存在", 404);
  if (!supportsResearch(source)) throw new AppError(`当前仅支持 MySQL / PostgreSQL / Hive / FTP / Kafka 数据源调研，暂不支持 ${source.sourceType}`, 400);

  const selectedTables = uniqueStrings(payload.selectedTables);
  assertValidResearchScope(payload.tableScope, selectedTables);
  const config = buildResearchConfigFromPayload(payload);

  const run = await repository.createRun({
    taskId: options.taskId || null,
    runNo: options.runNo || null,
    sourceId: source.id,
    runName: options.runName || buildRunName(source),
    sourceName: source.sourceName,
    sourceType: source.sourceType,
    databaseName: pickDatabaseName(source),
    schemaName: pickSchemaName(source),
    tableScope: payload.tableScope,
    config,
    selectedTables,
    status: "pending",
    progressPercent: 0,
    currentStage: "created",
    createdBy: user?.displayName || user?.username || "system"
  });

  await log(run.id, "created", "调研任务已创建，等待执行", {
    detail: {
      tableScope: payload.tableScope,
      selectedTableCount: selectedTables.length,
      researchItems: config.researchItems,
      rowCountMode: config.rowCountMode
    }
  });

  if (options.taskId) {
    await repository.updateTask(options.taskId, {
      lastRunId: run.id,
      lastRunStatus: run.status,
      lastRunAt: new Date()
    });
  }

  setImmediate(() => {
    executeResearchRun(run.id).catch(async (error) => {
      if (isResearchRunCancelledError(error)) {
        await markResearchRunCancelled(run.id);
        return;
      }
      const failedRun = await repository.updateRun(run.id, {
        status: "failed",
        progressPercent: 100,
        currentStage: "failed",
        errorMessage: error.message || "数据源调研失败",
        finishedAt: new Date()
      });
      if (run.taskId) {
        await repository.updateTask(run.taskId, {
          lastRunId: run.id,
          lastRunStatus: failedRun.status,
          lastRunAt: failedRun.finishedAt || new Date()
        });
      }
      await log(run.id, "failed", error.message || "数据源调研失败", { logLevel: "error" });
    });
  });

  return run;
}

async function createResearchRun(sourceId, payload, user) {
  const source = await dataSourceRepository.getDataSourceById(sourceId);
  if (!source) throw new AppError("数据源不存在", 404);
  if (!supportsResearch(source)) throw new AppError(`当前仅支持 MySQL / PostgreSQL / Hive / FTP / Kafka 数据源调研，暂不支持 ${source.sourceType}`, 400);
  return createResearchRunFromSource(source, payload, user);
}

async function createResearchTask(payload, user) {
  const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
  if (!source) throw new AppError("数据源不存在", 404);
  if (!supportsResearch(source)) throw new AppError(`当前仅支持 MySQL / PostgreSQL / Hive / FTP / Kafka 数据源调研，暂不支持 ${source.sourceType}`, 400);
  const selectedTables = uniqueStrings(payload.selectedTables);
  const tableScope = payload.tableScope || "all";
  assertValidResearchScope(tableScope, selectedTables);
  const config = buildResearchConfigFromPayload(payload);
  if (!config.researchItems.length) {
    throw new AppError("至少选择一个调研方向", 400);
  }

  return repository.createTask({
    taskName: payload.taskName,
    sourceId: source.id,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
    databaseName: pickDatabaseName(source),
    schemaName: pickSchemaName(source),
    tableScope,
    config,
    selectedTables,
    status: payload.status || "active",
    description: payload.description || "",
    createdBy: user?.displayName || user?.username || "system"
  });
}

async function listResearchTasks(query = {}) {
  const sourceId = Number(query.sourceId || 0) || null;
  const status = ["active", "disabled"].includes(String(query.status || "")) ? String(query.status) : null;
  const keyword = String(query.keyword || "").trim();
  return repository.listTasks({ sourceId, status, keyword });
}

async function getResearchTask(taskId) {
  const task = await repository.getTaskById(taskId);
  if (!task) throw new AppError("数据调研任务不存在", 404);
  return task;
}

async function updateResearchTask(taskId, payload, user) {
  const current = await getResearchTask(taskId);
  const sourceId = payload.sourceId || current.sourceId;
  const source = await dataSourceRepository.getDataSourceById(sourceId);
  if (!source) throw new AppError("数据源不存在", 404);
  if (!supportsResearch(source)) throw new AppError(`当前仅支持 MySQL / PostgreSQL / Hive / FTP / Kafka 数据源调研，暂不支持 ${source.sourceType}`, 400);

  const nextConfig = buildResearchConfigFromPayload(payload, current.config || {});
  const nextTableScope = payload.tableScope || current.tableScope || "all";
  const nextSelectedTables = Object.prototype.hasOwnProperty.call(payload, "selectedTables")
    ? uniqueStrings(payload.selectedTables)
    : uniqueStrings(current.selectedTables);
  assertValidResearchScope(nextTableScope, nextSelectedTables);
  if (!nextConfig.researchItems.length) {
    throw new AppError("至少选择一个调研方向", 400);
  }

  return repository.updateTask(taskId, {
    taskName: payload.taskName || current.taskName,
    sourceId: source.id,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
    databaseName: pickDatabaseName(source),
    schemaName: pickSchemaName(source),
    tableScope: nextTableScope,
    config: nextConfig,
    selectedTables: nextSelectedTables,
    status: payload.status || current.status,
    description: Object.prototype.hasOwnProperty.call(payload, "description") ? payload.description || "" : current.description,
    updatedBy: user?.displayName || user?.username || "system"
  });
}

async function deleteResearchTask(taskId) {
  const task = await getResearchTask(taskId);
  if (await repository.hasActiveRunsByTaskId(taskId)) {
    throw new AppError("存在运行中的调研批次，暂不能删除任务", 400);
  }
  const deleted = await repository.deleteTask(task.id);
  if (!deleted) throw new AppError("数据调研任务不存在", 404);
  return { id: taskId };
}

async function createResearchTaskRun(taskId, user) {
  const task = await getResearchTask(taskId);
  if (task.status === "disabled") {
    throw new AppError("当前调研任务已停用，不能执行", 400);
  }
  const source = await dataSourceRepository.getDataSourceById(task.sourceId);
  if (!source) throw new AppError("数据源不存在", 404);
  if (!supportsResearch(source)) throw new AppError(`当前仅支持 MySQL / PostgreSQL / Hive / FTP / Kafka 数据源调研，暂不支持 ${source.sourceType}`, 400);
  const runNo = await repository.getNextRunNoByTaskId(taskId);
  const payload = {
    ...task.config,
    tableScope: task.tableScope,
    selectedTables: task.selectedTables,
  };
  return createResearchRunFromSource(source, payload, user, {
    taskId,
    runNo,
    runName: `${task.taskName} 第 ${runNo} 批`,
  });
}

async function listResearchTaskRuns(taskId) {
  await getResearchTask(taskId);
  return repository.listRunsByTaskId(taskId);
}

async function listResearchRuns(sourceId) {
  const source = await dataSourceRepository.getDataSourceById(sourceId);
  if (!source) throw new AppError("数据源不存在", 404);
  return repository.listRunsBySourceId(sourceId);
}

async function getResearchRun(runId) {
  const run = await repository.getRunById(runId);
  if (!run) throw new AppError("调研任务不存在", 404);
  return run;
}

async function listResearchLogs(runId) {
  await getResearchRun(runId);
  return repository.listLogs(runId);
}

async function getResearchReport(runId) {
  const run = await getResearchRun(runId);
  return run.report || null;
}

async function downloadResearchReportWord(runId) {
  const run = await getResearchRun(runId);
  if (!run.report) {
    throw new AppError("当前调研任务暂无可下载报告", 404);
  }
  const task = run.taskId ? await getResearchTask(run.taskId) : null;
  const buffer = await buildResearchReportWordBuffer(run.report);
  const taskName = task?.taskName || run.runName || run.sourceName || "data_source_research";
  const generatedAt = run.finishedAt || run.updatedAt || run.createdAt;
  return {
    fileName: `${sanitizeDownloadFileName(taskName)}_${formatDownloadDateTime(generatedAt)}.docx`,
    buffer,
  };
}

async function deleteResearchRun(runId) {
  const run = await getResearchRun(runId);
  if (["pending", "running"].includes(String(run.status || ""))) {
    throw new AppError("运行中的调研任务不支持删除，请等待完成后再删除", 400);
  }
  const deleted = await repository.deleteRun(runId);
  if (!deleted) throw new AppError("调研任务不存在", 404);
  return { id: runId };
}

async function terminateResearchRun(runId) {
  const run = await getResearchRun(runId);
  if (!["pending", "running"].includes(String(run.status || ""))) {
    throw new AppError("仅支持终止运行中的调研任务", 400);
  }

  const activeRun = getActiveResearchRun(runId);
  if (activeRun) {
    activeRun.cancelRequested = true;
    activeRun.controller.abort();
  }

  await markResearchRunCancelled(runId);
  return getResearchRun(runId);
}

function buildTableDiffKey(tableName, fieldName = "") {
  return `${String(tableName || "").trim()}${fieldName ? `.${String(fieldName || "").trim()}` : ""}`;
}

function toTableMap(report) {
  const map = new Map();
  for (const table of Array.isArray(report?.tables) ? report.tables : []) {
    if (table?.tableName) {
      map.set(String(table.tableName), table);
    }
  }
  return map;
}

function toFieldMap(table) {
  const fields = Array.isArray(table?.fieldProfiles) && table.fieldProfiles.length ? table.fieldProfiles : (table?.columns || []);
  const map = new Map();
  for (const field of Array.isArray(fields) ? fields : []) {
    if (field?.columnName) {
      map.set(String(field.columnName), field);
    }
  }
  return map;
}

function compareStringArrays(before = [], after = []) {
  const beforeSet = new Set((Array.isArray(before) ? before : []).map((item) => String(item || "").trim()).filter(Boolean));
  const afterSet = new Set((Array.isArray(after) ? after : []).map((item) => String(item || "").trim()).filter(Boolean));
  return {
    added: Array.from(afterSet).filter((item) => !beforeSet.has(item)),
    removed: Array.from(beforeSet).filter((item) => !afterSet.has(item)),
  };
}

function relationKey(relation) {
  return [
    relation?.fromTable,
    relation?.fromField,
    relation?.toTable,
    relation?.toField,
    relation?.relationType,
  ].map((item) => String(item || "").trim()).join("|");
}

function relationText(relation) {
  if (!relation) return "-";
  return `${relation.fromTable || "-"}.${relation.fromField || "-"} -> ${relation.toTable || "-"}.${relation.toField || "-"}（${relation.relationType || "-"}）`;
}

function getRecommendationList(report, key) {
  return uniqueStrings(report?.recommendations?.[key] || []);
}

function getGovernanceTaskTables(report) {
  return uniqueStrings((report?.insights?.governanceAdvice?.tableTasks || []).map((item) => item.tableName));
}

function getAnalysisThemeNames(report) {
  return uniqueStrings((report?.insights?.analysisAdvice?.analysisThemes || []).map((item) => item.theme));
}

function describeListChange(label, change) {
  const added = Array.isArray(change?.added) ? change.added : [];
  const removed = Array.isArray(change?.removed) ? change.removed : [];
  if (!added.length && !removed.length) return `${label}无明显变化。`;
  const parts = [];
  if (added.length) parts.push(`新增 ${added.slice(0, 8).join("、")}${added.length > 8 ? ` 等 ${added.length} 项` : ""}`);
  if (removed.length) parts.push(`减少 ${removed.slice(0, 8).join("、")}${removed.length > 8 ? ` 等 ${removed.length} 项` : ""}`);
  return `${label}${parts.join("；")}。`;
}

function summarizeChangedFields(baseTable, targetTable) {
  const baseFields = toFieldMap(baseTable);
  const targetFields = toFieldMap(targetTable);
  const added = [];
  const removed = [];
  const changed = [];
  for (const [fieldName, field] of targetFields.entries()) {
    if (!baseFields.has(fieldName)) {
      added.push(fieldName);
      continue;
    }
    const before = baseFields.get(fieldName);
    const changes = [];
    if (String(before.dataType || before.columnType || "") !== String(field.dataType || field.columnType || "")) {
      changes.push({ field: "dataType", before: before.dataType || before.columnType || "", after: field.dataType || field.columnType || "" });
    }
    if (Boolean(before.isPrimaryKey) !== Boolean(field.isPrimaryKey)) {
      changes.push({ field: "isPrimaryKey", before: Boolean(before.isPrimaryKey), after: Boolean(field.isPrimaryKey) });
    }
    if (before.isNullable !== undefined && field.isNullable !== undefined && Boolean(before.isNullable) !== Boolean(field.isNullable)) {
      changes.push({ field: "isNullable", before: Boolean(before.isNullable), after: Boolean(field.isNullable) });
    }
    if (Number.isFinite(Number(before.nullRate)) && Number.isFinite(Number(field.nullRate))) {
      const delta = Number((Number(field.nullRate) - Number(before.nullRate)).toFixed(6));
      if (Math.abs(delta) >= 0.05) {
        changes.push({ field: "nullRate", before: Number(before.nullRate), after: Number(field.nullRate), delta });
      }
    }
    if (changes.length) {
      changed.push({ columnName: fieldName, changes });
    }
  }
  for (const fieldName of baseFields.keys()) {
    if (!targetFields.has(fieldName)) {
      removed.push(fieldName);
    }
  }
  return { added, removed, changed };
}

function buildReportComparisonDiff(baseRun, targetRun) {
  const baseReport = baseRun.report || {};
  const targetReport = targetRun.report || {};
  const baseTables = toTableMap(baseReport);
  const targetTables = toTableMap(targetReport);
  const addedTables = [];
  const removedTables = [];
  const changedTables = [];

  for (const [tableName, table] of targetTables.entries()) {
    if (!baseTables.has(tableName)) {
      addedTables.push({ tableName, category: table.category || "", priority: table.priority || "", rowCount: table.rowCount ?? null });
      continue;
    }
    const before = baseTables.get(tableName);
    const tableChanges = [];
    if (String(before.category || "") !== String(table.category || "")) {
      tableChanges.push({ field: "category", before: before.category || "", after: table.category || "" });
    }
    if (String(before.priority || "") !== String(table.priority || "")) {
      tableChanges.push({ field: "priority", before: before.priority || "", after: table.priority || "" });
    }
    const beforeRowCount = before.rowCount === null || before.rowCount === undefined ? null : Number(before.rowCount);
    const afterRowCount = table.rowCount === null || table.rowCount === undefined ? null : Number(table.rowCount);
    if (Number.isFinite(beforeRowCount) && Number.isFinite(afterRowCount) && beforeRowCount !== afterRowCount) {
      tableChanges.push({
        field: "rowCount",
        before: beforeRowCount,
        after: afterRowCount,
        delta: afterRowCount - beforeRowCount,
        deltaRate: beforeRowCount === 0 ? null : Number(((afterRowCount - beforeRowCount) / beforeRowCount).toFixed(6)),
      });
    }
    const metadataIssueChanges = compareStringArrays(before.metadataIssues, table.metadataIssues);
    const fieldChanges = summarizeChangedFields(before, table);
    const highNullDelta = Number(table.quality?.highNullColumns || 0) - Number(before.quality?.highNullColumns || 0);
    if (tableChanges.length || metadataIssueChanges.added.length || metadataIssueChanges.removed.length || fieldChanges.added.length || fieldChanges.removed.length || fieldChanges.changed.length || highNullDelta !== 0) {
      changedTables.push({
        tableName,
        changes: tableChanges,
        metadataIssues: metadataIssueChanges,
        fields: fieldChanges,
        quality: { highNullColumnsDelta: highNullDelta },
      });
    }
  }
  for (const [tableName, table] of baseTables.entries()) {
    if (!targetTables.has(tableName)) {
      removedTables.push({ tableName, category: table.category || "", priority: table.priority || "", rowCount: table.rowCount ?? null });
    }
  }

  const baseRelations = Array.isArray(baseReport.tableRelationships?.relations) ? baseReport.tableRelationships.relations : [];
  const targetRelations = Array.isArray(targetReport.tableRelationships?.relations) ? targetReport.tableRelationships.relations : [];
  const baseRelationMap = new Map(baseRelations.map((relation) => [relationKey(relation), relation]));
  const targetRelationMap = new Map(targetRelations.map((relation) => [relationKey(relation), relation]));
  const addedRelations = Array.from(targetRelationMap.entries()).filter(([key]) => !baseRelationMap.has(key)).map(([, value]) => value);
  const removedRelations = Array.from(baseRelationMap.entries()).filter(([key]) => !targetRelationMap.has(key)).map(([, value]) => value);

  const classificationChangedTables = changedTables
    .filter((item) => item.changes.some((change) => ["category", "priority"].includes(change.field)))
    .map((item) => ({
      tableName: item.tableName,
      changes: item.changes.filter((change) => ["category", "priority"].includes(change.field)),
    }));
  const rowCountChangedTables = changedTables
    .map((item) => {
      const rowCountChange = item.changes.find((change) => change.field === "rowCount");
      return rowCountChange ? {
        tableName: item.tableName,
        before: rowCountChange.before,
        after: rowCountChange.after,
        delta: rowCountChange.delta,
        deltaRate: rowCountChange.deltaRate,
      } : null;
    })
    .filter(Boolean)
    .sort((left, right) => Math.abs(Number(right.delta || 0)) - Math.abs(Number(left.delta || 0)));
  const qualityChangedTables = changedTables
    .filter((item) => item.metadataIssues.added.length || item.metadataIssues.removed.length || item.quality.highNullColumnsDelta !== 0 || item.fields.changed.length)
    .map((item) => ({
      tableName: item.tableName,
      metadataIssues: item.metadataIssues,
      highNullColumnsDelta: item.quality.highNullColumnsDelta,
      changedFields: item.fields.changed.slice(0, 20),
    }));
  const baseGovernanceSuggestions = uniqueStrings([
    ...(baseReport.recommendations?.governanceSuggestions || []),
    ...(baseReport.insights?.governanceAdvice?.governanceSuggestions || []),
  ]);
  const targetGovernanceSuggestions = uniqueStrings([
    ...(targetReport.recommendations?.governanceSuggestions || []),
    ...(targetReport.insights?.governanceAdvice?.governanceSuggestions || []),
  ]);
  const baseAnalysisSuggestions = uniqueStrings([
    ...(baseReport.recommendations?.analysisSuggestions || []),
    ...(baseReport.insights?.analysisAdvice?.analysisSuggestions || []),
  ]);
  const targetAnalysisSuggestions = uniqueStrings([
    ...(targetReport.recommendations?.analysisSuggestions || []),
    ...(targetReport.insights?.analysisAdvice?.analysisSuggestions || []),
  ]);

  const baseTotalRows = Number(baseReport.overview?.totalRowCount || 0);
  const targetTotalRows = Number(targetReport.overview?.totalRowCount || 0);
  const summaryText = [
    `基准批次 ${baseRun.runNo || baseRun.id} 与对比批次 ${targetRun.runNo || targetRun.id}`,
    `新增表 ${addedTables.length} 张，移除表 ${removedTables.length} 张，变化表 ${changedTables.length} 张`,
    `表关系新增 ${addedRelations.length} 条，移除 ${removedRelations.length} 条`,
  ].join("；");

  return {
    source: targetReport.source || baseReport.source || {},
    task: {
      baseRunId: baseRun.id,
      targetRunId: targetRun.id,
      baseRunNo: baseRun.runNo,
      targetRunNo: targetRun.runNo,
    },
    overview: {
      baseTotalTables: Number(baseReport.overview?.totalTables || baseTables.size),
      targetTotalTables: Number(targetReport.overview?.totalTables || targetTables.size),
      tableDelta: targetTables.size - baseTables.size,
      baseTotalRowCount: baseTotalRows,
      targetTotalRowCount: targetTotalRows,
      rowCountDelta: targetTotalRows - baseTotalRows,
      rowCountDeltaRate: baseTotalRows === 0 ? null : Number(((targetTotalRows - baseTotalRows) / baseTotalRows).toFixed(6)),
    },
    tables: {
      added: addedTables,
      removed: removedTables,
      changed: changedTables.slice(0, 200),
    },
    relationships: {
      added: addedRelations.slice(0, 100),
      removed: removedRelations.slice(0, 100),
    },
    modules: {
      tableClassification: {
        addedTables,
        removedTables,
        changedTables: classificationChangedTables.slice(0, 100),
      },
      tableRelationship: {
        added: addedRelations.slice(0, 100),
        removed: removedRelations.slice(0, 100),
      },
      dataScale: {
        rowCountDelta: targetTotalRows - baseTotalRows,
        rowCountDeltaRate: baseTotalRows === 0 ? null : Number(((targetTotalRows - baseTotalRows) / baseTotalRows).toFixed(6)),
        changedTables: rowCountChangedTables.slice(0, 100),
      },
      dataQuality: {
        changedTables: qualityChangedTables.slice(0, 100),
        issueAddedCount: qualityChangedTables.reduce((sum, item) => sum + item.metadataIssues.added.length, 0),
        issueRemovedCount: qualityChangedTables.reduce((sum, item) => sum + item.metadataIssues.removed.length, 0),
        highNullColumnsDelta: qualityChangedTables.reduce((sum, item) => sum + Number(item.highNullColumnsDelta || 0), 0),
      },
      ingestionAdvice: {
        recommendedTables: compareStringArrays(getRecommendationList(baseReport, "recommendedTables"), getRecommendationList(targetReport, "recommendedTables")),
        deferredTables: compareStringArrays(getRecommendationList(baseReport, "deferredTables"), getRecommendationList(targetReport, "deferredTables")),
      },
      governanceAdvice: {
        suggestions: compareStringArrays(baseGovernanceSuggestions, targetGovernanceSuggestions),
        taskTables: compareStringArrays(getGovernanceTaskTables(baseReport), getGovernanceTaskTables(targetReport)),
      },
      analysisAdvice: {
        suggestions: compareStringArrays(baseAnalysisSuggestions, targetAnalysisSuggestions),
        themes: compareStringArrays(getAnalysisThemeNames(baseReport), getAnalysisThemeNames(targetReport)),
      },
    },
    summaryText,
  };
}

function buildRuleComparisonSummary(diff) {
  const modules = diff.modules || {};
  const tableClassification = modules.tableClassification || {};
  const tableRelationship = modules.tableRelationship || {};
  const dataScale = modules.dataScale || {};
  const dataQuality = modules.dataQuality || {};
  const ingestionAdvice = modules.ingestionAdvice || {};
  const governanceAdvice = modules.governanceAdvice || {};
  const analysisAdvice = modules.analysisAdvice || {};
  const risks = [];
  const suggestions = [];
  if (diff.tables.removed.length) {
    risks.push(`有 ${diff.tables.removed.length} 张表在新批次中消失，需要确认是否为权限、库表变更或调研范围变化。`);
  }
  const worseQualityTables = diff.tables.changed.filter((item) => item.metadataIssues.added.length || item.quality.highNullColumnsDelta > 0);
  if (worseQualityTables.length) {
    risks.push(`${worseQualityTables.length} 张表出现新增元数据问题或高空值字段增加。`);
    suggestions.push("优先复核新增元数据问题和高空值字段，必要时暂缓自动接入。");
  }
  if (diff.relationships.removed.length) {
    risks.push(`有 ${diff.relationships.removed.length} 条表关系不再稳定，可能影响下游建模和关联分析。`);
  }
  if (diff.tables.added.length) {
    suggestions.push("对新增表补充业务归属、主键和增量字段确认后再纳入接入任务。");
  }
  if (!risks.length) {
    risks.push("未发现明显恶化风险。");
  }
  if (!suggestions.length) {
    suggestions.push("建议按当前调研结果持续观察下一批次变化。");
  }
  const tableClassificationChanges = [
    `新增表 ${diff.tables.added.length} 张，移除表 ${diff.tables.removed.length} 张，分类或优先级变化 ${tableClassification.changedTables?.length || 0} 张。`,
    ...(tableClassification.changedTables || []).slice(0, 8).map((item) => {
      const text = item.changes.map((change) => `${change.field === "category" ? "分类" : "优先级"}由 ${change.before || "-"} 变为 ${change.after || "-"}`).join("；");
      return `${item.tableName}：${text}`;
    }),
  ];
  const tableRelationshipChanges = [
    `表关系新增 ${tableRelationship.added?.length ?? diff.relationships.added.length} 条，移除 ${tableRelationship.removed?.length ?? diff.relationships.removed.length} 条。`,
    ...(tableRelationship.added || []).slice(0, 6).map((item) => `新增关系：${relationText(item)}`),
    ...(tableRelationship.removed || []).slice(0, 6).map((item) => `移除关系：${relationText(item)}`),
  ];
  const dataScaleChanges = [
    `累计行数变化 ${dataScale.rowCountDelta ?? diff.overview.rowCountDelta}，表数量变化 ${diff.overview.tableDelta}。`,
    ...(dataScale.changedTables || []).slice(0, 8).map((item) => `${item.tableName} 行数由 ${item.before} 变为 ${item.after}，变化 ${item.delta}`),
  ];
  const dataQualityChanges = [
    `质量问题新增 ${dataQuality.issueAddedCount || 0} 项，减少 ${dataQuality.issueRemovedCount || 0} 项，高空值字段净变化 ${dataQuality.highNullColumnsDelta || 0}。`,
    ...worseQualityTables.slice(0, 10).map((item) => `${item.tableName} 新增问题 ${item.metadataIssues.added.join("、") || "无"}，高空值字段变化 ${item.quality.highNullColumnsDelta}`),
  ];
  const ingestionAdviceChanges = [
    describeListChange("优先接入表", ingestionAdvice.recommendedTables),
    describeListChange("建议暂缓表", ingestionAdvice.deferredTables),
  ];
  const governanceAdviceChanges = [
    describeListChange("治理建议", governanceAdvice.suggestions),
    describeListChange("治理任务表", governanceAdvice.taskTables),
  ];
  const analysisAdviceChanges = [
    describeListChange("分析主题", analysisAdvice.themes),
    describeListChange("分析建议", analysisAdvice.suggestions),
  ];
  return {
    summary: diff.summaryText,
    tableClassificationChanges,
    tableRelationshipChanges,
    dataScaleChanges,
    dataQualityChanges,
    ingestionAdviceChanges,
    governanceAdviceChanges,
    analysisAdviceChanges,
    qualityChanges: dataQualityChanges,
    schemaChanges: [...tableClassificationChanges, ...dataScaleChanges],
    relationshipChanges: tableRelationshipChanges,
    risks,
    suggestions,
    confidence: 0.74,
  };
}

async function runAiReportComparison(task, baseRun, targetRun, diff) {
  const fallback = buildRuleComparisonSummary(diff);
  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
  if (!aiConfig?.defaultModelProviderId) {
    return fallback;
  }

  let provider = null;
  try {
    provider = await resolveResearchProvider(aiConfig);
  } catch {
    return fallback;
  }

  try {
    const messages = ensureJsonObjectPrompt([
      { role: "system", content: `${REPORT_COMPARISON_PROMPT}\n\n${aiConfig.systemPrompt ? `平台补充要求：${aiConfig.systemPrompt}` : ""}\n\n当前任务为同一调研任务的报告批次差异对比，只输出 JSON 对象。` },
      {
        role: "user",
        content: JSON.stringify({
          task: {
            taskName: task.taskName,
            sourceName: task.sourceName,
            baseRun: { id: baseRun.id, runNo: baseRun.runNo, createdAt: baseRun.createdAt },
            targetRun: { id: targetRun.id, runNo: targetRun.runNo, createdAt: targetRun.createdAt },
          },
          diff,
        }, null, 2),
      }
    ], provider);
    const completion = await modelProviderService.generateChatCompletion(provider, messages, {
      temperature: aiConfig.temperature ?? 0.1,
      maxTokens: Number(aiConfig.maxTokens || 1600),
      responseFormat: { type: "json_object" }
    });
    const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
    const pickStringArray = (key, fallbackList = []) => Array.isArray(parsed[key])
      ? parsed[key].map(String).slice(0, 20)
      : fallbackList;
    const tableClassificationChanges = pickStringArray("tableClassificationChanges", fallback.tableClassificationChanges);
    const tableRelationshipChanges = pickStringArray("tableRelationshipChanges", fallback.tableRelationshipChanges || fallback.relationshipChanges);
    const dataScaleChanges = pickStringArray("dataScaleChanges", fallback.dataScaleChanges);
    const dataQualityChanges = pickStringArray("dataQualityChanges", fallback.dataQualityChanges || fallback.qualityChanges);
    const ingestionAdviceChanges = pickStringArray("ingestionAdviceChanges", fallback.ingestionAdviceChanges);
    const governanceAdviceChanges = pickStringArray("governanceAdviceChanges", fallback.governanceAdviceChanges);
    const analysisAdviceChanges = pickStringArray("analysisAdviceChanges", fallback.analysisAdviceChanges);
    return {
      summary: normalizeSummaryText(parsed.summary || fallback.summary, 1200),
      tableClassificationChanges,
      tableRelationshipChanges,
      dataScaleChanges,
      dataQualityChanges,
      ingestionAdviceChanges,
      governanceAdviceChanges,
      analysisAdviceChanges,
      qualityChanges: pickStringArray("qualityChanges", dataQualityChanges),
      schemaChanges: pickStringArray("schemaChanges", [...tableClassificationChanges, ...dataScaleChanges]),
      relationshipChanges: pickStringArray("relationshipChanges", tableRelationshipChanges),
      risks: pickStringArray("risks", fallback.risks),
      suggestions: pickStringArray("suggestions", fallback.suggestions),
      confidence: clampConfidence(parsed.confidence, fallback.confidence),
    };
  } catch {
    return fallback;
  }
}

async function compareResearchReports(taskId, payload, user) {
  const task = await getResearchTask(taskId);
  if (payload.baseRunId === payload.targetRunId) {
    throw new AppError("请选择两个不同的报告批次进行对比", 400);
  }
  const baseRun = await getResearchRun(payload.baseRunId);
  const targetRun = await getResearchRun(payload.targetRunId);
  if (baseRun.taskId !== task.id || targetRun.taskId !== task.id) {
    throw new AppError("仅支持对比同一个调研任务下的报告批次", 400);
  }
  if (!baseRun.report || !targetRun.report) {
    throw new AppError("两个批次都需要已生成调研报告", 400);
  }

  let comparison = await repository.createComparison({
    taskId: task.id,
    baseRunId: baseRun.id,
    targetRunId: targetRun.id,
    status: "running",
    createdBy: user?.displayName || user?.username || "system"
  });
  try {
    const diff = buildReportComparisonDiff(baseRun, targetRun);
    const aiSummary = await runAiReportComparison(task, baseRun, targetRun, diff);
    comparison = await repository.updateComparison(comparison.id, {
      status: "succeeded",
      diff,
      aiSummary,
      summaryText: aiSummary.summary || diff.summaryText,
      errorMessage: null
    });
    return comparison;
  } catch (error) {
    comparison = await repository.updateComparison(comparison.id, {
      status: "failed",
      errorMessage: error.message || "报告对比失败"
    });
    throw new AppError(comparison.errorMessage, 500);
  }
}

async function listResearchComparisons(taskId) {
  await getResearchTask(taskId);
  return repository.listComparisonsByTaskId(taskId);
}

async function getResearchComparison(comparisonId) {
  const comparison = await repository.getComparisonById(comparisonId);
  if (!comparison) throw new AppError("调研报告对比记录不存在", 404);
  return comparison;
}

async function reconcileRunningResearchRunsAfterRestart() {
  return repository.reconcileLatestRunningResearchRunsAfterRestart();
}

async function executeResearchRun(runId) {
  const activeRun = registerActiveResearchRun(runId);
  try {
  const run = await getResearchRun(runId);
  const source = await dataSourceRepository.getDataSourceById(run.sourceId);
  if (!source) throw new AppError("调研对应数据源不存在", 404);

  const config = run.config || {};
  assertResearchRunNotCancelled(runId);
  await setRunState(runId, {
    status: "running",
    progressPercent: 5,
    currentStage: "connectivity_check",
    startedAt: new Date(),
    errorMessage: null
  }, { stageKey: "connectivity_check", message: "开始校验数据源连通性" });

  const connectivity = await testDatabaseConnection(source.connectionConfig, source.sourceType);
  assertResearchRunNotCancelled(runId);
  if (!connectivity.success) {
    throw new AppError(connectivity.error || connectivity.message || "数据源连通性校验失败", 400);
  }
  await log(runId, "connectivity_check", connectivity.message || "数据源连通性校验通过");

  await setRunState(runId, {
    progressPercent: 10,
    currentStage: "load_tables"
  }, { stageKey: "load_tables", message: "开始读取数据源表清单" });

  const allTables = await previewService.listObjects(source);
  assertResearchRunNotCancelled(runId);
  const selectedTables = run.tableScope === "manual"
    ? allTables.filter((item) => run.selectedTables.includes(item.tableName))
    : allTables.slice(0, Number(config.maxTables || 50));
  if (!selectedTables.length) {
    throw new AppError(`当前没有可调研的目标${researchObjectLabel(source)}`, 400);
  }

  await log(runId, "load_tables", `已确定 ${selectedTables.length} 个目标${researchObjectLabel(source)}进入调研`, {
    detail: {
      tableScope: run.tableScope,
      rowCountMode: config.rowCountMode || "estimated",
      tableNames: selectedTables.map((item) => item.tableName),
      tables: selectedTables.map((item) => ({
        tableName: item.tableName,
        tableComment: item.tableComment || ""
      }))
    }
  });

  await setRunState(runId, {
    progressPercent: 15,
    currentStage: "profile_tables"
  }, { stageKey: "profile_tables", message: "开始进行表级与字段级调研" });

  const progress = { count: 0 };
  const totalTables = selectedTables.length;
  const tableProfiles = await runWithConcurrency(selectedTables, Number(config.metadataConcurrency || 3), async (table) => {
    assertResearchRunNotCancelled(runId);
    const profile = await previewService.inspectObjectProfile(source, table.tableName, {
      sampleSize: Number(config.sampleSize || 50),
      tableInfo: table
    });
    assertResearchRunNotCancelled(runId);

    let rowCount = null;
    let rowCountMode = String(config.rowCountMode || "estimated");
    if (hasResearchItem(config, "data_scale") && !isObjectPreviewSource(source)) {
      try {
        rowCount = rowCountMode === "exact"
          ? await metadataService.countRows(source, table.tableName)
          : await metadataService.estimateRows(source, table.tableName);
      } catch (error) {
        rowCount = await metadataService.estimateRows(source, table.tableName).catch(() => null);
        rowCountMode = "estimated";
        if (!isResearchRunCancellationRequested(runId)) {
        await log(runId, "data_scale", `表 ${table.tableName} 行数统计失败，已回退为估算或空值`, {
          logLevel: "warn",
          detail: { error: error.message || "unknown" }
        });
        }
      }
    } else if (isObjectPreviewSource(source)) {
      rowCount = Array.isArray(profile.sampleRows) ? profile.sampleRows.length : null;
      rowCountMode = "sample";
    }

    assertResearchRunNotCancelled(runId);
    const fieldProfiles = buildFieldProfiles(profile.columns || [], profile.sampleRows || []);
    const fieldSummary = buildFieldSummary(fieldProfiles);
    const metrics = computeSampleMetrics(profile.sampleRows || [], profile.columns || []);
    const ruleDecision = classifyTableByRules(profile, metrics, rowCount, fieldSummary);
    const incrementalColumn = detectIncrementalColumn(profile.columns || []);
    progress.count += 1;

    if (!isResearchRunCancellationRequested(runId)) {
    await repository.updateRun(runId, {
      progressPercent: Math.min(70, 15 + Math.round((progress.count / totalTables) * 55)),
      currentStage: "profile_tables"
    });
    await log(runId, "profile_tables", `已完成 ${progress.count}/${totalTables} 张表调研`, {
      detail: {
        tableName: table.tableName,
        tableComment: profile.tableComment || "",
        rowCountMode
      }
    });
    }

    return {
      tableName: table.tableName,
      tableComment: profile.tableComment || "",
      rowCountMode,
      rowCount,
      columnCount: Array.isArray(profile.columns) ? profile.columns.length : 0,
      sampleCount: metrics.sampleCount,
      category: ruleDecision.category,
      priority: ruleDecision.priority,
      confidence: ruleDecision.confidence,
      evidence: ruleDecision.evidence,
      risks: ruleDecision.risks,
      suggestedMode: ruleDecision.suggestedMode,
      incrementalColumn,
      metadataIssues: buildMetadataIssues(profile, fieldSummary, metrics),
      quality: { sampleCount: metrics.sampleCount, highNullColumns: metrics.highNullColumns, nullRates: metrics.nullRates },
      indexes: Array.isArray(profile.indexes) ? profile.indexes.length : 0,
      constraints: Array.isArray(profile.constraints) ? profile.constraints.length : 0,
      constraintDetails: Array.isArray(profile.constraints) ? profile.constraints : [],
      fieldSummary,
      fieldProfiles,
      columns: (profile.columns || []).map((column) => ({
        columnName: column.columnName,
        dataType: column.dataType,
        columnType: column.columnType,
        ordinalPosition: Number(column.ordinalPosition || 0),
        isNullable: Boolean(column.isNullable),
        isPrimaryKey: Boolean(column.isPrimaryKey),
        columnComment: column.columnComment || ""
      }))
    };
  });

  assertResearchRunNotCancelled(runId);
  const orderedProfiles = selectedTables.map((table) => tableProfiles.find((item) => item.tableName === table.tableName)).filter(Boolean);
  await repository.replaceTableProfiles(runId, orderedProfiles);
  await setRunState(runId, { progressPercent: 75, currentStage: "persist_profiles" }, { stageKey: "persist_profiles", message: "表画像和字段画像已落库" });

  let aiDecision = null;
  let aiBatches = [];
  if (hasResearchItem(config, "table_classification")) {
    await setRunState(runId, { progressPercent: 80, currentStage: "ai_analysis" }, { stageKey: "ai_analysis", message: "开始进行分批模型分析" });
    assertResearchRunNotCancelled(runId);
    const aiResult = await runAiResearch(runId, source, config, orderedProfiles, activeRun.controller.signal);
    aiDecision = aiResult.aiDecision;
    aiBatches = aiResult.batches || [];
  }

  let tableRelationships = null;
  if (hasResearchItem(config, "table_relationship")) {
    await setRunState(runId, { progressPercent: 90, currentStage: "table_relationship" }, { stageKey: "table_relationship", message: "开始进行表关系调研" });
    assertResearchRunNotCancelled(runId);
    const relationshipResult = await analyzeTableRelationships(runId, source, { ...config, tableScope: run.tableScope }, orderedProfiles, activeRun.controller.signal);
    tableRelationships = relationshipResult.report;
    if (relationshipResult.batch) {
      aiBatches = [...aiBatches, relationshipResult.batch];
    }
  }
  assertResearchRunNotCancelled(runId);
  await repository.replaceAiBatches(runId, aiBatches);

  const mergedProfiles = mergeAiDecision(orderedProfiles, aiDecision);
  const stats = summarizeTables(mergedProfiles);
  const moduleInsightResult = await runModuleInsights(runId, source, config, mergedProfiles, tableRelationships, activeRun.controller.signal);
  if (moduleInsightResult.batches.length) {
    aiBatches = [...aiBatches, ...moduleInsightResult.batches];
    await repository.replaceAiBatches(runId, aiBatches);
  }
  const moduleInsights = moduleInsightResult.insights;
  const recommendedTables = uniqueStrings((aiDecision?.recommendedTables || [])
    .concat(moduleInsights.ingestionAdvice?.recommendedTables || [])
    .concat(mergedProfiles.filter((item) => item.priority === "high" && item.category === "business").map((item) => item.tableName)));
  const deferredTables = uniqueStrings((aiDecision?.deferredTables || [])
    .concat(moduleInsights.ingestionAdvice?.deferredTables || [])
    .concat(mergedProfiles.filter((item) => ["low_value", "temporary", "log"].includes(item.category)).map((item) => item.tableName)));
  const report = {
    source: { id: source.id, sourceName: source.sourceName, sourceCode: source.sourceCode, sourceType: source.sourceType, databaseName: pickDatabaseName(source), schemaName: pickSchemaName(source) },
    run: { id: runId, runName: run.runName, createdAt: run.createdAt, startedAt: new Date().toISOString() },
    config: { ...config, tableScope: run.tableScope, selectedTables: run.selectedTables },
    overview: { totalTables: stats.totalTables, totalRowCount: stats.totalRowCount, categoryStats: stats.categoryStats, summary: aiDecision?.summary || buildSummaryText(source, mergedProfiles, recommendedTables, deferredTables) },
    analysisBatches: aiBatches.map((item) => ({ stageKey: item.stageKey, batchNo: item.batchNo, batchSize: item.batchSize, status: item.status, durationMs: item.durationMs || null, errorMessage: item.errorMessage || null })),
    ...(tableRelationships ? { tableRelationships } : {}),
    insights: moduleInsights,
    tables: mergedProfiles,
    recommendations: {
      recommendedTables,
      deferredTables,
      governanceSuggestions: uniqueStrings([...(aiDecision?.governanceSuggestions || []), ...(moduleInsights.governanceAdvice?.governanceSuggestions || []), ...buildGovernanceSuggestions(mergedProfiles)]),
      ingestionSuggestions: uniqueStrings([...(aiDecision?.ingestionSuggestions || []), ...(moduleInsights.ingestionAdvice?.ingestionSuggestions || []), ...buildIngestionSuggestions(mergedProfiles)]),
      analysisSuggestions: uniqueStrings(moduleInsights.analysisAdvice?.analysisSuggestions || [])
    }
  };

  const summaryText = normalizeSummaryText(report.overview.summary);

  const completedRun = await setRunState(runId, {
    status: "succeeded",
    progressPercent: 100,
    currentStage: "completed",
    summaryText,
    report,
    finishedAt: new Date()
  }, { stageKey: "completed", message: "调研报告已生成" });
  if (run.taskId) {
    await repository.updateTask(run.taskId, {
      lastRunId: runId,
      lastRunStatus: completedRun.status,
      lastRunAt: completedRun.finishedAt || new Date()
    });
  }
  } finally {
    unregisterActiveResearchRun(runId);
  }
}

module.exports = {
  createResearchTask,
  listResearchTasks,
  getResearchTask,
  updateResearchTask,
  deleteResearchTask,
  createResearchTaskRun,
  listResearchTaskRuns,
  compareResearchReports,
  listResearchComparisons,
  getResearchComparison,
  createResearchRun,
  listResearchRuns,
  getResearchRun,
  listResearchLogs,
  getResearchReport,
  downloadResearchReportWord,
  deleteResearchRun,
  terminateResearchRun,
  reconcileRunningResearchRunsAfterRestart
};

