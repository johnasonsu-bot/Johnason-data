const crypto = require("crypto");
const { pool } = require("../../config/database");
const { getAdapter } = require("../data-development/adapters");
const { inferDatasourceDialect, normalizeDatasourceType, resolveDatasourceConnection } = require("../../common/utils/datasource-dialect");
const metadataService = require("../data-sources/data-source.metadata");

function quoteIdentifier(identifier, dialect) {
  return metadataService.escapeIdentifier(identifier, dialect);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSeverity(value) {
  const severity = String(value || "medium").toLowerCase();
  return ["critical", "high", "medium", "low"].includes(severity) ? severity : "medium";
}

function buildRuntimeDatasource(source) {
  const connectionConfig = source.connectionConfig || {};
  const resolved = resolveDatasourceConnection(source.sourceType, connectionConfig);
  const dialect = inferDatasourceDialect(source.sourceType, connectionConfig);
  return {
    id: source.id,
    sourceType: source.sourceType,
    storageType: normalizeDatasourceType(source.sourceType),
    type: dialect === "gaussdb" ? "postgresql" : dialect,
    host: resolved.host,
    port: Number(resolved.port || 0) || 0,
    username: resolved.username,
    password: resolved.password,
    databaseName: resolved.database,
    extraConfig: {
      schema: resolved.schema || undefined,
      jdbcUrl: resolved.jdbcUrl || undefined,
      driverClassName: resolved.driverClassName || undefined,
    },
  };
}

function maskText(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length <= 4) return "***";
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function fingerprint(parts) {
  return crypto.createHash("sha256").update(parts.map((item) => String(item ?? "")).join("|")).digest("hex");
}

function scoreBatch(rows) {
  const weights = { critical: 1.5, high: 1.2, medium: 1, low: 0.7 };
  const evaluatedRows = rows.filter((row) => (row.evaluationStatus ?? row.evaluation_status) !== "not_evaluable");
  if (!evaluatedRows.length) return null;
  let denominator = 0;
  let penalty = 0;
  evaluatedRows.forEach((row) => {
    const weight = weights[normalizeSeverity(row.issueLevel ?? row.issue_level ?? row.severity)] || 1;
    denominator += weight;
    const issueRate = Math.max(0, Math.min(1, Number(row.issueRate ?? row.issue_rate ?? 0)));
    penalty += Math.min(1, issueRate) * weight;
  });
  return Number(Math.max(0, 100 * (1 - penalty / Math.max(denominator, 1))).toFixed(2));
}

function mapStat(row) {
  const totalRows = toNumber(row.totalRows ?? row.totalrows ?? row.total_rows);
  const issueRows = toNumber(row.issueRows ?? row.issuerows ?? row.issue_rows);
  const storedIssueRate = toNumber(row.issueRate ?? row.issuerate ?? row.issue_rate);
  const metricValue = toNumber(row.metricValue ?? row.metricvalue ?? row.metric_value);
  const baselineValue = toNumber(row.baselineValue ?? row.baselinevalue ?? row.baseline_value);
  const hasComparableDenominator = totalRows !== null && totalRows > 0 && issueRows !== null && issueRows >= 0;
  const hasComparableMetric = metricValue !== null && baselineValue !== null;
  const hasStoredRateOnly = totalRows === null && storedIssueRate !== null;
  const evaluationStatus = hasComparableDenominator || hasComparableMetric || hasStoredRateOnly ? "evaluated" : "not_evaluable";
  return {
    ruleCategory: String(row.ruleCategory ?? row.rulecategory ?? row.rule_category ?? "other"),
    ruleCode: String(row.ruleCode ?? row.rulecode ?? row.rule_code ?? "unknown"),
    ruleName: String(row.ruleName ?? row.rulename ?? row.rule_name ?? ""),
    fieldName: String(row.fieldName ?? row.fieldname ?? row.field_name ?? ""),
    totalRows,
    issueRows,
    issueRate: hasComparableDenominator ? issueRows / totalRows : evaluationStatus === "evaluated" ? storedIssueRate : null,
    metricValue,
    baselineValue,
    thresholdValue: toNumber(row.thresholdValue ?? row.thresholdvalue ?? row.threshold_value),
    detectedAt: row.detectedAt ?? row.detectedat ?? row.detected_at ?? new Date(),
    issueLevel: normalizeSeverity(row.issueLevel ?? row.issuelevel ?? row.issue_level),
    evaluationStatus,
    raw: row,
  };
}

function buildStrategyRuleMetadata(strategyVersion = {}) {
  const metadata = new Map();
  const add = (ruleCategory, ruleCode, fieldName, ruleName, severity) => {
    const category = String(ruleCategory || "").trim();
    const code = String(ruleCode || "").trim();
    if (!category || !code) return;
    const item = { ruleName: String(ruleName || "").trim(), severity: normalizeSeverity(severity) };
    metadata.set(`${category}|${code}|${String(fieldName || "*").trim() || "*"}`, item);
    if (!metadata.has(`${category}|${code}|*`)) metadata.set(`${category}|${code}|*`, item);
  };

  (strategyVersion.fieldStrategies || []).forEach((field) => {
    const fieldName = String(field.columnName || "").trim();
    if (!fieldName) return;
    if (field.nonNullCheck) add("non_null", `non_null_${fieldName}`, fieldName, `非空检查-${fieldName}`, "medium");
    if (field.duplicateCheck) add("duplicate", `duplicate_${fieldName}`, fieldName, `重复值检查-${fieldName}`, "medium");
    (field.complianceRules || []).forEach((rule) => add(
      "compliance",
      rule.ruleCode || `regex_${fieldName}`,
      fieldName,
      rule.ruleName || `合规校验-${fieldName}`,
      rule.severity || "medium",
    ));
    const valueRange = field.valueRangeSnapshot || {};
    if (["list", "range", "number_range", "date_range"].includes(String(valueRange.mode || ""))) {
      add("value_range", `value_range_${fieldName}`, fieldName, `值域检查-${fieldName}`, "medium");
    }
  });

  (strategyVersion.advancedRules || []).forEach((rule) => add(
    rule.ruleCategory,
    rule.ruleId,
    "*",
    rule.ruleName || rule.ruleId,
    rule.severity || "medium",
  ));
  return metadata;
}

function applyStrategyRuleMetadata(stat, metadata) {
  const exactKey = `${stat.ruleCategory}|${stat.ruleCode}|${stat.fieldName || "*"}`;
  const fallbackKey = `${stat.ruleCategory}|${stat.ruleCode}|*`;
  const rule = metadata.get(exactKey) || metadata.get(fallbackKey);
  if (!rule) return stat;
  return {
    ...stat,
    ruleName: rule.ruleName || stat.ruleName,
    issueLevel: rule.severity,
  };
}

async function queryResultRows(source, tableName, batchId, columns) {
  const runtime = buildRuntimeDatasource(source);
  const adapter = getAdapter(runtime);
  const dialect = runtime.type === "gaussdb" ? "postgresql" : runtime.type;
  const sql = `SELECT ${columns.join(", ")} FROM ${quoteIdentifier(tableName, dialect)} WHERE ${quoteIdentifier("batch_id", dialect)} = ?`;
  // Adapters accept rendered SQL rather than bound values. The batch id originates from the scheduler but is still escaped.
  const escapedBatch = metadataService.escapeValue(batchId);
  const result = await adapter.executeQuery(runtime, sql.replace("?", escapedBatch), { databaseName: runtime.databaseName });
  return result.rows || [];
}

async function collectTaskRun({ task, taskRun, source, strategyVersion, profileSnapshot }) {
  const projectId = Number(task.projectId || taskRun.projectId || 0);
  if (!projectId) throw new Error("质量任务缺少项目归属，不能归集结果");
  const [tableRows] = await pool.query(
    `SELECT business_system_id AS businessSystemId FROM qc_monitor_table WHERE id = ? AND project_id = ? LIMIT 1`,
    [task.monitorTableId, projectId]
  );
  const businessSystemId = tableRows[0]?.businessSystemId || null;
  const statRows = await queryResultRows(source, task.statsTableName, taskRun.batchId, [
    "rule_category AS ruleCategory", "rule_code AS ruleCode", "field_name AS fieldName", "total_rows AS totalRows",
    "issue_rows AS issueRows", "issue_rate AS issueRate", "metric_value AS metricValue", "baseline_value AS baselineValue",
    "threshold_value AS thresholdValue", "detected_at AS detectedAt",
  ]);
  const ruleMetadata = buildStrategyRuleMetadata(strategyVersion);
  const normalizedStats = statRows.map(mapStat).map((stat) => applyStrategyRuleMetadata(stat, ruleMetadata));
  const issueRows = normalizedStats.reduce((sum, row) => sum + Math.max(0, Number(row.issueRows || 0)), 0);
  const failedRuleCount = normalizedStats.filter((row) => Number(row.issueRows || 0) > 0).length;
  const score = scoreBatch(normalizedStats);
  const sourceSnapshot = {
    sourceId: task.sourceId,
    tableName: task.tableName,
    collectedAt: new Date().toISOString(),
    schema: (Array.isArray(profileSnapshot?.fields) ? profileSnapshot.fields : []).map((field) => ({
      columnName: String(field.columnName || ""),
      dataType: String(field.dataType || field.columnType || ""),
      isNullable: Boolean(field.isNullable),
      isPrimaryKey: Boolean(field.isPrimaryKey),
    })).filter((field) => field.columnName),
  };
  const [batchResult] = await pool.query(
    `INSERT INTO qc_result_batch
      (project_id, task_run_id, task_id, monitor_table_id, source_id, business_system_id, batch_id, run_status, evaluation_status,
       started_at, completed_at, total_rule_count, failed_rule_count, issue_rows, score, coverage_json, source_snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at), total_rule_count = VALUES(total_rule_count),
       failed_rule_count = VALUES(failed_rule_count), issue_rows = VALUES(issue_rows), score = VALUES(score),
       coverage_json = VALUES(coverage_json), source_snapshot_json = VALUES(source_snapshot_json)`,
    [projectId, taskRun.id, task.id, task.monitorTableId, task.sourceId, businessSystemId, taskRun.batchId,
      normalizedStats.some((row) => row.evaluationStatus === "not_evaluable") ? "partially_evaluable" : "evaluated",
      taskRun.startTime || new Date(), new Date(), normalizedStats.length, failedRuleCount, issueRows, score,
      JSON.stringify({ evaluatedRuleCount: normalizedStats.filter((row) => row.evaluationStatus === "evaluated").length, totalRuleCount: normalizedStats.length }),
      JSON.stringify(sourceSnapshot)]
  );
  const [batchRows] = await pool.query("SELECT id FROM qc_result_batch WHERE project_id = ? AND task_run_id = ? LIMIT 1", [projectId, taskRun.id]);
  const resultBatchId = Number(batchRows[0].id || batchResult.insertId);
  const detailRows = await queryResultRows(source, task.detailTableName, taskRun.batchId, [
    "rule_category AS ruleCategory", "rule_code AS ruleCode", "field_name AS fieldName", "pk_text AS pkText",
    "field_value_text AS fieldValueText", "issue_level AS issueLevel", "issue_message AS issueMessage", "detected_at AS detectedAt",
  ]).catch(() => []);
  const samplesByRule = new Map();
  detailRows.slice(0, 300).forEach((row) => {
    const key = `${row.ruleCategory || row.rulecategory || row.rule_category}|${row.ruleCode || row.rulecode || row.rule_code}|${row.fieldName || row.fieldname || row.field_name || ""}`;
    const bucket = samplesByRule.get(key) || [];
    if (bucket.length < 3) bucket.push(row);
    samplesByRule.set(key, bucket);
  });
  for (const stat of normalizedStats) {
    const instance = `${stat.ruleCategory}:${stat.ruleCode}:${stat.fieldName || "*"}`;
    const metricScope = stat.fieldName || "table";
    const [statResult] = await pool.query(
      `INSERT INTO qc_result_rule_stat
        (project_id, result_batch_id, monitor_table_id, business_system_id, strategy_rule_instance_id, metric_scope_key,
         rule_category, rule_code, rule_name, field_name, severity, evaluation_status, total_rows, issue_rows, issue_rate,
         metric_value, baseline_value, threshold_value, evidence_json, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_rows=VALUES(total_rows), issue_rows=VALUES(issue_rows), issue_rate=VALUES(issue_rate),
         rule_name=VALUES(rule_name), severity=VALUES(severity),
         metric_value=VALUES(metric_value), baseline_value=VALUES(baseline_value), threshold_value=VALUES(threshold_value),
         evaluation_status=VALUES(evaluation_status), evidence_json=VALUES(evidence_json), detected_at=VALUES(detected_at)`,
      [projectId, resultBatchId, task.monitorTableId, businessSystemId, instance, metricScope,
        stat.ruleCategory, stat.ruleCode, stat.ruleName || null, stat.fieldName || null, stat.issueLevel, stat.evaluationStatus,
        stat.totalRows, stat.issueRows, stat.issueRate, stat.metricValue, stat.baselineValue, stat.thresholdValue,
        JSON.stringify({ source: "quality_result_table", batchId: taskRun.batchId }), stat.detectedAt]
    );
    const [storedStats] = await pool.query(
      `SELECT id FROM qc_result_rule_stat WHERE project_id=? AND result_batch_id=? AND strategy_rule_instance_id=? AND metric_scope_key=? LIMIT 1`,
      [projectId, resultBatchId, instance, metricScope]
    );
    const statId = Number(storedStats[0]?.id || statResult.insertId);
    const sampleKey = `${stat.ruleCategory}|${stat.ruleCode}|${stat.fieldName || ""}`;
    for (const sample of samplesByRule.get(sampleKey) || []) {
      const pk = maskText(sample.pkText ?? sample.pktext ?? sample.pk_text);
      const value = maskText(sample.fieldValueText ?? sample.fieldvaluetext ?? sample.field_value_text);
      const sampleMessage = sample.issueMessage ?? sample.issuemessage ?? sample.issue_message;
      const sampleFingerprint = fingerprint([taskRun.batchId, sampleKey, pk, value, sampleMessage]);
      await pool.query(
        `INSERT IGNORE INTO qc_result_sample (project_id, result_rule_stat_id, sample_fingerprint, masked_pk_text, masked_value_text, issue_message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, statId, sampleFingerprint, pk, value, String(sampleMessage ?? "").slice(0, 1024)]
      );
    }
  }
  return { resultBatchId, ruleCount: normalizedStats.length, issueRows, score };
}

module.exports = { collectTaskRun, scoreBatch, mapStat, maskText, buildStrategyRuleMetadata, applyStrategyRuleMetadata };
