const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyStrategyRuleMetadata,
  buildStrategyRuleMetadata,
  mapStat,
  maskText,
  scoreBatch,
} = require("./quality-result-collector.service");

test("结果归集：无法可靠换算失败率时标记为不可评估", () => {
  const stat = mapStat({ ruleCategory: "freshness", ruleCode: "freshness_updated_at", issueRows: 1 });
  assert.equal(stat.evaluationStatus, "not_evaluable");
  assert.equal(stat.issueRate, null);
});

test("结果归集：有分母的统计可复算失败率", () => {
  const stat = mapStat({ totalRows: 200, issueRows: 10, issueLevel: "high" });
  assert.equal(stat.evaluationStatus, "evaluated");
  assert.equal(stat.issueRate, 0.05);
  assert.equal(scoreBatch([stat]), 95);
});

test("结果归集：空批次规则不再按满分计算", () => {
  const stat = mapStat({ totalRows: 0, issueRows: 0, issueRate: 0 });
  assert.equal(stat.evaluationStatus, "not_evaluable");
  assert.equal(stat.issueRate, null);
  assert.equal(scoreBatch([stat]), null);
});

test("结果归集：有有效聚合指标的空数据规则仍可评估", () => {
  const stat = mapStat({ totalRows: 0, issueRows: 20, issueRate: 0, metricValue: 0, baselineValue: 20 });
  assert.equal(stat.evaluationStatus, "evaluated");
});

test("结果归集：使用策略版本恢复规则名称和风险级别", () => {
  const metadata = buildStrategyRuleMetadata({
    fieldStrategies: [{
      columnName: "phone",
      complianceRules: [{ ruleCode: "mobile_cn", ruleName: "手机号格式", severity: "high" }],
    }],
    advancedRules: [{ ruleCategory: "field_compare", ruleId: "local_001", ruleName: "日期先后校验", severity: "critical" }],
  });
  const compliance = applyStrategyRuleMetadata(mapStat({ ruleCategory: "compliance", ruleCode: "mobile_cn", fieldName: "phone", totalRows: 10, issueRows: 2 }), metadata);
  const comparison = applyStrategyRuleMetadata(mapStat({ ruleCategory: "field_compare", ruleCode: "local_001", fieldName: "start_at,end_at", totalRows: 10, issueRows: 1 }), metadata);
  assert.equal(compliance.ruleName, "手机号格式");
  assert.equal(compliance.issueLevel, "high");
  assert.equal(comparison.ruleName, "日期先后校验");
  assert.equal(comparison.issueLevel, "critical");
});

test("样例脱敏：不保留完整原值", () => {
  assert.equal(maskText("13800138000"), "13***00");
  assert.equal(maskText("abc"), "***");
});
