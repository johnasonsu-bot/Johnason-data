const assert = require("node:assert/strict");
const test = require("node:test");

const { dictionaryBatchDeleteSchema, recommendationApplySchema, updateAiConfigSchema } = require("./quality-control.schema");

test("质量模型场景支持深度思考配置", () => {
  const result = updateAiConfigSchema.safeParse({
    thinkingEnabled: true,
    reasoningEffort: "high",
    thinkingBudget: 1024,
  });
  assert.equal(result.success, true, result.error?.message);

  const invalidEffort = updateAiConfigSchema.safeParse({ thinkingEnabled: true, reasoningEffort: "extreme" });
  assert.equal(invalidEffort.success, false);
});

test("业务字典批量删除必须选择有效字典", () => {
  const validResult = dictionaryBatchDeleteSchema.safeParse({ ids: [1, "2"] });
  assert.deepEqual(validResult.data, { ids: [1, 2] });

  const emptyResult = dictionaryBatchDeleteSchema.safeParse({ ids: [] });
  assert.equal(emptyResult.success, false);
});

test("策略推荐生成的空统计维度可以原样回填草稿", () => {
  const result = recommendationApplySchema.safeParse({
    summary: "已审核采纳智能策略建议",
    fieldStrategies: [{
      columnName: "status",
      sampleValues: ["有效"],
      valueRate: 1,
      nonNullCheck: true,
      complianceRuleCodes: [],
      duplicateCheck: false,
    }],
    advancedRules: [{
      ruleId: "null_rate_change_status",
      ruleName: "status 字段空值率波动",
      ruleScope: "aggregate",
      ruleCategory: "null_rate_change",
      enabled: true,
      severity: "medium",
      config: {
        metricField: "status",
        dimensionField: null,
        baselineMode: "recent_avg",
        lookbackBatches: 7,
        minHistoryBatches: 3,
        warmupPolicy: "collect_only",
        warmupThreshold: null,
        thresholdPercent: 20,
        direction: "both",
      },
    }],
    reviewedRuleIds: ["null_rate_change_status"],
  });

  assert.equal(result.success, true, result.error?.message);
});
