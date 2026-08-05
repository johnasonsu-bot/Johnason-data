const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");

const REPORT_TEMPLATE_VERSION = "formal-v5";
const TRANSPARENT_PNG_BUFFER = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

const DIMENSION_DEFINITIONS = [
  { key: "completeness", name: "完整性", color: "#1677ff", description: "关键字段和业务记录是否完整，是否存在缺失、空值或批次不完整。" },
  { key: "consistency", name: "一致性", color: "#13a8a8", description: "字段关系、关联记录存在性、跨表属性以及源目标业务口径是否保持一致。" },
  { key: "compliance", name: "合规性", color: "#722ed1", description: "数据格式、值域、标准字典、类型和隐私要求是否符合约束。" },
  { key: "timeliness", name: "时效性", color: "#fa8c16", description: "数据产生、更新和到达时间是否满足约定周期与服务时限。" },
  { key: "uniqueness", name: "唯一性", color: "#eb2f96", description: "主键、业务键或字段组合是否存在非预期重复。" },
  { key: "stability", name: "稳定性", color: "#d48806", description: "数据量、空值率和统计分布是否出现异常波动。" },
];

const CATEGORY_LABELS = {
  non_null: "非空检查",
  conditional_required: "条件必填检查",
  batch_completeness: "批次完整性检查",
  duplicate: "重复检查",
  composite_unique: "联合唯一检查",
  compliance: "格式合规检查",
  conditional_regex: "条件格式检查",
  value_range: "值域检查",
  field_compare: "字段一致性检查",
  cross_table_consistency: "跨表一致性检查",
  cross_table_lookup: "跨表存在性检查",
  freshness: "数据时效检查",
  volume_anomaly: "数据量波动检查",
  null_rate_change: "空值率波动检查",
};

const SEVERITY_LABELS = { critical: "紧急", high: "高", medium: "中", low: "低" };
const SEVERITY_WEIGHTS = { critical: 4, high: 3, medium: 2, low: 1 };

function number(value) {
  return Number(value || 0);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

function formatNumber(value) {
  return number(value).toLocaleString("zh-CN");
}

function formatPercent(value, digits = 2) {
  return `${round(number(value), digits).toFixed(digits)}%`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeMarkdown(value) {
  return String(value ?? "-").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function categoryLabel(value) {
  return CATEGORY_LABELS[String(value || "")] || "其他质量检查";
}

function severityLabel(value) {
  return SEVERITY_LABELS[String(value || "medium")] || "中";
}

function dimensionKeyForRule(rule = {}) {
  const category = String(rule.ruleCategory || rule.rule_category || "").toLowerCase();
  if (["non_null", "conditional_required", "batch_completeness"].includes(category)) return "completeness";
  if (["duplicate", "composite_unique"].includes(category)) return "uniqueness";
  if (["compliance", "conditional_regex", "value_range"].includes(category)) return "compliance";
  if (["field_compare", "cross_table_lookup", "cross_table_consistency"].includes(category)) return "consistency";
  if (category === "freshness") return "timeliness";
  if (["volume_anomaly", "null_rate_change"].includes(category)) return "stability";
  return "compliance";
}

function buildDimensionSummary(rules = []) {
  const normalizedRules = Array.isArray(rules) ? rules : [];
  const dimensions = DIMENSION_DEFINITIONS.map((definition) => {
    const dimensionRules = normalizedRules.filter((rule) => dimensionKeyForRule(rule) === definition.key);
    const weighted = dimensionRules.reduce((result, rule) => {
      const weight = SEVERITY_WEIGHTS[String(rule.severity || "medium")] || 2;
      const issueRate = Math.max(0, Math.min(number(rule.issueRate) * 100, 100));
      result.score += Math.max(0, 100 - issueRate) * weight;
      result.weight += weight;
      return result;
    }, { score: 0, weight: 0 });
    return {
      ...definition,
      covered: dimensionRules.length > 0,
      ruleCount: dimensionRules.length,
      failedRuleCount: dimensionRules.filter((rule) => number(rule.issueRows) > 0).length,
      checkedRows: dimensionRules.reduce((sum, rule) => sum + number(rule.totalRows), 0),
      issueRows: dimensionRules.reduce((sum, rule) => sum + number(rule.issueRows), 0),
      score: weighted.weight ? round(weighted.score / weighted.weight) : null,
      topRules: [...dimensionRules].sort((left, right) => number(right.issueRows) - number(left.issueRows)).slice(0, 5).map((rule) => ({
        ruleCategory: rule.ruleCategory,
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName || categoryLabel(rule.ruleCategory),
        fieldName: rule.fieldName || "表级",
        severity: rule.severity || "medium",
        totalRows: number(rule.totalRows),
        issueRows: number(rule.issueRows),
        issueRate: round(number(rule.issueRate) * 100, 4),
      })),
    };
  });
  const covered = dimensions.filter((item) => item.covered);
  return {
    dimensions,
    coveredDimensionCount: covered.length,
    totalDimensionCount: dimensions.length,
    coverageRate: round((covered.length / dimensions.length) * 100, 1),
    score: covered.length ? round(covered.reduce((sum, item) => sum + number(item.score), 0) / covered.length) : null,
    ruleCount: normalizedRules.length,
    failedRuleCount: normalizedRules.filter((rule) => number(rule.issueRows) > 0).length,
    checkedRows: normalizedRules.reduce((sum, rule) => sum + number(rule.totalRows), 0),
    issueRows: normalizedRules.reduce((sum, rule) => sum + number(rule.issueRows), 0),
  };
}

function hasLegacyReferentialDimension(summary) {
  if (!summary || typeof summary !== "object") return false;
  if (Array.isArray(summary.dimensions) && summary.dimensions.some((item) => item?.key === "referential")) return true;
  return hasLegacyReferentialDimension(summary.current) || hasLegacyReferentialDimension(summary.previous);
}

function mergeLegacyDimensionRows(dimensions = []) {
  const rows = Array.isArray(dimensions) ? dimensions : [];
  return DIMENSION_DEFINITIONS.map((definition) => {
    const sources = rows.filter((item) => item?.key === definition.key || (definition.key === "consistency" && item?.key === "referential"));
    const coveredSources = sources.filter((item) => item?.covered);
    const scoreWeights = coveredSources.reduce((result, item) => {
      const weight = Math.max(1, number(item.ruleCount));
      if (item.score !== null && item.score !== undefined) {
        result.score += number(item.score) * weight;
        result.weight += weight;
      }
      return result;
    }, { score: 0, weight: 0 });
    return {
      ...definition,
      covered: coveredSources.length > 0,
      ruleCount: sources.reduce((sum, item) => sum + number(item.ruleCount), 0),
      failedRuleCount: sources.reduce((sum, item) => sum + number(item.failedRuleCount), 0),
      checkedRows: sources.reduce((sum, item) => sum + number(item.checkedRows), 0),
      issueRows: sources.reduce((sum, item) => sum + number(item.issueRows), 0),
      score: scoreWeights.weight ? round(scoreWeights.score / scoreWeights.weight) : null,
      topRules: sources.flatMap((item) => Array.isArray(item.topRules) ? item.topRules : [])
        .sort((left, right) => number(right.issueRows) - number(left.issueRows))
        .slice(0, 5),
    };
  });
}

function normalizeDimensionSummary(summary) {
  if (!summary || typeof summary !== "object") return summary;
  if (summary.current || summary.previous) {
    const current = normalizeDimensionSummary(summary.current || {});
    const previous = normalizeDimensionSummary(summary.previous || {});
    return {
      ...summary,
      current,
      previous,
      dimensions: DIMENSION_DEFINITIONS.map((definition) => {
        const currentItem = current?.dimensions?.find((item) => item.key === definition.key);
        const previousItem = previous?.dimensions?.find((item) => item.key === definition.key);
        return {
          ...definition,
          currentScore: currentItem?.score ?? null,
          previousScore: previousItem?.score ?? null,
          scoreChange: currentItem?.score === null || currentItem?.score === undefined || previousItem?.score === null || previousItem?.score === undefined
            ? null
            : round(currentItem.score - previousItem.score),
          currentIssueRows: number(currentItem?.issueRows),
          previousIssueRows: number(previousItem?.issueRows),
          issueRowsChange: number(currentItem?.issueRows) - number(previousItem?.issueRows),
          covered: Boolean(currentItem?.covered || previousItem?.covered),
        };
      }),
    };
  }
  const dimensions = mergeLegacyDimensionRows(summary.dimensions);
  const covered = dimensions.filter((item) => item.covered);
  return {
    ...summary,
    dimensions,
    coveredDimensionCount: covered.length,
    totalDimensionCount: dimensions.length,
    coverageRate: round((covered.length / dimensions.length) * 100, 1),
    score: covered.length ? round(covered.reduce((sum, item) => sum + number(item.score), 0) / covered.length) : null,
  };
}

function buildComparisonDimensionSummary(currentRules = [], previousRules = []) {
  const current = buildDimensionSummary(currentRules);
  const previous = buildDimensionSummary(previousRules);
  return {
    current,
    previous,
    dimensions: DIMENSION_DEFINITIONS.map((definition) => {
      const currentItem = current.dimensions.find((item) => item.key === definition.key);
      const previousItem = previous.dimensions.find((item) => item.key === definition.key);
      return {
        ...definition,
        currentScore: currentItem?.score ?? null,
        previousScore: previousItem?.score ?? null,
        scoreChange: currentItem?.score === null || previousItem?.score === null ? null : round(currentItem.score - previousItem.score),
        currentIssueRows: number(currentItem?.issueRows),
        previousIssueRows: number(previousItem?.issueRows),
        issueRowsChange: number(currentItem?.issueRows) - number(previousItem?.issueRows),
        covered: Boolean(currentItem?.covered || previousItem?.covered),
      };
    }),
  };
}

function buildSnapshotDimensionComparison(currentSummary = {}, previousSummary = {}) {
  const current = normalizeDimensionSummary(currentSummary || { dimensions: [] });
  const previous = normalizeDimensionSummary(previousSummary || { dimensions: [] });
  return {
    current,
    previous,
    dimensions: DIMENSION_DEFINITIONS.map((definition) => {
      const currentItem = current?.dimensions?.find((item) => item.key === definition.key);
      const previousItem = previous?.dimensions?.find((item) => item.key === definition.key);
      const currentScore = currentItem?.score ?? null;
      const previousScore = previousItem?.score ?? null;
      return {
        ...definition,
        currentScore,
        previousScore,
        scoreChange: currentScore === null || previousScore === null ? null : round(currentScore - previousScore),
        currentIssueRows: number(currentItem?.issueRows),
        previousIssueRows: number(previousItem?.issueRows),
        issueRowsChange: number(currentItem?.issueRows) - number(previousItem?.issueRows),
        currentRuleCount: number(currentItem?.ruleCount),
        previousRuleCount: number(previousItem?.ruleCount),
        ruleCountChange: number(currentItem?.ruleCount) - number(previousItem?.ruleCount),
        covered: Boolean(currentItem?.covered || previousItem?.covered),
      };
    }),
  };
}

function scoreLevel(score) {
  if (score === null || score === undefined) return { label: "待评估", color: "#8c8c8c" };
  if (number(score) >= 90) return { label: "优秀", color: "#2f9e44" };
  if (number(score) >= 80) return { label: "良好", color: "#1677ff" };
  if (number(score) >= 70) return { label: "关注", color: "#fa8c16" };
  return { label: "高风险", color: "#cf1322" };
}

function comparisonTypeLabel(summary = {}) {
  return ({ batch: "表运行批次差异", table_report: "表级报告差异", system_report: "系统级报告差异" })[String(summary.comparisonType || "batch")] || "差异分析";
}

function reportScopeLabel(summary = {}) {
  if (summary.scope === "system") return summary.targetSystem ? "系统级报告" : "项目质量总览";
  if (summary.scope === "comparison") return comparisonTypeLabel(summary);
  return "表级报告";
}

function comparisonSnapshotLabel(snapshot = {}, fallback = "-") {
  return snapshot.reportTitle || snapshot.batchId || snapshot.label || fallback;
}

function polarPoint(centerX, centerY, radius, angle) {
  return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius];
}

function buildRadarSvg(dimensionSummary) {
  const dimensions = dimensionSummary?.dimensions || [];
  if (!dimensions.length) return "";
  const width = 760;
  const height = 390;
  const cx = 250;
  const cy = 198;
  const radius = 142;
  const count = dimensions.length;
  const levels = [20, 40, 60, 80, 100];
  const polygons = levels.map((level) => {
    const points = dimensions.map((_item, index) => polarPoint(cx, cy, radius * level / 100, -Math.PI / 2 + index * Math.PI * 2 / count).join(",")).join(" ");
    return `<polygon points="${points}" fill="none" stroke="#dbe6f3" stroke-width="1"/>`;
  }).join("");
  const axes = dimensions.map((item, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    const edge = polarPoint(cx, cy, radius, angle);
    const label = polarPoint(cx, cy, radius + 26, angle);
    const anchor = Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
    return `<line x1="${cx}" y1="${cy}" x2="${edge[0]}" y2="${edge[1]}" stroke="#dbe6f3"/><text x="${label[0]}" y="${label[1]}" text-anchor="${anchor}" dominant-baseline="middle" font-size="13" fill="#4b6178">${escapeXml(item.name)}</text>`;
  }).join("");
  const scorePoints = dimensions.map((item, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    return polarPoint(cx, cy, radius * Math.max(0, Math.min(number(item.score), 100)) / 100, angle).join(",");
  }).join(" ");
  const legend = dimensions.map((item, index) => `<g transform="translate(500 ${58 + index * 36})"><circle cx="0" cy="0" r="5" fill="${item.covered ? item.color : "#cbd5e1"}"/><text x="14" y="1" dominant-baseline="middle" font-size="13" fill="#4b6178">${escapeXml(item.name)}</text><text x="188" y="1" text-anchor="end" dominant-baseline="middle" font-size="14" font-weight="700" fill="${item.covered ? "#173b67" : "#94a3b8"}">${item.covered ? `${item.score} 分` : "未覆盖"}</text></g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="16" fill="#fbfdff"/><text x="28" y="34" font-size="16" font-weight="700" fill="#183153">质量维度雷达图</text>${polygons}${axes}<polygon points="${scorePoints}" fill="#1677ff" fill-opacity="0.18" stroke="#1677ff" stroke-width="2.5"/>${legend}</svg>`;
}

function buildComparisonRadarSvg(dimensionSummary) {
  const dimensions = dimensionSummary?.dimensions || [];
  if (!dimensions.length) return "";
  const width = 760;
  const height = 410;
  const cx = 310;
  const cy = 188;
  const radius = 138;
  const count = dimensions.length;
  const levels = [20, 40, 60, 80, 100];
  const polygons = levels.map((level) => {
    const points = dimensions.map((_item, index) => polarPoint(cx, cy, radius * level / 100, -Math.PI / 2 + index * Math.PI * 2 / count).join(",")).join(" ");
    return `<polygon points="${points}" fill="none" stroke="#dbe6f3" stroke-width="1"/>`;
  }).join("");
  const axes = dimensions.map((item, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    const edge = polarPoint(cx, cy, radius, angle);
    const label = polarPoint(cx, cy, radius + 24, angle);
    const anchor = Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
    return `<line x1="${cx}" y1="${cy}" x2="${edge[0]}" y2="${edge[1]}" stroke="#dbe6f3"/><text x="${label[0]}" y="${label[1]}" text-anchor="${anchor}" dominant-baseline="middle" font-size="13" fill="#4b6178">${escapeXml(item.name)}</text>`;
  }).join("");
  const pointsFor = (key) => dimensions.map((item, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    const score = item[key] === null || item[key] === undefined ? 0 : Math.max(0, Math.min(number(item[key]), 100));
    return polarPoint(cx, cy, radius * score / 100, angle).join(",");
  }).join(" ");
  const legend = `<g transform="translate(245 374)"><rect x="0" y="-8" width="28" height="4" rx="2" fill="#94a3b8"/><text x="38" y="-3" font-size="13" fill="#4b6178">基准快照</text><rect x="150" y="-8" width="28" height="4" rx="2" fill="#1677ff"/><text x="188" y="-3" font-size="13" fill="#4b6178">当前快照</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="16" fill="#fbfdff"/><text x="28" y="34" font-size="16" font-weight="700" fill="#183153">质量维度双快照雷达图</text>${polygons}${axes}<polygon points="${pointsFor("previousScore")}" fill="#94a3b8" fill-opacity="0.08" stroke="#94a3b8" stroke-width="2"/><polygon points="${pointsFor("currentScore")}" fill="#1677ff" fill-opacity="0.18" stroke="#1677ff" stroke-width="2.5"/>${legend}</svg>`;
}

function buildDimensionBarsSvg(dimensionSummary) {
  const dimensions = dimensionSummary?.dimensions || [];
  const width = 760;
  const rowHeight = 38;
  const height = 78 + dimensions.length * rowHeight;
  const bars = dimensions.map((item, index) => {
    const y = 63 + index * rowHeight;
    const score = item.score === null ? 0 : Math.max(0, Math.min(number(item.score), 100));
    return `<text x="26" y="${y + 11}" font-size="13" fill="#4b6178">${escapeXml(item.name)}</text><rect x="120" y="${y}" width="500" height="16" rx="8" fill="#edf3f9"/><rect x="120" y="${y}" width="${5 * score}" height="16" rx="8" fill="${item.covered ? item.color : "#cbd5e1"}"/><text x="642" y="${y + 12}" font-size="13" font-weight="700" fill="${item.covered ? "#173b67" : "#94a3b8"}">${item.covered ? `${item.score} 分` : "未覆盖"}</text><text x="716" y="${y + 12}" text-anchor="end" font-size="12" fill="#8191a5">${item.ruleCount} 条规则</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="16" fill="#fbfdff"/><text x="26" y="34" font-size="16" font-weight="700" fill="#183153">各质量维度得分</text>${bars}</svg>`;
}

function buildTrendSvg(trend = []) {
  const rows = Array.isArray(trend) ? trend.slice(-12) : [];
  if (rows.length < 2) return "";
  const width = 760;
  const height = 320;
  const left = 58;
  const top = 58;
  const chartWidth = 650;
  const chartHeight = 190;
  const points = rows.map((item, index) => {
    const x = left + (rows.length === 1 ? 0 : index * chartWidth / (rows.length - 1));
    const y = top + chartHeight - Math.max(0, Math.min(number(item.score), 100)) * chartHeight / 100;
    return { x, y, item };
  });
  const grid = [0, 25, 50, 75, 100].map((score) => {
    const y = top + chartHeight - score * chartHeight / 100;
    return `<line x1="${left}" y1="${y}" x2="${left + chartWidth}" y2="${y}" stroke="#e5edf6"/><text x="${left - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="#8191a5">${score}</text>`;
  }).join("");
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labels = points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#1677ff"/><text x="${point.x}" y="${point.y - 10}" text-anchor="middle" font-size="11" font-weight="700" fill="#173b67">${round(point.item.score, 1)}</text>${index % Math.ceil(rows.length / 6) === 0 || index === rows.length - 1 ? `<text x="${point.x}" y="${top + chartHeight + 24}" text-anchor="middle" font-size="10" fill="#8191a5">${escapeXml(String(point.item.label || point.item.day || point.item.batchId || index + 1).slice(0, 12))}</text>` : ""}`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="16" fill="#fbfdff"/><text x="26" y="34" font-size="16" font-weight="700" fill="#183153">质量得分变化趋势</text>${grid}<polyline points="${line}" fill="none" stroke="#1677ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${labels}</svg>`;
}

function buildRankingSvg(rows = []) {
  const items = [...(Array.isArray(rows) ? rows : [])].sort((left, right) => number(left.score) - number(right.score)).slice(0, 8);
  if (!items.length) return "";
  const width = 760;
  const height = 74 + items.length * 42;
  const content = items.map((item, index) => {
    const y = 58 + index * 42;
    const score = Math.max(0, Math.min(number(item.score), 100));
    const level = scoreLevel(score);
    return `<text x="26" y="${y + 14}" font-size="12" fill="#4b6178">${escapeXml(String(item.tableName || item.systemName || "-").slice(0, 22))}</text><rect x="210" y="${y}" width="430" height="18" rx="9" fill="#edf3f9"/><rect x="210" y="${y}" width="${4.3 * score}" height="18" rx="9" fill="${level.color}"/><text x="700" y="${y + 14}" text-anchor="end" font-size="13" font-weight="700" fill="#173b67">${round(score, 1)} 分</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="16" fill="#fbfdff"/><text x="26" y="34" font-size="16" font-weight="700" fill="#183153">质量风险对象排名</text>${content}</svg>`;
}

function buildDifferenceSvg(comparisonSummary) {
  const dimensions = comparisonSummary?.dimensions?.filter((item) => item.covered) || [];
  if (!dimensions.length) return "";
  const width = 760;
  const height = 86 + dimensions.length * 44;
  const center = 400;
  const content = dimensions.map((item, index) => {
    const y = 62 + index * 44;
    const delta = item.scoreChange === null ? 0 : Math.max(-30, Math.min(number(item.scoreChange), 30));
    const barWidth = Math.abs(delta) * 7;
    const x = delta >= 0 ? center : center - barWidth;
    const color = delta >= 0 ? "#2f9e44" : "#cf1322";
    return `<text x="26" y="${y + 14}" font-size="13" fill="#4b6178">${escapeXml(item.name)}</text><line x1="${center}" y1="${y - 4}" x2="${center}" y2="${y + 24}" stroke="#9fb0c3"/><rect x="${x}" y="${y}" width="${barWidth}" height="18" rx="7" fill="${color}"/><text x="700" y="${y + 14}" text-anchor="end" font-size="13" font-weight="700" fill="${color}">${item.scoreChange === null ? "口径变化" : `${delta >= 0 ? "+" : ""}${item.scoreChange} 分`}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="16" fill="#fbfdff"/><text x="26" y="34" font-size="16" font-weight="700" fill="#183153">质量维度变化</text><text x="${center - 16}" y="34" text-anchor="end" font-size="11" fill="#8191a5">下降</text><text x="${center + 16}" y="34" font-size="11" fill="#8191a5">提升</text>${content}</svg>`;
}

function buildReportCharts(summary = {}) {
  const charts = [];
  const isComparison = summary.scope === "comparison";
  const dimensionSummary = isComparison ? summary.dimensionSummary?.current : summary.dimensionSummary;
  if (dimensionSummary?.dimensions?.length) {
    charts.push({ key: "dimension-radar", title: isComparison ? "质量维度双快照雷达图" : "质量维度雷达图", svg: isComparison ? buildComparisonRadarSvg(summary.dimensionSummary) : buildRadarSvg(dimensionSummary) });
    charts.push({ key: "dimension-bars", title: "各质量维度得分", svg: buildDimensionBarsSvg(dimensionSummary) });
  }
  const trendSvg = buildTrendSvg(summary.trend || []);
  if (trendSvg) charts.push({ key: "score-trend", title: "质量得分变化趋势", svg: trendSvg });
  if (summary.scope === "system") {
    const rankingSvg = buildRankingSvg(summary.tables || summary.systems || []);
    if (rankingSvg) charts.push({ key: "risk-ranking", title: "质量风险对象排名", svg: rankingSvg });
  }
  if (isComparison) {
    const differenceSvg = buildDifferenceSvg(summary.dimensionSummary);
    if (differenceSvg) charts.push({ key: "dimension-difference", title: "质量维度变化", svg: differenceSvg });
  }
  return charts.filter((item) => item.svg);
}

function getPrimaryMetrics(summary = {}) {
  if (summary.scope === "system") {
    return [
      ["综合得分", summary.score === null ? "待评估" : `${summary.score} 分`],
      ["维度覆盖率", formatPercent(summary.dimensionSummary?.coverageRate || 0, 1)],
      ["覆盖数据表", `${number(summary.coverage?.coveredTableCount)}/${number(summary.coverage?.expectedTableCount)} 张`],
      ["问题行数", `${formatNumber(summary.issueRows)} 行`],
      ["高风险表", `${number(summary.highRiskTableCount)} 张`],
      ["待整改问题", `${number(summary.issueTracking?.openIssueCount)} 个`],
    ];
  }
  if (summary.scope === "comparison") {
    return [
      [summary.comparisonType === "batch" ? "当前批次得分" : "当前报告得分", summary.current?.score === null || summary.current?.score === undefined ? "待评估" : `${summary.current?.score} 分`],
      ["得分变化", `${number(summary.change?.score) >= 0 ? "+" : ""}${number(summary.change?.score)} 分`],
      ["问题行变化", `${number(summary.change?.issueRows) >= 0 ? "+" : ""}${formatNumber(summary.change?.issueRows)} 行`],
      ["新增问题", `${number(summary.ruleChanges?.newCount)} 项`],
      ["已消除问题", `${number(summary.ruleChanges?.resolvedCount)} 项`],
      ["持续问题", `${number(summary.ruleChanges?.persistentCount)} 项`],
    ];
  }
  return [
    ["质量得分", summary.batch?.score === null ? "待评估" : `${summary.batch?.score} 分`],
    ["维度覆盖率", formatPercent(summary.dimensionSummary?.coverageRate || 0, 1)],
    ["检查规则", `${number(summary.batch?.totalRuleCount)} 条`],
    ["失败规则", `${number(summary.batch?.failedRuleCount)} 条`],
    ["问题行数", `${formatNumber(summary.batch?.issueRows)} 行`],
    ["待整改问题", `${number(summary.issueTracking?.openIssueCount)} 个`],
  ];
}

function getScopeDescription(summary = {}) {
  if (summary.scope === "system") {
    const target = summary.targetSystem?.systemName || "当前项目全部系统";
    const timeRange = summary.batchTimeRange?.spanHours > 0 ? `，采用批次时间跨度 ${summary.batchTimeRange.spanHours} 小时` : "";
    return `${target}，采用各纳管表最近一次成功批次形成质量快照，共覆盖 ${number(summary.coverage?.coveredTableCount)} 张表${timeRange}。`;
  }
  if (summary.scope === "comparison") {
    const objectName = summary.object?.objectName || summary.table?.tableName || summary.system?.systemName || "-";
    const objectParent = summary.object?.systemName || summary.table?.systemName || "";
    return `${objectParent ? `${objectParent} / ` : ""}${objectName}，比较“${comparisonSnapshotLabel(summary.previous)}”与“${comparisonSnapshotLabel(summary.current)}”；可比性：${summary.comparability?.levelLabel || summary.comparability?.message || "待检查"}。`;
  }
  return `${summary.table?.systemName || "未归属系统"} / ${summary.table?.tableName || "-"}，运行批次 ${summary.batch?.batchId || "-"}。`;
}

function getExecutiveConclusion(summary = {}) {
  const score = summary.scope === "comparison" ? summary.current?.score : summary.scope === "system" ? summary.score : summary.batch?.score;
  const level = scoreLevel(score);
  if (summary.scope === "comparison") {
    const delta = number(summary.change?.score);
    const direction = delta > 0 ? "有所提升" : delta < 0 ? "出现下降" : "总体持平";
    const subject = summary.comparisonType === "batch" ? "当前批次" : "当前报告快照";
    const baseline = summary.comparisonType === "batch" ? "基准批次" : "基准报告快照";
    return `${subject}质量得分为 ${score ?? "待评估"} 分，较${baseline}${direction}（${delta >= 0 ? "+" : ""}${delta} 分）。新增问题 ${number(summary.ruleChanges?.newCount)} 项，已消除问题 ${number(summary.ruleChanges?.resolvedCount)} 项。`;
  }
  const issueRows = summary.scope === "system" ? summary.issueRows : summary.batch?.issueRows;
  const coverage = summary.dimensionSummary?.coverageRate || 0;
  return `本次质量评价为“${level.label}”，综合得分 ${score ?? "待评估"} 分，质量维度覆盖率 ${coverage}%，共发现 ${formatNumber(issueRows)} 行问题数据。未覆盖维度不参与评分，并在报告中单独披露。`;
}

function htmlTable(headers, rows, emptyText = "暂无可展示数据") {
  if (!rows?.length) return `<div class="quality-report-empty">${escapeHtml(emptyText)}</div>`;
  return `<div class="quality-report-table-wrap"><table class="quality-report-table"><thead><tr>${headers.map((item) => `<th>${escapeHtml(item.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((item) => `<td>${escapeHtml(item.render ? item.render(row) : row[item.key] ?? "-")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function dimensionHtml(summary) {
  const dimensions = reportDimensionRows(summary);
  return `<div class="quality-report-dimension-grid">${dimensions.map((item) => `<section class="quality-report-dimension-card ${item.covered ? "" : "is-uncovered"}"><div class="quality-report-dimension-card__head"><span class="quality-report-dimension-dot" style="background:${item.color}"></span><strong>${escapeHtml(item.name)}</strong><b>${item.covered ? `${item.score} 分` : "未覆盖"}</b></div><p>${escapeHtml(item.description)}</p><div class="quality-report-dimension-card__stats"><span>规则 ${number(item.ruleCount)}</span><span>失败 ${number(item.failedRuleCount)}</span><span>问题 ${formatNumber(item.issueRows)}</span></div></section>`).join("")}</div>`;
}

function reportDimensionRows(summary = {}) {
  return summary.scope === "comparison"
    ? summary.dimensionSummary?.current?.dimensions || []
    : summary.dimensionSummary?.dimensions || [];
}

function topRules(summary) {
  if (summary.scope === "comparison") return (summary.rules || []).map((rule) => ({ ...rule, issueRows: number(rule.currentIssueRows), issueRate: number(rule.currentIssueRate) }));
  if (summary.scope === "system") return summary.topRules || [];
  return summary.rules || [];
}

function buildReportHtml(report) {
  const summary = report.summary || {};
  const charts = report.charts || buildReportCharts(summary);
  const metrics = getPrimaryMetrics(summary);
  const dimensionRows = reportDimensionRows(summary);
  const rules = [...topRules(summary)].sort((left, right) => number(right.issueRows) - number(left.issueRows)).slice(0, 20);
  const ai = report.aiSummary || null;
  const scopeLabel = reportScopeLabel(summary);
  const level = scoreLevel(summary.scope === "comparison" ? summary.current?.score : summary.scope === "system" ? summary.score : summary.batch?.score);
  const chartsHtml = charts.length ? `<div class="quality-report-chart-grid">${charts.map((chart) => `<figure class="quality-report-chart"><div>${chart.svg}</div><figcaption>${escapeHtml(chart.title)}</figcaption></figure>`).join("")}</div>` : `<div class="quality-report-empty">当前统计范围暂无可生成图表的数据</div>`;
  const scopeDetail = summary.scope === "system"
    ? htmlTable([
      { label: "数据表", key: "tableName" }, { label: "所属系统", key: "systemName" }, { label: "采用批次", key: "batchId" },
      { label: "问题行", key: "issueRows" }, { label: "质量得分", render: (row) => row.score === null ? "待评估" : `${row.score} 分` },
    ], summary.tables || [])
    : summary.scope === "comparison"
      ? summary.comparisonType === "system_report"
        ? htmlTable([
          { label: "数据表", key: "tableName" }, { label: "基准得分", render: (row) => row.previousScore === null || row.previousScore === undefined ? "未纳入" : `${row.previousScore} 分` },
          { label: "当前得分", render: (row) => row.currentScore === null || row.currentScore === undefined ? "未纳入" : `${row.currentScore} 分` },
          { label: "得分变化", render: (row) => row.scoreChange === null || row.scoreChange === undefined ? "集合变化" : `${number(row.scoreChange) >= 0 ? "+" : ""}${row.scoreChange} 分` },
          { label: "覆盖变化", key: "statusLabel" },
        ], summary.objectChanges?.tableChanges || [])
        : htmlTable([
          { label: "规则", render: (row) => row.ruleName || row.ruleCode }, { label: "字段", render: (row) => row.fieldName || "表级" },
          { label: "基准快照", key: "previousIssueRows" }, { label: "当前快照", key: "currentIssueRows" },
          { label: "变化", render: (row) => `${number(row.currentIssueRows) - number(row.previousIssueRows) >= 0 ? "+" : ""}${number(row.currentIssueRows) - number(row.previousIssueRows)}` },
        ], summary.rules || [])
      : htmlTable([
        { label: "规则", render: (row) => row.ruleName || row.ruleCode }, { label: "质量维度", render: (row) => DIMENSION_DEFINITIONS.find((item) => item.key === dimensionKeyForRule(row))?.name || "合规性" },
        { label: "字段", render: (row) => row.fieldName || "表级" }, { label: "检查行数", key: "totalRows" }, { label: "问题行", key: "issueRows" },
        { label: "问题率", render: (row) => formatPercent(number(row.issueRate) * 100) }, { label: "级别", render: (row) => severityLabel(row.severity) },
      ], summary.rules || []);
  const sampleTable = htmlTable([
    { label: "规则", key: "ruleCode" }, { label: "主键快照", key: "maskedPkText" }, { label: "字段值", key: "maskedValueText" }, { label: "问题说明", key: "issueMessage" },
  ], summary.samples || [], "当前报告未采集问题样例，或所有样例已按安全策略过滤");
  const coverageChangeHtml = summary.comparisonType === "system_report" ? `<h3>系统覆盖变化</h3>${htmlTable([
    { label: "指标", key: "label" }, { label: "基准快照", key: "previous" }, { label: "当前快照", key: "current" }, { label: "变化", key: "change" },
  ], [
    { label: "纳管表", previous: number(summary.coverageChanges?.previousExpectedTableCount), current: number(summary.coverageChanges?.currentExpectedTableCount), change: number(summary.coverageChanges?.expectedTableCountChange) },
    { label: "覆盖表", previous: number(summary.coverageChanges?.previousCoveredTableCount), current: number(summary.coverageChanges?.currentCoveredTableCount), change: number(summary.coverageChanges?.coveredTableCountChange) },
    { label: "未覆盖表", previous: number(summary.coverageChanges?.previousMissingTableCount), current: number(summary.coverageChanges?.currentMissingTableCount), change: number(summary.coverageChanges?.missingTableCountChange) },
    { label: "高风险表", previous: number(summary.objectChanges?.previousHighRiskTableCount), current: number(summary.objectChanges?.currentHighRiskTableCount), change: number(summary.objectChanges?.highRiskTableCountChange) },
  ])}` : "";
  const comparisonSection = summary.scope === "comparison" ? `<h2 id="batch-change">7. ${escapeHtml(comparisonTypeLabel(summary))}</h2><div class="quality-report-callout ${number(summary.change?.score) >= 0 ? "is-success" : "is-risk"}"><strong>变化结论</strong><p>${escapeHtml(getExecutiveConclusion(summary))}</p></div>${htmlTable([
    { label: "质量维度", key: "name" }, { label: "基准得分", render: (row) => row.previousScore === null ? "未覆盖" : `${row.previousScore} 分` },
    { label: "当前得分", render: (row) => row.currentScore === null ? "未覆盖" : `${row.currentScore} 分` }, { label: "得分变化", render: (row) => row.scoreChange === null ? "口径变化" : `${number(row.scoreChange) >= 0 ? "+" : ""}${row.scoreChange} 分` },
    { label: "问题行变化", render: (row) => `${number(row.issueRowsChange) >= 0 ? "+" : ""}${row.issueRowsChange}` },
  ], summary.dimensionSummary?.dimensions || [])}${coverageChangeHtml}<h3>可比性与口径变化</h3><p class="quality-report-note">${escapeHtml(summary.comparability?.message || "差异分析已基于当前可用质量快照生成。")}</p>${summary.comparability?.reasons?.length ? `<ul>${summary.comparability.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}` : "";
  const aiHtml = `<h2 id="ai-analysis">${summary.scope === "comparison" ? "8" : "7"}. AI辅助分析与整改建议</h2>${ai?.summary ? `<section class="quality-report-ai"><div class="quality-report-ai__title">质量分析助手</div><p>${escapeHtml(ai.summary)}</p>${ai.evidence?.length ? `<h3>事实依据</h3><ul>${ai.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}${ai.possibleCauses?.length ? `<h3>可能原因</h3><ul>${ai.possibleCauses.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}${ai.suggestions?.length ? `<h3>整改建议</h3><ol>${ai.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : ""}${ai.limitations?.length ? `<div class="quality-report-note">分析限制：${escapeHtml(ai.limitations.join("；"))}</div>` : ""}</section>` : `<div class="quality-report-callout"><strong>确定性报告已生成</strong><p>当前未生成模型分析，统计指标、图表、问题明细和整改跟踪不受影响。</p></div>`}`;
  return `<article class="quality-report-document"><header class="quality-report-cover"><span class="quality-report-kicker">DATA QUALITY ASSESSMENT REPORT</span><h1>${escapeHtml(report.title)}</h1><div class="quality-report-cover__tags"><span>${escapeHtml(scopeLabel)}</span><span style="border-color:${level.color};color:${level.color}">${escapeHtml(level.label)}</span></div><div class="quality-report-cover__meta"><span>报告编号：QC-${String(report.id || "-").padStart(6, "0")}</span><span>模板版本：${REPORT_TEMPLATE_VERSION}</span><span>生成时间：${escapeHtml(formatDateTime(report.createdAt))}</span></div></header><section class="quality-report-body"><h2 id="document-info">1. 文档信息与统计口径</h2>${htmlTable([{ label: "项目", key: "label" }, { label: "内容", key: "value" }], [
    { label: "报告类型", value: scopeLabel }, { label: "评价范围", value: getScopeDescription(summary) }, { label: "生成者", value: report.createdBy || "system" },
    { label: "数据快照时间", value: formatDateTime(summary.snapshotAt || report.createdAt) }, { label: "治理快照时间", value: formatDateTime(summary.governanceSnapshotAt || report.createdAt) },
    { label: "评分口径", value: "规则得分按问题率和严重程度加权；未覆盖维度不默认计为100分。" }, { label: "数据安全", value: "问题样例使用脱敏快照，模型仅接收汇总统计和有限脱敏样例。" },
  ])}<h2 id="executive-summary">2. 执行摘要</h2><div class="quality-report-callout ${level.label === "高风险" ? "is-risk" : "is-success"}"><strong>${escapeHtml(level.label)} · ${escapeHtml(scopeLabel)}</strong><p>${escapeHtml(getExecutiveConclusion(summary))}</p></div><div class="quality-report-metrics">${metrics.map(([label, value]) => `<div class="quality-report-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div><h2 id="scope">3. 质量范围与覆盖情况</h2><p>${escapeHtml(getScopeDescription(summary))}</p><p class="quality-report-note">覆盖率用于描述已配置质量规则维度的完整程度，不与质量得分混为同一指标。</p><h2 id="overall">4. 总体质量评价</h2>${chartsHtml}<h2 id="dimensions">5. 质量维度分析</h2>${dimensionHtml(summary)}${htmlTable([
    { label: "质量维度", key: "name" }, { label: "覆盖状态", render: (row) => row.covered ? "已覆盖" : "未覆盖" }, { label: "规则数", key: "ruleCount" },
    { label: "失败规则", key: "failedRuleCount" }, { label: "问题行次", key: "issueRows" }, { label: "得分", render: (row) => row.covered ? `${row.score} 分` : "-" },
  ], dimensionRows)}<h2 id="key-issues">6. 重点问题与证据</h2>${htmlTable([
    { label: "规则", render: (row) => row.ruleName || categoryLabel(row.ruleCategory) }, { label: "字段", render: (row) => row.fieldName || "表级" },
    { label: "问题行", render: (row) => row.issueRows ?? row.currentIssueRows ?? 0 }, { label: "问题率", render: (row) => formatPercent(number(row.issueRate ?? row.currentIssueRate) * 100) },
    { label: "严重程度", render: (row) => severityLabel(row.severity) },
  ], rules)}<h3>脱敏问题样例</h3>${sampleTable}<h3>${summary.scope === "system" ? "系统内数据表明细" : summary.scope === "comparison" ? summary.comparisonType === "system_report" ? "系统内数据表变化明细" : "规则变化明细" : "规则执行明细"}</h3>${scopeDetail}${comparisonSection}${aiHtml}<h2 id="risk-limit">${summary.scope === "comparison" ? "9" : "8"}. 风险、限制与附录</h2><ul><li>报告统计基于生成时固化的质量事实快照，不随后续批次自动变化。</li><li>问题行数与问题命中次数可能存在差异，同一数据行可能命中多条规则。</li><li>未配置规则、规则停用或执行失败的质量维度显示为未覆盖。</li><li>规则集合、评分公式或系统覆盖对象发生变化时，得分变化只能条件解释。</li><li>AI内容用于解释和辅助整改，不替代确定性指标、业务确认和治理责任认定。</li></ul><footer>本报告由 MeData 数据质量监控模块生成 · 模板 ${REPORT_TEMPLATE_VERSION}</footer></section></article>`;
}

function markdownTable(headers, rows) {
  if (!rows?.length) return "_暂无可展示数据_\n";
  return [`| ${headers.map((item) => item.label).join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${headers.map((item) => escapeMarkdown(item.render ? item.render(row) : row[item.key] ?? "-")).join(" | ")} |`)].join("\n");
}

function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function buildReportMarkdown(report) {
  const summary = report.summary || {};
  const charts = report.charts || buildReportCharts(summary);
  const metrics = getPrimaryMetrics(summary);
  const dimensionRows = reportDimensionRows(summary);
  const rules = [...topRules(summary)].sort((left, right) => number(right.issueRows ?? right.currentIssueRows) - number(left.issueRows ?? left.currentIssueRows)).slice(0, 30);
  const scopeLabel = reportScopeLabel(summary);
  const lines = [
    `# ${report.title}`,
    "",
    `> 报告编号：QC-${String(report.id || "-").padStart(6, "0")}  `,
    `> 报告类型：${scopeLabel}  `,
    `> 生成时间：${formatDateTime(report.createdAt)}  `,
    `> 模板版本：${REPORT_TEMPLATE_VERSION}`,
    "",
    "## 1. 文档信息与统计口径",
    "",
    `- 评价范围：${getScopeDescription(summary)}`,
    `- 生成者：${report.createdBy || "system"}`,
    `- 数据快照时间：${formatDateTime(summary.snapshotAt || report.createdAt)}`,
    `- 治理快照时间：${formatDateTime(summary.governanceSnapshotAt || report.createdAt)}`,
    "- 评分口径：规则得分按问题率和严重程度加权；未覆盖维度不默认计为100分。",
    "- 数据安全：问题样例使用脱敏快照，模型仅接收汇总统计和有限脱敏样例。",
    "",
    "## 2. 执行摘要",
    "",
    getExecutiveConclusion(summary),
    "",
    markdownTable([{ label: "指标", key: "label" }, { label: "统计值", key: "value" }], metrics.map(([label, value]) => ({ label, value }))),
    "",
    "## 3. 质量范围与覆盖情况",
    "",
    getScopeDescription(summary),
    "",
    "> 覆盖率用于描述已配置质量规则维度的完整程度，不与质量得分混为同一指标。",
    "",
    "## 4. 总体质量评价",
    "",
  ];
  charts.forEach((chart) => {
    lines.push(`### ${chart.title}`, "", `![${chart.title}](${svgDataUri(chart.svg)})`, "");
  });
  lines.push("## 5. 质量维度分析", "", markdownTable([
    { label: "质量维度", key: "name" }, { label: "覆盖状态", render: (row) => row.covered ? "已覆盖" : "未覆盖" }, { label: "规则数", key: "ruleCount" },
    { label: "失败规则", key: "failedRuleCount" }, { label: "问题行次", key: "issueRows" }, { label: "得分", render: (row) => row.covered ? `${row.score} 分` : "-" },
  ], dimensionRows), "", "## 6. 重点问题与证据", "", markdownTable([
    { label: "规则", render: (row) => row.ruleName || categoryLabel(row.ruleCategory) }, { label: "字段", render: (row) => row.fieldName || "表级" },
    { label: "问题行", render: (row) => row.issueRows ?? row.currentIssueRows ?? 0 }, { label: "问题率", render: (row) => formatPercent(number(row.issueRate ?? row.currentIssueRate) * 100) },
    { label: "严重程度", render: (row) => severityLabel(row.severity) },
  ], rules), "", "### 脱敏问题样例", "", markdownTable([
    { label: "规则", key: "ruleCode" }, { label: "主键快照", key: "maskedPkText" }, { label: "字段值", key: "maskedValueText" }, { label: "问题说明", key: "issueMessage" },
  ], summary.samples || []), "");
  if (summary.scope === "comparison") {
    lines.push(`## 7. ${comparisonTypeLabel(summary)}`, "", markdownTable([
      { label: "质量维度", key: "name" }, { label: "基准得分", render: (row) => row.previousScore === null ? "未覆盖" : `${row.previousScore} 分` },
      { label: "当前得分", render: (row) => row.currentScore === null ? "未覆盖" : `${row.currentScore} 分` }, { label: "得分变化", render: (row) => row.scoreChange === null ? "口径变化" : `${number(row.scoreChange) >= 0 ? "+" : ""}${row.scoreChange} 分` },
      { label: "问题行变化", render: (row) => `${number(row.issueRowsChange) >= 0 ? "+" : ""}${row.issueRowsChange}` },
    ], summary.dimensionSummary?.dimensions || []), "");
    if (summary.comparisonType === "system_report") {
      lines.push("### 系统覆盖变化", "", markdownTable([
        { label: "指标", key: "label" }, { label: "基准快照", key: "previous" }, { label: "当前快照", key: "current" }, { label: "变化", key: "change" },
      ], [
        { label: "纳管表", previous: number(summary.coverageChanges?.previousExpectedTableCount), current: number(summary.coverageChanges?.currentExpectedTableCount), change: number(summary.coverageChanges?.expectedTableCountChange) },
        { label: "覆盖表", previous: number(summary.coverageChanges?.previousCoveredTableCount), current: number(summary.coverageChanges?.currentCoveredTableCount), change: number(summary.coverageChanges?.coveredTableCountChange) },
        { label: "未覆盖表", previous: number(summary.coverageChanges?.previousMissingTableCount), current: number(summary.coverageChanges?.currentMissingTableCount), change: number(summary.coverageChanges?.missingTableCountChange) },
        { label: "高风险表", previous: number(summary.objectChanges?.previousHighRiskTableCount), current: number(summary.objectChanges?.currentHighRiskTableCount), change: number(summary.objectChanges?.highRiskTableCountChange) },
      ]), "");
    }
    lines.push(`- 可比性说明：${summary.comparability?.message || "差异分析已基于当前可用质量快照生成。"}`, ...(summary.comparability?.reasons || []).map((item) => `- ${item}`), "");
  }
  const aiIndex = summary.scope === "comparison" ? 8 : 7;
  lines.push(`## ${aiIndex}. AI辅助分析与整改建议`, "");
  if (report.aiSummary?.summary) {
    lines.push(report.aiSummary.summary, "");
    if (report.aiSummary.evidence?.length) lines.push("### 事实依据", "", ...report.aiSummary.evidence.map((item) => `- ${item}`), "");
    if (report.aiSummary.possibleCauses?.length) lines.push("### 可能原因", "", ...report.aiSummary.possibleCauses.map((item) => `- ${item}`), "");
    if (report.aiSummary.suggestions?.length) lines.push("### 整改建议", "", ...report.aiSummary.suggestions.map((item, index) => `${index + 1}. ${item}`), "");
    if (report.aiSummary.limitations?.length) lines.push(`> 分析限制：${report.aiSummary.limitations.join("；")}`, "");
  } else {
    lines.push("当前未生成模型分析，统计指标、图表、问题明细和整改跟踪不受影响。", "");
  }
  lines.push(`## ${aiIndex + 1}. 风险、限制与附录`, "", "- 报告统计基于生成时固化的质量事实快照，不随后续批次自动变化。", "- 同一数据行可能命中多条规则，问题行数与问题命中次数应区分理解。", "- 未配置规则、规则停用或执行失败的质量维度显示为未覆盖。", "- 规则集合、评分公式或系统覆盖对象发生变化时，得分变化只能条件解释。", "- AI内容用于解释和辅助整改，不替代确定性指标和业务确认。", "", `_本报告由 MeData 数据质量监控模块生成 · 模板 ${REPORT_TEMPLATE_VERSION}_`);
  return lines.join("\n");
}

function docParagraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    pageBreakBefore: options.pageBreakBefore,
    spacing: { before: options.before ?? 60, after: options.after ?? 100, line: 330 },
    children: [new TextRun({ text: String(text || ""), bold: Boolean(options.bold), size: options.size || 21, color: options.color || "26364D" })],
  });
}

function docTable(headers, rows, widths) {
  const borders = { top: { style: BorderStyle.SINGLE, color: "DCE6F1", size: 1 }, bottom: { style: BorderStyle.SINGLE, color: "DCE6F1", size: 1 }, left: { style: BorderStyle.SINGLE, color: "DCE6F1", size: 1 }, right: { style: BorderStyle.SINGLE, color: "DCE6F1", size: 1 }, insideHorizontal: { style: BorderStyle.SINGLE, color: "E8EEF5", size: 1 }, insideVertical: { style: BorderStyle.SINGLE, color: "E8EEF5", size: 1 } };
  const cell = (text, index, header = false) => new TableCell({ width: { size: widths?.[index] || Math.floor(100 / headers.length), type: WidthType.PERCENTAGE }, shading: header ? { fill: "EAF3FF" } : undefined, margins: { top: 80, bottom: 80, left: 90, right: 90 }, children: [docParagraph(text, { bold: header, size: header ? 18 : 17, color: header ? "173B67" : "334A62", before: 0, after: 0 })] });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ tableHeader: true, children: headers.map((header, index) => cell(header, index, true)) }), ...rows.map((row) => new TableRow({ children: row.map((value, index) => cell(value ?? "-", index)) }))] });
}

function docChart(chart) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 150 }, children: [new ImageRun({ type: "svg", data: Buffer.from(chart.svg, "utf8"), transformation: { width: 620, height: Math.max(220, Math.min(430, Math.round(620 * (Number(/height="(\d+)/.exec(chart.svg)?.[1]) || 320) / 760))) }, fallback: { type: "png", data: TRANSPARENT_PNG_BUFFER } })] });
}

async function buildReportWordBuffer(report) {
  const summary = report.summary || {};
  const charts = report.charts || buildReportCharts(summary);
  const dimensionRows = reportDimensionRows(summary);
  const rules = [...topRules(summary)].sort((left, right) => number(right.issueRows ?? right.currentIssueRows) - number(left.issueRows ?? left.currentIssueRows)).slice(0, 40);
  const metrics = getPrimaryMetrics(summary);
  const scopeLabel = reportScopeLabel(summary);
  const children = [
    docParagraph("DATA QUALITY ASSESSMENT REPORT", { alignment: AlignmentType.CENTER, bold: true, size: 22, color: "1677FF", before: 520, after: 220 }),
    docParagraph(report.title, { alignment: AlignmentType.CENTER, bold: true, size: 38, color: "12233F", after: 260 }),
    docParagraph(`${scopeLabel} · 报告编号 QC-${String(report.id || "-").padStart(6, "0")}`, { alignment: AlignmentType.CENTER, size: 22, color: "64748B", after: 120 }),
    docParagraph(`生成时间：${formatDateTime(report.createdAt)}   生成者：${report.createdBy || "system"}`, { alignment: AlignmentType.CENTER, size: 19, color: "64748B", after: 520 }),
    docParagraph("本报告基于生成时固化的数据质量事实快照形成。未覆盖维度不默认计为100分，AI分析不参与确定性指标计算。", { alignment: AlignmentType.CENTER, size: 18, color: "64748B", after: 500 }),
    docParagraph("目录", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, pageBreakBefore: true }),
    new TableOfContents("报告目录", { hyperlink: true, headingStyleRange: "1-3" }),
    docParagraph("1. 文档信息与统计口径", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, pageBreakBefore: true }),
    docTable(["项目", "内容"], [["报告类型", scopeLabel], ["评价范围", getScopeDescription(summary)], ["生成者", report.createdBy || "system"], ["模板版本", REPORT_TEMPLATE_VERSION], ["评分口径", "规则得分按问题率和严重程度加权；未覆盖维度单独披露。"], ["数据安全", "问题样例使用脱敏快照，模型仅接收汇总统计和有限脱敏样例。"]], [23, 77]),
    docParagraph("2. 执行摘要", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }),
    docParagraph(getExecutiveConclusion(summary), { size: 21 }),
    docTable(["指标", "统计值"], metrics.map(([label, value]) => [label, value]), [50, 50]),
    docParagraph("3. 质量范围与覆盖情况", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }),
    docParagraph(getScopeDescription(summary)),
    docParagraph("覆盖率用于描述已配置质量规则维度的完整程度，不与质量得分混为同一指标。", { color: "64748B", size: 18 }),
    docParagraph("4. 总体质量评价", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }),
    ...charts.flatMap((chart) => [docParagraph(chart.title, { heading: HeadingLevel.HEADING_2, bold: true, size: 23 }), docChart(chart)]),
    docParagraph("5. 质量维度分析", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }),
    docTable(["质量维度", "覆盖状态", "规则数", "失败规则", "问题行次", "得分"], dimensionRows.map((item) => [item.name, item.covered ? "已覆盖" : "未覆盖", String(number(item.ruleCount)), String(number(item.failedRuleCount)), formatNumber(item.issueRows), item.covered ? `${item.score} 分` : "-"]), [18, 15, 13, 14, 18, 22]),
    docParagraph("6. 重点问题与证据", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }),
    docTable(["规则", "字段", "问题行", "问题率", "级别"], rules.map((row) => [row.ruleName || categoryLabel(row.ruleCategory), row.fieldName || "表级", String(row.issueRows ?? row.currentIssueRows ?? 0), formatPercent(number(row.issueRate ?? row.currentIssueRate) * 100), severityLabel(row.severity)]), [32, 22, 16, 16, 14]),
  ];
  if (summary.samples?.length) {
    children.push(docParagraph("脱敏问题样例", { heading: HeadingLevel.HEADING_2, bold: true, size: 23 }), docTable(["规则", "主键快照", "字段值", "问题说明"], summary.samples.slice(0, 30).map((item) => [item.ruleCode || "-", item.maskedPkText || "-", item.maskedValueText || "-", item.issueMessage || "-"]), [22, 23, 23, 32]));
  }
  if (summary.scope === "comparison") {
    children.push(docParagraph(`7. ${comparisonTypeLabel(summary)}`, { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }), docTable(["质量维度", "基准得分", "当前得分", "得分变化", "问题行变化"], (summary.dimensionSummary?.dimensions || []).map((row) => [row.name, row.previousScore === null ? "未覆盖" : `${row.previousScore} 分`, row.currentScore === null ? "未覆盖" : `${row.currentScore} 分`, row.scoreChange === null ? "口径变化" : `${number(row.scoreChange) >= 0 ? "+" : ""}${row.scoreChange} 分`, `${number(row.issueRowsChange) >= 0 ? "+" : ""}${row.issueRowsChange}`]), [20, 20, 20, 20, 20]), docParagraph(`可比性说明：${summary.comparability?.message || "差异分析已基于当前可用质量快照生成。"}`, { color: "64748B", size: 18 }));
  }
  const aiIndex = summary.scope === "comparison" ? 8 : 7;
  children.push(docParagraph(`${aiIndex}. AI辅助分析与整改建议`, { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }));
  if (report.aiSummary?.summary) {
    children.push(docParagraph(report.aiSummary.summary));
    for (const [title, values] of [["事实依据", report.aiSummary.evidence], ["可能原因", report.aiSummary.possibleCauses], ["整改建议", report.aiSummary.suggestions], ["分析限制", report.aiSummary.limitations]]) {
      if (!values?.length) continue;
      children.push(docParagraph(title, { heading: HeadingLevel.HEADING_2, bold: true, size: 23 }));
      values.forEach((item) => children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text: String(item), size: 20, color: "334A62" })] })));
    }
  } else {
    children.push(docParagraph("当前未生成模型分析，统计指标、图表、问题明细和整改跟踪不受影响。", { color: "64748B" }));
  }
  children.push(docParagraph(`${aiIndex + 1}. 风险、限制与附录`, { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 220 }));
  ["报告统计基于生成时固化的质量事实快照，不随后续批次自动变化。", "同一数据行可能命中多条规则，问题行数与问题命中次数应区分理解。", "未配置规则、规则停用或执行失败的质量维度显示为未覆盖。", "AI内容用于解释和辅助整改，不替代确定性指标和业务确认。"].forEach((item) => children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text: item, size: 20, color: "334A62" })] })));
  const document = new Document({
    styles: { default: { document: { run: { font: "Microsoft YaHei" }, paragraph: { spacing: { line: 330 } } } }, paragraphStyles: [{ id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Microsoft YaHei" } }] },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 }, pageNumbers: { start: 1 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MeData 数据质量报告  ·  第 ", size: 16, color: "7C8DA0" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "7C8DA0" }), new TextRun({ text: " 页", size: 16, color: "7C8DA0" })] })] }) }, children }],
  });
  return Packer.toBuffer(document);
}

function sanitizeFileName(value, fallback = "quality_report") {
  const normalized = String(value || fallback).replace(/[\\/:*?"<>|\r\n]+/g, "_").trim().slice(0, 120);
  return normalized || fallback;
}

module.exports = {
  REPORT_TEMPLATE_VERSION,
  DIMENSION_DEFINITIONS,
  buildDimensionSummary,
  buildComparisonDimensionSummary,
  buildSnapshotDimensionComparison,
  hasLegacyReferentialDimension,
  normalizeDimensionSummary,
  buildReportCharts,
  buildReportHtml,
  buildReportMarkdown,
  buildReportWordBuffer,
  categoryLabel,
  dimensionKeyForRule,
  sanitizeFileName,
  __test: { buildRadarSvg, buildComparisonRadarSvg, buildDimensionBarsSvg, buildTrendSvg, buildDifferenceSvg, getExecutiveConclusion, comparisonTypeLabel },
};
