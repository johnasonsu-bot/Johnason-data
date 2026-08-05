import {
  ClockCircleOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Segmented, Spin, Tag } from "antd";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  fetchDataServiceApps,
  fetchDataServiceAuthorizations,
  fetchDataServiceLogs,
  fetchDataServiceOpsDashboard,
  fetchDataServiceOverview,
  fetchDataServices,
} from "../../services/dataServices";
import type {
  DataServiceAppRecord,
  DataServiceAuthorizationRecord,
  DataServiceLogRecord,
  DataServiceOverview,
  DataServiceRecord,
} from "../../types/api";
import "./dataServiceOpsDashboard.css";

type DashboardRange = "24h" | "7d" | "30d";
type TrendKey = "calls" | "activeApps" | "latencyMs";

type FlipMetric = {
  key: string;
  label: string;
  value: string;
  accent?: string;
  accentTone?: "blue" | "green" | "amber";
};

type TrendPoint = {
  label: string;
  calls: number;
  activeApps: number;
  latencyMs: number;
};

type RankBarItem = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  tone: "blue" | "cyan" | "gold";
};

type StatusMetric = {
  publishedRate: number;
  runningCount: number;
  pendingCount: number;
  inactiveCount: number;
};

type AuthorizationMetric = {
  tableCount: number;
  sqlCount: number;
};

type AppActivityMetric = {
  highCount: number;
  mediumCount: number;
  lowCount: number;
  total: number;
};

type ReminderMetric = {
  slowCalls: number;
  failedCalls: number;
  pendingAuthorizations: number;
};

type DashboardModel = {
  generatedAt: string;
  heroStatus: string;
  flipMetrics: FlipMetric[];
  trendByRange: Record<DashboardRange, TrendPoint[]>;
  serviceRanksByRange: Record<DashboardRange, RankBarItem[]>;
  departmentRanksByRange: Record<DashboardRange, RankBarItem[]>;
  statusMetric: StatusMetric;
  authorizationMetric: AuthorizationMetric;
  appActivityMetric: AppActivityMetric;
  reminderMetric: ReminderMetric;
};

const DASHBOARD_LOG_LIMIT = 1000;
const UNKNOWN_APP_LABEL = "匿名应用";
function isTrackedLog(log: DataServiceLogRecord) {
  return String(log.authType || "").trim().toLowerCase() === "token";
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getRangeWindow(range: DashboardRange, now = new Date()) {
  const todayStart = startOfDay(now);
  if (range === "24h") {
    return { start: todayStart, end: now };
  }

  const days = range === "7d" ? 7 : 30;
  return {
    start: addDays(todayStart, -(days - 1)),
    end: now,
  };
}

function formatNumber(value: number, precision = 0) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function resolveHeroStatus(successRate: number, avgLatencyMs: number, failedCalls: number) {
  if (successRate >= 98 && avgLatencyMs <= 120 && failedCalls <= 2) return "整体健康";
  if (successRate >= 92 && avgLatencyMs <= 500) return "运行平稳";
  return "存在波动";
}

function buildTrendPoints(logs: DataServiceLogRecord[], range: DashboardRange): TrendPoint[] {
  const now = new Date();
  const { start, end } = getRangeWindow(range, now);
  const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const labels = Array.from({ length: bucketCount }, (_item, index) => {
    const bucketTime = range === "24h"
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), index)
      : addDays(start, index);
    return range === "24h"
      ? bucketTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
      : bucketTime.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  });
  const buckets = labels.map((label) => ({
    label,
    calls: 0,
    activeApps: 0,
    latencyMs: 0,
  }));
  const latencySums = Array.from({ length: bucketCount }, () => 0);
  const latencyCounts = Array.from({ length: bucketCount }, () => 0);
  const appSets = Array.from({ length: bucketCount }, () => new Set<string>());

  for (const log of logs) {
    const timestamp = new Date(log.calledAt);
    const timeValue = timestamp.getTime();
    if (!Number.isFinite(timeValue) || timeValue < start.getTime() || timeValue > end.getTime()) continue;
    const bucketIndex = range === "24h"
      ? timestamp.getHours()
      : Math.floor((startOfDay(timestamp).getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (bucketIndex < 0 || bucketIndex >= bucketCount) continue;
    buckets[bucketIndex].calls += 1;
    appSets[bucketIndex].add(log.appName || UNKNOWN_APP_LABEL);
    latencySums[bucketIndex] += Number(log.latencyMs || 0);
    latencyCounts[bucketIndex] += 1;
  }

  return buckets.map((bucket, index) => ({
    ...bucket,
    activeApps: appSets[index].size,
    latencyMs: latencyCounts[index] ? Math.round(latencySums[index] / latencyCounts[index]) : 0,
  }));
}

function buildTrendOption(points: TrendPoint[]): EChartsOption {
  const peakIndex = points.reduce((bestIndex, item, index, array) => (
    item.calls > array[bestIndex].calls ? index : bestIndex
  ), 0);
  const peakPoint = points.length ? [{
    name: "调用高峰",
    coord: [points[peakIndex].label, points[peakIndex].calls] as [string, number],
    value: points[peakIndex].calls,
  }] : [];

  return {
    animation: false,
    grid: { left: 12, right: 14, top: 46, bottom: 24, containLabel: true },
    xAxis: {
      type: "category",
      data: points.map((item) => item.label),
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#c7e6f8" } },
      axisTick: { show: false },
      axisLabel: { color: "#6b8aa5", margin: 12 },
    },
    yAxis: [
      {
        type: "value",
        splitLine: { lineStyle: { color: "#d7ecf8" } },
        axisLabel: { color: "#6b8aa5" },
      },
      {
        type: "value",
        splitLine: { show: false },
        axisLabel: {
          color: "#6b8aa5",
          formatter: (value: number) => `${value}ms`,
        },
      },
    ],
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255,255,255,0.98)",
      borderColor: "#8ed0f5",
      textStyle: { color: "#18324f" },
    },
    series: [
      {
        name: "调用量",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        itemStyle: { color: "#1b84f2", borderColor: "#ffffff", borderWidth: 2 },
        lineStyle: { width: 5, color: "#1b84f2" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(27,132,242,0.20)" },
              { offset: 1, color: "rgba(27,132,242,0.02)" },
            ],
          },
        },
        markPoint: peakPoint.length ? {
          symbolSize: 10,
          itemStyle: { color: "#1b84f2" },
          data: peakPoint,
        } : undefined,
        data: points.map((item) => item.calls),
      },
      {
        name: "活跃应用",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        itemStyle: { color: "#24c0d8", borderColor: "#ffffff", borderWidth: 2 },
        lineStyle: { width: 4, color: "#24c0d8" },
        data: points.map((item) => item.activeApps),
      },
      {
        name: "平均延迟",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: "#ffad1f", borderColor: "#ffffff", borderWidth: 2 },
        lineStyle: { width: 4, color: "#ffad1f" },
        data: points.map((item) => item.latencyMs),
      },
    ],
  };
}

function buildStatusMetric(services: DataServiceRecord[]) {
  const totalServices = Math.max(services.length, 1);
  const publishedCount = services.filter((item) => item.status === "published").length;
  const runningCount = services.filter((item) => item.status === "published").length;
  const pendingCount = services.filter((item) => item.status === "draft").length;
  const inactiveCount = services.filter((item) => item.status === "disabled").length;
  return {
    publishedRate: Math.round((publishedCount / totalServices) * 100),
    runningCount,
    pendingCount,
    inactiveCount,
  };
}

function filterLogsByRange(logs: DataServiceLogRecord[], range: DashboardRange) {
  const { start, end } = getRangeWindow(range);
  const startTime = start.getTime();
  const endTime = end.getTime();
  return logs.filter((log) => {
    const timestamp = new Date(log.calledAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= startTime && timestamp <= endTime;
  });
}

function buildAuthorizationMetric(services: DataServiceRecord[]) {
  return {
    tableCount: services.filter((item) => item.serviceMode === "table").length,
    sqlCount: services.filter((item) => item.serviceMode === "sql").length,
  };
}

function buildAppActivityMetric(apps: DataServiceAppRecord[], logs: DataServiceLogRecord[]) {
  const appCounts = new Map<string, number>();
  logs.forEach((log) => {
    const appName = log.appName || UNKNOWN_APP_LABEL;
    appCounts.set(appName, (appCounts.get(appName) || 0) + 1);
  });

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  const sourceNames = new Set<string>([
    ...apps.map((item) => item.appName),
    ...appCounts.keys(),
  ]);

  sourceNames.forEach((name) => {
    const count = appCounts.get(name) || 0;
    if (count >= 10) highCount += 1;
    else if (count >= 4) mediumCount += 1;
    else lowCount += 1;
  });

  return {
    highCount,
    mediumCount,
    lowCount,
    total: sourceNames.size,
  };
}

function buildReminderMetric(logs: DataServiceLogRecord[], authorizations: DataServiceAuthorizationRecord[]) {
  return {
    slowCalls: logs.filter((item) => Number(item.latencyMs || 0) > 300).length,
    failedCalls: logs.filter((item) => !item.success).length,
    pendingAuthorizations: authorizations.filter((item) => item.status !== "active").length,
  };
}

function buildDepartmentRanks(apps: DataServiceAppRecord[], logs: DataServiceLogRecord[]): RankBarItem[] {
  const appDepartmentById = new Map<number, string>();
  const appDepartmentByName = new Map<string, string>();

  apps.forEach((app) => {
    const departmentName = String(app.departmentName || "").trim();
    if (!departmentName) return;
    appDepartmentById.set(app.id, departmentName);
    appDepartmentByName.set(app.appName, departmentName);
  });

  const departmentCounts = new Map<string, number>();
  logs.forEach((log) => {
    const appName = log.appName || UNKNOWN_APP_LABEL;
    const department = (
      (typeof log.appId === "number" ? appDepartmentById.get(log.appId) : undefined)
      || appDepartmentByName.get(appName)
    );
    if (!department) return;
    departmentCounts.set(department, (departmentCounts.get(department) || 0) + 1);
  });

  return [...departmentCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value], index) => ({
      key: `department-${label}`,
      label,
      value,
      displayValue: `${formatNumber(value)}次`,
      tone: (index % 3 === 0 ? "blue" : index % 3 === 1 ? "cyan" : "gold") as RankBarItem["tone"],
    }));
}

function buildServiceRanks(logs: DataServiceLogRecord[]) {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    const label = log.serviceName || log.serviceCode;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const source = [...counts.entries()].map(([label, value]) => ({ label, value }));

  return source
    .sort((left, right) => right.value - left.value)
    .slice(0, 5)
    .map((item, index) => ({
      key: `service-${item.label}`,
      label: item.label,
      value: item.value,
      displayValue: `${formatNumber(item.value)}次`,
      tone: (index % 3 === 0 ? "blue" : index % 3 === 1 ? "cyan" : "gold") as RankBarItem["tone"],
    }));
}

function buildFlipMetrics(
  overview: DataServiceOverview | null,
  services: DataServiceRecord[],
  apps: DataServiceAppRecord[],
  authorizations: DataServiceAuthorizationRecord[],
  logs: DataServiceLogRecord[],
): FlipMetric[] {
  const publishedCount = overview?.publishedServices || services.filter((item) => item.status === "published").length;
  const totalApps = overview?.totalApps || apps.length;
  const totalCalls = overview?.totalCallsToday || logs.length;
  const successRate = overview?.successRateToday || 0;
  const coverageRate = services.length ? Math.round((publishedCount / Math.max(services.length, 1)) * 100) : 0;

  return [
    { key: "services", label: "发布服务数", value: String(publishedCount), accent: `+${Math.max(publishedCount - 1, 0)}`, accentTone: "blue" },
    { key: "apps", label: "应用数", value: String(totalApps), accent: `活跃${Math.max(totalApps, 0)}`, accentTone: "green" },
    { key: "authorizations", label: "授权数", value: String(authorizations.length), accent: `覆盖${coverageRate}%`, accentTone: "blue" },
    { key: "calls", label: "今日调用量", value: String(totalCalls), accent: totalCalls ? "+12%" : "0%", accentTone: "green" },
    { key: "success", label: "平均成功率", value: `${Math.round(successRate)}%`, accent: undefined },
  ];
}

function buildDashboardModel(
  overview: DataServiceOverview | null,
  services: DataServiceRecord[],
  apps: DataServiceAppRecord[],
  authorizations: DataServiceAuthorizationRecord[],
  logs: DataServiceLogRecord[],
): DashboardModel {
  const trackedLogs = logs.filter(isTrackedLog);
  const rangeLogs24h = filterLogsByRange(trackedLogs, "24h");
  const rangeLogs7d = filterLogsByRange(trackedLogs, "7d");
  const rangeLogs30d = filterLogsByRange(trackedLogs, "30d");
  const todayCallCount = rangeLogs24h.length;
  const successCount = rangeLogs24h.filter((item) => item.success).length;
  const failedCalls = todayCallCount - successCount;
  const successRate = todayCallCount ? (successCount / todayCallCount) * 100 : 0;
  const avgLatency = todayCallCount
    ? Math.round(rangeLogs24h.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0) / todayCallCount)
    : 0;
  const publishedCount = overview?.publishedServices || services.filter((item) => item.status === "published").length;
  const totalApps = overview?.totalApps || apps.length;
  const coverageRate = services.length ? Math.round((publishedCount / Math.max(services.length, 1)) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    heroStatus: resolveHeroStatus(successRate, avgLatency, failedCalls),
    flipMetrics: [
      { key: "services", label: "发布服务数", value: String(publishedCount), accent: `+${Math.max(publishedCount - 1, 0)}`, accentTone: "blue" },
      { key: "apps", label: "应用数", value: String(totalApps), accent: `活跃${Math.max(totalApps, 0)}`, accentTone: "green" },
      { key: "authorizations", label: "授权数", value: String(authorizations.length), accent: `覆盖${coverageRate}%`, accentTone: "blue" },
      { key: "calls", label: "今日调用量", value: String(todayCallCount), accent: todayCallCount ? "+12%" : "0%", accentTone: "green" },
      { key: "success", label: "平均成功率", value: `${Math.round(successRate)}%`, accent: undefined },
    ],
    trendByRange: {
      "24h": buildTrendPoints(rangeLogs24h, "24h"),
      "7d": buildTrendPoints(rangeLogs7d, "7d"),
      "30d": buildTrendPoints(rangeLogs30d, "30d"),
    },
    serviceRanksByRange: {
      "24h": buildServiceRanks(rangeLogs24h),
      "7d": buildServiceRanks(rangeLogs7d),
      "30d": buildServiceRanks(rangeLogs30d),
    },
    departmentRanksByRange: {
      "24h": buildDepartmentRanks(apps, rangeLogs24h),
      "7d": buildDepartmentRanks(apps, rangeLogs7d),
      "30d": buildDepartmentRanks(apps, rangeLogs30d),
    },
    statusMetric: buildStatusMetric(services),
    authorizationMetric: buildAuthorizationMetric(services),
    appActivityMetric: buildAppActivityMetric(apps, rangeLogs24h),
    reminderMetric: buildReminderMetric(rangeLogs24h, authorizations),
  };
}

function splitFlipValue(value: string) {
  return value.split("");
}

function buildBarToneClass(tone: RankBarItem["tone"]) {
  return `service-ops-bar service-ops-bar--${tone}`;
}

function buildAccentClass(tone?: FlipMetric["accentTone"]) {
  if (!tone) return "service-ops-flip-card__accent";
  return `service-ops-flip-card__accent service-ops-flip-card__accent--${tone}`;
}

function toggleTrendKey(current: TrendKey[], target: TrendKey) {
  if (current.includes(target)) {
    if (current.length === 1) return current;
    return current.filter((item) => item !== target);
  }
  return [...current, target];
}

function FlipStatCard({ metric }: { metric: FlipMetric }) {
  return (
    <section className="service-ops-flip-card">
      <div className="service-ops-flip-card__label">{metric.label}</div>
      <div className="service-ops-flip-card__digits">
        {splitFlipValue(metric.value).map((digit, index) => (
          <span key={`${metric.key}-${index}`} className={`service-ops-flip-card__digit${digit === "," ? " service-ops-flip-card__digit--plain" : ""}`}>
            {digit}
          </span>
        ))}
        {metric.accent ? <span className={buildAccentClass(metric.accentTone)}>{metric.accent}</span> : null}
      </div>
    </section>
  );
}

function RankBars(props: { title: string; items: RankBarItem[] }) {
  const { title, items } = props;
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="service-ops-panel service-ops-panel--rank">
      <div className="service-ops-panel__header">
        <div className="service-ops-panel__title">{title}</div>
      </div>
      <div className="service-ops-panel__body service-ops-rank-bars">
        {items.map((item) => (
          <div key={item.key} className="service-ops-rank-bars__row">
            <div className="service-ops-rank-bars__head">
              <span>{item.label}</span>
              <strong>{item.displayValue}</strong>
            </div>
            <div className="service-ops-rank-bars__track">
              <div className={buildBarToneClass(item.tone)} style={{ width: `${Math.max((item.value / maxValue) * 100, 12)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServiceStatusCard({ metric }: { metric: StatusMetric }) {
  const total = Math.max(metric.runningCount + metric.pendingCount + metric.inactiveCount, 1);
  const runningAngle = (metric.runningCount / total) * 360;
  const pendingAngle = (metric.pendingCount / total) * 360;
  const inactiveAngle = Math.max(360 - runningAngle - pendingAngle, 0);
  return (
    <section className="service-ops-panel service-ops-panel--spotlight">
      <div className="service-ops-panel__header">
        <div className="service-ops-panel__title">服务状态</div>
      </div>
      <div className="service-ops-panel__body service-ops-panel__body--status service-ops-panel__body--status-grid">
        <div
          className="service-ops-pie service-ops-pie--status"
          style={{
            background: `conic-gradient(#138cff 0deg ${runningAngle}deg, #35e8b3 ${runningAngle}deg ${runningAngle + pendingAngle}deg, #ffdd63 ${runningAngle + pendingAngle}deg ${runningAngle + pendingAngle + inactiveAngle}deg)`,
          }}
        >
          <div className="service-ops-pie__inner">
            <strong>{metric.runningCount}</strong>
            <span>运行中</span>
          </div>
        </div>
        <div className="service-ops-status-list service-ops-status-list--stacked">
          <span className="service-ops-status-chip service-ops-status-chip--blue">运行中 {metric.runningCount}</span>
          <span className="service-ops-status-chip service-ops-status-chip--cyan">待发布 {metric.pendingCount}</span>
          <span className="service-ops-status-chip service-ops-status-chip--gold">停用 {metric.inactiveCount}</span>
        </div>
      </div>
    </section>
  );
}

function AuthorizationCard({ metric }: { metric: AuthorizationMetric }) {
  const total = Math.max(metric.tableCount + metric.sqlCount, 1);
  const tableAngle = (metric.tableCount / total) * 360;
  const sqlAngle = Math.max(360 - tableAngle, 0);
  return (
    <section className="service-ops-panel service-ops-panel--spotlight">
      <div className="service-ops-panel__header">
        <div className="service-ops-panel__title">服务类型统计</div>
      </div>
      <div className="service-ops-panel__body service-ops-panel__body--status service-ops-panel__body--status-grid">
        <div
          className="service-ops-pie service-ops-pie--type"
          style={{
            background: `conic-gradient(#35e8b3 0deg ${tableAngle}deg, #ffdd63 ${tableAngle}deg ${tableAngle + sqlAngle}deg)`,
          }}
        >
          <div className="service-ops-pie__inner">
            <strong>{metric.tableCount}</strong>
            <span>表服务</span>
          </div>
        </div>
        <div className="service-ops-type-list service-ops-type-list--stacked">
          <div className="service-ops-type-list__item">
            <span className="service-ops-activity-levels__dot service-ops-activity-levels__dot--medium" />
            <label>表服务</label>
            <strong>{metric.tableCount}</strong>
          </div>
          <div className="service-ops-type-list__item">
            <span className="service-ops-activity-levels__dot service-ops-activity-levels__dot--low" />
            <label>SQL 服务</label>
            <strong>{metric.sqlCount}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppActivityCard({ metric }: { metric: AppActivityMetric }) {
  return (
    <section className="service-ops-panel service-ops-panel--spotlight">
      <div className="service-ops-panel__header">
        <div className="service-ops-panel__title">应用活跃度</div>
      </div>
      <div className="service-ops-panel__body service-ops-activity-card">
        <div className="service-ops-activity-card__headline">
          <strong>{metric.total}</strong>
          <span>个调用应用</span>
        </div>
        <div className="service-ops-activity-grid">
          <div className="service-ops-activity-grid__item service-ops-activity-grid__item--high">
            <strong>{metric.highCount}</strong>
            <span>高活跃</span>
          </div>
          <div className="service-ops-activity-grid__item service-ops-activity-grid__item--medium">
            <strong>{metric.mediumCount}</strong>
            <span>中活跃</span>
          </div>
          <div className="service-ops-activity-grid__item service-ops-activity-grid__item--low">
            <strong>{metric.lowCount}</strong>
            <span>低活跃</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RemindersCard({ metric }: { metric: ReminderMetric }) {
  return (
    <section className="service-ops-panel service-ops-panel--spotlight">
      <div className="service-ops-panel__header">
        <div className="service-ops-panel__title">运行提醒</div>
      </div>
      <div className="service-ops-panel__body service-ops-reminders">
        <div className="service-ops-reminder">
          <span>慢调用</span>
          <strong>{metric.slowCalls}</strong>
        </div>
        <div className="service-ops-reminder service-ops-reminder--warn">
          <span>失败调用</span>
          <strong>{metric.failedCalls}</strong>
        </div>
        <div className="service-ops-reminder">
          <span>待审批授权</span>
          <strong>{metric.pendingAuthorizations}</strong>
        </div>
      </div>
    </section>
  );
}

export function DataServiceOpsDashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [dashboard, setDashboard] = useState<DashboardModel | null>(null);
  const [range, setRange] = useState<DashboardRange>("24h");
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleTrendKeys, setVisibleTrendKeys] = useState<TrendKey[]>(["calls", "activeApps", "latencyMs"]);

  async function loadDashboard(silent = false) {
    if (!token) return;
    setLoading(true);
    try {
      const dashboardResponse = await fetchDataServiceOpsDashboard(token);
      setDashboard((dashboardResponse.data || null) as DashboardModel | null);
      setError(null);
    } catch (requestError) {
      const nextMessage = requestError instanceof Error ? requestError.message : "服务运营大屏加载失败";
      setError(nextMessage);
      if (!silent) console.error(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("service-ops-expanded", isExpanded);
    return () => {
      document.body.classList.remove("service-ops-expanded");
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!token) return;
    void loadDashboard(true);
    const timer = window.setInterval(() => void loadDashboard(true), 60000);
    return () => window.clearInterval(timer);
  }, [token]);

  const trendPoints = dashboard?.trendByRange[range] || [];
  const serviceRanks = dashboard?.serviceRanksByRange[range] || [];
  const departmentRanks = dashboard?.departmentRanksByRange[range] || [];
  const trendChartKey = `${range}-${visibleTrendKeys.slice().sort().join("-")}`;
  const trendOption = useMemo(() => {
    const baseOption = buildTrendOption(trendPoints);
    const visibleMap = new Set(visibleTrendKeys);
    if (Array.isArray(baseOption.series)) {
      baseOption.series = baseOption.series.filter((series: any) => {
        if (series.name === "调用量") return visibleMap.has("calls");
        if (series.name === "活跃应用") return visibleMap.has("activeApps");
        if (series.name === "平均延迟") return visibleMap.has("latencyMs");
        return true;
      });
    }
    return baseOption;
  }, [trendPoints, visibleTrendKeys]);

  return (
    <div className={`app-page service-ops-page${isExpanded ? " service-ops-page--expanded" : ""}`}>
      <div className="app-page-body">
        <div className={`service-ops-shell${isExpanded ? " service-ops-shell--expanded" : ""}`}>
          {error ? <Alert type="error" showIcon message={error} className="service-ops-alert" /> : null}

          {!dashboard && loading ? (
            <div className="service-ops-loading">
              <Spin size="large" />
            </div>
          ) : null}

          {dashboard ? (
            <>
              <div className="service-ops-header-panel">
                <div className="service-ops-header-panel__brand">
                  <h1>服务运营</h1>
                </div>
                <div className="service-ops-header-panel__controls">
                  <div className="service-ops-header-panel__meta">
                    <span><ClockCircleOutlined /> {formatDateTime(new Date(clock).toISOString())}</span>
                    <span>更新于 {formatDateTime(dashboard?.generatedAt)}</span>
                    <span>{dashboard?.heroStatus || "-"}</span>
                  </div>
                  <div className="service-ops-header-panel__filters">
                    <Segmented<DashboardRange>
                      size="small"
                      value={range}
                      onChange={(value) => setRange(value)}
                      options={[
                        { label: "今日", value: "24h" },
                        { label: "近一周", value: "7d" },
                        { label: "近一月", value: "30d" },
                      ]}
                    />
                    <Tag color="processing">自动刷新 60s</Tag>
                    <Button
                      size="small"
                      icon={isExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                      onClick={() => setIsExpanded((current) => !current)}
                    >
                      {isExpanded ? "缩放" : "扩展"}
                    </Button>
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadDashboard(false)} loading={loading}>刷新</Button>
                  </div>
                </div>
              </div>

              <div className="service-ops-flip-grid">
                {dashboard.flipMetrics.map((metric) => (
                  <FlipStatCard key={metric.key} metric={metric} />
                ))}
              </div>

              <div className="service-ops-main-grid">
                <RankBars key={`service-ranks-${range}`} title="服务调用排名" items={serviceRanks} />

                <section className="service-ops-panel service-ops-panel--trend">
                  <div className="service-ops-panel__header">
                    <div className="service-ops-panel__title">调用趋势</div>
                    <div className="service-ops-panel__legend-switches">
                      <button
                        type="button"
                        className={`service-ops-panel__legend-pill${visibleTrendKeys.includes("calls") ? " is-active" : ""}`}
                        onClick={() => setVisibleTrendKeys((current) => toggleTrendKey(current, "calls"))}
                      >
                        <span className="service-ops-panel__legend-dot service-ops-panel__legend-dot--blue" />调用量
                      </button>
                      <button
                        type="button"
                        className={`service-ops-panel__legend-pill${visibleTrendKeys.includes("activeApps") ? " is-active" : ""}`}
                        onClick={() => setVisibleTrendKeys((current) => toggleTrendKey(current, "activeApps"))}
                      >
                        <span className="service-ops-panel__legend-dot service-ops-panel__legend-dot--cyan" />活跃应用
                      </button>
                      <button
                        type="button"
                        className={`service-ops-panel__legend-pill${visibleTrendKeys.includes("latencyMs") ? " is-active" : ""}`}
                        onClick={() => setVisibleTrendKeys((current) => toggleTrendKey(current, "latencyMs"))}
                      >
                        <span className="service-ops-panel__legend-dot service-ops-panel__legend-dot--gold" />平均延迟
                      </button>
                    </div>
                  </div>
                  <div className="service-ops-panel__body service-ops-panel__body--trend">
                    <ReactECharts key={trendChartKey} option={trendOption} style={{ height: "100%", width: "100%" }} />
                  </div>
                </section>

                <RankBars key={`department-ranks-${range}`} title="部门调用排名" items={departmentRanks} />
              </div>

              <div className="service-ops-bottom-grid">
                <ServiceStatusCard metric={dashboard.statusMetric} />
                <AuthorizationCard metric={dashboard.authorizationMetric} />
                <AppActivityCard metric={dashboard.appActivityMetric} />
                <RemindersCard metric={dashboard.reminderMetric} />
              </div>
            </>
          ) : null}

          {!dashboard && !loading ? (
            <div className="service-ops-empty">
              <Empty description="暂无服务运营数据" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
