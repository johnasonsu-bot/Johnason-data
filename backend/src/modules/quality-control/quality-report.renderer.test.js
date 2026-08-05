const test = require("node:test");
const assert = require("node:assert/strict");
const renderer = require("./quality-report.renderer");

const rules = [
  { ruleCategory: "non_null", ruleCode: "non_null_name", ruleName: "名称非空", fieldName: "name", severity: "high", totalRows: 100, issueRows: 10, issueRate: 0.1 },
  { ruleCategory: "compliance", ruleCode: "phone_format", ruleName: "手机号格式", fieldName: "phone", severity: "medium", totalRows: 100, issueRows: 5, issueRate: 0.05 },
  { ruleCategory: "freshness", ruleCode: "freshness_updated_at", ruleName: "更新时间", fieldName: "updated_at", severity: "high", totalRows: 100, issueRows: 2, issueRate: 0.02 },
  { ruleCategory: "composite_unique", ruleCode: "unique_user", ruleName: "用户唯一", fieldName: "user_id", severity: "high", totalRows: 100, issueRows: 0, issueRate: 0 },
];

function buildReport() {
  const dimensionSummary = renderer.buildDimensionSummary(rules);
  const summary = {
    scope: "table",
    table: { monitorTableId: 1, tableName: "ods_user", systemName: "用户中心" },
    batch: { id: 11, batchId: "QC-20260719-001", score: 88.5, issueRows: 15, failedRuleCount: 3, totalRuleCount: 4 },
    rules,
    samples: [{ ruleCode: "non_null_name", maskedPkText: "u***1", maskedValueText: "***", issueMessage: "名称为空" }],
    dimensionSummary,
    trend: [{ label: "批次1", score: 82 }, { label: "批次2", score: 88.5 }],
    issueTracking: { openIssueCount: 2 },
  };
  return { id: 7, title: "用户表数据质量报告", summary, aiSummary: { available: true, summary: "质量总体良好。", evidence: ["质量得分88.5分"], possibleCauses: ["名称采集不完整"], suggestions: ["补充名称必填校验"], limitations: [] }, charts: renderer.buildReportCharts(summary), createdAt: new Date("2026-07-19T08:00:00+08:00"), createdBy: "admin1" };
}

test("quality dimensions keep uncovered configured dimensions explicit", () => {
  const summary = renderer.buildDimensionSummary(rules);
  assert.equal(summary.coveredDimensionCount, 4);
  assert.equal(summary.totalDimensionCount, 6);
  assert.equal(summary.coverageRate, 66.7);
  assert.equal(summary.dimensions.some((item) => item.key === "accuracy"), false);
  assert.equal(summary.dimensions.some((item) => item.key === "referential"), false);
  assert.equal(summary.dimensions.find((item) => item.key === "completeness")?.score, 90);
});

test("cross table lookup is merged into consistency dimension", () => {
  const summary = renderer.buildDimensionSummary([
    ...rules,
    { ruleCategory: "cross_table_lookup", ruleCode: "lookup_org", severity: "high", totalRows: 100, issueRows: 8, issueRate: 0.08 },
    { ruleCategory: "cross_table_consistency", ruleCode: "compare_org", severity: "medium", totalRows: 100, issueRows: 3, issueRate: 0.03 },
  ]);
  const consistency = summary.dimensions.find((item) => item.key === "consistency");
  assert.equal(consistency?.ruleCount, 2);
  assert.equal(consistency?.issueRows, 11);
  assert.equal(summary.dimensions.some((item) => item.key === "referential"), false);
});

test("legacy referential report dimension is normalized into consistency", () => {
  const normalized = renderer.normalizeDimensionSummary({
    dimensions: [
      { key: "consistency", covered: true, ruleCount: 1, failedRuleCount: 1, checkedRows: 100, issueRows: 3, score: 97, topRules: [] },
      { key: "referential", covered: true, ruleCount: 1, failedRuleCount: 1, checkedRows: 100, issueRows: 8, score: 92, topRules: [] },
    ],
  });
  const consistency = normalized.dimensions.find((item) => item.key === "consistency");
  assert.equal(normalized.totalDimensionCount, 6);
  assert.equal(consistency?.ruleCount, 2);
  assert.equal(consistency?.issueRows, 11);
  assert.equal(normalized.dimensions.some((item) => item.key === "referential"), false);
});

test("formal report renders html and markdown with charts and dimensions", () => {
  const report = buildReport();
  const html = renderer.buildReportHtml(report);
  const markdown = renderer.buildReportMarkdown(report);
  assert.match(html, /质量维度分析/);
  assert.match(html, /质量维度雷达图/);
  assert.match(html, /未覆盖/);
  assert.match(markdown, /data:image\/svg\+xml;base64/);
  assert.match(markdown, /同步|整改建议|质量维度分析/);
});

test("comparison report uses current dimension values in shared sections", () => {
  const dimensionSummary = renderer.buildComparisonDimensionSummary(rules, rules);
  const summary = {
    scope: "comparison",
    comparisonType: "batch",
    current: { batchId: "QC-20260719-002", score: 88.5, issueRows: 15 },
    previous: { batchId: "QC-20260719-001", score: 88.5, issueRows: 15 },
    change: { score: 0, issueRows: 0 },
    ruleChanges: { newCount: 0, resolvedCount: 0, persistentCount: 4 },
    rules: [],
    samples: [],
    dimensionSummary,
    trend: [],
    comparability: { message: "两个批次规则集合一致。" },
  };
  const report = { id: 8, title: "用户表批次差异分析", summary, charts: renderer.buildReportCharts(summary), createdAt: new Date("2026-07-19T08:00:00+08:00") };
  const markdown = renderer.buildReportMarkdown(report);

  assert.doesNotMatch(report.charts.map((item) => item.svg).join("\n"), /undefined/);
  assert.match(report.charts.map((item) => item.svg).join("\n"), /基准快照/);
  assert.doesNotMatch(markdown, /undefined/);
  assert.match(markdown, /完整性 \| 已覆盖 \| 1 \| 1 \| 10 \| 90 分/);
});

test("stored report comparison keeps baseline and current dimension snapshots", () => {
  const current = renderer.buildDimensionSummary(rules);
  const previous = renderer.buildDimensionSummary(rules.map((rule) => ({ ...rule, issueRows: 0, issueRate: 0 })));
  const comparison = renderer.buildSnapshotDimensionComparison(current, previous);
  const completeness = comparison.dimensions.find((item) => item.key === "completeness");
  assert.equal(completeness.previousScore, 100);
  assert.equal(completeness.currentScore, 90);
  assert.equal(completeness.scoreChange, -10);
});

test("formal Word report can be generated", async () => {
  const buffer = await renderer.buildReportWordBuffer(buildReport());
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 5000);
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
});
