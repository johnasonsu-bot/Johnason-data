import type { DataSourceRecord, IngestionTask, JobRun } from "../../types/api";

const DAY_MS = 24 * 60 * 60 * 1000;

const SOURCE_TYPE_LABELS: Record<string, string> = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  oracle: "Oracle",
  dm: "达梦数据库",
  sqlserver: "SQL Server",
  hive: "Hive",
  kafka: "Kafka",
  file: "文件",
  api: "API",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  oracle: "Oracle",
  dm: "达梦数据库",
  hive: "Hive",
  kafka: "Kafka",
  file: "文件",
  api: "API",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "已启用",
  paused: "已暂停",
  stopped: "已停止",
  running: "运行中",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  pending: "待执行",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export const SYNC_MODE_LABELS: Record<string, string> = {
  full: "全量",
  incremental: "增量",
  cdc: "CDC",
};

export type MonitorSeverity = "critical" | "high" | "medium" | "low";

export interface MonitorMetricCard {
  key: string;
  label: string;
  value: number;
  suffix?: string;
  precision?: number;
  tone: "blue" | "cyan" | "green" | "amber" | "red";
  note: string;
}

export interface MonitorDistributionDatum {
  name: string;
  value: number;
}

export interface MonitorTrendBucket {
  label: string;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  volume: number;
}

export type MonitorTopologyWeightMode = "tasks" | "volume";
export type MonitorTrendRange = "24h" | "7d" | "30d";

export interface MonitorHealthDimension {
  key: string;
  label: string;
  value: number;
  note: string;
}

export interface MonitorTopologyNode {
  name: string;
  displayName: string;
  category: "source" | "mode" | "target";
}

export interface MonitorTopologyLink {
  source: string;
  target: string;
  value: number;
}

export interface MonitorRiskTask {
  key: string;
  taskId: number;
  taskName: string;
  ownerName: string;
  sourceName: string;
  targetName: string;
  syncModeLabel: string;
  taskStatus: string;
  lastRunStatus: string;
  freshnessMinutes: number | null;
  healthScore: number;
  severity: MonitorSeverity;
  issueSummary: string;
  issueCount: number;
  lastRunTime: string | null;
  volume: number;
  taskStatusCode: string;
  lastRunStatusCode: string;
  scheduleEnabled: boolean;
  latestFailed: boolean;
  slaBreached: boolean;
  longRunning: boolean;
  sourceOffline: boolean;
  targetOffline: boolean;
  recentFailureCount: number;
}

export interface MonitorDurationItem {
  key: string;
  taskId: number;
  taskName: string;
  durationSeconds: number;
  ownerName: string;
  sourceName: string;
  targetName: string;
  runStatus: string;
}

export interface MonitorEventItem {
  id: string;
  taskId: number;
  severity: MonitorSeverity;
  type: string;
  title: string;
  detail: string;
  timestamp: string | null;
  taskName: string;
  ownerName: string;
}

export interface MonitorHealthMatrixCell {
  label: string;
  value: number;
}

export interface MonitorHealthMatrixRow {
  key: string;
  taskId: number;
  taskName: string;
  ownerName: string;
  severity: MonitorSeverity;
  cells: MonitorHealthMatrixCell[];
}

export interface MonitorSourceCluster {
  key: string;
  sourceId: number | null;
  sourceName: string;
  sourceTypeLabel: string;
  statusLabel: string;
  taskCount: number;
  activeTaskCount: number;
  riskCount: number;
}

export interface MonitorExceptionSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  freshness: number;
  runningTimeout: number;
  failed: number;
  blocked: number;
}

export interface MonitorRuntimeStatus {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  paused: number;
  inactive: number;
}

export interface IngestionMonitorDashboard {
  generatedAt: string;
  isEmpty: boolean;
  sampleTaskCount: number;
  runCoverage: number;
  summaryCards: MonitorMetricCard[];
  watchMetrics: MonitorMetricCard[];
  sourceTypeDistribution: MonitorDistributionDatum[];
  targetTypeDistribution: MonitorDistributionDatum[];
  syncModeDistribution: MonitorDistributionDatum[];
  ownerRanking: MonitorDistributionDatum[];
  topology: {
    nodes: MonitorTopologyNode[];
    links: MonitorTopologyLink[];
  };
  topologyByWeight: Record<MonitorTopologyWeightMode, {
    nodes: MonitorTopologyNode[];
    links: MonitorTopologyLink[];
  }>;
  trendBuckets: MonitorTrendBucket[];
  trendBucketsByRange: Record<MonitorTrendRange, MonitorTrendBucket[]>;
  healthScore: number;
  healthStatus: string;
  healthDimensions: MonitorHealthDimension[];
  exceptionSummary: MonitorExceptionSummary;
  runtimeStatus: MonitorRuntimeStatus;
  riskTasks: MonitorRiskTask[];
  runtimeBoard: MonitorRiskTask[];
  durationRanking: MonitorDurationItem[];
  events: MonitorEventItem[];
  healthMatrix: MonitorHealthMatrixRow[];
  sourceClusters: MonitorSourceCluster[];
}

type TaskSignal = {
  task: IngestionTask;
  sourceName: string;
  targetName: string;
  sourceTypeLabel: string;
  targetTypeLabel: string;
  latestRun: JobRun | null;
  latestSuccessRun: JobRun | null;
  healthScore: number;
  severity: MonitorSeverity;
  issues: string[];
  freshnessMinutes: number | null;
  expectedWindowMinutes: number;
  slaOnTime: boolean;
  longRunning: boolean;
  latestFailed: boolean;
  sourceOffline: boolean;
  targetOffline: boolean;
  recentFailureCount: number;
  structureScore: number;
  timelinessScore: number;
  stabilityScore: number;
  loadScore: number;
  recordsCount: number;
};

type DashboardBuilderInput = {
  tasks: IngestionTask[];
  dataSources: DataSourceRecord[];
  runsByTask: Map<number, JobRun[]>;
  coveredTaskCount: number;
  generatedAt?: string;
};

export function buildIngestionMonitorDashboard(input: DashboardBuilderInput): IngestionMonitorDashboard {
  const { tasks, dataSources, runsByTask, coveredTaskCount } = input;
  const generatedAt = input.generatedAt || new Date().toISOString();

  if (!tasks.length) {
    return {
      generatedAt,
      isEmpty: true,
      sampleTaskCount: 0,
      runCoverage: 1,
      summaryCards: [],
      watchMetrics: [],
      sourceTypeDistribution: [],
      targetTypeDistribution: [],
      syncModeDistribution: [],
      ownerRanking: [],
      topology: { nodes: [], links: [] },
      trendBuckets: buildTrendBuckets([], Date.now()),
      topologyByWeight: {
        tasks: { nodes: [], links: [] },
        volume: { nodes: [], links: [] },
      },
      trendBucketsByRange: {
        "24h": buildTrendBuckets([], Date.now(), "24h"),
        "7d": buildTrendBuckets([], Date.now(), "7d"),
        "30d": buildTrendBuckets([], Date.now(), "30d"),
      },
      healthScore: 100,
      healthStatus: "空闲",
      healthDimensions: [],
      exceptionSummary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        freshness: 0,
        runningTimeout: 0,
        failed: 0,
        blocked: 0,
      },
      runtimeStatus: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        paused: 0,
        inactive: 0,
      },
      riskTasks: [],
      runtimeBoard: [],
      durationRanking: [],
      events: [],
      healthMatrix: [],
      sourceClusters: [],
    };
  }

  const nowTs = Date.now();
  const dataSourceMap = new Map<number, DataSourceRecord>(dataSources.map((item) => [item.id, item]));
  const taskSignals = tasks.map((task) => deriveTaskSignal(task, sortRuns(runsByTask.get(task.id) || []), dataSourceMap, nowTs));
  const allRuns = taskSignals.flatMap((signal) => sortRuns(runsByTask.get(signal.task.id) || []));
  const recentRuns = allRuns.filter((run) => toTimestamp(run.startTime) >= nowTs - DAY_MS);
  const terminalRuns = recentRuns.filter((run) => run.runStatus === "completed" || run.runStatus === "failed");
  const completedRuns = terminalRuns.filter((run) => run.runStatus === "completed");
  const failedRuns = terminalRuns.filter((run) => run.runStatus === "failed");
  const scheduledSignals = taskSignals.filter((signal) => signal.task.scheduleEnabled && signal.task.status !== "draft");
  const activeSignals = taskSignals.filter((signal) => signal.task.status === "active" || signal.task.status === "running");
  const runningSignals = taskSignals.filter((signal) => signal.latestRun?.runStatus === "running" || signal.task.status === "running");
  const pausedSignals = taskSignals.filter((signal) => signal.task.status === "paused");
  const inactiveSignals = taskSignals.filter((signal) => signal.task.status === "draft" || signal.task.status === "stopped");
  const uniqueSources = uniqueCount(taskSignals.map((signal) => signal.sourceName));
  const uniqueTargets = uniqueCount(taskSignals.map((signal) => signal.targetName));
  const onTimeCount = scheduledSignals.filter((signal) => signal.slaOnTime).length;
  const successRate = terminalRuns.length ? completedRuns.length / terminalRuns.length : 1;
  const slaRate = scheduledSignals.length ? onTimeCount / scheduledSignals.length : 1;
  const freshnessRate = activeSignals.length ? activeSignals.filter((signal) => signal.slaOnTime).length / activeSignals.length : 1;
  const topologyByWeight = {
    tasks: buildTopology(taskSignals, "tasks"),
    volume: buildTopology(taskSignals, "volume"),
  } satisfies Record<MonitorTopologyWeightMode, { nodes: MonitorTopologyNode[]; links: MonitorTopologyLink[] }>;
  const topology = topologyByWeight.volume;
  const trendBucketsByRange = {
    "24h": buildTrendBuckets(allRuns, nowTs, "24h"),
    "7d": buildTrendBuckets(allRuns, nowTs, "7d"),
    "30d": buildTrendBuckets(allRuns, nowTs, "30d"),
  } satisfies Record<MonitorTrendRange, MonitorTrendBucket[]>;
  const trendBuckets = trendBucketsByRange["24h"];
  const events = buildEvents(taskSignals);
  const exceptionSummary = buildExceptionSummary(events, taskSignals);
  const healthDimensions = buildHealthDimensions(taskSignals, successRate, freshnessRate, coveredTaskCount, tasks.length, slaRate);
  const freshnessBreachedCount = scheduledSignals.filter((signal) => !signal.slaOnTime).length;
  const longRunningCount = taskSignals.filter((signal) => signal.longRunning).length;
  const repeatedFailureCount = taskSignals.filter((signal) => signal.recentFailureCount >= 2).length;
  const sourceOfflineCount = uniqueCount(taskSignals.filter((signal) => signal.sourceOffline).map((signal) => signal.sourceName));
  const targetOfflineCount = uniqueCount(taskSignals.filter((signal) => signal.targetOffline).map((signal) => signal.targetName));
  const offlineEndpointCount = sourceOfflineCount + targetOfflineCount;
  const volume24h = recentRuns.reduce((sum, run) => sum + safeNumber(run.recordsCount), 0);
  const secondsInDay = 24 * 60 * 60;
  const runRatePerSecond = volume24h / secondsInDay;
  const runRateValue = runRatePerSecond >= 10000 ? roundTo(runRatePerSecond / 10000, 1) : roundTo(runRatePerSecond, 2);
  const runRateSuffix = runRatePerSecond >= 10000 ? "万条/秒" : "条/秒";
  const runRatePrecision = runRatePerSecond >= 10000 ? 1 : 2;
  const terminalDurations = terminalRuns.map((run) => getRunDurationMinutes(run, nowTs)).filter((value) => value > 0);
  const avgDurationMinutes = terminalDurations.length
    ? roundTo(terminalDurations.reduce((sum, value) => sum + value, 0) / terminalDurations.length, 1)
    : 0;
  const p95DurationMinutes = terminalDurations.length ? percentile(terminalDurations, 0.95) : 0;
  const avgDurationSeconds = roundTo(avgDurationMinutes * 60, 0);
  const p95DurationSeconds = roundTo(p95DurationMinutes * 60, 0);
  const healthWeights = [0.28, 0.28, 0.18, 0.14, 0.12, 0.1];
  const totalHealthWeight = healthWeights.reduce((sum, value) => sum + value, 0) || 1;
  const healthScore = clamp(Math.round(
    healthDimensions.reduce((sum, item, index) => {
      return sum + item.value * (healthWeights[index] || 0);
    }, 0) / totalHealthWeight,
  ));
  const riskTasks = buildRiskTasks(taskSignals);
  const durationRanking = buildDurationRanking(taskSignals, runsByTask, nowTs);
  const sourceClusters = buildSourceClusters(taskSignals, dataSourceMap);
  const ownerRanking = buildOwnerRanking(taskSignals).slice(0, 6);
  const dashboardSummaryCards: MonitorMetricCard[] = [
    {
      key: "totalTasks",
      label: "接入任务",
      value: tasks.length,
      tone: "blue",
      note: `启用 ${activeSignals.length} / 暂停 ${pausedSignals.length}`,
    },
    {
      key: "scheduledTasks",
      label: "启用调度",
      value: scheduledSignals.length,
      tone: "cyan",
      note: `手动或临时 ${Math.max(tasks.length - scheduledSignals.length, 0)} 条`,
    },
    {
      key: "sourceSystems",
      label: "来源系统",
      value: uniqueSources,
      tone: "blue",
      note: `目标系统 ${uniqueTargets} 个`,
    },
    {
      key: "todayRuns",
      label: "24h 实例",
      value: recentRuns.length,
      tone: "green",
      note: `成功 ${completedRuns.length} / 失败 ${failedRuns.length}`,
    },
    {
      key: "coverage",
      label: "运行覆盖率",
      value: roundTo((tasks.length ? coveredTaskCount / tasks.length : 1) * 100, 1),
      suffix: "%",
      precision: 1,
      tone: coveredTaskCount === tasks.length ? "green" : "amber",
      note: `已装载 ${coveredTaskCount}/${tasks.length} 条运行记录`,
    },
    {
      key: "successRate",
      label: "24h 成功率",
      value: roundTo(successRate * 100, 1),
      suffix: "%",
      precision: 1,
      tone: successRate >= 0.95 ? "green" : successRate >= 0.85 ? "amber" : "red",
      note: `高风险任务 ${riskTasks.length} 条`,
    },
    {
      key: "slaRate",
      label: "SLA 达成率",
      value: roundTo(slaRate * 100, 1),
      suffix: "%",
      precision: 1,
      tone: slaRate >= 0.92 ? "cyan" : slaRate >= 0.8 ? "amber" : "red",
      note: `${freshnessBreachedCount} 条已破线或临近`,
    },
    {
      key: "alerts",
      label: "当前告警",
      value: exceptionSummary.total,
      tone: exceptionSummary.critical > 0 ? "red" : exceptionSummary.high > 0 ? "amber" : "cyan",
      note: `P1 ${exceptionSummary.critical} / P2 ${exceptionSummary.high}`,
    },
    {
      key: "health",
      label: "链路健康",
      value: healthScore,
      tone: healthScore >= 85 ? "green" : healthScore >= 70 ? "amber" : "red",
      note: resolveHealthStatus(healthScore),
    },
  ];
  const watchMetrics: MonitorMetricCard[] = [
    {
      key: "freshnessBreach",
      label: "时效破线",
      value: freshnessBreachedCount,
      tone: freshnessBreachedCount > 0 ? "red" : "green",
      note: "SLA 窗口内未按时落地",
    },
    {
      key: "longRunning",
      label: "长时运行",
      value: longRunningCount,
      tone: longRunningCount > 0 ? "amber" : "green",
      note: "运行时长超出预估窗口",
    },
    {
      key: "repeatFailed",
      label: "重复失败",
      value: repeatedFailureCount,
      tone: repeatedFailureCount > 0 ? "red" : "green",
      note: "24h 内失败次数大于等于 2",
    },
    {
      key: "offlineEndpoints",
      label: "离线端点",
      value: offlineEndpointCount,
      tone: offlineEndpointCount > 0 ? "red" : "cyan",
      note: `来源 ${sourceOfflineCount} / 目标 ${targetOfflineCount}`,
    },
    {
      key: "runRate",
      label: "运行速率",
      value: runRateValue,
      suffix: runRateSuffix,
      precision: runRatePrecision,
      tone: "blue",
      note: `24h 累计 ${formatNumber(volume24h, 0)} 条`,
    },
    {
      key: "avgDuration",
      label: "平均耗时",
      value: avgDurationSeconds,
      suffix: "秒",
      precision: 0,
      tone: avgDurationSeconds >= 3600 ? "amber" : "green",
      note: `P95 ${formatNumber(p95DurationSeconds, 0)} 秒`,
    },
  ];

  return {
    generatedAt,
    isEmpty: false,
    sampleTaskCount: tasks.length,
    runCoverage: tasks.length ? coveredTaskCount / tasks.length : 1,
    ...{ summaryCards: [
      {
        key: "totalTasks",
        label: "接入任务",
        value: tasks.length,
        tone: "blue",
        note: `启用 ${activeSignals.length} / 暂停 ${pausedSignals.length}`,
      },
      {
        key: "sourceSystems",
        label: "来源系统",
        value: uniqueSources,
        tone: "cyan",
        note: `目标系统 ${uniqueTargets} 个`,
      },
      {
        key: "todayRuns",
        label: "24h 实例",
        value: recentRuns.length,
        tone: "green",
        note: `成功 ${completedRuns.length} / 失败 ${failedRuns.length}`,
      },
      {
        key: "successRate",
        label: "24h 成功率",
        value: roundTo(successRate * 100, 1),
        suffix: "%",
        precision: 1,
        tone: successRate >= 0.95 ? "green" : successRate >= 0.85 ? "amber" : "red",
        note: `高风险任务 ${riskTasks.length} 条`,
      },
      {
        key: "slaRate",
        label: "SLA 达成率",
        value: roundTo(slaRate * 100, 1),
        suffix: "%",
        precision: 1,
        tone: slaRate >= 0.92 ? "cyan" : slaRate >= 0.8 ? "amber" : "red",
        note: `${Math.max(scheduledSignals.length - onTimeCount, 0)} 条临近或已破线`,
      },
      {
        key: "alerts",
        label: "当前告警",
        value: exceptionSummary.total,
        tone: exceptionSummary.critical > 0 ? "red" : exceptionSummary.high > 0 ? "amber" : "cyan",
        note: `P1 ${exceptionSummary.critical} / P2 ${exceptionSummary.high}`,
      },
      {
        key: "health",
        label: "链路健康分",
        value: healthScore,
        tone: healthScore >= 85 ? "green" : healthScore >= 70 ? "amber" : "red",
        note: resolveHealthStatus(healthScore),
      },
      {
        key: "coverage",
        label: "运行覆盖率",
        value: roundTo((tasks.length ? coveredTaskCount / tasks.length : 1) * 100, 1),
        suffix: "%",
        precision: 1,
        tone: coveredTaskCount === tasks.length ? "green" : "amber",
        note: `已装载 ${coveredTaskCount}/${tasks.length} 条运行记录`,
      },
    ] },
    summaryCards: dashboardSummaryCards,
    watchMetrics,
    sourceTypeDistribution: buildDistribution(taskSignals.map((signal) => signal.sourceTypeLabel)),
    targetTypeDistribution: buildDistribution(taskSignals.map((signal) => signal.targetTypeLabel)),
    syncModeDistribution: buildDistribution(taskSignals.map((signal) => SYNC_MODE_LABELS[signal.task.syncMode] || signal.task.syncMode)),
    ownerRanking,
    topology,
    topologyByWeight,
    trendBuckets,
    trendBucketsByRange,
    healthScore,
    healthStatus: resolveHealthStatus(healthScore),
    healthDimensions,
    exceptionSummary,
    runtimeStatus: {
      pending: taskSignals.filter((signal) => signal.latestRun?.runStatus === "pending").length,
      running: taskSignals.filter((signal) => signal.latestRun?.runStatus === "running" || signal.task.status === "running").length,
      completed: taskSignals.filter((signal) => signal.latestRun?.runStatus === "completed").length,
      failed: taskSignals.filter((signal) => signal.latestRun?.runStatus === "failed" || signal.task.lastRunStatus === "failed").length,
      paused: pausedSignals.length,
      inactive: inactiveSignals.length,
    },
    riskTasks,
    runtimeBoard: riskTasks,
    durationRanking,
    events,
    healthMatrix: buildHealthMatrix(taskSignals),
    sourceClusters,
  };
}

function deriveTaskSignal(
  task: IngestionTask,
  runs: JobRun[],
  dataSourceMap: Map<number, DataSourceRecord>,
  nowTs: number,
): TaskSignal {
  const source = dataSourceMap.get(task.sourceId);
  const target = dataSourceMap.get(task.targetSourceId);
  const latestRun = runs[0] || null;
  const latestSuccessRun = runs.find((run) => run.runStatus === "completed") || null;
  const sourceName = task.sourceName || source?.sourceName || `来源#${task.sourceId}`;
  const targetName = task.targetSourceName || target?.sourceName || `目标#${task.targetSourceId}`;
  const sourceTypeLabel = getSourceTypeLabel(task.sourceType || source?.sourceType);
  const targetTypeLabel = getTargetTypeLabel(task.targetType || target?.sourceType);
  const expectedWindowMinutes = getExpectedWindowMinutes(task);
  const referenceTime = latestSuccessRun?.endTime || latestSuccessRun?.startTime || task.lastEndTime || task.lastRunTime || null;
  const freshnessMinutes = task.scheduleEnabled && referenceTime
    ? Math.max(0, Math.round((nowTs - toTimestamp(referenceTime)) / 60000))
    : null;
  const longRunning = latestRun?.runStatus === "running"
    ? getRunDurationMinutes(latestRun, nowTs) > Math.max(expectedWindowMinutes * 1.2, 15)
    : false;
  const recentRuns = runs.filter((run) => toTimestamp(run.startTime) >= nowTs - DAY_MS);
  const recentFailureCount = recentRuns.filter((run) => run.runStatus === "failed").length;
  const latestFailed = latestRun?.runStatus === "failed" || task.lastRunStatus === "failed";
  const slaOnTime = !task.scheduleEnabled || (freshnessMinutes !== null && freshnessMinutes <= Math.round(expectedWindowMinutes * 1.25));
  const sourceOffline = Boolean(source && source.connectionStatus === "offline" && task.status !== "draft");
  const targetOffline = Boolean(target && target.connectionStatus === "offline" && task.status !== "draft");

  const issues: string[] = [];
  if (sourceOffline) issues.push("来源离线");
  if (targetOffline) issues.push("目标离线");
  if (latestFailed) issues.push("最近运行失败");
  if (recentFailureCount >= 2) issues.push("24h 重复失败");
  if (!slaOnTime && task.scheduleEnabled) issues.push("SLA 破线");
  if (longRunning) issues.push("运行时长超阈值");
  if (task.status === "paused") issues.push("任务已暂停");
  if ((task.status === "draft" || task.status === "stopped") && task.scheduleEnabled) issues.push("任务未启用");

  const structureScore = clamp(
    30
    + (task.fieldMappings?.length ? 24 : 0)
    + (task.targetTable ? 16 : 0)
    + (task.ownerName ? 10 : 0)
    + (!sourceOffline ? 10 : 0)
    + (!targetOffline ? 10 : 0),
    0,
    100,
  );
  const timelinessScore = task.scheduleEnabled
    ? (slaOnTime
      ? clamp(100 - Math.max((freshnessMinutes || 0) / Math.max(expectedWindowMinutes, 1) * 10, 0), 70, 100)
      : clamp(60 - Math.max(((freshnessMinutes || expectedWindowMinutes) - expectedWindowMinutes) / Math.max(expectedWindowMinutes, 1) * 40, 0), 10, 60))
    : 88;
  const stabilityScore = latestFailed
    ? clamp(45 - recentFailureCount * 6, 12, 45)
    : recentFailureCount
      ? clamp(72 - recentFailureCount * 4, 40, 72)
      : 96;
  const loadScore = longRunning
    ? 35
    : latestRun?.runStatus === "running"
      ? 72
      : latestRun?.runStatus === "pending"
        ? 78
        : 92;

  let healthScore = 100;
  if (task.status === "paused") healthScore -= 18;
  if (task.status === "draft" || task.status === "stopped") healthScore -= 32;
  if (latestFailed) healthScore -= 28;
  healthScore -= Math.min(recentFailureCount * 7, 18);
  if (!slaOnTime && task.scheduleEnabled) {
    const breachPenalty = freshnessMinutes === null
      ? 24
      : Math.min(28, 12 + Math.round((freshnessMinutes / Math.max(expectedWindowMinutes, 1)) * 8));
    healthScore -= breachPenalty;
  }
  if (longRunning) healthScore -= 18;
  if (sourceOffline) healthScore -= 16;
  if (targetOffline) healthScore -= 12;
  if (!latestSuccessRun && task.scheduleEnabled) healthScore -= 10;
  healthScore = clamp(healthScore, 0, 100);

  let severity: MonitorSeverity = "low";
  if (sourceOffline || targetOffline || (healthScore < 45 && latestFailed)) {
    severity = "critical";
  } else if (latestFailed || !slaOnTime || longRunning || recentFailureCount >= 2) {
    severity = "high";
  } else if (task.status === "paused" || healthScore < 75) {
    severity = "medium";
  }

  return {
    task,
    sourceName,
    targetName,
    sourceTypeLabel,
    targetTypeLabel,
    latestRun,
    latestSuccessRun,
    healthScore,
    severity,
    issues,
    freshnessMinutes,
    expectedWindowMinutes,
    slaOnTime,
    longRunning,
    latestFailed,
    sourceOffline,
    targetOffline,
    recentFailureCount,
    structureScore,
    timelinessScore,
    stabilityScore,
    loadScore,
    recordsCount: safeNumber(latestRun?.recordsCount),
  };
}

function buildEvents(taskSignals: TaskSignal[]): MonitorEventItem[] {
  const events: MonitorEventItem[] = [];

  for (const signal of taskSignals) {
    const timestamp = signal.latestRun?.endTime || signal.latestRun?.startTime || signal.task.lastRunTime || null;

    if (signal.sourceOffline) {
      events.push({
        id: `source-offline-${signal.task.id}`,
        taskId: signal.task.id,
        severity: "critical",
        type: "source-offline",
        title: "来源连接异常",
        detail: `${signal.sourceName} 当前离线，已影响 ${signal.task.taskName}`,
        timestamp,
        taskName: signal.task.taskName,
        ownerName: signal.task.ownerName || "-",
      });
    }

    if (signal.targetOffline) {
      events.push({
        id: `target-offline-${signal.task.id}`,
        taskId: signal.task.id,
        severity: "critical",
        type: "target-offline",
        title: "目标落地异常",
        detail: `${signal.targetName} 当前离线，落库链路需尽快处置`,
        timestamp,
        taskName: signal.task.taskName,
        ownerName: signal.task.ownerName || "-",
      });
    }

    if (signal.latestFailed) {
      const error = String(signal.latestRun?.errorMessage || "执行过程出现异常");
      events.push({
        id: `failed-${signal.task.id}`,
        taskId: signal.task.id,
        severity: signal.healthScore < 45 ? "critical" : "high",
        type: "failed",
        title: "任务运行失败",
        detail: `${signal.task.taskName} 最近一次执行失败，${error.slice(0, 88)}`,
        timestamp,
        taskName: signal.task.taskName,
        ownerName: signal.task.ownerName || "-",
      });
    }

    if (!signal.slaOnTime && signal.task.scheduleEnabled) {
      events.push({
        id: `freshness-${signal.task.id}`,
        taskId: signal.task.id,
        severity: signal.freshnessMinutes !== null && signal.freshnessMinutes > signal.expectedWindowMinutes * 2 ? "critical" : "high",
        type: "freshness",
        title: "SLA 预警",
        detail: `${signal.task.taskName} 已滞后 ${formatDurationMinutes(signal.freshnessMinutes)}，超出预期窗口`,
        timestamp: signal.latestSuccessRun?.endTime || signal.task.lastRunTime || timestamp,
        taskName: signal.task.taskName,
        ownerName: signal.task.ownerName || "-",
      });
    }

    if (signal.longRunning) {
      events.push({
        id: `running-timeout-${signal.task.id}`,
        taskId: signal.task.id,
        severity: "high",
        type: "running-timeout",
        title: "运行时长超阈值",
        detail: `${signal.task.taskName} 当前实例持续运行，疑似积压或阻塞`,
        timestamp,
        taskName: signal.task.taskName,
        ownerName: signal.task.ownerName || "-",
      });
    }

    if ((signal.task.status === "paused" || signal.task.status === "stopped") && signal.task.scheduleEnabled) {
      events.push({
        id: `paused-${signal.task.id}`,
        taskId: signal.task.id,
        severity: "medium",
        type: "paused",
        title: "任务未处于执行态",
        detail: `${signal.task.taskName} 当前为 ${getTaskStatusLabel(signal.task.status)}，请确认是否符合排产计划`,
        timestamp: signal.task.updatedAt || timestamp,
        taskName: signal.task.taskName,
        ownerName: signal.task.ownerName || "-",
      });
    }
  }

  return events.sort((left, right) => {
    const severityDelta = getSeverityWeight(right.severity) - getSeverityWeight(left.severity);
    if (severityDelta !== 0) return severityDelta;
    return toTimestamp(right.timestamp) - toTimestamp(left.timestamp);
  });
}

function buildRiskTasks(taskSignals: TaskSignal[]): MonitorRiskTask[] {
  return taskSignals
    .map((signal) => ({
      key: `task-${signal.task.id}`,
      taskId: signal.task.id,
      taskName: signal.task.taskName,
      ownerName: signal.task.ownerName || "-",
      sourceName: signal.sourceName,
      targetName: signal.targetName,
      syncModeLabel: SYNC_MODE_LABELS[signal.task.syncMode] || signal.task.syncMode,
      taskStatus: getTaskStatusLabel(signal.task.status),
      lastRunStatus: getRunStatusLabel(signal.latestRun?.runStatus || signal.task.lastRunStatus || "unknown"),
      freshnessMinutes: signal.freshnessMinutes,
      healthScore: signal.healthScore,
      severity: signal.severity,
      issueSummary: signal.issues.length ? signal.issues.join(" / ") : "链路稳定",
      issueCount: signal.issues.length,
      lastRunTime: signal.latestRun?.startTime || signal.task.lastRunTime || null,
      volume: signal.recordsCount,
      taskStatusCode: signal.task.status,
      lastRunStatusCode: signal.latestRun?.runStatus || signal.task.lastRunStatus || "unknown",
      scheduleEnabled: signal.task.scheduleEnabled,
      latestFailed: signal.latestFailed,
      slaBreached: !signal.slaOnTime && signal.task.scheduleEnabled,
      longRunning: signal.longRunning,
      sourceOffline: signal.sourceOffline,
      targetOffline: signal.targetOffline,
      recentFailureCount: signal.recentFailureCount,
    }))
    .sort((left, right) => {
      const severityDelta = getSeverityWeight(right.severity) - getSeverityWeight(left.severity);
      if (severityDelta !== 0) return severityDelta;
      const healthDelta = left.healthScore - right.healthScore;
      if (healthDelta !== 0) return healthDelta;
      return (right.freshnessMinutes || 0) - (left.freshnessMinutes || 0);
    });
}

function buildDurationRanking(
  taskSignals: TaskSignal[],
  runsByTask: Map<number, JobRun[]>,
  nowTs: number,
): MonitorDurationItem[] {
  return taskSignals
    .map((signal) => {
      const recentRuns = (runsByTask.get(signal.task.id) || [])
        .filter((run) => toTimestamp(run.startTime) >= nowTs - DAY_MS)
        .filter((run) => run.runStatus === "completed" || run.runStatus === "failed");
      const durationCandidates = recentRuns
        .map((run) => getRunDurationSeconds(run, nowTs))
        .filter((value) => value > 0);
      const fallbackDuration = signal.latestRun ? getRunDurationSeconds(signal.latestRun, nowTs) : 0;
      const durationSeconds = durationCandidates.length
        ? Math.max(...durationCandidates)
        : Math.max(fallbackDuration, 0);
      return {
        key: `duration-${signal.task.id}`,
        taskId: signal.task.id,
        taskName: signal.task.taskName,
        durationSeconds,
        ownerName: signal.task.ownerName || "-",
        sourceName: signal.sourceName,
        targetName: signal.targetName,
        runStatus: signal.latestRun?.runStatus || signal.task.lastRunStatus || "unknown",
      };
    })
    .filter((item) => item.durationSeconds > 0)
    .sort((left, right) => {
      const durationDelta = right.durationSeconds - left.durationSeconds;
      if (durationDelta !== 0) return durationDelta;
      return left.taskName.localeCompare(right.taskName, "zh-CN");
    });
}

function buildHealthMatrix(taskSignals: TaskSignal[]): MonitorHealthMatrixRow[] {
  return taskSignals
    .slice()
    .sort((left, right) => {
      const severityDelta = getSeverityWeight(right.severity) - getSeverityWeight(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return left.healthScore - right.healthScore;
    })
    .slice(0, 6)
    .map((signal) => ({
      key: `matrix-${signal.task.id}`,
      taskId: signal.task.id,
      taskName: signal.task.taskName,
      ownerName: signal.task.ownerName || "-",
      severity: signal.severity,
      cells: [
        { label: "时效", value: Math.round(signal.timelinessScore) },
        { label: "稳定", value: Math.round(signal.stabilityScore) },
        { label: "结构", value: Math.round(signal.structureScore) },
        { label: "负载", value: Math.round(signal.loadScore) },
      ],
    }));
}

function buildHealthDimensions(
  taskSignals: TaskSignal[],
  successRate: number,
  freshnessRate: number,
  coveredTaskCount: number,
  totalTaskCount: number,
  slaRate: number,
): MonitorHealthDimension[] {
  const structureScore = taskSignals.length
    ? Math.round(taskSignals.reduce((sum, signal) => sum + signal.structureScore, 0) / taskSignals.length)
    : 100;
  const loadScore = taskSignals.length
    ? Math.round(taskSignals.reduce((sum, signal) => sum + signal.loadScore, 0) / taskSignals.length)
    : 100;

  return [
    {
      key: "timeliness",
      label: "时效",
      value: roundTo(slaRate * 100, 1),
      note: "按计划窗口判断是否破线",
    },
    {
      key: "stability",
      label: "稳定",
      value: roundTo(successRate * 100, 1),
      note: "最近 24h 终态实例成功率",
    },
    {
      key: "freshness",
      label: "新鲜",
      value: roundTo(freshnessRate * 100, 1),
      note: "活跃任务最近成功落地时效",
    },
    {
      key: "structure",
      label: "结构",
      value: structureScore,
      note: "映射、归属、链路可用性综合评分",
    },
    {
      key: "coverage",
      label: "观测",
      value: roundTo((totalTaskCount ? coveredTaskCount / totalTaskCount : 1) * 100, 1),
      note: `运行记录覆盖 ${coveredTaskCount}/${totalTaskCount}`,
    },
    {
      key: "load",
      label: "负载",
      value: loadScore,
      note: "待执行、运行中、超时实例综合水位",
    },
  ];
}

function buildTopology(taskSignals: TaskSignal[], weightMode: MonitorTopologyWeightMode = "volume") {
  const sourceTotals = sumValuesBy(taskSignals, (signal) => signal.sourceName, (signal) => getTopologyWeight(signal, weightMode));
  const targetTotals = sumValuesBy(taskSignals, (signal) => signal.targetName, (signal) => getTopologyWeight(signal, weightMode));
  const topSources = new Set([...sourceTotals.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([name]) => name));
  const topTargets = new Set([...targetTotals.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([name]) => name));

  const nodeMap = new Map<string, MonitorTopologyNode>();
  const linkMap = new Map<string, MonitorTopologyLink>();

  for (const signal of taskSignals) {
    const sourceLabel = topSources.has(signal.sourceName) ? signal.sourceName : "其他来源";
    const targetLabel = topTargets.has(signal.targetName) ? signal.targetName : "其他目标";
    const modeLabel = SYNC_MODE_LABELS[signal.task.syncMode] || signal.task.syncMode;
    const sourceKey = `source::${sourceLabel}`;
    const modeKey = `mode::${modeLabel}`;
    const targetKey = `target::${targetLabel}`;
    const linkValue = getTopologyWeight(signal, weightMode);

    nodeMap.set(sourceKey, { name: sourceKey, displayName: sourceLabel, category: "source" });
    nodeMap.set(modeKey, { name: modeKey, displayName: modeLabel, category: "mode" });
    nodeMap.set(targetKey, { name: targetKey, displayName: targetLabel, category: "target" });
    addLink(linkMap, sourceKey, modeKey, linkValue);
    addLink(linkMap, modeKey, targetKey, linkValue);
  }

  return {
    nodes: [...nodeMap.values()],
    links: [...linkMap.values()],
  };
}

function buildTrendBuckets(runs: JobRun[], nowTs: number, range: MonitorTrendRange = "24h"): MonitorTrendBucket[] {
  const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const bucketSizeMs = range === "24h" ? 60 * 60 * 1000 : DAY_MS;
  const formatter = (bucketTime: Date) => {
    if (range === "24h") {
      return bucketTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return bucketTime.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  };

  const buckets = Array.from({ length: bucketCount }, (_item, index) => {
    const bucketTime = new Date(nowTs - (bucketCount - 1 - index) * bucketSizeMs);
    return {
      label: formatter(bucketTime),
      totalRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      volume: 0,
    };
  });

  for (const run of runs) {
    const timestamp = toTimestamp(run.startTime);
    if (!timestamp || timestamp < nowTs - bucketCount * bucketSizeMs) continue;
    const bucketIndex = bucketCount - 1 - Math.floor((nowTs - timestamp) / bucketSizeMs);
    if (bucketIndex < 0 || bucketIndex >= buckets.length) continue;

    const bucket = buckets[bucketIndex];
    bucket.totalRuns += 1;
    bucket.volume += safeNumber(run.recordsCount);
    if (run.runStatus === "completed") bucket.successRuns += 1;
    if (run.runStatus === "failed") bucket.failedRuns += 1;
  }

  return buckets;
}

function buildExceptionSummary(events: MonitorEventItem[], taskSignals: TaskSignal[]): MonitorExceptionSummary {
  return {
    total: events.length,
    critical: events.filter((item) => item.severity === "critical").length,
    high: events.filter((item) => item.severity === "high").length,
    medium: events.filter((item) => item.severity === "medium").length,
    low: events.filter((item) => item.severity === "low").length,
    freshness: events.filter((item) => item.type === "freshness").length,
    runningTimeout: events.filter((item) => item.type === "running-timeout").length,
    failed: events.filter((item) => item.type === "failed").length,
    blocked: taskSignals.filter((signal) => signal.severity === "critical").length,
  };
}

function buildSourceClusters(taskSignals: TaskSignal[], dataSourceMap: Map<number, DataSourceRecord>): MonitorSourceCluster[] {
  const groups = new Map<string, MonitorSourceCluster>();

  for (const signal of taskSignals) {
    const key = signal.task.sourceId ? `source-${signal.task.sourceId}` : signal.sourceName;
    const sourceRecord = dataSourceMap.get(signal.task.sourceId);
    const current = groups.get(key) || {
      key,
      sourceId: signal.task.sourceId || null,
      sourceName: signal.sourceName,
      sourceTypeLabel: signal.sourceTypeLabel,
      statusLabel: getConnectionStatusLabel(sourceRecord?.connectionStatus),
      taskCount: 0,
      activeTaskCount: 0,
      riskCount: 0,
    };

    current.taskCount += 1;
    if (signal.task.status === "active" || signal.task.status === "running") current.activeTaskCount += 1;
    if (signal.severity === "high" || signal.severity === "critical") current.riskCount += 1;
    groups.set(key, current);
  }

  return [...groups.values()].sort((left, right) => {
    if (right.riskCount !== left.riskCount) return right.riskCount - left.riskCount;
    return right.taskCount - left.taskCount;
  });
}

function buildOwnerRanking(taskSignals: TaskSignal[]): MonitorDistributionDatum[] {
  const ranking = new Map<string, number>();

  for (const signal of taskSignals) {
    const key = signal.task.ownerName || "未分配";
    const value = signal.severity === "critical" ? 3 : signal.severity === "high" ? 2 : signal.severity === "medium" ? 1 : 0;
    ranking.set(key, (ranking.get(key) || 0) + value);
  }

  return [...ranking.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function buildDistribution(values: string[]): MonitorDistributionDatum[] {
  return [...countValues(values).entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function addLink(linkMap: Map<string, MonitorTopologyLink>, source: string, target: string, value: number) {
  const key = `${source}__${target}`;
  const existing = linkMap.get(key);
  if (existing) {
    existing.value += value;
    return;
  }
  linkMap.set(key, { source, target, value });
}

function countValues(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) {
    map.set(value, (map.get(value) || 0) + 1);
  }
  return map;
}

function sumValuesBy<T>(items: T[], getKey: (item: T) => string, getValue: (item: T) => number) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, (map.get(key) || 0) + getValue(item));
  }
  return map;
}

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function sortRuns(runs: JobRun[]) {
  return runs.slice().sort((left, right) => toTimestamp(right.startTime) - toTimestamp(left.startTime));
}

function getExpectedWindowMinutes(task: IngestionTask) {
  const scheduleType = task.scheduleConfig?.scheduleType;
  if (scheduleType === "interval" && task.scheduleConfig?.intervalMs) {
    return Math.max(5, Math.round(task.scheduleConfig.intervalMs / 60000));
  }
  if (scheduleType === "daily") return 24 * 60;
  if (scheduleType === "weekly") return 7 * 24 * 60;
  if (scheduleType === "monthly") return 30 * 24 * 60;
  if (scheduleType === "cron") {
    if (task.syncMode === "cdc") return 30;
    if (task.syncMode === "incremental") return 180;
    return 720;
  }
  if (task.syncMode === "cdc") return 30;
  if (task.syncMode === "incremental") return 240;
  return 24 * 60;
}

function getSourceTypeLabel(value?: string | null) {
  return SOURCE_TYPE_LABELS[String(value || "").toLowerCase()] || String(value || "其他");
}

function getTargetTypeLabel(value?: string | null) {
  return TARGET_TYPE_LABELS[String(value || "").toLowerCase()] || String(value || "其他");
}

function getSeverityWeight(value: MonitorSeverity) {
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function getConnectionStatusLabel(value?: string | null) {
  if (value === "online") return "在线";
  if (value === "offline") return "离线";
  if (value === "disabled") return "停用";
  return "未知";
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getRunDurationMinutes(run: JobRun, nowTs: number) {
  const startTs = toTimestamp(run.startTime);
  const endTs = toTimestamp(run.endTime) || nowTs;
  if (!startTs || endTs <= startTs) return 0;
  return Math.round((endTs - startTs) / 60000);
}

function getRunDurationSeconds(run: JobRun, nowTs: number) {
  const startTs = toTimestamp(run.startTime);
  const endTs = toTimestamp(run.endTime) || nowTs;
  if (!startTs || endTs <= startTs) return 0;
  return Math.max(1, Math.round((endTs - startTs) / 1000));
}

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getTopologyWeight(signal: TaskSignal, weightMode: MonitorTopologyWeightMode) {
  if (weightMode === "tasks") {
    return 1;
  }
  return Math.max(1, safeNumber(signal.recordsCount));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, precision = 0) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function resolveHealthStatus(score: number) {
  if (score >= 90) return "运行稳定";
  if (score >= 80) return "整体健康";
  if (score >= 70) return "存在波动";
  if (score >= 55) return "风险偏高";
  return "需重点处置";
}

export function getTaskStatusLabel(status?: string | null) {
  return TASK_STATUS_LABELS[String(status || "")] || String(status || "-");
}

export function getRunStatusLabel(status?: string | null) {
  return RUN_STATUS_LABELS[String(status || "")] || String(status || "-");
}

export function getSeverityLabel(severity: MonitorSeverity) {
  if (severity === "critical") return "P1";
  if (severity === "high") return "P2";
  if (severity === "medium") return "P3";
  return "P4";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function formatDurationMinutes(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (value < 60) return `${Math.round(value)} 分钟`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  if (hours < 24) return `${hours} 小时 ${minutes} 分钟`;
  const days = Math.floor(hours / 24);
  return `${days} 天 ${hours % 24} 小时`;
}

export function formatNumber(value: number, precision = 0) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
