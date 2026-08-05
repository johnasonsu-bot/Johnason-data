const test = require("node:test");
const assert = require("node:assert/strict");
const { __test } = require("./quality-analytics.service");

test("quality ops range falls back to 7d", () => {
  assert.equal(__test.normalizeOpsRange("24h"), "24h");
  assert.equal(__test.normalizeOpsRange("unknown"), "7d");
});

test("business system id accepts empty and positive integer values", () => {
  assert.equal(__test.normalizeBusinessSystemId(undefined), null);
  assert.equal(__test.normalizeBusinessSystemId(""), null);
  assert.equal(__test.normalizeBusinessSystemId("12"), 12);
  assert.throws(() => __test.normalizeBusinessSystemId("invalid"), /业务系统参数无效/);
  assert.throws(() => __test.normalizeBusinessSystemId(0), /业务系统参数无效/);
});

test("weighted quality score respects table importance", () => {
  const score = __test.weightedQualityScore([
    { score: 80, importanceLevel: "critical" },
    { score: 100, importanceLevel: "low" },
  ]);
  assert.equal(score, 86.36);
});

test("ops rate handles empty denominator", () => {
  assert.equal(__test.opsRate(4, 5), 80);
  assert.equal(__test.opsRate(4, 0), 0);
});

test("ops issue stats exclude aggregate metrics without row denominators", () => {
  assert.deepEqual(__test.opsIssueStats([
    { evaluationStatus: "evaluated", totalRows: 100, issueRows: 80 },
    { evaluationStatus: "evaluated", totalRows: 0, issueRows: 50 },
    { evaluationStatus: "not_evaluable", totalRows: 100, issueRows: 100 },
    { evaluationStatus: "evaluated", totalRows: 20, issueRows: 30 },
  ]), { checkedRows: 120, issueRows: 100 });
});

test("trend falls back to batch points when daily buckets are sparse", () => {
  const rows = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    completedAt: `2026-07-19T01:0${index}:00+08:00`,
    tableName: `table_${index + 1}`,
    score: 80 + index,
    issueRows: 10,
    checkedRows: 100,
    totalRuleCount: 10,
    failedRuleCount: 2,
    importanceLevel: "normal",
  }));
  const trend = __test.buildOpsTrend(rows, "7d");
  assert.equal(trend.mode, "batch");
  assert.equal(trend.points.length, 4);
  assert.equal(trend.points[0].anomalyRate, 10);
  assert.equal(trend.points[0].rulePassRate, 80);
});

test("trend groups into daily points when enough dates exist", () => {
  const rows = ["2026-07-17", "2026-07-18", "2026-07-19"].map((day, index) => ({
    id: index + 1,
    completedAt: `${day}T01:00:00+08:00`,
    score: 90 + index,
    issueRows: 5,
    checkedRows: 100,
    totalRuleCount: 10,
    failedRuleCount: 1,
    importanceLevel: "normal",
  }));
  const trend = __test.buildOpsTrend(rows, "7d");
  assert.equal(trend.mode, "day");
  assert.equal(trend.points.length, 3);
  assert.equal(trend.points[2].score, 92);
});

test("quality issue flow aggregates system, dimension and severity", () => {
  const flow = __test.buildQualityIssueFlow(
    [{ id: 11, systemName: "订单系统" }, { id: 12, systemName: "会员系统" }],
    [
      { resultBatchId: 11, ruleCategory: "non_null", severity: "high", issueRows: 12 },
      { resultBatchId: 11, ruleCategory: "duplicate", severity: "medium", issueRows: 5 },
      { resultBatchId: 12, ruleCategory: "non_null", severity: "critical", issueRows: 3 },
      { resultBatchId: 12, ruleCategory: "non_null", severity: "low", issueRows: 0 },
    ],
  );
  assert.equal(flow.nodes.some((item) => item.key === "system:订单系统"), true);
  assert.equal(flow.nodes.some((item) => item.label === "完整性"), true);
  assert.deepEqual(flow.links.find((item) => item.source === "system:订单系统" && item.target === "dimension:completeness"), { source: "system:订单系统", target: "dimension:completeness", value: 12 });
  assert.equal(flow.links.find((item) => item.source === "dimension:completeness" && item.target === "severity:critical")?.value, 3);
});

test("quality issue flow uses tables as the first level for one system", () => {
  const flow = __test.buildQualityIssueFlow(
    [
      { id: 11, systemName: "订单系统", tableName: "订单明细表" },
      { id: 12, systemName: "订单系统", tableName: "订单支付表" },
    ],
    [
      { resultBatchId: 11, ruleCategory: "non_null", severity: "high", issueRows: 12 },
      { resultBatchId: 12, ruleCategory: "duplicate", severity: "medium", issueRows: 5 },
    ],
    { businessSystemId: 12 },
  );
  assert.equal(flow.mode, "table");
  assert.equal(flow.nodes.some((item) => item.key === "table:订单明细表"), true);
  assert.equal(flow.nodes.some((item) => item.key.startsWith("system:")), false);
  assert.deepEqual(flow.links.find((item) => item.source === "table:订单明细表"), { source: "table:订单明细表", target: "dimension:completeness", value: 12 });
});

test("quality top rules merge latest batches and keep highest severity", () => {
  const rows = __test.buildQualityTopRules([
    { monitorTableId: 11, tableName: "用户表", strategyVersionId: 21, strategyVersionNo: 2, taskName: "用户质量任务", ruleCode: "not_null", ruleName: "非空校验", fieldName: "user_id", severity: "medium", issueRows: 8, totalRows: 100 },
    { monitorTableId: 11, tableName: "用户表", strategyVersionId: 21, strategyVersionNo: 2, taskName: "用户质量任务", ruleCode: "not_null", ruleName: "非空校验", fieldName: "user_id", severity: "high", issueRows: 4, totalRows: 50 },
    { monitorTableId: 12, tableName: "订单表", strategyVersionId: 22, strategyVersionNo: 1, taskName: "订单质量任务", ruleCode: "unique", ruleName: "唯一性校验", fieldName: "order_id", severity: "critical", issueRows: 3, totalRows: 100 },
  ]);
  assert.equal(rows[0].issueRows, 12);
  assert.equal(rows[0].totalRows, 150);
  assert.equal(rows[0].issueRate, 8);
  assert.equal(rows[0].severity, "high");
  assert.equal(rows[0].tableName, "用户表");
  assert.equal(rows[0].strategyVersionNo, 2);
  assert.equal(rows[0].taskName, "用户质量任务");
});

test("quality top rules keep the same rule separate across tables and strategies", () => {
  const rows = __test.buildQualityTopRules([
    { monitorTableId: 11, tableName: "用户表", strategyVersionId: 21, strategyVersionNo: 1, ruleCode: "not_null", fieldName: "user_id", issueRows: 8, totalRows: 100 },
    { monitorTableId: 12, tableName: "会员表", strategyVersionId: 22, strategyVersionNo: 3, ruleCode: "not_null", fieldName: "user_id", issueRows: 6, totalRows: 100 },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((item) => item.tableName), ["用户表", "会员表"]);
});

test("quality dimensions average each strategy dimension score with equal weight", () => {
  const dimensions = __test.buildOpsDimensionHealth([
    { resultBatchId: 11, strategyVersionId: 101, ruleCategory: "non_null", severity: "medium", evaluationStatus: "evaluated", totalRows: 100, issueRows: 20, issueRate: 0.2 },
    { resultBatchId: 11, strategyVersionId: 101, ruleCategory: "conditional_required", severity: "medium", evaluationStatus: "evaluated", totalRows: 100, issueRows: 0, issueRate: 0 },
    { resultBatchId: 12, strategyVersionId: 102, ruleCategory: "batch_completeness", severity: "medium", evaluationStatus: "evaluated", totalRows: 100, issueRows: 0, issueRate: 0 },
    { resultBatchId: 13, strategyVersionId: 103, ruleCategory: "duplicate", severity: "medium", evaluationStatus: "evaluated", totalRows: 100, issueRows: 10, issueRate: 0.1 },
  ], [
    { resultBatchId: 21, strategyVersionId: 101, ruleCategory: "non_null", severity: "medium", evaluationStatus: "evaluated", totalRows: 100, issueRows: 30, issueRate: 0.3 },
    { resultBatchId: 22, strategyVersionId: 102, ruleCategory: "batch_completeness", severity: "medium", evaluationStatus: "evaluated", totalRows: 100, issueRows: 10, issueRate: 0.1 },
  ]);
  const completeness = dimensions.find((item) => item.key === "completeness");
  const uniqueness = dimensions.find((item) => item.key === "uniqueness");
  assert.equal(completeness.score, 95);
  assert.equal(completeness.strategyCount, 2);
  assert.equal(completeness.ruleCount, 3);
  assert.equal(completeness.scoreChange, 15);
  assert.equal(uniqueness.score, 90);
  assert.equal(uniqueness.strategyCount, 1);
  assert.equal(uniqueness.scoreChange, null);
});

test("quality dimensions exclude strategies whose dimension cannot be evaluated", () => {
  const dimensions = __test.buildOpsDimensionHealth([
    { resultBatchId: 11, strategyVersionId: 101, ruleCategory: "freshness", evaluationStatus: "not_evaluable", totalRows: 0, issueRows: 0, issueRate: null },
    { resultBatchId: 12, strategyVersionId: 102, ruleCategory: "freshness", severity: "high", evaluationStatus: "evaluated", totalRows: 100, issueRows: 100, issueRate: 1 },
  ], []);
  const timeliness = dimensions.find((item) => item.key === "timeliness");
  assert.equal(timeliness.score, 0);
  assert.equal(timeliness.strategyCount, 1);
});

test("quality robot follow-up inherits the previous result intent", () => {
  const history = [
    { role: "user", messageText: "哪些表问题最多" },
    { role: "assistant", messageText: "已整理重点数据表", payload: { cards: [{ title: "重点数据表" }] } },
  ];
  assert.equal(__test.resolveQualityRobotIntent("第一个为什么得分低？", history), "table");
  assert.equal(__test.resolveQualityRobotIntent("查看系统质量排名", history), "system");
});

test("quality robot formats model json as readable Chinese sections", () => {
  const answer = __test.formatQualityRobotModelAnswer(JSON.stringify({
    summary: "重点关注纳税记录表。",
    evidence: "问题行数最高。",
    possibleCauses: ["非空字段异常", "跨表一致性异常"],
    suggestions: "优先复核高频规则。",
    limitations: "仅依据当前批次。",
  }));
  assert.match(answer, /^重点关注纳税记录表。/);
  assert.match(answer, /依据：问题行数最高。/);
  assert.match(answer, /可能原因：非空字段异常；跨表一致性异常/);
  assert.doesNotMatch(answer, /"summary"/);
  assert.equal(__test.formatQualityRobotModelAnswer('{ "summary":'), "");
});

test("quality robot resolves an ordinal target from the previous result card", () => {
  const history = [{
    role: "assistant",
    payload: { cards: [{ type: "table", rows: [{ tableName: "table_a" }, { tableName: "table_b" }] }] },
  }];
  assert.equal(__test.resolveQualityRobotFollowUpTarget("第二张表有什么问题？", history).tableName, "table_b");
  assert.equal(__test.resolveQualityRobotFollowUpTarget("第一张表为什么得分低？", history).tableName, "table_a");
});
