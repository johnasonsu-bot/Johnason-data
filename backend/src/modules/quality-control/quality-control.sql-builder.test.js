const test = require("node:test");
const assert = require("node:assert/strict");
const { buildQualitySqlBundle } = require("./quality-control.sql-builder");

test("时效规则始终使用完整源表而不是当前增量切片", () => {
  const bundle = buildQualitySqlBundle({
    dialect: "postgresql",
    tableName: "orders",
    detailTableName: "qc_detail",
    statsTableName: "qc_stats",
    primaryKeyColumns: ["id"],
    fieldStrategies: [],
    advancedRules: [{
      ruleId: "freshness_updated_at",
      ruleName: "更新时间时效检查",
      ruleCategory: "freshness",
      ruleScope: "aggregate",
      severity: "high",
      config: { timeField: "updated_at", maxDelayValue: 24, maxDelayUnit: "hour" },
    }],
    batchId: "test_batch",
    sourceFromSql: `(SELECT * FROM "orders" WHERE "ods_loaded_at" >= CURRENT_DATE)`,
    fullSourceFromSql: `"orders"`,
  });
  const ruleSql = bundle.ruleStatements.join("\n");
  assert.match(ruleSql, /FROM "orders" qc_metric/);
  assert.match(ruleSql, /INTERVAL '24 hour'/);
  assert.doesNotMatch(ruleSql, /ods_loaded_at/);
  assert.match(ruleSql, /curr\.total_rows > 0 AND \(curr\.metric_value IS NULL OR curr\.metric_value > base\.baseline_value OR curr\.issue_rows > 0\)/);
  assert.match(ruleSql, /IS NULL OR NULLIF\(BTRIM/);
});

for (const dialect of ["oracle", "dm"]) {
  test(`${dialect} 质量 SQL 使用对应方言而不是 MySQL 语法`, () => {
    const bundle = buildQualitySqlBundle({
      dialect,
      tableName: "APP.ORDERS",
      detailTableName: "QC_DETAIL",
      statsTableName: "QC_STATS",
      primaryKeyColumns: ["ID"],
      fieldStrategies: [],
      advancedRules: [{
        ruleId: "freshness_updated_at",
        ruleName: "更新时间时效检查",
        ruleCategory: "freshness",
        ruleScope: "aggregate",
        severity: "high",
        config: { timeField: "UPDATED_AT", maxDelayValue: 2, maxDelayUnit: "hour" },
      }, {
        ruleId: "volume_anomaly",
        ruleName: "数据量波动检查",
        ruleCategory: "volume_anomaly",
        ruleScope: "aggregate",
        severity: "high",
        config: { baselineMode: "recent_avg", lookbackBatches: 3 },
      }],
      batchId: "test_batch",
    });
    const sql = bundle.sqlContent;
    assert.match(sql, /"APP"\."ORDERS"/);
    assert.match(sql, /FETCH FIRST 3 ROWS ONLY/);
    assert.match(sql, /REGEXP_LIKE/);
    assert.doesNotMatch(sql, /`/);
    assert.doesNotMatch(sql, /\bLIMIT\b/i);
    assert.doesNotMatch(sql, /DATE_SUB|NOT REGEXP\b|<=>/i);
    if (dialect === "oracle") {
      assert.match(sql, /NUMTODSINTERVAL\(2, 'HOUR'\)/);
      assert.match(sql, /VARCHAR2\(4000\)/);
    } else {
      assert.match(sql, /DATEADD\(HOUR, -2, CURRENT_TIMESTAMP\)/);
      assert.match(sql, /VARCHAR\(4000\)/);
    }
  });
}
