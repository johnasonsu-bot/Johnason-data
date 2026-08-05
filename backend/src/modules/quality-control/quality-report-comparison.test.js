const test = require("node:test");
const assert = require("node:assert/strict");
const { __test } = require("./quality-analytics.service");

test("report rule snapshots classify added, resolved and persistent issues", () => {
  const current = [
    { strategyRuleInstanceId: "r1", ruleCode: "non_null", fieldName: "name", issueRows: 8, totalRows: 100, issueRate: 0.08 },
    { strategyRuleInstanceId: "r2", ruleCode: "phone", fieldName: "phone", issueRows: 0, totalRows: 100, issueRate: 0 },
    { strategyRuleInstanceId: "r3", ruleCode: "status", fieldName: "status", issueRows: 5, totalRows: 100, issueRate: 0.05 },
  ];
  const previous = [
    { strategyRuleInstanceId: "r1", ruleCode: "non_null", fieldName: "name", issueRows: 4, totalRows: 100, issueRate: 0.04 },
    { strategyRuleInstanceId: "r2", ruleCode: "phone", fieldName: "phone", issueRows: 3, totalRows: 100, issueRate: 0.03 },
  ];
  const result = __test.compareRuleSnapshots(current, previous);
  assert.equal(result.ruleChanges.newCount, 1);
  assert.equal(result.ruleChanges.resolvedCount, 1);
  assert.equal(result.ruleChanges.persistentCount, 1);
  assert.equal(result.ruleChanges.addedRuleCount, 1);
  assert.equal(result.ruleChanges.removedRuleCount, 0);
});

test("system report comparison detects coverage entry and exit", () => {
  const changes = __test.compareSystemTableSnapshots(
    [{ monitorTableId: 1, tableName: "a", score: 90 }, { monitorTableId: 3, tableName: "c", score: 70 }],
    [{ monitorTableId: 1, tableName: "a", score: 80 }, { monitorTableId: 2, tableName: "b", score: 60 }],
  );
  assert.equal(changes.find((item) => item.monitorTableId === 1)?.scoreChange, 10);
  assert.equal(changes.find((item) => item.monitorTableId === 2)?.status, "removed");
  assert.equal(changes.find((item) => item.monitorTableId === 3)?.status, "added");
});

test("all report types use searchable default titles", () => {
  const baselineTime = new Date(2026, 6, 19, 10, 45, 23);
  const currentTime = new Date(2026, 7, 3, 18, 20, 30);
  assert.equal(__test.buildDefaultReportTitle({
    reportScope: "table",
    comparisonType: null,
    summary: { table: { tableName: "ods_demo_order" }, batch: { batchId: "qct_20260803_001" } },
    createdAt: currentTime,
  }), "ods_demo_order_质量报告_qct_20260803_001");
  assert.equal(__test.buildDefaultReportTitle({
    reportScope: "system",
    comparisonType: null,
    summary: { targetSystem: { systemName: "就业服务系统" }, snapshotAt: currentTime },
    createdAt: currentTime,
  }), "就业服务系统_质量报告_20260803182030");
  assert.equal(__test.buildDefaultReportTitle({
    reportScope: "comparison",
    comparisonType: "batch",
    summary: { object: { objectName: "ods_demo_order" }, previous: { batchId: "batch_001" }, current: { batchId: "batch_002" } },
    createdAt: currentTime,
  }), "ods_demo_order_差异分析报告_batch_001-batch_002");
  assert.equal(__test.buildDefaultReportTitle({
    reportScope: "comparison",
    comparisonType: "table_report",
    summary: { object: { objectName: "ods_demo_order" }, previous: { snapshotAt: baselineTime }, current: { snapshotAt: currentTime } },
    createdAt: currentTime,
  }), "ods_demo_order_差异分析报告_20260719104523-20260803182030");
  assert.equal(__test.buildDefaultReportTitle({
    reportScope: "comparison",
    comparisonType: "system_report",
    summary: { object: { objectName: "就业服务系统" }, previous: { snapshotAt: baselineTime }, current: { snapshotAt: currentTime } },
    createdAt: currentTime,
  }), "就业服务系统_差异分析报告_20260719104523-20260803182030");
});
