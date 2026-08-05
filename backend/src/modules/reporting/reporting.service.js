const mysql = require("mysql2/promise");
const crypto = require("crypto");
const { Parser } = require("node-sql-parser");
const AppError = require("../../common/errors/app-error");
const metadataService = require("../data-sources/data-source.metadata");
const modelProviderService = require("../model-providers/model-provider.service");
const { testDatabaseConnection } = require("../data-sources/data-source.test-connection");
const { createPostgresLikeClient } = require("../../common/utils/db-client");
const { resolveDatasourceConnection } = require("../../common/utils/datasource-dialect");
const { getAdapter } = require("../data-development/adapters");
const { getManagedBinding } = require("../../common/utils/managed-jdbc-runtime");
const repository = require("./reporting.repository");
const reportingAiConfigService = require("./reporting-ai-config.service");
const { BUILTIN_THEME_TEMPLATES } = require("./reporting.theme-presets");

const sqlParser = new Parser();
const AI_ANALYSIS_SUGGESTION_SCENE_CODE = "chart_analysis_suggestion";
const AI_SQL_PLAN_SCENE_CODE = "chart_sql_plan";
const AI_SQL_REVISION_SCENE_CODE = "chart_sql_revision";
const AI_CHART_RECOMMENDATION_SCENE_CODE = "chart_recommendation";
const AI_CHART_FIELD_MAP_SCENE_CODE = "chart_field_mapping";
const MAX_AI_AVAILABLE_TABLES = 80;
const MAX_AI_SCHEMA_TABLES = 5;
const MAX_AI_SELECTED_TABLES = 5;
const MAX_AI_TABLE_SAMPLE_ROWS = 50;
const MAX_AI_TABLE_SAMPLE_VALUE_LENGTH = 100;
const MAX_AI_SAMPLE_ROWS = 100;
const MAX_AI_QUERY_LIMIT = 100;
const AI_QUERY_TIMEOUT_MS = 30000;
const AI_SUPPORTED_CHART_FAMILIES = [
  "bar",
  "horizontalBar",
  "line",
  "area",
  "pie",
  "radar",
  "combo",
  "scatterBubble",
  "heatmap",
  "map",
  "treemap",
  "sankey",
  "gauge",
  "funnel",
  "wordCloud",
];

function normalizeText(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );
}

function resolvePublishAllowedUsernames(publishConfig = {}) {
  const allowedUsernames = uniqueStrings(publishConfig.allowedUsernames);
  if (allowedUsernames.length) {
    return allowedUsernames;
  }
  const allowedUsername = normalizeText(publishConfig.allowedUsername);
  return allowedUsername ? [allowedUsername] : [];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeChartFamily(value = "") {
  const normalized = String(value || "").trim();
  const lower = normalized.toLowerCase();
  if (!lower) return "";
  if (lower.includes("wordcloud") || lower.includes("word cloud") || lower.includes("词云")) return "wordCloud";
  if (["horizontalbar", "horizontal_bar", "bar_horizontal"].includes(lower) || lower.includes("horizontal") || lower.includes("条形")) return "horizontalBar";
  if (["scatterbubble", "scatter_bubble"].includes(lower) || lower.includes("scatter") || lower.includes("bubble") || lower.includes("散点") || lower.includes("气泡")) return "scatterBubble";
  if (lower.includes("combo") || lower.includes("组合")) return "combo";
  if (lower.includes("sankey") || lower.includes("桑基")) return "sankey";
  if (lower.includes("treemap") || lower.includes("tree") || lower.includes("树图")) return "treemap";
  if (lower.includes("heat") || lower.includes("热力")) return "heatmap";
  if (lower.includes("map") || lower.includes("地图")) return "map";
  if (lower.includes("radar") || lower.includes("雷达")) return "radar";
  if (lower.includes("gauge") || lower.includes("仪表")) return "gauge";
  if (lower.includes("funnel") || lower.includes("漏斗")) return "funnel";
  if (lower.includes("area") || lower.includes("面积")) return "area";
  if (lower.includes("pie") || lower.includes("rose") || lower.includes("饼") || lower.includes("环形") || lower.includes("玫瑰")) return "pie";
  if (lower.includes("line") || lower.includes("折线")) return "line";
  if (lower.includes("bar") || lower.includes("column") || lower.includes("柱")) return "bar";
  return normalized;
}

function normalizeChartAssetFamily(asset = null) {
  if (!asset) return "";
  return normalizeChartFamily(
    asset.chartFamily
    || asset.config?.chartFamily
    || asset.chartCode
    || asset.chartName
    || asset.category
  );
}

function buildProviderSummary(provider) {
  return provider ? {
    id: provider.id,
    configName: provider.configName,
    providerType: provider.providerType,
    modelName: provider.modelName,
    modelVersion: provider.modelVersion || null,
  } : null;
}

async function recordReportingAiRun(payload = {}) {
  try {
    return await repository.createReportingAiRun(payload);
  } catch (error) {
    console.warn("[reporting-ai] failed to record ai run", error.message || error);
    return null;
  }
}

function renderPromptTemplate(template = "", variables = {}) {
  const source = String(template || "");
  if (!source) return "";
  return source.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = variables[key];
    if (value === null || value === undefined) return "";
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  });
}

function buildShareToken() {
  return crypto.randomBytes(16).toString("hex");
}

function sanitizeSqlText(sql = "") {
  return String(sql || "").replace(/;\s*$/g, "").trim();
}

function buildAiSqlDialectRules(dialect) {
  const normalizedDialect = String(dialect || "mysql").trim().toLowerCase();
  const rules = [
    `必须严格输出 ${normalizedDialect || "mysql"} 方言 SQL，不允许混用其他数据库的函数、类型转换、分页、日期或字符串语法。`,
    "如果字段类型不确定，优先使用更稳妥、兼容当前方言的显式 CAST/COALESCE/日期函数写法。",
  ];
  if (normalizedDialect === "postgresql" || normalizedDialect === "gaussdb") {
    rules.push(
      "PostgreSQL/GaussDB 示例: 日期聚合优先使用 DATE_TRUNC 或 EXTRACT，格式化优先使用 TO_CHAR，类型转换可使用 CAST(...) 或 ::type，字符串匹配可使用 ILIKE。",
      "不要使用 MySQL 专属语法，例如 DATE_FORMAT、STR_TO_DATE、IFNULL、TIMESTAMPDIFF、LIMIT offset,count。"
    );
    return rules;
  }
  if (normalizedDialect === "oracle") {
    rules.push(
      "Oracle 示例: 日期格式化使用 TO_CHAR，日期解析使用 TO_DATE/TO_TIMESTAMP，空值处理使用 COALESCE/NVL，随机排序使用 DBMS_RANDOM.VALUE，限制行数使用 FETCH FIRST 或 ROWNUM。",
      "不要使用 MySQL 专属语法，例如反引号、DATE_FORMAT、STR_TO_DATE、IFNULL、LIMIT。"
    );
    return rules;
  }
  if (normalizedDialect === "dm") {
    rules.push(
      "达梦数据库示例: 标识符使用双引号，日期格式化使用 TO_CHAR，限制行数使用 OFFSET ... FETCH 或 FETCH FIRST。",
      "不要使用 MySQL 专属语法，例如反引号、LIMIT offset,count。"
    );
    return rules;
  }
  rules.push(
    "MySQL 示例: 日期格式化优先使用 DATE_FORMAT，日期解析优先使用 STR_TO_DATE，空值处理优先使用 IFNULL 或 COALESCE，时间差优先使用 TIMESTAMPDIFF。",
    "不要使用 PostgreSQL 专属语法，例如 ::type、ILIKE、DATE_TRUNC、TO_CHAR、OFFSET ... FETCH。"
  );
  return rules;
}

function buildAiSqlAutoRevisionInstruction(dialect, reason = "") {
  const normalizedReason = normalizeText(reason);
  return [
    `请严格按照当前数据源的 ${dialect} 方言修复 SQL。`,
    "保留原始统计意图，只修正语法、函数、类型转换、表字段引用、别名、聚合、排序、分页或执行计划问题。",
    normalizedReason ? `已知问题: ${normalizedReason}` : "",
  ].filter(Boolean).join(" ");
}

function createAiSqlValidationResult() {
  return {
    valid: false,
    syntaxValid: false,
    objectValid: false,
    explainValid: false,
    messages: [],
  };
}

function decorateAiSqlResultWithAutoCorrection(result, autoCorrection = {}) {
  if (!result) return result;
  const messages = uniqueStrings([
    ...(result.validation?.messages || []),
    ...asArray(autoCorrection.messages),
  ]);
  return {
    ...result,
    summary: autoCorrection.summary || result.summary,
    validation: result.validation ? {
      ...result.validation,
      messages,
    } : result.validation,
    autoCorrection: {
      attempted: Boolean(autoCorrection.attempted),
      applied: Boolean(autoCorrection.applied),
      reason: normalizeText(autoCorrection.reason),
      originalSql: sanitizeSqlText(autoCorrection.originalSql),
      revisedSql: sanitizeSqlText(autoCorrection.revisedSql || result.generatedSql),
      messages,
    },
  };
}

function buildAiQueryAutoCorrection(autoCorrection = {}, governance = {}) {
  const messages = uniqueStrings([
    ...(governance.messages || []),
    ...asArray(autoCorrection.messages),
  ]);
  return {
    attempted: Boolean(autoCorrection.attempted),
    applied: Boolean(autoCorrection.applied),
    reason: normalizeText(autoCorrection.reason),
    originalSql: sanitizeSqlText(autoCorrection.originalSql),
    revisedSql: sanitizeSqlText(autoCorrection.revisedSql),
    messages,
  };
}

function buildPreviewSql(sql = "", limit, dialect = "mysql") {
  const normalized = sanitizeSqlText(sql);
  if (!normalized) {
    throw new AppError("SQL 不能为空", 400);
  }
  if (!/^\s*(select|with)\b/i.test(normalized)) {
    throw new AppError("仅支持查询类 SQL 预览", 400);
  }
  if (/\blimit\s+\d+(\s*,\s*\d+)?(\s+offset\s+\d+)?\s*$/i.test(normalized) || /\bfetch\s+first\s+\d+\s+rows\s+only\s*$/i.test(normalized) || /\brownum\b/i.test(normalized)) {
    return normalized;
  }
  const resolvedLimit = Number(limit);
  if (!Number.isFinite(resolvedLimit) || resolvedLimit <= 0) {
    return normalized;
  }
  const safeLimit = Math.max(1, Math.min(100, Math.floor(resolvedLimit)));
  if (dialect === "oracle") return `SELECT * FROM (${normalized}) WHERE ROWNUM <= ${safeLimit}`;
  if (dialect === "dm") return `${normalized} FETCH FIRST ${safeLimit} ROWS ONLY`;
  return `${normalized} LIMIT ${safeLimit}`;
}

function buildAiGovernedPreviewSql(sql = "", limit = MAX_AI_SAMPLE_ROWS) {
  return buildPreviewSql(sql, Math.max(1, Math.min(MAX_AI_QUERY_LIMIT, Number(limit || MAX_AI_SAMPLE_ROWS) || MAX_AI_SAMPLE_ROWS)));
}

function resolveParserDialect(dialect) {
  const normalized = String(dialect || "").trim().toLowerCase();
  if (normalized === "postgresql" || normalized === "gaussdb") return "PostgreSQL";
  if (normalized === "oracle") return "MySQL";
  if (normalized === "dm") return "PostgreSQL";
  return "MySQL";
}

function hasUnsafeSqlKeyword(sql) {
  return /\b(insert|update|delete|drop|alter|truncate|create|replace|merge|call|grant|revoke|load|outfile|infile|execute|exec)\b/i.test(sql);
}

function hasSelectStar(astNode) {
  if (!astNode || typeof astNode !== "object") return false;
  if (Array.isArray(astNode.columns) && astNode.columns.some((column) => column?.expr?.type === "column_ref" && column.expr.column === "*")) {
    return true;
  }
  const nextNodes = [];
  if (Array.isArray(astNode.with)) {
    astNode.with.forEach((item) => {
      if (item?.stmt) nextNodes.push(item.stmt.ast || item.stmt);
    });
  }
  if (Array.isArray(astNode.from)) {
    astNode.from.forEach((item) => {
      if (item?.expr?.ast) nextNodes.push(item.expr.ast);
    });
  }
  return nextNodes.some(hasSelectStar);
}

function extractSqlTables(sql, dialect) {
  try {
    return uniqueStrings(
      sqlParser.tableList(sql, { database: resolveParserDialect(dialect) })
        .map((item) => {
          const [, schemaName, tableName] = String(item || "").split("::");
          return schemaName && schemaName !== "null" ? `${schemaName}.${tableName}` : tableName;
        })
    );
  } catch {
    return [];
  }
}

function extractCteNames(sql, dialect) {
  try {
    const ast = sqlParser.astify(sql, { database: resolveParserDialect(dialect) });
    const statement = Array.isArray(ast) ? ast[0] : ast;
    return new Set(
      asArray(statement?.with)
        .map((item) => normalizeTableNameForMatch(item?.name?.value || item?.name))
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

function normalizeTableNameForMatch(value = "") {
  return String(value || "")
    .replace(/[`"]/g, "")
    .trim()
    .toLowerCase();
}

function tableExistsInAvailableTables(tableName, availableTables = []) {
  const normalized = normalizeTableNameForMatch(tableName);
  if (!normalized) return false;
  return availableTables.some((item) => {
    const candidate = normalizeTableNameForMatch(item.tableName || item.name || item);
    return candidate === normalized || candidate.endsWith(`.${normalized}`) || normalized.endsWith(`.${candidate}`);
  });
}

function tableNameMatchesSelection(tableName, selectedTable) {
  const left = normalizeTableNameForMatch(tableName);
  const right = normalizeTableNameForMatch(selectedTable);
  if (!left || !right) return false;
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

function ensureSafeReportAiSql(sql, dialect = "mysql", options = {}) {
  const normalized = sanitizeSqlText(sql);
  if (!normalized) {
    throw new AppError("SQL 不能为空", 400);
  }
  if (!/^\s*(select|with)\b/i.test(normalized)) {
    throw new AppError("仅允许执行只读查询 SQL", 400);
  }
  if (/[;]\s*\S/.test(normalized) || (normalized.match(/;/g) || []).length > 1) {
    throw new AppError("仅允许执行单条查询 SQL", 400);
  }
  if (hasUnsafeSqlKeyword(normalized)) {
    throw new AppError("SQL 包含非只读或高风险关键字，已阻止执行", 400);
  }

  let ast;
  try {
    ast = sqlParser.astify(normalized.replace(/\?/g, "'x'"), { database: resolveParserDialect(dialect) });
  } catch (error) {
    throw new AppError(`SQL 语法校验失败: ${error.message || "未知错误"}`, 400);
  }
  const astList = Array.isArray(ast) ? ast : [ast];
  if (astList.length !== 1 || !astList.every((item) => item?.type === "select")) {
    throw new AppError("仅允许执行单条只读 SELECT 查询", 400);
  }
  if (options.disallowSelectStar !== false && astList.some(hasSelectStar)) {
    throw new AppError("AI 图表查询不允许 SELECT *，请明确选择维度和指标字段", 400);
  }

  return normalized;
}

function guessFieldDataTypeFromValue(value) {
  if (value === null || value === undefined || value === "") return "string";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  const text = String(value).trim();
  if (/^-?\d+$/.test(text)) return "integer";
  if (/^-?\d+\.\d+$/.test(text)) return "number";
  if (/^(true|false)$/i.test(text)) return "boolean";
  if (/^\d{4}-\d{2}-\d{2}(?:[ tT]\d{2}:\d{2}:\d{2})?/.test(text)) return "datetime";
  return "string";
}

function inferFieldRoleFromDataType(dataType = "", fieldName = "") {
  if (fieldName && isGeoDimensionFieldName(fieldName)) {
    return "dimension";
  }
  const normalized = String(dataType || "").trim().toLowerCase();
  if (/(int|decimal|numeric|number|double|float|real|money|bigint|smallint|tinyint)/i.test(normalized)) {
    return "metric";
  }
  if (/(date|time|timestamp|year)/i.test(normalized)) {
    return "time";
  }
  return "dimension";
}

function inferPreviewColumns(fieldNames = [], sampleRows = []) {
  return fieldNames.map((name) => {
    const sampleValue = sampleRows.find((row) => row && Object.prototype.hasOwnProperty.call(row, name) && row[name] !== null && row[name] !== undefined)?.[name];
    const dataType = guessFieldDataTypeFromValue(sampleValue);
    return {
      columnName: name,
      label: name,
      dataType,
      role: inferFieldRoleFromDataType(dataType, name),
    };
  });
}

function mergePreviewFieldMetadata(storedFields = [], previewFields = []) {
  const storedFieldMap = new Map(
    asArray(storedFields)
      .filter((item) => item?.columnName)
      .map((item) => [item.columnName, item])
  );
  return asArray(previewFields).map((field) => {
    const stored = storedFieldMap.get(field.columnName) || {};
    return {
      ...stored,
      ...field,
      label: stored.label || field.label,
      visible: stored.visible ?? field.visible,
      aggregation: stored.aggregation ?? field.aggregation,
      role: field.role || stored.role || inferFieldRoleFromDataType(
        field.dataType || stored.dataType,
        field.columnName || stored.columnName || field.label || stored.label
      ),
      dataType: field.dataType || stored.dataType || "string",
    };
  });
}

function normalizeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeChartDimension(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = normalizeText(value, "");
  return normalized || fallback;
}

const CHROME_PADDING_PRESET_MAP = {
  compact: { left: 8, right: 8, top: 8, bottom: 8 },
  comfortable: { left: 18, right: 18, top: 16, bottom: 16 },
  spacious: { left: 28, right: 28, top: 24, bottom: 24 },
};

function resolveChromePadding(preset) {
  return CHROME_PADDING_PRESET_MAP[preset || "comfortable"] || CHROME_PADDING_PRESET_MAP.comfortable;
}

function resolveBarLabelPosition(isHorizontalBarChart, valuePosition) {
  if (isHorizontalBarChart) {
    return valuePosition === "inside" ? "insideRight" : "right";
  }
  return valuePosition === "inside" ? "insideTop" : "top";
}

function formatMetricValue(value, decimals = 0, prefix = "", suffix = "") {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return `${prefix || ""}${value ?? "-"}${suffix || ""}`;
  return `${prefix || ""}${numericValue.toFixed(Math.max(0, Number(decimals || 0)))}${suffix || ""}`;
}

function buildChromeConfig(chrome = {}, styleOverrides = {}) {
  return {
    titleText: chrome.titleText || styleOverrides.titleText || null,
    showTitle: chrome.showTitle !== false,
    titleAlign: chrome.titleAlign || styleOverrides.titleAlign || "left",
    titleColor: chrome.titleColor || styleOverrides.titleColor || "#101828",
    titleFontSize: normalizeNumber(chrome.titleFontSize, 18),
    titleFontWeight: normalizeNumber(chrome.titleFontWeight, 700),
    paddingPreset: chrome.paddingPreset || styleOverrides.paddingPreset || "comfortable",
    backgroundColor: chrome.backgroundColor || styleOverrides.backgroundColor || "#ffffff",
    backgroundImage: chrome.backgroundImage || styleOverrides.backgroundImage || null,
    borderColor: chrome.borderColor || "#eef2f7",
    borderWidth: normalizeNumber(chrome.borderWidth, 1),
    borderRadius: normalizeNumber(chrome.borderRadius, 16),
    shadowPreset: chrome.shadowPreset || "none",
  };
}

function buildChartStyleConfig(chartStyle = {}, styleOverrides = {}, legacyChrome = {}) {
  return {
    palette: Array.isArray(chartStyle.palette) ? chartStyle.palette : undefined,
    palettePreset: chartStyle.palettePreset || styleOverrides.palettePreset || null,
    accentColor: chartStyle.accentColor || styleOverrides.accentColor || null,
    barSeriesLayout: chartStyle.barSeriesLayout || styleOverrides.barSeriesLayout || "grouped",
    barPrimaryColor: chartStyle.barPrimaryColor || styleOverrides.barPrimaryColor || null,
    barSecondaryColor: chartStyle.barSecondaryColor || styleOverrides.barSecondaryColor || null,
    barGap: chartStyle.barGap || styleOverrides.barGap || null,
    barCategoryGap: chartStyle.barCategoryGap || styleOverrides.barCategoryGap || null,
    barValuePosition: chartStyle.barValuePosition || styleOverrides.barValuePosition || "top",
    legendPrimaryName: chartStyle.legendPrimaryName || styleOverrides.legendPrimaryName || null,
    legendSecondaryName: chartStyle.legendSecondaryName || styleOverrides.legendSecondaryName || null,
    horizontalBarPalette: Array.isArray(chartStyle.horizontalBarPalette) ? chartStyle.horizontalBarPalette : [],
    horizontalBarColorCount: normalizeNumber(chartStyle.horizontalBarColorCount ?? styleOverrides.horizontalBarColorCount, 1),
    horizontalBarSortOrder: chartStyle.horizontalBarSortOrder || styleOverrides.horizontalBarSortOrder || "none",
    sankeyNodeWidth: normalizeNumber(chartStyle.sankeyNodeWidth ?? styleOverrides.sankeyNodeWidth, 16),
    sankeyNodeGap: normalizeNumber(chartStyle.sankeyNodeGap ?? styleOverrides.sankeyNodeGap, 18),
    sankeyNodeBorderColor: chartStyle.sankeyNodeBorderColor || styleOverrides.sankeyNodeBorderColor || "#ffffff",
    sankeyNodeBorderWidth: normalizeNumber(chartStyle.sankeyNodeBorderWidth ?? styleOverrides.sankeyNodeBorderWidth, 1),
    sankeyNodeBorderRadius: normalizeNumber(chartStyle.sankeyNodeBorderRadius ?? styleOverrides.sankeyNodeBorderRadius, 4),
    sankeyLinkOpacity: chartStyle.sankeyLinkOpacity ?? styleOverrides.sankeyLinkOpacity ?? 0.28,
    sankeyLinkCurveness: chartStyle.sankeyLinkCurveness ?? styleOverrides.sankeyLinkCurveness ?? 0.5,
    gaugePointerColor: chartStyle.gaugePointerColor || styleOverrides.gaugePointerColor || null,
    gaugeDetailColor: chartStyle.gaugeDetailColor || styleOverrides.gaugeDetailColor || null,
    gaugeTitleColor: chartStyle.gaugeTitleColor || styleOverrides.gaugeTitleColor || null,
    gaugeMetricName: chartStyle.gaugeMetricName ?? styleOverrides.gaugeMetricName ?? "指标",
    gaugeAxisLabelColor: chartStyle.gaugeAxisLabelColor || styleOverrides.gaugeAxisLabelColor || null,
    gaugeSplitLineColor: chartStyle.gaugeSplitLineColor || styleOverrides.gaugeSplitLineColor || null,
    gaugeStartAngle: normalizeNumber(chartStyle.gaugeStartAngle ?? styleOverrides.gaugeStartAngle, 210),
    gaugeEndAngle: normalizeNumber(chartStyle.gaugeEndAngle ?? styleOverrides.gaugeEndAngle, -30),
    gaugeRadius: normalizeChartDimension(chartStyle.gaugeRadius ?? styleOverrides.gaugeRadius, "90%"),
    gaugeProgressWidth: normalizeNumber(chartStyle.gaugeProgressWidth ?? styleOverrides.gaugeProgressWidth, 18),
    gaugeAxisLineWidth: normalizeNumber(chartStyle.gaugeAxisLineWidth ?? styleOverrides.gaugeAxisLineWidth, 18),
    gaugePointerLength: normalizeChartDimension(chartStyle.gaugePointerLength ?? styleOverrides.gaugePointerLength, "58%"),
    gaugeDetailFontSize: normalizeNumber(chartStyle.gaugeDetailFontSize ?? styleOverrides.gaugeDetailFontSize, 24),
    gaugeDetailFontWeight: normalizeNumber(chartStyle.gaugeDetailFontWeight ?? styleOverrides.gaugeDetailFontWeight, 700),
    gaugeTitleFontSize: normalizeNumber(chartStyle.gaugeTitleFontSize ?? styleOverrides.gaugeTitleFontSize, 14),
    funnelValueColor: chartStyle.funnelValueColor || styleOverrides.funnelValueColor || null,
    funnelLabelLineColor: chartStyle.funnelLabelLineColor || styleOverrides.funnelLabelLineColor || null,
    funnelBlockBorderColor: chartStyle.funnelBlockBorderColor || styleOverrides.funnelBlockBorderColor || null,
    funnelBlockBorderWidth: normalizeNumber(chartStyle.funnelBlockBorderWidth ?? styleOverrides.funnelBlockBorderWidth, 1),
    funnelItemGap: normalizeNumber(chartStyle.funnelItemGap ?? styleOverrides.funnelItemGap, 2),
    funnelSortOrder: chartStyle.funnelSortOrder || styleOverrides.funnelSortOrder || "descending",
    funnelLabelPosition: chartStyle.funnelLabelPosition || styleOverrides.funnelLabelPosition || "outside",
    funnelShowName: chartStyle.funnelShowName !== false && styleOverrides.funnelShowName !== false,
    funnelShowValue: chartStyle.funnelShowValue !== false && styleOverrides.funnelShowValue !== false,
    wordCloudShape: chartStyle.wordCloudShape || styleOverrides.wordCloudShape || "circle",
    wordCloudGridSize: normalizeNumber(chartStyle.wordCloudGridSize ?? styleOverrides.wordCloudGridSize, 10),
    wordCloudRotationStep: normalizeNumber(chartStyle.wordCloudRotationStep ?? styleOverrides.wordCloudRotationStep, 45),
    wordCloudMinFontSize: normalizeNumber(chartStyle.wordCloudMinFontSize ?? styleOverrides.wordCloudMinFontSize, 12),
    wordCloudMaxFontSize: normalizeNumber(chartStyle.wordCloudMaxFontSize ?? styleOverrides.wordCloudMaxFontSize, 40),
    wordCloudFontWeight: normalizeNumber(chartStyle.wordCloudFontWeight ?? styleOverrides.wordCloudFontWeight, 700),
    wordCloudTextShadowColor: chartStyle.wordCloudTextShadowColor || styleOverrides.wordCloudTextShadowColor || null,
    wordCloudTextShadowBlur: normalizeNumber(chartStyle.wordCloudTextShadowBlur ?? styleOverrides.wordCloudTextShadowBlur, 10),
    scatterSymbolSize: normalizeNumber(chartStyle.scatterSymbolSize ?? styleOverrides.scatterSymbolSize, 16),
    scatterPointBorderColor: chartStyle.scatterPointBorderColor || styleOverrides.scatterPointBorderColor || chartStyle.pointBorderColor || styleOverrides.pointBorderColor || "#ffffff",
    scatterPointBorderWidth: normalizeNumber(chartStyle.scatterPointBorderWidth ?? styleOverrides.scatterPointBorderWidth, 1),
    scatterPointOpacity: chartStyle.scatterPointOpacity ?? styleOverrides.scatterPointOpacity ?? 0.82,
    scatterLabelPosition: chartStyle.scatterLabelPosition || styleOverrides.scatterLabelPosition || "top",
    radarLayout: chartStyle.radarLayout || styleOverrides.radarLayout || "single",
    radarPrimaryColor: chartStyle.radarPrimaryColor || styleOverrides.radarPrimaryColor || null,
    radarSecondaryColor: chartStyle.radarSecondaryColor || styleOverrides.radarSecondaryColor || null,
    radarPointColor: chartStyle.radarPointColor || styleOverrides.radarPointColor || null,
    radarAreaOpacity: chartStyle.radarAreaOpacity ?? styleOverrides.radarAreaOpacity ?? null,
    mapRegionPalette: Array.isArray(chartStyle.mapRegionPalette) ? chartStyle.mapRegionPalette : [],
    mapRegionBorderColor: chartStyle.mapRegionBorderColor || styleOverrides.mapRegionBorderColor || null,
    mapLabelColor: chartStyle.mapLabelColor || styleOverrides.mapLabelColor || null,
    mapVisualMapTextColor: chartStyle.mapVisualMapTextColor || styleOverrides.mapVisualMapTextColor || null,
    axisColor: chartStyle.axisColor || styleOverrides.axisColor || null,
    axisLabelColor: chartStyle.axisLabelColor || styleOverrides.axisLabelColor || null,
    splitLineColor: chartStyle.splitLineColor || styleOverrides.splitLineColor || null,
    xAxisUnitLabel: chartStyle.xAxisUnitLabel || styleOverrides.xAxisUnitLabel || "",
    yAxisUnitLabel: chartStyle.yAxisUnitLabel || styleOverrides.yAxisUnitLabel || "",
    axisLabelFontSize: normalizeNumber(chartStyle.axisLabelFontSize ?? styleOverrides.axisLabelFontSize, 12),
    axisLabelFontWeight: normalizeNumber(chartStyle.axisLabelFontWeight ?? styleOverrides.axisLabelFontWeight, 400),
    legendPosition: chartStyle.legendPosition || styleOverrides.legendPosition || "bottom",
    showLegend: chartStyle.showLegend !== false && legacyChrome.showLegend !== false,
    showAxis: chartStyle.showAxis !== false && legacyChrome.showAxis !== false,
    showXAxis: typeof chartStyle.showXAxis === "boolean" ? chartStyle.showXAxis : true,
    showYAxis: typeof chartStyle.showYAxis === "boolean" ? chartStyle.showYAxis : true,
    showGridLines: typeof chartStyle.showGridLines === "boolean" ? chartStyle.showGridLines : false,
    showLabels: chartStyle.showLabels !== false && legacyChrome.showLabels !== false,
    showDataLabels: Boolean(chartStyle.showDataLabels ?? legacyChrome.showDataLabels),
    dataLabelColor: chartStyle.dataLabelColor || legacyChrome.dataLabelColor || "#ffffff",
    dataLabelFontSize: normalizeNumber(chartStyle.dataLabelFontSize ?? legacyChrome.dataLabelFontSize, 14),
    dataLabelFontWeight: normalizeNumber(chartStyle.dataLabelFontWeight ?? legacyChrome.dataLabelFontWeight, 500),
    legendTextColor: chartStyle.legendTextColor || styleOverrides.legendTextColor || null,
    legendFontSize: normalizeNumber(chartStyle.legendFontSize ?? styleOverrides.legendFontSize, 14),
    legendFontWeight: normalizeNumber(chartStyle.legendFontWeight ?? styleOverrides.legendFontWeight, 500),
  };
}

function buildMapStyleConfig(mapStyle = {}, styleOverrides = {}, legacyChrome = {}) {
  const sourceCenter = Array.isArray(mapStyle.center) && mapStyle.center.length >= 2
    ? [Number(mapStyle.center[0]), Number(mapStyle.center[1])]
    : null;
  const overrideCenter = Array.isArray(styleOverrides.center) && styleOverrides.center.length >= 2
    ? [Number(styleOverrides.center[0]), Number(styleOverrides.center[1])]
    : null;
  const legacyCenter = Array.isArray(legacyChrome.center) && legacyChrome.center.length >= 2
    ? [Number(legacyChrome.center[0]), Number(legacyChrome.center[1])]
    : null;
  const resolvedCenter = [sourceCenter, overrideCenter, legacyCenter]
    .find((value) => Array.isArray(value) && value.every((item) => Number.isFinite(item))) || null;
  const zoomValue = Number(mapStyle.zoom ?? styleOverrides.zoom ?? legacyChrome.zoom);
  return {
    provinceCode: mapStyle.provinceCode || styleOverrides.provinceCode || legacyChrome.provinceCode || null,
    center: resolvedCenter,
    zoom: Number.isFinite(zoomValue) && zoomValue > 0 ? zoomValue : null,
  };
}

function buildChartAnalysisConfig(chartAnalysis = {}, legacyChrome = {}) {
  return {
    showExtrema: Boolean(chartAnalysis.showExtrema ?? legacyChrome.showExtrema),
  };
}

function getMapRegionPalette(chartStyle = {}) {
  const configured = Array.isArray(chartStyle.mapRegionPalette)
    ? chartStyle.mapRegionPalette.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  const fallback = ["#eef5ff", "#d5e6ff", "#9cc3ff", "#4f8cff", chartStyle.accentColor || "#1677ff"];
  return fallback.map((color, index) => configured[index] || color);
}

function buildKpiStyleConfig(kpiStyle = {}, legacyChrome = {}, props = {}) {
  const valueColor = kpiStyle.valueColor || legacyChrome.valueColor || "#1677ff";
  const valueFontSize = normalizeNumber(kpiStyle.valueFontSize ?? legacyChrome.valueFontSize, 34);
  const itemBackgroundColor = kpiStyle.itemBackgroundColor || props.itemBackgroundColor || "#ffffff";
  const flipperBackground = props.flipperBackground || kpiStyle.flipperBackground || `linear-gradient(180deg, ${valueColor} 0%, ${itemBackgroundColor} 100%)`;
  return {
    themeKey: kpiStyle.themeKey || props.themeKey || null,
    themeMode: kpiStyle.themeMode || props.themeMode || "all",
    itemSize: kpiStyle.itemSize || props.itemSize || "medium",
    multiValueLayout: kpiStyle.multiValueLayout || props.multiValueLayout || "verticalList",
    contentOrientation: kpiStyle.contentOrientation || props.contentOrientation || "vertical",
    itemsPerRow: normalizeNumber(kpiStyle.itemsPerRow ?? props.itemsPerRow, 2),
    itemsPerColumn: normalizeNumber(kpiStyle.itemsPerColumn ?? props.itemsPerColumn, 3),
    itemMinWidth: normalizeNumber(kpiStyle.itemMinWidth ?? props.itemMinWidth, 180),
    itemGap: normalizeNumber(kpiStyle.itemGap ?? props.itemGap, 16),
    itemAlign: kpiStyle.itemAlign || props.itemAlign || "left",
    showDivider: kpiStyle.showDivider !== false && props.showDivider !== false,
    showValue: kpiStyle.showValue !== false && legacyChrome.showValue !== false,
    valueColor,
    valueFontSize,
    valueFontWeight: normalizeNumber(kpiStyle.valueFontWeight ?? legacyChrome.valueFontWeight, 700),
    valuePrefixColor: kpiStyle.valuePrefixColor || legacyChrome.valuePrefixColor || valueColor,
    valuePrefixFontSize: normalizeNumber(kpiStyle.valuePrefixFontSize ?? legacyChrome.valuePrefixFontSize, Math.max(12, valueFontSize - 14)),
    valueSuffixColor: kpiStyle.valueSuffixColor || legacyChrome.valueSuffixColor || valueColor,
    valueSuffixFontSize: normalizeNumber(kpiStyle.valueSuffixFontSize ?? legacyChrome.valueSuffixFontSize, Math.max(12, valueFontSize - 14)),
    dividerStyle: kpiStyle.dividerStyle || props.dividerStyle || "solid",
    dividerWidth: normalizeNumber(kpiStyle.dividerWidth ?? props.dividerWidth, 1),
    dividerColor: kpiStyle.dividerColor || props.dividerColor || "#e5e7eb",
    flipperBackground,
    flipperGap: normalizeNumber(kpiStyle.flipperGap ?? props.flipperGap, 6),
    flipperDigitWidth: normalizeNumber(kpiStyle.flipperDigitWidth ?? props.flipperDigitWidth, 56),
    flipperDigitHeight: normalizeNumber(kpiStyle.flipperDigitHeight ?? props.flipperDigitHeight, 52),
    flipperDigitRadius: normalizeNumber(kpiStyle.flipperDigitRadius ?? props.flipperDigitRadius, 10),
    hoverElevated: kpiStyle.hoverElevated !== false && props.hoverElevated !== false,
    trendColorMode: kpiStyle.trendColorMode || props.trendColorMode || "auto",
    itemBackgroundColor,
    itemBorderColor: kpiStyle.itemBorderColor || props.itemBorderColor || "#e5e7eb",
    itemBorderWidth: normalizeNumber(kpiStyle.itemBorderWidth ?? props.itemBorderWidth, 0),
    itemBorderRadius: normalizeNumber(kpiStyle.itemBorderRadius ?? props.itemBorderRadius, 12),
    showMetricLabel: kpiStyle.showMetricLabel !== false && props.showMetricLabel !== false,
    metricLabelColor: kpiStyle.metricLabelColor || props.metricLabelColor || "#667085",
    metricLabelFontSize: normalizeNumber(kpiStyle.metricLabelFontSize ?? props.metricLabelFontSize, 16),
    metricLabelFontWeight: normalizeNumber(kpiStyle.metricLabelFontWeight ?? props.metricLabelFontWeight, 600),
    compareLabelColor: kpiStyle.compareLabelColor || props.compareLabelColor || "#52c41a",
    compareLabelFontSize: normalizeNumber(kpiStyle.compareLabelFontSize ?? props.compareLabelFontSize, 16),
    compareLabelFontWeight: normalizeNumber(kpiStyle.compareLabelFontWeight ?? props.compareLabelFontWeight, 600),
  };
}

function buildKpiAnalysisConfig(kpiAnalysis = {}, props = {}) {
  return {
    showTrend: kpiAnalysis.showTrend !== false && props.showTrend !== false,
  };
}

function buildTableStyleConfig(tableStyle = {}, props = {}) {
  return {
    showIndex: tableStyle.showIndex !== false && props.showIndex !== false,
    compact: Boolean(tableStyle.compact ?? props.compact),
    striped: tableStyle.striped !== false && props.striped !== false,
  };
}

function buildTabsStyleConfig(tabsStyle = {}) {
  return {
    tabBarBackgroundColor: tabsStyle.tabBarBackgroundColor || "#f8fafc",
    activeTextColor: tabsStyle.activeTextColor || "#1677ff",
    inactiveTextColor: tabsStyle.inactiveTextColor || "#667085",
  };
}

function withCompactGrid(option = {}, overrides = {}) {
  return {
    ...option,
    grid: {
      left: 12,
      right: 12,
      top: 36,
      bottom: 18,
      containLabel: true,
      ...(option.grid || {}),
      ...(overrides || {}),
    },
  };
}

function withCompactLegend(option = {}, overrides = {}) {
  if (!option.legend) return option;
  return {
    ...option,
    legend: {
      top: 6,
      left: "center",
      itemWidth: 10,
      itemHeight: 10,
      ...(option.legend || {}),
      ...(overrides || {}),
    },
  };
}

function buildKpiPreview(rows = [], fieldMap = {}, chrome = {}, kpiStyle = {}, kpiAnalysis = {}, props = {}) {
  const kpiConfig = props.kpi && typeof props.kpi === "object" ? props.kpi : props;
  const valueField = fieldMap.valueField || fieldMap.yField || "value";
  const compareField = fieldMap.compareField || "compare_value";
  const targetField = fieldMap.targetField || "target_value";
  const labelField = fieldMap.nameField || fieldMap.labelField || "label";
  const row = rows[0] || {};
  const items = rows.map((entry) => {
    const entryPrimaryValue = entry[valueField] ?? null;
    const entryCompareValue = Boolean(fieldMap.compareField) ? entry[compareField] ?? null : null;
    const entryTargetValue = entry[targetField] ?? null;
    const entryTrendPercent = Boolean(fieldMap.compareField) && entryCompareValue !== null && Number(entryCompareValue) !== 0
      ? Number((((Number(entryPrimaryValue || 0) - Number(entryCompareValue || 0)) / Number(entryCompareValue)) * 100).toFixed(2))
      : null;
    return {
      primaryValue: entryPrimaryValue,
      compareValue: entryCompareValue,
      targetValue: entryTargetValue,
      trendPercent: entryTrendPercent,
      label: entry[labelField] || props.metricLabel || chrome.titleText || "指标值",
      formattedValue: formatMetricValue(entryPrimaryValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix),
    };
  });
  const primaryValue = row[valueField] ?? null;
  const hasCompareField = Boolean(fieldMap.compareField);
  const compareValue = hasCompareField ? row[compareField] ?? null : null;
  const targetValue = row[targetField] ?? null;
  const trendPercent = hasCompareField && compareValue !== null && Number(compareValue) !== 0
    ? Number((((Number(primaryValue || 0) - Number(compareValue || 0)) / Number(compareValue)) * 100).toFixed(2))
    : null;
  return {
    widgetType: "kpi",
    dataset: null,
    chartAsset: null,
    fields: [],
    sampleRows: rows,
    fieldMap,
    chrome,
    kpiStyle,
    kpiAnalysis,
    kpi: {
      items,
      primaryValue,
      compareValue,
      targetValue,
      trendPercent,
      label: row[labelField] || props.metricLabel || chrome.titleText || "指标值",
      mode: kpiConfig.mode || props.kpiMode || "number",
      layout: kpiConfig.layout || "vertical",
      prefix: kpiConfig.valuePrefix || "",
      suffix: kpiConfig.valueSuffix || "",
      valuePrefix: kpiConfig.valuePrefix || "",
      valueSuffix: kpiConfig.valueSuffix || "",
      decimals: normalizeNumber(kpiConfig.decimals, 0),
      showTrend: kpiAnalysis.showTrend !== false,
      formattedValue: formatMetricValue(primaryValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix),
      formattedCompareValue: compareValue === null ? null : formatMetricValue(compareValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix),
      formattedTargetValue: targetValue === null ? null : formatMetricValue(targetValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix),
      showMetricLabel: kpiStyle.showMetricLabel !== false,
      valuePrefixColor: kpiStyle.valuePrefixColor,
      valuePrefixFontSize: kpiStyle.valuePrefixFontSize,
      valueSuffixColor: kpiStyle.valueSuffixColor,
      valueSuffixFontSize: kpiStyle.valueSuffixFontSize,
      metricLabelColor: kpiStyle.metricLabelColor,
      metricLabelFontSize: kpiStyle.metricLabelFontSize,
      metricLabelFontWeight: kpiStyle.metricLabelFontWeight,
      compareLabel: kpiConfig.compareLabel || "同比",
      compareLabelColor: kpiStyle.compareLabelColor,
      compareLabelFontSize: kpiStyle.compareLabelFontSize,
      compareLabelFontWeight: kpiStyle.compareLabelFontWeight,
    },
  };
}

function buildTablePreview(rows = [], fields = [], fieldMap = {}, chrome = {}, tableStyle = {}, props = {}) {
  const visibleColumns = (props.columns && Array.isArray(props.columns) && props.columns.length > 0)
    ? props.columns
    : fields.map((field) => ({
      key: field.columnName,
      title: field.label || field.columnName,
      dataIndex: field.columnName,
    }));
  return {
    widgetType: "table",
    dataset: null,
    chartAsset: null,
    fields,
    sampleRows: rows,
    fieldMap,
    chrome,
    tableStyle,
    table: {
      columns: visibleColumns,
      rows,
      pageSize: normalizeNumber(props.pageSize, 10),
      showIndex: tableStyle.showIndex !== false,
      compact: Boolean(tableStyle.compact),
      striped: tableStyle.striped !== false,
    },
  };
}

function buildSankeyEmptyOption(optionTemplate = {}, message = "请先为桑基图配置有效的来源、去向和权重字段") {
  const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
  return {
    ...optionTemplate,
    graphic: {
      type: "text",
      left: "center",
      top: "middle",
      silent: true,
      style: {
        text: message,
        fill: "#98a2b3",
        fontSize: 14,
        fontWeight: 500,
        textAlign: "center",
      },
    },
    series: [
      {
        ...baseSeries,
        type: "sankey",
        data: [],
        links: [],
      },
    ],
  };
}

function hasSankeyCycle(links = []) {
  const nodeSet = new Set();
  const adjacency = new Map();
  const indegree = new Map();
  links.forEach((link) => {
    const source = normalizeText(link?.source);
    const target = normalizeText(link?.target);
    if (!source || !target) return;
    nodeSet.add(source);
    nodeSet.add(target);
    if (!adjacency.has(source)) adjacency.set(source, new Set());
    if (!adjacency.has(target)) adjacency.set(target, new Set());
    if (!indegree.has(source)) indegree.set(source, 0);
    if (!indegree.has(target)) indegree.set(target, 0);
    if (!adjacency.get(source).has(target)) {
      adjacency.get(source).add(target);
      indegree.set(target, Number(indegree.get(target) || 0) + 1);
    }
  });
  const queue = [];
  nodeSet.forEach((node) => {
    if (Number(indegree.get(node) || 0) === 0) {
      queue.push(node);
    }
  });
  let visited = 0;
  while (queue.length) {
    const current = queue.shift();
    visited += 1;
    const neighbors = adjacency.get(current) || new Set();
    neighbors.forEach((neighbor) => {
      const nextDegree = Number(indegree.get(neighbor) || 0) - 1;
      indegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
      }
    });
  }
  return visited !== nodeSet.size;
}

function getSankeyPalette(chartStyle = {}) {
  const configured = Array.isArray(chartStyle.palette)
    ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    chartStyle.accentColor || "#1677ff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function buildSankeyNodeMeta(series = {}) {
  const outgoing = new Set();
  const incoming = new Set();
  const links = Array.isArray(series.links) ? series.links : [];
  links.forEach((link) => {
    if (!link || typeof link !== "object") return;
    if (link.source !== undefined && link.source !== null) outgoing.add(String(link.source));
    if (link.target !== undefined && link.target !== null) incoming.add(String(link.target));
  });
  return { outgoing, incoming };
}

function resolveSankeyLabelPlacement(name, meta) {
  const hasOutgoing = meta.outgoing.has(name);
  const hasIncoming = meta.incoming.has(name);
  if (!hasOutgoing && hasIncoming) {
    return { position: "left", align: "right" };
  }
  return { position: "right", align: "left" };
}

function applySankeyChartStyle(option = {}, chrome = {}, chartStyle = {}) {
  const nextOption = { ...(option || {}) };
  const paddingPresetMap = {
    compact: { left: 4, right: 4, top: 4, bottom: 4 },
    comfortable: { left: 12, right: 12, top: 8, bottom: 8 },
    spacious: { left: 20, right: 20, top: 16, bottom: 16 },
  };
  const resolvedPadding = paddingPresetMap[chrome.paddingPreset || "comfortable"] || paddingPresetMap.comfortable;
  const palette = getSankeyPalette(chartStyle);
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  nextOption.series = nextOption.series.map((item) => {
    if (item?.type !== "sankey") {
      return item;
    }
    const meta = buildSankeyNodeMeta(item);
    const data = Array.isArray(item.data)
      ? item.data.map((node, index) => {
        const baseNode = node && typeof node === "object" && !Array.isArray(node)
          ? { ...node }
          : { name: String(node || "") };
        const name = String(baseNode.name || "");
        const placement = resolveSankeyLabelPlacement(name, meta);
        return {
          ...baseNode,
          itemStyle: {
            ...(baseNode.itemStyle || {}),
            color: palette[index % palette.length] || chartStyle.accentColor || baseNode.itemStyle?.color || "#1677ff",
            borderColor: chartStyle.sankeyNodeBorderColor || baseNode.itemStyle?.borderColor || "#ffffff",
            borderWidth: normalizeNumber(chartStyle.sankeyNodeBorderWidth ?? baseNode.itemStyle?.borderWidth, 1),
            borderRadius: normalizeNumber(chartStyle.sankeyNodeBorderRadius ?? baseNode.itemStyle?.borderRadius, 4),
          },
          label: {
            ...(baseNode.label || {}),
            show: chartStyle.showLabels !== false,
            position: baseNode.label?.position || placement.position,
            align: baseNode.label?.align || placement.align,
            verticalAlign: baseNode.label?.verticalAlign || "middle",
            distance: baseNode.label?.distance ?? 8,
            color: chartStyle.dataLabelColor || baseNode.label?.color || "#344054",
            fontSize: normalizeNumber(chartStyle.dataLabelFontSize ?? baseNode.label?.fontSize, 14),
            fontWeight: normalizeNumber(chartStyle.dataLabelFontWeight ?? baseNode.label?.fontWeight, 500),
          },
        };
      })
      : item.data;
    return {
      ...item,
      left: item.left ?? resolvedPadding.left,
      right: item.right ?? resolvedPadding.right,
      top: item.top ?? resolvedPadding.top,
      bottom: item.bottom ?? resolvedPadding.bottom,
      nodeAlign: item.nodeAlign || "justify",
      draggable: item.draggable ?? false,
      nodeWidth: normalizeNumber(chartStyle.sankeyNodeWidth ?? item.nodeWidth, 16),
      nodeGap: normalizeNumber(chartStyle.sankeyNodeGap ?? item.nodeGap, 18),
      emphasis: {
        focus: "adjacency",
        ...(item.emphasis || {}),
      },
      labelLayout: {
        hideOverlap: false,
        ...(item.labelLayout || {}),
      },
      lineStyle: {
        color: "gradient",
        ...(item.lineStyle || {}),
        opacity: Number(chartStyle.sankeyLinkOpacity ?? item.lineStyle?.opacity ?? 0.28),
        curveness: Number(chartStyle.sankeyLinkCurveness ?? item.lineStyle?.curveness ?? 0.5),
      },
      data,
    };
  });
  if (nextOption.legend) {
    nextOption.legend = { ...(nextOption.legend || {}), show: false };
  }
  return nextOption;
}

function getFunnelPalette(chartStyle = {}) {
  const configured = Array.isArray(chartStyle.palette)
    ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    chartStyle.accentColor || "#1677ff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function formatFunnelLabelValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
}

function applyFunnelChartStyle(option = {}, chrome = {}, chartStyle = {}) {
  const nextOption = { ...(option || {}) };
  const resolvedPadding = resolveChromePadding(chrome.paddingPreset);
  const palette = getFunnelPalette(chartStyle);
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  nextOption.color = palette;
  nextOption.series = nextOption.series.map((item) => {
    if (item?.type !== "funnel") {
      return item;
    }
    const labelFontSize = normalizeNumber(chartStyle.dataLabelFontSize ?? item.label?.fontSize, 14);
    const labelFontWeight = normalizeNumber(chartStyle.dataLabelFontWeight ?? item.label?.fontWeight, 500);
    const labelColor = chartStyle.dataLabelColor || item.label?.color || "#344054";
    const valueColor = chartStyle.funnelValueColor || labelColor;
    const labelLineColor = chartStyle.funnelLabelLineColor || item.labelLine?.lineStyle?.color || "#98a2b3";
    const borderColor = chartStyle.funnelBlockBorderColor || item.itemStyle?.borderColor || "#ffffff";
    const borderWidth = normalizeNumber(chartStyle.funnelBlockBorderWidth ?? item.itemStyle?.borderWidth, 1);
    const gap = normalizeNumber(chartStyle.funnelItemGap ?? item.gap, 2);
    const sortOrder = normalizeText(chartStyle.funnelSortOrder, normalizeText(item.sort, "descending"));
    const labelPosition = chartStyle.funnelLabelPosition === "inside" ? "inside" : "right";
    const showName = chartStyle.funnelShowName !== false;
    const showValue = chartStyle.funnelShowValue !== false;
    const showLabel = chartStyle.showLabels !== false && (showName || showValue);
    const data = Array.isArray(item.data)
      ? item.data.map((entry, index) => {
        const baseEntry = entry && typeof entry === "object" && !Array.isArray(entry)
          ? { ...entry }
          : { value: entry };
        return {
          ...baseEntry,
          itemStyle: {
            ...(baseEntry.itemStyle || {}),
            color: palette[index % palette.length] || chartStyle.accentColor || baseEntry.itemStyle?.color || "#1677ff",
            borderColor,
            borderWidth,
          },
        };
      })
      : item.data;
    return {
      ...item,
      left: item.left ?? resolvedPadding.left,
      right: item.right ?? resolvedPadding.right,
      top: item.top ?? resolvedPadding.top,
      bottom: item.bottom ?? resolvedPadding.bottom,
      sort: ["ascending", "descending", "none"].includes(sortOrder) ? sortOrder : "descending",
      gap,
      itemStyle: {
        ...(item.itemStyle || {}),
        borderColor,
        borderWidth,
      },
      label: {
        ...(item.label || {}),
        show: showLabel,
        position: labelPosition,
        align: labelPosition === "inside" ? "center" : item.label?.align,
        verticalAlign: labelPosition === "inside" ? "middle" : item.label?.verticalAlign,
        color: labelColor,
        fontSize: labelFontSize,
        fontWeight: labelFontWeight,
        formatter: (params) => {
          const name = params?.name ? String(params.name) : "";
          const value = formatFunnelLabelValue(params?.value);
          if (showName && showValue) {
            if (name && value) return `{name|${name}}\n{value|${value}}`;
            if (name) return `{name|${name}}`;
            return value ? `{value|${value}}` : "";
          }
          if (showName) return name ? `{name|${name}}` : "";
          if (showValue) return value ? `{value|${value}}` : "";
          return "";
        },
        rich: {
          ...((item.label || {}).rich || {}),
          name: {
            color: labelColor,
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            lineHeight: labelFontSize + 4,
          },
          value: {
            color: valueColor,
            fontSize: Math.max(labelFontSize, labelFontSize + 1),
            fontWeight: 700,
            lineHeight: labelFontSize + 6,
          },
        },
      },
      labelLine: {
        ...(item.labelLine || {}),
        show: showLabel && labelPosition !== "inside",
        lineStyle: {
          ...((item.labelLine || {}).lineStyle || {}),
          color: labelLineColor,
        },
      },
      data,
    };
  });
  if (nextOption.legend) {
    delete nextOption.legend;
  }
  return nextOption;
}

function getWordCloudPalette(chartStyle = {}) {
  const configured = Array.isArray(chartStyle.palette)
    ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    chartStyle.accentColor || "#1677ff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function resolveWordCloudRotationRange(step) {
  const resolvedStep = normalizeNumber(step, 45);
  return resolvedStep <= 0 ? [0, 0] : [-90, 90];
}

function applyWordCloudChartStyle(option = {}, chrome = {}, chartStyle = {}) {
  const nextOption = { ...(option || {}) };
  const palette = getWordCloudPalette(chartStyle);
  const resolvedPadding = resolveChromePadding(chrome.paddingPreset);
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  nextOption.color = palette;
  nextOption.series = nextOption.series.map((item) => {
    if (item?.type !== "wordCloud") {
      return item;
    }
    const shadowColor = chartStyle.wordCloudTextShadowColor || item.textStyle?.shadowColor || "rgba(15,23,42,0.14)";
    const shadowBlur = normalizeNumber(chartStyle.wordCloudTextShadowBlur ?? item.textStyle?.shadowBlur, 10);
    const fontWeight = normalizeNumber(chartStyle.wordCloudFontWeight ?? item.textStyle?.fontWeight, 700);
    const minFontSize = normalizeNumber(chartStyle.wordCloudMinFontSize ?? item.sizeRange?.[0], 12);
    const maxFontSize = normalizeNumber(chartStyle.wordCloudMaxFontSize ?? item.sizeRange?.[1], 40);
    const rotationStep = normalizeNumber(chartStyle.wordCloudRotationStep ?? item.rotationStep, 45);
    const data = Array.isArray(item.data)
      ? item.data.map((entry, index) => {
        const baseEntry = entry && typeof entry === "object" && !Array.isArray(entry)
          ? { ...entry }
          : { name: String(entry || ""), value: 0 };
        return {
          ...baseEntry,
          textStyle: {
            ...(baseEntry.textStyle || {}),
            color: palette[index % palette.length] || chartStyle.accentColor || "#1677ff",
            fontWeight,
            shadowColor,
            shadowBlur,
          },
        };
      })
      : item.data;
    return {
      ...item,
      type: "wordCloud",
      shape: normalizeText(chartStyle.wordCloudShape, normalizeText(item.shape, "circle")),
      left: resolvedPadding.left,
      right: resolvedPadding.right,
      top: resolvedPadding.top,
      bottom: resolvedPadding.bottom,
      width: undefined,
      height: undefined,
      gridSize: normalizeNumber(chartStyle.wordCloudGridSize ?? item.gridSize, 10),
      rotationStep,
      rotationRange: resolveWordCloudRotationRange(rotationStep),
      sizeRange: [
        Math.max(8, Math.min(minFontSize, maxFontSize)),
        Math.max(minFontSize, maxFontSize),
      ],
      drawOutOfBound: item.drawOutOfBound ?? false,
      textStyle: {
        ...(item.textStyle || {}),
        fontFamily: item.textStyle?.fontFamily || "sans-serif",
        fontWeight,
        shadowColor,
        shadowBlur,
      },
      emphasis: {
        ...(item.emphasis || {}),
        focus: item.emphasis?.focus || "self",
        textStyle: {
          ...(item.emphasis?.textStyle || {}),
          shadowColor,
          shadowBlur: Math.max(shadowBlur, shadowBlur + 4),
        },
      },
      data,
    };
  });
  if (nextOption.legend) {
    delete nextOption.legend;
  }
  return nextOption;
}

function getGaugePalette(chartStyle = {}) {
  const configured = Array.isArray(chartStyle.palette)
    ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    chartStyle.accentColor || "#1677ff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function buildGaugeAxisLineColors(palette = []) {
  const values = Array.isArray(palette) && palette.length ? palette : ["#1677ff"];
  return values.map((color, index) => [Number(((index + 1) / values.length).toFixed(4)), color]);
}

function applyGaugeChartStyle(option = {}, _chrome = {}, chartStyle = {}) {
  const nextOption = { ...(option || {}) };
  const palette = getGaugePalette(chartStyle);
  const configuredMetricName = typeof chartStyle.gaugeMetricName === "string" ? chartStyle.gaugeMetricName : null;
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  const pointerColor = chartStyle.gaugePointerColor || chartStyle.accentColor || palette[0] || "#1677ff";
  const detailColor = chartStyle.gaugeDetailColor || "#101828";
  const titleColor = chartStyle.gaugeTitleColor || "#667085";
  const axisLabelColor = chartStyle.gaugeAxisLabelColor || "#344054";
  const splitLineColor = chartStyle.gaugeSplitLineColor || "#98a2b3";
  const progressWidth = normalizeNumber(chartStyle.gaugeProgressWidth, 18);
  const axisLineWidth = normalizeNumber(chartStyle.gaugeAxisLineWidth, progressWidth);
  nextOption.color = palette;
  nextOption.series = nextOption.series.map((item) => {
    if (item?.type !== "gauge") {
      return item;
    }
    return {
      ...item,
      type: "gauge",
      startAngle: normalizeNumber(chartStyle.gaugeStartAngle ?? item.startAngle, 210),
      endAngle: normalizeNumber(chartStyle.gaugeEndAngle ?? item.endAngle, -30),
      radius: normalizeChartDimension(chartStyle.gaugeRadius ?? item.radius, "90%"),
      data: Array.isArray(item.data)
        ? item.data.map((entry = {}) => ({
          ...entry,
          name: configuredMetricName ?? entry?.name ?? "指标",
        }))
        : item.data,
      progress: {
        ...(item.progress || {}),
        show: item.progress?.show ?? true,
        roundCap: item.progress?.roundCap ?? true,
        width: progressWidth,
        itemStyle: {
          ...(item.progress?.itemStyle || {}),
          color: pointerColor,
        },
      },
      axisLine: {
        ...(item.axisLine || {}),
        roundCap: item.axisLine?.roundCap ?? true,
        lineStyle: {
          ...((item.axisLine || {}).lineStyle || {}),
          width: axisLineWidth,
          color: buildGaugeAxisLineColors(palette),
        },
      },
      pointer: {
        ...(item.pointer || {}),
        show: item.pointer?.show ?? true,
        length: normalizeChartDimension(chartStyle.gaugePointerLength ?? item.pointer?.length, "58%"),
        itemStyle: {
          ...(item.pointer?.itemStyle || {}),
          color: pointerColor,
        },
      },
      anchor: {
        ...(item.anchor || {}),
        show: item.anchor?.show ?? true,
        showAbove: item.anchor?.showAbove ?? true,
        size: item.anchor?.size ?? 10,
        itemStyle: {
          ...(item.anchor?.itemStyle || {}),
          color: pointerColor,
        },
      },
      itemStyle: {
        ...(item.itemStyle || {}),
        color: pointerColor,
      },
      axisTick: {
        ...(item.axisTick || {}),
        lineStyle: {
          ...((item.axisTick || {}).lineStyle || {}),
          color: splitLineColor,
        },
      },
      splitLine: {
        ...(item.splitLine || {}),
        lineStyle: {
          ...((item.splitLine || {}).lineStyle || {}),
          color: splitLineColor,
        },
      },
      axisLabel: {
        ...(item.axisLabel || {}),
        color: axisLabelColor,
      },
      title: {
        ...(item.title || {}),
        show: item.title?.show ?? true,
        color: titleColor,
        fontSize: normalizeNumber(chartStyle.gaugeTitleFontSize ?? item.title?.fontSize, 14),
      },
      detail: {
        ...(item.detail || {}),
        show: item.detail?.show ?? true,
        color: detailColor,
        fontSize: normalizeNumber(chartStyle.gaugeDetailFontSize ?? item.detail?.fontSize, 24),
        fontWeight: normalizeNumber(chartStyle.gaugeDetailFontWeight ?? item.detail?.fontWeight, 700),
      },
    };
  });
  if (nextOption.legend) {
    nextOption.legend = { ...(nextOption.legend || {}), show: false };
  }
  return nextOption;
}

function applyChartStyle(option = {}, chrome = {}, chartStyle = {}, mapStyle = {}, chartAnalysis = {}) {
  const nextOption = { ...(option || {}) };
  if (chrome.showTitle === false) {
    delete nextOption.title;
  } else if (chrome.titleText) {
    nextOption.title = {
      ...(nextOption.title || {}),
      text: chrome.titleText,
      textStyle: {
        ...((nextOption.title || {}).textStyle || {}),
        color: chrome.titleColor || "#101828",
        fontSize: chrome.titleFontSize || 18,
        fontWeight: chrome.titleFontWeight || 700,
      },
      left: chrome.titleAlign === "center" ? "center" : chrome.titleAlign === "right" ? "right" : "left",
    };
  }
  const isSankeyChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "sankey");
  if (isSankeyChart) {
    return applySankeyChartStyle(nextOption, chrome, chartStyle);
  }
  const isFunnelChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "funnel");
  if (isFunnelChart) {
    return applyFunnelChartStyle(nextOption, chrome, chartStyle);
  }
  const isWordCloudChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "wordCloud");
  if (isWordCloudChart) {
    return applyWordCloudChartStyle(nextOption, chrome, chartStyle);
  }
  const isGaugeChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "gauge");
  if (isGaugeChart) {
    return applyGaugeChartStyle(nextOption, chrome, chartStyle);
  }
  const isHorizontalBarChart = Array.isArray(nextOption.series)
    && nextOption.series.some((item) => item?.type === "bar")
    && ((Array.isArray(nextOption.yAxis) ? nextOption.yAxis[0] : nextOption.yAxis)?.type === "category");
  const isScatterChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "scatter");
  const paddingPresetMap = {
    compact: { left: 4, right: 4, top: 8, bottom: 4 },
    comfortable: { left: 18, right: 18, top: 24, bottom: 18 },
    spacious: { left: 40, right: 40, top: 52, bottom: 40 },
  };
  const resolvedPadding = paddingPresetMap[chrome.paddingPreset || "comfortable"] || paddingPresetMap.comfortable;
  const barAxisExtraLeft = chartStyle.showYAxis !== false ? 28 : 0;
  const barAxisExtraBottom = chartStyle.showXAxis !== false ? 28 : 0;
  const legendPosition = chartStyle.legendPosition || "bottom";
  const barLegendExtraBottom = chartStyle.showLegend !== false && legendPosition === "bottom" ? 10 : 0;
  const barLegendExtraTop = chartStyle.showLegend !== false && legendPosition === "top" ? 10 : 0;
  const barLegendExtraLeft = chartStyle.showLegend !== false && legendPosition === "left" ? 10 : 0;
  const barLegendExtraRight = chartStyle.showLegend !== false && legendPosition === "right" ? 10 : 0;
  const axisColor = chartStyle.axisColor || null;
  const axisLabelColor = chartStyle.axisLabelColor || null;
  const splitLineColor = chartStyle.splitLineColor || null;
  const axisLabelFontSize = normalizeNumber(chartStyle.axisLabelFontSize, 12);
  const axisLabelFontWeight = normalizeNumber(chartStyle.axisLabelFontWeight, 400);
  const xAxisUnitLabel = normalizeText(chartStyle.xAxisUnitLabel, "");
  const yAxisUnitLabel = normalizeText(chartStyle.yAxisUnitLabel, "");
  nextOption.grid = {
    ...(nextOption.grid || {}),
    left: resolvedPadding.left + barAxisExtraLeft + barLegendExtraLeft,
    right: resolvedPadding.right + barLegendExtraRight,
    top: resolvedPadding.top + barLegendExtraTop,
    bottom: resolvedPadding.bottom + Math.max(barAxisExtraBottom, barLegendExtraBottom),
    containLabel: true,
  };
  if (chartStyle.showLegend === false) {
    delete nextOption.legend;
  }
  if (chartStyle.showAxis === false) {
    if (nextOption.xAxis) nextOption.xAxis = Array.isArray(nextOption.xAxis) ? nextOption.xAxis.map((item) => ({ ...item, show: false })) : { ...nextOption.xAxis, show: false };
    if (nextOption.yAxis) nextOption.yAxis = Array.isArray(nextOption.yAxis) ? nextOption.yAxis.map((item) => ({ ...item, show: false })) : { ...nextOption.yAxis, show: false };
  }
  if (typeof chartStyle.showXAxis === "boolean" && nextOption.xAxis) {
    const applyAxisVisibility = (axis) => ({
      ...axis,
      show: chartStyle.showXAxis,
      axisLine: { ...(axis.axisLine || {}), show: chartStyle.showXAxis },
      axisTick: { ...(axis.axisTick || {}), show: chartStyle.showXAxis },
      axisLabel: { ...(axis.axisLabel || {}), show: chartStyle.showXAxis },
    });
    nextOption.xAxis = Array.isArray(nextOption.xAxis) ? nextOption.xAxis.map(applyAxisVisibility) : applyAxisVisibility(nextOption.xAxis);
  }
  if (typeof chartStyle.showYAxis === "boolean" && nextOption.yAxis) {
    const applyAxisVisibility = (axis) => ({
      ...axis,
      show: chartStyle.showYAxis,
      axisLine: { ...(axis.axisLine || {}), show: chartStyle.showYAxis },
      axisTick: { ...(axis.axisTick || {}), show: chartStyle.showYAxis },
      axisLabel: { ...(axis.axisLabel || {}), show: chartStyle.showYAxis },
    });
    nextOption.yAxis = Array.isArray(nextOption.yAxis) ? nextOption.yAxis.map(applyAxisVisibility) : applyAxisVisibility(nextOption.yAxis);
  }
  if (nextOption.xAxis) {
    const applyAxis = (axis) => ({
      ...axis,
      name: xAxisUnitLabel || axis.name,
      nameTextStyle: {
        ...((axis.nameTextStyle || {})),
        color: axisLabelColor || (axis.nameTextStyle || {}).color,
        fontSize: axisLabelFontSize || (axis.nameTextStyle || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.nameTextStyle || {}).fontWeight,
      },
      axisLine: {
        ...(axis.axisLine || {}),
        lineStyle: {
          ...((axis.axisLine || {}).lineStyle || {}),
          color: axisColor || (axis.axisLine || {}).lineStyle?.color,
        },
      },
      axisLabel: {
        ...(axis.axisLabel || {}),
        color: axisLabelColor || (axis.axisLabel || {}).color,
        fontSize: axisLabelFontSize || (axis.axisLabel || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.axisLabel || {}).fontWeight,
      },
      splitLine: {
        ...(axis.splitLine || {}),
        show: Boolean(chartStyle.showGridLines),
        lineStyle: {
          ...((axis.splitLine || {}).lineStyle || {}),
          color: splitLineColor || (axis.splitLine || {}).lineStyle?.color,
        },
      },
    });
    nextOption.xAxis = Array.isArray(nextOption.xAxis) ? nextOption.xAxis.map(applyAxis) : applyAxis(nextOption.xAxis);
  }
  if (nextOption.yAxis) {
    const applyAxis = (axis) => ({
      ...axis,
      name: yAxisUnitLabel || axis.name,
      nameTextStyle: {
        ...((axis.nameTextStyle || {})),
        color: axisLabelColor || (axis.nameTextStyle || {}).color,
        fontSize: axisLabelFontSize || (axis.nameTextStyle || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.nameTextStyle || {}).fontWeight,
      },
      axisLine: {
        ...(axis.axisLine || {}),
        lineStyle: {
          ...((axis.axisLine || {}).lineStyle || {}),
          color: axisColor || (axis.axisLine || {}).lineStyle?.color,
        },
      },
      axisLabel: {
        ...(axis.axisLabel || {}),
        color: axisLabelColor || (axis.axisLabel || {}).color,
        fontSize: axisLabelFontSize || (axis.axisLabel || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.axisLabel || {}).fontWeight,
      },
      splitLine: {
        ...(axis.splitLine || {}),
        show: Boolean(chartStyle.showGridLines),
        lineStyle: {
          ...((axis.splitLine || {}).lineStyle || {}),
          color: splitLineColor || (axis.splitLine || {}).lineStyle?.color,
        },
      },
    });
    nextOption.yAxis = Array.isArray(nextOption.yAxis) ? nextOption.yAxis.map(applyAxis) : applyAxis(nextOption.yAxis);
  }
  if (Array.isArray(nextOption.series)) {
    const scatterPalette = Array.isArray(chartStyle.palette) && chartStyle.palette.length
      ? chartStyle.palette
      : [chartStyle.accentColor || "#1677ff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"].filter(Boolean);
    const scatterBorderColor = chartStyle.scatterPointBorderColor || chartStyle.pointBorderColor || chrome.backgroundColor || "#ffffff";
    const scatterBorderWidth = normalizeNumber(chartStyle.scatterPointBorderWidth, 1);
    const scatterOpacity = Math.max(0, Math.min(1, Number(chartStyle.scatterPointOpacity ?? 0.82)));
    const scatterLabelPosition = chartStyle.scatterLabelPosition || "top";
    const scatterSymbolSize = normalizeNumber(chartStyle.scatterSymbolSize, 16);
    nextOption.series = nextOption.series.map((item) => ({
      ...item,
      label: {
        ...(item.label || {}),
        show: item.type === "map" || item.type === "pie" || item.type === "funnel" || item.type === "radar"
          ? chartStyle.showLabels !== false
          : item.type === "pictorialBar"
            ? false
            : chartStyle.showLabels !== false,
        position: item.type === "bar"
          ? resolveBarLabelPosition(isHorizontalBarChart, chartStyle.barValuePosition)
          : item.type === "scatter"
            ? scatterLabelPosition
          : item.label?.position,
        color: chartStyle.dataLabelColor || "#ffffff",
        fontSize: chartStyle.dataLabelFontSize || 14,
        fontWeight: chartStyle.dataLabelFontWeight || 500,
      },
    }));
    nextOption.series = nextOption.series.map((item, seriesIndex) => (
      item.type === "scatter"
        ? {
          ...item,
          name: item.name || chartStyle.legendPrimaryName || "散点",
          symbolSize: normalizeNumber(item.symbolSize ?? chartStyle.scatterSymbolSize, 16),
          itemStyle: {
            ...(item.itemStyle || {}),
            color: item.itemStyle?.color || scatterPalette[seriesIndex % Math.max(1, scatterPalette.length)] || chartStyle.accentColor || "#1677ff",
            opacity: scatterOpacity,
            borderColor: scatterBorderColor,
            borderWidth: scatterBorderWidth,
          },
          data: Array.isArray(item.data)
            ? item.data.map((entry, dataIndex) => {
              const paletteColor = scatterPalette[dataIndex % Math.max(1, scatterPalette.length)] || chartStyle.accentColor || "#1677ff";
              if (entry && typeof entry === "object" && !Array.isArray(entry)) {
                return {
                  ...entry,
                  symbolSize: normalizeNumber(entry.symbolSize ?? scatterSymbolSize, scatterSymbolSize),
                  itemStyle: {
                    ...(entry.itemStyle || {}),
                    color: paletteColor,
                    opacity: scatterOpacity,
                    borderColor: scatterBorderColor,
                    borderWidth: scatterBorderWidth,
                  },
                  label: {
                    ...(entry.label || {}),
                    show: chartStyle.showLabels !== false,
                    position: scatterLabelPosition,
                    color: chartStyle.dataLabelColor || "#344054",
                    fontSize: chartStyle.dataLabelFontSize || 14,
                    fontWeight: chartStyle.dataLabelFontWeight || 500,
                  },
                };
              }
              return {
                value: entry,
                symbolSize: scatterSymbolSize,
                itemStyle: {
                  color: paletteColor,
                  opacity: scatterOpacity,
                  borderColor: scatterBorderColor,
                  borderWidth: scatterBorderWidth,
                },
                label: {
                  show: chartStyle.showLabels !== false,
                  position: scatterLabelPosition,
                  color: chartStyle.dataLabelColor || "#344054",
                  fontSize: chartStyle.dataLabelFontSize || 14,
                  fontWeight: chartStyle.dataLabelFontWeight || 500,
                },
              };
            })
            : item.data,
        }
        : item
    ));
    if (mapStyle.provinceCode) {
      nextOption.series = nextOption.series.map((item) => (
        item.type === "map" ? { ...item, map: mapStyle.provinceCode } : item
      ));
    }
    nextOption.series = nextOption.series.map((item) => (
      item.type === "map"
        ? {
          ...item,
          roam: true,
          center: Array.isArray(mapStyle.center) ? mapStyle.center : item.center,
          zoom: typeof mapStyle.zoom === "number" ? mapStyle.zoom : item.zoom,
          itemStyle: {
            ...(item.itemStyle || {}),
            borderColor: chartStyle.mapRegionBorderColor || item.itemStyle?.borderColor,
          },
          label: {
            ...(item.label || {}),
            color: chartStyle.mapLabelColor || item.label?.color,
          },
        }
        : item
    ));
    if (chartAnalysis.showExtrema) {
      nextOption.series = nextOption.series.map((item) => ({
        ...item,
        markPoint: {
          ...(item.markPoint || {}),
          data: [{ type: "max", name: "最大值" }, { type: "min", name: "最小值" }],
        },
      }));
    }
  }
  if (isScatterChart && !nextOption.legend && chartStyle.showLegend !== false) {
    const scatterLegendSeries = Array.isArray(nextOption.series)
      ? nextOption.series.filter((item) => item?.type === "scatter")
      : [];
    nextOption.legend = {
      data: scatterLegendSeries.map((item, index) => item.name || chartStyle.legendPrimaryName || `散点${index + 1}`),
      top: legendPosition === "top" ? 4 : undefined,
      bottom: legendPosition === "bottom" ? 4 : undefined,
      left: legendPosition === "left" ? 8 : legendPosition === "right" ? undefined : "center",
      right: legendPosition === "right" ? 8 : undefined,
      orient: legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal",
    };
  }
  if (nextOption.legend) {
    nextOption.legend = {
      ...(nextOption.legend || {}),
      show: chartStyle.showLegend !== false,
      top: legendPosition === "top" ? 4 : undefined,
      bottom: legendPosition === "bottom" ? 4 : undefined,
      left: legendPosition === "left" ? 8 : legendPosition === "right" ? undefined : "center",
      right: legendPosition === "right" ? 8 : undefined,
      orient: legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal",
      textStyle: {
        ...((nextOption.legend || {}).textStyle || {}),
        color: chartStyle.legendTextColor || ((nextOption.legend || {}).textStyle || {}).color,
        fontSize: chartStyle.legendFontSize || ((nextOption.legend || {}).textStyle || {}).fontSize || 14,
        fontWeight: chartStyle.legendFontWeight || ((nextOption.legend || {}).textStyle || {}).fontWeight || 500,
      },
    };
  }
  if (nextOption.visualMap || (Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "map"))) {
    nextOption.visualMap = {
      ...(nextOption.visualMap || {}),
      inRange: {
        ...(((nextOption.visualMap || {}).inRange) || {}),
        color: getMapRegionPalette(chartStyle),
      },
      textStyle: {
        ...((nextOption.visualMap || {}).textStyle || {}),
        color: chartStyle.mapVisualMapTextColor || ((nextOption.visualMap || {}).textStyle || {}).color,
      },
    };
  }
  return nextOption;
}

function buildDefaultChartAssets() {
  return [
    {
      chartName: "基础柱状图",
      chartCode: "builtin_bar_basic",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "适合类别对比的基础柱状图模板",
      tags: ["bar", "compare"],
      config: {
        chartFamily: "bar",
        variantName: "基础蓝柱",
        palettePreset: "ocean",
        accentColor: "#1677ff",
        xField: "category",
        yField: "value",
        color: "#1677ff",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [], itemStyle: { borderRadius: [6, 6, 0, 0] } }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "指标字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "霓虹渐变柱图",
      chartCode: "builtin_bar_gradient_neon",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "高对比霓虹渐变柱图，适合大屏和重点指标展示",
      tags: ["bar", "gradient", "neon"],
      config: {
        chartFamily: "bar",
        variantName: "霓虹渐变",
        palettePreset: "neon",
        accentColor: "#14f1ff",
        xField: "category",
        yField: "value",
        colorStart: "#34d3ff",
        colorEnd: "#267dff",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        grid: { left: 24, right: 24, top: 24, bottom: 24, containLabel: true },
        xAxis: { type: "category", data: [], axisLine: { lineStyle: { color: "#9fb9ff" } } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(113,142,191,0.18)" } } },
        series: [{ type: "bar", data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "指标字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "金属质感柱图",
      chartCode: "builtin_bar_metal",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "高光金属质感柱图，适合正式报表和高端驾驶舱",
      tags: ["bar", "metal", "luxury"],
      config: {
        chartFamily: "bar",
        variantName: "金属质感",
        palettePreset: "gold",
        accentColor: "#d7a129",
        xField: "category",
        yField: "value",
        colorStart: "#f9e08b",
        colorEnd: "#c28a14",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [], itemStyle: { borderRadius: [12, 12, 0, 0] } }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "指标字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "胶囊柱图",
      chartCode: "builtin_bar_capsule",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "柔和圆角的胶囊柱图，更适合会员报告和商业仪表盘",
      tags: ["bar", "capsule", "soft"],
      config: {
        chartFamily: "bar",
        variantName: "胶囊风格",
        palettePreset: "fresh",
        accentColor: "#52c41a",
        xField: "category",
        yField: "value",
        colorStart: "#8ce99a",
        colorEnd: "#34a853",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [], barWidth: 24, itemStyle: { borderRadius: 999 } }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "指标字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "影子立体柱图",
      chartCode: "builtin_bar_shadow_volume",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "带投影和体积感的柱图，适合重点对比展示",
      tags: ["bar", "shadow", "volume"],
      config: {
        chartFamily: "bar",
        variantName: "投影视觉",
        palettePreset: "sunset",
        accentColor: "#ff7a45",
        xField: "category",
        yField: "value",
        colorStart: "#ffbb7a",
        colorEnd: "#ff7a45",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [], itemStyle: { borderRadius: [10, 10, 0, 0], shadowBlur: 16, shadowColor: "rgba(255,122,69,0.28)" } }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "指标字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "堆叠柱状图",
      chartCode: "builtin_bar_stacked",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "适合分组对比的堆叠柱状图模板",
      tags: ["bar", "stacked", "compare"],
      config: {
        chartFamily: "bar",
        variantName: "堆叠经典",
        palettePreset: "business",
        accentColor: "#5b8ff9",
        xField: "category",
        yField: "value",
        seriesField: "series_name",
      },
      optionTemplate: {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        legend: {},
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "指标字段", required: true, acceptRoles: ["metric", "value"] },
          { key: "seriesField", label: "系列字段", required: false, acceptRoles: ["dimension", "category"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "基础折线图",
      chartCode: "builtin_line_basic",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "适合趋势分析的基础折线图模板",
      tags: ["line", "trend"],
      config: {
        chartFamily: "line",
        variantName: "经典折线",
        palettePreset: "ocean",
        accentColor: "#13c2c2",
        xField: "category",
        yField: "value",
        smooth: true,
        color: "#13c2c2",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "line", smooth: true, data: [], areaStyle: { opacity: 0.12 } }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "霓虹光带折线图",
      chartCode: "builtin_line_glow",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "带高光和阴影的炫彩折线图，适合关键趋势展示",
      tags: ["line", "glow", "trend"],
      config: {
        chartFamily: "line",
        variantName: "霓虹光带",
        palettePreset: "neon",
        accentColor: "#2de2e6",
        xField: "category",
        yField: "value",
        smooth: true,
        color: "#2de2e6",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "line", smooth: true, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "双渐变面积折线图",
      chartCode: "builtin_line_dual_gradient",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "适合营收、流量等趋势的双层渐变折线面积图",
      tags: ["line", "gradient", "area"],
      config: {
        chartFamily: "line",
        variantName: "双渐变面积",
        palettePreset: "skyline",
        accentColor: "#4f8cff",
        xField: "category",
        yField: "value",
        smooth: true,
        colorStart: "#83b7ff",
        colorEnd: "#3867ff",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "line", smooth: true, data: [], areaStyle: { opacity: 0.24 } }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "阶梯折线图",
      chartCode: "builtin_line_step",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "适合阈值、阶段变化的阶梯折线图",
      tags: ["line", "step", "trend"],
      config: {
        chartFamily: "line",
        variantName: "阶梯风格",
        palettePreset: "tech",
        accentColor: "#5f63ff",
        xField: "category",
        yField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "line", step: "middle", data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "丝滑极细折线图",
      chartCode: "builtin_line_slim",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "适合轻盈风格分析页的细线趋势图",
      tags: ["line", "slim", "minimal"],
      config: {
        chartFamily: "line",
        variantName: "极细简约",
        palettePreset: "mint",
        accentColor: "#36cfc9",
        xField: "category",
        yField: "value",
        smooth: true,
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "line", smooth: true, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "面积图",
      chartCode: "builtin_area_basic",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "适合展示时间序列趋势和波动区间的面积图模板",
      tags: ["area", "trend"],
      config: {
        chartFamily: "line",
        variantName: "基础面积",
        palettePreset: "fresh",
        accentColor: "#52c41a",
        xField: "category",
        yField: "value",
        smooth: true,
        color: "#52c41a",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "line", smooth: true, data: [], areaStyle: { opacity: 0.2 } }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "轻柔堆叠面积图",
      chartCode: "builtin_area_soft_stack",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "适合展示多个系列占比变化的柔和彩色面积图",
      tags: ["area", "soft", "stacked"],
      config: {
        chartFamily: "line",
        variantName: "柔和堆叠",
        palettePreset: "pastel",
        accentColor: "#84cc16",
        xField: "category",
        yField: "value",
        seriesField: "series_name",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        legend: {},
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
          { key: "seriesField", label: "系列字段", required: true, acceptRoles: ["dimension", "category"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "基础饼图",
      chartCode: "builtin_pie_basic",
      chartType: "echarts",
      category: "占比分析",
      renderMode: "dataset",
      description: "适合占比分析的基础饼图模板",
      tags: ["pie", "ratio"],
      config: {
        chartFamily: "pie",
        variantName: "经典环形",
        palettePreset: "business",
        accentColor: "#1677ff",
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        legend: { bottom: 0 },
        series: [{ type: "pie", radius: ["40%", "70%"], avoidLabelOverlap: true, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "名称字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "散点图",
      chartCode: "builtin_scatter_basic",
      chartType: "echarts",
      category: "关系分析",
      renderMode: "dataset",
      description: "适合分析两个指标间关系的散点图模板",
      tags: ["scatter", "relation"],
      config: {
        xField: "x_value",
        yField: "y_value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        series: [{ type: "scatter", data: [], symbolSize: 16 }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 指标字段", required: true, acceptRoles: ["metric", "value"] },
          { key: "yField", label: "Y 指标字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "雷达图",
      chartCode: "builtin_radar_basic",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "适合多指标横向对比的雷达图模板",
      tags: ["radar", "compare"],
      config: {
        nameField: "category",
        valueField: "value",
        valueField2: "",
      },
      optionTemplate: {
        tooltip: {},
        radar: { indicator: [] },
        series: [{ type: "radar", data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "指标名称字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "指标字段一", required: true, acceptRoles: ["metric", "value"] },
          { key: "valueField2", label: "指标字段二（可选）", required: false, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "漏斗图",
      chartCode: "builtin_funnel_basic",
      chartType: "echarts",
      category: "转化分析",
      renderMode: "dataset",
      description: "适合阶段转化分析的漏斗图模板",
      tags: ["funnel", "conversion"],
      config: {
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        series: [{ type: "funnel", data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "阶段字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "词云图",
      chartCode: "builtin_wordcloud_basic",
      chartType: "echarts",
      category: "文本分析",
      renderMode: "dataset",
      description: "适合热词、标签聚类和舆情关键词分布的词云图模板",
      tags: ["wordcloud", "text", "keyword"],
      config: {
        chartFamily: "wordCloud",
        variantName: "基础词云",
        palettePreset: "business",
        accentColor: "#1677ff",
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item", formatter: "{b}: {c}" },
        series: [{
          type: "wordCloud",
          shape: "circle",
          left: "center",
          top: "center",
          width: "100%",
          height: "100%",
          sizeRange: [16, 52],
          rotationRange: [-90, 90],
          rotationStep: 45,
          gridSize: 10,
          drawOutOfBound: false,
          textStyle: {
            fontFamily: "sans-serif",
            fontWeight: 700,
          },
          emphasis: {
            focus: "self",
            textStyle: {
              shadowBlur: 12,
              shadowColor: "rgba(15,23,42,0.14)",
            },
          },
          data: [],
        }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "词项字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "权重字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "仪表盘",
      chartCode: "builtin_gauge_basic",
      chartType: "echarts",
      category: "指标监控",
      renderMode: "dataset",
      description: "适合单指标进度和达成率展示的仪表盘模板",
      tags: ["gauge", "kpi"],
      config: {
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { formatter: "{a}<br/>{b}: {c}%" },
        series: [{ type: "gauge", progress: { show: true }, detail: { valueAnimation: true }, data: [{ value: 0, name: "指标" }] }],
      },
      mappingSchema: {
        fields: [
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "立体柱状图",
      chartCode: "builtin_bar_3d_like",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "使用伪 3D 柱体和高光顶面增强视觉冲击的柱状图模板",
      tags: ["bar", "3d", "pictorial"],
      config: {
        xField: "category",
        yField: "value",
        color: "#3f8cff",
      },
      optionTemplate: {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { left: 24, right: 24, top: 24, bottom: 24, containLabel: true },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "指标字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "横向排名条形图",
      chartCode: "builtin_bar_horizontal",
      chartType: "echarts",
      category: "比较分析",
      renderMode: "dataset",
      description: "适合 TopN 排名和横向比较的条形图模板",
      tags: ["bar", "ranking", "horizontal"],
      config: {
        xField: "value",
        yField: "category",
        color: "#5b8ff9",
      },
      optionTemplate: {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { left: 24, right: 24, top: 24, bottom: 24, containLabel: true },
        xAxis: { type: "value" },
        yAxis: { type: "category", data: [] },
        series: [{ type: "bar", data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
          { key: "yField", label: "分类字段", required: true, acceptRoles: ["dimension", "category"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "堆叠面积图",
      chartCode: "builtin_area_stacked",
      chartType: "echarts",
      category: "趋势分析",
      renderMode: "dataset",
      description: "适合按系列累计趋势展示的堆叠面积图模板",
      tags: ["area", "stacked", "trend"],
      config: {
        xField: "category",
        yField: "value",
        seriesField: "series_name",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        legend: {},
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 轴字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 轴字段", required: true, acceptRoles: ["metric", "value"] },
          { key: "seriesField", label: "系列字段", required: true, acceptRoles: ["dimension", "category"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "彩色多环图",
      chartCode: "builtin_pie_multi_ring",
      chartType: "echarts",
      category: "占比分析",
      renderMode: "dataset",
      description: "带柔和彩环和精致标签的高颜值环图模板",
      tags: ["pie", "ring", "colorful"],
      config: {
        chartFamily: "pie",
        variantName: "彩色多环",
        palettePreset: "rainbow",
        accentColor: "#7c5cff",
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        legend: { bottom: 0 },
        series: [{ type: "pie", radius: ["48%", "72%"], data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "名称字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "半环 KPI 图",
      chartCode: "builtin_pie_half_ring",
      chartType: "echarts",
      category: "占比分析",
      renderMode: "dataset",
      description: "适合会员报告和总览卡片的半环 KPI 图",
      tags: ["pie", "half", "kpi"],
      config: {
        chartFamily: "pie",
        variantName: "半环KPI",
        palettePreset: "sunset",
        accentColor: "#ff7a45",
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        series: [{ type: "pie", startAngle: 180, radius: ["56%", "82%"], center: ["50%", "72%"], data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "名称字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "玻璃质感环图",
      chartCode: "builtin_pie_glass",
      chartType: "echarts",
      category: "占比分析",
      renderMode: "dataset",
      description: "带高光边缘和透明层次的精致环图模板",
      tags: ["pie", "glass", "premium"],
      config: {
        chartFamily: "pie",
        variantName: "玻璃质感",
        palettePreset: "aqua",
        accentColor: "#36cfc9",
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        legend: { bottom: 0 },
        series: [{ type: "pie", radius: ["42%", "68%"], itemStyle: { borderColor: "#ffffff", borderWidth: 3 }, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "名称字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "南丁格尔玫瑰图",
      chartCode: "builtin_rose_pie",
      chartType: "echarts",
      category: "占比分析",
      renderMode: "dataset",
      description: "适合重点分类强调的玫瑰图模板",
      tags: ["pie", "rose", "ratio"],
      config: {
        chartFamily: "pie",
        variantName: "玫瑰图",
        palettePreset: "rose",
        accentColor: "#ff5c8a",
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        legend: { bottom: 0 },
        series: [{ type: "pie", radius: [24, 110], roseType: "area", data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "名称字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "热力图",
      chartCode: "builtin_heatmap_basic",
      chartType: "echarts",
      category: "分布分析",
      renderMode: "dataset",
      description: "适合二维分布和强度分析的热力图模板",
      tags: ["heatmap", "matrix"],
      config: {
        xField: "x_name",
        yField: "y_name",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { position: "top" },
        grid: { height: "70%", top: "10%" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "category", data: [] },
        visualMap: { min: 0, max: 100, calculable: true, orient: "horizontal", left: "center", bottom: "4%" },
        series: [{ type: "heatmap", data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "X 维度字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "yField", label: "Y 维度字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "中国地图",
      chartCode: "builtin_china_map_basic",
      chartType: "echarts",
      category: "区域分析",
      renderMode: "dataset",
      description: "支持全国省级按 6 位行政区划编码渲染的中国地图模板",
      tags: ["map", "china", "adcode"],
      config: {
        mapField: "adcode",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true },
        series: [{ type: "map", map: "china", roam: true, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "mapField", label: "行政区划编码字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "中国地图·商务蓝",
      chartCode: "builtin_china_map_business",
      chartType: "echarts",
      category: "区域分析",
      renderMode: "dataset",
      description: "商务驾驶舱风格的中国地图模板",
      tags: ["map", "china", "business", "adcode"],
      config: {
        chartFamily: "map",
        variantName: "商务蓝",
        palettePreset: "business",
        accentColor: "#5b8ff9",
        mapField: "adcode",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true, textStyle: { color: "#5d7092" } },
        series: [{ type: "map", map: "china", roam: true, itemStyle: { areaColor: "#eaf2ff", borderColor: "#8fb7ff" }, emphasis: { itemStyle: { areaColor: "#5b8ff9" } }, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "mapField", label: "行政区划编码字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "中国地图·霓虹夜景",
      chartCode: "builtin_china_map_neon",
      chartType: "echarts",
      category: "区域分析",
      renderMode: "dataset",
      description: "适合大屏夜景驾驶舱的霓虹中国地图模板",
      tags: ["map", "china", "neon", "adcode"],
      config: {
        chartFamily: "map",
        variantName: "霓虹夜景",
        palettePreset: "neon",
        accentColor: "#14f1ff",
        mapField: "adcode",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true, textStyle: { color: "#d8fbff" } },
        series: [{ type: "map", map: "china", roam: true, itemStyle: { areaColor: "#102a43", borderColor: "#2fe3ff" }, emphasis: { itemStyle: { areaColor: "#1d4ed8" } }, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "mapField", label: "行政区划编码字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "中国地图·暖金运营",
      chartCode: "builtin_china_map_gold",
      chartType: "echarts",
      category: "区域分析",
      renderMode: "dataset",
      description: "适合商业汇报和运营看板的暖金中国地图模板",
      tags: ["map", "china", "gold", "adcode"],
      config: {
        chartFamily: "map",
        variantName: "暖金运营",
        palettePreset: "gold",
        accentColor: "#d7a129",
        mapField: "adcode",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true, textStyle: { color: "#7c5a10" } },
        series: [{ type: "map", map: "china", roam: true, itemStyle: { areaColor: "#fff8e1", borderColor: "#d4a72c" }, emphasis: { itemStyle: { areaColor: "#f6c453" } }, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "mapField", label: "行政区划编码字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "树图",
      chartCode: "builtin_treemap_basic",
      chartType: "echarts",
      category: "层级分析",
      renderMode: "dataset",
      description: "适合多层级占比和分层规模分析的树图模板",
      tags: ["treemap", "hierarchy"],
      config: {
        nameField: "category",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { formatter: "{b}: {c}" },
        series: [{ type: "treemap", roam: false, data: [] }],
      },
      mappingSchema: {
        fields: [
          { key: "nameField", label: "名称字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "数值字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "桑基图",
      chartCode: "builtin_sankey_basic",
      chartType: "echarts",
      category: "流向分析",
      renderMode: "dataset",
      description: "适合来源去向和流量转移分析的桑基图模板",
      tags: ["sankey", "flow"],
      config: {
        sourceField: "source_name",
        targetField: "target_name",
        valueField: "value",
      },
      optionTemplate: {
        tooltip: { trigger: "item" },
        series: [{
          type: "sankey",
          left: 12,
          right: 12,
          top: 8,
          bottom: 8,
          nodeWidth: 16,
          nodeGap: 18,
          nodeAlign: "justify",
          draggable: false,
          emphasis: { focus: "adjacency" },
          lineStyle: { color: "gradient", opacity: 0.28, curveness: 0.5 },
          labelLayout: { hideOverlap: false },
          data: [],
          links: [],
        }],
      },
      mappingSchema: {
        fields: [
          { key: "sourceField", label: "来源字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "targetField", label: "去向字段", required: true, acceptRoles: ["dimension", "category"] },
          { key: "valueField", label: "权重字段", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "柱线组合图",
      chartCode: "builtin_combo_bar_line",
      chartType: "echarts",
      category: "组合图",
      renderMode: "dataset",
      description: "适合数量与趋势同屏展示的柱线组合图模板",
      tags: ["combo", "bar", "line"],
      config: {
        chartFamily: "combo",
        variantName: "柱线组合",
        palettePreset: "business",
        accentColor: "#1677ff",
        xField: "category",
        barField: "value",
        lineField: "line_value",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        legend: {},
        xAxis: { type: "category", data: [] },
        yAxis: [{ type: "value" }, { type: "value" }],
        series: [],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "barField", label: "柱图指标", required: true, acceptRoles: ["metric", "value"] },
          { key: "lineField", label: "折线指标", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "双轴柱线图",
      chartCode: "builtin_combo_dual_axis",
      chartType: "echarts",
      category: "组合图",
      renderMode: "dataset",
      description: "适合两个量纲差异较大指标的双轴柱线组合图",
      tags: ["combo", "dual-axis", "line"],
      config: {
        chartFamily: "combo",
        variantName: "双轴柱线",
        palettePreset: "neon",
        accentColor: "#5f63ff",
        xField: "category",
        barField: "value",
        lineField: "line_value",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        legend: {},
        xAxis: { type: "category", data: [] },
        yAxis: [{ type: "value" }, { type: "value" }],
        series: [],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "barField", label: "柱图指标", required: true, acceptRoles: ["metric", "value"] },
          { key: "lineField", label: "折线指标", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
    {
      chartName: "柱面组合图",
      chartCode: "builtin_combo_bar_area",
      chartType: "echarts",
      category: "组合图",
      renderMode: "dataset",
      description: "适合体量和趋势面积同屏展示的柱面组合图",
      tags: ["combo", "bar", "area"],
      config: {
        chartFamily: "combo",
        variantName: "柱面组合",
        palettePreset: "sunset",
        accentColor: "#ff7a45",
        xField: "category",
        barField: "value",
        lineField: "line_value",
      },
      optionTemplate: {
        tooltip: { trigger: "axis" },
        legend: {},
        xAxis: { type: "category", data: [] },
        yAxis: [{ type: "value" }, { type: "value" }],
        series: [],
      },
      mappingSchema: {
        fields: [
          { key: "xField", label: "分类字段", required: true, acceptRoles: ["dimension", "category", "time"] },
          { key: "barField", label: "柱图指标", required: true, acceptRoles: ["metric", "value"] },
          { key: "lineField", label: "面积指标", required: true, acceptRoles: ["metric", "value"] },
        ],
      },
      ownerName: "System Administrator",
      status: "active",
      isBuiltin: true,
    },
  ].map((asset) => {
    const nextConfig = asset.config && typeof asset.config === "object" ? { ...asset.config } : {};
    if (!nextConfig.chartFamily) {
      nextConfig.chartFamily = normalizeChartFamily(asset.chartCode || asset.chartName || asset.category);
    }
    if (!nextConfig.variantName) {
      nextConfig.variantName = asset.chartName;
    }
    return {
      ...asset,
      config: nextConfig,
    };
  });
}

function buildChartOption(asset, rows = [], fieldMap = {}, styleOverrides = {}) {
  const optionTemplate = asset.optionTemplate || {};
  const config = { ...(asset.config || {}), ...(styleOverrides || {}) };
  const hasStyleOverride = Boolean(styleOverrides.palettePreset || styleOverrides.accentColor);
  const provinceNameMap = {
    "11": "北京", "12": "天津", "13": "河北", "14": "山西", "15": "内蒙古",
    "21": "辽宁", "22": "吉林", "23": "黑龙江", "31": "上海", "32": "江苏",
    "33": "浙江", "34": "安徽", "35": "福建", "36": "江西", "37": "山东",
    "41": "河南", "42": "湖北", "43": "湖南", "44": "广东", "45": "广西",
    "46": "海南", "50": "重庆", "51": "四川", "52": "贵州", "53": "云南",
    "54": "西藏", "61": "陕西", "62": "甘肃", "63": "青海", "64": "宁夏",
    "65": "新疆", "71": "台湾", "81": "香港", "82": "澳门",
  };

  const paletteMap = {
    ocean: ["#1677ff", "#69b1ff", "#91caff", "#bae0ff"],
    business: ["#5b8ff9", "#5d7092", "#61d9a5", "#65789b"],
    neon: ["#14f1ff", "#267dff", "#7c5cff", "#ff7ad9"],
    gold: ["#d7a129", "#f9e08b", "#c28a14", "#8c6a0a"],
    fresh: ["#52c41a", "#8ce99a", "#34a853", "#d9f7be"],
    sunset: ["#ff7a45", "#ffbb7a", "#ff9c6e", "#ffd8bf"],
    rainbow: ["#7c5cff", "#ff7ad9", "#36cfc9", "#fadb14"],
    rose: ["#ff5c8a", "#ffa0c4", "#d6336c", "#ffd6e7"],
    aqua: ["#36cfc9", "#5eead4", "#08979c", "#ccfbf1"],
    pastel: ["#84cc16", "#c4b5fd", "#f9a8d4", "#93c5fd"],
    skyline: ["#4f8cff", "#83b7ff", "#3867ff", "#c7d8ff"],
    tech: ["#5f63ff", "#8a8dff", "#2b2fbb", "#c7c9ff"],
    mint: ["#36cfc9", "#8ce3dd", "#13c2c2", "#d2f5f3"],
  };

  function getPaletteColors() {
    if (Array.isArray(config.palette) && config.palette.length) {
      return config.palette;
    }
    return paletteMap[config.palettePreset] || paletteMap.ocean;
  }

  function getAccentColor(fallback = "#1677ff") {
    return config.accentColor || config.color || fallback;
  }

  function buildBarSeriesOption({
    xField,
    yField,
    yField2,
    color,
    colorStart,
    colorEnd,
    borderRadius,
    shadowBlur,
    shadowColor,
    barWidth,
    topColor,
    chartCode,
  }) {
    const paletteColors = getPaletteColors();
    const accentColor = getAccentColor("#1677ff");
    const secondaryColor = config.barSecondaryColor || paletteColors[1] || "#55c6a9";
    const resolvedTopColor = topColor || config.barTopColor || paletteColors[2] || "#a8c6ff";
    const gradientStart = hasStyleOverride ? (paletteColors[1] || accentColor) : colorStart;
    const gradientEnd = hasStyleOverride ? accentColor : colorEnd;
    const resolvedColor = colorStart && colorEnd
      ? {
        type: "linear",
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: gradientStart },
          { offset: 1, color: gradientEnd },
        ],
      }
      : (color || accentColor);
    const resolvedShadowColor = shadowColor || `${paletteColors[1] || accentColor}66`;
    const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
    const baseItemStyle = baseSeries.itemStyle || {};
    const categories = rows.map((row) => row[xField]);
    const primaryValues = rows.map((row) => Number(row[yField] || 0));
    const secondaryValues = yField2 ? rows.map((row) => Number(row[yField2] || 0)) : [];
    const buildBarSeries = (name, data, colorValue, index = 0) => ({
      ...baseSeries,
      type: "bar",
      name,
      data,
      stack: config.barSeriesLayout === "stacked" ? "total" : undefined,
      barGap: config.barSeriesLayout === "overlap" ? "-35%" : (config.barGap || "30%"),
      barCategoryGap: config.barCategoryGap || "40%",
      barWidth: barWidth || config.barWidth || baseSeries.barWidth,
      z: config.barSeriesLayout === "overlap" ? (10 - index) : baseSeries.z,
      itemStyle: {
        ...baseItemStyle,
        color: colorValue,
        borderRadius: borderRadius ?? config.barBorderRadius ?? baseItemStyle.borderRadius,
        shadowBlur: shadowBlur ?? baseItemStyle.shadowBlur,
        shadowColor: resolvedShadowColor ?? baseItemStyle.shadowColor,
      },
      label: {
        ...(baseSeries.label || {}),
        position: config.barValuePosition === "inside" ? "inside" : "top",
      },
    });
    const series = [buildBarSeries(yField, primaryValues, resolvedColor, 0)];
    if (yField2 && config.barSeriesLayout !== "single") {
      series.push(buildBarSeries(yField2, secondaryValues, secondaryColor, 1));
    }
    if (chartCode === "builtin_bar_3d_like" && !yField2 && config.barSeriesLayout === "single") {
      const topSeries = (values, index = 0) => ({
        type: "pictorialBar",
        symbol: "diamond",
        symbolSize: [barWidth || config.barWidth || 28, 12],
        symbolOffset: [0, -6],
        symbolPosition: "end",
        z: config.barSeriesLayout === "overlap" ? (20 - index) : 12,
        data: values,
        itemStyle: { color: resolvedTopColor },
        barGap: config.barSeriesLayout === "overlap" ? "-35%" : (config.barGap || "30%"),
        barCategoryGap: config.barCategoryGap || "40%",
      });
      series.push(topSeries(primaryValues, 0));
      if (yField2 && config.barSeriesLayout !== "single") {
        series.push(topSeries(secondaryValues, 1));
      }
    }
    return {
      ...optionTemplate,
      legend: yField2 && config.barSeriesLayout !== "single" ? { ...(optionTemplate.legend || {}), data: [yField, yField2] } : optionTemplate.legend,
      xAxis: { ...(optionTemplate.xAxis || {}), data: categories },
      series,
    };
  }

  function buildLineSeriesOption({
    xField,
    yField,
    color,
    colorStart,
    colorEnd,
    step,
    smooth,
    areaOpacity,
  }) {
    const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
    const paletteColors = getPaletteColors();
    const resolvedColor = color || colorEnd || colorStart || getAccentColor(paletteColors[0] || "#13c2c2");
    const gradientStart = hasStyleOverride ? (paletteColors[1] || resolvedColor) : colorStart;
    const gradientEnd = hasStyleOverride ? resolvedColor : colorEnd;
    const resolvedAreaColor = colorStart && colorEnd
      ? {
        type: "linear",
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: gradientStart },
          { offset: 1, color: gradientEnd },
        ],
      }
      : {
        type: "linear",
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: `${resolvedColor}cc` },
          { offset: 1, color: `${paletteColors[1] || resolvedColor}22` },
        ],
      };
    return {
      ...optionTemplate,
      xAxis: { ...(optionTemplate.xAxis || {}), data: rows.map((row) => row[xField]) },
      series: [
        {
          ...baseSeries,
          type: "line",
          smooth: smooth ?? baseSeries.smooth ?? true,
          step: step ?? baseSeries.step,
          data: rows.map((row) => Number(row[yField] || 0)),
          itemStyle: { ...(baseSeries.itemStyle || {}), color: resolvedColor },
          lineStyle: { ...(baseSeries.lineStyle || {}), color: resolvedColor, width: baseSeries.lineStyle?.width || 3 },
          areaStyle: {
            ...(baseSeries.areaStyle || {}),
            opacity: areaOpacity ?? baseSeries.areaStyle?.opacity,
            color: resolvedAreaColor,
            shadowBlur: asset.chartCode === "builtin_line_glow" ? 18 : baseSeries.areaStyle?.shadowBlur,
            shadowColor: asset.chartCode === "builtin_line_glow" ? `${resolvedColor}99` : baseSeries.areaStyle?.shadowColor,
          },
        },
      ],
    };
  }

  function buildPieSeriesOption({ nameField, valueField, radius, center }) {
    const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
    const paletteColors = getPaletteColors();
    return {
      ...optionTemplate,
      color: paletteColors,
      series: [
        {
          ...baseSeries,
          type: "pie",
          radius: radius || baseSeries.radius,
          center: center || baseSeries.center,
          data: rows.map((row) => ({
            name: row[nameField],
            value: Number(row[valueField] || 0),
          })),
        },
      ],
    };
  }

  function buildStackedAreaOption({ xField, yField, seriesField, opacity = 0.18 }) {
    const categories = Array.from(new Set(rows.map((row) => row[xField])));
    const seriesNames = Array.from(new Set(rows.map((row) => row[seriesField])));
    const paletteColors = getPaletteColors();
    return {
      ...optionTemplate,
      color: paletteColors,
      legend: { ...(optionTemplate.legend || {}), data: seriesNames },
      xAxis: { ...(optionTemplate.xAxis || {}), data: categories },
      series: seriesNames.map((name, index) => ({
        type: "line",
        stack: "total",
        smooth: true,
        areaStyle: { opacity, color: paletteColors[index % paletteColors.length] },
        name,
        data: categories.map((category) => {
          const target = rows.find((row) => row[xField] === category && row[seriesField] === name);
          return target ? Number(target[yField] || 0) : 0;
        }),
      })),
    };
  }

  if (asset.chartCode === "builtin_bar_basic") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const yField2 = fieldMap.yField2 || config.yField2;
    const paletteColors = getPaletteColors();
    const accentColor = config.barPrimaryColor || getAccentColor(paletteColors[0] || "#1677ff");
    const secondaryColor = config.barSecondaryColor || paletteColors[1] || "#55c6a9";
    const categories = rows.map((row) => row[xField]);
    const firstSeries = {
      ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
      type: "bar",
      name: yField,
      data: rows.map((row) => Number(row[yField] || 0)),
      itemStyle: {
        color: accentColor,
        borderRadius: [6, 6, 0, 0],
      },
    };
    if (yField2) {
      return withCompactGrid({
        ...optionTemplate,
        legend: { ...(optionTemplate.legend || {}), data: [yField, yField2] },
        xAxis: { ...(optionTemplate.xAxis || {}), data: categories },
        series: [
          {
            ...firstSeries,
            stack: config.barSeriesLayout === "stacked" ? "total" : undefined,
            barGap: config.barGap || (config.barSeriesLayout === "overlap" ? "-35%" : "30%"),
            barCategoryGap: config.barCategoryGap || "40%",
            barWidth: config.barWidth || 28,
          },
          {
            ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
            type: "bar",
            name: yField2,
            data: rows.map((row) => Number(row[yField2] || 0)),
            stack: config.barSeriesLayout === "stacked" ? "total" : undefined,
            barGap: config.barGap || (config.barSeriesLayout === "overlap" ? "-35%" : "30%"),
            barCategoryGap: config.barCategoryGap || "40%",
            barWidth: config.barWidth || 28,
            itemStyle: {
              color: secondaryColor,
              borderRadius: [6, 6, 0, 0],
            },
          },
        ],
      }, { top: 16, bottom: 10, left: 10, right: 10 });
    }
    return withCompactGrid({
      ...optionTemplate,
      xAxis: { ...(optionTemplate.xAxis || {}), data: categories },
      series: [firstSeries],
    }, { top: 16, bottom: 10, left: 10, right: 10 });
  }

  if (asset.chartCode === "builtin_line_basic") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const accentColor = getAccentColor("#13c2c2");
    return withCompactGrid({
      ...optionTemplate,
      xAxis: { ...(optionTemplate.xAxis || {}), data: rows.map((row) => row[xField]) },
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "line",
          smooth: config.smooth !== false,
          data: rows.map((row) => row[yField]),
          itemStyle: { color: accentColor },
          lineStyle: { color: accentColor },
          areaStyle: { opacity: 0.12, color: accentColor },
        },
      ],
    }, { top: 16, bottom: 10, left: 10, right: 10 });
  }

  if (asset.chartCode === "builtin_bar_stacked") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const seriesField = fieldMap.seriesField || config.seriesField;
    const categories = Array.from(new Set(rows.map((row) => row[xField])));
    const seriesNames = seriesField ? Array.from(new Set(rows.map((row) => row[seriesField]))) : ["值"];
    return {
      ...optionTemplate,
      legend: { ...(optionTemplate.legend || {}), data: seriesNames },
      xAxis: { ...(optionTemplate.xAxis || {}), data: categories },
      series: seriesNames.map((name) => ({
        type: "bar",
        stack: "total",
        name,
        data: categories.map((category) => {
          const target = rows.find((row) => row[xField] === category && (!seriesField || row[seriesField] === name));
          return target ? Number(target[yField] || 0) : 0;
        }),
      })),
    };
  }

  if (
    asset.chartCode === "builtin_bar_gradient_neon"
    || asset.chartCode === "builtin_bar_metal"
    || asset.chartCode === "builtin_bar_capsule"
    || asset.chartCode === "builtin_bar_shadow_volume"
    || asset.chartCode === "builtin_bar_3d_like"
  ) {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const yField2 = fieldMap.yField2 || config.yField2;
    return buildBarSeriesOption({
      xField,
      yField,
      yField2,
      color: config.color,
      colorStart: config.colorStart,
      colorEnd: config.colorEnd,
      borderRadius: Array.isArray(optionTemplate.series?.[0]?.itemStyle?.borderRadius)
        ? optionTemplate.series[0].itemStyle.borderRadius
        : optionTemplate.series?.[0]?.itemStyle?.borderRadius,
      shadowBlur: optionTemplate.series?.[0]?.itemStyle?.shadowBlur,
      shadowColor: optionTemplate.series?.[0]?.itemStyle?.shadowColor,
      barWidth: optionTemplate.series?.[0]?.barWidth,
      topColor: config.barTopColor,
      chartCode: asset.chartCode,
    });
  }

  if (asset.chartCode === "builtin_area_basic") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const accentColor = getAccentColor("#52c41a");
    return {
      ...optionTemplate,
      xAxis: { ...(optionTemplate.xAxis || {}), data: rows.map((row) => row[xField]) },
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "line",
          smooth: true,
          data: rows.map((row) => row[yField]),
          itemStyle: { color: accentColor },
          lineStyle: { color: accentColor },
          areaStyle: { opacity: 0.24, color: accentColor },
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_pie_basic") {
    const nameField = fieldMap.nameField || config.nameField;
    const valueField = fieldMap.valueField || config.valueField;
    return buildPieSeriesOption({ nameField, valueField, radius: ["52%", "82%"], center: ["50%", "48%"] });
  }

  if (asset.chartCode === "builtin_scatter_basic") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    return {
      ...optionTemplate,
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "scatter",
          data: rows.map((row) => [Number(row[xField] || 0), Number(row[yField] || 0)]),
        },
      ],
    };
  }

  if (
    asset.chartCode === "builtin_china_map_basic"
    || asset.chartCode === "builtin_china_map_business"
    || asset.chartCode === "builtin_china_map_neon"
    || asset.chartCode === "builtin_china_map_gold"
  ) {
    const mapField = fieldMap.mapField || config.mapField;
    const valueField = fieldMap.valueField || config.valueField;
    const provinceCode = String(styleOverrides.provinceCode || config.provinceCode || "").trim();
    const mapScope = provinceCode && provinceCode.length === 6 ? provinceCode : "china";
    const mapLabelShow = asset.chartCode !== "builtin_china_map_neon";
    const aggregated = new Map();
    rows.forEach((row) => {
      const rawCode = String(row?.[mapField] ?? "").trim();
      const nextValue = Number(row?.[valueField] ?? 0);
      if (!rawCode || !Number.isFinite(nextValue)) {
        return;
      }
      aggregated.set(rawCode, Number((aggregated.get(rawCode) || 0) + nextValue));
    });
    const data = Array.from(aggregated.entries()).map(([rawCode, value]) => {
      const provincePrefix = String(rawCode).length >= 2 ? String(rawCode).slice(0, 2) : String(rawCode);
      return {
        adcode: String(rawCode),
        name: provinceNameMap[provincePrefix] || String(rawCode),
        value,
      };
    });
    const values = data.map((item) => Number(item.value || 0)).filter((item) => Number.isFinite(item));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 100;
    const inRangeColor = getMapRegionPalette({
      accentColor: styleOverrides.accentColor,
      mapRegionPalette: Array.isArray(styleOverrides.mapRegionPalette) ? styleOverrides.mapRegionPalette : [],
    });
    return {
      ...optionTemplate,
      visualMap: {
        ...(optionTemplate.visualMap || {}),
        min,
        max: max <= min ? min + 1 : max,
        calculable: true,
        inRange: { color: inRangeColor },
        textStyle: {
          ...((optionTemplate.visualMap || {}).textStyle || {}),
          color: styleOverrides.mapVisualMapTextColor || ((optionTemplate.visualMap || {}).textStyle || {}).color,
        },
      },
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "map",
          map: mapScope,
          itemStyle: {
            ...(((Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}) || {}).itemStyle || {}),
            borderColor: styleOverrides.mapRegionBorderColor || ((((Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}) || {}).itemStyle || {}).borderColor),
          },
          label: {
            show: true,
            color: styleOverrides.mapLabelColor || (asset.chartCode === "builtin_china_map_neon" ? "#d8fbff" : "#425466"),
            formatter: (params) => {
              if (styleOverrides.showDataLabels) return params.value ?? "";
              if (styleOverrides.showLabels !== false && mapLabelShow) return params.name || "";
              return "";
            },
          },
          data,
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_radar_basic") {
    const nameField = fieldMap.nameField || config.nameField;
    const valueField = fieldMap.valueField || config.valueField;
    const valueField2 = fieldMap.valueField2 || fieldMap.yField2 || config.valueField2;
    const radarLayout = styleOverrides.radarLayout || config.radarLayout || "single";
    const paletteColors = getPaletteColors();
    const primaryColor = styleOverrides.radarPrimaryColor || styleOverrides.radarPointColor || paletteColors[0] || getAccentColor("#1677ff");
    const secondaryColor = styleOverrides.radarSecondaryColor || paletteColors[1] || "#4f8cff";
    const primaryValues = rows.map((row) => Number(row[valueField] || 0));
    const secondaryValues = valueField2 ? rows.map((row) => Number(row[valueField2] || 0)) : [];
    const maxValue = Math.max(...primaryValues, ...secondaryValues, 1);
    const data = [
      {
        value: primaryValues,
        name: styleOverrides.legendPrimaryName || valueField || "指标一",
        itemStyle: { color: primaryColor, borderColor: primaryColor },
        areaStyle: { color: primaryColor, opacity: Number(styleOverrides.radarAreaOpacity ?? 0.22) },
      },
    ];
    if (radarLayout === "dual" && valueField2) {
      data.push({
        value: secondaryValues,
        name: styleOverrides.legendSecondaryName || valueField2 || "指标二",
        itemStyle: { color: secondaryColor, borderColor: secondaryColor },
        areaStyle: { color: secondaryColor, opacity: Number(styleOverrides.radarAreaOpacity ?? 0.16) },
      });
    }
    return {
      ...optionTemplate,
      color: data.map((item) => item.itemStyle.color),
      legend: data.length > 1 ? { ...(optionTemplate.legend || {}), data: data.map((item) => item.name) } : optionTemplate.legend,
      radar: {
        ...(optionTemplate.radar || {}),
        center: ["50%", "52%"],
        radius: "70%",
        indicator: rows.map((row) => ({ name: String(row[nameField]), max: maxValue })),
      },
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "radar",
          data,
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_funnel_basic") {
    const nameField = fieldMap.nameField || config.nameField;
    const valueField = fieldMap.valueField || config.valueField;
    return {
      ...optionTemplate,
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "funnel",
          data: rows.map((row) => ({ name: row[nameField], value: Number(row[valueField] || 0) })),
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_wordcloud_basic") {
    const nameField = fieldMap.nameField || config.nameField;
    const valueField = fieldMap.valueField || config.valueField;
    return {
      ...optionTemplate,
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "wordCloud",
          data: rows
            .map((row) => ({
              name: String(row[nameField] || ""),
              value: Number(row[valueField] || 0),
            }))
            .filter((item) => item.name),
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_gauge_basic") {
    const valueField = fieldMap.valueField || config.valueField;
    const value = Number(rows?.[0]?.[valueField] || 0);
    return {
      ...optionTemplate,
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "gauge",
          data: [{ value, name: "指标" }],
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_bar_horizontal") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const paletteColors = Array.isArray(config.horizontalBarPalette) && config.horizontalBarPalette.length
      ? config.horizontalBarPalette
      : [
        config.barPrimaryColor || getAccentColor("#5b8ff9"),
        config.barSecondaryColor || "#55c6a9",
        "#f4b95d",
        "#8f7cff",
        "#f28f8f",
      ];
    const colorCount = Math.max(1, Math.min(5, Number(config.horizontalBarColorCount || 1)));
    const rowsWithValue = rows.map((row) => ({
      category: String(row[yField] || ""),
      value: Number(row[xField] || 0),
    }));
    if (config.horizontalBarSortOrder === "desc-top") {
      rowsWithValue.sort((a, b) => b.value - a.value);
    } else if (config.horizontalBarSortOrder === "desc-bottom") {
      rowsWithValue.sort((a, b) => a.value - b.value);
    }
    return {
      ...optionTemplate,
      yAxis: { ...(optionTemplate.yAxis || {}), inverse: true, data: rowsWithValue.map((row) => row.category) },
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "bar",
          data: rowsWithValue.map((row, index) => ({
            value: row.value,
            itemStyle: {
              color: paletteColors[index % colorCount],
              borderRadius: [0, 10, 10, 0],
            },
            label: {
              show: config.showLabels !== false,
              position: config.barValuePosition === "inside" ? "inside" : "right",
            },
          })),
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_area_stacked") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const seriesField = fieldMap.seriesField || config.seriesField;
    return buildStackedAreaOption({ xField, yField, seriesField, opacity: 0.18 });
  }

  if (asset.chartCode === "builtin_area_soft_stack") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const seriesField = fieldMap.seriesField || config.seriesField;
    return buildStackedAreaOption({ xField, yField, seriesField, opacity: 0.3 });
  }

  if (asset.chartCode === "builtin_rose_pie") {
    const nameField = fieldMap.nameField || config.nameField;
    const valueField = fieldMap.valueField || config.valueField;
    return buildPieSeriesOption({ nameField, valueField });
  }

  if (
    asset.chartCode === "builtin_pie_multi_ring"
    || asset.chartCode === "builtin_pie_half_ring"
    || asset.chartCode === "builtin_pie_glass"
  ) {
    const nameField = fieldMap.nameField || config.nameField;
    const valueField = fieldMap.valueField || config.valueField;
    return buildPieSeriesOption({ nameField, valueField });
  }

  if (asset.chartCode === "builtin_heatmap_basic") {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    const valueField = fieldMap.valueField || config.valueField;
    const xNames = Array.from(new Set(rows.map((row) => row[xField])));
    const yNames = Array.from(new Set(rows.map((row) => row[yField])));
    const maxValue = Math.max(...rows.map((row) => Number(row[valueField] || 0)), 1);
    return {
      ...optionTemplate,
      xAxis: { ...(optionTemplate.xAxis || {}), data: xNames },
      yAxis: { ...(optionTemplate.yAxis || {}), data: yNames },
      visualMap: { ...(optionTemplate.visualMap || {}), max: maxValue },
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "heatmap",
          data: rows.map((row) => [xNames.indexOf(row[xField]), yNames.indexOf(row[yField]), Number(row[valueField] || 0)]),
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_treemap_basic") {
    const nameField = fieldMap.nameField || config.nameField;
    const valueField = fieldMap.valueField || config.valueField;
    return {
      ...optionTemplate,
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "treemap",
          data: rows.map((row) => ({
            name: String(row[nameField]),
            value: Number(row[valueField] || 0),
          })),
        },
      ],
    };
  }

  if (asset.chartCode === "builtin_sankey_basic") {
    const sourceField = fieldMap.sourceField || config.sourceField;
    const targetField = fieldMap.targetField || config.targetField;
    const valueField = fieldMap.valueField || config.valueField;
    if (!sourceField || !targetField || !valueField) {
      return buildSankeyEmptyOption(optionTemplate);
    }
    const links = rows
      .map((row) => ({
        source: normalizeText(row[sourceField]),
        target: normalizeText(row[targetField]),
        value: Number(row[valueField] || 0),
      }))
      .filter((item) => item.source && item.target && item.source !== item.target && Number.isFinite(item.value) && item.value > 0);
    if (!links.length) {
      return buildSankeyEmptyOption(optionTemplate);
    }
    if (hasSankeyCycle(links)) {
      return buildSankeyEmptyOption(optionTemplate, "当前数据存在环路，无法生成桑基图");
    }
    const nodeNames = Array.from(new Set(links.flatMap((link) => [link.source, link.target])));
    return {
      ...optionTemplate,
      series: [
        {
          ...(Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}),
          type: "sankey",
          data: nodeNames.map((name) => ({ name })),
          links,
        },
      ],
    };
  }

  if (
    asset.chartCode === "builtin_line_glow"
    || asset.chartCode === "builtin_line_dual_gradient"
    || asset.chartCode === "builtin_line_step"
    || asset.chartCode === "builtin_line_slim"
  ) {
    const xField = fieldMap.xField || config.xField;
    const yField = fieldMap.yField || config.yField;
    return buildLineSeriesOption({
      xField,
      yField,
      color: config.color || config.accentColor,
      colorStart: config.colorStart,
      colorEnd: config.colorEnd,
      step: optionTemplate.series?.[0]?.step,
      smooth: optionTemplate.series?.[0]?.smooth ?? config.smooth,
      areaOpacity: optionTemplate.series?.[0]?.areaStyle?.opacity ?? (asset.chartCode === "builtin_line_dual_gradient" ? 0.24 : 0.12),
    });
  }

  if (asset.chartCode === "builtin_combo_bar_line" || asset.chartCode === "builtin_combo_dual_axis" || asset.chartCode === "builtin_combo_bar_area") {
    const xField = fieldMap.xField || config.xField;
    const barField = fieldMap.barField || config.barField;
    const lineField = fieldMap.lineField || config.lineField;
    const isArea = asset.chartCode === "builtin_combo_bar_area";
    const paletteColors = getPaletteColors();
    const barColor = getAccentColor("#1677ff");
    const lineColor = paletteColors[1] || (asset.chartCode === "builtin_combo_dual_axis" ? "#7c5cff" : "#fa8c16");
    return {
      ...optionTemplate,
      color: paletteColors,
      legend: { ...(optionTemplate.legend || {}), data: ["柱图", isArea ? "面积" : "折线"] },
      xAxis: { ...(optionTemplate.xAxis || {}), data: rows.map((row) => row[xField]) },
      series: [
        {
          type: "bar",
          name: "柱图",
          data: rows.map((row) => Number(row[barField] || 0)),
          itemStyle: { color: barColor, borderRadius: [10, 10, 0, 0] },
        },
        {
          type: "line",
          name: isArea ? "面积" : "折线",
          yAxisIndex: 1,
          smooth: true,
          data: rows.map((row) => Number(row[lineField] || 0)),
          itemStyle: { color: lineColor },
          lineStyle: { color: lineColor, width: 3 },
          areaStyle: isArea ? { opacity: 0.18, color: lineColor } : undefined,
        },
      ],
    };
  }

  return optionTemplate;
}

function normalizeReportDataSourcePayload(payload, existingRecord = null) {
  return {
    sourceName: normalizeText(payload.sourceName),
    sourceCode: normalizeText(payload.sourceCode),
    sourceType: normalizeText(payload.sourceType).toLowerCase(),
    connectionConfig: payload.connectionConfig || {},
    ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
    status: String(payload.status || existingRecord?.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

function normalizeDatasetPayload(payload, fields = [], existingRecord = null) {
  const datasetType = String(payload.datasetType || existingRecord?.datasetType || "table").trim().toLowerCase();
  return {
    datasetName: normalizeText(payload.datasetName),
    datasetCode: normalizeText(existingRecord?.datasetCode || payload.datasetCode || ""),
    sourceId: Number(payload.sourceId),
    folderId: payload.folderId === undefined
      ? (existingRecord?.folderId ?? null)
      : (payload.folderId === null || payload.folderId === "" ? null : Number(payload.folderId)),
    datasetType,
    sourceTable: datasetType === "table" ? normalizeText(payload.sourceTable) : null,
    sourceSql: datasetType === "sql" ? sanitizeSqlText(payload.sourceSql) : null,
    fields,
    queryConfig: payload.queryConfig || {},
    cacheConfig: payload.cacheConfig || {},
    ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
    status: String(payload.status || existingRecord?.status || "draft").trim().toLowerCase(),
    description: normalizeText(payload.description, "") || null,
  };
}

function buildInternalDatasetCode() {
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `rpt_ds_${timestampPart}_${randomPart}`;
}

function assignInternalDatasetCode(normalized) {
  return {
    ...normalized,
    datasetCode: buildInternalDatasetCode(),
  };
}

function normalizeDatasetFolderPayload(payload, existingRecord = null) {
  return {
    folderName: normalizeText(payload.folderName, existingRecord?.folderName || ""),
    parentId: payload.parentId === undefined
      ? (existingRecord?.parentId ?? null)
      : (payload.parentId === null || payload.parentId === "" ? null : Number(payload.parentId)),
  };
}

function normalizeChartAssetPayload(payload, existingRecord = null) {
  return {
    chartName: normalizeText(payload.chartName),
    chartCode: normalizeText(payload.chartCode),
    chartType: normalizeText(payload.chartType || existingRecord?.chartType || "echarts"),
    category: normalizeText(payload.category, existingRecord?.category || "custom"),
    renderMode: normalizeText(payload.renderMode, existingRecord?.renderMode || "dataset"),
    coverImageUrl: normalizeText(payload.coverImageUrl, "") || null,
    description: normalizeText(payload.description, "") || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    config: payload.config || {},
    optionTemplate: payload.optionTemplate || {},
    mappingSchema: payload.mappingSchema || {},
    ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
    status: String(payload.status || existingRecord?.status || "draft").trim().toLowerCase(),
    isBuiltin: Boolean(payload.isBuiltin ?? existingRecord?.isBuiltin),
  };
}

function normalizeDashboardPayload(payload, existingRecord = null) {
  return {
    dashboardName: normalizeText(payload.dashboardName),
    dashboardCode: normalizeText(existingRecord?.dashboardCode || payload.dashboardCode || ""),
    layoutMode: normalizeText(payload.layoutMode, existingRecord?.layoutMode || "grid"),
    themeTemplateId: payload.themeTemplateId ? Number(payload.themeTemplateId) : null,
    themeSettings: payload.themeSettings || {},
    themeConfig: payload.themeConfig || {},
    filterConfig: payload.filterConfig || {},
    canvasConfig: payload.canvasConfig || {},
    ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
    status: String(payload.status || existingRecord?.status || "draft").trim().toLowerCase(),
    description: normalizeText(payload.description, "") || null,
    widgets: Array.isArray(payload.widgets) ? payload.widgets.map((item) => ({
      widgetKey: normalizeText(item.widgetKey),
      widgetName: normalizeText(item.widgetName),
      widgetType: normalizeText(item.widgetType, "chart"),
      datasetId: item.datasetId ? Number(item.datasetId) : null,
      chartAssetId: item.chartAssetId ? Number(item.chartAssetId) : null,
      position: item.position || {},
      props: item.props || {},
      queryParams: item.queryParams || {},
    })) : [],
  };
}

function buildInternalDashboardCode() {
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `rpt_dash_${timestampPart}_${randomPart}`;
}

function assignInternalDashboardCode(normalized) {
  const next = { ...normalized };
  next.dashboardCode = buildInternalDashboardCode();
  return next;
}

function normalizeThemePalette(values, fallback = []) {
  const normalized = Array.isArray(values)
    ? values.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  return normalized.length ? normalized : fallback;
}

function hydrateThemeTemplateChartVariants(template = {}) {
  const chartVariants = template.chartVariants && typeof template.chartVariants === "object"
    ? { ...template.chartVariants }
    : {};
  const sankey = chartVariants.sankey && typeof chartVariants.sankey === "object"
    ? { ...chartVariants.sankey }
    : {};
  const gauge = chartVariants.gauge && typeof chartVariants.gauge === "object"
    ? { ...chartVariants.gauge }
    : {};
  const funnel = chartVariants.funnel && typeof chartVariants.funnel === "object"
    ? { ...chartVariants.funnel }
    : {};
  const wordCloud = chartVariants.wordCloud && typeof chartVariants.wordCloud === "object"
    ? { ...chartVariants.wordCloud }
    : {};
  const scatter = chartVariants.scatter && typeof chartVariants.scatter === "object"
    ? { ...chartVariants.scatter }
    : {};
  const horizontalBar = chartVariants.horizontalBar && typeof chartVariants.horizontalBar === "object"
    ? chartVariants.horizontalBar
    : {};
  const line = chartVariants.line && typeof chartVariants.line === "object"
    ? chartVariants.line
    : {};
  const pie = chartVariants.pie && typeof chartVariants.pie === "object"
    ? chartVariants.pie
    : {};
  const chartCommon = template.chartCommon && typeof template.chartCommon === "object"
    ? template.chartCommon
    : {};
  const chrome = template.chrome && typeof template.chrome === "object"
    ? template.chrome
    : {};
  const semantic = template.semantic && typeof template.semantic === "object"
    ? template.semantic
    : {};
  const fallbackPalette = normalizeThemePalette(
    horizontalBar.palette,
    normalizeThemePalette(
      chartCommon.palette,
      [
        normalizeText(semantic.primary),
        normalizeText(semantic.secondary),
        "#f4b95d",
        "#8f7cff",
        "#f28f8f",
      ].filter(Boolean)
    )
  );
  chartVariants.sankey = {
    ...sankey,
    palette: normalizeThemePalette(sankey.palette, fallbackPalette),
    labelColor: normalizeText(
      sankey.labelColor,
      normalizeText(horizontalBar.axisLabelColor, normalizeText(horizontalBar.labelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054"))))
    ),
    nodeBorderColor: normalizeText(sankey.nodeBorderColor, normalizeText(pie.sliceBorderColor, normalizeText(chrome.backgroundColor, "#ffffff"))),
    nodeBorderWidth: normalizeNumber(sankey.nodeBorderWidth, 1),
    nodeBorderRadius: normalizeNumber(sankey.nodeBorderRadius, normalizeNumber(horizontalBar.barBorderRadius, 4)),
    linkOpacity: sankey.linkOpacity == null ? 0.28 : Number(sankey.linkOpacity),
    linkCurveness: sankey.linkCurveness == null ? 0.5 : Number(sankey.linkCurveness),
  };
  chartVariants.gauge = {
    ...gauge,
    palette: normalizeThemePalette(gauge.palette, fallbackPalette),
    pointerColor: normalizeText(gauge.pointerColor, normalizeText(semantic.primary, fallbackPalette[0] || "#1677ff")),
    detailColor: normalizeText(gauge.detailColor, normalizeText(pie.centerValueColor, normalizeText(semantic.textPrimary, normalizeText(chrome.titleColor, "#101828")))),
    titleColor: normalizeText(gauge.titleColor, normalizeText(pie.centerTitleColor, normalizeText(semantic.textSecondary, normalizeText(chartCommon.legendColor, "#667085")))),
    axisLabelColor: normalizeText(
      gauge.axisLabelColor,
      normalizeText(horizontalBar.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
    ),
    splitLineColor: normalizeText(
      gauge.splitLineColor,
      normalizeText(horizontalBar.axisColor, normalizeText(semantic.lineStrong, normalizeText(chrome.borderColor, "#98a2b3")))
    ),
    startAngle: normalizeNumber(gauge.startAngle, 210),
    endAngle: normalizeNumber(gauge.endAngle, -30),
    radius: normalizeChartDimension(gauge.radius, "90%"),
    progressWidth: normalizeNumber(gauge.progressWidth, 18),
    axisLineWidth: normalizeNumber(gauge.axisLineWidth, normalizeNumber(gauge.progressWidth, 18)),
    pointerLength: normalizeChartDimension(gauge.pointerLength, "58%"),
    detailFontSize: normalizeNumber(gauge.detailFontSize, 24),
    detailFontWeight: normalizeNumber(gauge.detailFontWeight, 700),
    titleFontSize: normalizeNumber(gauge.titleFontSize, 14),
  };
  chartVariants.funnel = {
    ...funnel,
    palette: normalizeThemePalette(funnel.palette, fallbackPalette),
    labelColor: normalizeText(
      funnel.labelColor,
      normalizeText(horizontalBar.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
    ),
    valueColor: normalizeText(funnel.valueColor, normalizeText(pie.valueColor, normalizeText(semantic.textPrimary, normalizeText(chrome.titleColor, "#101828")))),
    guideLineColor: normalizeText(
      funnel.guideLineColor,
      normalizeText(pie.guideLineColor, normalizeText(chartCommon.guideLineColor, normalizeText(chrome.borderColor, "#98a2b3")))
    ),
    blockBorderColor: normalizeText(funnel.blockBorderColor, normalizeText(pie.sliceBorderColor, normalizeText(chrome.backgroundColor, "#ffffff"))),
    blockBorderWidth: normalizeNumber(funnel.blockBorderWidth, 1),
    itemGap: normalizeNumber(funnel.itemGap, 2),
    sortOrder: normalizeText(funnel.sortOrder, "descending"),
  };
  chartVariants.wordCloud = {
    ...wordCloud,
    palette: normalizeThemePalette(wordCloud.palette, fallbackPalette),
    shape: normalizeText(wordCloud.shape, "circle"),
    gridSize: normalizeNumber(wordCloud.gridSize, 10),
    rotationStep: normalizeNumber(wordCloud.rotationStep, 45),
    minFontSize: normalizeNumber(wordCloud.minFontSize, 12),
    maxFontSize: normalizeNumber(wordCloud.maxFontSize, 40),
    fontWeight: normalizeNumber(wordCloud.fontWeight, 700),
    textShadowColor: normalizeText(wordCloud.textShadowColor, normalizeText(chartCommon.emphasisShadowColor, normalizeText(semantic.primary, "rgba(15,23,42,0.14)"))),
    textShadowBlur: normalizeNumber(wordCloud.textShadowBlur, 10),
  };
  chartVariants.scatter = {
    ...scatter,
    palette: normalizeThemePalette(scatter.palette, normalizeThemePalette(line.palette, fallbackPalette)),
    labelColor: normalizeText(
      scatter.labelColor,
      normalizeText(line.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
    ),
    legendColor: normalizeText(scatter.legendColor, normalizeText(chartCommon.legendColor, normalizeText(chrome.titleColor, "#344054"))),
    axisColor: normalizeText(
      scatter.axisColor,
      normalizeText(line.axisColor, normalizeText(semantic.lineStrong, normalizeText(chrome.borderColor, "#98a2b3")))
    ),
    axisLabelColor: normalizeText(
      scatter.axisLabelColor,
      normalizeText(line.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
    ),
    splitLineColor: normalizeText(
      scatter.splitLineColor,
      normalizeText(line.splitLineColor, normalizeText(semantic.lineSubtle, normalizeText(chrome.borderColor, "#e5e7eb")))
    ),
    symbolSize: normalizeNumber(scatter.symbolSize, 16),
    pointBorderColor: normalizeText(scatter.pointBorderColor, normalizeText(line.pointBorderColor, normalizeText(chrome.backgroundColor, "#ffffff"))),
    pointBorderWidth: normalizeNumber(scatter.pointBorderWidth, 1),
    pointOpacity: scatter.pointOpacity == null ? 0.82 : Number(scatter.pointOpacity),
    labelPosition: normalizeText(scatter.labelPosition, normalizeText(line.labelPosition, "top")),
  };
  return chartVariants;
}

function hydrateThemeTemplateRecord(record) {
  if (!record) return record;
  const canvas = record.canvas && typeof record.canvas === "object" ? record.canvas : {};
  const chrome = record.chrome && typeof record.chrome === "object" ? record.chrome : {};
  return {
    ...record,
    canvas: {
      ...canvas,
      dashboardTitleColor: normalizeText(canvas.dashboardTitleColor, normalizeText(chrome.titleColor, "#101828")),
    },
    chartVariants: hydrateThemeTemplateChartVariants(record),
  };
}

function normalizeThemeTemplatePayload(payload, existingRecord = null) {
  const existingCanvas = existingRecord?.canvas && typeof existingRecord.canvas === "object" ? existingRecord.canvas : {};
  const existingChrome = existingRecord?.chrome && typeof existingRecord.chrome === "object" ? existingRecord.chrome : {};
  const canvas = payload.canvas && typeof payload.canvas === "object" ? payload.canvas : {};
  const chrome = payload.chrome && typeof payload.chrome === "object" ? payload.chrome : {};
  const normalized = {
    themeName: normalizeText(payload.themeName, existingRecord?.themeName || ""),
    themeCode: normalizeText(payload.themeCode, existingRecord?.themeCode || ""),
    category: normalizeText(payload.category, existingRecord?.category || "general"),
    description: normalizeText(payload.description, "") || null,
    isBuiltin: Boolean(payload.isBuiltin ?? existingRecord?.isBuiltin),
    status: String(payload.status || existingRecord?.status || "active").trim().toLowerCase(),
    previewImage: normalizeText(payload.previewImage, "") || null,
    createdBy: normalizeText(payload.createdBy, existingRecord?.createdBy || "system"),
    canvas: {
      ...canvas,
      dashboardTitleColor: normalizeText(
        canvas.dashboardTitleColor,
        normalizeText(existingCanvas.dashboardTitleColor, normalizeText(chrome.titleColor, normalizeText(existingChrome.titleColor, "#101828")))
      ),
    },
    chrome: chrome || {},
    semantic: payload.semantic || {},
    chartCommon: payload.chartCommon || {},
    chartVariants: payload.chartVariants || {},
  };
  return {
    ...normalized,
    chartVariants: hydrateThemeTemplateChartVariants(normalized),
  };
}

function buildDatasetFolderChildrenMap(folders = []) {
  const childrenMap = new Map();
  for (const folder of folders) {
    const parentId = folder.parentId == null ? null : Number(folder.parentId);
    if (parentId == null) continue;
    const children = childrenMap.get(parentId) || [];
    children.push(Number(folder.id));
    childrenMap.set(parentId, children);
  }
  return childrenMap;
}

function collectDatasetFolderDescendantIds(folders = [], folderId) {
  const descendants = new Set();
  const childrenMap = buildDatasetFolderChildrenMap(folders);
  const stack = [Number(folderId)];
  while (stack.length) {
    const current = stack.pop();
    if (current == null || descendants.has(current)) continue;
    descendants.add(current);
    const children = childrenMap.get(current) || [];
    for (const childId of children) {
      stack.push(childId);
    }
  }
  return descendants;
}

async function ensureReportDataSource(id) {
  const row = await repository.getReportDataSourceById(Number(id));
  if (!row) {
    throw new AppError("报表数据源不存在", 404);
  }
  return row;
}

async function ensureReportDatasetFolder(id) {
  const row = await repository.getReportDatasetFolderById(Number(id));
  if (!row) {
    throw new AppError("数据集文件夹不存在", 404);
  }
  return row;
}

async function ensureReportDatasetFolderParent(folderId, parentId) {
  if (parentId == null) {
    return null;
  }
  const resolvedParentId = Number(parentId);
  const parent = await ensureReportDatasetFolder(resolvedParentId);
  if (folderId != null) {
    const resolvedFolderId = Number(folderId);
    if (resolvedParentId === resolvedFolderId) {
      throw new AppError("文件夹不能设置为自身的上级文件夹", 400);
    }
    const folders = await repository.listReportDatasetFolders();
    const descendantIds = collectDatasetFolderDescendantIds(folders, resolvedFolderId);
    if (descendantIds.has(resolvedParentId)) {
      throw new AppError("上级文件夹不能选择自身的子文件夹", 400);
    }
  }
  return parent;
}

async function ensureActiveReportDataSource(id) {
  const row = await ensureReportDataSource(id);
  if (row.status !== "active") {
    throw new AppError("报表数据源未启用", 400);
  }
  return row;
}

async function ensureReportDataset(id) {
  const row = await repository.getReportDatasetById(Number(id));
  if (!row) {
    throw new AppError("数据集不存在", 404);
  }
  return row;
}

async function ensureReportChartAsset(id) {
  const row = await repository.getReportChartAssetById(Number(id));
  if (!row) {
    throw new AppError("图表资产不存在", 404);
  }
  return row;
}

async function ensureReportDashboard(id) {
  const row = await repository.getReportDashboardById(Number(id));
  if (!row) {
    throw new AppError("仪表板不存在", 404);
  }
  return row;
}

async function ensureReportThemeTemplate(id) {
  const row = await repository.getReportThemeTemplateById(Number(id));
  if (!row) {
    throw new AppError("主题模板不存在", 404);
  }
  return row;
}

async function withReportConnection(dataSource, callback) {
  const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
  const dialect = resolved.dialect;

  if (["mysql", "postgresql", "oracle", "dm"].includes(dialect) && getManagedBinding(dialect)) {
    const adapter = getAdapter(dialect);
    const runtimeConfig = {
      ...(dataSource.connectionConfig || {}),
      sourceType: dialect,
      databaseName: resolved.database,
    };
    const connection = {
      async query(input, params) {
        const sql = typeof input === "object" ? input.sql : input;
        const binds = typeof input === "object" ? (input.values || params) : params;
        const result = await adapter.executeQuery(runtimeConfig, sql, { binds });
        if (dialect === "mysql") {
          return [result.rows || [], (result.fields || []).map((name) => ({ name }))];
        }
        return {
          rows: result.rows || [],
          fields: (result.fields || []).map((name) => ({ name })),
          rowCount: result.rowCount || 0,
        };
      },
    };
    return callback(connection, dialect);
  }

  if (dialect === "mysql") {
    const connection = await mysql.createConnection({
      host: resolved.host,
      port: resolved.port || 3306,
      user: resolved.username,
      password: resolved.password,
      database: resolved.database,
      charset: "utf8mb4",
    });
    try {
      return await callback(connection, dialect);
    } finally {
      await connection.end();
    }
  }

  if (dialect === "postgresql") {
    const client = createPostgresLikeClient({
      host: resolved.host,
      port: resolved.port || 5432,
      database: resolved.database,
      user: resolved.username,
      password: resolved.password,
    }, { sourceType: dataSource.sourceType });
    await client.connect();
    try {
      return await callback(client, dialect);
    } finally {
      await client.end();
    }
  }

  if (["oracle", "dm"].includes(dialect)) {
    const adapter = getAdapter(dialect);
    const runtimeConfig = {
      ...(dataSource.connectionConfig || {}),
      sourceType: dialect,
      databaseName: resolved.database,
    };
    const connection = {
      async query(input) {
        const sql = typeof input === "object" ? input.sql : input;
        const result = await adapter.executeQuery(runtimeConfig, sql);
        return {
          rows: result.rows || [],
          fields: (result.fields || []).map((name) => ({ name })),
          rowCount: result.rowCount || 0,
        };
      },
    };
    return callback(connection, dialect);
  }

  throw new AppError(`当前暂不支持 ${dataSource.sourceType} 类型的数据预览`, 400);
}

async function explainReportSql(dataSource, sql) {
  const startedAt = Date.now();
  try {
    await withReportConnection(dataSource, async (connection, dialect) => {
      if (dialect === "mysql") {
        await connection.query(`EXPLAIN ${sql}`);
        return;
      }
      await connection.query(dialect === "oracle" ? `EXPLAIN PLAN FOR ${sql}` : `EXPLAIN ${sql}`);
    });
    return {
      explainValid: true,
      durationMs: Date.now() - startedAt,
      messages: ["SQL 已通过当前数据源 EXPLAIN 校验"],
    };
  } catch (error) {
    return {
      explainValid: false,
      durationMs: Date.now() - startedAt,
      messages: [`EXPLAIN 校验未通过: ${error.message || "未知错误"}`],
    };
  }
}

async function resolveReportingAiProvider(sceneCode) {
  const aiConfig = await reportingAiConfigService.getActiveConfigByCode(sceneCode);
  let provider = null;
  if (aiConfig?.defaultModelProviderId) {
    provider = await modelProviderService.getModelProviderById(Number(aiConfig.defaultModelProviderId));
    provider = modelProviderService.applyModelSelection(provider, {
      modelName: aiConfig.defaultModelName,
      modelVersion: aiConfig.defaultModelVersion,
    });
  } else {
    const providers = await modelProviderService.getActiveChatModelProviders();
    provider = providers[0] || null;
  }
  if (!provider) {
    throw new AppError("未找到可用的对话模型，请先在报表模型管理中配置默认模型", 400);
  }
  return { aiConfig, provider };
}

function buildAiRuntimeOptions(aiConfig, fallback = {}) {
  return {
    temperature: aiConfig?.temperature ?? fallback.temperature ?? 0.1,
    maxTokens: aiConfig?.maxTokens ?? fallback.maxTokens ?? 1600,
    timeoutMs: aiConfig?.timeoutMs ?? fallback.timeoutMs ?? 30000,
    responseFormat: { type: "json_object" },
  };
}

function buildAiAnalysisSuggestionSystemPrompt(configuredPrompt = "", variables = {}) {
  const renderedPrompt = renderPromptTemplate(configuredPrompt, {
    sceneCode: AI_ANALYSIS_SUGGESTION_SCENE_CODE,
    ...variables,
  });
  return [
    renderedPrompt || "你是报表平台中的数据分析需求规划助手。",
    "必须基于真实数据源元数据、候选表字段和随机样例数据，结合用户分析方向生成可落到 SQL 和图表的分析需求。",
    "每条建议要贴合业务场景，明确分析对象、统计口径、维度、指标、筛选范围和推荐图表方向。",
    "凡是提到表名或字段名，优先输出为 物理名（中文说明）。如果元数据里有真实中文注释，直接使用；如果没有但能从命名语义准确判断，可补充简洁中文说明；如果仍不确定，只写物理名。",
    "不要编造不存在的表或字段；如果信息不足，给出保守可执行的需求并在 caveats 中说明限制。",
    "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    JSON.stringify({
      suggestions: [{
        title: "分析需求标题",
        analysisPrompt: "可直接用于生成 SQL 的完整自然语言需求",
        businessScenario: "业务场景",
        dimensions: ["维度字段或维度方向"],
        metrics: ["指标字段或统计口径"],
        filters: ["筛选条件"],
        chartHint: "推荐图表方向",
        reason: "推荐依据",
        caveats: ["限制或假设"],
      }],
      summary: "整体建议说明",
    }),
  ].filter(Boolean).join("\n");
}

function buildAiAnalysisSuggestionUserPrompt(payload, context) {
  const annotationGuide = asArray(context.tableSchemas).map((table) => ({
    tableName: table.tableName,
    tableComment: resolveAnalysisAnnotationLabel(table.tableName, table.tableComment, "table") || null,
    columns: asArray(table.columns).map((column) => ({
      name: column.name,
      comment: resolveAnalysisAnnotationLabel(column.name, column.comment, "field") || null,
    })),
  }));
  return [
    "用户分析方向:",
    payload.analysisDirection || payload.prompt || "",
    "",
    "当前可用表（最多80张）:",
    JSON.stringify(context.availableTables, null, 2),
    "",
    "候选表字段结构（最多5张表）:",
    JSON.stringify(context.tableSchemas, null, 2),
    "",
    context.tableSamples?.length ? [
      "候选表随机样例数据（每表最多50行，字段值最多100字符）:",
      JSON.stringify(context.tableSamples, null, 2),
      "",
    ].join("\n") : "",
    "表名与字段名中文注释参考（生成文案时必须带上）:",
    JSON.stringify(annotationGuide, null, 2),
    "",
    "生成要求:",
    "1. 返回 3 到 6 条建议，analysisPrompt 要能直接传给自然语言生成 SQL。",
    "2. 每条建议只能引用候选表字段结构中能判断存在的表或字段。",
    "3. 优先覆盖趋势、排名、结构占比、异常波动、区域分布、明细核查等业务场景中最适合当前数据的一到数类。",
    "4. 如果用户给了分析方向，建议必须围绕该方向展开。",
    "5. 凡是输出表名、字段名、维度、指标时，优先写成“物理名（中文说明）”；没有把握时只写物理名，不要输出“未维护中文注释”等占位词。",
  ].filter(Boolean).join("\n");
}

function normalizeAiAnalysisSuggestions(parsed, context) {
  const annotationContext = buildAnalysisAnnotationContext(context);
  return asArray(parsed?.suggestions)
    .map((item, index) => ({
      id: normalizeText(item?.id, `suggestion_${index + 1}`),
      title: normalizeText(item?.title, `分析建议 ${index + 1}`),
      analysisPrompt: normalizeText(item?.analysisPrompt || item?.prompt || item?.requirement),
      businessScenario: normalizeText(item?.businessScenario || item?.scenario),
      dimensions: uniqueStrings(item?.dimensions),
      metrics: uniqueStrings(item?.metrics),
      filters: uniqueStrings(item?.filters),
      chartHint: normalizeText(item?.chartHint || item?.chart),
      reason: normalizeText(item?.reason),
      caveats: uniqueStrings(item?.caveats || item?.risks),
    }))
    .filter((item) => item.analysisPrompt)
    .slice(0, 6)
    .map((item, index) => annotateAnalysisSuggestionItem({
      ...item,
      rank: index + 1,
      id: item.id || `suggestion_${index + 1}`,
    }, annotationContext));
}

function buildDeterministicAnalysisSuggestions(context, direction = "") {
  const tableSchemas = asArray(context.tableSchemas);
  const allColumns = tableSchemas.flatMap((table) => asArray(table.columns).map((column) => ({
    tableName: table.tableName,
    name: column.name,
    dataType: String(column.dataType || column.columnType || "").toLowerCase(),
    comment: column.comment || "",
  })));
  const timeColumn = allColumns.find((column) => /date|time|timestamp|datetime|year|month|日期|时间|月份|年度/.test(`${column.name} ${column.comment} ${column.dataType}`));
  const metricColumn = allColumns.find((column) => /int|decimal|number|numeric|double|float|amount|price|qty|count|金额|数量|次数|面积|收入|成本|得分/.test(`${column.name} ${column.comment} ${column.dataType}`));
  const geoColumn = allColumns.find((column) => /province|city|region|area|district|county|省|市|地区|区域|区县/.test(`${column.name} ${column.comment}`));
  const categoryColumn = allColumns.find((column) => column !== timeColumn && column !== metricColumn && column !== geoColumn);
  const primaryTable = tableSchemas[0]?.tableName || context.availableTables?.[0]?.tableName || "当前数据表";
  const metricName = metricColumn?.name || "记录数";
  const categoryName = categoryColumn?.name || geoColumn?.name || "分类维度";
  const directionPrefix = normalizeText(direction) ? `围绕“${normalizeText(direction)}”，` : "";
  const suggestions = [];

  if (timeColumn && metricColumn) {
    suggestions.push({
      title: "核心指标趋势分析",
      analysisPrompt: `${directionPrefix}按${timeColumn.name}统计${primaryTable}中${metricName}的变化趋势，输出时间维度、指标值，并按时间升序展示。`,
      businessScenario: "跟踪核心指标随时间的变化，识别增长、下降和周期波动。",
      dimensions: [timeColumn.name],
      metrics: [metricName],
      filters: [],
      chartHint: "折线图或面积图",
      reason: "候选表中同时存在时间字段和数值指标，适合做趋势分析。",
      caveats: [],
    });
  }

  if ((categoryColumn || geoColumn) && metricColumn) {
    suggestions.push({
      title: "分类排名对比",
      analysisPrompt: `${directionPrefix}按${categoryName}汇总${primaryTable}中${metricName}，统计各分类的指标值，按指标值倒序取前 10。`,
      businessScenario: "比较不同类别、组织、渠道或区域的贡献差异。",
      dimensions: [categoryName],
      metrics: [metricName],
      filters: ["Top 10"],
      chartHint: "柱形图或条形图",
      reason: "候选表中存在可分组字段和数值字段，适合做排名对比。",
      caveats: [],
    });
  }

  if (geoColumn && metricColumn) {
    suggestions.push({
      title: "区域分布分析",
      analysisPrompt: `${directionPrefix}按${geoColumn.name}统计${primaryTable}中${metricName}的区域分布，输出地区和指标值，并按指标值倒序排列。`,
      businessScenario: "观察指标在不同地区的分布，定位高值或低值区域。",
      dimensions: [geoColumn.name],
      metrics: [metricName],
      filters: [],
      chartHint: "地图或排名条形图",
      reason: "候选表中识别到地区字段，适合做区域分析。",
      caveats: [],
    });
  }

  suggestions.push({
    title: "数据明细核查",
    analysisPrompt: `${directionPrefix}查询${primaryTable}的关键明细字段，保留主要分类、时间和数值字段，取最新或最有代表性的 100 条记录用于数据核查。`,
    businessScenario: "在生成汇总图表前核查样例记录，确认字段含义和数据质量。",
    dimensions: [categoryColumn?.name, timeColumn?.name].filter(Boolean),
    metrics: [metricColumn?.name].filter(Boolean),
    filters: ["LIMIT 100"],
    chartHint: "明细表",
    reason: "明细核查可以帮助确认字段语义和后续统计口径。",
    caveats: ["字段含义仍需结合业务口径人工确认。"],
  });

  const annotationContext = buildAnalysisAnnotationContext(context);
  return suggestions.slice(0, 6).map((item, index) => annotateAnalysisSuggestionItem({
    ...item,
    id: `fallback_${index + 1}`,
    rank: index + 1,
  }, annotationContext));
}

function extractJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("模型未返回有效内容");
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
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
  } catch {
    const extracted = extractJsonObject(text);
    try {
      return JSON.parse(extracted);
    } catch {
      return JSON.parse(
        extracted
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/^\uFEFF/, "")
      );
    }
  }
}

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const AI_ANALYSIS_IDENTIFIER_PHRASE_LABELS = {
  rule_category: "规则类别",
  issue_rows: "问题行数",
  issue_count: "问题数量",
  table_name: "表名",
  column_name: "字段名",
  created_at: "创建时间",
  updated_at: "更新时间",
  source_name: "数据源名称",
  source_id: "数据源ID",
};

const AI_ANALYSIS_IDENTIFIER_TOKEN_LABELS = {
  amount: "金额",
  avg: "平均",
  category: "类别",
  city: "城市",
  code: "编码",
  count: "数量",
  created: "创建",
  date: "日期",
  day: "日",
  district: "区县",
  field: "字段",
  id: "ID",
  issue: "问题",
  level: "等级",
  month: "月",
  name: "名称",
  order: "订单",
  province: "省份",
  qty: "数量",
  quality: "质量",
  rate: "比率",
  region: "区域",
  row: "行",
  rows: "行数",
  rule: "规则",
  sales: "销售",
  score: "得分",
  source: "来源",
  stat: "统计",
  stats: "统计",
  status: "状态",
  table: "表",
  time: "时间",
  total: "总量",
  type: "类型",
  updated: "更新",
  user: "用户",
  value: "数值",
  year: "年",
};

const AI_ANALYSIS_IDENTIFIER_IGNORED_TOKENS = new Set([
  "adm",
  "ads",
  "app",
  "bak",
  "data",
  "dim",
  "dwd",
  "dwm",
  "fact",
  "medata",
  "ods",
  "dw",
  "tmp",
]);

function normalizeAnalysisIdentifier(value = "") {
  return String(value || "")
    .split(".")
    .filter(Boolean)
    .pop()
    ?.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "";
}

function inferAnalysisSemanticLabel(value = "", kind = "field") {
  const normalized = normalizeAnalysisIdentifier(value);
  if (!normalized) return "";
  if (AI_ANALYSIS_IDENTIFIER_PHRASE_LABELS[normalized]) {
    return AI_ANALYSIS_IDENTIFIER_PHRASE_LABELS[normalized];
  }

  const rawTokens = normalized.split("_").filter(Boolean);
  const tokens = rawTokens.filter((token) => token && !AI_ANALYSIS_IDENTIFIER_IGNORED_TOKENS.has(token) && !/^\d+$/.test(token));
  if (!tokens.length) return "";

  const recognized = [];
  const unknown = [];
  tokens.forEach((token) => {
    const label = AI_ANALYSIS_IDENTIFIER_TOKEN_LABELS[token];
    if (label) {
      recognized.push(label);
    } else {
      unknown.push(token);
    }
  });

  if (!recognized.length) return "";
  if (unknown.length > Math.max(1, Math.floor(tokens.length / 2))) return "";
  if (kind === "table" && recognized.length < 2) return "";
  return recognized.join("");
}

function resolveAnalysisAnnotationLabel(name = "", comment = "", kind = "field") {
  const explicitComment = normalizeText(comment);
  if (explicitComment) return explicitComment;
  return inferAnalysisSemanticLabel(name, kind);
}

function buildAnalysisDisplayLabel(name = "", comment = "", kind = "field") {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return "";
  const annotation = resolveAnalysisAnnotationLabel(normalizedName, comment, kind);
  return annotation ? `${normalizedName}（${annotation}）` : normalizedName;
}

function sanitizeAnalysisPlaceholderText(text = "") {
  return normalizeText(text)
    .replace(/[（(]\s*未维护中文注释\s*[)）]/g, "")
    .replace(/([（(][^()（）]*?)[，,]\s*未维护中文注释\s*([)）])/g, "$1$2")
    .replace(/\s*[，,]?\s*未维护中文注释/g, "")
    .replace(/[（(]\s*[)）]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildAnalysisAnnotationContext(context = {}) {
  const tableEntries = [];
  const fieldEntries = [];

  asArray(context.tableSchemas).forEach((table) => {
    const tableName = normalizeText(table?.tableName);
    if (!tableName) return;
    const tableComment = normalizeText(table?.tableComment || table?.comment);
    const shortTableName = tableName.split(".").filter(Boolean).pop() || tableName;
    const tableLabel = buildAnalysisDisplayLabel(tableName, tableComment, "table");
    tableEntries.push({ token: tableName, label: tableLabel, annotated: tableLabel !== tableName });
    if (shortTableName !== tableName) {
      tableEntries.push({
        token: shortTableName,
        label: buildAnalysisDisplayLabel(shortTableName, tableComment, "table"),
        annotated: buildAnalysisDisplayLabel(shortTableName, tableComment, "table") !== shortTableName,
      });
    }

    asArray(table.columns).forEach((column) => {
      const columnName = normalizeText(column?.name || column?.columnName);
      if (!columnName) return;
      const columnComment = normalizeText(column?.comment || column?.columnComment);
      const fieldLabel = buildAnalysisDisplayLabel(columnName, columnComment, "field");
      fieldEntries.push({
        token: `${tableName}.${columnName}`,
        label: `${tableName}.${fieldLabel}`,
        annotated: fieldLabel !== columnName,
      });
      fieldEntries.push({ token: columnName, label: fieldLabel, annotated: fieldLabel !== columnName });
    });
  });

  asArray(context.availableTables).forEach((table) => {
    const tableName = normalizeText(table?.tableName);
    if (!tableName) return;
    const tableComment = normalizeText(table?.tableComment || table?.comment);
    const shortTableName = tableName.split(".").filter(Boolean).pop() || tableName;
    const tableLabel = buildAnalysisDisplayLabel(tableName, tableComment, "table");
    tableEntries.push({ token: tableName, label: tableLabel, annotated: tableLabel !== tableName });
    if (shortTableName !== tableName) {
      tableEntries.push({
        token: shortTableName,
        label: buildAnalysisDisplayLabel(shortTableName, tableComment, "table"),
        annotated: buildAnalysisDisplayLabel(shortTableName, tableComment, "table") !== shortTableName,
      });
    }
  });

  const exactFieldMap = new Map();
  fieldEntries.forEach((entry) => {
    if (!entry.token || !entry.label) return;
    const key = entry.token.toLowerCase();
    const existing = exactFieldMap.get(key);
    if (!existing || (!existing.annotated && entry.annotated)) {
      exactFieldMap.set(key, { label: entry.label, annotated: Boolean(entry.annotated) });
    }
  });

  const exactTableMap = new Map();
  tableEntries.forEach((entry) => {
    if (!entry.token || !entry.label) return;
    const key = entry.token.toLowerCase();
    const existing = exactTableMap.get(key);
    if (!existing || (!existing.annotated && entry.annotated)) {
      exactTableMap.set(key, { label: entry.label, annotated: Boolean(entry.annotated) });
    }
  });

  const replacementEntries = [
    ...Array.from(exactTableMap.entries()).map(([token, entry]) => ({ token, label: entry.label })),
    ...Array.from(exactFieldMap.entries()).map(([token, entry]) => ({ token, label: entry.label })),
  ].sort((left, right) => right.token.length - left.token.length);

  return {
    exactFieldMap,
    exactTableMap,
    replacementEntries,
  };
}

function annotateAnalysisText(text = "", annotationContext) {
  let nextText = sanitizeAnalysisPlaceholderText(text);
  if (!nextText || !annotationContext?.replacementEntries?.length) {
    return nextText;
  }
  annotationContext.replacementEntries.forEach((entry) => {
    const rawToken = String(entry.token || "");
    const label = String(entry.label || "");
    if (!rawToken || !label) return;
    const pattern = rawToken.includes(".")
      ? new RegExp(`${escapeRegExp(rawToken)}(?![（(])`, "g")
      : new RegExp(`(?<![a-zA-Z0-9_])${escapeRegExp(rawToken)}(?![a-zA-Z0-9_（(])`, "g");
    nextText = nextText.replace(pattern, label);
  });
  return nextText;
}

function annotateAnalysisTokenList(values = [], annotationContext) {
  return uniqueStrings(
    asArray(values).map((value) => {
      const normalizedValue = sanitizeAnalysisPlaceholderText(value);
      if (!normalizedValue) return "";
      return annotationContext?.exactFieldMap?.get(normalizedValue.toLowerCase())?.label
        || annotationContext?.exactTableMap?.get(normalizedValue.toLowerCase())?.label
        || annotateAnalysisText(normalizedValue, annotationContext);
    })
  );
}

function annotateAnalysisSuggestionItem(item = {}, annotationContext) {
  return {
    ...item,
    analysisPrompt: annotateAnalysisText(item.analysisPrompt, annotationContext),
    businessScenario: annotateAnalysisText(item.businessScenario, annotationContext),
    dimensions: annotateAnalysisTokenList(item.dimensions, annotationContext),
    metrics: annotateAnalysisTokenList(item.metrics, annotationContext),
    filters: uniqueStrings(asArray(item.filters).map((value) => annotateAnalysisText(value, annotationContext))),
    reason: annotateAnalysisText(item.reason, annotationContext),
    caveats: uniqueStrings(asArray(item.caveats).map((value) => annotateAnalysisText(value, annotationContext))),
  };
}

function extractAiSuggestionObjects(text = "") {
  const raw = String(text || "");
  const suggestionsKeyIndex = raw.indexOf("\"suggestions\"");
  if (suggestionsKeyIndex < 0) return [];
  const listStart = raw.indexOf("[", suggestionsKeyIndex);
  if (listStart < 0) return [];
  const suggestions = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let index = listStart + 1; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        const objectText = raw.slice(objectStart, index + 1);
        try {
          suggestions.push(parseJsonObjectWithRecovery(objectText));
        } catch {
          // ignore invalid partial object
        }
        objectStart = -1;
      }
      continue;
    }
    if (char === "]" && depth === 0) {
      break;
    }
  }

  return suggestions;
}

function parseAiAnalysisSuggestionPayload(text = "") {
  try {
    return parseJsonObjectWithRecovery(text);
  } catch {
    const suggestions = extractAiSuggestionObjects(text);
    if (!suggestions.length) {
      throw new Error("模型响应中未找到可恢复的分析建议");
    }
    return { suggestions };
  }
}

function buildPromptKeywords(payload = {}) {
  return uniqueStrings(
    [payload.prompt, payload.currentSql]
      .map((item) => normalizeText(item).toLowerCase())
      .join(" ")
      .split(/[^a-z0-9_\u4e00-\u9fa5]+/i)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
  );
}

function scoreAiCandidateTable(table, keywords = [], selectedTables = []) {
  const tableName = String(table.tableName || table.name || "");
  const tableComment = String(table.tableComment || table.comment || "");
  const normalizedName = tableName.toLowerCase();
  const normalizedComment = tableComment.toLowerCase();
  let score = selectedTables.some((item) => tableNameMatchesSelection(tableName, item)) ? 1000 : 0;
  keywords.forEach((keyword) => {
    const lower = keyword.toLowerCase();
    if (normalizedName === lower) score += 30;
    else if (normalizedName.endsWith(`.${lower}`)) score += 24;
    else if (normalizedName.includes(lower)) score += 12;
    if (normalizedComment.includes(lower)) score += 8;
  });
  return score;
}

function selectAiCandidateTables(tables = [], payload = {}) {
  const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
  const keywords = buildPromptKeywords(payload);
  const allTables = asArray(tables);
  const selectedSet = new Set(selectedTables.map((item) => normalizeTableNameForMatch(item)));
  const selectedMatches = allTables.filter((item) => selectedTables.some((selected) => tableNameMatchesSelection(item.tableName || item.name, selected)));
  const scored = allTables
    .filter((item) => !selectedSet.size || selectedTables.some((selected) => tableNameMatchesSelection(item.tableName || item.name, selected)))
    .map((item) => ({ item, score: scoreAiCandidateTable(item, keywords, selectedTables) }))
    .sort((left, right) => right.score - left.score || String(left.item.tableName || "").localeCompare(String(right.item.tableName || ""), "zh-CN"))
    .map((entry) => entry.item);
  const source = selectedSet.size ? (scored.length ? scored : selectedMatches) : scored;
  const merged = [];
  const seen = new Set();
  for (const item of source) {
    const key = normalizeTableNameForMatch(item.tableName || item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return {
    availableTables: merged.slice(0, MAX_AI_AVAILABLE_TABLES),
    schemaTables: merged.slice(0, MAX_AI_SCHEMA_TABLES),
  };
}

function normalizeAiSampleValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[binary:${value.length}]`;
  if (typeof value === "string") {
    return value.length > MAX_AI_TABLE_SAMPLE_VALUE_LENGTH
      ? `${value.slice(0, MAX_AI_TABLE_SAMPLE_VALUE_LENGTH)}...`
      : value;
  }
  return value;
}

function normalizeAiSampleRow(row = {}, columns = []) {
  const columnNames = asArray(columns)
    .map((column) => column.name || column.columnName)
    .filter(Boolean);
  const sourceNames = columnNames.length ? columnNames : Object.keys(row || {});
  return Object.fromEntries(
    sourceNames
      .filter((name) => Object.prototype.hasOwnProperty.call(row || {}, name))
      .map((name) => [name, normalizeAiSampleValue(row[name])])
  );
}

function buildRandomSampleSql(dataSource, tableName, dialect, limit = MAX_AI_TABLE_SAMPLE_ROWS) {
  const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
  const database = resolved.database;
  const schema = resolved.schema || "public";
  const parts = String(tableName || "").split(".").filter(Boolean).map((item) => item.replace(/[`"]/g, ""));
  const name = parts[parts.length - 1] || String(tableName || "").replace(/[`"]/g, "");
  const namespace = parts.length >= 2 ? parts[parts.length - 2] : (["postgresql", "oracle", "dm"].includes(dialect) ? schema : database);
  const qualifiedTable = namespace
    ? metadataService.escapeIdentifier(`${namespace}.${name}`, dialect)
    : metadataService.escapeIdentifier(name, dialect);
  const safeLimit = Math.max(1, Math.min(MAX_AI_TABLE_SAMPLE_ROWS, Number(limit || MAX_AI_TABLE_SAMPLE_ROWS) || MAX_AI_TABLE_SAMPLE_ROWS));
  const randomFunction = dialect === "postgresql" ? "RANDOM()" : dialect === "oracle" ? "DBMS_RANDOM.VALUE" : "RAND()";
  const baseSql = `SELECT * FROM ${qualifiedTable} ORDER BY ${randomFunction}`;
  return buildPreviewSql(baseSql, safeLimit, dialect);
}

async function loadAiTableSamples(dataSource, tableSchemas = []) {
  const results = [];
  for (const table of asArray(tableSchemas).slice(0, MAX_AI_SELECTED_TABLES)) {
    try {
      const rows = await withReportConnection(dataSource, async (connection, dialect) => {
        const sql = buildRandomSampleSql(dataSource, table.tableName, dialect, MAX_AI_TABLE_SAMPLE_ROWS);
        if (dialect === "mysql") {
          const [resultRows] = await connection.query({
            sql,
            timeout: AI_QUERY_TIMEOUT_MS,
          });
          return Array.isArray(resultRows) ? resultRows : [];
        }
        const result = await connection.query(sql);
        return Array.isArray(result.rows) ? result.rows : [];
      });
      results.push({
        tableName: table.tableName,
        rowCount: rows.length,
        sampleRows: rows.map((row) => normalizeAiSampleRow(row, table.columns)),
      });
    } catch (error) {
      results.push({
        tableName: table.tableName,
        rowCount: 0,
        sampleRows: [],
        loadError: error.message || "样例数据读取失败",
      });
    }
  }
  return results;
}

async function loadAiTableSchemas(dataSource, tables = []) {
  const results = [];
  for (const table of tables) {
    const tableName = table.tableName || table.name;
    try {
      const columns = await metadataService.listColumns(dataSource, tableName);
      results.push({
        tableName,
        tableType: table.tableType || table.type || "",
        tableComment: table.tableComment || table.comment || "",
        columns: asArray(columns).map((column) => ({
          name: column.columnName,
          dataType: column.dataType,
          columnType: column.columnType,
          nullable: Boolean(column.isNullable),
          primaryKey: Boolean(column.isPrimaryKey),
          comment: column.columnComment || "",
        })),
      });
    } catch (error) {
      results.push({
        tableName,
        tableType: table.tableType || table.type || "",
        tableComment: table.tableComment || table.comment || "",
        columns: [],
        loadError: error.message || "字段加载失败",
      });
    }
  }
  return results;
}

function buildAiSqlSystemPrompt(dialect, configuredPrompt = "", variables = {}) {
  const renderedPrompt = renderPromptTemplate(configuredPrompt, {
    dialect,
    sceneCode: AI_SQL_PLAN_SCENE_CODE,
    ...variables,
  });
  return [
    renderedPrompt || "你是报表平台中的自然语言转 SQL 助手。",
    `当前数据库 SQL 方言: ${dialect}。`,
    "必须严格依据给定数据源元数据生成 SQL，不允许臆造不存在的表或字段。",
    ...buildAiSqlDialectRules(dialect),
    "只能生成一条只读 SELECT 或 WITH 查询 SQL，不能包含 INSERT、UPDATE、DELETE、DDL、存储过程或多语句。",
    "不要 SELECT *，必须明确输出适合图表使用的维度字段和指标字段。",
    "如果提供了表样例数据，可以参考样例值理解字段含义，但仍必须以字段结构为准。",
    "优先生成聚合查询，并为输出字段设置清晰稳定的英文或拼音别名。",
    "如果需求信息不足，把 questions 写清楚，generatedSql 可以为空。",
    "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    JSON.stringify({
      summary: "简短说明",
      generatedSql: "SQL",
      usedTables: [{ tableName: "表名", reason: "使用原因", columns: ["字段"] }],
      assumptions: ["假设"],
      risks: ["风险"],
      questions: ["需要追问的问题"],
      confidence: 0.8,
    }),
  ].filter(Boolean).join("\n");
}

function buildAiSqlRevisionSystemPrompt(dialect, configuredPrompt = "", variables = {}) {
  const renderedPrompt = renderPromptTemplate(configuredPrompt, {
    dialect,
    sceneCode: AI_SQL_REVISION_SCENE_CODE,
    ...variables,
  });
  return [
    renderedPrompt || "你是报表平台中的 SQL 二次修改助手。",
    `当前数据库 SQL 方言: ${dialect}。`,
    "必须基于用户当前 SQL、修改要求、结果画像和给定表结构做最小必要修改。",
    ...buildAiSqlDialectRules(dialect),
    "只能返回一条只读 SELECT 或 WITH 查询 SQL，不能包含 INSERT、UPDATE、DELETE、DDL、存储过程或多语句。",
    "不要 SELECT *，必须明确输出适合图表使用的维度字段和指标字段。",
    "如果提供了表样例数据，可以参考样例值理解字段含义，但仍必须以字段结构为准。",
    "如果无法安全修改，把 questions 写清楚，generatedSql 可以为空。",
    "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    JSON.stringify({
      summary: "简短说明",
      generatedSql: "修改后的 SQL",
      usedTables: [{ tableName: "表名", reason: "使用原因", columns: ["字段"] }],
      assumptions: ["假设"],
      risks: ["风险"],
      questions: ["需要追问的问题"],
      confidence: 0.8,
    }),
  ].filter(Boolean).join("\n");
}

function buildAiSqlUserPrompt(payload, context) {
  const datasource = {
    dialect: context.dialect,
  };
  return [
    "用户报表需求:",
    payload.prompt,
    "",
    "当前可用表（最多80张）:",
    JSON.stringify(context.availableTables, null, 2),
    "",
    "候选表字段结构（最多5张表）:",
    JSON.stringify(context.tableSchemas, null, 2),
    "",
    context.tableSamples?.length ? [
      "候选表随机样例数据（每表最多50行，字段值最多100字符）:",
      JSON.stringify(context.tableSamples, null, 2),
      "",
    ].join("\n") : "",
    payload.currentSql ? `用户当前已有 SQL:\n${payload.currentSql}` : "",
    "",
    "生成要求:",
    "1. generatedSql 只返回 SQL 内容，不要带分号。",
    "2. usedTables 只能来自候选表字段结构。",
    `3. 必须使用 ${context.dialect} 方言生成 SQL，不允许混用其他数据库的函数、类型转换、日期格式化或分页语法。`,
    "4. 如果涉及地区统计，优先识别地区名称、省市名称或行政区划编码字段。",
    "5. 返回字段数量应控制在图表友好的范围内，常见结构为 1 个维度 + 1 到 2 个指标。",
    "",
    "可用于提示词变量的上下文:",
    JSON.stringify({
      datasource,
      tables: context.tableSchemas,
      tableSamples: context.tableSamples || [],
      prompt: payload.prompt,
      currentSql: payload.currentSql || "",
    }, null, 2),
  ].filter(Boolean).join("\n");
}

function buildAiSqlRevisionUserPrompt(payload, context) {
  const datasource = {
    dialect: context.dialect,
  };
  return [
    "用户原始报表需求:",
    payload.prompt || "",
    "",
    "用户当前 SQL:",
    payload.currentSql || "",
    "",
    "用户本次修改要求:",
    payload.revisionInstruction || "",
    "",
    payload.lastError ? `上次执行错误:\n${payload.lastError}` : "",
    "",
    payload.lastQueryProfile ? [
      "上次查询结果画像:",
      JSON.stringify(payload.lastQueryProfile, null, 2),
      "",
    ].join("\n") : "",
    "当前可用表（最多80张）:",
    JSON.stringify(context.availableTables, null, 2),
    "",
    "候选表字段结构（最多5张表）:",
    JSON.stringify(context.tableSchemas, null, 2),
    "",
    context.tableSamples?.length ? [
      "候选表随机样例数据（每表最多50行，字段值最多100字符）:",
      JSON.stringify(context.tableSamples, null, 2),
      "",
    ].join("\n") : "",
    "修改要求:",
    "1. generatedSql 只返回修改后的 SQL 内容，不要带分号。",
    "2. 尽量保留当前 SQL 已确认的表、过滤条件和口径，只按用户本次要求调整。",
    "3. usedTables 只能来自候选表字段结构。",
    `4. 必须使用 ${context.dialect} 方言修复 SQL，不允许混用其他数据库语法。`,
    "5. 如果给出了上次错误信息，必须基于错误原因修复 SQL，而不是重复原错误写法。",
    "6. 返回字段数量应控制在图表友好的范围内。",
    "",
    "可用于提示词变量的上下文:",
    JSON.stringify({
      datasource,
      tables: context.tableSchemas,
      tableSamples: context.tableSamples || [],
      prompt: payload.prompt || "",
      currentSql: payload.currentSql || "",
      revisionInstruction: payload.revisionInstruction || "",
      lastQueryProfile: payload.lastQueryProfile || null,
      lastError: payload.lastError || "",
    }, null, 2),
  ].filter(Boolean).join("\n");
}

function normalizeAiSqlPlan(rawText, parsed, context, provider, validation) {
  const generatedSql = normalizeText(parsed?.generatedSql);
  const availableTableNames = new Set(context.tableSchemas.map((item) => String(item.tableName)));
  const usedTables = asArray(parsed?.usedTables)
    .map((item) => ({
      tableName: normalizeText(item?.tableName),
      reason: normalizeText(item?.reason),
      columns: uniqueStrings(item?.columns),
    }))
    .filter((item) => item.tableName && availableTableNames.has(item.tableName));

  return {
    provider: buildProviderSummary(provider),
    dialect: context.dialect,
    summary: normalizeText(parsed?.summary, generatedSql ? "AI 已生成报表查询 SQL" : "AI 未生成可执行 SQL"),
    generatedSql,
    usedTables,
    assumptions: uniqueStrings(parsed?.assumptions),
    risks: uniqueStrings(parsed?.risks),
    questions: uniqueStrings(parsed?.questions),
    confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : null,
    validation,
    metadata: {
      availableTables: context.availableTables,
      tableSchemas: context.tableSchemas,
      tableSamples: context.tableSamples || [],
      rawText,
    },
  };
}

async function validateGeneratedReportSql(dataSource, sql, dialect, availableTables = []) {
  const validation = createAiSqlValidationResult();
  let safeSql = "";
  try {
    safeSql = ensureSafeReportAiSql(sql, dialect);
    validation.syntaxValid = true;
    const referencedTables = extractSqlTables(safeSql, dialect);
    const cteNames = extractCteNames(safeSql, dialect);
    const missingTables = referencedTables.filter((tableName) => {
      const normalizedTableName = normalizeTableNameForMatch(tableName);
      return !cteNames.has(normalizedTableName) && !tableExistsInAvailableTables(tableName, availableTables);
    });
    validation.objectValid = missingTables.length === 0;
    if (missingTables.length) {
      validation.messages.push(...missingTables.map((tableName) => `未在当前数据源中识别到表: ${tableName}`));
    }
    if (validation.objectValid) {
      const explainResult = await explainReportSql(dataSource, safeSql);
      validation.explainValid = explainResult.explainValid;
      validation.messages.push(...explainResult.messages);
    }
    validation.valid = validation.syntaxValid && validation.objectValid && validation.explainValid;
  } catch (error) {
    validation.messages.push(error.message || "SQL 校验失败");
  }
  validation.messages = uniqueStrings(validation.messages);
  return {
    validation,
    safeSql,
  };
}

async function executeAiChartSqlRevisionRound(payload, options = {}) {
  const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
  const dataSource = options.dataSource || await ensureActiveReportDataSource(payload.sourceId);
  const resolved = options.resolved || resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
  const dialect = options.dialect || resolved.dialect || dataSource.sourceType || "mysql";
  const currentSql = sanitizeSqlText(payload.currentSql);
  if (!currentSql) {
    throw new AppError("请先提供需要修复的 SQL", 400);
  }
  const tables = options.tables || await metadataService.listTables(dataSource);
  const referencedTables = extractSqlTables(currentSql, dialect);
  const candidates = selectAiCandidateTables(tables, {
    prompt: `${payload.prompt || ""} ${payload.revisionInstruction || ""}`,
    currentSql,
    selectedTables: selectedTables.length ? selectedTables : referencedTables,
  });
  const tableSchemas = await loadAiTableSchemas(dataSource, candidates.schemaTables);
  const tableSamples = await loadAiTableSamples(dataSource, tableSchemas);
  const context = {
    dialect,
    availableTables: candidates.availableTables.map((item) => ({
      tableName: item.tableName || item.name,
      tableType: item.tableType || item.type || "",
      tableComment: item.tableComment || item.comment || "",
    })),
    tableSchemas,
    tableSamples,
  };
  const resolvedAi = await resolveReportingAiProvider(AI_SQL_REVISION_SCENE_CODE);
  const aiConfig = resolvedAi.aiConfig;
  const provider = resolvedAi.provider;
  const completion = await modelProviderService.generateChatCompletion(
    provider,
    [
      {
        role: "system",
        content: buildAiSqlRevisionSystemPrompt(dialect, aiConfig?.systemPrompt || "", {
          datasource: {
            sourceId: Number(payload.sourceId),
            sourceType: dataSource.sourceType,
            sourceName: dataSource.sourceName,
            dialect,
          },
          tables: context.tableSchemas,
          tableSamples: context.tableSamples,
          prompt: payload.prompt || "",
          currentSql,
          revisionInstruction: payload.revisionInstruction || "",
          lastQueryProfile: payload.lastQueryProfile || null,
          lastError: payload.lastError || "",
        }),
      },
      { role: "user", content: buildAiSqlRevisionUserPrompt({ ...payload, currentSql }, context) },
    ],
    buildAiRuntimeOptions(aiConfig, { maxTokens: 1800 })
  );
  const rawText = completion?.content || "";
  const parsed = parseJsonObjectWithRecovery(rawText);
  const generatedSql = normalizeText(parsed?.generatedSql);
  const validation = createAiSqlValidationResult();
  let safeSql = "";

  if (!generatedSql) {
    validation.messages.push("AI 未返回可执行 SQL");
    const result = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
    return {
      dataSource,
      dialect,
      tables,
      currentSql,
      provider,
      validation,
      result,
      rawText,
      parsed,
      context,
      selectedTables,
    };
  }

  const validationResult = await validateGeneratedReportSql(dataSource, generatedSql, dialect, tables);
  safeSql = validationResult.safeSql;
  Object.assign(validation, validationResult.validation);
  if (safeSql) {
    parsed.generatedSql = safeSql;
  }
  const result = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
  return {
    dataSource,
    dialect,
    tables,
    currentSql,
    provider,
    validation,
    result,
    rawText,
    parsed,
    context,
    selectedTables,
  };
}

async function attemptAutoReviseAiChartSql(payload, options = {}) {
  const reason = uniqueStrings([
    normalizeText(payload.lastError),
    ...asArray(options.validationMessages),
  ]).join("；");
  const revisionInstruction = payload.revisionInstruction
    || buildAiSqlAutoRevisionInstruction(options.dialect || "mysql", reason);
  try {
    const revision = await executeAiChartSqlRevisionRound({
      ...payload,
      currentSql: payload.currentSql,
      revisionInstruction,
      lastError: reason || payload.lastError || "",
    }, options);
    return {
      success: true,
      revision,
    };
  } catch (error) {
    return {
      success: false,
      error,
    };
  }
}

async function previewValidatedAiChartQuery(dataSource, sourceSql, limit) {
  const explainResult = await explainReportSql(dataSource, sourceSql);
  if (!explainResult.explainValid) {
    throw new AppError(explainResult.messages.join("；") || "SQL 执行计划校验未通过", 400);
  }
  const preview = await previewAiSqlStructure(dataSource, sourceSql, limit);
  return {
    explainResult,
    preview,
  };
}

function isNumericDataType(dataType = "") {
  return /(int|decimal|numeric|number|double|float|real|money|bigint|smallint|tinyint)/i.test(String(dataType || ""));
}

function isTimeDataType(dataType = "") {
  return /(date|time|timestamp|year)/i.test(String(dataType || ""));
}

function isGeoFieldName(name = "") {
  return /(province|city|region|area|district|adcode|行政|地区|区域|省|市|区县|地市)/i.test(String(name || ""));
}

function isGeoDimensionFieldName(name = "") {
  const raw = String(name || "").trim();
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  return /(adcode|province(?:_?(name|code))?|city(?:_?(name|code))?|region(?:_?(name|code))?|district(?:_?(name|code))?|county(?:_?(name|code))?)/i.test(normalized)
    || /行政区划|行政区|地区|区域|省份|城市|地市|区县|县区|省代码|省编码|市代码|市编码/.test(raw);
}

function isGeoMappingField(field = {}) {
  return isGeoDimensionFieldName(`${field?.columnName || field?.name || ""} ${field?.label || ""}`);
}

function looksLikeDate(value) {
  return typeof value === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value.trim());
}

function looksLikeNumber(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null || value === undefined || value === "") return false;
  return /^-?\d+(?:\.\d+)?$/.test(String(value).trim());
}

function profileAiResult(fields = [], sampleRows = [], rowCount = 0) {
  const rows = asArray(sampleRows);
  const profiles = asArray(fields).map((field) => {
    const columnName = field.columnName || field.name;
    const values = rows
      .map((row) => row?.[columnName])
      .filter((value) => value !== null && value !== undefined && value !== "");
    const distinctValues = uniqueStrings(values.map((value) => String(value))).slice(0, 20);
    const numericValues = values.filter(looksLikeNumber);
    const dateValues = values.filter(looksLikeDate);
    const dataType = String(field.dataType || "").trim().toLowerCase();
    const role = isGeoDimensionFieldName(columnName)
      ? "dimension"
      : isNumericDataType(dataType) || (values.length > 0 && numericValues.length / values.length >= 0.8)
        ? "metric"
        : isTimeDataType(dataType) || (values.length > 0 && dateValues.length / values.length >= 0.8)
        ? "time"
        : "dimension";
    return {
      columnName,
      label: field.label || columnName,
      dataType: dataType || field.dataType || "string",
      role,
      semanticType: isGeoDimensionFieldName(columnName) ? "geo" : null,
      distinctCount: distinctValues.length,
      sampleValues: distinctValues.slice(0, 8),
    };
  }).filter((item) => item.columnName);

  return {
    rowCount: Number(rowCount || rows.length || 0),
    sampleCount: rows.length,
    fields: profiles,
    dimensions: profiles.filter((item) => item.role === "dimension"),
    metrics: profiles.filter((item) => item.role === "metric"),
    timeFields: profiles.filter((item) => item.role === "time"),
    geographyFields: profiles.filter((item) => item.semanticType === "geo"),
  };
}

function enrichPreviewFieldsWithProfile(fields = [], profile) {
  const profileMap = new Map(asArray(profile?.fields).map((item) => [item.columnName, item]));
  return asArray(fields).map((field) => {
    const matched = profileMap.get(field.columnName);
    return {
      ...field,
      role: matched?.role || field.role || "dimension",
    };
  });
}

function pickFieldName(fields = [], preferred = []) {
  const list = asArray(fields);
  for (const matcher of preferred) {
    const found = list.find((item) => {
      const text = `${item.columnName || ""} ${item.label || ""}`.toLowerCase();
      return typeof matcher === "function" ? matcher(item) : text.includes(String(matcher).toLowerCase());
    });
    if (found?.columnName) return found.columnName;
  }
  return list[0]?.columnName || null;
}

function findChartAssetByFamily(chartAssets = [], family = "") {
  const normalizedFamily = normalizeChartFamily(family);
  return asArray(chartAssets).find((asset) => asset.status !== "inactive" && normalizeChartAssetFamily(asset) === normalizedFamily)
    || asArray(chartAssets).find((asset) => asset.status !== "inactive" && normalizeChartAssetFamily(asset) === "bar")
    || asArray(chartAssets).find((asset) => asset.status !== "inactive")
    || null;
}

function buildRecommendationEntry(chartAssets, family, title, reason, score, fieldMap, widgetType = "chart") {
  const normalizedFamily = normalizeChartFamily(family);
  const asset = widgetType === "chart" ? findChartAssetByFamily(chartAssets, normalizedFamily) : null;
  return {
    chartFamily: normalizedFamily,
    chartAssetId: asset?.id || null,
    chartName: asset?.chartName || (widgetType === "kpi" ? "指标看板" : widgetType === "table" ? "明细表" : title),
    widgetType,
    title,
    reason,
    score,
    fieldMap,
  };
}

function getChartAssetMappingFields(asset = null) {
  const fields = asset?.mappingSchema && typeof asset.mappingSchema === "object" ? asset.mappingSchema.fields : [];
  return Array.isArray(fields) ? fields : [];
}

function resolveMappingFieldRole(field = {}) {
  if (isGeoMappingField(field)) return "dimension";
  const role = String(field?.role || "").toLowerCase();
  if (role) return role;
  const dataType = String(field?.dataType || field?.type || "").toLowerCase();
  if (/(int|decimal|numeric|number|double|float|real|money|bigint|smallint|tinyint)/i.test(dataType)) return "metric";
  if (/(date|time|timestamp|year)/i.test(dataType)) return "time";
  return "dimension";
}

function fieldRoleMatchesAcceptedRole(role, acceptedRole) {
  const accepted = String(acceptedRole || "").toLowerCase();
  if (!accepted) return true;
  if (accepted === role) return true;
  if (accepted === "value" && role === "metric") return true;
  if (accepted === "category" && role === "dimension") return true;
  return false;
}

function applyDefaultFieldMapBySchema(currentFieldMap = {}, asset = null, fields = []) {
  const mappingFields = getChartAssetMappingFields(asset);
  if (!mappingFields.length || !Array.isArray(fields) || !fields.length) {
    return { ...(currentFieldMap || {}) };
  }

  const nextFieldMap = { ...(currentFieldMap || {}) };
  const availableFields = fields.filter((item) => item?.columnName);
  const fieldMap = new Map(availableFields.map((item) => [item.columnName, item]));
  const hasField = (fieldName) => Boolean(fieldName && fieldMap.has(fieldName));
  const isAccepted = (fieldName, acceptedRoles = []) => {
    if (!fieldName) return false;
    if (!acceptedRoles.length) return true;
    const field = fieldMap.get(fieldName);
    if (!field) return false;
    const role = resolveMappingFieldRole(field);
    return acceptedRoles.some((item) => fieldRoleMatchesAcceptedRole(role, item));
  };
  const pickField = (acceptedRoles = [], options = {}) => {
    const exclude = new Set(asArray(options.exclude).filter(Boolean));
    const preferMetric = Boolean(options.preferMetric);
    const preferGeo = Boolean(options.preferGeo);
    if (preferGeo) {
      const geoField = availableFields.find((item) => {
        if (exclude.has(item.columnName)) return false;
        return isGeoMappingField(item) && isAccepted(item.columnName, acceptedRoles);
      });
      if (geoField?.columnName) return geoField.columnName;
    }
    if (preferMetric) {
      const metricField = availableFields.find((item) => {
        if (exclude.has(item.columnName)) return false;
        return ["metric", "value"].includes(resolveMappingFieldRole(item)) && isAccepted(item.columnName, acceptedRoles);
      });
      if (metricField?.columnName) return metricField.columnName;
    }
    return availableFields.find((item) => !exclude.has(item.columnName) && isAccepted(item.columnName, acceptedRoles))?.columnName || "";
  };

  for (const field of mappingFields) {
    if (!field?.key) continue;
    if (hasField(nextFieldMap[field.key])) {
      continue;
    }
    const acceptedRoles = Array.isArray(field.acceptRoles) ? field.acceptRoles : [];
    const preferGeo = field.key === "mapField";
    const preferMetric = !preferGeo && acceptedRoles.some((item) => ["metric", "value"].includes(String(item || "").toLowerCase()));
    const exclude = preferMetric
      ? Object.entries(nextFieldMap)
        .filter(([key, value]) => key !== field.key && value)
        .map(([, value]) => value)
      : [];
    nextFieldMap[field.key] = pickField(acceptedRoles, { exclude, preferMetric, preferGeo });
  }

  return nextFieldMap;
}

function validateRecommendationFieldMap(recommendation, chartAssets = [], profile = {}) {
  const availableFields = new Set(asArray(profile?.fields).map((item) => item.columnName).filter(Boolean));
  const fieldMap = recommendation?.fieldMap && typeof recommendation.fieldMap === "object" ? recommendation.fieldMap : {};
  const messages = [];
  let valid = true;

  if (recommendation?.widgetType === "table") {
    return { valid: true, messages: [], missingRequiredKeys: [], unknownFields: [] };
  }

  const asset = recommendation?.chartAssetId
    ? chartAssets.find((item) => Number(item.id) === Number(recommendation.chartAssetId))
    : null;
  const mappingFields = recommendation?.widgetType === "kpi"
    ? [{ key: "valueField", required: true }]
    : getChartAssetMappingFields(asset);
  const missingRequiredKeys = mappingFields
    .filter((item) => item.required !== false && !fieldMap[item.key])
    .map((item) => item.key);
  const unknownFields = Object.entries(fieldMap)
    .filter(([, value]) => value && !availableFields.has(value))
    .map(([key, value]) => ({ key, value }));

  if (missingRequiredKeys.length) {
    valid = false;
    messages.push(`字段映射缺少必填项: ${missingRequiredKeys.join(", ")}`);
  }
  if (unknownFields.length) {
    valid = false;
    messages.push(`字段映射包含查询结果中不存在的字段: ${unknownFields.map((item) => `${item.key}=${item.value}`).join(", ")}`);
  }
  return {
    valid,
    messages,
    missingRequiredKeys,
    unknownFields,
  };
}

function attachFieldMapValidation(recommendations = [], chartAssets = [], profile = {}) {
  return asArray(recommendations).map((item) => ({
    ...item,
    fieldMapValidation: validateRecommendationFieldMap(item, chartAssets, profile),
  }));
}

function buildDeterministicRecommendations(profile, chartAssets = [], prompt = "") {
  const metrics = asArray(profile?.metrics);
  const dimensions = asArray(profile?.dimensions);
  const timeFields = asArray(profile?.timeFields);
  const geoFields = asArray(profile?.geographyFields);
  const firstMetric = pickFieldName(metrics);
  const secondMetric = metrics.find((item) => item.columnName !== firstMetric)?.columnName || null;
  const firstDimension = pickFieldName(dimensions);
  const firstTime = pickFieldName(timeFields);
  const firstGeo = pickFieldName(geoFields);
  const rowCount = Number(profile?.rowCount || 0);
  const recommendations = [];

  if (firstTime && firstMetric) {
    recommendations.push(buildRecommendationEntry(
      chartAssets,
      "line",
      "趋势折线图",
      "查询结果包含时间字段和指标字段，适合观察趋势变化。",
      0.95,
      { xField: firstTime, yField: firstMetric, ...(secondMetric ? { yField2: secondMetric } : {}) }
    ));
    recommendations.push(buildRecommendationEntry(
      chartAssets,
      "area",
      "趋势面积图",
      "适合突出指标随时间变化的规模和累计感。",
      0.86,
      { xField: firstTime, yField: firstMetric }
    ));
  }

  if (firstGeo && firstMetric) {
    recommendations.push(buildRecommendationEntry(
      chartAssets,
      "map",
      "区域地图",
      "查询结果包含地区字段和指标字段，适合做区域分布分析。",
      /地区|区域|地图|省|城市|city|province/i.test(prompt) ? 0.96 : 0.9,
      { mapField: firstGeo, valueField: firstMetric }
    ));
  }

  if (firstDimension && firstMetric) {
    recommendations.push(buildRecommendationEntry(
      chartAssets,
      "bar",
      "分类柱形图",
      "一维分类和指标字段适合做横向比较。",
      0.88,
      { xField: firstDimension, yField: firstMetric, ...(secondMetric ? { yField2: secondMetric } : {}) }
    ));
    recommendations.push(buildRecommendationEntry(
      chartAssets,
      "horizontalBar",
      "排名条形图",
      "分类较多或排名场景下横向条形图更易阅读。",
      0.84,
      { yField: firstDimension, xField: firstMetric }
    ));
    if (rowCount > 0 && rowCount <= 12) {
      recommendations.push(buildRecommendationEntry(
        chartAssets,
        "pie",
        "占比饼图",
        "分类数量较少时可用于展示占比结构。",
        0.76,
        { nameField: firstDimension, valueField: firstMetric }
      ));
    }
  }

  if (firstMetric && secondMetric && (firstTime || firstDimension)) {
    const xField = firstTime || firstDimension;
    recommendations.push(buildRecommendationEntry(
      chartAssets,
      "combo",
      "组合图",
      "多指标结果适合用柱线组合对比主次指标。",
      0.8,
      { xField, barField: firstMetric, lineField: secondMetric }
    ));
  }

  if (!firstDimension && firstMetric) {
    recommendations.push(buildRecommendationEntry(
      chartAssets,
      "kpi",
      "指标卡",
      "结果以单指标或少量指标为主，适合作为关键指标卡。",
      0.82,
      { valueField: firstMetric },
      "kpi"
    ));
  }

  recommendations.push(buildRecommendationEntry(
    chartAssets,
    "table",
    "结果明细表",
    "保留查询结果明细，便于审核字段和数据。",
    0.55,
    {},
    "table"
  ));

  const unique = [];
  const seen = new Set();
  recommendations
    .filter((item) => item.widgetType !== "chart" || item.chartAssetId)
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .forEach((item) => {
      const key = `${item.widgetType}:${item.chartFamily}:${item.chartAssetId || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
  return unique.slice(0, 6);
}

function normalizeAiRecommendations(parsed, fallbackRecommendations, chartAssets, profile) {
  const fallbackByFamily = new Map(fallbackRecommendations.map((item) => [normalizeChartFamily(item.chartFamily || item.widgetType), item]));
  const normalized = asArray(parsed?.recommendations)
    .map((item) => {
      const widgetType = ["kpi", "table"].includes(String(item?.widgetType || "").toLowerCase())
        ? String(item.widgetType).toLowerCase()
        : "chart";
      const family = widgetType === "chart" ? normalizeChartFamily(item?.chartFamily) : widgetType;
      if (widgetType === "chart" && !AI_SUPPORTED_CHART_FAMILIES.includes(family)) return null;
      const fallback = fallbackByFamily.get(family) || fallbackRecommendations[0];
      let asset = null;
      if (widgetType === "chart") {
        const requestedAsset = item?.chartAssetId
          ? chartAssets.find((assetItem) => Number(assetItem.id) === Number(item.chartAssetId))
          : null;
        asset = requestedAsset && normalizeChartAssetFamily(requestedAsset) === family
          ? requestedAsset
          : findChartAssetByFamily(chartAssets, family);
      }
      if (widgetType === "chart" && !asset) return null;
      return {
        chartFamily: family,
        chartAssetId: asset?.id || null,
        chartName: asset?.chartName || fallback?.chartName || "",
        widgetType,
        title: normalizeText(item?.title, fallback?.title || asset?.chartName || "AI 推荐图表"),
        reason: normalizeText(item?.reason, fallback?.reason || "基于查询结果字段画像推荐"),
        score: Number.isFinite(Number(item?.score)) ? Number(item.score) : (fallback?.score || 0.7),
        fieldMap: {
          ...(fallback?.fieldMap || {}),
          ...(item?.fieldMap && typeof item.fieldMap === "object" ? item.fieldMap : {}),
        },
      };
    })
    .filter(Boolean);

  const merged = [];
  const seen = new Set();
  [...normalized, ...fallbackRecommendations].forEach((item) => {
    const key = `${item.widgetType}:${item.chartFamily}:${item.chartAssetId || ""}:${JSON.stringify(item.fieldMap || {})}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged
    .filter((item) => item.widgetType !== "chart" || item.chartAssetId)
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .slice(0, 6)
    .map((item, index) => ({ ...item, rank: index + 1, profileSummary: index === 0 ? {
      dimensions: asArray(profile?.dimensions).map((field) => field.columnName),
      metrics: asArray(profile?.metrics).map((field) => field.columnName),
      timeFields: asArray(profile?.timeFields).map((field) => field.columnName),
      geographyFields: asArray(profile?.geographyFields).map((field) => field.columnName),
    } : undefined }));
}

function buildAiRecommendationSystemPrompt(configuredPrompt = "", variables = {}) {
  const renderedPrompt = renderPromptTemplate(configuredPrompt, {
    sceneCode: AI_CHART_RECOMMENDATION_SCENE_CODE,
    supportedChartFamilies: AI_SUPPORTED_CHART_FAMILIES,
    ...variables,
  });
  return [
    renderedPrompt || "你是报表平台中的图表推荐助手。",
    "必须结合查询结果字段画像和平台支持的图表族推荐可落地的图表。",
    `当前支持的 chartFamily: ${AI_SUPPORTED_CHART_FAMILIES.join(", ")}。`,
    "不要推荐当前平台不支持的图表类型，不要编造字段。",
    "fieldMap 必须只使用字段画像中存在的 columnName。",
    "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    JSON.stringify({
      recommendations: [{
        chartFamily: "bar",
        widgetType: "chart",
        title: "图表标题",
        reason: "推荐原因",
        score: 0.9,
        fieldMap: { xField: "字段", yField: "字段" },
      }],
    }),
  ].filter(Boolean).join("\n");
}

function buildAiRecommendationUserPrompt(payload, profile, fallbackRecommendations) {
  return [
    "用户原始需求:",
    payload.prompt || "",
    "",
    "查询结果字段画像:",
    JSON.stringify(profile, null, 2),
    "",
    "规则引擎候选推荐:",
    JSON.stringify(fallbackRecommendations, null, 2),
    "",
    "请在候选基础上返回 1 到 5 个推荐，优先保证字段映射可执行。",
  ].join("\n");
}

function buildAiFieldMapSystemPrompt(configuredPrompt = "", variables = {}) {
  const renderedPrompt = renderPromptTemplate(configuredPrompt, {
    sceneCode: AI_CHART_FIELD_MAP_SCENE_CODE,
    ...variables,
  });
  return [
    renderedPrompt || "你是报表平台中的图表字段映射助手。",
    "必须根据目标图表风格的字段要求，从查询结果字段中分配最合适的分类字段、指标字段、时间字段等。",
    "优先结合字段画像、字段名语义、样例数据和用户原始需求判断，不要机械按数据类型猜测。",
    "只能使用查询结果中存在的 columnName，不要编造字段。",
    "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    JSON.stringify({
      fieldMap: {
        xField: "字段名",
        yField: "字段名",
      },
      reason: "为什么这样分配",
    }),
  ].filter(Boolean).join("\n");
}

function buildAiFieldMapUserPrompt(payload, profile, asset, fallbackFieldMap = {}) {
  return [
    "用户原始需求:",
    payload.prompt || "",
    "",
    "目标图表资产:",
    JSON.stringify({
      chartAssetId: asset?.id || null,
      chartName: asset?.chartName || "",
      chartCode: asset?.chartCode || "",
      chartFamily: normalizeChartAssetFamily(asset),
      variantName: asset?.variantName || asset?.config?.variantName || "",
      mappingSchema: asset?.mappingSchema || {},
    }, null, 2),
    "",
    "查询结果字段画像:",
    JSON.stringify(profile, null, 2),
    "",
    "查询样例数据（节选）:",
    JSON.stringify(asArray(payload.sampleRows).slice(0, 20), null, 2),
    "",
    "当前默认字段映射:",
    JSON.stringify(fallbackFieldMap, null, 2),
    "",
    "请返回最合适的 fieldMap，保证字段角色和图表要求匹配。",
  ].join("\n");
}

async function previewDatasetStructure(dataSource, datasetType, sourceTable, sourceSql, limit) {
  if (datasetType === "table") {
    if (!sourceTable) {
      throw new AppError("请选择源表", 400);
    }
    const [fields, rows] = await Promise.all([
      metadataService.listColumns(dataSource, sourceTable),
      metadataService.sampleRows(dataSource, sourceTable, limit),
    ]);
    return {
      fields: fields.map((field) => ({
        columnName: field.columnName,
        label: field.columnComment || field.columnName,
        dataType: String(field.dataType || "string").trim().toLowerCase(),
        role: inferFieldRoleFromDataType(field.dataType, field.columnName || field.columnComment),
        aggregation: null,
        visible: true,
      })),
      sampleRows: rows,
      rowCount: rows.length,
    };
  }

  return withReportConnection(dataSource, async (connection, dialect) => {
    const previewSql = buildPreviewSql(sourceSql, limit, dialect);
    if (dialect === "mysql") {
      const [rows, fields] = await connection.query(previewSql);
      const sampleRows = Array.isArray(rows) ? rows : [];
      const inferred = inferPreviewColumns((fields || []).map((item) => item.name), sampleRows);
      return {
        fields: inferred.map((field) => ({
          ...field,
          role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
          aggregation: null,
          visible: true,
        })),
        sampleRows,
        rowCount: sampleRows.length,
      };
    }
    const result = await connection.query(previewSql);
    const sampleRows = Array.isArray(result.rows) ? result.rows : [];
    const inferred = inferPreviewColumns((result.fields || []).map((item) => item.name), sampleRows);
    return {
      fields: inferred.map((field) => ({
        ...field,
        role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
        aggregation: null,
        visible: true,
      })),
      sampleRows,
      rowCount: sampleRows.length,
    };
  });
}

async function previewAiSqlStructure(dataSource, sourceSql, limit = MAX_AI_SAMPLE_ROWS) {
  return withReportConnection(dataSource, async (connection, dialect) => {
    const previewSql = buildPreviewSql(sourceSql, Math.max(1, Math.min(MAX_AI_QUERY_LIMIT, Number(limit || MAX_AI_SAMPLE_ROWS) || MAX_AI_SAMPLE_ROWS)), dialect);
    if (dialect === "mysql") {
      const [rows, fields] = await connection.query({
        sql: previewSql,
        timeout: AI_QUERY_TIMEOUT_MS,
      });
      const sampleRows = Array.isArray(rows) ? rows : [];
      const inferred = inferPreviewColumns((fields || []).map((item) => item.name), sampleRows);
      return {
        fields: inferred.map((field) => ({
          ...field,
          role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
          aggregation: null,
          visible: true,
        })),
        sampleRows,
        rowCount: sampleRows.length,
      };
    }
    const result = await connection.query(previewSql);
    const sampleRows = Array.isArray(result.rows) ? result.rows : [];
    const inferred = inferPreviewColumns((result.fields || []).map((item) => item.name), sampleRows);
    return {
      fields: inferred.map((field) => ({
        ...field,
        role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
        aggregation: null,
        visible: true,
      })),
      sampleRows,
      rowCount: sampleRows.length,
    };
  });
}

async function ensureBuiltinChartAssets() {
  const existing = await repository.listReportChartAssets();
  const existingMap = new Map(existing.map((item) => [item.chartCode, item]));
  for (const asset of buildDefaultChartAssets()) {
    const matched = existingMap.get(asset.chartCode);
    if (!matched) {
      await repository.createReportChartAsset(asset);
      continue;
    }
    await repository.updateReportChartAsset(matched.id, { ...matched, ...asset });
  }
}

async function ensureBuiltinThemeTemplates() {
  const existing = await repository.listReportThemeTemplates();
  const existingMap = new Map(existing.map((item) => [item.themeCode, item]));
  for (const template of BUILTIN_THEME_TEMPLATES) {
    const matched = existingMap.get(template.themeCode);
    if (!matched) {
      await repository.createReportThemeTemplate(template);
      continue;
    }
    if (!matched.isBuiltin) {
      continue;
    }
    const shouldRefreshBuiltinTemplate = [
      "clean-card",
      "soft-panel",
      "slate-card",
      "boardroom-silver",
      "executive-ink",
      "capital-blueprint",
      "warm-paper",
      "violet-glow",
      "highlight-frame",
      "glass-minimal",
      "neon-frame",
      "progress-focus",
    ].includes(template.themeCode);
    const needsHorizontalBarBackfill = template.chartVariants?.horizontalBar
      && (!matched.chartVariants || !matched.chartVariants.horizontalBar);
    const needsLineBackfill = template.chartVariants?.line
      && (!matched.chartVariants || !matched.chartVariants.line);
    const needsRadarBackfill = template.chartVariants?.radar
      && (!matched.chartVariants || !matched.chartVariants.radar);
    const needsSankeyBackfill = template.chartVariants?.sankey
      && (!matched.chartVariants || !matched.chartVariants.sankey);
    const needsGaugeBackfill = template.chartVariants?.gauge
      && (!matched.chartVariants || !matched.chartVariants.gauge);
    const needsFunnelBackfill = template.chartVariants?.funnel
      && (!matched.chartVariants || !matched.chartVariants.funnel);
    const needsWordCloudBackfill = template.chartVariants?.wordCloud
      && (!matched.chartVariants || !matched.chartVariants.wordCloud);
    const needsScatterBackfill = template.chartVariants?.scatter
      && (!matched.chartVariants || !matched.chartVariants.scatter);
    const needsDashboardTitleColorBackfill = template.canvas?.dashboardTitleColor
      && (!matched.canvas || !matched.canvas.dashboardTitleColor);
    const expectedMapVariant = template.chartVariants?.map || null;
    const matchedMapVariant = matched.chartVariants?.map || null;
    const needsMapRefresh = !!expectedMapVariant && JSON.stringify({
      regionPalette: Array.isArray(matchedMapVariant?.regionPalette) ? matchedMapVariant.regionPalette : null,
      regionBorderColor: matchedMapVariant?.regionBorderColor || null,
      labelColor: matchedMapVariant?.labelColor || null,
      visualMapTextColor: matchedMapVariant?.visualMapTextColor || null,
    }) !== JSON.stringify({
      regionPalette: Array.isArray(expectedMapVariant?.regionPalette) ? expectedMapVariant.regionPalette : null,
      regionBorderColor: expectedMapVariant?.regionBorderColor || null,
      labelColor: expectedMapVariant?.labelColor || null,
      visualMapTextColor: expectedMapVariant?.visualMapTextColor || null,
    });
    if (shouldRefreshBuiltinTemplate) {
      await repository.updateReportThemeTemplate(matched.id, {
        ...matched,
        ...template,
      });
      continue;
    }
    if (needsHorizontalBarBackfill || needsLineBackfill || needsRadarBackfill || needsSankeyBackfill || needsGaugeBackfill || needsFunnelBackfill || needsWordCloudBackfill || needsScatterBackfill || needsDashboardTitleColorBackfill || needsMapRefresh) {
      await repository.updateReportThemeTemplate(matched.id, {
        ...matched,
        ...(needsDashboardTitleColorBackfill
          ? {
            canvas: {
              ...(matched.canvas || {}),
              dashboardTitleColor: template.canvas.dashboardTitleColor,
            },
          }
          : {}),
        chartVariants: {
          ...(matched.chartVariants || {}),
          ...(needsHorizontalBarBackfill ? { horizontalBar: template.chartVariants.horizontalBar } : {}),
          ...(needsLineBackfill ? { line: template.chartVariants.line } : {}),
          ...(needsRadarBackfill ? { radar: template.chartVariants.radar } : {}),
          ...(needsSankeyBackfill ? { sankey: template.chartVariants.sankey } : {}),
          ...(needsGaugeBackfill ? { gauge: template.chartVariants.gauge } : {}),
          ...(needsFunnelBackfill ? { funnel: template.chartVariants.funnel } : {}),
          ...(needsWordCloudBackfill ? { wordCloud: template.chartVariants.wordCloud } : {}),
          ...(needsScatterBackfill ? { scatter: template.chartVariants.scatter } : {}),
          ...(needsMapRefresh ? { map: template.chartVariants.map } : {}),
        },
      });
      continue;
    }
  }
}

async function getOverview() {
  await ensureBuiltinChartAssets();
  await ensureBuiltinThemeTemplates();
  return repository.getReportingOverview();
}

async function listReportDataSources() {
  return repository.listReportDataSources();
}

async function createReportDataSource(payload) {
  try {
    const normalized = normalizeReportDataSourcePayload(payload);
    return await repository.createReportDataSource(normalized);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("报表数据源编码已存在", 409);
    }
    throw error;
  }
}

async function updateReportDataSource(id, payload) {
  await ensureReportDataSource(id);
  try {
    const normalized = normalizeReportDataSourcePayload(payload);
    const row = await repository.updateReportDataSource(Number(id), normalized);
    if (!row) {
      throw new AppError("报表数据源不存在", 404);
    }
    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("报表数据源编码已存在", 409);
    }
    throw error;
  }
}

async function deleteReportDataSource(id) {
  await ensureReportDataSource(id);
  const datasetCount = await repository.countDatasetsBySourceId(Number(id));
  if (datasetCount > 0) {
    throw new AppError("报表数据源仍被数据集引用，无法删除", 409, { datasetCount });
  }
  const deleted = await repository.deleteReportDataSource(Number(id));
  return { id: Number(id), deleted };
}

async function testReportDataSourceConnection(payload) {
  return testDatabaseConnection(payload.connectionConfig || {}, payload.sourceType);
}

async function listReportDataSourceTables(sourceId) {
  const dataSource = await ensureActiveReportDataSource(sourceId);
  return metadataService.listTables(dataSource);
}

async function listReportDataSourceColumns(sourceId, tableName) {
  const dataSource = await ensureActiveReportDataSource(sourceId);
  return metadataService.listColumns(dataSource, tableName);
}

async function sampleReportDataSourceRows(sourceId, tableName, limit) {
  const dataSource = await ensureActiveReportDataSource(sourceId);
  return metadataService.sampleRows(dataSource, tableName, limit);
}

async function suggestAiChartAnalysis(payload) {
  const startedAt = Date.now();
  let provider = null;
  const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
  try {
    const dataSource = await ensureActiveReportDataSource(payload.sourceId);
    const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
    const dialect = resolved.dialect || dataSource.sourceType || "mysql";
    const tables = await metadataService.listTables(dataSource);
    const candidates = selectAiCandidateTables(tables, {
      prompt: payload.analysisDirection || payload.prompt || "",
      selectedTables,
    });
    const tableSchemas = await loadAiTableSchemas(dataSource, candidates.schemaTables);
    const tableSamples = await loadAiTableSamples(dataSource, tableSchemas);
    const context = {
      dialect,
      availableTables: candidates.availableTables.map((item) => ({
        tableName: item.tableName || item.name,
        tableType: item.tableType || item.type || "",
        tableComment: item.tableComment || item.comment || "",
      })),
      tableSchemas,
      tableSamples,
    };
    const fallbackSuggestions = buildDeterministicAnalysisSuggestions(context, payload.analysisDirection || payload.prompt || "");
    let warning = null;
    let rawText = "";
    let suggestions = fallbackSuggestions;

    try {
      const resolvedAi = await resolveReportingAiProvider(AI_ANALYSIS_SUGGESTION_SCENE_CODE);
      const aiConfig = resolvedAi.aiConfig;
      provider = resolvedAi.provider;
      const completion = await modelProviderService.generateChatCompletion(
        provider,
        [
          {
            role: "system",
            content: buildAiAnalysisSuggestionSystemPrompt(aiConfig?.systemPrompt || "", {
              datasource: {
                sourceId: Number(payload.sourceId),
                sourceType: dataSource.sourceType,
                sourceName: dataSource.sourceName,
                dialect,
              },
              tables: context.tableSchemas,
              tableSamples: context.tableSamples,
              analysisDirection: payload.analysisDirection || payload.prompt || "",
              dialect,
            }),
          },
          { role: "user", content: buildAiAnalysisSuggestionUserPrompt(payload, context) },
        ],
        buildAiRuntimeOptions(aiConfig, { maxTokens: 1600 })
      );
      rawText = completion?.content || "";
      const parsed = parseAiAnalysisSuggestionPayload(rawText);
      suggestions = normalizeAiAnalysisSuggestions(parsed, context);
      if (!suggestions.length) {
        warning = "模型未返回可用分析建议，已使用规则建议";
        suggestions = fallbackSuggestions;
      }
    } catch (error) {
      warning = error.message || "模型生成分析建议失败，已使用规则建议";
    }

    const result = {
      provider: buildProviderSummary(provider),
      summary: warning ? "已生成规则分析建议" : "已生成分析建议",
      suggestions,
      fallbackSuggestions,
      warning,
      metadata: {
        availableTables: context.availableTables,
        tableSchemas: context.tableSchemas,
        tableSamples: context.tableSamples,
        rawText,
      },
    };
    const audit = await recordReportingAiRun({
      sceneCode: AI_ANALYSIS_SUGGESTION_SCENE_CODE,
      sourceId: payload.sourceId,
      promptText: payload.analysisDirection || payload.prompt || "",
      provider: buildProviderSummary(provider),
      request: { selectedTables, dialect },
      response: result,
      status: warning ? "warning" : "success",
      durationMs: Date.now() - startedAt,
      errorMessage: warning,
    });
    return { ...result, auditRunId: audit?.id || null };
  } catch (error) {
    await recordReportingAiRun({
      sceneCode: AI_ANALYSIS_SUGGESTION_SCENE_CODE,
      sourceId: payload.sourceId,
      promptText: payload.analysisDirection || payload.prompt || "",
      provider: buildProviderSummary(provider),
      request: { selectedTables },
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error.message || "生成分析建议失败",
    });
    throw error;
  }
}

async function listReportDatasets() {
  return repository.listReportDatasets();
}

async function listReportDatasetFolders() {
  return repository.listReportDatasetFolders();
}

async function createReportDatasetFolder(payload) {
  const normalized = normalizeDatasetFolderPayload(payload);
  if (!normalized.folderName) {
    throw new AppError("请输入文件夹名称", 400);
  }
  await ensureReportDatasetFolderParent(null, normalized.parentId);
  return repository.createReportDatasetFolder(normalized);
}

async function updateReportDatasetFolder(id, payload) {
  const existingRecord = await repository.getReportDatasetFolderById(Number(id));
  if (!existingRecord) {
    throw new AppError("数据集文件夹不存在", 404);
  }
  const normalized = normalizeDatasetFolderPayload(payload, existingRecord);
  if (!normalized.folderName) {
    throw new AppError("请输入文件夹名称", 400);
  }
  await ensureReportDatasetFolderParent(Number(id), normalized.parentId);
  return repository.updateReportDatasetFolder(Number(id), normalized);
}

async function deleteReportDatasetFolder(id) {
  const deleted = await repository.deleteReportDatasetFolder(Number(id));
  if (!deleted) {
    throw new AppError("数据集文件夹不存在", 404);
  }
  return { id: Number(id), deleted: true };
}

async function previewReportDataset(payload) {
  const dataSource = await ensureActiveReportDataSource(payload.sourceId);
  return previewDatasetStructure(
    dataSource,
    payload.datasetType,
    payload.sourceTable,
    payload.sourceSql,
    payload.limit
  );
}

function buildDatasetTableQuerySql(dataSource, tableName, dialect) {
  if (!normalizeText(tableName)) {
    throw new AppError("请选择源表", 400);
  }
  const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
  const database = resolved.database;
  const schema = resolved.schema || "public";
  const parts = String(tableName || "").split(".").filter(Boolean).map((item) => item.replace(/[`"]/g, ""));
  const name = parts[parts.length - 1] || String(tableName || "").replace(/[`"]/g, "");
  const namespace = parts.length >= 2 ? parts[parts.length - 2] : (["postgresql", "oracle", "dm"].includes(dialect) ? schema : database);
  const qualifiedTable = namespace
    ? metadataService.escapeIdentifier(`${namespace}.${name}`, dialect)
    : metadataService.escapeIdentifier(name, dialect);
  return `SELECT * FROM ${qualifiedTable}`;
}

async function loadReportDatasetRows(dataSource, datasetType, sourceTable, sourceSql) {
  return withReportConnection(dataSource, async (connection, dialect) => {
    const normalizedDatasetType = String(datasetType || "table").trim().toLowerCase();
    const sql = normalizedDatasetType === "table"
      ? buildDatasetTableQuerySql(dataSource, sourceTable, dialect)
      : ensureSafeReportAiSql(sourceSql, dialect, { disallowSelectStar: false });
    if (dialect === "mysql") {
      const [rows] = await connection.query({
        sql,
        timeout: AI_QUERY_TIMEOUT_MS,
      });
      return Array.isArray(rows) ? rows : [];
    }
    const result = await connection.query(sql);
    return Array.isArray(result.rows) ? result.rows : [];
  });
}

async function planAiChartSql(payload) {
  const startedAt = Date.now();
  let provider = null;
  const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
  try {
    const dataSource = await ensureActiveReportDataSource(payload.sourceId);
    const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
    const dialect = resolved.dialect || dataSource.sourceType || "mysql";
    const tables = await metadataService.listTables(dataSource);
    const candidates = selectAiCandidateTables(tables, { ...payload, selectedTables });
    const tableSchemas = await loadAiTableSchemas(dataSource, candidates.schemaTables);
    const tableSamples = await loadAiTableSamples(dataSource, tableSchemas);
    const context = {
      dialect,
      availableTables: candidates.availableTables.map((item) => ({
        tableName: item.tableName || item.name,
        tableType: item.tableType || item.type || "",
        tableComment: item.tableComment || item.comment || "",
      })),
      tableSchemas,
      tableSamples,
    };
    const resolvedAi = await resolveReportingAiProvider(AI_SQL_PLAN_SCENE_CODE);
    const aiConfig = resolvedAi.aiConfig;
    provider = resolvedAi.provider;
    const completion = await modelProviderService.generateChatCompletion(
      provider,
      [
        {
          role: "system",
          content: buildAiSqlSystemPrompt(dialect, aiConfig?.systemPrompt || "", {
            datasource: {
              sourceId: Number(payload.sourceId),
              sourceType: dataSource.sourceType,
              sourceName: dataSource.sourceName,
              dialect,
            },
            tables: context.tableSchemas,
            tableSamples: context.tableSamples,
            prompt: payload.prompt,
            currentSql: payload.currentSql || "",
          }),
        },
        { role: "user", content: buildAiSqlUserPrompt(payload, context) },
      ],
      buildAiRuntimeOptions(aiConfig, { maxTokens: 1800 })
    );
    const rawText = completion?.content || "";
    const parsed = parseJsonObjectWithRecovery(rawText);
    const generatedSql = normalizeText(parsed?.generatedSql);
    const validation = createAiSqlValidationResult();

    if (!generatedSql) {
      validation.messages.push("AI 未返回可执行 SQL");
      const result = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
      const audit = await recordReportingAiRun({
        sceneCode: AI_SQL_PLAN_SCENE_CODE,
        sourceId: payload.sourceId,
        promptText: payload.prompt,
        provider: buildProviderSummary(provider),
        request: { selectedTables, currentSql: payload.currentSql || "", dialect },
        response: result,
        status: "warning",
        durationMs: Date.now() - startedAt,
        errorMessage: validation.messages.join("; "),
      });
      return { ...result, auditRunId: audit?.id || null };
    }

    const validationResult = await validateGeneratedReportSql(dataSource, generatedSql, dialect, tables);
    Object.assign(validation, validationResult.validation);
    if (validationResult.safeSql) {
      parsed.generatedSql = validationResult.safeSql;
    }

    let result = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
    if (!validation.valid) {
      const autoRevision = await attemptAutoReviseAiChartSql({
        sourceId: payload.sourceId,
        prompt: payload.prompt,
        selectedTables,
        currentSql: generatedSql,
        lastError: validation.messages.join("；"),
      }, {
        dataSource,
        resolved,
        dialect,
        tables,
        validationMessages: validation.messages,
      });
      if (autoRevision.success && autoRevision.revision?.result) {
        provider = autoRevision.revision.provider || provider;
        const revisedResult = autoRevision.revision.result;
        result = decorateAiSqlResultWithAutoCorrection(revisedResult, {
          attempted: true,
          applied: revisedResult.validation?.valid,
          reason: validation.messages.join("；"),
          originalSql: generatedSql,
          revisedSql: revisedResult.generatedSql,
          summary: revisedResult.validation?.valid ? "AI 已按当前数据源方言自动修复 SQL" : "AI 已尝试按当前数据源方言自动修复 SQL，但仍需人工确认",
          messages: [
            revisedResult.validation?.valid
              ? `已根据当前数据源 ${dialect} 方言自动修复首次生成 SQL`
              : `已根据当前数据源 ${dialect} 方言尝试自动修复首次生成 SQL，但校验仍未完全通过`,
            `首次生成问题: ${validation.messages.join("；")}`,
          ],
        });
      } else if (!autoRevision.success) {
        result = decorateAiSqlResultWithAutoCorrection(result, {
          attempted: true,
          applied: false,
          reason: validation.messages.join("；"),
          originalSql: generatedSql,
          revisedSql: result.generatedSql,
          summary: "AI 首次生成 SQL 校验未通过，自动修复失败",
          messages: [
            `已尝试根据当前数据源 ${dialect} 方言自动修复 SQL，但未成功`,
            autoRevision.error?.message || "自动修复调用失败",
          ],
        });
      }
    }
    const audit = await recordReportingAiRun({
      sceneCode: AI_SQL_PLAN_SCENE_CODE,
      sourceId: payload.sourceId,
      promptText: payload.prompt,
      generatedSql: result.generatedSql,
      finalSql: result.generatedSql,
      provider: buildProviderSummary(provider),
      request: { selectedTables, currentSql: payload.currentSql || "", dialect },
      response: result,
      status: result.validation.valid ? "success" : "warning",
      durationMs: Date.now() - startedAt,
      errorMessage: result.validation.valid ? null : result.validation.messages.join("; "),
    });
    return { ...result, auditRunId: audit?.id || null };
  } catch (error) {
    await recordReportingAiRun({
      sceneCode: AI_SQL_PLAN_SCENE_CODE,
      sourceId: payload.sourceId,
      promptText: payload.prompt,
      provider: buildProviderSummary(provider),
      request: {
        selectedTables,
        currentSql: payload.currentSql || "",
      },
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error.message || "生成 SQL 失败",
    });
    throw error;
  }
}

async function reviseAiChartSql(payload) {
  const startedAt = Date.now();
  let provider = null;
  const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
  try {
    const revision = await executeAiChartSqlRevisionRound(payload);
    const { dataSource, dialect, tables, currentSql } = revision;
    provider = revision.provider;

    if (!revision.result.generatedSql) {
      const audit = await recordReportingAiRun({
        sceneCode: AI_SQL_REVISION_SCENE_CODE,
        sourceId: payload.sourceId,
        promptText: payload.revisionInstruction || payload.prompt || "",
        finalSql: currentSql,
        provider: buildProviderSummary(provider),
        request: {
          selectedTables,
          prompt: payload.prompt || "",
          currentSql,
          revisionInstruction: payload.revisionInstruction || "",
          dialect,
        },
        response: revision.result,
        status: "warning",
        durationMs: Date.now() - startedAt,
        errorMessage: revision.validation.messages.join("; "),
      });
      return { ...revision.result, auditRunId: audit?.id || null };
    }

    let result = revision.result;
    if (!result.validation.valid) {
      const autoRevision = await attemptAutoReviseAiChartSql({
        sourceId: payload.sourceId,
        prompt: payload.prompt || "",
        selectedTables,
        currentSql: result.generatedSql,
        lastQueryProfile: payload.lastQueryProfile || null,
        lastError: result.validation.messages.join("；"),
      }, {
        dataSource,
        dialect,
        tables,
        validationMessages: result.validation.messages,
      });
      if (autoRevision.success && autoRevision.revision?.result) {
        provider = autoRevision.revision.provider || provider;
        const revisedResult = autoRevision.revision.result;
        result = decorateAiSqlResultWithAutoCorrection(revisedResult, {
          attempted: true,
          applied: revisedResult.validation?.valid,
          reason: revision.validation.messages.join("；"),
          originalSql: revision.result.generatedSql,
          revisedSql: revisedResult.generatedSql,
          summary: revisedResult.validation?.valid ? "AI 已自动修复修改后的 SQL" : "AI 已尝试自动修复修改后的 SQL，但仍需人工确认",
          messages: [
            revisedResult.validation?.valid
              ? `已根据当前数据源 ${dialect} 方言自动修复本次修改 SQL`
              : `已根据当前数据源 ${dialect} 方言尝试自动修复本次修改 SQL，但校验仍未完全通过`,
            `本次修改问题: ${revision.validation.messages.join("；")}`,
          ],
        });
      } else if (!autoRevision.success) {
        result = decorateAiSqlResultWithAutoCorrection(result, {
          attempted: true,
          applied: false,
          reason: revision.validation.messages.join("；"),
          originalSql: revision.result.generatedSql,
          revisedSql: result.generatedSql,
          summary: "AI 修改 SQL 后校验未通过，自动修复失败",
          messages: [
            `已尝试根据当前数据源 ${dialect} 方言自动修复修改后的 SQL，但未成功`,
            autoRevision.error?.message || "自动修复调用失败",
          ],
        });
      }
    }
    const audit = await recordReportingAiRun({
      sceneCode: AI_SQL_REVISION_SCENE_CODE,
      sourceId: payload.sourceId,
      promptText: payload.revisionInstruction || payload.prompt || "",
      generatedSql: result.generatedSql,
      finalSql: result.generatedSql,
      provider: buildProviderSummary(provider),
      request: {
        selectedTables,
        prompt: payload.prompt || "",
        currentSql,
        revisionInstruction: payload.revisionInstruction || "",
        lastQueryProfile: payload.lastQueryProfile || null,
        lastError: payload.lastError || "",
        dialect,
      },
      response: result,
      status: result.validation.valid ? "success" : "warning",
      durationMs: Date.now() - startedAt,
      errorMessage: result.validation.valid ? null : result.validation.messages.join("; "),
    });
    return { ...result, auditRunId: audit?.id || null };
  } catch (error) {
    await recordReportingAiRun({
      sceneCode: AI_SQL_REVISION_SCENE_CODE,
      sourceId: payload.sourceId,
      promptText: payload.revisionInstruction || payload.prompt || "",
      finalSql: sanitizeSqlText(payload.currentSql),
      provider: buildProviderSummary(provider),
      request: {
        selectedTables,
        prompt: payload.prompt || "",
        revisionInstruction: payload.revisionInstruction || "",
      },
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error.message || "修改 SQL 失败",
    });
    throw error;
  }
}

async function runAiChartQuery(payload) {
  const startedAt = Date.now();
  try {
    const dataSource = await ensureActiveReportDataSource(payload.sourceId);
    const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
    const dialect = resolved.dialect || dataSource.sourceType || "mysql";
    const requestedSql = sanitizeSqlText(payload.sourceSql);
    const limit = Math.max(1, Math.min(MAX_AI_QUERY_LIMIT, Number(payload.limit || MAX_AI_SAMPLE_ROWS) || MAX_AI_SAMPLE_ROWS));
    let sourceSql = requestedSql;
    let autoCorrection = null;
    let execution;
    try {
      sourceSql = ensureSafeReportAiSql(requestedSql, dialect);
      execution = await previewValidatedAiChartQuery(dataSource, sourceSql, limit);
    } catch (error) {
      const autoRevision = await attemptAutoReviseAiChartSql({
        sourceId: payload.sourceId,
        currentSql: requestedSql,
        selectedTables: extractSqlTables(requestedSql, dialect),
        lastError: error.message || "SQL 执行失败",
      }, {
        dataSource,
        resolved,
        dialect,
        validationMessages: [error.message || "SQL 执行失败"],
      });
      if (!autoRevision.success || !autoRevision.revision?.result?.validation?.valid || !autoRevision.revision.result.generatedSql) {
        throw error;
      }
      sourceSql = autoRevision.revision.result.generatedSql;
      execution = await previewValidatedAiChartQuery(dataSource, sourceSql, limit);
      autoCorrection = buildAiQueryAutoCorrection({
        attempted: true,
        applied: true,
        reason: error.message || "SQL 执行失败",
        originalSql: requestedSql,
        revisedSql: sourceSql,
        messages: [`执行前已按当前数据源 ${dialect} 方言自动修复 SQL`],
      }, execution.explainResult);
    }
    const explainResult = execution.explainResult;
    const preview = execution.preview;
    const profile = profileAiResult(preview.fields, preview.sampleRows, preview.rowCount);
    const fields = enrichPreviewFieldsWithProfile(preview.fields, profile);
    const result = {
      sourceId: Number(payload.sourceId),
      sourceSql,
      fields,
      sampleRows: preview.sampleRows,
      rowCount: preview.rowCount,
      profile,
      durationMs: Date.now() - startedAt,
      governance: {
        limit,
        timeoutMs: AI_QUERY_TIMEOUT_MS,
        explainValid: explainResult.explainValid,
        messages: autoCorrection?.messages || explainResult.messages,
      },
      autoCorrection,
    };
    const audit = await recordReportingAiRun({
      sceneCode: "chart_query",
      sourceId: payload.sourceId,
      finalSql: sourceSql,
      request: { limit, dialect },
      response: {
        rowCount: result.rowCount,
        fields: result.fields,
        profile: result.profile,
        governance: result.governance,
        autoCorrection: result.autoCorrection,
      },
      status: "success",
      durationMs: result.durationMs,
    });
    return { ...result, auditRunId: audit?.id || null };
  } catch (error) {
    await recordReportingAiRun({
      sceneCode: "chart_query",
      sourceId: payload.sourceId,
      finalSql: sanitizeSqlText(payload.sourceSql),
      request: { limit: payload.limit || MAX_AI_SAMPLE_ROWS },
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error.message || "执行查询失败",
    });
    throw error;
  }
}

async function recommendAiChart(payload) {
  const startedAt = Date.now();
  const fields = asArray(payload.fields);
  const sampleRows = asArray(payload.sampleRows).slice(0, MAX_AI_SAMPLE_ROWS);
  const profile = payload.profile && typeof payload.profile === "object"
    ? payload.profile
    : profileAiResult(fields, sampleRows, payload.rowCount || sampleRows.length);
  await ensureBuiltinChartAssets();
  const chartAssets = await repository.listReportChartAssets();
  let fallbackRecommendations = buildDeterministicRecommendations(profile, chartAssets, payload.prompt || "");
  let provider = null;
  let modelWarning = null;
  let rawText = "";
  let recommendations = fallbackRecommendations;

  try {
    const resolved = await resolveReportingAiProvider(AI_CHART_RECOMMENDATION_SCENE_CODE);
    provider = resolved.provider;
    const completion = await modelProviderService.generateChatCompletion(
      provider,
      [
        {
          role: "system",
          content: buildAiRecommendationSystemPrompt(resolved.aiConfig?.systemPrompt || "", {
            prompt: payload.prompt || "",
            profile,
            sampleRows,
            fallbackRecommendations,
          }),
        },
        { role: "user", content: buildAiRecommendationUserPrompt(payload, profile, fallbackRecommendations) },
      ],
      buildAiRuntimeOptions(resolved.aiConfig, { maxTokens: 1600 })
    );
    rawText = completion?.content || "";
    const parsed = parseJsonObjectWithRecovery(rawText);
    recommendations = normalizeAiRecommendations(parsed, fallbackRecommendations, chartAssets, profile);
  } catch (error) {
    modelWarning = error.message || "模型推荐失败，已使用规则推荐结果";
  }

  fallbackRecommendations = attachFieldMapValidation(fallbackRecommendations, chartAssets, profile);
  recommendations = attachFieldMapValidation(recommendations, chartAssets, profile);
  const result = {
    provider: buildProviderSummary(provider),
    profile,
    recommendations,
    fallbackRecommendations,
    warning: modelWarning,
    rawText,
  };
  const top = recommendations[0] || null;
  const audit = await recordReportingAiRun({
    sceneCode: AI_CHART_RECOMMENDATION_SCENE_CODE,
    sourceId: payload.sourceId || null,
    promptText: payload.prompt || "",
    finalSql: payload.sourceSql || null,
    provider: buildProviderSummary(provider),
    chartFamily: top?.chartFamily || null,
    chartAssetId: top?.chartAssetId || null,
    fieldMap: top?.fieldMap || {},
    request: {
      fields,
      rowCount: payload.rowCount || sampleRows.length,
      profile,
    },
    response: result,
    status: modelWarning ? "warning" : "success",
    durationMs: Date.now() - startedAt,
    errorMessage: modelWarning,
  });
  return { ...result, auditRunId: audit?.id || null };
}

async function allocateAiChartFieldMap(payload) {
  const fields = asArray(payload.fields);
  const sampleRows = asArray(payload.sampleRows).slice(0, MAX_AI_SAMPLE_ROWS);
  const profile = payload.profile && typeof payload.profile === "object"
    ? payload.profile
    : profileAiResult(fields, sampleRows, payload.rowCount || sampleRows.length);
  await ensureBuiltinChartAssets();
  const chartAssets = await repository.listReportChartAssets();
  const asset = chartAssets.find((item) => Number(item.id) === Number(payload.chartAssetId));
  if (!asset) {
    throw new AppError("未找到目标图表资产", 404);
  }
  const fallbackRecommendation = buildRecommendationEntry(
    chartAssets,
    payload.chartFamily || normalizeChartAssetFamily(asset),
    asset.chartName || "图表",
    "默认字段映射",
    0.5,
    payload.currentFieldMap || {},
    "chart"
  );
  const fallbackFieldMap = validateRecommendationFieldMap(
    {
      widgetType: "chart",
      chartAssetId: asset.id,
      fieldMap: payload.currentFieldMap || {},
    },
    chartAssets,
    { ...profile, fields }
  ).valid
    ? (payload.currentFieldMap || {})
    : (fallbackRecommendation.fieldMap || {});
  let provider = null;
  let rawText = "";
  let reason = "";
  let warning = null;
  let fieldMap = fallbackFieldMap;
  try {
    const resolved = await resolveReportingAiProvider(AI_CHART_FIELD_MAP_SCENE_CODE);
    provider = resolved.provider;
    const completion = await modelProviderService.generateChatCompletion(
      provider,
      [
        {
          role: "system",
          content: buildAiFieldMapSystemPrompt(resolved.aiConfig?.systemPrompt || "", {
            prompt: payload.prompt || "",
            profile,
            sampleRows,
            chartAsset: asset,
            currentFieldMap: fallbackFieldMap,
          }),
        },
        { role: "user", content: buildAiFieldMapUserPrompt(payload, profile, asset, fallbackFieldMap) },
      ],
      buildAiRuntimeOptions(resolved.aiConfig, { maxTokens: 1200 })
    );
    rawText = completion?.content || "";
    const parsed = parseJsonObjectWithRecovery(rawText);
    if (parsed?.fieldMap && typeof parsed.fieldMap === "object") {
      fieldMap = {
        ...fallbackFieldMap,
        ...parsed.fieldMap,
      };
    }
    reason = normalizeText(parsed?.reason, "");
  } catch (error) {
    warning = error.message || "模型字段分配失败，已使用默认映射";
  }
  const validation = validateRecommendationFieldMap(
    {
      widgetType: "chart",
      chartAssetId: asset.id,
      fieldMap,
    },
    chartAssets,
    { ...profile, fields }
  );
  if (!validation.valid) {
    fieldMap = fallbackFieldMap;
  }
  return {
    provider: buildProviderSummary(provider),
    chartAssetId: asset.id,
    chartFamily: normalizeChartAssetFamily(asset),
    fieldMap,
    reason,
    validation: validateRecommendationFieldMap(
      {
        widgetType: "chart",
        chartAssetId: asset.id,
        fieldMap,
      },
      chartAssets,
      { ...profile, fields }
    ),
    warning,
    rawText,
  };
}

async function createReportDataset(payload) {
  await ensureActiveReportDataSource(payload.sourceId);
  if (payload.folderId != null) {
    await ensureReportDatasetFolder(payload.folderId);
  }
  const preview = await previewReportDataset({ ...payload, limit: 20 });
  const normalizedFields = Array.isArray(payload.fields) && payload.fields.length > 0 ? payload.fields : preview.fields;
  const normalized = assignInternalDatasetCode(normalizeDatasetPayload(payload, normalizedFields));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await repository.createReportDataset(attempt === 0 ? normalized : assignInternalDatasetCode(normalized));
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY" && attempt < 2) {
        continue;
      }
      if (error.code === "ER_DUP_ENTRY") {
        throw new AppError("数据集内部编码生成冲突，请重试", 409);
      }
      throw error;
    }
  }
  throw new AppError("数据集内部编码生成失败", 500);
}

async function updateReportDataset(id, payload) {
  const existing = await ensureReportDataset(id);
  await ensureActiveReportDataSource(payload.sourceId);
  if (payload.folderId != null) {
    await ensureReportDatasetFolder(payload.folderId);
  }
  const submittedFields = Array.isArray(payload.fields) ? payload.fields : [];
  const normalizedFields = submittedFields.length > 0
    ? submittedFields
    : (await previewReportDataset({ ...payload, limit: 20 })).fields;
  const normalizedBase = normalizeDatasetPayload(payload, normalizedFields, existing);
  const normalized = normalizeText(normalizedBase.datasetCode)
    ? normalizedBase
    : assignInternalDatasetCode(normalizedBase);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await repository.updateReportDataset(
        Number(id),
        attempt === 0 ? normalized : assignInternalDatasetCode(normalized)
      );
      if (!row) {
        throw new AppError("数据集不存在", 404);
      }
      return row;
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY" && attempt < 2) {
        continue;
      }
      if (error.code === "ER_DUP_ENTRY") {
        throw new AppError("数据集内部编码异常，请重试", 409);
      }
      throw error;
    }
  }
  throw new AppError("数据集内部编码生成失败", 500);
}

async function deleteReportDataset(id) {
  await ensureReportDataset(id);
  const deleted = await repository.deleteReportDataset(Number(id));
  return { id: Number(id), deleted };
}

async function listReportChartAssets() {
  await ensureBuiltinChartAssets();
  return repository.listReportChartAssets();
}

async function listReportThemeTemplates() {
  await ensureBuiltinThemeTemplates();
  const rows = await repository.listReportThemeTemplates();
  return rows.map(hydrateThemeTemplateRecord);
}

async function createReportThemeTemplate(payload) {
  const normalized = normalizeThemeTemplatePayload(payload);
  try {
    return hydrateThemeTemplateRecord(await repository.createReportThemeTemplate(normalized));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("主题模板编码已存在", 409);
    }
    throw error;
  }
}

async function updateReportThemeTemplate(id, payload) {
  const existing = await ensureReportThemeTemplate(id);
  if (existing.isBuiltin) {
    throw new AppError("内置模板不支持直接编辑，请先复制为自定义模板", 403);
  }
  const normalized = normalizeThemeTemplatePayload(payload, existing);
  try {
    const row = await repository.updateReportThemeTemplate(Number(id), normalized);
    if (!row) {
      throw new AppError("主题模板不存在", 404);
    }
    return hydrateThemeTemplateRecord(row);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("主题模板编码已存在", 409);
    }
    throw error;
  }
}

async function deleteReportThemeTemplate(id) {
  const existing = await ensureReportThemeTemplate(id);
  if (existing.isBuiltin) {
    throw new AppError("内置模板不支持删除", 403);
  }
  const deleted = await repository.deleteReportThemeTemplate(Number(id));
  return { id: Number(id), deleted };
}

async function createReportChartAsset(payload) {
  const normalized = normalizeChartAssetPayload(payload);
  try {
    return await repository.createReportChartAsset(normalized);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("图表编码已存在", 409);
    }
    throw error;
  }
}

async function updateReportChartAsset(id, payload) {
  const existing = await ensureReportChartAsset(id);
  const normalized = normalizeChartAssetPayload(payload, existing);
  try {
    const row = await repository.updateReportChartAsset(Number(id), normalized);
    if (!row) {
      throw new AppError("图表资产不存在", 404);
    }
    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("图表编码已存在", 409);
    }
    throw error;
  }
}

async function deleteReportChartAsset(id) {
  await ensureReportChartAsset(id);
  const deleted = await repository.deleteReportChartAsset(Number(id));
  return { id: Number(id), deleted };
}

async function listReportDashboards() {
  return repository.listReportDashboards();
}

async function getReportDashboard(id) {
  const row = await repository.getReportDashboardById(Number(id));
  if (!row) {
    throw new AppError("仪表板不存在", 404);
  }
  return row;
}

async function getReportDashboardRuntime(id, options = {}) {
  const row = await repository.getReportDashboardById(Number(id));
  if (!row) {
    throw new AppError("仪表板不存在", 404);
  }
  const publishConfig = row.canvasConfig?.publishConfig || {};
  const accessMode = String(publishConfig.accessMode || "").trim().toLowerCase();
  const shareToken = String(publishConfig.shareToken || "").trim();
  const allowedUsernames = resolvePublishAllowedUsernames(publishConfig);
  const requestToken = String(options.shareToken || "").trim();
  const currentUser = options.user?.username ? String(options.user.username).trim() : "";

  if (accessMode === "public") {
    if (!shareToken || requestToken !== shareToken) {
      throw new AppError("分享链接无效或已失效", 403);
    }
    return row;
  }

  if (accessMode === "login_user") {
    if (!currentUser) {
      throw new AppError("请先登录后查看该报表", 401);
    }
    if (allowedUsernames.length && !allowedUsernames.includes(currentUser)) {
      throw new AppError("当前账号无权查看该报表", 403);
    }
    return row;
  }

  if (!currentUser) {
    throw new AppError("请先登录后查看该报表", 401);
  }
  return row;
}

async function ensureReportDashboardRuntimeAccess(id, options = {}) {
  return getReportDashboardRuntime(id, options);
}

async function createReportDashboard(payload) {
  const normalized = assignInternalDashboardCode(normalizeDashboardPayload(payload));
  const duplicateByName = await repository.getReportDashboardByName(normalized.dashboardName);
  if (duplicateByName) {
    throw new AppError("仪表板名称已存在", 409, { fieldErrors: { dashboardName: ["仪表板名称已存在"] } });
  }
  if (normalized.themeTemplateId) {
    await ensureReportThemeTemplate(normalized.themeTemplateId);
  }
  for (const widget of normalized.widgets) {
    if (widget.datasetId) {
      await ensureReportDataset(widget.datasetId);
    }
    if (widget.chartAssetId) {
      await ensureReportChartAsset(widget.chartAssetId);
    }
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await repository.createReportDashboard(attempt === 0 ? normalized : assignInternalDashboardCode(normalized));
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY" && attempt < 2) {
        continue;
      }
      if (error.code === "ER_DUP_ENTRY") {
        throw new AppError("报表内部编码生成冲突，请重试", 409);
      }
      throw error;
    }
  }
  throw new AppError("报表内部编码生成失败", 500);
}

async function updateReportDashboard(id, payload) {
  const existing = await ensureReportDashboard(id);
  const normalized = normalizeDashboardPayload(payload, existing);
  const duplicateByName = await repository.getReportDashboardByName(normalized.dashboardName);
  if (duplicateByName && Number(duplicateByName.id) !== Number(id)) {
    throw new AppError("仪表板名称已存在", 409, { fieldErrors: { dashboardName: ["仪表板名称已存在"] } });
  }
  if (normalized.themeTemplateId) {
    await ensureReportThemeTemplate(normalized.themeTemplateId);
  }
  for (const widget of normalized.widgets) {
    if (widget.datasetId) {
      await ensureReportDataset(widget.datasetId);
    }
    if (widget.chartAssetId) {
      await ensureReportChartAsset(widget.chartAssetId);
    }
  }
  try {
    const row = await repository.updateReportDashboard(Number(id), normalized);
    if (!row) {
      throw new AppError("仪表板不存在", 404);
    }
    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("仪表板编码已存在", 409);
    }
    throw error;
  }
}

async function publishReportDashboard(id, payload = {}) {
  const existing = await ensureReportDashboard(Number(id));
  const accessMode = payload.accessMode === "public" ? "public" : payload.accessMode === "login_user" ? "login_user" : "";
  const shareToken = accessMode
    ? (normalizeText(payload.shareToken) || existing.canvasConfig?.publishConfig?.shareToken || buildShareToken())
    : null;
  const allowedUsernames = accessMode === "login_user"
    ? uniqueStrings(payload.allowedUsernames)
    : [];
  const normalized = normalizeDashboardPayload({
    ...existing,
    widgets: existing.widgets || [],
    canvasConfig: {
      ...(existing.canvasConfig || {}),
      publishConfig: {
        accessMode,
        allowAnonymous: accessMode === "public",
        allowedUsername: accessMode === "login_user" ? (allowedUsernames[0] || null) : null,
        allowedUsernames: accessMode === "login_user" ? allowedUsernames : [],
        shareToken,
      },
    },
  }, existing);
  const row = await repository.updateReportDashboard(Number(id), normalized);
  if (!row) {
    throw new AppError("仪表板不存在", 404);
  }
  return row;
}

async function deleteReportDashboard(id) {
  await ensureReportDashboard(id);
  const deleted = await repository.deleteReportDashboard(Number(id));
  return { id: Number(id), deleted };
}

async function previewDashboardChart(payload) {
  const widgetType = String(payload.widgetType || "chart").trim().toLowerCase();
  const chartAsset = payload.chartAssetId ? await ensureReportChartAsset(payload.chartAssetId) : null;
  let dataset = null;
  let dataSource = null;
  let datasetType = null;
  let sourceTable = null;
  let sourceSql = null;
  let preview;
  let fieldCandidates = [];

  if (payload.datasetId) {
    dataset = await ensureReportDataset(payload.datasetId);
    dataSource = await ensureActiveReportDataSource(dataset.sourceId);
    datasetType = dataset.datasetType;
    sourceTable = dataset.sourceTable;
    sourceSql = dataset.sourceSql;
    const structurePreviewLimit = widgetType === "table" ? (payload.limit || 20) : undefined;
    preview = await previewDatasetStructure(
      dataSource,
      datasetType,
      sourceTable,
      sourceSql,
      structurePreviewLimit
    );
    fieldCandidates = mergePreviewFieldMetadata(dataset.fields, preview.fields);
  } else if (payload.sourceId) {
    dataSource = await ensureActiveReportDataSource(payload.sourceId);
    datasetType = payload.datasetType || (payload.sourceSql ? "sql" : "table");
    sourceTable = payload.sourceTable;
    sourceSql = payload.sourceSql;
    const structurePreviewLimit = widgetType === "table" ? (payload.limit || 20) : undefined;
    preview = await previewDatasetStructure(
      dataSource,
      datasetType,
      sourceTable,
      sourceSql,
      structurePreviewLimit
    );
    fieldCandidates = preview.fields;
  } else {
    throw new AppError("预览图表时必须选择数据集，或直接指定数据源和查询配置", 400);
  }

  const fieldMap = applyDefaultFieldMapBySchema({ ...(payload.fieldMap || {}) }, chartAsset, fieldCandidates);
  for (const item of fieldCandidates) {
    if (!fieldMap.xField && ["dimension", "category", "time"].includes(item.role || "")) fieldMap.xField = item.columnName;
    if (!fieldMap.yField && ["metric", "value"].includes(item.role || "")) fieldMap.yField = item.columnName;
    if (!fieldMap.yField2 && ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.yField) fieldMap.yField2 = item.columnName;
    if (!fieldMap.nameField && ["dimension", "category"].includes(item.role || "")) fieldMap.nameField = item.columnName;
    if (!fieldMap.valueField && ["metric", "value"].includes(item.role || "")) fieldMap.valueField = item.columnName;
    if (!fieldMap.valueField2 && ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.valueField) fieldMap.valueField2 = item.columnName;
  }
  if (!fieldMap.xField && fieldCandidates[0]) fieldMap.xField = fieldCandidates[0].columnName;
  if (!fieldMap.yField && fieldCandidates[1]) fieldMap.yField = fieldCandidates[1].columnName;
  if (!fieldMap.yField2) {
    const secondaryMetric = fieldCandidates.find((item) => ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.yField);
    if (secondaryMetric) fieldMap.yField2 = secondaryMetric.columnName;
  }
  if (!fieldMap.nameField && fieldCandidates[0]) fieldMap.nameField = fieldCandidates[0].columnName;
  if (!fieldMap.mapField) {
    const geoField = fieldCandidates.find((item) => isGeoMappingField(item));
    if (geoField?.columnName) {
      fieldMap.mapField = geoField.columnName;
    }
  }
  if (!fieldMap.mapField && fieldMap.nameField) fieldMap.mapField = fieldMap.nameField;
  if (!fieldMap.mapField && fieldCandidates[0]) fieldMap.mapField = fieldCandidates[0].columnName;
  if (!fieldMap.valueField && fieldCandidates[1]) fieldMap.valueField = fieldCandidates[1].columnName;
  if (!fieldMap.valueField2) {
    const secondaryValueMetric = fieldCandidates.find((item) => ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.valueField);
    if (secondaryValueMetric) fieldMap.valueField2 = secondaryValueMetric.columnName;
  }

  const chrome = buildChromeConfig(payload.chrome || {}, payload);
  const chartStyle = buildChartStyleConfig(payload.chartStyle || {}, payload, payload.chrome || {});
  const mapStyle = buildMapStyleConfig(payload.mapStyle || {}, payload, payload.chrome || {});
  const chartAnalysis = buildChartAnalysisConfig(payload.chartAnalysis || {}, payload.chrome || {});
  const kpiStyle = buildKpiStyleConfig(payload.kpiStyle || {}, payload.chrome || {}, payload);
  const kpiAnalysis = buildKpiAnalysisConfig(payload.kpiAnalysis || {}, payload);
  const tableStyle = buildTableStyleConfig(payload.tableStyle || {}, payload);
  const tabsStyle = buildTabsStyleConfig(payload.tabsStyle || {});
  const visualizationRows = widgetType === "table"
    ? preview.sampleRows
    : await loadReportDatasetRows(dataSource, datasetType, sourceTable, sourceSql);
  if (widgetType === "kpi") {
    return {
      ...buildKpiPreview(visualizationRows, fieldMap, chrome, kpiStyle, kpiAnalysis, payload),
      dataset,
      fields: preview.fields,
    };
  }

  if (widgetType === "table") {
    return {
      ...buildTablePreview(preview.sampleRows, preview.fields, fieldMap, chrome, tableStyle, payload),
      dataset,
    };
  }

  if (widgetType === "tabs") {
    const tabs = Array.isArray(payload.tabs) ? payload.tabs : [];
    const items = tabs.map((item, index) => {
      const tabType = String(item.widgetType || "chart").trim().toLowerCase();
      if (tabType === "kpi") {
        const itemKpiStyle = buildKpiStyleConfig(item.kpiStyle || {}, item.chrome || chrome, item);
        const itemKpiAnalysis = buildKpiAnalysisConfig(item.kpiAnalysis || {}, item);
        return {
          key: normalizeText(item.key, `tab_${index + 1}`),
          title: normalizeText(item.title, `指标页签 ${index + 1}`),
          widgetType: "kpi",
          kpi: buildKpiPreview(visualizationRows, fieldMap, chrome, itemKpiStyle, itemKpiAnalysis, item).kpi,
          chrome: buildChromeConfig(item.chrome || chrome, item),
          kpiStyle: itemKpiStyle,
          kpiAnalysis: itemKpiAnalysis,
        };
      }
      if (tabType === "table") {
        const itemTableStyle = buildTableStyleConfig(item.tableStyle || {}, item);
        return {
          key: normalizeText(item.key, `tab_${index + 1}`),
          title: normalizeText(item.title, `明细页签 ${index + 1}`),
          widgetType: "table",
          table: buildTablePreview(preview.sampleRows, preview.fields, fieldMap, chrome, itemTableStyle, item).table,
          chrome: buildChromeConfig(item.chrome || chrome, item),
          tableStyle: itemTableStyle,
        };
      }
      const tabChartAsset = chartAsset || null;
      const itemChartStyle = buildChartStyleConfig(item.chartStyle || {}, item, item.chrome || chrome);
      const itemMapStyle = buildMapStyleConfig(item.mapStyle || {}, item, item.chrome || chrome);
      const itemChartAnalysis = buildChartAnalysisConfig(item.chartAnalysis || {}, item.chrome || chrome);
      return {
        key: normalizeText(item.key, `tab_${index + 1}`),
        title: normalizeText(item.title, `图表页签 ${index + 1}`),
        widgetType: "chart",
        option: tabChartAsset ? applyChartStyle(buildChartOption(tabChartAsset, visualizationRows, fieldMap, {
          chartFamily: item.chartFamily || payload.chartFamily,
          variantName: item.variantName || payload.variantName,
          accentColor: itemChartStyle.accentColor || payload.accentColor,
          palettePreset: itemChartStyle.palettePreset || payload.palettePreset,
          palette: itemChartStyle.palette,
          barSeriesLayout: itemChartStyle.barSeriesLayout,
          barPrimaryColor: itemChartStyle.barPrimaryColor,
          barSecondaryColor: itemChartStyle.barSecondaryColor,
          barGap: itemChartStyle.barGap,
          barCategoryGap: itemChartStyle.barCategoryGap,
          barValuePosition: itemChartStyle.barValuePosition,
          horizontalBarPalette: itemChartStyle.horizontalBarPalette,
          horizontalBarColorCount: itemChartStyle.horizontalBarColorCount,
          horizontalBarSortOrder: itemChartStyle.horizontalBarSortOrder,
          legendPrimaryName: itemChartStyle.legendPrimaryName,
          legendSecondaryName: itemChartStyle.legendSecondaryName,
          radarLayout: itemChartStyle.radarLayout,
          radarPrimaryColor: itemChartStyle.radarPrimaryColor,
          radarSecondaryColor: itemChartStyle.radarSecondaryColor,
          radarPointColor: itemChartStyle.radarPointColor,
          radarAreaOpacity: itemChartStyle.radarAreaOpacity,
          mapRegionPalette: itemChartStyle.mapRegionPalette,
          mapRegionBorderColor: itemChartStyle.mapRegionBorderColor,
          mapLabelColor: itemChartStyle.mapLabelColor,
          mapVisualMapTextColor: itemChartStyle.mapVisualMapTextColor,
          provinceCode: itemMapStyle.provinceCode,
          showLabels: itemChartStyle.showLabels,
          showDataLabels: itemChartStyle.showDataLabels,
        }), buildChromeConfig(item.chrome || chrome, item), itemChartStyle, itemMapStyle, itemChartAnalysis) : {},
        chrome: buildChromeConfig(item.chrome || chrome, item),
        chartStyle: itemChartStyle,
        mapStyle: itemMapStyle,
        chartAnalysis: itemChartAnalysis,
      };
    });
    return {
      widgetType: "tabs",
      dataset,
      chartAsset,
      fields: preview.fields,
      sampleRows: visualizationRows,
      fieldMap,
      chrome,
      tabsStyle,
      tabs: {
        defaultActiveKey: items[0]?.key || null,
        items,
      },
    };
  }

  return {
    widgetType: "chart",
    dataset,
    chartAsset,
    fields: preview.fields,
    sampleRows: visualizationRows,
    chartStyle,
    mapStyle,
    chartAnalysis,
    option: applyChartStyle(buildChartOption(chartAsset, visualizationRows, fieldMap, {
      chartFamily: payload.chartFamily,
      variantName: payload.variantName,
      accentColor: chartStyle.accentColor || payload.accentColor,
      palettePreset: chartStyle.palettePreset || payload.palettePreset,
      palette: chartStyle.palette,
      barSeriesLayout: chartStyle.barSeriesLayout,
      barPrimaryColor: chartStyle.barPrimaryColor,
      barSecondaryColor: chartStyle.barSecondaryColor,
      barGap: chartStyle.barGap,
      barCategoryGap: chartStyle.barCategoryGap,
      barValuePosition: chartStyle.barValuePosition,
      horizontalBarPalette: chartStyle.horizontalBarPalette,
      horizontalBarColorCount: chartStyle.horizontalBarColorCount,
      horizontalBarSortOrder: chartStyle.horizontalBarSortOrder,
      legendPrimaryName: chartStyle.legendPrimaryName,
      legendSecondaryName: chartStyle.legendSecondaryName,
      radarLayout: chartStyle.radarLayout,
      radarPrimaryColor: chartStyle.radarPrimaryColor,
      radarSecondaryColor: chartStyle.radarSecondaryColor,
      radarPointColor: chartStyle.radarPointColor,
      radarAreaOpacity: chartStyle.radarAreaOpacity,
      mapRegionPalette: chartStyle.mapRegionPalette,
      mapRegionBorderColor: chartStyle.mapRegionBorderColor,
      mapLabelColor: chartStyle.mapLabelColor,
      mapVisualMapTextColor: chartStyle.mapVisualMapTextColor,
      provinceCode: mapStyle.provinceCode,
      showLabels: chartStyle.showLabels,
      showDataLabels: chartStyle.showDataLabels,
    }), chrome, chartStyle, mapStyle, chartAnalysis),
    fieldMap,
    chrome,
  };
}

async function previewRuntimeDashboardChart(id, payload, options = {}) {
  await ensureReportDashboardRuntimeAccess(Number(id), options);
  return previewDashboardChart(payload);
}

module.exports = {
  createReportChartAsset,
  createReportDashboard,
  createReportDataSource,
  createReportDataset,
  createReportDatasetFolder,
  createReportThemeTemplate,
  deleteReportChartAsset,
  deleteReportDashboard,
  deleteReportDataSource,
  deleteReportDataset,
  deleteReportDatasetFolder,
  deleteReportThemeTemplate,
  ensureReportDashboardRuntimeAccess,
  getOverview,
  getReportDashboard,
  getReportDashboardRuntime,
  listReportChartAssets,
  listReportDashboards,
  listReportDataSourceColumns,
  listReportDataSourceTables,
  listReportDataSources,
  listReportDatasets,
  listReportDatasetFolders,
  listReportThemeTemplates,
  allocateAiChartFieldMap,
  planAiChartSql,
  previewDashboardChart,
  previewRuntimeDashboardChart,
  previewReportDataset,
  publishReportDashboard,
  recommendAiChart,
  reviseAiChartSql,
  runAiChartQuery,
  sampleReportDataSourceRows,
  suggestAiChartAnalysis,
  testReportDataSourceConnection,
  updateReportChartAsset,
  updateReportDashboard,
  updateReportDataSource,
  updateReportDataset,
  updateReportDatasetFolder,
  updateReportThemeTemplate,
};
