const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");
const AppError = require("../../common/errors/app-error");
const crypto = require("crypto");
const modelProviderService = require("../model-providers/model-provider.service");
const reportRenderer = require("./quality-report.renderer");

function projectIdOrThrow() {
  const projectId = Number(getCurrentProjectId() || 0);
  if (!projectId) throw new Error("未识别当前项目空间");
  return projectId;
}

function number(value) {
  return Number(value || 0);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

function limit(value, fallback = 20, max = 100) {
  return Math.max(1, Math.min(Number(value || fallback), max));
}

function dateRange(filters = {}, field = "completed_at") {
  const clauses = [];
  const params = [];
  if (filters.startAt) { clauses.push(`${field} >= ?`); params.push(new Date(String(filters.startAt))); }
  if (filters.endAt) { clauses.push(`${field} <= ?`); params.push(new Date(String(filters.endAt))); }
  return { clauses, params };
}

function shouldUseLatestBatch(filters = {}) {
  return filters.latestOnly === true || ["1", "true"].includes(String(filters.latestOnly || "").trim().toLowerCase());
}

function resultBatchSource(latestOnly) {
  if (!latestOnly) return "qc_result_batch";
  return `(SELECT ranked.*
           FROM (SELECT b.*, ROW_NUMBER() OVER (PARTITION BY b.monitor_table_id ORDER BY b.completed_at DESC, b.id DESC) AS row_no
                 FROM qc_result_batch b
                 WHERE b.project_id = ? AND b.run_status = 'completed') ranked
           WHERE ranked.row_no = 1)`;
}

function formatScore(value) {
  return value === null || value === undefined ? null : Number(Number(value).toFixed(2));
}

const OPS_RANGE_HOURS = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

function normalizeOpsRange(value) {
  return Object.prototype.hasOwnProperty.call(OPS_RANGE_HOURS, String(value)) ? String(value) : "7d";
}

function normalizeBusinessSystemId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("业务系统参数无效", 400);
  return id;
}

function isQualityIssueAdmin(user = {}) {
  const roleCode = String(user.roleCode || "").trim().toLowerCase();
  const roleType = String(user.roleType || "").trim().toLowerCase();
  return roleCode === "admin" || roleType === "admin";
}

function buildIssueAccessScope(user = {}, alias = "i") {
  if (isQualityIssueAdmin(user)) return { clause: null, params: [] };
  const userId = Number(user.id || user.sub || 0);
  if (!Number.isInteger(userId) || userId <= 0) return { clause: "1=0", params: [] };
  return { clause: `${alias}.owner_user_id=?`, params: [userId] };
}

async function resolveAssignableOwner(ownerUserId, required = false) {
  if (ownerUserId === undefined || ownerUserId === null || ownerUserId === "") {
    if (required) throw new AppError("请选择负责人", 400);
    return null;
  }
  const normalizedId = Number(ownerUserId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) throw new AppError("负责人参数无效", 400);
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.display_name AS displayName
     FROM users u
     WHERE u.id=? AND u.status='active'
     LIMIT 1`,
    [normalizedId]
  );
  if (!rows[0]) throw new AppError("负责人不存在或已停用", 400);
  return {
    id: Number(rows[0].id),
    username: rows[0].username,
    displayName: rows[0].displayName,
    ownerName: rows[0].displayName || rows[0].username,
  };
}

function importanceWeight(value) {
  return ({ critical: 1.5, high: 1.2, normal: 1, low: 0.7 })[String(value || "normal")] || 1;
}

function weightedQualityScore(rows = []) {
  const weighted = rows.reduce((result, row) => {
    if (row.score === null || row.score === undefined) return result;
    const weight = importanceWeight(row.importanceLevel);
    result.total += number(row.score) * weight;
    result.weight += weight;
    return result;
  }, { total: 0, weight: 0 });
  return weighted.weight ? round(weighted.total / weighted.weight) : null;
}

function opsRate(numerator, denominator) {
  return number(denominator) > 0 ? round((number(numerator) * 100) / number(denominator), 2) : 0;
}

function opsIssueStats(rows = []) {
  return rows.reduce((result, row) => {
    const totalRows = Math.max(0, number(row.totalRows));
    if (String(row.evaluationStatus || "evaluated") !== "evaluated" || totalRows <= 0) return result;
    result.checkedRows += totalRows;
    result.issueRows += Math.min(totalRows, Math.max(0, number(row.issueRows)));
    return result;
  }, { checkedRows: 0, issueRows: 0 });
}

function formatOpsBucket(value, range) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (range === "24h") return `${year}-${month}-${day} ${String(date.getHours()).padStart(2, "0")}:00`;
  return `${year}-${month}-${day}`;
}

function buildOpsTrend(rows = [], range = "7d") {
  const normalizedRange = normalizeOpsRange(range);
  const ordered = [...rows].sort((left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime());
  const grouped = new Map();
  ordered.forEach((row) => {
    const key = formatOpsBucket(row.completedAt, normalizedRange);
    const current = grouped.get(key) || { key, completedAt: row.completedAt, scoreTotal: 0, scoreWeight: 0, issueRows: 0, checkedRows: 0, totalRules: 0, failedRules: 0, runCount: 0 };
    const weight = importanceWeight(row.importanceLevel);
    current.scoreTotal += number(row.score) * weight;
    current.scoreWeight += weight;
    current.issueRows += number(row.issueRows);
    current.checkedRows += number(row.checkedRows);
    current.totalRules += number(row.totalRuleCount);
    current.failedRules += number(row.failedRuleCount);
    current.runCount += 1;
    current.completedAt = row.completedAt;
    grouped.set(key, current);
  });
  const buckets = [...grouped.values()].map((item) => ({
    key: item.key,
    label: normalizedRange === "24h" ? item.key.slice(11, 16) : item.key.slice(5),
    completedAt: item.completedAt,
    score: item.scoreWeight ? round(item.scoreTotal / item.scoreWeight) : null,
    anomalyRate: opsRate(item.issueRows, item.checkedRows),
    rulePassRate: opsRate(item.totalRules - item.failedRules, item.totalRules),
    issueRows: item.issueRows,
    checkedRows: item.checkedRows,
    runCount: item.runCount,
  }));
  if (buckets.length >= 3) return { mode: normalizedRange === "24h" ? "hour" : "day", points: buckets };
  const batchRows = ordered.slice(-20);
  const points = batchRows.map((row, index) => {
    return {
      key: String(row.id || index),
      label: `B${String(index + 1).padStart(2, "0")}`,
      completedAt: row.completedAt,
      objectName: row.tableName || "质量批次",
      score: formatScore(row.score),
      anomalyRate: opsRate(row.issueRows, row.checkedRows),
      rulePassRate: opsRate(number(row.totalRuleCount) - number(row.failedRuleCount), row.totalRuleCount),
      issueRows: number(row.issueRows),
      checkedRows: number(row.checkedRows),
      runCount: 1,
    };
  });
  return { mode: "batch", points };
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

const REPORT_SUMMARY_SCHEMA_VERSION = "qc-report-summary-v2";

function reportScore(summary = {}) {
  if (summary.scope === "system") return summary.score;
  if (summary.scope === "comparison") return summary.current?.score;
  return summary.batch?.score;
}

function reportIssueRows(summary = {}) {
  if (summary.scope === "system") return number(summary.issueRows);
  if (summary.scope === "comparison") return number(summary.current?.issueRows);
  return number(summary.batch?.issueRows);
}

function reportRules(summary = {}) {
  if (Array.isArray(summary.rules) && summary.rules.length) return summary.rules;
  if (Array.isArray(summary.topRules)) return summary.topRules;
  return [];
}

function reportRuleKey(rule = {}) {
  return String(rule.strategyRuleInstanceId || rule.strategy_rule_instance_id || `${rule.ruleCode || rule.rule_code || "unknown"}|${rule.fieldName || rule.field_name || ""}|${rule.metricScopeKey || rule.metric_scope_key || ""}`);
}

function compareRuleSnapshots(currentRules = [], previousRules = []) {
  const currentMap = new Map(currentRules.map((rule) => [reportRuleKey(rule), rule]));
  const previousMap = new Map(previousRules.map((rule) => [reportRuleKey(rule), rule]));
  const keys = [...new Set([...currentMap.keys(), ...previousMap.keys()])];
  const rules = keys.map((key) => {
    const current = currentMap.get(key);
    const previous = previousMap.get(key);
    const currentIssueRows = number(current?.issueRows);
    const previousIssueRows = number(previous?.issueRows);
    return {
      strategyRuleInstanceId: current?.strategyRuleInstanceId || previous?.strategyRuleInstanceId || null,
      metricScopeKey: current?.metricScopeKey || previous?.metricScopeKey || null,
      ruleCategory: current?.ruleCategory || previous?.ruleCategory,
      ruleCode: current?.ruleCode || previous?.ruleCode,
      ruleName: current?.ruleName || previous?.ruleName,
      fieldName: current?.fieldName || previous?.fieldName,
      severity: current?.severity || previous?.severity || "medium",
      currentTotalRows: number(current?.totalRows),
      previousTotalRows: number(previous?.totalRows),
      currentIssueRows,
      previousIssueRows,
      currentIssueRate: Number(current?.issueRate || 0),
      previousIssueRate: Number(previous?.issueRate || 0),
      status: !previous ? "added" : !current ? "removed" : currentIssueRows > previousIssueRows ? "worsened" : currentIssueRows < previousIssueRows ? "improved" : "stable",
    };
  }).sort((left, right) => Math.abs(right.currentIssueRows - right.previousIssueRows) - Math.abs(left.currentIssueRows - left.previousIssueRows));
  return {
    rules,
    currentRules,
    previousRules,
    ruleChanges: {
      newCount: rules.filter((row) => row.currentIssueRows > 0 && row.previousIssueRows === 0).length,
      resolvedCount: rules.filter((row) => row.currentIssueRows === 0 && row.previousIssueRows > 0).length,
      persistentCount: rules.filter((row) => row.currentIssueRows > 0 && row.previousIssueRows > 0).length,
      worsenedCount: rules.filter((row) => row.currentIssueRows > row.previousIssueRows && row.previousIssueRows > 0).length,
      improvedCount: rules.filter((row) => row.currentIssueRows < row.previousIssueRows && row.currentIssueRows > 0).length,
      addedRuleCount: rules.filter((row) => row.status === "added").length,
      removedRuleCount: rules.filter((row) => row.status === "removed").length,
    },
  };
}

function compareSystemTableSnapshots(currentTables = [], previousTables = []) {
  const keyFor = (row) => String(row.monitorTableId || `${row.systemName || ""}|${row.tableName || ""}`);
  const currentMap = new Map(currentTables.map((row) => [keyFor(row), row]));
  const previousMap = new Map(previousTables.map((row) => [keyFor(row), row]));
  return [...new Set([...currentMap.keys(), ...previousMap.keys()])].map((key) => {
    const current = currentMap.get(key);
    const previous = previousMap.get(key);
    const currentScore = current?.score ?? null;
    const previousScore = previous?.score ?? null;
    const status = !previous ? "added" : !current ? "removed" : "persistent";
    return {
      monitorTableId: Number(current?.monitorTableId || previous?.monitorTableId || 0) || null,
      tableName: current?.tableName || previous?.tableName || "-",
      systemName: current?.systemName || previous?.systemName || "-",
      previousScore,
      currentScore,
      scoreChange: currentScore === null || previousScore === null ? null : round(number(currentScore) - number(previousScore)),
      previousIssueRows: number(previous?.issueRows),
      currentIssueRows: number(current?.issueRows),
      issueRowsChange: number(current?.issueRows) - number(previous?.issueRows),
      status,
      statusLabel: status === "added" ? "新增覆盖" : status === "removed" ? "退出覆盖" : "持续覆盖",
    };
  }).sort((left, right) => {
    const statusOrder = { added: 0, removed: 1, persistent: 2 };
    return statusOrder[left.status] - statusOrder[right.status] || number(left.scoreChange) - number(right.scoreChange);
  });
}

function comparisonLevel(reasons = []) {
  return reasons.length ? { level: "conditional", levelLabel: "条件可比" } : { level: "direct", levelLabel: "直接可比" };
}

function normalizeTypeFamily(value) {
  const type = String(value || "").toLowerCase();
  if (/int|decimal|numeric|double|float|real|number/.test(type)) return "数值";
  if (/date|time|timestamp/.test(type)) return "日期时间";
  if (/bool|bit/.test(type)) return "布尔";
  if (/char|text|string|enum|json|uuid/.test(type)) return "文本";
  return type.replace(/\([^)]*\)/g, "").trim() || "未知";
}

function compareSchemaSnapshots(currentSnapshot, previousSnapshot) {
  const currentFields = Array.isArray(currentSnapshot?.schema) ? currentSnapshot.schema : [];
  const previousFields = Array.isArray(previousSnapshot?.schema) ? previousSnapshot.schema : [];
  if (!currentFields.length || !previousFields.length) {
    return { available: false, status: "baseline_collecting", added: [], removed: [], changed: [], message: "Schema 基线积累中，后续完整批次将自动比较字段变化。" };
  }
  const currentMap = new Map(currentFields.map((field) => [String(field.columnName), field]));
  const previousMap = new Map(previousFields.map((field) => [String(field.columnName), field]));
  const added = [...currentMap.keys()].filter((name) => !previousMap.has(name));
  const removed = [...previousMap.keys()].filter((name) => !currentMap.has(name));
  const changed = [...currentMap.keys()].filter((name) => previousMap.has(name)).flatMap((name) => {
    const current = currentMap.get(name) || {};
    const previous = previousMap.get(name) || {};
    const changes = [];
    if (normalizeTypeFamily(current.dataType) !== normalizeTypeFamily(previous.dataType)) changes.push(`类型：${normalizeTypeFamily(previous.dataType)} → ${normalizeTypeFamily(current.dataType)}`);
    if (Boolean(current.isNullable) !== Boolean(previous.isNullable)) changes.push(`可空性：${previous.isNullable ? "可空" : "必填"} → ${current.isNullable ? "可空" : "必填"}`);
    if (Boolean(current.isPrimaryKey) !== Boolean(previous.isPrimaryKey)) changes.push(`主键：${previous.isPrimaryKey ? "是" : "否"} → ${current.isPrimaryKey ? "是" : "否"}`);
    return changes.length ? [{ fieldName: name, changes }] : [];
  });
  return {
    available: true,
    status: added.length || removed.length || changed.length ? "changed" : "stable",
    added,
    removed,
    changed,
    message: added.length || removed.length || changed.length ? "检测到结构变化，请确认是否为预期发布。" : "本批次 Schema 与上一完整批次一致。",
  };
}

async function getOverview(filters = {}) {
  const projectId = projectIdOrThrow();
  const range = dateRange(filters);
  const latestOnly = shouldUseLatestBatch(filters);
  const batchSource = resultBatchSource(latestOnly);
  const batchSourceParams = latestOnly ? [projectId] : [];
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS batchCount, COUNT(DISTINCT monitor_table_id) AS tableCount,
            COUNT(DISTINCT CASE WHEN business_system_id IS NOT NULL THEN business_system_id END) AS systemCount,
            COALESCE(SUM(issue_rows), 0) AS issueRows, COALESCE(AVG(score), 100) AS averageScore,
            COALESCE(SUM(failed_rule_count), 0) AS failedRuleCount, MAX(completed_at) AS latestCompletedAt
     FROM ${batchSource} b
     WHERE project_id = ?${range.clauses.length ? ` AND ${range.clauses.join(" AND ")}` : ""}`,
    [...batchSourceParams, projectId, ...range.params]
  );
  const row = rows[0] || {};
  const [strategyRows] = await pool.query(
    `SELECT COUNT(*) AS monitoredTableCount,
            SUM(CASE WHEN business_system_id IS NOT NULL THEN 1 ELSE 0 END) AS systemMappedTableCount,
            SUM(CASE WHEN strategy_status = 'submitted' THEN 1 ELSE 0 END) AS submittedStrategyCount
     FROM qc_monitor_table WHERE project_id = ?`, [projectId]
  );
  const strategy = strategyRows[0] || {};
  const [trend] = await pool.query(
    `SELECT DATE(completed_at) AS day, ROUND(AVG(score), 2) AS score, SUM(issue_rows) AS issueRows, COUNT(*) AS batchCount
     FROM qc_result_batch WHERE project_id = ?${range.clauses.length ? ` AND ${range.clauses.join(" AND ")}` : ""}
     GROUP BY DATE(completed_at) ORDER BY day DESC LIMIT 14`, [projectId, ...range.params]
  );
  const [topRules] = await pool.query(
    `SELECT r.rule_category AS ruleCategory, r.rule_code AS ruleCode, SUM(r.issue_rows) AS issueRows,
            ROUND(AVG(r.issue_rate) * 100, 2) AS issueRate
     FROM qc_result_rule_stat r${latestOnly ? ` JOIN ${batchSource} b ON b.id = r.result_batch_id` : ""}
     WHERE r.project_id=?
     GROUP BY r.rule_category, r.rule_code ORDER BY issueRows DESC LIMIT 8`, [...batchSourceParams, projectId]
  );
  const [dimensions] = await pool.query(
    `SELECT r.rule_category AS ruleCategory, COUNT(*) AS ruleCount, SUM(r.issue_rows) AS issueRows
     FROM qc_result_rule_stat r${latestOnly ? ` JOIN ${batchSource} b ON b.id = r.result_batch_id` : ""}
     WHERE r.project_id=? GROUP BY rule_category ORDER BY issueRows DESC`, [...batchSourceParams, projectId]
  );
  const [issueStatus] = await pool.query(
    `SELECT issue_status AS issueStatus, COUNT(*) AS issueCount FROM qc_issue WHERE project_id=? GROUP BY issue_status`, [projectId]
  );
  const [severity] = await pool.query(
    `SELECT severity, COUNT(*) AS findingCount FROM qc_finding WHERE project_id=? GROUP BY severity`, [projectId]
  );
  const dimensionStats = new Map();
  dimensions.forEach((item) => {
    const dimensionKey = reportRenderer.dimensionKeyForRule({ ruleCategory: item.ruleCategory });
    const current = dimensionStats.get(dimensionKey) || { dimensionKey, ruleCount: 0, issueRows: 0 };
    current.ruleCount += number(item.ruleCount);
    current.issueRows += number(item.issueRows);
    dimensionStats.set(dimensionKey, current);
  });
  return {
    batchCount: number(row.batchCount), tableCount: number(row.tableCount), systemCount: number(row.systemCount),
    issueRows: number(row.issueRows), averageScore: formatScore(row.averageScore) ?? 100, failedRuleCount: number(row.failedRuleCount),
    latestCompletedAt: row.latestCompletedAt || null,
    monitoredTableCount: number(strategy.monitoredTableCount), submittedStrategyCount: number(strategy.submittedStrategyCount),
    systemMappingRate: number(strategy.monitoredTableCount) ? Number((100 * number(strategy.systemMappedTableCount) / number(strategy.monitoredTableCount)).toFixed(1)) : 0,
    trend: trend.reverse().map((item) => ({ day: item.day, score: formatScore(item.score), issueRows: number(item.issueRows), batchCount: number(item.batchCount) })),
    topRules: topRules.map((item) => ({ ...item, issueRows: number(item.issueRows), issueRate: Number(item.issueRate || 0) })),
    dimensions: [...dimensionStats.values()].map((item) => ({
      ...item,
      dimensionName: reportRenderer.DIMENSION_DEFINITIONS.find((definition) => definition.key === item.dimensionKey)?.name || "其他",
    })),
    issueStatus: issueStatus.map((item) => ({ ...item, issueCount: number(item.issueCount) })),
    severity: severity.map((item) => ({ ...item, findingCount: number(item.findingCount) })),
  };
}

function buildQualityIssueFlow(latestBatches = [], latestRuleRows = [], options = {}) {
  const batchById = new Map(latestBatches.map((row) => [number(row.id), row]));
  const firstLevelTotals = new Map();
  const useTableLevel = Boolean(options.businessSystemId);
  latestRuleRows.forEach((row) => {
    const issueRows = number(row.issueRows);
    if (!issueRows) return;
    const batch = batchById.get(number(row.resultBatchId));
    const firstLevelName = useTableLevel ? batch?.tableName || "未命名数据表" : batch?.systemName || "未归属系统";
    firstLevelTotals.set(firstLevelName, number(firstLevelTotals.get(firstLevelName)) + issueRows);
  });
  const topFirstLevels = new Set([...firstLevelTotals.entries()].sort((left, right) => right[1] - left[1]).slice(0, useTableLevel ? 6 : 5).map(([name]) => name));
  const firstLevelDimension = new Map();
  const dimensionSeverity = new Map();
  const nodeMeta = new Map();
  const severityLabels = { critical: "紧急", high: "高风险", medium: "中风险", low: "低风险" };

  latestRuleRows.forEach((row) => {
    const issueRows = number(row.issueRows);
    if (!issueRows) return;
    const batch = batchById.get(number(row.resultBatchId));
    const rawFirstLevelName = useTableLevel ? batch?.tableName || "未命名数据表" : batch?.systemName || "未归属系统";
    const firstLevelName = topFirstLevels.has(rawFirstLevelName) ? rawFirstLevelName : useTableLevel ? "其他数据表" : "其他系统";
    const dimensionKey = reportRenderer.dimensionKeyForRule(row);
    const dimensionName = reportRenderer.DIMENSION_DEFINITIONS.find((item) => item.key === dimensionKey)?.name || "其他";
    const severity = Object.prototype.hasOwnProperty.call(severityLabels, row.severity) ? row.severity : "low";
    const severityName = severityLabels[severity];
    const firstLevelNode = `${useTableLevel ? "table" : "system"}:${firstLevelName}`;
    const dimensionNode = `dimension:${dimensionKey}`;
    const severityNode = `severity:${severity}`;
    const firstKey = `${firstLevelNode}|${dimensionNode}`;
    const secondKey = `${dimensionNode}|${severityNode}`;
    firstLevelDimension.set(firstKey, number(firstLevelDimension.get(firstKey)) + issueRows);
    dimensionSeverity.set(secondKey, number(dimensionSeverity.get(secondKey)) + issueRows);
    nodeMeta.set(firstLevelNode, { key: firstLevelNode, type: useTableLevel ? "table" : "system", label: firstLevelName });
    nodeMeta.set(dimensionNode, { key: dimensionNode, type: "dimension", label: dimensionName });
    nodeMeta.set(severityNode, { key: severityNode, type: "severity", label: severityName });
  });

  const links = [...firstLevelDimension.entries(), ...dimensionSeverity.entries()].map(([key, value]) => {
    const [source, target] = key.split("|");
    return { source, target, value };
  });
  const nodeValues = new Map();
  links.forEach((link) => {
    if (link.source.startsWith("system:") || link.source.startsWith("table:")) nodeValues.set(link.source, number(nodeValues.get(link.source)) + number(link.value));
    if (link.target.startsWith("dimension:")) nodeValues.set(link.target, number(nodeValues.get(link.target)) + number(link.value));
    if (link.target.startsWith("severity:")) nodeValues.set(link.target, number(nodeValues.get(link.target)) + number(link.value));
  });
  return {
    mode: useTableLevel ? "table" : "system",
    nodes: [...nodeMeta.values()].map((item) => ({ ...item, value: number(nodeValues.get(item.key)) })),
    links,
  };
}

function buildQualityTopRules(latestRuleRows = []) {
  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  const grouped = new Map();
  latestRuleRows.forEach((row) => {
    const key = `${row.monitorTableId || "unknown"}|${row.strategyVersionId || row.strategyId || "unknown"}|${row.ruleCode || "unknown"}|${row.fieldName || ""}`;
    const current = grouped.get(key) || {
      monitorTableId: row.monitorTableId || null,
      tableName: row.tableName || "未命名数据表",
      strategyId: row.strategyId || null,
      strategyVersionId: row.strategyVersionId || null,
      strategyVersionNo: row.strategyVersionNo || null,
      taskName: row.taskName || null,
      ruleCode: row.ruleCode || "unknown",
      ruleName: row.ruleName || row.ruleCode || "未命名规则",
      fieldName: row.fieldName || null,
      severity: row.severity || "low",
      issueRows: 0,
      totalRows: 0,
    };
    current.issueRows += number(row.issueRows);
    current.totalRows += number(row.totalRows);
    if ((severityRank[row.severity] || 0) > (severityRank[current.severity] || 0)) current.severity = row.severity;
    grouped.set(key, current);
  });
  return [...grouped.values()]
    .map((item) => ({ ...item, issueRate: opsRate(item.issueRows, item.totalRows) }))
    .sort((left, right) => right.issueRows - left.issueRows || right.issueRate - left.issueRate)
    .slice(0, 8);
}

function buildOpsDimensionHealth(currentRuleRows = [], previousRuleRows = []) {
  const severityWeights = { critical: 1.5, high: 1.2, medium: 1, low: 0.7 };
  const scoreStrategyDimension = (rules = []) => {
    const evaluatedRules = rules.filter((rule) => (
      rule.evaluationStatus !== "not_evaluable"
      && rule.issueRate !== null
      && rule.issueRate !== undefined
      && Number.isFinite(Number(rule.issueRate))
    ));
    if (!evaluatedRules.length) return null;
    const weighted = evaluatedRules.reduce((result, rule) => {
      const weight = severityWeights[String(rule.severity || "medium")] || 1;
      result.penalty += Math.max(0, Math.min(1, Number(rule.issueRate))) * weight;
      result.weight += weight;
      return result;
    }, { penalty: 0, weight: 0 });
    return round(100 * (1 - weighted.penalty / Math.max(weighted.weight, 1)));
  };
  const summarize = (rules = []) => reportRenderer.DIMENSION_DEFINITIONS.map((definition) => {
    const dimensionRules = rules.filter((rule) => reportRenderer.dimensionKeyForRule(rule) === definition.key);
    const rulesByStrategy = new Map();
    dimensionRules.forEach((rule) => {
      const strategyKey = rule.strategyVersionId || rule.strategyId || rule.resultBatchId;
      if (strategyKey === null || strategyKey === undefined) return;
      const strategyRules = rulesByStrategy.get(strategyKey) || [];
      strategyRules.push(rule);
      rulesByStrategy.set(strategyKey, strategyRules);
    });
    const scores = [...rulesByStrategy.values()].map(scoreStrategyDimension).filter((score) => score !== null);
    return {
      ...definition,
      covered: scores.length > 0,
      score: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      strategyCount: scores.length,
      ruleCount: dimensionRules.length,
      failedRuleCount: dimensionRules.filter((rule) => number(rule.issueRows) > 0).length,
      checkedRows: dimensionRules.reduce((sum, rule) => sum + number(rule.totalRows), 0),
      issueRows: dimensionRules.reduce((sum, rule) => sum + number(rule.issueRows), 0),
    };
  });
  const current = summarize(currentRuleRows);
  const previous = summarize(previousRuleRows);
  return current.map((item) => {
    const previousItem = previous.find((dimension) => dimension.key === item.key);
    return {
      ...item,
      previousStrategyCount: number(previousItem?.strategyCount),
      scoreChange: item.score === null || previousItem?.score === null || previousItem?.score === undefined
        ? null
        : round(item.score - previousItem.score),
    };
  });
}

async function getOpsDashboard(filters = {}) {
  const projectId = projectIdOrThrow();
  const range = normalizeOpsRange(filters.range);
  const businessSystemId = normalizeBusinessSystemId(filters.businessSystemId);
  let scopeSystem = null;
  if (businessSystemId) {
    const [systemRows] = await pool.query(
      "SELECT id, system_name AS systemName FROM dm_business_systems WHERE id=? AND project_id=? AND status='active' LIMIT 1",
      [businessSystemId, projectId],
    );
    if (!systemRows[0]) throw new AppError("业务系统不存在或不属于当前项目空间", 400);
    scopeSystem = { businessSystemId, systemName: systemRows[0].systemName };
  }
  const systemClause = (alias) => businessSystemId ? ` AND ${alias}.business_system_id=?` : "";
  const systemParams = () => businessSystemId ? [businessSystemId] : [];
  const rangeStart = new Date(Date.now() - OPS_RANGE_HOURS[range] * 60 * 60 * 1000);
  const [coverageRows, latestTwoRows, periodBatchRows, findingRows, issueRows, issueStatusRows, severityRows, priorityIssueRows, priorityFindingRows] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS monitoredTableCount,
              SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS enabledTableCount,
              SUM(CASE WHEN strategy_status='submitted' THEN 1 ELSE 0 END) AS strategyTableCount,
              SUM(CASE WHEN business_system_id IS NOT NULL THEN 1 ELSE 0 END) AS mappedTableCount,
              SUM(CASE WHEN importance_level IN ('critical','high') THEN 1 ELSE 0 END) AS importantTableCount
       FROM qc_monitor_table mt WHERE mt.project_id=?${systemClause("mt")}`, [projectId, ...systemParams()]
    ),
    pool.query(
      `WITH ranked AS (
         SELECT b.id, b.monitor_table_id AS monitorTableId, b.business_system_id AS businessSystemId,
                b.batch_id AS batchId, b.completed_at AS completedAt, b.score, b.issue_rows AS issueRows,
                b.total_rule_count AS totalRuleCount, b.failed_rule_count AS failedRuleCount,
                b.evaluation_status AS evaluationStatus, mt.table_name AS tableName, mt.table_comment AS tableComment,
                mt.importance_level AS importanceLevel, COALESCE(bs.system_name, '未归属系统') AS systemName,
                ROW_NUMBER() OVER (PARTITION BY b.monitor_table_id ORDER BY b.completed_at DESC, b.id DESC) AS rowNo
         FROM qc_result_batch b
         JOIN qc_monitor_table mt ON mt.id=b.monitor_table_id AND mt.project_id=b.project_id
         LEFT JOIN dm_business_systems bs ON bs.id=b.business_system_id AND bs.project_id=b.project_id
         WHERE b.project_id=? AND b.run_status='completed'${systemClause("b")}
       )
       SELECT * FROM ranked WHERE rowNo <= 2 ORDER BY monitorTableId, rowNo`, [projectId, ...systemParams()]
    ),
    pool.query(
      `SELECT b.id, b.monitor_table_id AS monitorTableId, b.completed_at AS completedAt, b.score,
              COALESCE(SUM(CASE WHEN r.evaluation_status='evaluated' AND COALESCE(r.total_rows,0)>0
                                THEN LEAST(GREATEST(COALESCE(r.issue_rows,0),0), r.total_rows) ELSE 0 END),0) AS issueRows,
              b.total_rule_count AS totalRuleCount, b.failed_rule_count AS failedRuleCount,
              mt.table_name AS tableName, mt.importance_level AS importanceLevel,
              COALESCE(SUM(CASE WHEN r.evaluation_status='evaluated' AND COALESCE(r.total_rows,0)>0 THEN r.total_rows ELSE 0 END),0) AS checkedRows
       FROM qc_result_batch b
       JOIN qc_monitor_table mt ON mt.id=b.monitor_table_id AND mt.project_id=b.project_id
       LEFT JOIN qc_result_rule_stat r ON r.result_batch_id=b.id AND r.project_id=b.project_id
       WHERE b.project_id=? AND b.run_status='completed' AND b.completed_at>=?${systemClause("b")}
       GROUP BY b.id, b.monitor_table_id, b.completed_at, b.score, b.total_rule_count, b.failed_rule_count, mt.table_name, mt.importance_level
       ORDER BY b.completed_at DESC, b.id DESC LIMIT 500`, [projectId, rangeStart, ...systemParams()]
    ),
    pool.query(
      `SELECT COUNT(*) AS findingCount,
              SUM(CASE WHEN finding_status='pending_confirmation' THEN 1 ELSE 0 END) AS pendingCount,
              SUM(CASE WHEN finding_status='confirmed' THEN 1 ELSE 0 END) AS confirmedCount,
              SUM(CASE WHEN occurrence_count>1 AND finding_status NOT IN ('false_positive','ignored') THEN 1 ELSE 0 END) AS recurringCount,
              SUM(CASE WHEN severity IN ('critical','high') AND finding_status NOT IN ('false_positive','ignored') THEN 1 ELSE 0 END) AS highRiskCount,
              SUM(CASE WHEN first_seen_at>=? THEN 1 ELSE 0 END) AS newCount
       FROM qc_finding f WHERE f.project_id=?${systemClause("f")}`, [rangeStart, projectId, ...systemParams()]
    ),
    pool.query(
      `SELECT COUNT(*) AS issueCount,
              SUM(CASE WHEN i.issue_status NOT IN ('completed','ignored') THEN 1 ELSE 0 END) AS openCount,
              SUM(CASE WHEN i.issue_status IN ('completed','ignored') THEN 1 ELSE 0 END) AS closedCount,
              SUM(CASE WHEN i.issue_status NOT IN ('completed','ignored') AND i.due_date IS NOT NULL AND i.due_date<CURDATE() THEN 1 ELSE 0 END) AS overdueCount,
              SUM(CASE WHEN i.issue_status='completed' AND i.updated_at>=? THEN 1 ELSE 0 END) AS resolvedInRange,
              AVG(CASE WHEN i.issue_status='completed' THEN TIMESTAMPDIFF(HOUR, i.created_at, i.updated_at) END) AS averageResolutionHours
       FROM qc_issue i
       LEFT JOIN qc_finding f ON f.id=i.finding_id AND f.project_id=i.project_id
       WHERE i.project_id=?${systemClause("f")}`, [rangeStart, projectId, ...systemParams()]
    ),
    pool.query(
      `SELECT i.issue_status AS issueStatus, COUNT(*) AS issueCount
       FROM qc_issue i LEFT JOIN qc_finding f ON f.id=i.finding_id AND f.project_id=i.project_id
       WHERE i.project_id=?${systemClause("f")} GROUP BY i.issue_status`, [projectId, ...systemParams()]
    ),
    pool.query(
      `SELECT f.severity, COUNT(*) AS findingCount FROM qc_finding f
       WHERE f.project_id=? AND f.finding_status NOT IN ('false_positive','ignored')${systemClause("f")} GROUP BY f.severity`, [projectId, ...systemParams()]
    ),
    pool.query(
      `SELECT 'issue' AS itemType, i.id, i.issue_title AS title, i.issue_status AS status, i.severity,
              i.owner_name AS ownerName, i.due_date AS dueDate, i.updated_at AS updatedAt,
              COALESCE(f.occurrence_count,1) AS occurrenceCount, mt.table_name AS tableName,
              COALESCE(bs.system_name,'未归属系统') AS systemName
       FROM qc_issue i
       LEFT JOIN qc_finding f ON f.id=i.finding_id AND f.project_id=i.project_id
       LEFT JOIN qc_monitor_table mt ON mt.id=f.monitor_table_id
       LEFT JOIN dm_business_systems bs ON bs.id=f.business_system_id AND bs.project_id=i.project_id
       WHERE i.project_id=? AND i.issue_status NOT IN ('completed','ignored')${systemClause("f")}
       ORDER BY (i.due_date IS NOT NULL AND i.due_date<CURDATE()) DESC,
                FIELD(i.severity,'critical','high','medium','low'), COALESCE(f.occurrence_count,1) DESC, i.updated_at DESC LIMIT 8`, [projectId, ...systemParams()]
    ),
    pool.query(
      `SELECT 'finding' AS itemType, f.id, COALESCE(r.rule_name, r.rule_code, '待确认质量异常') AS title,
              f.finding_status AS status, f.severity, NULL AS ownerName, NULL AS dueDate, f.last_seen_at AS updatedAt,
              f.occurrence_count AS occurrenceCount, mt.table_name AS tableName,
              COALESCE(bs.system_name,'未归属系统') AS systemName, r.rule_code AS ruleCode, r.field_name AS fieldName
       FROM qc_finding f
       LEFT JOIN qc_result_rule_stat r ON r.id=f.result_rule_stat_id AND r.project_id=f.project_id
       LEFT JOIN qc_monitor_table mt ON mt.id=f.monitor_table_id
       LEFT JOIN dm_business_systems bs ON bs.id=f.business_system_id AND bs.project_id=f.project_id
       WHERE f.project_id=? AND f.finding_status='pending_confirmation'${systemClause("f")}
       ORDER BY FIELD(f.severity,'critical','high','medium','low'), f.occurrence_count DESC, f.last_seen_at DESC LIMIT 8`, [projectId, ...systemParams()]
    ),
  ]);

  const coverage = coverageRows[0]?.[0] || {};
  const latestTwo = latestTwoRows[0] || [];
  const latestBatches = latestTwo.filter((row) => number(row.rowNo) === 1);
  const previousBatches = latestTwo.filter((row) => number(row.rowNo) === 2);
  const latestBatchIds = latestBatches.map((row) => number(row.id)).filter(Boolean);
  const previousBatchIds = previousBatches.map((row) => number(row.id)).filter(Boolean);
  const fetchRuleRows = async (ids) => {
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT r.result_batch_id AS resultBatchId, r.monitor_table_id AS monitorTableId, r.rule_category AS ruleCategory,
              r.rule_code AS ruleCode, r.rule_name AS ruleName, r.field_name AS fieldName, r.severity,
              r.evaluation_status AS evaluationStatus, r.total_rows AS totalRows, r.issue_rows AS issueRows, r.issue_rate AS issueRate,
              mt.table_name AS tableName, t.task_name AS taskName, t.strategy_id AS strategyId,
              t.strategy_version_id AS strategyVersionId, COALESCE(sv.version_no, s.current_version_no) AS strategyVersionNo
       FROM qc_result_rule_stat r
       JOIN qc_result_batch b ON b.id=r.result_batch_id AND b.project_id=r.project_id
       JOIN qc_monitor_table mt ON mt.id=r.monitor_table_id AND mt.project_id=r.project_id
       LEFT JOIN qc_task t ON t.id=b.task_id AND t.project_id=r.project_id
       LEFT JOIN qc_strategy s ON s.id=t.strategy_id
       LEFT JOIN qc_strategy_version sv ON sv.id=t.strategy_version_id AND sv.project_id=r.project_id
       WHERE r.project_id=? AND r.result_batch_id IN (${placeholders})`, [projectId, ...ids]
    );
    return rows.map((row) => ({
      ...row,
      resultBatchId: number(row.resultBatchId),
      monitorTableId: number(row.monitorTableId),
      strategyId: row.strategyId ? number(row.strategyId) : null,
      strategyVersionId: row.strategyVersionId ? number(row.strategyVersionId) : null,
      strategyVersionNo: row.strategyVersionNo ? number(row.strategyVersionNo) : null,
      totalRows: number(row.totalRows),
      issueRows: number(row.issueRows),
      issueRate: Number(row.issueRate || 0),
    }));
  };
  const [latestRuleRows, previousRuleRows] = await Promise.all([fetchRuleRows(latestBatchIds), fetchRuleRows(previousBatchIds)]);
  const dimensionHealth = buildOpsDimensionHealth(latestRuleRows, previousRuleRows)
    .map((item) => ({ ...item, issueRate: opsRate(item.issueRows, item.checkedRows) }));

  const previousByTable = new Map(previousBatches.map((row) => [number(row.monitorTableId), row]));
  const ruleStatsByBatch = new Map();
  latestRuleRows.forEach((row) => {
    const current = ruleStatsByBatch.get(row.resultBatchId) || { checkedRows: 0, issueRows: 0 };
    const rowStats = opsIssueStats([row]);
    current.checkedRows += rowStats.checkedRows;
    current.issueRows += rowStats.issueRows;
    ruleStatsByBatch.set(row.resultBatchId, current);
  });
  const riskAssets = latestBatches.map((row) => {
    const previous = previousByTable.get(number(row.monitorTableId));
    const stats = ruleStatsByBatch.get(number(row.id)) || { checkedRows: 0, issueRows: 0 };
    const score = formatScore(row.score);
    return {
      monitorTableId: number(row.monitorTableId),
      tableName: row.tableName,
      systemName: row.systemName,
      importanceLevel: row.importanceLevel || "normal",
      score,
      scoreChange: previous?.score === null || previous?.score === undefined || score === null ? null : round(score - number(previous.score)),
      anomalyRate: opsRate(stats.issueRows, stats.checkedRows),
      rulePassRate: opsRate(number(row.totalRuleCount) - number(row.failedRuleCount), row.totalRuleCount),
      failedRuleCount: number(row.failedRuleCount),
      issueRows: number(row.issueRows),
      completedAt: row.completedAt,
      status: score === null ? "unknown" : score < 70 ? "risk" : score < 85 ? "attention" : score < 95 ? "good" : "excellent",
    };
  }).sort((left, right) => number(left.score) - number(right.score) || right.anomalyRate - left.anomalyRate).slice(0, 8);

  const monitoredTableCount = number(coverage.monitoredTableCount);
  const strategyTableCount = number(coverage.strategyTableCount);
  const mappedTableCount = number(coverage.mappedTableCount);
  const resultTableCount = latestBatches.length;
  const importantTableCount = number(coverage.importantTableCount);
  const importantCoveredCount = latestBatches.filter((row) => ["critical", "high"].includes(String(row.importanceLevel))).length;
  const totalRules = latestBatches.reduce((sum, row) => sum + number(row.totalRuleCount), 0);
  const failedRules = latestBatches.reduce((sum, row) => sum + number(row.failedRuleCount), 0);
  const latestIssueStats = opsIssueStats(latestRuleRows);
  const checkedRows = latestIssueStats.checkedRows;
  const anomalyHits = latestIssueStats.issueRows;
  const overallScore = weightedQualityScore(latestBatches);
  const previousScore = weightedQualityScore(previousBatches);
  const findings = findingRows[0]?.[0] || {};
  const issueSummary = issueRows[0]?.[0] || {};
  const issueCount = number(issueSummary.issueCount);
  const closedIssueCount = number(issueSummary.closedCount);
  const priorityItems = [...(priorityIssueRows[0] || []), ...(priorityFindingRows[0] || [])]
    .sort((left, right) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const leftOverdue = left.dueDate && new Date(left.dueDate).getTime() < Date.now() ? 0 : 1;
      const rightOverdue = right.dueDate && new Date(right.dueDate).getTime() < Date.now() ? 0 : 1;
      return leftOverdue - rightOverdue || (severityOrder[left.severity] ?? 9) - (severityOrder[right.severity] ?? 9) || number(right.occurrenceCount) - number(left.occurrenceCount);
    }).slice(0, 8).map((item) => ({ ...item, id: number(item.id), occurrenceCount: number(item.occurrenceCount), overdue: Boolean(item.dueDate && new Date(item.dueDate).getTime() < Date.now()) }));
  const trend = buildOpsTrend(periodBatchRows[0] || [], range);

  return {
    generatedAt: new Date().toISOString(),
    scope: scopeSystem ? { type: "system", ...scopeSystem } : { type: "project", businessSystemId: null, systemName: null },
    snapshotAt: latestBatches.reduce((latest, row) => !latest || new Date(row.completedAt) > new Date(latest) ? row.completedAt : latest, null),
    range,
    trendMode: trend.mode,
    health: {
      overallScore,
      scoreChange: overallScore === null || previousScore === null ? null : round(overallScore - previousScore),
      grade: overallScore === null ? "unknown" : overallScore >= 95 ? "excellent" : overallScore >= 85 ? "good" : overallScore >= 70 ? "attention" : "risk",
      rulePassRate: opsRate(totalRules - failedRules, totalRules),
      anomalyRate: opsRate(anomalyHits, checkedRows),
      totalRules,
      failedRules,
      checkedRows,
      anomalyHits,
    },
    coverage: {
      monitoredTableCount,
      enabledTableCount: number(coverage.enabledTableCount),
      strategyTableCount,
      strategyCoverageRate: opsRate(strategyTableCount, monitoredTableCount),
      resultTableCount,
      resultCoverageRate: opsRate(resultTableCount, monitoredTableCount),
      mappedTableCount,
      mappingRate: opsRate(mappedTableCount, monitoredTableCount),
      importantTableCount,
      importantCoveredCount,
      importantCoverageRate: opsRate(importantCoveredCount, importantTableCount),
      uncoveredTableCount: Math.max(0, monitoredTableCount - resultTableCount),
      unconfiguredTableCount: Math.max(0, monitoredTableCount - strategyTableCount),
      unmappedTableCount: Math.max(0, monitoredTableCount - mappedTableCount),
    },
    issues: {
      findingCount: number(findings.findingCount),
      pendingFindingCount: number(findings.pendingCount),
      confirmedFindingCount: number(findings.confirmedCount),
      recurringFindingCount: number(findings.recurringCount),
      highRiskFindingCount: number(findings.highRiskCount),
      newFindingCount: number(findings.newCount),
      issueCount,
      openIssueCount: number(issueSummary.openCount),
      closedIssueCount,
      overdueIssueCount: number(issueSummary.overdueCount),
      resolvedInRange: number(issueSummary.resolvedInRange),
      closureRate: issueCount ? opsRate(closedIssueCount, issueCount) : 0,
      averageResolutionHours: issueSummary.averageResolutionHours === null ? null : round(issueSummary.averageResolutionHours, 1),
      status: (issueStatusRows[0] || []).map((row) => ({ issueStatus: row.issueStatus, issueCount: number(row.issueCount) })),
      severity: (severityRows[0] || []).map((row) => ({ severity: row.severity, findingCount: number(row.findingCount) })),
    },
    dimensions: dimensionHealth,
    trend: trend.points,
    issueFlow: buildQualityIssueFlow(latestBatches, latestRuleRows, { businessSystemId }),
    topRules: buildQualityTopRules(latestRuleRows),
    riskAssets,
    priorityItems,
    scale: { runCount: (periodBatchRows[0] || []).length, systemCount: businessSystemId ? 1 : new Set(latestBatches.map((row) => row.businessSystemId).filter(Boolean)).size },
  };
}

const OPS_DRILLDOWN_SCENES = new Set([
  "overview", "rule_pass", "anomaly_rate", "result_coverage", "pending_findings", "open_issues",
  "dimension", "findings", "issues", "governance", "low_score_tables", "failed_rules",
  "recurring_findings", "overdue_issues", "uncovered_tables", "average_resolution", "top_rules",
  "top_rule", "risk_systems", "risk_system", "risk_tables", "risk_table", "priority_item",
  "system_tables", "period_runs", "anomaly_hits",
]);

function normalizeOpsDrilldownScene(value) {
  const scene = String(value || "overview").trim();
  if (!OPS_DRILLDOWN_SCENES.has(scene)) throw new AppError("不支持的质量指标下钻场景", 400);
  return scene;
}

function opsRangeLabel(range) {
  return ({ "24h": "近24小时", "7d": "近7天", "30d": "近30天" })[normalizeOpsRange(range)];
}

function opsDrilldownColumns(kind) {
  const columns = {
    table: [
      { key: "tableName", title: "数据表" }, { key: "systemName", title: "所属系统" },
      { key: "strategyStatusLabel", title: "策略状态" }, { key: "resultStatusLabel", title: "结果状态" },
      { key: "score", title: "质量得分", format: "score" }, { key: "failedRuleCount", title: "失败规则" },
      { key: "issueRows", title: "问题行" }, { key: "completedAt", title: "最新运行", format: "datetime" },
    ],
    rule: [
      { key: "tableName", title: "数据表" }, { key: "systemName", title: "所属系统" },
      { key: "strategyName", title: "质量策略" }, { key: "ruleName", title: "规则" },
      { key: "fieldName", title: "字段" }, { key: "dimensionName", title: "质量维度" },
      { key: "evaluationStatusLabel", title: "评估状态" }, { key: "severityLabel", title: "级别" }, { key: "totalRows", title: "检查记录" },
      { key: "issueRows", title: "问题记录" }, { key: "issueRate", title: "异常率", format: "percent" },
      { key: "detectedAt", title: "检测时间", format: "datetime" },
    ],
    finding: [
      { key: "tableName", title: "数据表" }, { key: "systemName", title: "所属系统" },
      { key: "ruleName", title: "规则" }, { key: "fieldName", title: "字段" },
      { key: "findingStatusLabel", title: "异常状态" }, { key: "severityLabel", title: "级别" },
      { key: "occurrenceCount", title: "出现次数" }, { key: "issueRows", title: "问题记录" },
      { key: "lastSeenAt", title: "最近发现", format: "datetime" },
    ],
    issue: [
      { key: "issueTitle", title: "问题" }, { key: "tableName", title: "数据表" },
      { key: "systemName", title: "所属系统" }, { key: "issueStatusLabel", title: "处置状态" },
      { key: "severityLabel", title: "级别" }, { key: "ownerName", title: "负责人" },
      { key: "occurrenceCount", title: "出现次数" }, { key: "dueDate", title: "截止日期", format: "date" },
      { key: "resolutionHours", title: "处置耗时", format: "hours" }, { key: "updatedAt", title: "更新时间", format: "datetime" },
    ],
    system: [
      { key: "systemName", title: "业务系统" }, { key: "tableCount", title: "有结果表" },
      { key: "batchCount", title: "最新批次" }, { key: "issueRows", title: "问题行" },
      { key: "score", title: "质量得分", format: "score" }, { key: "latestCompletedAt", title: "最新运行", format: "datetime" },
    ],
    run: [
      { key: "batchId", title: "运行批次" }, { key: "tableName", title: "数据表" },
      { key: "systemName", title: "所属系统" }, { key: "score", title: "质量得分", format: "score" },
      { key: "failedRuleCount", title: "失败规则" }, { key: "issueRows", title: "问题行" },
      { key: "completedAt", title: "完成时间", format: "datetime" },
    ],
  };
  return columns[kind] || [];
}

async function getOpsDrilldown(filters = {}) {
  const projectId = projectIdOrThrow();
  const scene = normalizeOpsDrilldownScene(filters.scene);
  const range = normalizeOpsRange(filters.range);
  const businessSystemId = normalizeBusinessSystemId(filters.businessSystemId);
  const dashboard = await getOpsDashboard({ range, businessSystemId });
  const selectedSystemId = normalizeBusinessSystemId(filters.targetBusinessSystemId || filters.businessSystemId);
  const monitorTableId = Number(filters.monitorTableId || 0) || null;
  const strategyVersionId = Number(filters.strategyVersionId || 0) || null;
  const itemId = Number(filters.itemId || 0) || null;
  const itemType = String(filters.itemType || "").trim();
  const ruleCode = String(filters.ruleCode || "").trim();
  const fieldName = String(filters.fieldName || "").trim();
  const dimension = String(filters.dimension || "").trim();
  const rangeStart = new Date(Date.now() - OPS_RANGE_HOURS[range] * 60 * 60 * 1000);
  const scopeName = dashboard.scope?.systemName || "全部系统";
  const base = { scene, range, rangeLabel: opsRangeLabel(range), scopeName, generatedAt: dashboard.generatedAt };
  const severityLabels = { critical: "严重", high: "高", medium: "中", low: "低" };
  const findingStatusLabels = { pending_confirmation: "待确认", confirmed: "已确认", expected_change: "预期变化", false_positive: "误报", ignored: "已忽略" };
  const issueStatusLabels = { pending: "待处理", processing: "处理中", verifying: "待验证", completed: "已完成", ignored: "已忽略", reopened: "已重开" };
  const withSystem = (alias, params) => {
    if (!businessSystemId) return "";
    params.push(businessSystemId);
    return ` AND ${alias}.business_system_id=?`;
  };
  const tableRows = async () => {
    const params = [projectId, projectId];
    const systemSql = withSystem("mt", params);
    const [rows] = await pool.query(
      `WITH ranked AS (
         SELECT b.*, ROW_NUMBER() OVER (PARTITION BY b.monitor_table_id ORDER BY b.completed_at DESC, b.id DESC) AS row_no
         FROM qc_result_batch b WHERE b.project_id=? AND b.run_status='completed'
       )
       SELECT mt.id AS monitorTableId, mt.table_name AS tableName, mt.table_comment AS tableComment,
              mt.business_system_id AS businessSystemId, COALESCE(bs.system_name,'未归属系统') AS systemName,
              mt.strategy_status AS strategyStatus, mt.importance_level AS importanceLevel,
              b.id AS resultBatchId, b.batch_id AS batchId, b.score, b.failed_rule_count AS failedRuleCount,
              b.total_rule_count AS totalRuleCount, b.issue_rows AS issueRows, b.completed_at AS completedAt
       FROM qc_monitor_table mt
       LEFT JOIN ranked b ON b.monitor_table_id=mt.id AND b.row_no=1
       LEFT JOIN dm_business_systems bs ON bs.id=mt.business_system_id AND bs.project_id=mt.project_id
       WHERE mt.project_id=?${systemSql}
       ORDER BY (b.id IS NULL) DESC, b.score ASC, mt.table_name ASC`, params
    );
    return rows.map((row) => ({
      ...row, monitorTableId: number(row.monitorTableId), businessSystemId: row.businessSystemId ? number(row.businessSystemId) : null,
      resultBatchId: row.resultBatchId ? number(row.resultBatchId) : null, score: formatScore(row.score),
      failedRuleCount: number(row.failedRuleCount), totalRuleCount: number(row.totalRuleCount), issueRows: number(row.issueRows),
      strategyStatusLabel: row.strategyStatus === "submitted" ? "已配置" : "未配置",
      resultStatusLabel: row.resultBatchId ? "已有最新结果" : "未覆盖",
    }));
  };
  const ruleRows = async () => {
    const params = [projectId];
    const systemSql = withSystem("b", params);
    params.push(projectId);
    const [rows] = await pool.query(
      `WITH ranked AS (
         SELECT b.id, ROW_NUMBER() OVER (PARTITION BY b.monitor_table_id ORDER BY b.completed_at DESC, b.id DESC) AS row_no
         FROM qc_result_batch b WHERE b.project_id=? AND b.run_status='completed'${systemSql}
       )
       SELECT r.id, r.result_batch_id AS resultBatchId, r.monitor_table_id AS monitorTableId,
              r.rule_category AS ruleCategory, r.rule_code AS ruleCode, r.rule_name AS rawRuleName,
              r.field_name AS fieldName, r.severity, r.evaluation_status AS evaluationStatus,
              r.total_rows AS totalRows, r.issue_rows AS issueRows, r.detected_at AS detectedAt,
              mt.table_name AS tableName, COALESCE(bs.system_name,'未归属系统') AS systemName,
              t.task_name AS strategyName, t.strategy_version_id AS strategyVersionId,
              COALESCE(sv.version_no,s.current_version_no) AS strategyVersionNo
       FROM ranked latest
       JOIN qc_result_rule_stat r ON r.result_batch_id=latest.id AND r.project_id=?
       JOIN qc_result_batch b ON b.id=r.result_batch_id AND b.project_id=r.project_id
       JOIN qc_monitor_table mt ON mt.id=r.monitor_table_id AND mt.project_id=r.project_id
       LEFT JOIN dm_business_systems bs ON bs.id=b.business_system_id AND bs.project_id=b.project_id
       LEFT JOIN qc_task t ON t.id=b.task_id AND t.project_id=b.project_id
       LEFT JOIN qc_strategy s ON s.id=t.strategy_id
       LEFT JOIN qc_strategy_version sv ON sv.id=t.strategy_version_id AND sv.project_id=t.project_id
       WHERE latest.row_no=1
       ORDER BY r.issue_rows DESC, r.detected_at DESC, r.id DESC`, params
    );
    return rows.map((row) => {
      const definition = reportRenderer.DIMENSION_DEFINITIONS.find((item) => item.key === reportRenderer.dimensionKeyForRule(row));
      return {
        ...row, id: number(row.id), resultBatchId: number(row.resultBatchId), monitorTableId: number(row.monitorTableId),
        strategyVersionId: row.strategyVersionId ? number(row.strategyVersionId) : null, strategyVersionNo: row.strategyVersionNo ? number(row.strategyVersionNo) : null,
        totalRows: number(row.totalRows), issueRows: number(row.issueRows), issueRate: opsRate(row.issueRows, row.totalRows),
        dimensionKey: definition?.key || "other", dimensionName: definition?.name || "其他",
        ruleName: row.rawRuleName || row.ruleCode || "质量规则", fieldName: row.fieldName || "整表",
        evaluationStatusLabel: row.evaluationStatus === "evaluated" ? "已评估" : "不可评估",
        severityLabel: severityLabels[row.severity] || "其他",
      };
    });
  };
  const findingRows = async () => {
    const params = [projectId];
    const systemSql = withSystem("f", params);
    const [rows] = await pool.query(
      `SELECT f.id, f.monitor_table_id AS monitorTableId, f.business_system_id AS businessSystemId,
              f.finding_status AS findingStatus, f.severity, f.first_seen_at AS firstSeenAt,
              f.last_seen_at AS lastSeenAt, f.occurrence_count AS occurrenceCount,
              mt.table_name AS tableName, COALESCE(bs.system_name,'未归属系统') AS systemName,
              r.rule_name AS rawRuleName, r.rule_code AS ruleCode, r.field_name AS fieldName,
              r.issue_rows AS issueRows, r.issue_rate AS rawIssueRate
       FROM qc_finding f
       LEFT JOIN qc_monitor_table mt ON mt.id=f.monitor_table_id AND mt.project_id=f.project_id
       LEFT JOIN dm_business_systems bs ON bs.id=f.business_system_id AND bs.project_id=f.project_id
       LEFT JOIN qc_result_rule_stat r ON r.id=f.result_rule_stat_id AND r.project_id=f.project_id
       WHERE f.project_id=?${systemSql} ORDER BY f.last_seen_at DESC, f.id DESC`, params
    );
    return rows.map((row) => ({
      ...row, id: number(row.id), monitorTableId: row.monitorTableId ? number(row.monitorTableId) : null,
      businessSystemId: row.businessSystemId ? number(row.businessSystemId) : null, occurrenceCount: number(row.occurrenceCount),
      issueRows: number(row.issueRows), issueRate: round(number(row.rawIssueRate) * 100),
      ruleName: row.rawRuleName || row.ruleCode || "质量规则", fieldName: row.fieldName || "整表",
      severityLabel: severityLabels[row.severity] || "其他", findingStatusLabel: findingStatusLabels[row.findingStatus] || "其他",
    }));
  };
  const issueRows = async () => {
    const params = [projectId];
    const systemSql = withSystem("f", params);
    const [rows] = await pool.query(
      `SELECT i.id, i.issue_title AS issueTitle, i.issue_status AS issueStatus, i.severity,
              i.owner_name AS ownerName, i.due_date AS dueDate, i.created_at AS createdAt, i.updated_at AS updatedAt,
              f.business_system_id AS businessSystemId, f.monitor_table_id AS monitorTableId,
              COALESCE(f.occurrence_count,1) AS occurrenceCount, mt.table_name AS tableName,
              COALESCE(bs.system_name,'未归属系统') AS systemName,
              CASE WHEN i.issue_status='completed' THEN TIMESTAMPDIFF(HOUR,i.created_at,i.updated_at) ELSE NULL END AS resolutionHours
       FROM qc_issue i
       LEFT JOIN qc_finding f ON f.id=i.finding_id AND f.project_id=i.project_id
       LEFT JOIN qc_monitor_table mt ON mt.id=f.monitor_table_id AND mt.project_id=f.project_id
       LEFT JOIN dm_business_systems bs ON bs.id=f.business_system_id AND bs.project_id=f.project_id
       WHERE i.project_id=?${systemSql} ORDER BY i.updated_at DESC, i.id DESC`, params
    );
    return rows.map((row) => ({
      ...row, id: number(row.id), monitorTableId: row.monitorTableId ? number(row.monitorTableId) : null,
      businessSystemId: row.businessSystemId ? number(row.businessSystemId) : null, occurrenceCount: number(row.occurrenceCount),
      resolutionHours: row.resolutionHours === null ? null : number(row.resolutionHours), ownerName: row.ownerName || "未指定",
      severityLabel: severityLabels[row.severity] || "其他", issueStatusLabel: issueStatusLabels[row.issueStatus] || "其他",
    }));
  };
  const result = (title, metricValue, metricUnit, kind, rows, summary) => ({
    ...base, title, metricValue, metricUnit, total: rows.length, summary, columns: opsDrilldownColumns(kind), rows,
  });

  if (["overview", "result_coverage", "governance", "low_score_tables", "uncovered_tables", "risk_tables", "risk_table", "system_tables"].includes(scene)) {
    let rows = await tableRows();
    if (scene === "overview") rows = rows.filter((row) => row.resultBatchId);
    if (scene === "low_score_tables") rows = rows.filter((row) => row.score !== null && row.score < 85);
    if (scene === "uncovered_tables") rows = rows.filter((row) => !row.resultBatchId);
    if (scene === "risk_tables") rows = rows.filter((row) => row.resultBatchId);
    if (scene === "risk_table" && monitorTableId) rows = rows.filter((row) => row.monitorTableId === monitorTableId);
    if (scene === "system_tables" && selectedSystemId) rows = rows.filter((row) => row.businessSystemId === selectedSystemId);
    const configs = {
      overview: ["当前质量状态", dashboard.health.overallScore, "分", "最新批次按表重要级别加权，明细只展示与大屏相同的最新结果。"],
      result_coverage: ["结果覆盖率", dashboard.coverage.resultCoverageRate, "%", `${dashboard.coverage.resultTableCount}/${dashboard.coverage.monitoredTableCount} 张纳管表已有最新结果。`],
      governance: ["治理覆盖明细", dashboard.coverage.monitoredTableCount, "张", "展示当前系统范围内全部纳管表、策略配置和结果覆盖状态。"],
      low_score_tables: ["低分数据表", rows.length, "张", "低分表口径为最新质量得分低于85分。"],
      uncovered_tables: ["未覆盖表", dashboard.coverage.uncoveredTableCount, "张", "未覆盖表指纳管范围内尚无成功质量结果的表。"],
      risk_tables: ["重点风险对象", rows.length, "张", "按最新批次质量得分从低到高展示。"],
      risk_table: ["风险对象详情", rows[0]?.score ?? null, "分", "已定位到所点击的数据表及其最新质量结果。"],
      system_tables: ["纳管数据表", rows.length, "张", "展示所选系统当前纳管的全部数据表。"],
    };
    const config = configs[scene];
    return result(config[0], config[1], config[2], "table", rows, config[3]);
  }

  if (["rule_pass", "anomaly_rate", "dimension", "failed_rules", "top_rules", "top_rule", "anomaly_hits"].includes(scene)) {
    let rows = await ruleRows();
    if (scene === "dimension" && dimension) rows = rows.filter((row) => row.dimensionKey === dimension);
    if (["failed_rules", "top_rules", "top_rule", "anomaly_hits"].includes(scene)) rows = rows.filter((row) => row.issueRows > 0);
    if (scene === "top_rule") rows = rows.filter((row) => (!monitorTableId || row.monitorTableId === monitorTableId)
      && (!strategyVersionId || row.strategyVersionId === strategyVersionId) && (!ruleCode || row.ruleCode === ruleCode)
      && (!fieldName || row.fieldName === fieldName || (fieldName === "整表" && row.fieldName === "整表")));
    const dimensionMetric = dashboard.dimensions.find((item) => item.key === dimension);
    const configs = {
      rule_pass: ["规则通过率", dashboard.health.rulePassRate, "%", `${dashboard.health.totalRules - dashboard.health.failedRules}/${dashboard.health.totalRules} 条最新批次规则通过。`],
      anomaly_rate: ["异常命中率", dashboard.health.anomalyRate, "%", `${dashboard.health.anomalyHits}/${dashboard.health.checkedRows} 条检查记录命中异常。`],
      dimension: [`${dimensionMetric?.name || "六维质量"}健康度`, dimensionMetric ? dimensionMetric.score : dashboard.dimensions.length, dimensionMetric ? "分" : "个维度", "维度分数按每个策略内规则加权得分计算，再对覆盖该维度的策略等权平均。"],
      failed_rules: ["失败规则", dashboard.health.failedRules, "条", "仅展示最新批次中问题记录数大于0的规则。"],
      top_rules: ["问题规则明细", rows.length, "条", "按最新批次问题记录数降序展示，并明确数据表、策略、规则和字段。"],
      top_rule: ["问题规则详情", rows.reduce((sum, row) => sum + row.issueRows, 0), "条", "已按所点击的数据表、策略版本、规则和字段精确定位。"],
      anomaly_hits: ["异常命中记录", dashboard.health.anomalyHits, "条", "展示产生异常命中的最新批次规则，指标值为各规则问题记录数之和。"],
    };
    const config = configs[scene];
    return result(config[0], config[1], config[2], "rule", rows, config[3]);
  }

  if (["pending_findings", "findings", "recurring_findings"].includes(scene) || (scene === "priority_item" && itemType === "finding")) {
    let rows = await findingRows();
    if (scene === "pending_findings") rows = rows.filter((row) => row.findingStatus === "pending_confirmation");
    if (scene === "recurring_findings") rows = rows.filter((row) => row.occurrenceCount > 1 && !["false_positive", "ignored"].includes(row.findingStatus));
    if (scene === "priority_item" && itemId) rows = rows.filter((row) => row.id === itemId);
    const configs = {
      pending_findings: ["待确认异常", dashboard.issues.pendingFindingCount, "项", "展示异常事实，不再混用问题工单。"],
      findings: ["异常识别明细", dashboard.issues.findingCount, "项", "展示全部异常事实及当前确认状态。"],
      recurring_findings: ["重复异常", dashboard.issues.recurringFindingCount, "项", "复发口径为出现次数大于1且未标记误报或忽略的异常。"],
      priority_item: ["优先异常详情", rows.length, "项", "已定位到所点击的异常事实。"],
    };
    const config = configs[scene];
    return result(config[0], config[1], config[2], "finding", rows, config[3]);
  }

  if (["open_issues", "issues", "overdue_issues", "average_resolution"].includes(scene) || scene === "priority_item") {
    let rows = await issueRows();
    if (scene === "open_issues") rows = rows.filter((row) => !["completed", "ignored"].includes(row.issueStatus));
    if (scene === "overdue_issues") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      rows = rows.filter((row) => !["completed", "ignored"].includes(row.issueStatus) && row.dueDate && new Date(row.dueDate).getTime() < today.getTime());
    }
    if (scene === "average_resolution") rows = rows.filter((row) => row.issueStatus === "completed");
    if (scene === "priority_item" && itemId) rows = rows.filter((row) => row.id === itemId);
    const configs = {
      open_issues: ["待处置问题", dashboard.issues.openIssueCount, "项", "展示未完成且未忽略的问题工单。"],
      issues: ["问题处置明细", dashboard.issues.issueCount, "项", "展示全部问题工单及当前处置状态。"],
      overdue_issues: ["超期问题", dashboard.issues.overdueIssueCount, "项", "超期口径为未闭环且截止日期早于今天。"],
      average_resolution: ["平均处置耗时", dashboard.issues.averageResolutionHours, "小时", "仅按已完成问题从创建到完成更新时间计算。"],
      priority_item: ["优先问题详情", rows.length, "项", "已定位到所点击的问题工单。"],
    };
    const config = configs[scene];
    return result(config[0], config[1], config[2], "issue", rows, config[3]);
  }

  if (["risk_systems", "risk_system"].includes(scene)) {
    let rows = await listSystemQuality({ latestOnly: true, businessSystemId });
    if (scene === "risk_system" && selectedSystemId) rows = rows.filter((row) => row.businessSystemId === selectedSystemId);
    return result(scene === "risk_system" ? "高风险系统详情" : "高风险系统", scene === "risk_system" ? (rows[0]?.score ?? null) : rows.length, scene === "risk_system" ? "分" : "个", "system", rows, "系统得分与大屏一致，均基于各表最新成功批次。" );
  }

  if (scene === "period_runs") {
    const params = [projectId, rangeStart];
    const systemSql = withSystem("b", params);
    const [rows] = await pool.query(
      `SELECT b.id, b.batch_id AS batchId, b.monitor_table_id AS monitorTableId, b.score,
              b.failed_rule_count AS failedRuleCount, b.issue_rows AS issueRows, b.completed_at AS completedAt,
              mt.table_name AS tableName, COALESCE(bs.system_name,'未归属系统') AS systemName
       FROM qc_result_batch b JOIN qc_monitor_table mt ON mt.id=b.monitor_table_id AND mt.project_id=b.project_id
       LEFT JOIN dm_business_systems bs ON bs.id=b.business_system_id AND bs.project_id=b.project_id
       WHERE b.project_id=? AND b.run_status='completed' AND b.completed_at>=?${systemSql}
       ORDER BY b.completed_at DESC, b.id DESC LIMIT 500`, params
    );
    const normalized = rows.map((row) => ({ ...row, id: number(row.id), monitorTableId: number(row.monitorTableId), score: formatScore(row.score), failedRuleCount: number(row.failedRuleCount), issueRows: number(row.issueRows) }));
    return result("本期运行", dashboard.scale.runCount, "次", "run", normalized, `仅展示${opsRangeLabel(range)}内完成的质量运行批次。`);
  }

  throw new AppError("质量指标下钻场景尚未实现", 400);
}

async function listSystemQuality(filters = {}) {
  const projectId = projectIdOrThrow();
  const range = dateRange(filters, "b.completed_at");
  const latestOnly = shouldUseLatestBatch(filters);
  const batchSource = resultBatchSource(latestOnly);
  const batchSourceParams = latestOnly ? [projectId] : [];
  const where = ["b.project_id = ?", ...range.clauses];
  const params = [projectId, ...range.params];
  const businessSystemId = normalizeBusinessSystemId(filters.businessSystemId);
  if (businessSystemId) { where.push("b.business_system_id = ?"); params.push(businessSystemId); }
  const [rows] = await pool.query(
    `SELECT b.business_system_id AS businessSystemId, COALESCE(s.system_name, '未归属系统') AS systemName,
            COUNT(DISTINCT b.monitor_table_id) AS tableCount, COUNT(*) AS batchCount, SUM(b.issue_rows) AS issueRows,
            ROUND(AVG(b.score), 2) AS score, MAX(b.completed_at) AS latestCompletedAt,
            SUM(CASE WHEN b.evaluation_status <> 'evaluated' THEN 1 ELSE 0 END) AS partialBatchCount
     FROM ${batchSource} b
     LEFT JOIN dm_business_systems s ON s.id = b.business_system_id AND s.project_id = b.project_id
     WHERE ${where.join(" AND ")}
     GROUP BY b.business_system_id, s.system_name
     ORDER BY score ASC, issueRows DESC LIMIT ?`, [...batchSourceParams, ...params, limit(filters.limit, 30)]
  );
  return rows.map((row) => ({ ...row, businessSystemId: row.businessSystemId ? Number(row.businessSystemId) : null, tableCount: number(row.tableCount), batchCount: number(row.batchCount), issueRows: number(row.issueRows), score: formatScore(row.score), partialBatchCount: number(row.partialBatchCount) }));
}

async function listTableQuality(filters = {}) {
  const projectId = projectIdOrThrow();
  const latestOnly = shouldUseLatestBatch(filters);
  const batchSource = resultBatchSource(latestOnly);
  const batchSourceParams = latestOnly ? [projectId] : [];
  const where = ["b.project_id = ?"];
  const params = [projectId];
  const businessSystemId = normalizeBusinessSystemId(filters.businessSystemId);
  if (businessSystemId) { where.push("b.business_system_id = ?"); params.push(businessSystemId); }
  if (filters.keyword) { where.push("(mt.table_name LIKE ? OR mt.table_comment LIKE ?)"); params.push(`%${filters.keyword}%`, `%${filters.keyword}%`); }
  const [rows] = await pool.query(
    `SELECT b.monitor_table_id AS monitorTableId, mt.table_name AS tableName, mt.table_comment AS tableComment,
            b.business_system_id AS businessSystemId, COALESCE(s.system_name, '未归属系统') AS systemName,
            COUNT(*) AS batchCount, SUM(b.issue_rows) AS issueRows, ROUND(AVG(b.score), 2) AS score,
            MAX(b.completed_at) AS latestCompletedAt, GROUP_CONCAT(DISTINCT tag.tag_name ORDER BY tag.tag_name SEPARATOR '、') AS tags
     FROM ${batchSource} b JOIN qc_monitor_table mt ON mt.id = b.monitor_table_id
     LEFT JOIN dm_business_systems s ON s.id = b.business_system_id AND s.project_id = b.project_id
     LEFT JOIN qc_monitor_table_tag_relation rel ON rel.monitor_table_id = mt.id AND rel.project_id = b.project_id
     LEFT JOIN qc_quality_tag tag ON tag.id = rel.tag_id AND tag.project_id = b.project_id
     WHERE ${where.join(" AND ")}
     GROUP BY b.monitor_table_id, mt.table_name, mt.table_comment, b.business_system_id, s.system_name
     ORDER BY score ASC, issueRows DESC LIMIT ?`, [...batchSourceParams, ...params, limit(filters.limit, 50)]
  );
  return rows.map((row) => ({ ...row, monitorTableId: Number(row.monitorTableId), businessSystemId: row.businessSystemId ? Number(row.businessSystemId) : null, batchCount: number(row.batchCount), issueRows: number(row.issueRows), score: formatScore(row.score), tags: row.tags ? String(row.tags).split("、") : [] }));
}

async function listTableBatches(filters = {}) {
  const projectId = projectIdOrThrow();
  const monitorTableId = Number(filters.monitorTableId || 0);
  if (!monitorTableId) throw new Error("请选择监控表");
  const [rows] = await pool.query(
    `SELECT b.id, b.batch_id AS batchId, b.completed_at AS completedAt, b.score, b.issue_rows AS issueRows,
            b.failed_rule_count AS failedRuleCount, b.total_rule_count AS totalRuleCount, b.evaluation_status AS evaluationStatus
     FROM qc_result_batch b
     WHERE b.project_id=? AND b.monitor_table_id=? AND b.run_status='completed'
     ORDER BY b.completed_at DESC, b.id DESC LIMIT ?`,
    [projectId, monitorTableId, limit(filters.limit, 30, 100)]
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), score: formatScore(row.score), issueRows: number(row.issueRows), failedRuleCount: number(row.failedRuleCount), totalRuleCount: number(row.totalRuleCount) }));
}

async function compareBatches(filters = {}) {
  const projectId = projectIdOrThrow();
  const monitorTableId = Number(filters.monitorTableId || 0);
  if (!monitorTableId) throw new Error("请选择需要比较的监控表");
  const selectedIds = [Number(filters.currentResultBatchId || 0), Number(filters.previousResultBatchId || 0)].filter(Boolean);
  const selectedWhere = selectedIds.length ? ` AND id IN (${selectedIds.map(() => "?").join(",")})` : "";
  const [rows] = await pool.query(
    `SELECT id, batch_id AS batchId, completed_at AS completedAt, score, issue_rows AS issueRows, failed_rule_count AS failedRuleCount,
            total_rule_count AS totalRuleCount, evaluation_status AS evaluationStatus,
            score_formula_version AS scoreFormulaVersion, source_snapshot_json AS sourceSnapshot
     FROM qc_result_batch WHERE project_id = ? AND monitor_table_id = ? AND run_status = 'completed'
       ${selectedWhere}
     ORDER BY completed_at DESC, id DESC LIMIT 2`, [projectId, monitorTableId, ...selectedIds]
  );
  const currentId = Number(filters.currentResultBatchId || 0);
  const previousId = Number(filters.previousResultBatchId || 0);
  const current = currentId ? rows.find((row) => Number(row.id) === currentId) : rows[0];
  const previous = previousId ? rows.find((row) => Number(row.id) === previousId) : rows.find((row) => Number(row.id) !== Number(current?.id));
  if (!current) return { comparable: false, reason: "尚无成功批次" };
  if (!previous) return { comparable: false, current: { ...current, score: formatScore(current.score) }, reason: "至少需要两个完整批次后才能比较" };
  if (Number(current.id) === Number(previous.id)) throw new Error("请选择两个不同的运行批次");
  const [ruleRows] = await pool.query(
    `SELECT COALESCE(c.rule_category, p.rule_category) AS ruleCategory, COALESCE(c.rule_code, p.rule_code) AS ruleCode,
            COALESCE(c.rule_name, p.rule_name) AS ruleName, COALESCE(c.field_name, p.field_name) AS fieldName,
            COALESCE(c.severity, p.severity, 'medium') AS severity,
            COALESCE(c.total_rows, 0) AS currentTotalRows, COALESCE(p.total_rows, 0) AS previousTotalRows,
            COALESCE(c.issue_rows, 0) AS currentIssueRows, COALESCE(p.issue_rows, 0) AS previousIssueRows,
            COALESCE(c.issue_rate, 0) AS currentIssueRate, COALESCE(p.issue_rate, 0) AS previousIssueRate
     FROM qc_result_rule_stat c LEFT JOIN qc_result_rule_stat p
       ON p.project_id = c.project_id AND p.result_batch_id = ? AND p.strategy_rule_instance_id = c.strategy_rule_instance_id AND p.metric_scope_key = c.metric_scope_key
     WHERE c.project_id = ? AND c.result_batch_id = ?
     UNION ALL
     SELECT p.rule_category, p.rule_code, p.rule_name, p.field_name, COALESCE(p.severity, 'medium'), 0, p.total_rows, 0, p.issue_rows, 0, p.issue_rate
     FROM qc_result_rule_stat p LEFT JOIN qc_result_rule_stat c
       ON c.project_id = p.project_id AND c.result_batch_id = ? AND c.strategy_rule_instance_id = p.strategy_rule_instance_id AND c.metric_scope_key = p.metric_scope_key
     WHERE p.project_id = ? AND p.result_batch_id = ? AND c.id IS NULL
     ORDER BY ABS(currentIssueRows - previousIssueRows) DESC LIMIT 20`,
    [previous.id, projectId, current.id, current.id, projectId, previous.id]
  );
  const [dimensionRuleRows] = await pool.query(
    `SELECT result_batch_id AS resultBatchId, rule_category AS ruleCategory, rule_code AS ruleCode, rule_name AS ruleName,
            field_name AS fieldName, severity, total_rows AS totalRows, issue_rows AS issueRows, issue_rate AS issueRate
     FROM qc_result_rule_stat WHERE project_id=? AND result_batch_id IN (?, ?)`,
    [projectId, current.id, previous.id]
  );
  const currentRules = dimensionRuleRows.filter((row) => Number(row.resultBatchId) === Number(current.id)).map((row) => ({ ...row, totalRows: number(row.totalRows), issueRows: number(row.issueRows), issueRate: Number(row.issueRate || 0) }));
  const previousRules = dimensionRuleRows.filter((row) => Number(row.resultBatchId) === Number(previous.id)).map((row) => ({ ...row, totalRows: number(row.totalRows), issueRows: number(row.issueRows), issueRate: Number(row.issueRate || 0) }));
  const [tableRows] = await pool.query(
    `SELECT mt.table_name AS tableName, mt.table_comment AS tableComment, COALESCE(s.system_name, '未归属系统') AS systemName
     FROM qc_monitor_table mt LEFT JOIN dm_business_systems s ON s.id=mt.business_system_id AND s.project_id=mt.project_id
     WHERE mt.id=? AND mt.project_id=? LIMIT 1`, [monitorTableId, projectId]
  );
  const [trendRows] = await pool.query(
    `SELECT batch_id AS batchId, completed_at AS completedAt, score, issue_rows AS issueRows
     FROM qc_result_batch WHERE project_id=? AND monitor_table_id=? AND run_status='completed'
     ORDER BY completed_at DESC, id DESC LIMIT 12`, [projectId, monitorTableId]
  );
  const normalizedRuleRows = ruleRows.map((row) => ({
    ...row,
    currentTotalRows: number(row.currentTotalRows), previousTotalRows: number(row.previousTotalRows),
    currentIssueRows: number(row.currentIssueRows), previousIssueRows: number(row.previousIssueRows),
    currentIssueRate: Number(row.currentIssueRate || 0), previousIssueRate: Number(row.previousIssueRate || 0),
  }));
  const currentRuleKeys = new Set(currentRules.map((row) => `${row.ruleCode}|${row.fieldName || ""}`));
  const previousRuleKeys = new Set(previousRules.map((row) => `${row.ruleCode}|${row.fieldName || ""}`));
  const addedRuleCount = [...currentRuleKeys].filter((key) => !previousRuleKeys.has(key)).length;
  const removedRuleCount = [...previousRuleKeys].filter((key) => !currentRuleKeys.has(key)).length;
  const ruleChanges = {
    newCount: normalizedRuleRows.filter((row) => row.currentIssueRows > 0 && row.previousIssueRows === 0).length,
    resolvedCount: normalizedRuleRows.filter((row) => row.currentIssueRows === 0 && row.previousIssueRows > 0).length,
    persistentCount: normalizedRuleRows.filter((row) => row.currentIssueRows > 0 && row.previousIssueRows > 0).length,
    worsenedCount: normalizedRuleRows.filter((row) => row.currentIssueRows > row.previousIssueRows && row.previousIssueRows > 0).length,
    improvedCount: normalizedRuleRows.filter((row) => row.currentIssueRows < row.previousIssueRows && row.currentIssueRows > 0).length,
    addedRuleCount,
    removedRuleCount,
  };
  return {
    scope: "comparison",
    comparisonType: "batch",
    snapshotAt: current.completedAt,
    governanceSnapshotAt: new Date().toISOString(),
    batchIds: [Number(current.id), Number(previous.id)],
    comparable: true,
    table: { monitorTableId, ...(tableRows[0] || {}) },
    object: { type: "table", objectRefId: monitorTableId, objectName: tableRows[0]?.tableName || "-", systemName: tableRows[0]?.systemName || "未归属系统" },
    current: { ...current, score: formatScore(current.score), sourceSnapshot: undefined }, previous: { ...previous, score: formatScore(previous.score), sourceSnapshot: undefined },
    change: { score: Number((number(current.score) - number(previous.score)).toFixed(2)), issueRows: number(current.issueRows) - number(previous.issueRows), failedRules: number(current.failedRuleCount) - number(previous.failedRuleCount) },
    rules: normalizedRuleRows,
    currentRules,
    previousRules,
    dimensionSummary: reportRenderer.buildComparisonDimensionSummary(currentRules, previousRules),
    ruleChanges,
    comparability: {
      ...comparisonLevel([
        ...(addedRuleCount || removedRuleCount ? [`规则集合变化：新增 ${addedRuleCount} 条、减少 ${removedRuleCount} 条`] : []),
        ...(String(current.scoreFormulaVersion || "v1") !== String(previous.scoreFormulaVersion || "v1") ? [`评分公式版本变化：${previous.scoreFormulaVersion || "v1"} → ${current.scoreFormulaVersion || "v1"}`] : []),
      ]),
      comparable: addedRuleCount === 0 && removedRuleCount === 0 && String(current.scoreFormulaVersion || "v1") === String(previous.scoreFormulaVersion || "v1"),
      addedRuleCount,
      removedRuleCount,
      reasons: [
        ...(addedRuleCount || removedRuleCount ? [`规则集合变化：新增 ${addedRuleCount} 条、减少 ${removedRuleCount} 条`] : []),
        ...(String(current.scoreFormulaVersion || "v1") !== String(previous.scoreFormulaVersion || "v1") ? [`评分公式版本变化：${previous.scoreFormulaVersion || "v1"} → ${current.scoreFormulaVersion || "v1"}`] : []),
      ],
      message: addedRuleCount || removedRuleCount
        ? `两个批次存在规则口径变化：新增 ${addedRuleCount} 条、减少 ${removedRuleCount} 条。得分变化需结合规则变化共同判断。`
        : String(current.scoreFormulaVersion || "v1") !== String(previous.scoreFormulaVersion || "v1")
          ? "两个批次评分公式版本不同，质量变化仅具备条件可比性。"
          : "两个批次规则集合和评分公式一致，质量变化具备直接可比性。",
    },
    evidenceChanges: { schema: compareSchemaSnapshots(parseJson(current.sourceSnapshot, {}), parseJson(previous.sourceSnapshot, {})) },
    trend: trendRows.reverse().map((row) => ({ label: row.batchId, batchId: row.batchId, completedAt: row.completedAt, score: formatScore(row.score), issueRows: number(row.issueRows) })),
  };
}

async function getObservability(filters = {}) {
  const projectId = projectIdOrThrow();
  const monitorTableId = Number(filters.monitorTableId || 0);
  if (!monitorTableId) throw new Error("请选择监控表");
  const batches = await listTableBatches({ monitorTableId, limit: 2 });
  const current = batches[0];
  const previous = batches[1];
  if (!current) return { available: false, reason: "尚无完整批次", schema: compareSchemaSnapshots(null, null), metrics: [], reconciliation: [] };
  const [snapshotRows] = await pool.query(
    `SELECT id, source_snapshot_json AS sourceSnapshot FROM qc_result_batch WHERE project_id=? AND id IN (${[current.id, previous?.id].filter(Boolean).map(() => "?").join(",")})`,
    [projectId, ...[current.id, previous?.id].filter(Boolean)]
  );
  const snapshotMap = new Map(snapshotRows.map((row) => [Number(row.id), parseJson(row.sourceSnapshot, {})]));
  const [metricRows] = await pool.query(
    `SELECT rule_category AS ruleCategory, rule_code AS ruleCode, field_name AS fieldName, metric_value AS metricValue,
            baseline_value AS baselineValue, threshold_value AS thresholdValue, issue_rows AS issueRows, evaluation_status AS evaluationStatus,
            evidence_json AS evidence
     FROM qc_result_rule_stat WHERE project_id=? AND result_batch_id=?
       AND rule_category IN ('volume_anomaly','null_rate_change','freshness','batch_completeness')
     ORDER BY issue_rows DESC, rule_code`, [projectId, current.id]
  );
  const [reconciliationRows] = await pool.query(
    `SELECT rule_category AS ruleCategory, rule_code AS ruleCode, field_name AS fieldName, total_rows AS totalRows,
            issue_rows AS issueRows, issue_rate AS issueRate, evidence_json AS evidence
     FROM qc_result_rule_stat WHERE project_id=? AND result_batch_id=?
       AND rule_category IN ('cross_table_lookup','cross_table_consistency')
     ORDER BY issue_rows DESC, rule_code`, [projectId, current.id]
  );
  return {
    available: true,
    currentBatch: current,
    previousBatch: previous || null,
    schema: compareSchemaSnapshots(snapshotMap.get(current.id), previous ? snapshotMap.get(previous.id) : null),
    metrics: metricRows.map((row) => ({ ...row, metricValue: row.metricValue === null ? null : Number(row.metricValue), baselineValue: row.baselineValue === null ? null : Number(row.baselineValue), thresholdValue: row.thresholdValue === null ? null : Number(row.thresholdValue), issueRows: number(row.issueRows), evidence: parseJson(row.evidence, {}) })),
    reconciliation: reconciliationRows.map((row) => ({ ...row, totalRows: number(row.totalRows), issueRows: number(row.issueRows), issueRate: Number(row.issueRate || 0), evidence: parseJson(row.evidence, {}) })),
  };
}

async function listTags() {
  const projectId = projectIdOrThrow();
  const [rows] = await pool.query("SELECT id, tag_name AS tagName, tag_color AS tagColor, tag_desc AS tagDesc FROM qc_quality_tag WHERE project_id = ? ORDER BY tag_name", [projectId]);
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function listBusinessSystems() {
  const projectId = projectIdOrThrow();
  const [rows] = await pool.query(
    `SELECT id, system_name AS systemName, system_code AS systemCode
     FROM dm_business_systems WHERE project_id=? AND status='active' ORDER BY system_name`, [projectId]
  );
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function saveTag(payload, user) {
  const projectId = projectIdOrThrow();
  const tagName = String(payload.tagName || "").trim();
  if (!tagName) throw new Error("标签名称不能为空");
  const [result] = await pool.query(
    `INSERT INTO qc_quality_tag (project_id, tag_name, tag_color, tag_desc, created_by) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tag_color=VALUES(tag_color), tag_desc=VALUES(tag_desc)`,
    [projectId, tagName.slice(0, 64), String(payload.tagColor || "#1677ff").slice(0, 24), String(payload.tagDesc || "").slice(0, 255) || null, user?.username || user?.displayName || "system"]
  );
  const [rows] = await pool.query("SELECT id, tag_name AS tagName, tag_color AS tagColor, tag_desc AS tagDesc FROM qc_quality_tag WHERE project_id=? AND tag_name=? LIMIT 1", [projectId, tagName]);
  return { ...rows[0], id: Number(rows[0]?.id || result.insertId) };
}

async function updateTableGovernance(monitorTableId, payload, user) {
  const projectId = projectIdOrThrow();
  const businessSystemId = payload.businessSystemId ? Number(payload.businessSystemId) : null;
  if (businessSystemId) {
    const [systems] = await pool.query("SELECT id FROM dm_business_systems WHERE id=? AND project_id=? LIMIT 1", [businessSystemId, projectId]);
    if (!systems.length) throw new Error("所属系统不属于当前项目");
  }
  const importanceLevel = ["critical", "high", "normal", "low"].includes(String(payload.importanceLevel)) ? payload.importanceLevel : "normal";
  await pool.query(
    `UPDATE qc_monitor_table SET business_system_id=?, system_mapping_source=?, system_mapping_confirmed_by=?, system_mapping_confirmed_at=?, importance_level=?
     WHERE id=? AND project_id=?`,
    [businessSystemId, businessSystemId ? "manual" : null, businessSystemId ? (user?.username || user?.displayName || "system") : null, businessSystemId ? new Date() : null, importanceLevel, Number(monitorTableId), projectId]
  );
  const tagIds = [...new Set((Array.isArray(payload.tagIds) ? payload.tagIds : []).map(Number).filter(Boolean))];
  await pool.query("DELETE FROM qc_monitor_table_tag_relation WHERE project_id=? AND monitor_table_id=?", [projectId, Number(monitorTableId)]);
  for (const tagId of tagIds) {
    await pool.query(
      `INSERT INTO qc_monitor_table_tag_relation (project_id, monitor_table_id, tag_id)
       SELECT ?, ?, id FROM qc_quality_tag WHERE id=? AND project_id=?`, [projectId, Number(monitorTableId), tagId, projectId]
    );
  }
  return { monitorTableId: Number(monitorTableId), businessSystemId, importanceLevel, tagIds };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function reportMetric(label, value, suffix = "") {
  return `<div class="quality-report-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}${escapeHtml(suffix)}</strong></div>`;
}

function reportSeverity(value) {
  return ({ critical: "紧急", high: "高", medium: "中", low: "低" })[String(value || "medium")] || "中";
}

function reportTable(headers, rows) {
  if (!rows.length) return `<div class="quality-report-empty">暂无可展示数据</div>`;
  return `<div class="quality-report-table-wrap"><table class="quality-report-table"><thead><tr>${headers.map((item) => `<th>${escapeHtml(item.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((item) => `<td>${escapeHtml(item.render ? item.render(row) : row[item.key] ?? "-")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function buildReportBody(summary) {
  if (summary?.scope === "system") {
    const coverage = summary.coverage || {};
    return `<div class="quality-report-metrics">${reportMetric("系统数量", summary.systems?.length || 0, " 个")}${reportMetric("纳管表", coverage.expectedTableCount || 0, " 张")}${reportMetric("快照覆盖率", coverage.coverageRate ?? 0, "%")}${reportMetric("快照问题行", summary.issueRows || 0, " 行")}${reportMetric("综合得分", summary.score ?? "-", summary.score === null ? "" : " 分")}</div><h2>系统质量快照</h2>${reportTable([
      { label: "所属系统", key: "systemName" }, { label: "覆盖表", render: (row) => `${row.coveredTableCount}/${row.expectedTableCount}` },
      { label: "问题行", key: "issueRows" }, { label: "质量得分", render: (row) => row.score === null ? "待积累" : `${row.score} 分` },
    ], summary.systems || [])}<h2>重点数据表</h2>${reportTable([
      { label: "数据表", key: "tableName" }, { label: "所属系统", key: "systemName" }, { label: "采用批次", key: "batchId" },
      { label: "问题行", key: "issueRows" }, { label: "质量得分", render: (row) => row.score === null ? "待积累" : `${row.score} 分` },
    ], summary.tables || [])}`;
  }
  if (summary?.scope === "table") {
    const batch = summary.batch || {};
    return `<div class="quality-report-metrics">${reportMetric("质量得分", batch.score ?? "-", batch.score === null ? "" : " 分")}${reportMetric("问题行", batch.issueRows || 0, " 行")}${reportMetric("失败规则", batch.failedRuleCount || 0, " 条")}${reportMetric("执行规则", batch.totalRuleCount || 0, " 条")}</div><div class="quality-report-context"><strong>${escapeHtml(summary.table?.tableName || "-")}</strong><span>${escapeHtml(summary.table?.systemName || "未归属系统")} · 批次 ${escapeHtml(batch.batchId || "-")} · ${escapeHtml(batch.completedAt ? new Date(batch.completedAt).toLocaleString("zh-CN", { hour12: false }) : "-")}</span></div><h2>规则质量统计</h2>${reportTable([
      { label: "规则", render: (row) => row.ruleName || row.ruleCode }, { label: "字段", render: (row) => row.fieldName || "表级" },
      { label: "问题行", key: "issueRows" }, { label: "问题率", render: (row) => `${(Number(row.issueRate || 0) * 100).toFixed(2)}%` }, { label: "级别", render: (row) => reportSeverity(row.severity) },
    ], summary.rules || [])}<h2>脱敏问题样例</h2>${reportTable([
      { label: "规则", key: "ruleCode" }, { label: "主键快照", key: "maskedPkText" }, { label: "字段值", key: "maskedValueText" }, { label: "问题说明", key: "issueMessage" },
    ], summary.samples || [])}`;
  }
  const current = summary?.current || {};
  const previous = summary?.previous || {};
  return `<div class="quality-report-metrics">${reportMetric("得分变化", `${number(summary?.change?.score) >= 0 ? "+" : ""}${number(summary?.change?.score)}`, " 分")}${reportMetric("问题行变化", `${number(summary?.change?.issueRows) >= 0 ? "+" : ""}${number(summary?.change?.issueRows)}`, " 行")}${reportMetric("当前批次", current.batchId || "-")}${reportMetric("对比批次", previous.batchId || "-")}</div><h2>规则差异</h2>${reportTable([
    { label: "规则", key: "ruleCode" }, { label: "字段", render: (row) => row.fieldName || "表级" }, { label: "本批问题行", key: "currentIssueRows" },
    { label: "对比批次问题行", key: "previousIssueRows" }, { label: "变化", render: (row) => `${number(row.currentIssueRows) - number(row.previousIssueRows)}` },
  ], summary?.rules || [])}`;
}

function reportHtml(title, summary, aiSummary = null) {
  const aiSection = aiSummary?.summary ? `<section class="quality-report-ai"><h2>AI 分析摘要</h2><p>${escapeHtml(aiSummary.summary)}</p>${aiSummary.suggestions?.length ? `<h3>整改建议</h3><ul>${aiSummary.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}${aiSummary.limitations?.length ? `<p class="quality-report-note">分析限制：${escapeHtml(aiSummary.limitations.join("；"))}</p>` : ""}</section>` : "";
  return `<article class="quality-report-document"><header><span class="quality-report-kicker">DATA QUALITY REPORT</span><h1>${escapeHtml(title)}</h1><p>生成时间：${escapeHtml(new Date().toLocaleString("zh-CN", { hour12: false }))}</p></header>${buildReportBody(summary)}${aiSection}<footer>本报告基于统一质量事实层生成；AI 仅解释确定性统计，不替代质量口径和人工判断。</footer></article>`;
}

async function buildSystemReportSummary(businessSystemId) {
  const projectId = projectIdOrThrow();
  const systemWhere = businessSystemId ? " AND mt.business_system_id=?" : "";
  const params = businessSystemId ? [projectId, Number(businessSystemId)] : [projectId];
  const [rows] = await pool.query(
    `SELECT ranked.id AS resultBatchId, ranked.batch_id AS batchId, ranked.completed_at AS completedAt, ranked.score,
            ranked.score_formula_version AS scoreFormulaVersion,
            ranked.issue_rows AS issueRows, ranked.monitor_table_id AS monitorTableId, mt.table_name AS tableName,
            mt.table_comment AS tableComment, mt.business_system_id AS businessSystemId, mt.importance_level AS importanceLevel,
            COALESCE(s.system_name, '未归属系统') AS systemName
     FROM (SELECT b.*, ROW_NUMBER() OVER (PARTITION BY b.monitor_table_id ORDER BY b.completed_at DESC, b.id DESC) AS rn
           FROM qc_result_batch b WHERE b.project_id=? AND b.run_status='completed') ranked
     JOIN qc_monitor_table mt ON mt.id=ranked.monitor_table_id AND mt.project_id=ranked.project_id
     LEFT JOIN dm_business_systems s ON s.id=mt.business_system_id AND s.project_id=mt.project_id
     WHERE ranked.rn=1${systemWhere}
     ORDER BY ranked.score ASC, ranked.issue_rows DESC`, params
  );
  const [expectedRows] = await pool.query(
    `SELECT COALESCE(s.system_name, '未归属系统') AS systemName, mt.business_system_id AS businessSystemId, COUNT(*) AS expectedTableCount
     FROM qc_monitor_table mt LEFT JOIN dm_business_systems s ON s.id=mt.business_system_id AND s.project_id=mt.project_id
     WHERE mt.project_id=?${businessSystemId ? " AND mt.business_system_id=?" : ""}
     GROUP BY mt.business_system_id, s.system_name`, params
  );
  const expectedMap = new Map(expectedRows.map((row) => [String(row.businessSystemId || "none"), number(row.expectedTableCount)]));
  const groups = new Map();
  rows.forEach((row) => {
    const key = String(row.businessSystemId || "none");
    const group = groups.get(key) || { businessSystemId: row.businessSystemId ? Number(row.businessSystemId) : null, systemName: row.systemName, expectedTableCount: expectedMap.get(key) || 0, coveredTableCount: 0, issueRows: 0, scoreSum: 0, scoreWeight: 0 };
    const weight = importanceWeight(row.importanceLevel);
    group.coveredTableCount += 1;
    group.issueRows += number(row.issueRows);
    if (row.score !== null && row.score !== undefined) {
      group.scoreSum += number(row.score) * weight;
      group.scoreWeight += weight;
    }
    groups.set(key, group);
  });
  const systems = [...groups.values()].map((group) => ({ ...group, score: group.scoreWeight ? Number((group.scoreSum / group.scoreWeight).toFixed(2)) : null })).map(({ scoreSum, scoreWeight, ...group }) => group);
  const expectedTableCount = [...expectedMap.values()].reduce((sum, value) => sum + value, 0);
  const coveredTableCount = rows.length;
  const batchIds = rows.map((row) => Number(row.resultBatchId)).filter(Boolean);
  const [ruleRows] = batchIds.length ? await pool.query(
    `SELECT result_batch_id AS resultBatchId, strategy_rule_instance_id AS strategyRuleInstanceId, metric_scope_key AS metricScopeKey,
            rule_category AS ruleCategory, rule_code AS ruleCode, rule_name AS ruleName,
            field_name AS fieldName, severity, total_rows AS totalRows, issue_rows AS issueRows, issue_rate AS issueRate
     FROM qc_result_rule_stat WHERE project_id=? AND result_batch_id IN (${batchIds.map(() => "?").join(",")})`, [projectId, ...batchIds]
  ) : [[]];
  const normalizedRules = ruleRows.map((row) => ({ ...row, totalRows: number(row.totalRows), issueRows: number(row.issueRows), issueRate: Number(row.issueRate || 0) }));
  const topRuleMap = new Map();
  normalizedRules.forEach((rule) => {
    const key = `${rule.ruleCategory}|${rule.ruleCode}|${rule.fieldName || ""}`;
    const current = topRuleMap.get(key) || { ruleCategory: rule.ruleCategory, ruleCode: rule.ruleCode, ruleName: rule.ruleName, fieldName: rule.fieldName, severity: rule.severity || "medium", totalRows: 0, issueRows: 0 };
    current.totalRows += number(rule.totalRows);
    current.issueRows += number(rule.issueRows);
    topRuleMap.set(key, current);
  });
  const topRules = [...topRuleMap.values()].map((item) => ({ ...item, issueRate: item.totalRows ? item.issueRows / item.totalRows : 0 })).sort((left, right) => right.issueRows - left.issueRows).slice(0, 20);
  const [trendRows] = await pool.query(
    `SELECT DATE(b.completed_at) AS day, ROUND(AVG(b.score), 2) AS score, SUM(b.issue_rows) AS issueRows
     FROM qc_result_batch b JOIN qc_monitor_table mt ON mt.id=b.monitor_table_id AND mt.project_id=b.project_id
     WHERE b.project_id=? AND b.run_status='completed'${businessSystemId ? " AND mt.business_system_id=?" : ""}
     GROUP BY DATE(b.completed_at) ORDER BY day DESC LIMIT 12`, [projectId, ...(businessSystemId ? [Number(businessSystemId)] : [])]
  );
  const [issueRows] = await pool.query(
    `SELECT COUNT(*) AS issueCount,
            SUM(CASE WHEN i.issue_status NOT IN ('completed','ignored') THEN 1 ELSE 0 END) AS openIssueCount,
            SUM(CASE WHEN i.issue_status NOT IN ('completed','ignored') AND i.due_date IS NOT NULL AND i.due_date < CURDATE() THEN 1 ELSE 0 END) AS overdueIssueCount
     FROM qc_issue i JOIN qc_finding f ON f.id=i.finding_id AND f.project_id=i.project_id
     WHERE i.project_id=?${businessSystemId ? " AND f.business_system_id=?" : ""}`, [projectId, ...(businessSystemId ? [Number(businessSystemId)] : [])]
  );
  const targetSystem = businessSystemId ? expectedRows.find((row) => Number(row.businessSystemId) === Number(businessSystemId)) || null : null;
  const batchTimes = rows.map((row) => row.completedAt).filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()));
  const minBatchTime = batchTimes.length ? new Date(Math.min(...batchTimes.map((value) => value.getTime()))) : null;
  const maxBatchTime = batchTimes.length ? new Date(Math.max(...batchTimes.map((value) => value.getTime()))) : null;
  const formulaVersions = [...new Set(rows.map((row) => String(row.scoreFormulaVersion || "v1")))];
  const scoreFormulaVersion = formulaVersions.length === 1 ? formulaVersions[0] : "mixed";
  return {
    scope: "system",
    snapshotAt: maxBatchTime?.toISOString() || null,
    governanceSnapshotAt: new Date().toISOString(),
    scoreFormulaVersion,
    scoreFormulaVersions: formulaVersions,
    targetSystem: targetSystem ? { businessSystemId: Number(targetSystem.businessSystemId), systemName: targetSystem.systemName } : null,
    systems,
    tables: rows.map((row) => ({ ...row, resultBatchId: Number(row.resultBatchId), monitorTableId: Number(row.monitorTableId), businessSystemId: row.businessSystemId ? Number(row.businessSystemId) : null, score: formatScore(row.score), issueRows: number(row.issueRows) })),
    coverage: { expectedTableCount, coveredTableCount, missingTableCount: Math.max(0, expectedTableCount - coveredTableCount), coverageRate: expectedTableCount ? Number((100 * coveredTableCount / expectedTableCount).toFixed(1)) : 0 },
    issueRows: rows.reduce((sum, row) => sum + number(row.issueRows), 0),
    score: weightedQualityScore(rows),
    highRiskTableCount: rows.filter((row) => row.score !== null && number(row.score) < 70).length,
    dimensionSummary: reportRenderer.buildDimensionSummary(normalizedRules),
    rules: normalizedRules,
    topRules,
    trend: trendRows.reverse().map((row) => ({ label: row.day, day: row.day, score: formatScore(row.score), issueRows: number(row.issueRows) })),
    issueTracking: { issueCount: number(issueRows[0]?.issueCount), openIssueCount: number(issueRows[0]?.openIssueCount), overdueIssueCount: number(issueRows[0]?.overdueIssueCount) },
    batchTimeRange: { earliestCompletedAt: minBatchTime?.toISOString() || null, latestCompletedAt: maxBatchTime?.toISOString() || null, spanHours: minBatchTime && maxBatchTime ? round((maxBatchTime.getTime() - minBatchTime.getTime()) / 3600000, 1) : 0 },
    batchIds,
  };
}

async function buildTableReportSummary(monitorTableId, resultBatchId) {
  const projectId = projectIdOrThrow();
  const [batches] = await pool.query(
    `SELECT b.id, b.batch_id AS batchId, b.completed_at AS completedAt, b.score, b.issue_rows AS issueRows,
            b.score_formula_version AS scoreFormulaVersion,
            b.failed_rule_count AS failedRuleCount, b.total_rule_count AS totalRuleCount, b.evaluation_status AS evaluationStatus,
            mt.table_name AS tableName, mt.table_comment AS tableComment, COALESCE(s.system_name, '未归属系统') AS systemName
     FROM qc_result_batch b JOIN qc_monitor_table mt ON mt.id=b.monitor_table_id
     LEFT JOIN dm_business_systems s ON s.id=b.business_system_id AND s.project_id=b.project_id
     WHERE b.project_id=? AND b.monitor_table_id=?${resultBatchId ? " AND b.id=?" : ""}
     ORDER BY b.completed_at DESC, b.id DESC LIMIT 1`, [projectId, Number(monitorTableId), ...(resultBatchId ? [Number(resultBatchId)] : [])]
  );
  const batch = batches[0];
  if (!batch) throw new Error("指定表或运行批次不存在");
  const [rules] = await pool.query(
    `SELECT id, strategy_rule_instance_id AS strategyRuleInstanceId, metric_scope_key AS metricScopeKey,
            rule_category AS ruleCategory, rule_code AS ruleCode, rule_name AS ruleName, field_name AS fieldName,
            severity, total_rows AS totalRows, issue_rows AS issueRows, issue_rate AS issueRate, metric_value AS metricValue,
            baseline_value AS baselineValue, threshold_value AS thresholdValue, evaluation_status AS evaluationStatus
     FROM qc_result_rule_stat WHERE project_id=? AND result_batch_id=? ORDER BY issue_rows DESC, rule_code`, [projectId, batch.id]
  );
  const ruleIds = rules.map((row) => Number(row.id));
  const [samples] = ruleIds.length ? await pool.query(
    `SELECT r.rule_code AS ruleCode, s.masked_pk_text AS maskedPkText, s.masked_value_text AS maskedValueText, s.issue_message AS issueMessage
     FROM qc_result_sample s JOIN qc_result_rule_stat r ON r.id=s.result_rule_stat_id
     WHERE s.project_id=? AND s.result_rule_stat_id IN (${ruleIds.map(() => "?").join(",")}) ORDER BY s.id LIMIT 30`, [projectId, ...ruleIds]
  ) : [[]];
  const normalizedRules = rules.map((row) => ({ ...row, id: Number(row.id), totalRows: number(row.totalRows), issueRows: number(row.issueRows), issueRate: Number(row.issueRate || 0) }));
  const [trendRows] = await pool.query(
    `SELECT batch_id AS batchId, completed_at AS completedAt, score, issue_rows AS issueRows
     FROM qc_result_batch WHERE project_id=? AND monitor_table_id=? AND run_status='completed'
     ORDER BY completed_at DESC, id DESC LIMIT 12`, [projectId, Number(monitorTableId)]
  );
  const [issueRows] = await pool.query(
    `SELECT COUNT(*) AS issueCount,
            SUM(CASE WHEN i.issue_status NOT IN ('completed','ignored') THEN 1 ELSE 0 END) AS openIssueCount,
            SUM(CASE WHEN i.issue_status NOT IN ('completed','ignored') AND i.due_date IS NOT NULL AND i.due_date < CURDATE() THEN 1 ELSE 0 END) AS overdueIssueCount
     FROM qc_issue i JOIN qc_finding f ON f.id=i.finding_id AND f.project_id=i.project_id
     WHERE i.project_id=? AND f.monitor_table_id=?`, [projectId, Number(monitorTableId)]
  );
  return {
    scope: "table",
    snapshotAt: batch.completedAt,
    governanceSnapshotAt: new Date().toISOString(),
    scoreFormulaVersion: batch.scoreFormulaVersion || "v1",
    table: { monitorTableId: Number(monitorTableId), tableName: batch.tableName, tableComment: batch.tableComment, systemName: batch.systemName },
    batch: { id: Number(batch.id), batchId: batch.batchId, completedAt: batch.completedAt, score: formatScore(batch.score), issueRows: number(batch.issueRows), failedRuleCount: number(batch.failedRuleCount), totalRuleCount: number(batch.totalRuleCount), evaluationStatus: batch.evaluationStatus, scoreFormulaVersion: batch.scoreFormulaVersion || "v1" },
    rules: normalizedRules,
    samples,
    dimensionSummary: reportRenderer.buildDimensionSummary(normalizedRules),
    trend: trendRows.reverse().map((row) => ({ label: row.batchId, batchId: row.batchId, completedAt: row.completedAt, score: formatScore(row.score), issueRows: number(row.issueRows) })),
    issueTracking: { issueCount: number(issueRows[0]?.issueCount), openIssueCount: number(issueRows[0]?.openIssueCount), overdueIssueCount: number(issueRows[0]?.overdueIssueCount) },
    batchIds: [Number(batch.id)],
  };
}

function normalizeStoredReportSummary(value) {
  const raw = parseJson(value, {});
  return reportRenderer.hasLegacyReferentialDimension(raw.dimensionSummary)
    ? { ...raw, dimensionSummary: reportRenderer.normalizeDimensionSummary(raw.dimensionSummary) }
    : raw;
}

function storedReportSnapshot(row, summary) {
  const score = reportScore(summary);
  return {
    reportId: Number(row.id),
    reportCode: row.reportCode || `QCR-${row.projectId}-${row.id}`,
    reportTitle: row.reportTitle,
    reportScope: row.reportScope,
    createdAt: row.createdAt,
    snapshotAt: summary.snapshotAt || row.snapshotAt || row.createdAt,
    governanceSnapshotAt: summary.governanceSnapshotAt || row.governanceSnapshotAt || row.createdAt,
    score: score === null || score === undefined ? null : formatScore(score),
    issueRows: reportIssueRows(summary),
    failedRuleCount: number(summary.batch?.failedRuleCount ?? summary.dimensionSummary?.failedRuleCount),
    coverageRate: number(summary.dimensionSummary?.coverageRate),
    coveredTableCount: number(summary.coverage?.coveredTableCount),
    expectedTableCount: number(summary.coverage?.expectedTableCount),
    missingTableCount: number(summary.coverage?.missingTableCount),
    highRiskTableCount: number(summary.highRiskTableCount),
    issueTracking: summary.issueTracking || {},
    batchId: summary.batch?.batchId || null,
    batchIds: Array.isArray(summary.batchIds) ? summary.batchIds.map(Number).filter(Boolean) : [],
    templateVersion: row.templateVersion || "formal-v2",
    summarySchemaVersion: row.summarySchemaVersion || "legacy-v1",
    scoreFormulaVersion: row.scoreFormulaVersion || summary.scoreFormulaVersion || summary.batch?.scoreFormulaVersion || "v1",
  };
}

async function compareStoredReports(filters = {}) {
  const projectId = projectIdOrThrow();
  const comparisonType = String(filters.comparisonType || "");
  if (!["table_report", "system_report"].includes(comparisonType)) throw new Error("报告差异类型无效");
  const currentReportId = Number(filters.currentReportId || 0);
  const baselineReportId = Number(filters.baselineReportId || filters.previousReportId || 0);
  if (!currentReportId || !baselineReportId) throw new Error("请选择当前报告和基准报告");
  if (currentReportId === baselineReportId) throw new Error("请选择两份不同的质量报告");
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, report_code AS reportCode, report_scope AS reportScope,
            scope_ref_id AS scopeRefId, object_type AS objectType, object_ref_id AS objectRefId,
            report_title AS reportTitle, score_formula_version AS scoreFormulaVersion,
            summary_schema_version AS summarySchemaVersion, template_version AS templateVersion,
            deterministic_summary_json AS deterministicSummary, snapshot_at AS snapshotAt,
            governance_snapshot_at AS governanceSnapshotAt, created_at AS createdAt
     FROM qc_report WHERE project_id=? AND id IN (?, ?)`, [projectId, currentReportId, baselineReportId]
  );
  const currentRow = rows.find((row) => Number(row.id) === currentReportId);
  const previousRow = rows.find((row) => Number(row.id) === baselineReportId);
  if (!currentRow || !previousRow) throw new Error("选择的质量报告不存在或不属于当前项目空间");
  const expectedScope = comparisonType === "table_report" ? "table" : "system";
  if (currentRow.reportScope !== expectedScope || previousRow.reportScope !== expectedScope) throw new Error("只能比较同层级的质量报告");
  const sameScope = currentRow.scopeRefId === null || currentRow.scopeRefId === undefined
    ? previousRow.scopeRefId === null || previousRow.scopeRefId === undefined
    : Number(currentRow.scopeRefId) === Number(previousRow.scopeRefId);
  if (!sameScope) throw new Error(comparisonType === "table_report" ? "两份报告必须属于同一张监控表" : "两份报告必须属于同一个业务系统；项目总览只能与项目总览比较");

  const currentSummary = normalizeStoredReportSummary(currentRow.deterministicSummary);
  const previousSummary = normalizeStoredReportSummary(previousRow.deterministicSummary);
  const current = storedReportSnapshot(currentRow, currentSummary);
  const previous = storedReportSnapshot(previousRow, previousSummary);
  const ruleComparison = compareRuleSnapshots(reportRules(currentSummary), reportRules(previousSummary));
  const dimensionSummary = reportRenderer.buildSnapshotDimensionComparison(currentSummary.dimensionSummary || {}, previousSummary.dimensionSummary || {});
  const reasons = [];
  if (String(current.scoreFormulaVersion) !== String(previous.scoreFormulaVersion)) reasons.push(`评分公式版本变化：${previous.scoreFormulaVersion} → ${current.scoreFormulaVersion}`);
  if (String(current.summarySchemaVersion) !== String(previous.summarySchemaVersion)) reasons.push(`报告快照结构版本不同：${previous.summarySchemaVersion} → ${current.summarySchemaVersion}`);
  if (String(current.templateVersion) !== String(previous.templateVersion)) reasons.push(`报告模板版本不同：${previous.templateVersion} → ${current.templateVersion}`);
  if (ruleComparison.ruleChanges.addedRuleCount || ruleComparison.ruleChanges.removedRuleCount) reasons.push(`规则集合变化：新增 ${ruleComparison.ruleChanges.addedRuleCount} 条、减少 ${ruleComparison.ruleChanges.removedRuleCount} 条`);
  if (!Array.isArray(currentSummary.rules) || !Array.isArray(previousSummary.rules)) reasons.push("至少一份历史系统报告仅固化了重点规则，规则变化按可用快照进行比较");

  const tableChanges = comparisonType === "system_report"
    ? compareSystemTableSnapshots(currentSummary.tables || [], previousSummary.tables || [])
    : [];
  const addedTableCount = tableChanges.filter((row) => row.status === "added").length;
  const removedTableCount = tableChanges.filter((row) => row.status === "removed").length;
  if (addedTableCount || removedTableCount) reasons.push(`系统覆盖表集合变化：新增 ${addedTableCount} 张、退出 ${removedTableCount} 张`);
  if (number(currentSummary.batchTimeRange?.spanHours) > 24 || number(previousSummary.batchTimeRange?.spanHours) > 24) reasons.push("至少一份系统报告采用批次的时间跨度超过24小时");
  const level = comparisonLevel(reasons);
  const object = comparisonType === "table_report"
    ? { type: "table", objectRefId: Number(currentRow.scopeRefId), objectName: currentSummary.table?.tableName || previousSummary.table?.tableName || "-", systemName: currentSummary.table?.systemName || previousSummary.table?.systemName || "未归属系统" }
    : currentRow.scopeRefId
      ? { type: "system", objectRefId: Number(currentRow.scopeRefId), objectName: currentSummary.targetSystem?.systemName || previousSummary.targetSystem?.systemName || "-", systemName: currentSummary.targetSystem?.systemName || previousSummary.targetSystem?.systemName || "-" }
      : { type: "project", objectRefId: null, objectName: "项目质量总览", systemName: "全部系统" };
  const coverageChanges = {
    previousExpectedTableCount: previous.expectedTableCount,
    currentExpectedTableCount: current.expectedTableCount,
    expectedTableCountChange: current.expectedTableCount - previous.expectedTableCount,
    previousCoveredTableCount: previous.coveredTableCount,
    currentCoveredTableCount: current.coveredTableCount,
    coveredTableCountChange: current.coveredTableCount - previous.coveredTableCount,
    previousMissingTableCount: previous.missingTableCount,
    currentMissingTableCount: current.missingTableCount,
    missingTableCountChange: current.missingTableCount - previous.missingTableCount,
  };
  const objectChanges = {
    tableChanges,
    addedTableCount,
    removedTableCount,
    previousHighRiskTableCount: previous.highRiskTableCount,
    currentHighRiskTableCount: current.highRiskTableCount,
    highRiskTableCountChange: current.highRiskTableCount - previous.highRiskTableCount,
  };
  return {
    scope: "comparison",
    comparisonType,
    comparable: level.level !== "unavailable",
    snapshotAt: current.snapshotAt,
    governanceSnapshotAt: current.governanceSnapshotAt,
    object,
    table: comparisonType === "table_report" ? { monitorTableId: object.objectRefId, tableName: object.objectName, systemName: object.systemName } : null,
    system: comparisonType === "system_report" ? { businessSystemId: object.objectRefId, systemName: object.objectName } : null,
    current,
    previous,
    change: {
      score: round(number(current.score) - number(previous.score)),
      issueRows: current.issueRows - previous.issueRows,
      failedRules: current.failedRuleCount - previous.failedRuleCount,
      coverageRate: round(current.coverageRate - previous.coverageRate),
      openIssues: number(current.issueTracking?.openIssueCount) - number(previous.issueTracking?.openIssueCount),
      overdueIssues: number(current.issueTracking?.overdueIssueCount) - number(previous.issueTracking?.overdueIssueCount),
    },
    ...ruleComparison,
    dimensionSummary,
    issueChanges: {
      previousIssueCount: number(previous.issueTracking?.issueCount), currentIssueCount: number(current.issueTracking?.issueCount),
      issueCountChange: number(current.issueTracking?.issueCount) - number(previous.issueTracking?.issueCount),
      previousOpenIssueCount: number(previous.issueTracking?.openIssueCount), currentOpenIssueCount: number(current.issueTracking?.openIssueCount),
      openIssueCountChange: number(current.issueTracking?.openIssueCount) - number(previous.issueTracking?.openIssueCount),
      previousOverdueIssueCount: number(previous.issueTracking?.overdueIssueCount), currentOverdueIssueCount: number(current.issueTracking?.overdueIssueCount),
      overdueIssueCountChange: number(current.issueTracking?.overdueIssueCount) - number(previous.issueTracking?.overdueIssueCount),
    },
    coverageChanges,
    objectChanges,
    comparability: {
      ...level,
      comparable: level.level === "direct",
      reasons,
      message: reasons.length ? `两份报告具备条件可比性，共发现 ${reasons.length} 项口径或范围变化，结论需结合变化说明解读。` : "两份报告的对象、评分公式、规则集合和快照结构一致，具备直接可比性。",
    },
    samples: currentSummary.samples || [],
    trend: [
      { label: previous.reportTitle, completedAt: previous.createdAt, score: previous.score, issueRows: previous.issueRows },
      { label: current.reportTitle, completedAt: current.createdAt, score: current.score, issueRows: current.issueRows },
    ],
    batchIds: [...new Set([...previous.batchIds, ...current.batchIds])],
    sourceReports: { baselineReportId, currentReportId, baselineReportCode: previous.reportCode, currentReportCode: current.reportCode },
  };
}

async function listReportComparisonOptions(filters = {}) {
  const comparisonType = String(filters.comparisonType || "");
  const reports = await listReports();
  const expectedScope = comparisonType === "table_report" ? "table" : comparisonType === "system_report" ? "system" : null;
  return reports.filter((report) => !expectedScope || report.reportScope === expectedScope).filter((report) => report.reportScope !== "comparison").map((report) => ({
    id: report.id,
    reportCode: report.reportCode,
    reportScope: report.reportScope,
    scopeRefId: report.scopeRefId,
    objectType: report.objectType,
    objectName: report.objectName,
    systemName: report.systemName,
    reportTitle: report.reportTitle,
    score: report.score,
    coverageRate: report.coverageRate,
    batchLabel: report.batchLabel,
    batchCount: report.batchCount,
    snapshotAt: report.snapshotAt || report.createdAt,
    governanceSnapshotAt: report.governanceSnapshotAt || report.createdAt,
    scoreFormulaVersion: report.scoreFormulaVersion,
    summarySchemaVersion: report.summarySchemaVersion,
    templateVersion: report.templateVersion,
    createdAt: report.createdAt,
  }));
}

async function previewReportComparison(payload = {}) {
  const comparisonType = String(payload.comparisonType || "batch");
  if (comparisonType === "batch") return compareBatches({ monitorTableId: payload.scopeRefId || payload.monitorTableId, currentResultBatchId: payload.currentResultBatchId, previousResultBatchId: payload.previousResultBatchId });
  return compareStoredReports(payload);
}

function formatReportTitleTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function buildDefaultReportTitle({ reportScope, comparisonType, summary, createdAt }) {
  const objectName = reportScope === "system"
    ? summary.targetSystem?.systemName || "项目质量总览"
    : summary.object?.objectName || summary.table?.tableName || "数据表";
  let timeOrBatch = "";
  if (reportScope === "comparison") {
    timeOrBatch = comparisonType === "batch"
      ? [summary.previous?.batchId, summary.current?.batchId].filter(Boolean).join("-")
      : [
        formatReportTitleTime(summary.previous?.snapshotAt || summary.previous?.createdAt),
        formatReportTitleTime(summary.current?.snapshotAt || summary.current?.createdAt),
      ].filter(Boolean).join("-");
  } else if (reportScope === "table") {
    timeOrBatch = summary.batch?.batchId || formatReportTitleTime(summary.snapshotAt || createdAt);
  } else {
    timeOrBatch = formatReportTitleTime(summary.snapshotAt || createdAt);
  }
  return [objectName, reportScope === "comparison" ? "差异分析报告" : "质量报告", timeOrBatch]
    .filter(Boolean)
    .join("_")
    .slice(0, 255);
}

async function createReport(payload, user) {
  const projectId = projectIdOrThrow();
  const reportScope = ["system", "table", "comparison"].includes(String(payload.reportScope)) ? String(payload.reportScope) : "table";
  const comparisonType = reportScope === "comparison" && ["batch", "table_report", "system_report"].includes(String(payload.comparisonType || "batch")) ? String(payload.comparisonType || "batch") : null;
  let scopeRefId = payload.scopeRefId ? Number(payload.scopeRefId) : null;
  const summary = reportScope === "system"
    ? await buildSystemReportSummary(scopeRefId)
    : reportScope === "comparison"
      ? comparisonType === "batch"
        ? await compareBatches({ monitorTableId: scopeRefId, currentResultBatchId: payload.currentResultBatchId, previousResultBatchId: payload.previousResultBatchId })
        : await compareStoredReports({ comparisonType, currentReportId: payload.currentReportId, baselineReportId: payload.baselineReportId })
      : await buildTableReportSummary(scopeRefId, payload.resultBatchId);
  if (reportScope === "comparison") scopeRefId = summary.object?.objectRefId || null;
  const createdAt = new Date();
  const customTitle = String(payload.reportTitle || "").trim();
  const title = (customTitle || buildDefaultReportTitle({ reportScope, comparisonType, summary, createdAt })).slice(0, 255);
  const aiResult = payload.useAi ? await runAiAnalysis({ scopeType: reportScope, scopeRefId, deterministic: summary }) : null;
  const aiSummary = aiResult?.ai || null;
  const charts = reportRenderer.buildReportCharts(summary);
  const reportCode = crypto.randomUUID();
  const analysisMode = reportScope === "comparison" ? "comparison" : "snapshot";
  const objectType = reportScope === "comparison" ? summary.object?.type : reportScope === "table" ? "table" : scopeRefId ? "system" : "project";
  const objectRefId = reportScope === "comparison" ? summary.object?.objectRefId || null : scopeRefId;
  const scoreFormulaVersion = String(summary.scoreFormulaVersion || summary.current?.scoreFormulaVersion || summary.batch?.scoreFormulaVersion || "v1").slice(0, 32);
  const baselineReportId = comparisonType && comparisonType !== "batch" ? Number(payload.baselineReportId || 0) || null : null;
  const currentReportId = comparisonType && comparisonType !== "batch" ? Number(payload.currentReportId || 0) || null : null;
  const baselineBatchId = comparisonType === "batch" ? Number(summary.previous?.id || payload.previousResultBatchId || 0) || null : null;
  const currentBatchId = comparisonType === "batch" ? Number(summary.current?.id || payload.currentResultBatchId || 0) || null : null;
  const [result] = await pool.query(
    `INSERT INTO qc_report
      (project_id, report_code, report_scope, analysis_mode, comparison_type, object_type, object_ref_id, scope_ref_id,
       report_title, batch_ids_json, baseline_report_id, current_report_id, baseline_batch_id, current_batch_id,
       snapshot_at, governance_snapshot_at, summary_schema_version, score_formula_version,
       deterministic_summary_json, comparison_meta_json, ai_summary_json, template_version,
       dimension_summary_json, chart_snapshot_json, report_html, report_markdown, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)`,
    [projectId, reportCode, reportScope, analysisMode, comparisonType, objectType, objectRefId, scopeRefId, title,
      JSON.stringify(summary.batchIds || [summary.current?.id, summary.previous?.id].filter(Boolean)), baselineReportId, currentReportId, baselineBatchId, currentBatchId,
      summary.snapshotAt ? new Date(summary.snapshotAt) : createdAt, summary.governanceSnapshotAt ? new Date(summary.governanceSnapshotAt) : createdAt,
      REPORT_SUMMARY_SCHEMA_VERSION, scoreFormulaVersion, JSON.stringify(summary), reportScope === "comparison" ? JSON.stringify({ comparisonType, comparability: summary.comparability, sourceReports: summary.sourceReports || null }) : null,
      aiSummary ? JSON.stringify(aiSummary) : null, reportRenderer.REPORT_TEMPLATE_VERSION,
      JSON.stringify(summary.dimensionSummary || null), JSON.stringify(charts), user?.username || user?.displayName || "system", createdAt]
  );
  const report = { id: Number(result.insertId), title, summary, aiSummary, charts, createdAt, createdBy: user?.username || user?.displayName || "system" };
  const html = reportRenderer.buildReportHtml(report);
  const markdown = reportRenderer.buildReportMarkdown(report);
  await pool.query("UPDATE qc_report SET report_html=?, report_markdown=? WHERE id=? AND project_id=?", [html, markdown, report.id, projectId]);
  return { id: report.id, reportCode, title, reportScope, comparisonType, scopeRefId, aiUsed: Boolean(aiSummary?.available), score: summary.scope === "system" ? summary.score : summary.scope === "comparison" ? summary.current?.score : summary.batch?.score, coverageRate: summary.dimensionSummary?.coverageRate ?? summary.dimensionSummary?.current?.coverageRate ?? 0 };
}

function summarizeReportRow(row) {
  const rawSummary = parseJson(row.deterministicSummary, {});
  const summary = reportRenderer.hasLegacyReferentialDimension(rawSummary.dimensionSummary)
    ? { ...rawSummary, dimensionSummary: reportRenderer.normalizeDimensionSummary(rawSummary.dimensionSummary) }
    : rawSummary;
  const aiSummary = parseJson(row.aiSummary, null);
  const comparisonType = row.comparisonType || summary.comparisonType || (row.reportScope === "comparison" ? "batch" : null);
  const score = summary.scope === "system" ? summary.score : summary.scope === "comparison" ? summary.current?.score : summary.batch?.score;
  const issueRows = summary.scope === "system" ? summary.issueRows : summary.scope === "comparison" ? summary.current?.issueRows : summary.batch?.issueRows;
  const coverageRate = summary.dimensionSummary?.coverageRate ?? summary.dimensionSummary?.current?.coverageRate ?? 0;
  const objectName = summary.scope === "system"
    ? summary.targetSystem?.systemName || (summary.systems?.length === 1 ? summary.systems[0]?.systemName : "项目全部系统")
    : summary.object?.objectName || summary.table?.tableName || "-";
  const systemName = summary.scope === "system" ? summary.targetSystem?.systemName || "项目全部系统" : summary.object?.systemName || summary.table?.systemName || "未归属系统";
  return {
    ...row,
    id: Number(row.id),
    reportCode: row.reportCode || `QCR-${row.projectId || "legacy"}-${row.id}`,
    analysisMode: row.analysisMode || (row.reportScope === "comparison" ? "comparison" : "snapshot"),
    comparisonType,
    objectType: row.objectType || summary.object?.type || (row.reportScope === "table" ? "table" : row.reportScope === "system" ? row.scopeRefId ? "system" : "project" : "table"),
    scopeRefId: row.scopeRefId ? Number(row.scopeRefId) : null,
    score: score === null || score === undefined ? null : formatScore(score),
    issueRows: number(issueRows),
    coverageRate: Number(coverageRate || 0),
    objectName,
    systemName,
    batchLabel: summary.scope === "comparison"
      ? comparisonType === "batch"
        ? `${summary.previous?.batchId || "-"} → ${summary.current?.batchId || "-"}`
        : `${summary.previous?.reportTitle || "基准报告"} → ${summary.current?.reportTitle || "当前报告"}`
      : summary.scope === "table" ? summary.batch?.batchId || "-" : `${number(summary.coverage?.coveredTableCount)} 张表`,
    baselineLabel: summary.scope === "comparison" ? summary.previous?.reportTitle || summary.previous?.batchId || "-" : null,
    currentLabel: summary.scope === "comparison" ? summary.current?.reportTitle || summary.current?.batchId || "-" : null,
    scoreChange: summary.scope === "comparison" ? number(summary.change?.score) : null,
    issueRowsChange: summary.scope === "comparison" ? number(summary.change?.issueRows) : null,
    newIssueCount: summary.scope === "comparison" ? number(summary.ruleChanges?.newCount) : null,
    resolvedIssueCount: summary.scope === "comparison" ? number(summary.ruleChanges?.resolvedCount) : null,
    openIssueCount: number(summary.issueTracking?.openIssueCount),
    coveredTableCount: number(summary.coverage?.coveredTableCount),
    highRiskTableCount: number(summary.highRiskTableCount),
    batchCount: Array.isArray(summary.batchIds) ? summary.batchIds.length : 0,
    snapshotAt: summary.snapshotAt || row.snapshotAt || row.createdAt,
    governanceSnapshotAt: summary.governanceSnapshotAt || row.governanceSnapshotAt || row.createdAt,
    scoreFormulaVersion: row.scoreFormulaVersion || summary.scoreFormulaVersion || summary.batch?.scoreFormulaVersion || "v1",
    summarySchemaVersion: row.summarySchemaVersion || "legacy-v1",
    comparabilityLevel: summary.comparability?.level || (summary.comparable === false ? "unavailable" : "direct"),
    comparabilityLabel: summary.comparability?.levelLabel || (summary.comparable === false ? "不可比较" : "直接可比"),
    aiStatus: aiSummary?.available ? "success" : aiSummary ? "unavailable" : "not_requested",
  };
}

async function listReports(filters = {}) {
  const projectId = projectIdOrThrow();
  const where = ["project_id=?"];
  const params = [projectId];
  if (["system", "table", "comparison"].includes(String(filters.reportScope || ""))) { where.push("report_scope=?"); params.push(String(filters.reportScope)); }
  if (["batch", "table_report", "system_report"].includes(String(filters.comparisonType || ""))) { where.push("comparison_type=?"); params.push(String(filters.comparisonType)); }
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, report_code AS reportCode, report_scope AS reportScope,
            analysis_mode AS analysisMode, comparison_type AS comparisonType, object_type AS objectType,
            object_ref_id AS objectRefId, scope_ref_id AS scopeRefId, report_title AS reportTitle, report_status AS reportStatus,
            deterministic_summary_json AS deterministicSummary, ai_summary_json AS aiSummary,
            score_formula_version AS scoreFormulaVersion, summary_schema_version AS summarySchemaVersion,
            snapshot_at AS snapshotAt, governance_snapshot_at AS governanceSnapshotAt,
            template_version AS templateVersion,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM qc_report WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 200`, params
  );
  return rows.map(summarizeReportRow);
}

async function getReportCenterOverview() {
  const projectId = projectIdOrThrow();
  const [reports, issueRows] = await Promise.all([
    listReports(),
    pool.query(
      `SELECT COUNT(*) AS issueCount,
              SUM(CASE WHEN issue_status NOT IN ('completed','ignored') THEN 1 ELSE 0 END) AS openIssueCount,
              SUM(CASE WHEN issue_status NOT IN ('completed','ignored') AND due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) AS overdueIssueCount
       FROM qc_issue WHERE project_id=?`, [projectId]
    ).then(([rows]) => rows[0] || {}),
  ]);
  const byScope = (scope) => reports.filter((item) => item.reportScope === scope);
  const average = (rows, key) => {
    const values = rows.map((item) => item[key]).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    return values.length ? round(values.reduce((sum, value) => sum + number(value), 0) / values.length) : null;
  };
  const tableReports = byScope("table");
  const systemReports = byScope("system");
  const comparisonReports = byScope("comparison");
  const currentMonth = new Date();
  return {
    reportCount: reports.length,
    monthlyReportCount: reports.filter((item) => { const date = new Date(item.createdAt); return date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth(); }).length,
    averageScore: average(reports, "score"),
    averageCoverageRate: average(reports.filter((item) => item.reportScope !== "comparison"), "coverageRate"),
    issueCount: number(issueRows.issueCount),
    openIssueCount: number(issueRows.openIssueCount),
    overdueIssueCount: number(issueRows.overdueIssueCount),
    table: {
      reportCount: tableReports.length,
      coveredObjectCount: new Set(tableReports.map((item) => item.scopeRefId).filter(Boolean)).size,
      averageScore: average(tableReports, "score"),
      averageIssueRows: average(tableReports, "issueRows"),
    },
    system: {
      reportCount: systemReports.length,
      coveredObjectCount: new Set(systemReports.map((item) => item.scopeRefId || item.systemName).filter(Boolean)).size,
      averageScore: average(systemReports, "score"),
      highRiskCount: systemReports.filter((item) => item.score !== null && item.score < 70).length,
    },
    comparison: {
      reportCount: comparisonReports.length,
      improvedCount: comparisonReports.filter((item) => number(item.scoreChange) > 0).length,
      degradedCount: comparisonReports.filter((item) => number(item.scoreChange) < 0).length,
      averageScoreChange: average(comparisonReports, "scoreChange"),
      byType: {
        batch: comparisonReports.filter((item) => item.comparisonType === "batch").length,
        tableReport: comparisonReports.filter((item) => item.comparisonType === "table_report").length,
        systemReport: comparisonReports.filter((item) => item.comparisonType === "system_report").length,
      },
    },
  };
}

async function listAssignableUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.display_name AS displayName,
            COALESCE(r.role_code, u.role_code) AS roleCode,
            COALESCE(r.role_name, r.role_code, u.role_code) AS roleName
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.status='active'
     ORDER BY u.display_name ASC, u.username ASC`
  );
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function listIssues(filters = {}, user = {}) {
  const projectId = projectIdOrThrow();
  const businessSystemId = normalizeBusinessSystemId(filters.businessSystemId);
  const where = ["i.project_id=?"];
  const params = [projectId];
  if (businessSystemId) { where.push("f.business_system_id=?"); params.push(businessSystemId); }
  const accessScope = buildIssueAccessScope(user);
  if (accessScope.clause) { where.push(accessScope.clause); params.push(...accessScope.params); }
  const [rows] = await pool.query(
    `SELECT i.id, i.issue_title AS issueTitle, i.issue_status AS issueStatus, i.severity,
            i.owner_user_id AS ownerUserId, COALESCE(NULLIF(owner.display_name, ''), owner.username, i.owner_name) AS ownerName, i.due_date AS dueDate,
            i.updated_at AS updatedAt, f.fingerprint, f.occurrence_count AS occurrenceCount,
            mt.table_name AS tableName, COALESCE(s.system_name, '未归属系统') AS systemName
     FROM qc_issue i
     LEFT JOIN users owner ON owner.id=i.owner_user_id
     LEFT JOIN qc_finding f ON f.id=i.finding_id AND f.project_id=i.project_id
     LEFT JOIN qc_monitor_table mt ON mt.id=f.monitor_table_id AND mt.project_id=f.project_id
     LEFT JOIN dm_business_systems s ON s.id=f.business_system_id AND s.project_id=f.project_id
     WHERE ${where.join(" AND ")} ORDER BY i.updated_at DESC LIMIT 50`, params
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), ownerUserId: row.ownerUserId ? Number(row.ownerUserId) : null, occurrenceCount: number(row.occurrenceCount) }));
}

async function listFindings(filters = {}) {
  const projectId = projectIdOrThrow();
  const where = ["f.project_id=?"];
  const params = [projectId];
  if (filters.status) { where.push("f.finding_status=?"); params.push(String(filters.status)); }
  const [rows] = await pool.query(
    `SELECT f.id, f.monitor_table_id AS monitorTableId, f.fingerprint, f.finding_status AS findingStatus, f.severity, f.first_seen_at AS firstSeenAt,
            f.last_seen_at AS lastSeenAt, f.occurrence_count AS occurrenceCount, f.note,
            mt.table_name AS tableName, mt.table_comment AS tableComment, s.system_name AS systemName,
            r.rule_category AS ruleCategory, r.rule_code AS ruleCode, r.field_name AS fieldName,
            r.issue_rows AS issueRows, r.issue_rate AS issueRate, r.detected_at AS detectedAt,
            i.id AS issueId, i.issue_status AS issueStatus
     FROM qc_finding f
     LEFT JOIN qc_monitor_table mt ON mt.id=f.monitor_table_id
     LEFT JOIN dm_business_systems s ON s.id=f.business_system_id AND s.project_id=f.project_id
     LEFT JOIN qc_result_rule_stat r ON r.id=f.result_rule_stat_id
     LEFT JOIN qc_issue i ON i.finding_id=f.id AND i.project_id=f.project_id
     WHERE ${where.join(" AND ")} ORDER BY f.last_seen_at DESC LIMIT 200`, params
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), monitorTableId: row.monitorTableId ? Number(row.monitorTableId) : null, issueId: row.issueId ? Number(row.issueId) : null, occurrenceCount: number(row.occurrenceCount), issueRows: number(row.issueRows), issueRate: Number(row.issueRate || 0) }));
}

async function reviewFinding(id, payload, user) {
  const projectId = projectIdOrThrow();
  const action = String(payload.action || "");
  const statusMap = { confirm: "confirmed", expected: "expected_change", false_positive: "false_positive", ignore: "ignored" };
  const findingStatus = statusMap[action];
  if (!findingStatus) throw new Error("不支持的异常反馈动作");
  const [findings] = await pool.query(
    `SELECT f.id, f.severity, f.monitor_table_id AS monitorTableId, f.result_rule_stat_id AS resultRuleStatId,
            mt.table_name AS tableName, r.rule_code AS ruleCode, r.field_name AS fieldName
     FROM qc_finding f LEFT JOIN qc_monitor_table mt ON mt.id=f.monitor_table_id
     LEFT JOIN qc_result_rule_stat r ON r.id=f.result_rule_stat_id
     WHERE f.id=? AND f.project_id=? LIMIT 1`, [Number(id), projectId]
  );
  const finding = findings[0];
  if (!finding) throw new Error("待确认异常不存在");
  const owner = action === "confirm" ? await resolveAssignableOwner(payload.ownerUserId, true) : null;
  await pool.query("UPDATE qc_finding SET finding_status=?, note=? WHERE id=? AND project_id=?", [findingStatus, String(payload.note || "").slice(0, 2000) || null, Number(id), projectId]);
  let issueId = null;
  if (action === "confirm") {
    const [existing] = await pool.query("SELECT id FROM qc_issue WHERE finding_id=? AND project_id=? LIMIT 1", [Number(id), projectId]);
    if (existing[0]) issueId = Number(existing[0].id);
    else {
      const [result] = await pool.query(
        `INSERT INTO qc_issue (project_id, finding_id, issue_title, issue_status, severity, owner_user_id, owner_name, due_date, description)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        [projectId, Number(id), `${finding.tableName || "数据表"} / ${finding.ruleCode || "质量规则"}${finding.fieldName ? ` / ${finding.fieldName}` : ""}`.slice(0, 255),
          finding.severity || "medium", owner.id, owner.ownerName, payload.dueDate || null, String(payload.note || "").slice(0, 4000) || null]
      );
      issueId = Number(result.insertId);
      await pool.query(
        `INSERT INTO qc_issue_event (project_id, issue_id, event_type, event_note, operator_name)
         VALUES (?, ?, 'created', ?, ?)`, [projectId, issueId, "由待确认异常确认为治理问题", user?.displayName || user?.username || "system"]
      );
    }
  }
  return { id: Number(id), findingStatus, issueId };
}

async function updateIssueStatus(id, payload, user) {
  const projectId = projectIdOrThrow();
  const status = String(payload.issueStatus || "");
  if (!["pending", "processing", "verifying", "completed", "ignored", "reopened"].includes(status)) throw new Error("不支持的问题状态");
  const hasOwnerUpdate = Object.prototype.hasOwnProperty.call(payload, "ownerUserId");
  if (hasOwnerUpdate && !isQualityIssueAdmin(user) && Number(payload.ownerUserId) !== Number(user?.id || user?.sub || 0)) {
    throw new AppError("只有系统管理员可以将问题转交给其他负责人", 403);
  }
  const owner = hasOwnerUpdate ? await resolveAssignableOwner(payload.ownerUserId, true) : null;
  const where = ["id=?", "project_id=?"];
  const whereParams = [Number(id), projectId];
  const accessScope = buildIssueAccessScope(user, "qc_issue");
  if (accessScope.clause) { where.push(accessScope.clause); whereParams.push(...accessScope.params); }
  const [result] = await pool.query(
    `UPDATE qc_issue SET issue_status=?, owner_user_id=COALESCE(?, owner_user_id), owner_name=COALESCE(?, owner_name), due_date=COALESCE(?, due_date),
       resolution_note=CASE WHEN ? IN ('completed','ignored') THEN ? ELSE resolution_note END
     WHERE ${where.join(" AND ")}`,
    [status, owner?.id || null, owner?.ownerName || null, payload.dueDate || null, status, String(payload.note || "").slice(0, 4000) || null, ...whereParams]
  );
  if (!result.affectedRows) throw new AppError("治理问题不存在", 404);
  await pool.query(
    `INSERT INTO qc_issue_event (project_id, issue_id, event_type, event_note, operator_name) VALUES (?, ?, 'status_changed', ?, ?)`,
    [projectId, Number(id), `状态更新为 ${status}${payload.note ? `：${String(payload.note).slice(0, 1000)}` : ""}`, user?.displayName || user?.username || "system"]
  );
  return { id: Number(id), issueStatus: status };
}

async function getIssueDetail(id, user = {}) {
  const projectId = projectIdOrThrow();
  const where = ["i.id=?", "i.project_id=?"];
  const params = [Number(id), projectId];
  const accessScope = buildIssueAccessScope(user, "i");
  if (accessScope.clause) { where.push(accessScope.clause); params.push(...accessScope.params); }
  const [issues] = await pool.query(
    `SELECT i.id, i.issue_title AS issueTitle, i.issue_status AS issueStatus, i.severity,
            i.owner_user_id AS ownerUserId, COALESCE(NULLIF(owner.display_name, ''), owner.username, i.owner_name) AS ownerName,
            i.due_date AS dueDate, i.description, i.resolution_note AS resolutionNote, i.created_at AS createdAt, i.updated_at AS updatedAt
     FROM qc_issue i
     LEFT JOIN users owner ON owner.id=i.owner_user_id
     WHERE ${where.join(" AND ")} LIMIT 1`, params
  );
  if (!issues[0]) throw new AppError("治理问题不存在", 404);
  const [events] = await pool.query(
    `SELECT id, event_type AS eventType, event_note AS eventNote, operator_name AS operatorName, created_at AS createdAt
     FROM qc_issue_event WHERE issue_id=? AND project_id=? ORDER BY created_at DESC`, [Number(id), projectId]
  );
  return { ...issues[0], id: Number(issues[0].id), ownerUserId: issues[0].ownerUserId ? Number(issues[0].ownerUserId) : null, events: events.map((item) => ({ ...item, id: Number(item.id) })) };
}

async function getReportDetail(id) {
  const projectId = projectIdOrThrow();
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, report_code AS reportCode, report_scope AS reportScope,
            analysis_mode AS analysisMode, comparison_type AS comparisonType, object_type AS objectType,
            object_ref_id AS objectRefId, scope_ref_id AS scopeRefId, report_title AS reportTitle,
            report_status AS reportStatus, deterministic_summary_json AS deterministicSummary,
            ai_summary_json AS aiSummary, dimension_summary_json AS dimensionSummary, chart_snapshot_json AS chartSnapshot,
            report_html AS reportHtml, report_markdown AS reportMarkdown, template_version AS templateVersion,
            score_formula_version AS scoreFormulaVersion, summary_schema_version AS summarySchemaVersion,
            snapshot_at AS snapshotAt, governance_snapshot_at AS governanceSnapshotAt,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM qc_report WHERE id=? AND project_id=? LIMIT 1`, [Number(id), projectId]
  );
  if (!rows[0]) throw new Error("质量报告不存在");
  const row = rows[0];
  const rawSummary = parseJson(row.deterministicSummary, {});
  const hasLegacyDimension = reportRenderer.hasLegacyReferentialDimension(rawSummary.dimensionSummary);
  const summary = hasLegacyDimension
    ? { ...rawSummary, dimensionSummary: reportRenderer.normalizeDimensionSummary(rawSummary.dimensionSummary) }
    : rawSummary;
  const aiSummary = parseJson(row.aiSummary, null);
  const storedCharts = parseJson(row.chartSnapshot, []);
  const chartsNeedRepair = hasLegacyDimension || !Array.isArray(storedCharts) || !storedCharts.length || JSON.stringify(storedCharts).includes("undefined");
  const charts = chartsNeedRepair ? reportRenderer.buildReportCharts(summary) : storedCharts;
  const report = { id: Number(row.id), title: row.reportTitle, summary, aiSummary, charts, createdAt: row.createdAt, createdBy: row.createdBy };
  const needsRenderAdapter = hasLegacyDimension
    || row.templateVersion !== reportRenderer.REPORT_TEMPLATE_VERSION
    || [row.reportHtml, row.reportMarkdown].some((content) => String(content || "").includes("undefined 分"));
  const reportHtml = needsRenderAdapter || chartsNeedRepair || !row.reportHtml ? reportRenderer.buildReportHtml(report) : row.reportHtml;
  const reportMarkdown = needsRenderAdapter || chartsNeedRepair || !row.reportMarkdown ? reportRenderer.buildReportMarkdown(report) : row.reportMarkdown;
  return {
    ...summarizeReportRow(row),
    deterministicSummary: summary,
    aiSummary,
    dimensionSummary: summary.dimensionSummary || parseJson(row.dimensionSummary, null),
    chartSnapshot: charts,
    reportHtml,
    reportMarkdown,
  };
}

async function downloadReportMarkdown(id) {
  const report = await getReportDetail(id);
  return {
    fileName: `${reportRenderer.sanitizeFileName(report.reportTitle)}.md`,
    content: report.reportMarkdown,
  };
}

async function downloadReportWord(id) {
  const report = await getReportDetail(id);
  const buffer = await reportRenderer.buildReportWordBuffer({
    id: report.id,
    title: report.reportTitle,
    summary: report.deterministicSummary,
    aiSummary: report.aiSummary,
    charts: report.chartSnapshot,
    createdAt: report.createdAt,
    createdBy: report.createdBy,
  });
  await pool.query("UPDATE qc_report SET word_generated_at=NOW() WHERE id=? AND project_id=?", [Number(id), projectIdOrThrow()]);
  return { fileName: `${reportRenderer.sanitizeFileName(report.reportTitle)}.docx`, buffer };
}


async function deleteReport(id) {
  const projectId = projectIdOrThrow();
  const [result] = await pool.query("DELETE FROM qc_report WHERE id=? AND project_id=?", [Number(id), projectId]);
  if (!result.affectedRows) throw new Error("质量报告不存在或已删除");
  return { id: Number(id), deleted: true };
}

function parseAiJson(content) {
  const text = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(text);
  return {
    summary: String(parsed.summary || "").slice(0, 1600),
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 10).map(String) : [],
    possibleCauses: Array.isArray(parsed.possibleCauses) ? parsed.possibleCauses.slice(0, 8).map(String) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8).map(String) : [],
    limitations: Array.isArray(parsed.limitations) ? parsed.limitations.slice(0, 6).map(String) : [],
  };
}

async function runAiAnalysis(payload = {}) {
  const projectId = projectIdOrThrow();
  const scopeType = ["system", "table", "comparison"].includes(String(payload.scopeType)) ? String(payload.scopeType) : "table";
  const scopeRefId = Number(payload.scopeRefId || 0) || null;
  let deterministic = payload.deterministic || null;
  if (!deterministic && scopeType === "system") deterministic = await listSystemQuality({ limit: 20 });
  else if (!deterministic && scopeType === "comparison") deterministic = await compareBatches({ monitorTableId: scopeRefId });
  else if (!deterministic) deterministic = (await listTableQuality({ limit: 100 })).filter((item) => !scopeRefId || item.monitorTableId === scopeRefId);
  const input = { scopeType, scopeRefId, deterministic, constraints: { maxRules: 20, samplesPerRule: 3, dataMasked: true } };
  const [configs] = await pool.query(
    `SELECT id, default_model_provider_id AS providerId, default_model_name AS modelName, default_model_version AS modelVersion,
            temperature, max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            thinking_enabled AS thinkingEnabled, reasoning_effort AS reasoningEffort, thinking_budget AS thinkingBudget,
            system_prompt AS systemPrompt
     FROM quality_ai_configs WHERE scene_code='quality_analysis_report' AND status='active' LIMIT 1`
  );
  const config = configs[0];
  if (!config?.providerId) {
    const output = { available: false, summary: "未配置质量分析模型，已保留确定性统计结果。", evidence: [], possibleCauses: [], suggestions: [], limitations: ["请在质量监控 / 模型管理中配置“质量分析与报告”场景。"] };
    await pool.query("INSERT INTO qc_ai_analysis_run (project_id, scene_code, scope_type, scope_ref_id, run_status, input_summary_json, output_json) VALUES (?, 'quality_analysis_report', ?, ?, 'skipped', ?, ?)", [projectId, scopeType, scopeRefId, JSON.stringify(input), JSON.stringify(output)]);
    return { deterministic, ai: output };
  }
  try {
    const provider = modelProviderService.applyModelSelection(await modelProviderService.getModelProviderById(Number(config.providerId)), { modelName: config.modelName, modelVersion: config.modelVersion });
    const completion = await modelProviderService.generateChatCompletion(provider, [
      { role: "system", content: `${config.systemPrompt || ""}\n只输出 JSON 对象，字段为 summary、evidence、possibleCauses、suggestions、limitations。不得编造数据，不得输出 SQL 或执行动作。` },
      { role: "user", content: JSON.stringify(input) },
    ], {
      temperature: Math.min(Number(config.temperature ?? 0.2), 1),
      maxTokens: Math.min(Number(config.maxTokens || 1600), config.thinkingEnabled ? 16000 : 3200),
      timeoutMs: Number(config.timeoutMs || 90000),
      responseFormat: { type: "json_object" },
      ...modelProviderService.buildReasoningOptions(config),
    });
    const output = { available: true, ...parseAiJson(completion.content) };
    await pool.query("INSERT INTO qc_ai_analysis_run (project_id, scene_code, scope_type, scope_ref_id, run_status, input_summary_json, output_json, model_name) VALUES (?, 'quality_analysis_report', ?, ?, 'success', ?, ?, ?)", [projectId, scopeType, scopeRefId, JSON.stringify(input), JSON.stringify(output), provider.modelName || config.modelName || null]);
    return { deterministic, ai: output };
  } catch (error) {
    const output = { available: false, summary: "AI 分析未生成，已保留确定性统计结果。", evidence: [], possibleCauses: [], suggestions: [], limitations: [String(error.message || "模型调用失败").slice(0, 300)] };
    await pool.query("INSERT INTO qc_ai_analysis_run (project_id, scene_code, scope_type, scope_ref_id, run_status, input_summary_json, output_json, error_message) VALUES (?, 'quality_analysis_report', ?, ?, 'failed', ?, ?, ?)", [projectId, scopeType, scopeRefId, JSON.stringify(input), JSON.stringify(output), String(error.message || "模型调用失败").slice(0, 1024)]);
    return { deterministic, ai: output };
  }
}

async function materializeFindings() {
  const projectId = projectIdOrThrow();
  const [rows] = await pool.query(
    `SELECT r.id, r.monitor_table_id AS monitorTableId, r.business_system_id AS businessSystemId, r.rule_code AS ruleCode,
            r.field_name AS fieldName, r.severity, r.detected_at AS detectedAt
     FROM qc_result_rule_stat r JOIN qc_result_batch b ON b.id=r.result_batch_id
     WHERE r.project_id=? AND r.issue_rows > 0 AND b.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [projectId]
  );
  for (const row of rows) {
    const fp = crypto.createHash("sha256").update([row.monitorTableId, row.ruleCode, row.fieldName || ""].join("|")).digest("hex").slice(0, 96);
    await pool.query(
      `INSERT INTO qc_finding (project_id, fingerprint, monitor_table_id, business_system_id, result_rule_stat_id, severity, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE last_seen_at=VALUES(last_seen_at), occurrence_count=occurrence_count+1, result_rule_stat_id=VALUES(result_rule_stat_id), severity=VALUES(severity)`,
      [projectId, fp, row.monitorTableId, row.businessSystemId, row.id, row.severity, row.detectedAt || new Date(), row.detectedAt || new Date()]
    );
  }
  return { total: rows.length };
}

function qualityRobotUserId(user) {
  return Number(user?.sub || user?.id || 0);
}

function qualityRobotUserName(user) {
  return String(user?.displayName || user?.username || user?.name || "system").trim().slice(0, 128) || "system";
}

function mapQualityRobotSession(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: row.userId == null ? null : Number(row.userId),
    userName: row.userName,
    sessionTitle: row.sessionTitle || null,
    status: row.status,
    lastMessageAt: row.lastMessageAt || null,
    messageCount: row.messageCount == null ? null : Number(row.messageCount),
    lastPreview: row.lastPreview || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function mapQualityRobotMessage(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    sessionId: Number(row.sessionId),
    role: row.role,
    messageText: row.messageText,
    payload: parseJson(row.payload, {}),
    createdAt: row.createdAt || null,
  };
}

async function getQualityRobotSession(sessionId, user) {
  const projectId = projectIdOrThrow();
  const userId = qualityRobotUserId(user);
  const [rows] = await pool.query(
    `SELECT id, user_id AS userId, user_name AS userName, session_title AS sessionTitle,
            status, last_message_at AS lastMessageAt, created_at AS createdAt, updated_at AS updatedAt
     FROM qc_ops_robot_session
     WHERE id=? AND project_id=? AND COALESCE(user_id, 0)=?
     LIMIT 1`,
    [Number(sessionId), projectId, userId]
  );
  return mapQualityRobotSession(rows[0]);
}

async function createQualityRobotSession(question, user) {
  const projectId = projectIdOrThrow();
  const title = String(question || "新会话").replace(/\s+/g, " ").trim().slice(0, 80) || "新会话";
  const [result] = await pool.query(
    `INSERT INTO qc_ops_robot_session
     (project_id, user_id, user_name, session_title, status, last_message_at)
     VALUES (?, ?, ?, ?, 'active', NOW())`,
    [projectId, qualityRobotUserId(user) || null, qualityRobotUserName(user), title]
  );
  return getQualityRobotSession(result.insertId, user);
}

async function listQualityRobotMessages(sessionId, limitValue = 100) {
  const projectId = projectIdOrThrow();
  const safeLimit = Math.max(1, Math.min(Number(limitValue || 100), 100));
  const [rows] = await pool.query(
    `SELECT id, session_id AS sessionId, role, message_text AS messageText,
            payload_json AS payload, created_at AS createdAt
     FROM qc_ops_robot_message
     WHERE project_id=? AND session_id=?
     ORDER BY id DESC
     LIMIT ?`,
    [projectId, Number(sessionId), safeLimit]
  );
  return rows.reverse().map(mapQualityRobotMessage);
}

async function createQualityRobotMessage(sessionId, role, messageText, payload = null) {
  const projectId = projectIdOrThrow();
  const [result] = await pool.query(
    `INSERT INTO qc_ops_robot_message (project_id, session_id, role, message_text, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
    [projectId, Number(sessionId), role, String(messageText || "").slice(0, 12000), payload ? JSON.stringify(payload) : null]
  );
  await pool.query(
    "UPDATE qc_ops_robot_session SET last_message_at=NOW() WHERE id=? AND project_id=?",
    [Number(sessionId), projectId]
  );
  const [rows] = await pool.query(
    `SELECT id, session_id AS sessionId, role, message_text AS messageText,
            payload_json AS payload, created_at AS createdAt
     FROM qc_ops_robot_message WHERE id=? AND project_id=? LIMIT 1`,
    [result.insertId, projectId]
  );
  return mapQualityRobotMessage(rows[0]);
}

function compactQualityRobotHistory(messages) {
  return (Array.isArray(messages) ? messages : []).slice(-10).map((item) => ({
    role: item.role,
    text: String(item.messageText || "").slice(0, 800),
    result: item.role === "assistant" ? (item.payload?.cards || []).slice(0, 2).map((card) => ({
      title: card.title,
      items: (card.items || []).slice(0, 6),
      rows: (card.rows || []).slice(0, 5),
    })) : undefined,
  }));
}

function resolveQualityRobotIntent(question, history = []) {
  const classify = (text) => {
    if (/系统|排名|哪个/.test(text)) return "system";
    if (/表|数据表|对象/.test(text)) return "table";
    if (/异常|待处理|待确认/.test(text)) return "finding";
    if (/规则|指标/.test(text)) return "rule";
    if (/问题/.test(text)) return "finding";
    return "overview";
  };
  const direct = classify(question);
  const followUp = /它|这些|这个|上述|上面|刚才|第[一二三四五六七八九十\d]+|继续|进一步|为什么|原因|建议|怎么处理|呢/.test(question);
  if (direct !== "overview" || !followUp) return direct;
  const previousUser = [...history].reverse().find((item) => item.role === "user");
  if (previousUser) return classify(previousUser.messageText);
  const previousAssistant = [...history].reverse().find((item) => item.role === "assistant");
  return classify((previousAssistant?.payload?.cards || []).map((card) => card.title).join(" "));
}

function formatQualityRobotModelAnswer(content) {
  const text = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    const asList = (value) => {
      if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
      const item = String(value || "").trim();
      return item ? [item] : [];
    };
    const sections = [
      ["", asList(parsed.summary)],
      ["依据", asList(parsed.evidence)],
      ["可能原因", asList(parsed.possibleCauses)],
      ["建议", asList(parsed.suggestions)],
      ["说明", asList(parsed.limitations)],
    ];
    return sections
      .filter(([, items]) => items.length > 0)
      .map(([title, items]) => `${title ? `${title}：` : ""}${items.join("；")}`)
      .join("\n")
      .slice(0, 2000);
  } catch {
    if (/^\s*\{|"summary"\s*:|"evidence"\s*:/.test(text)) {
      const fields = [
        ["", "summary"],
        ["依据", "evidence"],
        ["可能原因", "possibleCauses"],
        ["建议", "suggestions"],
        ["说明", "limitations"],
      ];
      const parts = fields.map(([title, key]) => {
        const match = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"));
        if (!match?.[1]) return "";
        let value = match[1];
        try { value = JSON.parse(`"${match[1]}"`); } catch { }
        return `${title ? `${title}：` : ""}${value}`;
      }).filter(Boolean);
      return parts.join("\n").slice(0, 2000);
    }
    return text.slice(0, 2000);
  }
}

function resolveQualityRobotFollowUpTarget(question, history = []) {
  const assistant = [...history].reverse().find((item) => item.role === "assistant" && item.payload?.cards?.length);
  const tableCard = assistant?.payload?.cards?.find((card) => card.type === "table" && Array.isArray(card.rows));
  const rows = tableCard?.rows || [];
  if (!rows.length) return null;
  const ordinalText = String(question || "").match(/第([一二三四五六七八九十\d]+)/)?.[1] || "一";
  const ordinalMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const ordinal = Number(ordinalText) || ordinalMap[ordinalText] || 1;
  return rows[Math.max(0, ordinal - 1)] || rows[0];
}

async function listQualityRobotTargetRules(tableName) {
  const projectId = projectIdOrThrow();
  if (!tableName) return [];
  const [rows] = await pool.query(
    `SELECT r.rule_code AS ruleCode, r.rule_category AS ruleCategory, r.field_name AS fieldName,
            r.severity, r.issue_rows AS issueRows, r.issue_rate AS issueRate
     FROM qc_result_rule_stat r
     JOIN qc_result_batch b ON b.id=r.result_batch_id AND b.project_id=r.project_id
     JOIN qc_monitor_table mt ON mt.id=r.monitor_table_id AND mt.project_id=r.project_id
     WHERE r.project_id=? AND mt.table_name=? AND r.issue_rows>0
       AND b.id=(SELECT latest.id FROM qc_result_batch latest
                 WHERE latest.project_id=? AND latest.monitor_table_id=mt.id AND latest.run_status='completed'
                 ORDER BY latest.completed_at DESC, latest.id DESC LIMIT 1)
     ORDER BY r.issue_rows DESC, r.id DESC
     LIMIT 8`,
    [projectId, String(tableName), projectId]
  );
  return rows.map((row) => ({ ...row, issueRows: number(row.issueRows), issueRate: Number(row.issueRate || 0) }));
}

async function listOpsRobotSessions(user) {
  const projectId = projectIdOrThrow();
  const userId = qualityRobotUserId(user);
  const [rows] = await pool.query(
    `SELECT s.id, s.user_id AS userId, s.user_name AS userName, s.session_title AS sessionTitle,
            s.status, s.last_message_at AS lastMessageAt, s.created_at AS createdAt, s.updated_at AS updatedAt,
            COUNT(m.id) AS messageCount,
            SUBSTRING_INDEX(GROUP_CONCAT(m.message_text ORDER BY m.id DESC SEPARATOR '\\n----\\n'), '\\n----\\n', 1) AS lastPreview
     FROM qc_ops_robot_session s
     LEFT JOIN qc_ops_robot_message m ON m.session_id=s.id AND m.project_id=s.project_id
     WHERE s.project_id=? AND COALESCE(s.user_id, 0)=?
     GROUP BY s.id
     ORDER BY COALESCE(s.last_message_at, s.updated_at, s.created_at) DESC, s.id DESC
     LIMIT 30`,
    [projectId, userId]
  );
  return { sessions: rows.map(mapQualityRobotSession) };
}

async function getOpsRobotSessionMessages(sessionId, user) {
  const session = await getQualityRobotSession(sessionId, user);
  if (!session) throw new AppError("会话不存在或无权查看", 404);
  return { session, messages: await listQualityRobotMessages(session.id, 100) };
}

async function queryOpsRobot(payload = {}, user = null) {
  const projectId = projectIdOrThrow();
  const question = String(payload.question || "").trim().slice(0, 1000);
  if (!question) throw new Error("请输入需要查询的质量问题");
  let session = null;
  if (payload.sessionId) {
    session = await getQualityRobotSession(Number(payload.sessionId), user);
    if (!session) throw new AppError("会话不存在或无权继续追问", 404);
  } else {
    session = await createQualityRobotSession(question, user);
  }
  const previousMessages = await listQualityRobotMessages(session.id, 12);
  await createQualityRobotMessage(session.id, "user", question);
  const [overview, systems, tables, findings] = await Promise.all([
    getOverview(), listSystemQuality({ limit: 8 }), listTableQuality({ limit: 10 }), listFindings({ status: "pending_confirmation" }),
  ]);
  const context = {
    overview: { averageScore: overview.averageScore, batchCount: overview.batchCount, issueRows: overview.issueRows, systemMappingRate: overview.systemMappingRate, failedRuleCount: overview.failedRuleCount },
    systems: systems.slice(0, 8), tables: tables.slice(0, 10), pendingFindings: findings.slice(0, 10), topRules: overview.topRules.slice(0, 8),
  };
  let answer = `当前项目平均质量得分 ${overview.averageScore} 分，已归集 ${overview.batchCount} 个批次，累计问题行 ${overview.issueRows}，系统归属率 ${overview.systemMappingRate}%。`;
  const cards = [];
  const intent = resolveQualityRobotIntent(question, previousMessages);
  const isFollowUp = previousMessages.length > 0;
  const followUpTarget = isFollowUp ? resolveQualityRobotFollowUpTarget(question, previousMessages) : null;
  const needsTargetRules = intent === "table" && followUpTarget?.tableName && /主要问题|具体问题|哪些规则|规则|原因|为什么|怎么处理|治理/.test(question);
  const targetRules = needsTargetRules ? await listQualityRobotTargetRules(followUpTarget.tableName) : [];
  context.followUpTarget = followUpTarget;
  context.targetRules = targetRules;
  if (intent === "system") {
    cards.push({ type: "table", title: "系统质量排行", columns: ["systemName", "score", "issueRows", "tableCount"], rows: systems.slice(0, 8) });
    answer = systems.length ? `已按质量得分和问题行数整理 ${systems.length} 个系统，建议优先关注得分最低且问题行较多的系统。` : "当前尚无可展示的系统级批次，请先为监控表配置所属系统并运行质量任务。";
  } else if (intent === "table") {
    const rankedTables = [...tables].sort((left, right) => number(right.issueRows) - number(left.issueRows) || number(left.score) - number(right.score));
    if (needsTargetRules) {
      cards.push({ type: "table", title: `${followUpTarget.tableName} 主要问题`, columns: ["ruleCode", "fieldName", "severity", "issueRows", "issueRate"], rows: targetRules });
      answer = targetRules.length
        ? `${followUpTarget.tableName} 最新批次主要涉及 ${targetRules.length} 条问题规则，问题量最高的是 ${targetRules[0].ruleCode}${targetRules[0].fieldName ? `（字段 ${targetRules[0].fieldName}）` : ""}，问题行 ${targetRules[0].issueRows}。以下结果已按问题行数排序。`
        : `${followUpTarget.tableName} 当前没有可读取的最新批次问题规则明细。`;
    } else {
      cards.push({ type: "table", title: "重点数据表", columns: ["tableName", "systemName", "score", "issueRows"], rows: rankedTables.slice(0, 10) });
      answer = tables.length ? `已找到 ${tables.length} 张有质量批次的数据表，列表按问题行数排序。` : "当前尚无表级统一质量结果。";
    }
  } else if (intent === "finding") {
    cards.push({ type: "table", title: "待确认异常", columns: ["tableName", "ruleCode", "fieldName", "severity", "issueRows"], rows: findings.slice(0, 10) });
    answer = `当前有 ${findings.length} 条待确认异常，可前往问题中心确认真实问题、预期变化、误报或忽略。`;
  } else if (intent === "rule") {
    cards.push({ type: "table", title: "问题规则排行", columns: ["ruleCode", "ruleCategory", "issueRows", "issueRate"], rows: overview.topRules.slice(0, 8) });
    answer = "已按累计问题行数整理问题规则排行，统计值来自统一事实层。";
  } else {
    cards.push({ type: "stats", title: "质量概览", items: [
      { label: "平均得分", value: overview.averageScore }, { label: "问题行", value: overview.issueRows },
      { label: "运行批次", value: overview.batchCount }, { label: "系统归属率", value: `${overview.systemMappingRate}%` },
    ] });
  }
  const [configs] = await pool.query(
    `SELECT default_model_provider_id AS providerId, default_model_name AS modelName, default_model_version AS modelVersion,
            temperature, max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            thinking_enabled AS thinkingEnabled, reasoning_effort AS reasoningEffort, thinking_budget AS thinkingBudget,
            system_prompt AS systemPrompt
     FROM quality_ai_configs WHERE scene_code='quality_ops_robot' AND status='active' LIMIT 1`
  );
  const config = configs[0];
  if (config?.providerId) {
    try {
      const provider = modelProviderService.applyModelSelection(await modelProviderService.getModelProviderById(Number(config.providerId)), { modelName: config.modelName, modelVersion: config.modelVersion });
      const completion = await modelProviderService.generateChatCompletion(provider, [
        { role: "system", content: `${config.systemPrompt || ""}\n你是只读质量运营助手。只能依据输入数据和最近会话回答，支持结合上一轮问题与结果继续追问。不能生成 SQL、修改任务、规则、阈值或问题状态。若用户使用“它、这些、第一个、刚才”等指代，必须根据最近会话消解指代。输出 300 字以内中文。` },
        { role: "user", content: JSON.stringify({ question, recentConversation: compactQualityRobotHistory(previousMessages), currentFacts: context }) },
      ], {
        temperature: Math.min(Number(config.temperature ?? 0.2), 1),
        maxTokens: Math.min(Number(config.maxTokens || 900), config.thinkingEnabled ? 8000 : 1600),
        timeoutMs: Number(config.timeoutMs || 60000),
        ...modelProviderService.buildReasoningOptions(config),
      });
      if (String(completion.content || "").trim()) {
        const formattedAnswer = formatQualityRobotModelAnswer(completion.content);
        if (formattedAnswer) answer = formattedAnswer;
      }
    } catch (_error) {
      // 确定性答案已生成，模型失败不影响查询主链。
    }
  }
  await pool.query(
    `INSERT INTO qc_ai_analysis_run (project_id, scene_code, scope_type, run_status, input_summary_json, output_json)
     VALUES (?, 'quality_ops_robot', 'project', 'success', ?, ?)`, [projectId, JSON.stringify({ question, sessionId: session.id, historyTurns: previousMessages.length }), JSON.stringify({ answer, cards })]
  );
  if (isFollowUp && !config?.providerId) answer = `结合上一轮结果，${answer}`;
  const suggestions = intent === "system"
    ? ["第一个系统的主要问题是什么？", "这些系统涉及哪些重点表？", "给出优先治理建议"]
    : intent === "table"
      ? ["第一张表的主要问题是什么？", "这些表涉及哪些规则？", "建议先治理哪张表？"]
      : intent === "finding"
        ? ["这些异常主要集中在哪些表？", "第一条异常可能是什么原因？", "给出只读研判建议"]
        : ["查看系统质量排名", "哪些表问题最多", "当前待确认异常"];
  const assistantPayload = { text: answer, cards, readOnly: true, suggestions };
  const assistantMessage = await createQualityRobotMessage(session.id, "assistant", answer, assistantPayload);
  return { sessionId: session.id, assistantMessage, answer, cards, readOnly: true, suggestions };
}

module.exports = { getOverview, getOpsDashboard, getOpsDrilldown, listSystemQuality, listTableQuality, listTableBatches, compareBatches, compareStoredReports, previewReportComparison, listReportComparisonOptions, getObservability, listTags, listBusinessSystems, saveTag, updateTableGovernance, createReport, listReports, getReportCenterOverview, getReportDetail, downloadReportMarkdown, downloadReportWord, deleteReport, listFindings, listAssignableUsers, reviewFinding, listIssues, getIssueDetail, updateIssueStatus, materializeFindings, runAiAnalysis, queryOpsRobot, listOpsRobotSessions, getOpsRobotSessionMessages, __test: { normalizeOpsRange, normalizeBusinessSystemId, normalizeOpsDrilldownScene, weightedQualityScore, buildOpsTrend, buildQualityIssueFlow, buildQualityTopRules, buildOpsDimensionHealth, opsRate, opsIssueStats, compareRuleSnapshots, compareSystemTableSnapshots, reportRuleKey, resolveQualityRobotIntent, formatQualityRobotModelAnswer, resolveQualityRobotFollowUpTarget, formatReportTitleTime, buildDefaultReportTitle, isQualityIssueAdmin, buildIssueAccessScope } };
