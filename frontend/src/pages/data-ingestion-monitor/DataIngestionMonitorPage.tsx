import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Progress,
  Segmented,
  Spin,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  DisconnectOutlined,
  FieldTimeOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LineChartOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchIngestionMonitorOverview, fetchJobRuns } from "../../services/ingestionTask";
import type { DataSourceRecord, IngestionTask, JobRun } from "../../types/api";
import {
  buildIngestionMonitorDashboard,
  formatDateTime,
  formatDurationMinutes,
  formatNumber,
  getRunStatusLabel,
  getSeverityLabel,
  getTaskStatusLabel,
  type IngestionMonitorDashboard,
  type MonitorDistributionDatum,
  type MonitorDurationItem,
  type MonitorEventItem,
  type MonitorHealthDimension,
  type MonitorRiskTask,
  type MonitorSourceCluster,
  type MonitorTopologyLink,
  type MonitorTopologyNode,
  type MonitorTopologyWeightMode,
  type MonitorTrendRange,
} from "./ingestionMonitorModel";
import "./ingestionMonitorDashboard.css";

const TASK_PAGE_SIZE = 200;
const TASK_RUN_LIMIT = 50;
const CHART_GRID_COLOR = "rgba(126, 159, 201, 0.18)";
const CHART_AXIS_COLOR = "#7184a0";
const CHART_TEXT_COLOR = "#243c58";
const CHART_TOOLTIP_BG = "rgba(18, 33, 57, 0.94)";
const CHART_TOOLTIP_BORDER = "rgba(88, 143, 221, 0.24)";

const HEALTH_DIMENSION_EXPLANATIONS: Record<string, string> = {
  timeliness: "统计启用调度任务在计划窗口内按时完成的比例，未破线任务数 / 启用调度任务数。",
  stability: "统计最近 24 小时终态运行实例的成功率，成功实例数 / 成功或失败实例数。",
  freshness: "统计活跃任务最近一次成功落地是否仍在预期时效窗口内，按活跃任务维度计算。",
  structure: "按字段映射、目标表、负责人、来源连接、目标连接等配置完整度综合评分。",
  coverage: "统计当前监控样本中已装载运行记录的任务覆盖率，已覆盖任务数 / 任务总数。",
  load: "按任务最新运行状态计算平均负载水位，待执行、运行中、长时运行会拉低得分。",
};

const OPERATION_METRIC_EXPLANATIONS: Record<string, string> = {
  operationPending: "按 P1 风险、P2 风险、SLA 破线、重复失败、离线端点影响任务合并后按任务去重统计。",
  p1Risk: "当前需要立即处置的最高优先级风险任务，通常包含严重时效、连续失败或关键链路不可用。",
  p2Risk: "当班需要持续跟进的高风险任务，风险程度低于 P1，但已经影响稳定性、时效或产出完整性。",
  slaBreach: "按任务调度计划和预期落地窗口判断，已破线或临近破线的任务数量。",
  slaRate: "按任务调度计划和预期落地窗口判断，已破线或临近破线的任务数量。",
  staleRisk: "统计活跃任务最近一次成功落地距当前时间的最大间隔，用于识别数据长期未更新的链路。",
  loadIndex: "按触发实例、失败实例、零写入实例、P95 耗时等信号综合换算的运行压力水位。",
  repeatFailed: "统计最近 24 小时内失败次数大于等于 2 次的任务，用于定位反复失败链路。",
  longTail: "统计运行耗时超过当前阈值的任务，阈值来自近期终态实例耗时分布。",
  zeroWrite: "统计有运行实例但写入记录数为 0 的任务，用于识别空跑、过滤异常或源端无增量问题。",
  durationWorse: "将趋势窗口前后两段平均耗时对比，后半段明显变长时标记为耗时恶化。",
  recentEvents: "统计最近 24 小时新增的运营事件，用于判断当前班次新增处置压力。",
  recovered: "健康分已回升且无明显 SLA、失败、长时运行问题的任务，需要确认业务产出是否已恢复。",
  risk: "展示综合健康分、SLA、失败、长时运行、端点状态等维度识别出的风险任务。",
  sla: "展示按调度计划和预期落地窗口判断，已经破线或临近破线的任务。",
  failure: "展示最近运行失败或 24 小时内存在失败实例的任务。",
  load: "展示运行实例密度、零写入、失败和 P95 耗时共同抬高负载水位的任务。",
};

type WorkspaceView = "overview" | "operations";
type MonitorDrilldownKind = "tasks" | "runs" | "sources" | "events";
type HealthIssueView = "risk" | "longTail" | "sla" | "zeroWrite" | "failure" | "load";

type MonitorSnapshot = {
  tasks: IngestionTask[];
  dataSources: DataSourceRecord[];
  runsByTask: Map<number, JobRun[]>;
  generatedAt: string;
};

type MonitorRunDetail = {
  key: string;
  taskId: number;
  taskName: string;
  ownerName: string;
  sourceName: string;
  targetName: string;
  run: JobRun;
};

type MonitorDrilldownState = {
  open: boolean;
  title: string;
  subtitle?: string;
  kind: MonitorDrilldownKind;
  tasks?: MonitorRiskTask[];
  runs?: MonitorRunDetail[];
  sources?: MonitorSourceCluster[];
  events?: MonitorEventItem[];
};

type HealthTrendBucket = {
  label: string;
  totalRuns: number;
  failedRuns: number;
  failureRate: number;
  avgDurationSeconds: number;
  p95DurationSeconds: number;
  volume: number;
  zeroWriteRuns: number;
  loadIndex: number;
};

type HealthIssueRow = {
  key: string;
  taskId: number;
  taskName: string;
  ownerName: string;
  sourceName: string;
  targetName: string;
  severity: MonitorRiskTask["severity"];
  healthScore: number;
  issueSummary: string;
  lastRunStatus: string;
  lastRunStatusCode: string;
  failureRate: number;
  avgDurationSeconds: number;
  p95DurationSeconds: number;
  maxDurationSeconds: number;
  recordsCount: number;
  zeroWriteRuns: number;
};

const WATCH_ICONS: Record<string, ReactNode> = {
  freshnessBreach: <FieldTimeOutlined />,
  longRunning: <ThunderboltOutlined />,
  repeatFailed: <DisconnectOutlined />,
  offlineEndpoints: <DeploymentUnitOutlined />,
  volume24h: <DatabaseOutlined />,
  runRate: <LineChartOutlined />,
  avgDuration: <LineChartOutlined />,
};

const TASK_STATUS_COLORS: Record<string, string> = {
  draft: "default",
  active: "green",
  paused: "orange",
  stopped: "default",
  running: "blue",
};

const RUN_STATUS_COLORS: Record<string, string> = {
  pending: "gold",
  running: "blue",
  completed: "green",
  failed: "red",
  cancelled: "default",
};

function compareTaskPriority(left: IngestionTask, right: IngestionTask) {
  const statusWeight: Record<string, number> = {
    running: 5,
    active: 4,
    paused: 3,
    stopped: 2,
    draft: 1,
  };
  const leftWeight = statusWeight[left.status] || 0;
  const rightWeight = statusWeight[right.status] || 0;
  if (rightWeight !== leftWeight) return rightWeight - leftWeight;

  const leftTs = new Date(left.updatedAt || left.lastRunTime || left.createdAt).getTime() || 0;
  const rightTs = new Date(right.updatedAt || right.lastRunTime || right.createdAt).getTime() || 0;
  return rightTs - leftTs;
}

function buildDistributionBarOption(
  data: MonitorDistributionDatum[],
  colorStops: [string, string] = ["#2f6df6", "#6cb8ff"],
): EChartsOption {
  const items = data.slice(0, 5);
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
      formatter: (params: any) => {
        const current = params?.find((item: any) => item.seriesName === "value");
        return `${current?.name || "-"}: ${current?.value || 0}`;
      },
    },
    grid: { left: 2, right: 8, top: 8, bottom: 0, containLabel: true },
    xAxis: {
      type: "value",
      max: maxValue,
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    },
    yAxis: {
      type: "category",
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: CHART_AXIS_COLOR,
        fontSize: 12,
        fontWeight: 500,
        width: 72,
        overflow: "truncate",
      },
      data: items.map((item) => item.name),
    },
    series: [
      {
        name: "bg",
        type: "bar",
        barWidth: 10,
        silent: true,
        itemStyle: {
          color: "rgba(219, 228, 240, 0.6)",
          borderRadius: 999,
        },
        data: items.map(() => maxValue),
      },
      {
        name: "value",
        type: "bar",
        barWidth: 10,
        z: 3,
        label: {
          show: true,
          position: "right",
          color: CHART_TEXT_COLOR,
          fontSize: 12,
          fontWeight: 600,
          formatter: (params: any) => String(params?.value ?? 0),
        },
        itemStyle: {
          borderRadius: 999,
          shadowBlur: 10,
          shadowColor: "rgba(54, 95, 177, 0.16)",
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: colorStops[0] },
              { offset: 1, color: colorStops[1] },
            ],
          },
        },
        data: items.map((item) => item.value),
      },
    ],
  };
}

function buildDonutOption(data: MonitorDistributionDatum[], title: string): EChartsOption {
  return buildDistributionBarOption(
    data,
    title.includes("鍚屾") || title.includes("同步")
      ? ["#19b7b6", "#71e2db"]
      : ["#245ff2", "#74b7ff"],
  );
}

function buildTrendOption(buckets: Array<{ label: string; totalRuns: number; successRuns: number; failedRuns: number; volume: number }>): EChartsOption {
  return {
    color: ["#245ff2", "#f47070", "#1fc1bc"],
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
    },
    legend: {
      right: 0,
      top: 0,
      textStyle: { color: CHART_AXIS_COLOR, fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: { left: 8, right: 12, top: 36, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      data: buckets.map((item) => item.label),
      axisLine: { lineStyle: { color: "rgba(150, 171, 196, 0.32)" } },
      axisTick: { show: false },
      axisLabel: { color: CHART_AXIS_COLOR, margin: 12 },
    },
    yAxis: [
      {
        type: "value",
        splitLine: { lineStyle: { color: CHART_GRID_COLOR } },
        axisLabel: { color: CHART_AXIS_COLOR },
      },
      {
        type: "value",
        splitLine: { show: false },
        axisLabel: {
          color: CHART_AXIS_COLOR,
          formatter: (value: number) => formatNumber(value / 1000, 0),
        },
      },
    ],
    series: [
      {
        name: "成功实例",
        type: "bar",
        stack: "runs",
        barWidth: 8,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#4f8fff" },
              { offset: 1, color: "#245ff2" },
            ],
          },
          shadowBlur: 8,
          shadowColor: "rgba(36, 95, 242, 0.14)",
        },
        data: buckets.map((item) => item.successRuns),
      },
      {
        name: "失败实例",
        type: "bar",
        stack: "runs",
        barWidth: 8,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#ffb4ac" },
              { offset: 1, color: "#f47070" },
            ],
          },
          shadowBlur: 8,
          shadowColor: "rgba(244, 112, 112, 0.14)",
        },
        data: buckets.map((item) => item.failedRuns),
      },
      {
        name: "写入记录",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: {
          width: 3,
          shadowBlur: 8,
          shadowColor: "rgba(31, 193, 188, 0.18)",
        },
        itemStyle: {
          color: "#1fc1bc",
          borderColor: "#ffffff",
          borderWidth: 2,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(31, 193, 188, 0.20)" },
              { offset: 1, color: "rgba(31, 193, 188, 0.02)" },
            ],
          },
        },
        data: buckets.map((item) => item.volume),
      },
    ],
  };
}

function buildHealthDurationTrendOption(buckets: HealthTrendBucket[]): EChartsOption {
  return {
    color: ["#4f8fff", "#f2aa2f", "#37c8d8"],
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
      formatter: (params: any) => {
        const rows = Array.isArray(params) ? params : [];
        return rows.map((item: any) => `${item.marker}${item.seriesName}: ${formatNumber(Number(item.value || 0), item.seriesName.includes("失败率") ? 1 : 0)}${item.seriesName.includes("失败率") ? "%" : item.seriesName.includes("耗时") ? "秒" : ""}`).join("<br/>");
      },
    },
    legend: {
      right: 0,
      top: 0,
      textStyle: { color: CHART_AXIS_COLOR, fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: { left: 8, right: 10, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: buckets.map((item) => item.label),
      axisLine: { lineStyle: { color: "rgba(150, 171, 196, 0.32)" } },
      axisTick: { show: false },
      axisLabel: { color: CHART_AXIS_COLOR, margin: 10 },
    },
    yAxis: [
      {
        type: "value",
        name: "秒",
        splitLine: { lineStyle: { color: CHART_GRID_COLOR } },
        axisLabel: { color: CHART_AXIS_COLOR },
        nameTextStyle: { color: CHART_AXIS_COLOR },
      },
      {
        type: "value",
        name: "%",
        min: 0,
        max: 100,
        splitLine: { show: false },
        axisLabel: { color: CHART_AXIS_COLOR },
        nameTextStyle: { color: CHART_AXIS_COLOR },
      },
    ],
    series: [
      {
        name: "平均耗时",
        type: "line",
        smooth: true,
        symbolSize: 4,
        lineStyle: { width: 2.5 },
        data: buckets.map((item) => item.avgDurationSeconds),
      },
      {
        name: "P95 耗时",
        type: "line",
        smooth: true,
        symbolSize: 4,
        lineStyle: { width: 2.5 },
        data: buckets.map((item) => item.p95DurationSeconds),
      },
      {
        name: "失败率",
        type: "bar",
        yAxisIndex: 1,
        barWidth: 8,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#7ce8e3" },
              { offset: 1, color: "#37c8d8" },
            ],
          },
        },
        data: buckets.map((item) => item.failureRate),
      },
    ],
  };
}

function buildHealthLoadTrendOption(buckets: HealthTrendBucket[]): EChartsOption {
  return {
    color: ["#245ff2", "#37c8d8", "#e77a7a"],
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
    },
    legend: {
      right: 0,
      top: 0,
      textStyle: { color: CHART_AXIS_COLOR, fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: { left: 8, right: 10, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: buckets.map((item) => item.label),
      axisLine: { lineStyle: { color: "rgba(150, 171, 196, 0.32)" } },
      axisTick: { show: false },
      axisLabel: { color: CHART_AXIS_COLOR, margin: 10 },
    },
    yAxis: [
      {
        type: "value",
        splitLine: { lineStyle: { color: CHART_GRID_COLOR } },
        axisLabel: { color: CHART_AXIS_COLOR },
      },
      {
        type: "value",
        splitLine: { show: false },
        axisLabel: { color: CHART_AXIS_COLOR },
      },
    ],
    series: [
      {
        name: "触发实例",
        type: "bar",
        stack: "load",
        barWidth: 8,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        data: buckets.map((item) => item.totalRuns),
      },
      {
        name: "零写入",
        type: "bar",
        stack: "load",
        barWidth: 8,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        data: buckets.map((item) => item.zeroWriteRuns),
      },
      {
        name: "负载水位",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 4,
        lineStyle: { width: 2.5 },
        data: buckets.map((item) => item.loadIndex),
      },
    ],
  };
}

function buildCompactBarOption(
  items: MonitorDistributionDatum[],
  colorStops: [string, string],
  unit = "",
): EChartsOption {
  const topItems = items.slice(0, 6);
  const maxValue = Math.max(...topItems.map((item) => item.value), 1);
  return {
    animation: false,
    grid: { left: 8, right: 18, top: 8, bottom: 0, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
      formatter: (params: any) => {
        const current = params?.find((item: any) => item.seriesName === "value");
        return `${current?.name || "-"}: ${current?.value || 0}${unit}`;
      },
    },
    xAxis: {
      type: "value",
      max: maxValue,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: topItems.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_AXIS_COLOR,
        fontSize: 12,
        width: 120,
        overflow: "truncate",
      },
    },
    series: [
      {
        name: "bg",
        type: "bar",
        barWidth: 10,
        silent: true,
        itemStyle: { color: "rgba(219, 228, 240, 0.56)", borderRadius: 999 },
        data: topItems.map(() => maxValue),
      },
      {
        name: "value",
        type: "bar",
        barWidth: 10,
        z: 2,
        itemStyle: {
          borderRadius: 999,
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: colorStops[0] },
              { offset: 1, color: colorStops[1] },
            ],
          },
        },
        label: {
          show: true,
          position: "right",
          color: CHART_TEXT_COLOR,
          fontSize: 12,
          fontWeight: 700,
          formatter: (params: any) => `${params.value}${unit}`,
        },
        data: topItems.map((item) => item.value),
      },
    ],
  };
}

function buildRuntimeStatusOption(status: NonNullable<IngestionMonitorDashboard["runtimeStatus"]>): EChartsOption {
  const items = [
    { name: "已完成", value: status.completed, color: "#4f8fff" },
    { name: "运行中", value: status.running, color: "#37c8d8" },
    { name: "待执行", value: status.pending, color: "#7ce8e3" },
    { name: "失败", value: status.failed, color: "#f47070" },
    { name: "暂停", value: status.paused, color: "#f2aa2f" },
    { name: "未启用", value: status.inactive, color: "#b6c7dd" },
  ].filter((item) => item.value > 0);

  return {
    animation: false,
    tooltip: {
      trigger: "item",
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
      formatter: (params: any) => `${params.name}: ${params.value}`,
    },
    legend: {
      bottom: 0,
      left: "center",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: CHART_AXIS_COLOR, fontSize: 12 },
    },
    series: [
      {
        type: "pie",
        radius: ["46%", "72%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 4,
          shadowBlur: 10,
          shadowColor: "rgba(54, 95, 177, 0.14)",
        },
        label: {
          show: true,
          formatter: "{c}",
          color: CHART_TEXT_COLOR,
          fontWeight: 700,
        },
        data: items.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: item.color },
        })),
      },
    ],
  };
}

function buildRiskScatterOption(tasks: MonitorRiskTask[]): EChartsOption {
  const topTasks = tasks.slice(0, 6);
  return {
    animation: false,
    tooltip: {
      trigger: "item",
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
      formatter: (params: any) => {
        const task = topTasks[params.dataIndex];
        return `${task?.taskName || "-"}<br/>${getSeverityLabel(task?.severity || "low")} · 健康分 ${task?.healthScore || 0}<br/>${task?.issueSummary || "-"}`;
      },
    },
    grid: { left: 14, right: 16, top: 16, bottom: 10, containLabel: true },
    xAxis: {
      type: "value",
      min: 0,
      max: 4,
      interval: 1,
      splitLine: { lineStyle: { color: CHART_GRID_COLOR } },
      axisLabel: {
        color: CHART_AXIS_COLOR,
        formatter: (value: number) => ["P4", "P3", "P2", "P1", "P0"][value] || "",
      },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: {
        color: CHART_AXIS_COLOR,
        fontSize: 12,
      },
    },
    series: [
      {
        type: "scatter",
        symbolSize: (value: any) => 16 + Math.max(Number(value[2] || 0), 1) * 5,
        itemStyle: {
          shadowBlur: 10,
          shadowColor: "rgba(54, 95, 177, 0.16)",
        },
        label: {
          show: true,
          position: "right",
          color: CHART_TEXT_COLOR,
          fontSize: 12,
          fontWeight: 600,
          formatter: (params: any) => topTasks[params.dataIndex]?.taskName || "",
        },
        data: topTasks.map((item) => {
          const severityValue = item.severity === "critical" ? 3 : item.severity === "high" ? 2 : item.severity === "medium" ? 1 : 0;
          const color = item.severity === "critical"
            ? "#e77a7a"
            : item.severity === "high"
              ? "#f0a356"
              : item.severity === "medium"
                ? "#f1d27c"
                : "#7ce8e3";
          return {
            value: [severityValue, item.healthScore, Math.max(item.issueCount, 1)],
            itemStyle: { color },
          };
        }),
      },
    ],
  };
}

function buildTopologyOption(
  nodes: MonitorTopologyNode[],
  links: MonitorTopologyLink[],
  weightMode: MonitorTopologyWeightMode,
): EChartsOption {
  return {
    tooltip: {
      trigger: "item",
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
      formatter: (params: any) =>
        `${params.data?.displayName || params.name || "-"}<br/>${weightMode === "tasks" ? "任务数" : "数据量"} ${formatNumber(params.value || 0)}`,
    },
    series: [
      {
        type: "sankey",
        left: 4,
        right: 4,
        top: 0,
        bottom: 0,
        nodeWidth: 12,
        nodeGap: 18,
        nodeAlign: "justify",
        draggable: false,
        emphasis: { focus: "adjacency" },
        lineStyle: {
          color: "gradient",
          opacity: 0.28,
          curveness: 0.5,
        },
        labelLayout: {
          hideOverlap: false,
        },
        data: nodes.map((node) => ({
          ...node,
          label: {
            color: CHART_TEXT_COLOR,
            fontSize: 12,
            fontWeight: 600,
            position: node.category === "target" ? "left" : "right",
            align: node.category === "target" ? "right" : "left",
            verticalAlign: "middle",
            distance: 8,
            width: node.category === "target" ? 118 : 92,
            overflow: "truncate",
            formatter: (params: any) => params.data?.displayName || params.name || "",
          },
          itemStyle: {
            color: node.category === "source" ? "#285ff0" : node.category === "mode" ? "#18b7b6" : "#81aefb",
            borderColor: "rgba(255, 255, 255, 0.92)",
            borderWidth: 1,
            borderRadius: 4,
            shadowBlur: 8,
            shadowOffsetY: 5,
            shadowColor: "rgba(59, 88, 132, 0.12)",
          },
        })),
        links,
      },
    ],
  };
}

function buildRiskOption(tasks: MonitorRiskTask[]): EChartsOption {
  const topTasks = tasks.slice(0, 6);
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: "#f8fbff" },
    },
    grid: { left: 6, right: 12, top: 8, bottom: 4, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: CHART_AXIS_COLOR },
      splitLine: { lineStyle: { color: CHART_GRID_COLOR } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: topTasks.map((item) => item.taskName),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: CHART_TEXT_COLOR, width: 130, overflow: "truncate", fontWeight: 600 },
    },
    series: [
      {
        type: "bar",
        barWidth: 12,
        silent: true,
        barGap: "-100%",
        itemStyle: {
          color: "rgba(220, 228, 239, 0.58)",
          borderRadius: [0, 8, 8, 0],
        },
        data: topTasks.map(() => 100),
      },
      {
        type: "bar",
        barWidth: 12,
        data: topTasks.map((item) => ({
          value: Math.max(0, 100 - item.healthScore),
          itemStyle: {
            color: item.severity === "critical"
              ? {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: "#ff9e96" },
                  { offset: 1, color: "#f46f6f" },
                ],
              }
              : item.severity === "high"
                ? {
                  type: "linear",
                  x: 0,
                  y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: "#ffd484" },
                  { offset: 1, color: "#f2aa2f" },
                ],
              }
                : {
                  type: "linear",
                  x: 0,
                  y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                    { offset: 0, color: "#a8cdff" },
                    { offset: 1, color: "#6597f4" },
                  ],
                },
            borderRadius: [0, 8, 8, 0],
            shadowBlur: 8,
            shadowColor: "rgba(74, 115, 185, 0.12)",
          },
        })),
        label: {
          show: true,
          position: "right",
          color: CHART_TEXT_COLOR,
          fontWeight: 600,
          formatter: (params: any) => `${getSeverityLabel(topTasks[params.dataIndex]?.severity || "low")} / ${params.value || 0}`,
        },
      },
    ],
  };
}

function buildRadarOption(dimensions: MonitorHealthDimension[]): EChartsOption {
  return {
    radar: {
      radius: "62%",
      indicator: dimensions.map((item) => ({ name: item.label, max: 100 })),
      splitArea: {
        areaStyle: {
          color: ["rgba(36, 95, 242, 0.018)", "rgba(36, 95, 242, 0.05)"],
        },
      },
      splitLine: { lineStyle: { color: "rgba(129, 153, 181, 0.18)" } },
      axisLine: { lineStyle: { color: "rgba(129, 153, 181, 0.18)" } },
      axisName: { color: CHART_AXIS_COLOR, fontSize: 12, fontWeight: 600 },
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 2.5, color: "#245ff2" },
        itemStyle: { color: "#245ff2" },
        areaStyle: { color: "rgba(36, 95, 242, 0.16)" },
        data: [{ value: dimensions.map((item) => item.value) }],
      },
    ],
  };
}

function severityClassName(severity: string) {
  return `ingestion-monitor-badge ingestion-monitor-badge--${severity}`;
}

function scoreClassName(value: number) {
  if (value >= 85) return "ingestion-monitor-score ingestion-monitor-score--healthy";
  if (value >= 70) return "ingestion-monitor-score ingestion-monitor-score--warning";
  return "ingestion-monitor-score ingestion-monitor-score--danger";
}

function formatMetricValue(value: number, suffix?: string, precision = 0) {
  return `${formatNumber(value, precision)}${suffix || ""}`;
}

function buildMetricTooltipTitle(label: string, explanation?: string, note?: string): ReactNode {
  const detail = explanation || note || "按当前监控范围内已装载的任务、运行实例和异常事件实时计算。";
  return (
    <div className="ingestion-monitor-metric-tooltip-content">
      <div className="ingestion-monitor-metric-tooltip-content__title">{label}</div>
      <div className="ingestion-monitor-metric-tooltip-content__desc">{detail}</div>
      {note ? <div className="ingestion-monitor-metric-tooltip-content__meta">当前状态：{note}</div> : null}
    </div>
  );
}

function formatCompactMetricValue(value: number, suffix?: string, precision = 0) {
  if ((suffix || "") === "%" || Math.abs(value) < 10000) {
    return formatMetricValue(value, suffix, precision);
  }
  if (Math.abs(value) >= 100000000) {
    return `${formatNumber(value / 100000000, 1)}亿${suffix || ""}`;
  }
  return `${formatNumber(value / 10000, 1)}万${suffix || ""}`;
}

function getWatchIcon(key: string) {
  return WATCH_ICONS[key] || <ThunderboltOutlined />;
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatRunDuration(startTime?: string | null, endTime?: string | null, currentTime = Date.now()) {
  if (!startTime) return "-";
  const startTs = toTimestamp(startTime);
  if (!startTs) return "-";
  const endTs = toTimestamp(endTime) || currentTime;
  if (endTs <= startTs) return "-";

  const totalSeconds = Math.max(0, Math.floor((endTs - startTs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时 ${String(minutes).padStart(2, "0")}分 ${String(seconds).padStart(2, "0")}秒`;
  if (minutes > 0) return `${minutes}分 ${String(seconds).padStart(2, "0")}秒`;
  return `${seconds}秒`;
}

function getRunDurationSeconds(run: JobRun, currentTime = Date.now()) {
  const startTs = toTimestamp(run.startTime);
  if (!startTs) return 0;
  const endTs = toTimestamp(run.endTime) || currentTime;
  if (endTs <= startTs) return 0;
  return Math.max(1, Math.round((endTs - startTs) / 1000));
}

function percentileNumber(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function getTrendBucketConfig(range: MonitorTrendRange) {
  return {
    bucketCount: range === "24h" ? 24 : range === "7d" ? 7 : 30,
    bucketSizeMs: range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
  };
}

function buildHealthTrendBuckets(
  runs: MonitorRunDetail[],
  range: MonitorTrendRange,
  generatedAtTs: number,
): HealthTrendBucket[] {
  const { bucketCount, bucketSizeMs } = getTrendBucketConfig(range);
  const formatter = (bucketTime: Date) => {
    if (range === "24h") {
      return bucketTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return bucketTime.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  };

  return Array.from({ length: bucketCount }, (_item, index) => {
    const start = generatedAtTs - (bucketCount - index) * bucketSizeMs;
    const end = start + bucketSizeMs;
    const bucketRuns = runs.filter((item) => {
      const timestamp = toTimestamp(item.run.startTime);
      return timestamp >= start && timestamp < end;
    });
    const terminalRuns = bucketRuns.filter((item) => item.run.runStatus === "completed" || item.run.runStatus === "failed");
    const failedRuns = terminalRuns.filter((item) => item.run.runStatus === "failed").length;
    const durations = terminalRuns
      .map((item) => getRunDurationSeconds(item.run, generatedAtTs))
      .filter((value) => value > 0);
    const avgDurationSeconds = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0;
    const p95DurationSeconds = percentileNumber(durations, 0.95);
    const zeroWriteRuns = terminalRuns.filter((item) => item.run.runStatus === "completed" && Number(item.run.recordsCount || 0) === 0).length;
    const loadIndex = Math.round(bucketRuns.length + failedRuns * 2 + zeroWriteRuns * 0.4 + p95DurationSeconds / 60);

    return {
      label: formatter(new Date(start)),
      totalRuns: bucketRuns.length,
      failedRuns,
      failureRate: terminalRuns.length ? Math.round((failedRuns * 1000) / terminalRuns.length) / 10 : 0,
      avgDurationSeconds,
      p95DurationSeconds,
      volume: bucketRuns.reduce((sum, item) => sum + Number(item.run.recordsCount || 0), 0),
      zeroWriteRuns,
      loadIndex,
    };
  });
}

function summarizeText(value?: string | null, maxLength = 88) {
  if (!value) return "-";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "-";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function getExecutionMetrics(run: JobRun) {
  const executionInfo = (run.executionInfo || {}) as Record<string, any>;
  const nested = (executionInfo.executionInfo || executionInfo.result || {}) as Record<string, any>;
  return (executionInfo.metrics || nested.metrics || {}) as Record<string, any>;
}

function buildTrendBucketWindow(range: MonitorTrendRange, index: number, generatedAtTs: number) {
  const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const bucketSizeMs = range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const start = generatedAtTs - (bucketCount - index) * bucketSizeMs;
  return {
    start,
    end: start + bucketSizeMs,
  };
}

function WorkspacePanel(props: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { title, extra, children, className } = props;
  return (
    <section className={`ingestion-monitor-panel${className ? ` ${className}` : ""}`}>
      <div className="ingestion-monitor-panel__header">
        <div className="ingestion-monitor-panel__title">{title}</div>
        {extra ? <div>{extra}</div> : null}
      </div>
      <div className="ingestion-monitor-panel__body">{children}</div>
    </section>
  );
}

function MonitorRunExpandedContent(props: { run: JobRun; currentTime: number }) {
  const { run, currentTime } = props;
  const metrics = getExecutionMetrics(run);
  const executionInfo = run.executionInfo || {};

  return (
    <div className="ingestion-monitor-run-detail">
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="运行状态">
          <Tag color={RUN_STATUS_COLORS[run.runStatus] || "default"}>
            {getRunStatusLabel(run.runStatus)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="处理记录数">{run.recordsCount ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="开始时间">{formatDateTime(run.startTime)}</Descriptions.Item>
        <Descriptions.Item label="结束时间">{formatDateTime(run.endTime)}</Descriptions.Item>
        <Descriptions.Item label="运行耗时">{formatRunDuration(run.startTime, run.endTime, currentTime)}</Descriptions.Item>
        <Descriptions.Item label="执行速度">{metrics.recordSpeed || metrics.speed || "-"}</Descriptions.Item>
      </Descriptions>
      {run.errorMessage ? (
        <div className="ingestion-monitor-run-detail__block">
          <div className="ingestion-monitor-run-detail__title">错误摘要</div>
          <pre className="ingestion-monitor-run-detail__pre ingestion-monitor-run-detail__pre--error">{run.errorMessage}</pre>
        </div>
      ) : null}
      <div className="ingestion-monitor-run-detail__block">
        <div className="ingestion-monitor-run-detail__title">执行详情 JSON</div>
        <pre className="ingestion-monitor-run-detail__pre">{JSON.stringify(executionInfo, null, 2)}</pre>
      </div>
    </div>
  );
}

export function DataIngestionMonitorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<IngestionMonitorDashboard | null>(null);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [view, setView] = useState<WorkspaceView>("overview");
  const [topologyWeightMode, setTopologyWeightMode] = useState<MonitorTopologyWeightMode>("tasks");
  const [trendRange, setTrendRange] = useState<MonitorTrendRange>("24h");
  const [healthIssueView, setHealthIssueView] = useState<HealthIssueView>("risk");
  const [isExpanded, setIsExpanded] = useState(false);
  const [drilldown, setDrilldown] = useState<MonitorDrilldownState>({
    open: false,
    title: "",
    kind: "tasks",
  });
  const [logOpen, setLogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logTask, setLogTask] = useState<IngestionTask | null>(null);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [expandedRunRowKeys, setExpandedRunRowKeys] = useState<number[]>([]);

  async function loadDashboard(silent = false) {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetchIngestionMonitorOverview(token, { pageSize: TASK_PAGE_SIZE, runLimit: TASK_RUN_LIMIT });
      const tasks = response.data.tasks || [];
      const runsByTask = new Map<number, JobRun[]>();
      let coveredTaskCount = 0;

      Object.entries(response.data.runsByTask || {}).forEach(([taskId, runs]) => {
        const numericTaskId = Number(taskId);
        const taskRuns = Array.isArray(runs) ? runs : [];
        runsByTask.set(numericTaskId, taskRuns);
        if (taskRuns.length > 0) {
          coveredTaskCount += 1;
        }
      });

      tasks.forEach((task) => {
        if (!runsByTask.has(task.id)) {
          runsByTask.set(task.id, []);
        }
      });

      setSnapshot({
        tasks,
        dataSources: (response.data.dataSources || []) as DataSourceRecord[],
        runsByTask,
        generatedAt: new Date().toISOString(),
      });

      setDashboard(buildIngestionMonitorDashboard({
        tasks,
        dataSources: (response.data.dataSources || []) as DataSourceRecord[],
        runsByTask,
        coveredTaskCount,
        generatedAt: new Date().toISOString(),
      }));
      setError(null);
    } catch (requestError) {
      const nextMessage = requestError instanceof Error ? requestError.message : "接入监控数据加载失败";
      setError(nextMessage);
      if (!silent) {
        message.error(nextMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("ingestion-monitor-expanded", isExpanded);
    return () => {
      document.body.classList.remove("ingestion-monitor-expanded");
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  useEffect(() => {
    if (!token) return;
    void loadDashboard(true);
    const timer = window.setInterval(() => {
      void loadDashboard(true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [token]);

  const tasks = snapshot?.tasks || [];
  const runsByTask = snapshot?.runsByTask || new Map<number, JobRun[]>();
  const generatedAtTs = useMemo(() => toTimestamp(snapshot?.generatedAt || dashboard?.generatedAt) || Date.now(), [dashboard?.generatedAt, snapshot?.generatedAt]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const allRunDetails = useMemo<MonitorRunDetail[]>(() => {
    return [...runsByTask.entries()]
      .flatMap(([taskId, runs]) => {
        const task = taskById.get(taskId);
        return (runs || []).map((run, index) => ({
          key: `${taskId}-${run.id || index}-${run.startTime || run.createdAt || index}`,
          taskId,
          taskName: task?.taskName || `任务 ${taskId}`,
          ownerName: task?.ownerName || "-",
          sourceName: task?.sourceName || "-",
          targetName: task?.targetSourceName || task?.targetTable || "-",
          run,
        }));
      })
      .sort((left, right) => toTimestamp(right.run.startTime || right.run.createdAt) - toTimestamp(left.run.startTime || left.run.createdAt));
  }, [runsByTask, taskById]);

  function resolveTask(taskId: number) {
    return taskById.get(taskId) || null;
  }

  function openTaskLogs(taskId: number) {
    const task = resolveTask(taskId);
    if (!token || !task) {
      message.warning("未找到对应任务");
      return;
    }

    setLogTask(task);
    setLogOpen(true);
    setLogLoading(true);
    setExpandedRunRowKeys([]);
    void fetchJobRuns(token, taskId)
      .then((response) => {
        setJobRuns(response.data || []);
      })
      .catch((requestError) => {
        const nextMessage = requestError instanceof Error ? requestError.message : "加载运行日志失败";
        message.error(nextMessage);
        setJobRuns([]);
      })
      .finally(() => setLogLoading(false));
  }

  function openTaskEditor(taskId: number) {
    navigate(`/dashboard/data-ingestion-jobs/${taskId}/edit`);
  }

  function openSourceTasks(sourceId: number | null) {
    navigate("/dashboard/data-sources", { state: sourceId ? { openReferencedTasksDataSourceId: sourceId } : undefined });
  }

  function openTaskDrilldown(title: string, nextTasks: MonitorRiskTask[], subtitle?: string) {
    setDrilldown({
      open: true,
      title,
      subtitle,
      kind: "tasks",
      tasks: nextTasks,
    });
  }

  function openRunDrilldown(title: string, nextRuns: MonitorRunDetail[], subtitle?: string) {
    setDrilldown({
      open: true,
      title,
      subtitle,
      kind: "runs",
      runs: nextRuns,
    });
  }

  function openSourceDrilldown(title: string, nextSources: MonitorSourceCluster[], subtitle?: string) {
    setDrilldown({
      open: true,
      title,
      subtitle,
      kind: "sources",
      sources: nextSources,
    });
  }

  function openEventDrilldown(title: string, nextEvents: MonitorEventItem[], subtitle?: string) {
    setDrilldown({
      open: true,
      title,
      subtitle,
      kind: "events",
      events: nextEvents,
    });
  }

  const summaryCards = dashboard?.summaryCards || [];
  const healthMetric = summaryCards.find((item) => item.key === "health") || null;
  const coverageMetric = summaryCards.find((item) => item.key === "coverage") || null;
  const primaryMetrics = ["todayRuns", "coverage", "successRate", "slaRate"]
    .map((key) => (key === "coverage" ? coverageMetric : summaryCards.find((item) => item.key === key)))
    .filter(Boolean) as NonNullable<typeof dashboard>["summaryCards"];
  const secondaryMetrics = ["totalTasks", "scheduledTasks", "sourceSystems", "alerts"]
    .map((key) => summaryCards.find((item) => item.key === key))
    .filter(Boolean) as NonNullable<typeof dashboard>["summaryCards"];
  const watchMetrics = dashboard?.watchMetrics || [];
  const durationRanking = dashboard?.durationRanking || [];
  const dataIncrementValue = dashboard?.trendBucketsByRange?.["24h"]?.reduce((sum, item) => sum + item.volume, 0) || 0;
  const todayRunsMetric = primaryMetrics.find((item) => item.key === "todayRuns") || null;
  const successRateMetric = primaryMetrics.find((item) => item.key === "successRate") || null;
  const slaRateMetric = primaryMetrics.find((item) => item.key === "slaRate") || null;
  const heroSummary = [
    todayRunsMetric ? `24h 运行 ${formatMetricValue(todayRunsMetric.value, todayRunsMetric.suffix, todayRunsMetric.precision || 0)}` : null,
    successRateMetric ? `成功率 ${formatMetricValue(successRateMetric.value, successRateMetric.suffix, successRateMetric.precision || 0)}` : null,
    slaRateMetric ? `SLA ${formatMetricValue(slaRateMetric.value, slaRateMetric.suffix, slaRateMetric.precision || 0)}` : null,
  ].filter(Boolean).join(" · ");

  const primaryBoardMetrics = useMemo(
    () => [
      ...primaryMetrics,
      {
        key: "dataIncrement",
        label: "数据增量",
        value: dataIncrementValue,
        note: "24h 累计写入记录",
        tone: "cyan",
        displayValue: formatCompactMetricValue(dataIncrementValue, "", 1),
      },
    ],
    [dataIncrementValue, primaryMetrics],
  );
  const selectedTrendBuckets = dashboard?.trendBucketsByRange?.[trendRange] || dashboard?.trendBuckets || [];
  const selectedTopology = dashboard?.topologyByWeight?.[topologyWeightMode] || dashboard?.topology || { nodes: [], links: [] };
  const trendOption = useMemo(() => buildTrendOption(selectedTrendBuckets), [selectedTrendBuckets]);
  const topologyOption = useMemo(
    () => buildTopologyOption(selectedTopology.nodes || [], selectedTopology.links || [], topologyWeightMode),
    [selectedTopology, topologyWeightMode],
  );
  const riskOption = useMemo(() => buildRiskOption(dashboard?.riskTasks || []), [dashboard]);
  const radarOption = useMemo(() => buildRadarOption(dashboard?.healthDimensions || []), [dashboard]);
  const durationChartOption = useMemo(
    () => buildCompactBarOption(
      durationRanking.map((item) => ({ name: item.taskName, value: item.durationSeconds })),
      ["#4f8fff", "#37c8d8"],
      "秒",
    ),
    [durationRanking],
  );
  const runtimeStatusOption = useMemo(
    () => buildRuntimeStatusOption(dashboard?.runtimeStatus || {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      inactive: 0,
    }),
    [dashboard],
  );
  const riskTasks = dashboard?.riskTasks || [];
  const recentRuns24h = useMemo(
    () => allRunDetails.filter((item) => toTimestamp(item.run.startTime) >= generatedAtTs - 24 * 60 * 60 * 1000),
    [allRunDetails, generatedAtTs],
  );
  const terminalRuns24h = useMemo(
    () => recentRuns24h.filter((item) => item.run.runStatus === "completed" || item.run.runStatus === "failed"),
    [recentRuns24h],
  );
  const selectedRangeRuns = useMemo(() => {
    const { bucketCount, bucketSizeMs } = getTrendBucketConfig(trendRange);
    const start = generatedAtTs - bucketCount * bucketSizeMs;
    return allRunDetails.filter((item) => toTimestamp(item.run.startTime) >= start);
  }, [allRunDetails, generatedAtTs, trendRange]);
  const selectedRangeTerminalRuns = useMemo(
    () => selectedRangeRuns.filter((item) => item.run.runStatus === "completed" || item.run.runStatus === "failed"),
    [selectedRangeRuns],
  );
  const selectedRangeDurations = useMemo(
    () => selectedRangeTerminalRuns.map((item) => getRunDurationSeconds(item.run, generatedAtTs)).filter((value) => value > 0),
    [generatedAtTs, selectedRangeTerminalRuns],
  );
  const selectedRangeFailureCount = selectedRangeTerminalRuns.filter((item) => item.run.runStatus === "failed").length;
  const selectedRangeFailedRate = selectedRangeTerminalRuns.length
    ? Math.round((selectedRangeFailureCount * 1000) / selectedRangeTerminalRuns.length) / 10
    : 0;
  const selectedRangeAvgDuration = selectedRangeDurations.length
    ? Math.round(selectedRangeDurations.reduce((sum, value) => sum + value, 0) / selectedRangeDurations.length)
    : 0;
  const selectedRangeP95Duration = percentileNumber(selectedRangeDurations, 0.95);
  const longTailThreshold = Math.max(60, selectedRangeP95Duration || 0, Math.round(selectedRangeAvgDuration * 1.8));
  const healthTrendBuckets = useMemo(
    () => buildHealthTrendBuckets(allRunDetails, trendRange, generatedAtTs),
    [allRunDetails, generatedAtTs, trendRange],
  );
  const healthDurationTrendOption = useMemo(
    () => buildHealthDurationTrendOption(healthTrendBuckets),
    [healthTrendBuckets],
  );
  const healthLoadTrendOption = useMemo(
    () => buildHealthLoadTrendOption(healthTrendBuckets),
    [healthTrendBuckets],
  );
  const healthIssueRows = useMemo<HealthIssueRow[]>(() => {
    const rows = riskTasks.map((task) => {
      const taskRuns = selectedRangeRuns.filter((item) => item.taskId === task.taskId);
      const terminalRuns = taskRuns.filter((item) => item.run.runStatus === "completed" || item.run.runStatus === "failed");
      const failedRuns = terminalRuns.filter((item) => item.run.runStatus === "failed").length;
      const durations = terminalRuns.map((item) => getRunDurationSeconds(item.run, generatedAtTs)).filter((value) => value > 0);
      const zeroWriteRuns = terminalRuns.filter((item) => item.run.runStatus === "completed" && Number(item.run.recordsCount || 0) === 0).length;
      return {
        key: task.key,
        taskId: task.taskId,
        taskName: task.taskName,
        ownerName: task.ownerName,
        sourceName: task.sourceName,
        targetName: task.targetName,
        severity: task.severity,
        healthScore: task.healthScore,
        issueSummary: task.issueSummary,
        lastRunStatus: task.lastRunStatus,
        lastRunStatusCode: task.lastRunStatusCode,
        failureRate: terminalRuns.length ? Math.round((failedRuns * 1000) / terminalRuns.length) / 10 : 0,
        avgDurationSeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
        p95DurationSeconds: percentileNumber(durations, 0.95),
        maxDurationSeconds: durations.length ? Math.max(...durations) : 0,
        recordsCount: taskRuns.reduce((sum, item) => sum + Number(item.run.recordsCount || 0), 0),
        zeroWriteRuns,
      };
    });

    return rows;
  }, [generatedAtTs, riskTasks, selectedRangeRuns]);
  const longTailRows = healthIssueRows
    .filter((item) => item.maxDurationSeconds >= longTailThreshold && item.maxDurationSeconds > 0)
    .sort((left, right) => right.maxDurationSeconds - left.maxDurationSeconds);
  const zeroWriteRows = healthIssueRows
    .filter((item) => item.zeroWriteRuns > 0)
    .sort((left, right) => right.zeroWriteRuns - left.zeroWriteRuns);
  const failureRows = healthIssueRows
    .filter((item) => item.failureRate > 0 || item.lastRunStatusCode === "failed")
    .sort((left, right) => right.failureRate - left.failureRate);
  const slaRows = healthIssueRows.filter((item) => riskTasks.find((task) => task.taskId === item.taskId)?.slaBreached);
  const loadRows = healthIssueRows
    .filter((item) => item.zeroWriteRuns > 0 || item.p95DurationSeconds >= 60 || item.maxDurationSeconds >= longTailThreshold)
    .sort((left, right) => (right.zeroWriteRuns * 10 + right.p95DurationSeconds) - (left.zeroWriteRuns * 10 + left.p95DurationSeconds));
  const selectedHealthIssueRows = (() => {
    if (healthIssueView === "longTail") return longTailRows;
    if (healthIssueView === "sla") return slaRows;
    if (healthIssueView === "zeroWrite") return zeroWriteRows;
    if (healthIssueView === "failure") return failureRows;
    if (healthIssueView === "load") return loadRows;
    return healthIssueRows.filter((item) => item.issueSummary !== "链路稳定").slice(0, 12);
  })();
  const zeroWriteRunCount = zeroWriteRows.reduce((sum, item) => sum + item.zeroWriteRuns, 0);
  const maxLoadIndex = Math.max(...healthTrendBuckets.map((item) => item.loadIndex), 0);
  const observationCoverageValue = coverageMetric?.value || Math.round((dashboard?.runCoverage || 0) * 1000) / 10;
  const coverageGapCount = Math.max(tasks.length - Math.round((observationCoverageValue / 100) * tasks.length), 0);
  const repeatFailureRows = riskTasks.filter((item) => item.recentFailureCount >= 2);
  const offlineEndpointRows = riskTasks.filter((item) => item.sourceOffline || item.targetOffline);
  const p1RiskTasks = riskTasks.filter((item) => item.severity === "critical");
  const p2RiskTasks = riskTasks.filter((item) => item.severity === "high");
  const recentOperationEvents = (dashboard?.events || []).filter((item) => toTimestamp(item.timestamp) >= generatedAtTs - 24 * 60 * 60 * 1000);
  const staleRiskTasks = riskTasks
    .filter((item) => typeof item.freshnessMinutes === "number" && (item.freshnessMinutes || 0) > 0)
    .sort((left, right) => (right.freshnessMinutes || 0) - (left.freshnessMinutes || 0));
  const maxRiskDelayMinutes = staleRiskTasks[0]?.freshnessMinutes || 0;
  const recoveredCandidates = riskTasks.filter((item) => item.healthScore >= 85 && !item.slaBreached && !item.latestFailed && !item.longRunning);
  const durationWorse = (() => {
    if (healthTrendBuckets.length < 4) return 0;
    const half = Math.floor(healthTrendBuckets.length / 2);
    const previous = healthTrendBuckets.slice(0, half).map((item) => item.avgDurationSeconds).filter((value) => value > 0);
    const recent = healthTrendBuckets.slice(half).map((item) => item.avgDurationSeconds).filter((value) => value > 0);
    const previousAvg = previous.length ? previous.reduce((sum, value) => sum + value, 0) / previous.length : 0;
    const recentAvg = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
    return previousAvg > 0 ? Math.round(((recentAvg - previousAvg) * 1000) / previousAvg) / 10 : 0;
  })();
  const operationPendingTaskIds = new Set<number>();
  [p1RiskTasks, p2RiskTasks, slaRows, repeatFailureRows, offlineEndpointRows].forEach((group) => {
    group.forEach((item) => operationPendingTaskIds.add(item.taskId));
  });
  const operationPendingTasks = riskTasks.filter((item) => operationPendingTaskIds.has(item.taskId));
  const operationHeroSignals = [
    { key: "p1Risk", label: "P1 风险", value: p1RiskTasks.length, tone: p1RiskTasks.length > 0 ? "red" : "green", note: `P2 ${p2RiskTasks.length} 条` },
    { key: "slaBreach", label: "SLA 债务", value: slaRows.length, tone: slaRows.length > 0 ? "red" : "green", note: "已破线或临近破线" },
    { key: "staleRisk", label: "滞留最长", value: maxRiskDelayMinutes, displayValue: formatDurationMinutes(maxRiskDelayMinutes), tone: maxRiskDelayMinutes >= 24 * 60 ? "red" : maxRiskDelayMinutes > 0 ? "amber" : "green", note: "按任务新鲜度计算" },
    { key: "loadIndex", label: "负载峰值", value: maxLoadIndex, tone: maxLoadIndex >= 80 ? "red" : maxLoadIndex >= 40 ? "amber" : "cyan", note: "触发/失败/零写入/P95" },
  ];
  const operationRiskNotes = [
    p1RiskTasks.length ? `P1 ${p1RiskTasks.length}` : null,
    p2RiskTasks.length ? `P2 ${p2RiskTasks.length}` : null,
    slaRows.length ? `SLA 债务 ${slaRows.length}` : null,
    maxRiskDelayMinutes ? `最长滞留 ${formatDurationMinutes(maxRiskDelayMinutes)}` : null,
    zeroWriteRunCount ? `零写入 ${zeroWriteRunCount}` : null,
  ].filter(Boolean).slice(0, 4).join(" · ") || "当前没有高优先级运营风险";
  const operationStatus = p1RiskTasks.length > 0 ? "优先处理 P1" : operationPendingTasks.length > 0 ? "存在待处置" : "运行平稳";
  const operationCommandCards = [
    {
      key: "p1Risk",
      label: "P1/P2 风险",
      value: p1RiskTasks.length,
      note: `${p2RiskTasks.length} 条 P2 同步关注`,
      tone: p1RiskTasks.length > 0 ? "red" : "green",
    },
    {
      key: "slaBreach",
      label: "SLA 债务",
      value: slaRows.length,
      note: "已破线或临近破线",
      tone: slaRows.length > 0 ? "red" : "green",
    },
    {
      key: "staleRisk",
      label: "最长滞留",
      value: maxRiskDelayMinutes,
      displayValue: formatDurationMinutes(maxRiskDelayMinutes),
      note: staleRiskTasks[0]?.taskName || "暂无滞留任务",
      tone: maxRiskDelayMinutes >= 24 * 60 ? "red" : maxRiskDelayMinutes > 0 ? "amber" : "green",
    },
    {
      key: "repeatFailed",
      label: "重复失败任务",
      value: repeatFailureRows.length,
      note: "24h 内失败次数大于等于 2",
      tone: repeatFailureRows.length > 0 ? "red" : "green",
    },
    {
      key: "longTail",
      label: "长尾任务",
      value: longTailRows.length,
      note: `阈值 ${formatNumber(longTailThreshold, 0)} 秒`,
      tone: longTailRows.length > 0 ? "amber" : "green",
    },
    {
      key: "zeroWrite",
      label: "零写入任务",
      value: zeroWriteRows.length,
      note: `${zeroWriteRunCount} 个零写入实例`,
      tone: zeroWriteRunCount > 0 ? "amber" : "green",
    },
    {
      key: "durationWorse",
      label: "耗时恶化",
      value: durationWorse,
      suffix: "%",
      note: durationWorse > 0 ? "后半周期较前半周期变长" : "后半周期未变长",
      tone: durationWorse > 30 ? "red" : durationWorse > 10 ? "amber" : "green",
    },
    {
      key: "loadIndex",
      label: "负载水位",
      value: maxLoadIndex,
      note: "按触发、失败、零写入、P95 综合",
      tone: maxLoadIndex >= 80 ? "red" : maxLoadIndex >= 40 ? "amber" : "cyan",
    },
  ];
  const operationPriorityCards = [
    {
      key: "p1Risk",
      label: "P1 风险",
      value: p1RiskTasks.length,
      note: "立即处置",
      tone: p1RiskTasks.length > 0 ? "red" : "green",
    },
    {
      key: "p2Risk",
      label: "P2 风险",
      value: p2RiskTasks.length,
      note: "当班跟进",
      tone: p2RiskTasks.length > 0 ? "amber" : "green",
    },
    {
      key: "slaBreach",
      label: "超时未处理",
      value: slaRows.length,
      note: "按调度窗口识别",
      tone: slaRows.length > 0 ? "red" : "green",
    },
    {
      key: "recentEvents",
      label: "今日新增",
      value: recentOperationEvents.length,
      note: "近 24h 事件",
      tone: recentOperationEvents.length > 0 ? "amber" : "green",
    },
    {
      key: "repeatFailed",
      label: "重复出现",
      value: repeatFailureRows.length,
      note: "24h 内连续异常",
      tone: repeatFailureRows.length > 0 ? "red" : "green",
    },
    {
      key: "recovered",
      label: "待确认恢复",
      value: recoveredCandidates.length,
      note: "健康分已回升",
      tone: recoveredCandidates.length > 0 ? "cyan" : "green",
    },
  ];
  const visibleTopologySourceNames = useMemo(
    () => new Set((selectedTopology.nodes || []).filter((node) => node.category === "source" && node.displayName !== "其他来源").map((node) => node.displayName)),
    [selectedTopology.nodes],
  );
  const visibleTopologyTargetNames = useMemo(
    () => new Set((selectedTopology.nodes || []).filter((node) => node.category === "target" && node.displayName !== "其他目标").map((node) => node.displayName)),
    [selectedTopology.nodes],
  );

  function openSummaryDrilldown(metricKey: string) {
    switch (metricKey) {
      case "todayRuns":
        openRunDrilldown("24h 实例明细", recentRuns24h, `共 ${recentRuns24h.length} 个运行实例`);
        return;
      case "coverage": {
        const uncoveredTaskIds = new Set<number>();
        tasks.forEach((task) => {
          if ((runsByTask.get(task.id) || []).length === 0) uncoveredTaskIds.add(task.id);
        });
        openTaskDrilldown(
          "运行覆盖明细",
          riskTasks.filter((item) => uncoveredTaskIds.has(item.taskId)),
          `未加载运行记录 ${uncoveredTaskIds.size} 条，当前监控样本 ${tasks.length} 条`,
        );
        return;
      }
      case "successRate":
        openRunDrilldown("24h 终态实例", terminalRuns24h, `成功 ${terminalRuns24h.filter((item) => item.run.runStatus === "completed").length} / 失败 ${terminalRuns24h.filter((item) => item.run.runStatus === "failed").length}`);
        return;
      case "slaRate":
        openTaskDrilldown("SLA 预警任务", riskTasks.filter((item) => item.slaBreached), "按计划窗口判断已破线或临近破线");
        return;
      case "dataIncrement":
        openRunDrilldown(
          "24h 写入记录明细",
          recentRuns24h.filter((item) => Number(item.run.recordsCount || 0) > 0).sort((left, right) => Number(right.run.recordsCount || 0) - Number(left.run.recordsCount || 0)),
          `累计写入 ${formatNumber(recentRuns24h.reduce((sum, item) => sum + Number(item.run.recordsCount || 0), 0), 0)} 条`,
        );
        return;
      case "totalTasks":
        openTaskDrilldown("接入任务明细", riskTasks, `监控当前装载 ${tasks.length} 条任务`);
        return;
      case "scheduledTasks":
        openTaskDrilldown("启用调度任务", riskTasks.filter((item) => item.scheduleEnabled), "含定时或周期调度任务");
        return;
      case "sourceSystems":
        openSourceDrilldown("来源系统明细", dashboard?.sourceClusters || [], `共 ${dashboard?.sourceClusters.length || 0} 个来源`);
        return;
      case "alerts":
        openEventDrilldown("当前告警明细", dashboard?.events || [], `P1 ${dashboard?.exceptionSummary.critical || 0} / P2 ${dashboard?.exceptionSummary.high || 0}`);
        return;
      default:
        break;
    }
  }

  function openWatchMetricDrilldown(metricKey: string) {
    switch (metricKey) {
      case "freshnessBreach":
        openTaskDrilldown("时效破线任务", riskTasks.filter((item) => item.slaBreached), "SLA 窗口内未按时落地");
        return;
      case "longRunning":
        openTaskDrilldown("长时运行任务", riskTasks.filter((item) => item.longRunning), "运行时长超出预估窗口");
        return;
      case "repeatFailed":
        openTaskDrilldown("重复失败任务", riskTasks.filter((item) => item.recentFailureCount >= 2), "24h 内失败次数大于等于 2");
        return;
      case "offlineEndpoints":
        openTaskDrilldown("离线端点影响任务", riskTasks.filter((item) => item.sourceOffline || item.targetOffline), "来源或目标连接异常");
        return;
      case "runRate":
        openRunDrilldown("运行速率样本", recentRuns24h, "按 24h 运行实例查看吞吐样本");
        return;
      case "avgDuration":
        openRunDrilldown(
          "运行耗时样本",
          terminalRuns24h.slice().sort((left, right) => toTimestamp(right.run.endTime) - toTimestamp(left.run.endTime)),
          "用于平均耗时和 P95 统计的终态实例",
        );
        return;
      default:
        break;
    }
  }

  function openHealthOpsDrilldown(metricKey: string) {
    switch (metricKey) {
      case "operationPending":
        openTaskDrilldown("运营待处置任务", operationPendingTasks, "按 P1/P2 风险、SLA 破线、重复失败、离线端点去重统计");
        return;
      case "p1Risk":
        openTaskDrilldown("P1 风险任务", p1RiskTasks, "需要立即处置的高优先级风险");
        return;
      case "p2Risk":
        openTaskDrilldown("P2 风险任务", p2RiskTasks, "当班需要持续跟进的风险任务");
        return;
      case "staleRisk":
        openTaskDrilldown("滞留任务", staleRiskTasks, `最长滞留 ${formatDurationMinutes(maxRiskDelayMinutes)}`);
        return;
      case "recentEvents":
        openEventDrilldown("近 24h 新增事件", recentOperationEvents, `共 ${recentOperationEvents.length} 条运营事件`);
        return;
      case "recovered":
        openTaskDrilldown("待确认恢复任务", recoveredCandidates, "健康分已回升，建议确认业务产出");
        return;
      case "slaRate":
      case "slaBreach":
        openTaskDrilldown("SLA 破线任务", riskTasks.filter((item) => item.slaBreached), "按计划窗口判断已破线或临近破线");
        return;
      case "failureRate":
        openRunDrilldown("失败实例明细", selectedRangeRuns.filter((item) => item.run.runStatus === "failed"), `当前范围失败率 ${formatNumber(selectedRangeFailedRate, 1)}%`);
        return;
      case "repeatFailed":
        openTaskDrilldown("重复失败任务", repeatFailureRows, "24h 内失败次数大于等于 2");
        return;
      case "longTail":
        openTaskDrilldown("长尾任务", longTailRows.map((row) => riskTasks.find((item) => item.taskId === row.taskId)).filter(Boolean) as MonitorRiskTask[], "按当前范围最长耗时排序");
        return;
      case "p95Duration":
      case "durationWorse":
        openRunDrilldown(
          "耗时实例明细",
          selectedRangeTerminalRuns.slice().sort((left, right) => getRunDurationSeconds(right.run, generatedAtTs) - getRunDurationSeconds(left.run, generatedAtTs)),
          `P95 ${formatNumber(selectedRangeP95Duration, 0)} 秒`,
        );
        return;
      case "loadIndex":
        openRunDrilldown("负载实例明细", selectedRangeRuns, `当前范围 ${selectedRangeRuns.length} 个运行实例`);
        return;
      case "zeroWrite":
        openRunDrilldown("零写入实例明细", selectedRangeTerminalRuns.filter((item) => item.run.runStatus === "completed" && Number(item.run.recordsCount || 0) === 0), `共 ${zeroWriteRunCount} 个零写入实例`);
        return;
      case "offlineEndpoints":
        openTaskDrilldown("离线端点影响任务", offlineEndpointRows, "来源或目标连接异常");
        return;
      case "coverageGap":
        openSummaryDrilldown("coverage");
        return;
      default:
        break;
    }
  }

  function openRuntimeStatusDrilldown(label: string) {
    const filtered = riskTasks.filter((item) => {
      switch (label) {
        case "待执行":
          return item.lastRunStatusCode === "pending";
        case "运行中":
          return item.lastRunStatusCode === "running" || item.taskStatusCode === "running";
        case "已完成":
          return item.lastRunStatusCode === "completed";
        case "失败":
          return item.lastRunStatusCode === "failed";
        case "暂停":
          return item.taskStatusCode === "paused";
        case "未启用":
          return item.taskStatusCode === "draft" || item.taskStatusCode === "stopped";
        default:
          return false;
      }
    });
    openTaskDrilldown(`任务状态明细 - ${label}`, filtered, `共 ${filtered.length} 条任务`);
  }

  function openSourceClusterDetail(cluster: MonitorSourceCluster) {
    const filtered = riskTasks.filter((item) => resolveTask(item.taskId)?.sourceId === cluster.sourceId);
    openTaskDrilldown(`${cluster.sourceName} 关联任务`, filtered, `${cluster.sourceTypeLabel} / ${cluster.statusLabel}`);
  }

  function handleTrendChartClick(params: any) {
    if (!params || typeof params.dataIndex !== "number") return;
    const windowRange = buildTrendBucketWindow(trendRange, params.dataIndex, generatedAtTs);
    const filtered = allRunDetails.filter((item) => {
      const startedAt = toTimestamp(item.run.startTime);
      return startedAt >= windowRange.start && startedAt < windowRange.end;
    }).filter((item) => {
      if (params.seriesName === "成功实例") return item.run.runStatus === "completed";
      if (params.seriesName === "失败实例") return item.run.runStatus === "failed";
      return true;
    });
    openRunDrilldown(`运行趋势明细 - ${params.name}`, filtered, params.seriesName || "全部实例");
  }

  function handleTopologyChartClick(params: any) {
    const node = params?.data as MonitorTopologyNode | undefined;
    if (!node?.category) return;
    const filtered = riskTasks.filter((item) => {
      if (node.category === "source") {
        return node.displayName === "其他来源"
          ? !visibleTopologySourceNames.has(item.sourceName)
          : item.sourceName === node.displayName;
      }
      if (node.category === "target") {
        return node.displayName === "其他目标"
          ? !visibleTopologyTargetNames.has(item.targetName)
          : item.targetName === node.displayName;
      }
      return item.syncModeLabel === node.displayName;
    });
    openTaskDrilldown(`接入链路明细 - ${node.displayName}`, filtered, node.category === "mode" ? "按同步模式聚合" : "按链路节点聚合");
  }

  function handleDurationChartClick(params: any) {
    const current = durationRanking[params?.dataIndex ?? -1];
    if (current) openTaskLogs(current.taskId);
  }

  function handleRiskChartClick(params: any) {
    const current = riskTasks[params?.dataIndex ?? -1];
    if (current) openTaskDrilldown(`风险任务 - ${current.taskName}`, [current], current.issueSummary);
  }

  const runtimeColumns: ColumnsType<MonitorRiskTask> = useMemo(
    () => [
      {
        title: "任务",
        dataIndex: "taskName",
        key: "taskName",
        width: 180,
        render: (value: string, record) => (
          <button type="button" className="ingestion-monitor-link-button" onClick={() => openTaskDrilldown(`任务详情 - ${record.taskName}`, [record], record.issueSummary)}>
            <div className="ingestion-monitor-table__title">{value}</div>
            <div className="ingestion-monitor-table__meta">{record.ownerName}</div>
          </button>
        ),
      },
      {
        title: "链路",
        key: "path",
        width: 220,
        render: (_value, record) => (
          <div>
            <div className="ingestion-monitor-table__title">{record.sourceName}</div>
            <div className="ingestion-monitor-table__meta">{record.targetName}</div>
          </div>
        ),
      },
      {
        title: "等级",
        key: "severity",
        width: 82,
        render: (_value, record) => (
          <Tag bordered={false} className={severityClassName(record.severity)}>
            {getSeverityLabel(record.severity)}
          </Tag>
        ),
      },
      {
        title: "滞后",
        dataIndex: "freshnessMinutes",
        key: "freshnessMinutes",
        width: 120,
        render: (value: number | null) => formatDurationMinutes(value),
      },
      {
        title: "健康分",
        dataIndex: "healthScore",
        key: "healthScore",
        width: 90,
        render: (value: number) => <span className={scoreClassName(value)}>{value}</span>,
      },
      {
        title: "风险摘要",
        dataIndex: "issueSummary",
        key: "issueSummary",
        ellipsis: true,
      },
      {
        title: "操作",
        key: "actions",
        width: 154,
        render: (_value, record) => (
          <Space size={4}>
            <Button size="small" type="link" onClick={() => openTaskLogs(record.taskId)}>
              日志
            </Button>
            <Button size="small" type="link" onClick={() => openTaskEditor(record.taskId)}>
              任务页
            </Button>
          </Space>
        ),
      },
    ],
    [openTaskDrilldown],
  );
  const healthIssueColumns: ColumnsType<HealthIssueRow> = [
    {
      title: "任务",
      dataIndex: "taskName",
      key: "taskName",
      width: 230,
      render: (value, record) => (
        <button type="button" className="ingestion-monitor-link-button" onClick={() => openTaskLogs(record.taskId)}>
          <div className="ingestion-monitor-table__title">{value}</div>
        </button>
      ),
    },
    {
      title: "链路",
      key: "path",
      width: 190,
      render: (_value, record) => (
        <div>
          <div className="ingestion-monitor-table__title">{record.sourceName}</div>
          <div className="ingestion-monitor-table__meta">{record.targetName}</div>
        </div>
      ),
    },
    {
      title: "运行",
      key: "lastRunStatus",
      width: 92,
      render: (_value, record) => <Tag color={RUN_STATUS_COLORS[record.lastRunStatusCode] || "default"}>{record.lastRunStatus}</Tag>,
    },
    {
      title: "失败率",
      dataIndex: "failureRate",
      key: "failureRate",
      width: 86,
      render: (value) => `${formatNumber(value, 1)}%`,
    },
    {
      title: "最长耗时",
      dataIndex: "maxDurationSeconds",
      key: "maxDurationSeconds",
      width: 100,
      render: (value) => `${formatNumber(value, 0)}秒`,
    },
    {
      title: "P95",
      dataIndex: "p95DurationSeconds",
      key: "p95DurationSeconds",
      width: 78,
      render: (value) => `${formatNumber(value, 0)}秒`,
    },
    {
      title: "写入量",
      dataIndex: "recordsCount",
      key: "recordsCount",
      width: 92,
      render: (value) => formatNumber(value, 0),
    },
    {
      title: "健康",
      dataIndex: "healthScore",
      key: "healthScore",
      width: 76,
      render: (value: number) => <span className={scoreClassName(value)}>{value}</span>,
    },
    {
      title: "建议关注",
      dataIndex: "issueSummary",
      key: "issueSummary",
      ellipsis: true,
    },
  ];
  const drilldownTaskColumns: ColumnsType<MonitorRiskTask> = [
    {
      title: "任务",
      dataIndex: "taskName",
      key: "taskName",
      width: 220,
      render: (value, record) => (
        <div>
          <div className="ingestion-monitor-table__title">{value}</div>
          <div className="ingestion-monitor-table__meta">{record.ownerName}</div>
        </div>
      ),
    },
    {
      title: "链路",
      key: "path",
      width: 260,
      render: (_value, record) => (
        <div>
          <div className="ingestion-monitor-table__title">{record.sourceName}</div>
          <div className="ingestion-monitor-table__meta">{record.targetName}</div>
        </div>
      ),
    },
    {
      title: "任务状态",
      key: "taskStatus",
      width: 110,
      render: (_value, record) => <Tag color={TASK_STATUS_COLORS[record.taskStatusCode] || "default"}>{record.taskStatus}</Tag>,
    },
    {
      title: "最近运行",
      key: "lastRunStatus",
      width: 110,
      render: (_value, record) => <Tag color={RUN_STATUS_COLORS[record.lastRunStatusCode] || "default"}>{record.lastRunStatus}</Tag>,
    },
    {
      title: "滞后",
      dataIndex: "freshnessMinutes",
      key: "freshnessMinutes",
      width: 120,
      render: (value) => formatDurationMinutes(value),
    },
    {
      title: "健康分",
      dataIndex: "healthScore",
      key: "healthScore",
      width: 90,
      render: (value: number) => <span className={scoreClassName(value)}>{value}</span>,
    },
    {
      title: "摘要",
      dataIndex: "issueSummary",
      key: "issueSummary",
      ellipsis: true,
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      render: (_value, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openTaskLogs(record.taskId)}>
            日志
          </Button>
          <Button size="small" type="link" onClick={() => openTaskEditor(record.taskId)}>
            任务页
          </Button>
        </Space>
      ),
    },
  ];
  const drilldownRunColumns: ColumnsType<MonitorRunDetail> = [
    {
      title: "任务",
      dataIndex: "taskName",
      key: "taskName",
      width: 220,
      render: (value, record) => (
        <div>
          <div className="ingestion-monitor-table__title">{value}</div>
          <div className="ingestion-monitor-table__meta">{record.ownerName}</div>
        </div>
      ),
    },
    {
      title: "状态",
      key: "runStatus",
      width: 100,
      render: (_value, record) => <Tag color={RUN_STATUS_COLORS[record.run.runStatus] || "default"}>{getRunStatusLabel(record.run.runStatus)}</Tag>,
    },
    {
      title: "开始时间",
      key: "startTime",
      width: 176,
      render: (_value, record) => formatDateTime(record.run.startTime),
    },
    {
      title: "结束时间",
      key: "endTime",
      width: 176,
      render: (_value, record) => formatDateTime(record.run.endTime),
    },
    {
      title: "耗时",
      key: "duration",
      width: 130,
      render: (_value, record) => formatRunDuration(record.run.startTime, record.run.endTime, clock),
    },
    {
      title: "记录数",
      key: "recordsCount",
      width: 110,
      render: (_value, record) => formatNumber(Number(record.run.recordsCount || 0), 0),
    },
    {
      title: "失败摘要",
      key: "error",
      ellipsis: true,
      render: (_value, record) => summarizeText(record.run.errorMessage),
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      render: (_value, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openTaskLogs(record.taskId)}>
            日志
          </Button>
          <Button size="small" type="link" onClick={() => openTaskEditor(record.taskId)}>
            任务页
          </Button>
        </Space>
      ),
    },
  ];
  const drilldownSourceColumns: ColumnsType<MonitorSourceCluster> = [
    { title: "来源系统", dataIndex: "sourceName", key: "sourceName", width: 220 },
    { title: "类型", dataIndex: "sourceTypeLabel", key: "sourceTypeLabel", width: 120 },
    { title: "状态", dataIndex: "statusLabel", key: "statusLabel", width: 120 },
    { title: "任务数", dataIndex: "taskCount", key: "taskCount", width: 96 },
    { title: "启用数", dataIndex: "activeTaskCount", key: "activeTaskCount", width: 96 },
    { title: "风险数", dataIndex: "riskCount", key: "riskCount", width: 96 },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_value, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openSourceClusterDetail(record)}>
            任务明细
          </Button>
          <Button size="small" type="link" onClick={() => openSourceTasks(record.sourceId)}>
            数据源页
          </Button>
        </Space>
      ),
    },
  ];
  const drilldownEventColumns: ColumnsType<MonitorEventItem> = [
    {
      title: "等级",
      key: "severity",
      width: 88,
      render: (_value, record) => <Tag bordered={false} className={severityClassName(record.severity)}>{getSeverityLabel(record.severity)}</Tag>,
    },
    { title: "类型", dataIndex: "title", key: "title", width: 160 },
    { title: "详情", dataIndex: "detail", key: "detail", ellipsis: true },
    { title: "任务", dataIndex: "taskName", key: "taskName", width: 180 },
    { title: "责任人", dataIndex: "ownerName", key: "ownerName", width: 120 },
    {
      title: "时间",
      key: "timestamp",
      width: 180,
      render: (_value, record) => formatDateTime(record.timestamp),
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      render: (_value, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openTaskLogs(record.taskId)}>
            日志
          </Button>
          <Button size="small" type="link" onClick={() => openTaskEditor(record.taskId)}>
            任务页
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={`app-page ingestion-monitor-page${isExpanded ? " ingestion-monitor-page--expanded" : ""}${view === "operations" ? " ingestion-monitor-page--health ingestion-monitor-page--operations" : ""}`}>
      <div className="app-page-body">
        <div className={`ingestion-monitor-shell${isExpanded ? " ingestion-monitor-shell--expanded" : ""}${view === "operations" ? " ingestion-monitor-shell--health ingestion-monitor-shell--operations" : ""}`}>
          <div className="ingestion-monitor-toolbar ingestion-monitor-toolbar--compact">
            <div className="ingestion-monitor-toolbar__meta">
              <span><FieldTimeOutlined /> {formatDateTime(new Date(clock).toISOString())}</span>
              <span>更新于 {formatDateTime(dashboard?.generatedAt)}</span>
              <span><ThunderboltOutlined /> 健康 {dashboard?.healthStatus || "-"}</span>
              <Button
                size="small"
                icon={isExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={() => setIsExpanded((current) => !current)}
              >
                {isExpanded ? "缩放" : "扩展"}
              </Button>
              <span><WarningOutlined /> 告警 {dashboard?.exceptionSummary.total || 0}</span>
            </div>
            <div className="ingestion-monitor-toolbar__actions">
              <Tag color="processing">自动刷新 60s</Tag>
              <Button icon={<ReloadOutlined />} onClick={() => void loadDashboard(false)} loading={loading}>
                刷新
              </Button>
            </div>
            <Segmented<WorkspaceView>
              value={view}
              onChange={(value) => setView(value)}
              options={[
                { label: "总览", value: "overview" },
                { label: "运营", value: "operations" },
              ]}
            />
          </div>

          {error ? <Alert type="error" showIcon message={error} className="ingestion-monitor-alert" /> : null}

          {!dashboard && loading ? (
            <div className="ingestion-monitor-loading">
              <Spin size="large" />
            </div>
          ) : null}

          {dashboard?.isEmpty ? (
            <div className="ingestion-monitor-empty">
              <Empty description="暂无接入任务，待接入任务与运行记录产生后自动展示。" />
            </div>
          ) : null}

          {!dashboard?.isEmpty && dashboard ? (
            <>
              {view === "operations" ? (
                <div className="ingestion-monitor-health-command-band">
                  <div className={`ingestion-monitor-health-command-hero ingestion-monitor-health-command-hero--${healthMetric?.tone || "green"}`}>
                    <Tooltip
                      title={buildMetricTooltipTitle("运营待处置", OPERATION_METRIC_EXPLANATIONS.operationPending, operationRiskNotes)}
                      rootClassName="ingestion-monitor-metric-tooltip"
                      color="#ffffff"
                      placement="right"
                    >
                      <button
                        type="button"
                        className="ingestion-monitor-health-command-hero__main ingestion-monitor-clickable-card"
                        onClick={() => openHealthOpsDrilldown("operationPending")}
                      >
                        <div className="ingestion-monitor-health-command-hero__label">运营待处置</div>
                        <div className="ingestion-monitor-health-command-hero__score">{operationPendingTasks.length}</div>
                        <div className="ingestion-monitor-health-command-hero__status">{operationStatus}</div>
                        <div className="ingestion-monitor-health-command-hero__note">{operationRiskNotes}</div>
                      </button>
                    </Tooltip>
                    <div className="ingestion-monitor-health-command-hero__signals">
                      {operationHeroSignals.map((card) => (
                        <Tooltip
                          key={card.key}
                          title={buildMetricTooltipTitle(card.label, OPERATION_METRIC_EXPLANATIONS[card.key], card.note)}
                          rootClassName="ingestion-monitor-metric-tooltip"
                          color="#ffffff"
                          placement="top"
                        >
                          <button
                            type="button"
                            className={`ingestion-monitor-health-command-signal ingestion-monitor-health-command-signal--${card.tone} ingestion-monitor-clickable-card`}
                            onClick={() => openHealthOpsDrilldown(card.key)}
                          >
                            <span>{card.label}</span>
                            <strong>
                              {"displayValue" in card
                                ? card.displayValue
                                : formatMetricValue(card.value, "suffix" in card && typeof card.suffix === "string" ? card.suffix : undefined, "suffix" in card && card.suffix === "%" ? 1 : 0)}
                            </strong>
                            <em>{card.note}</em>
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                  </div>

                  <div className="ingestion-monitor-health-command-grid">
                    {operationCommandCards.map((card) => (
                      <Tooltip
                        key={card.key}
                        title={buildMetricTooltipTitle(card.label, OPERATION_METRIC_EXPLANATIONS[card.key], card.note)}
                        rootClassName="ingestion-monitor-metric-tooltip"
                        color="#ffffff"
                        placement="top"
                      >
                        <button
                          type="button"
                          className={`ingestion-monitor-health-command-card ingestion-monitor-health-command-card--${card.tone} ingestion-monitor-clickable-card`}
                          onClick={() => openHealthOpsDrilldown(card.key)}
                        >
                          <span>{card.label}</span>
                          <strong>
                            {"displayValue" in card
                              ? card.displayValue
                              : formatMetricValue(card.value, "suffix" in card && typeof card.suffix === "string" ? card.suffix : undefined, "suffix" in card && card.suffix === "%" ? 1 : 0)}
                          </strong>
                          <em>{card.note}</em>
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ingestion-monitor-overview-band">
                  <div className={`ingestion-monitor-overview-hero ingestion-monitor-overview-hero--${healthMetric?.tone || "green"}`}>
                    <div className="ingestion-monitor-overview-hero__content">
                      <div className="ingestion-monitor-overview-hero__title-row">
                        <div className="ingestion-monitor-overview-hero__title-main">
                          <div className="ingestion-monitor-overview-hero__title">{dashboard.healthStatus}</div>
                          <div className="ingestion-monitor-overview-hero__summary">{heroSummary}</div>
                        </div>
                      </div>
                      <div className="ingestion-monitor-overview-hero__signals">
                        {secondaryMetrics.map((card) => (
                          <button
                            key={card.key}
                            type="button"
                            className="ingestion-monitor-overview-hero__signal ingestion-monitor-clickable-card"
                            onClick={() => openSummaryDrilldown(card.key)}
                          >
                            <span>{card.label}</span>
                            <strong>{formatMetricValue(card.value, card.suffix, card.precision || 0)}</strong>
                            <em>{card.note}</em>
                          </button>
                        ))}
                      </div>
                    </div>
                    {false ? <div className="ingestion-monitor-overview-hero__score ingestion-monitor-primary-stat ingestion-monitor-primary-stat--cyan">
                      <span className="ingestion-monitor-overview-hero__score-badge">24h</span>
                      <div className="ingestion-monitor-primary-stat__label">数据增量</div>
                      <div className="ingestion-monitor-primary-stat__value">
                        {formatCompactMetricValue(dataIncrementValue, "", 1)}
                      </div>
                      <div className="ingestion-monitor-primary-stat__note">累计写入记录</div>
                    </div> : null}
                  </div>

                  <div className="ingestion-monitor-primary-board">
                    {primaryBoardMetrics.map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        className={`ingestion-monitor-primary-stat ingestion-monitor-primary-stat--${card.tone} ingestion-monitor-clickable-card`}
                        onClick={() => openSummaryDrilldown(card.key)}
                      >
                        <div className="ingestion-monitor-primary-stat__label">{card.label}</div>
                        <div className="ingestion-monitor-primary-stat__value">
                          {"displayValue" in card
                            ? card.displayValue
                            : formatMetricValue(card.value, card.suffix, card.precision || 0)}
                        </div>
                        <div className="ingestion-monitor-primary-stat__note">{card.note}</div>
                        {"suffix" in card && card.suffix === "%" ? (
                          <div className="ingestion-monitor-primary-stat__track">
                            <div
                              className={`ingestion-monitor-primary-stat__fill ingestion-monitor-primary-stat__fill--${card.tone}`}
                              style={{ width: `${Math.max(6, Math.min(card.value, 100))}%` }}
                            />
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="ingestion-monitor-workspace">
                <div className="ingestion-monitor-sidebar">
                  {view === "operations" ? (
                    <>
                      <WorkspacePanel title="处置优先级" className="ingestion-monitor-panel--compact ingestion-monitor-panel--health-risks">
                        <div className="ingestion-monitor-health-risk-grid">
                          {operationPriorityCards.map((item) => (
                            <Tooltip
                              key={item.key}
                              title={buildMetricTooltipTitle(item.label, OPERATION_METRIC_EXPLANATIONS[item.key], item.note)}
                              rootClassName="ingestion-monitor-metric-tooltip"
                              color="#ffffff"
                              placement="right"
                            >
                              <button
                                type="button"
                                className={`ingestion-monitor-health-risk-item ingestion-monitor-health-risk-item--${item.tone} ingestion-monitor-clickable-card`}
                                onClick={() => openHealthOpsDrilldown(item.key)}
                              >
                                <span>{item.label}</span>
                                <strong>{formatMetricValue(item.value, undefined, 0)}</strong>
                                <em>{item.note}</em>
                              </button>
                            </Tooltip>
                          ))}
                        </div>
                      </WorkspacePanel>

                      <WorkspacePanel title="健康维度" className="ingestion-monitor-panel--compact ingestion-monitor-panel--health-dimensions">
                        <div className="ingestion-monitor-health-dimension-grid">
                          {dashboard.healthDimensions.slice(0, 6).map((item) => {
                            const explanation = HEALTH_DIMENSION_EXPLANATIONS[item.key] || item.note;
                            return (
                              <Tooltip
                                key={item.key}
                                title={buildMetricTooltipTitle(item.label, explanation, item.note)}
                                rootClassName="ingestion-monitor-metric-tooltip"
                                color="#ffffff"
                                placement="right"
                              >
                                <div className="ingestion-monitor-health-dimension-item">
                                  <div className="ingestion-monitor-health-dimension-item__head">
                                    <span>{item.label}</span>
                                    <strong>{formatMetricValue(item.value, "%", 0)}</strong>
                                  </div>
                                  <div className="ingestion-monitor-health-dimension-item__track">
                                    <div
                                      className="ingestion-monitor-health-dimension-item__fill"
                                      style={{ width: `${Math.max(6, Math.min(item.value, 100))}%` }}
                                    />
                                  </div>
                                </div>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </WorkspacePanel>
                    </>
                  ) : (
                    <>
                      <WorkspacePanel title="运行态势" className="ingestion-monitor-panel--compact ingestion-monitor-panel--runtime">
                        <div className="ingestion-monitor-health-card">
                          <Progress
                            type="dashboard"
                            percent={dashboard.healthScore}
                            strokeColor={dashboard.healthScore >= 85 ? "#52c41a" : dashboard.healthScore >= 70 ? "#faad14" : "#ff4d4f"}
                            trailColor="#e8eef7"
                            gapDegree={110}
                            size={96}
                          />
                          <div className="ingestion-monitor-health-card__status">{dashboard.healthStatus}</div>
                        </div>
                        <div className="ingestion-monitor-status-list">
                          <button type="button" className="ingestion-monitor-clickable-card" onClick={() => openRuntimeStatusDrilldown("待执行")}><span>待执行</span><strong>{dashboard.runtimeStatus.pending}</strong></button>
                          <button type="button" className="ingestion-monitor-clickable-card" onClick={() => openRuntimeStatusDrilldown("运行中")}><span>运行中</span><strong>{dashboard.runtimeStatus.running}</strong></button>
                          <button type="button" className="ingestion-monitor-clickable-card" onClick={() => openRuntimeStatusDrilldown("已完成")}><span>已完成</span><strong>{dashboard.runtimeStatus.completed}</strong></button>
                          <button type="button" className="ingestion-monitor-clickable-card" onClick={() => openRuntimeStatusDrilldown("失败")}><span>失败</span><strong>{dashboard.runtimeStatus.failed}</strong></button>
                          <button type="button" className="ingestion-monitor-clickable-card" onClick={() => openRuntimeStatusDrilldown("暂停")}><span>暂停</span><strong>{dashboard.runtimeStatus.paused}</strong></button>
                          <button type="button" className="ingestion-monitor-clickable-card" onClick={() => openRuntimeStatusDrilldown("未启用")}><span>未启用</span><strong>{dashboard.runtimeStatus.inactive}</strong></button>
                        </div>
                      </WorkspacePanel>

                      <WorkspacePanel title="关键观测" className="ingestion-monitor-panel--compact ingestion-monitor-panel--watch">
                        <div className="ingestion-monitor-watch-grid">
                          {watchMetrics.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              className={`ingestion-monitor-watch-item ingestion-monitor-watch-item--${item.tone} ingestion-monitor-clickable-card`}
                              onClick={() => openWatchMetricDrilldown(item.key)}
                            >
                              <div className="ingestion-monitor-watch-item__head">
                                <div className="ingestion-monitor-watch-item__label">{item.label}</div>
                                <div className={`ingestion-monitor-icon-orb ingestion-monitor-icon-orb--${item.tone} ingestion-monitor-icon-orb--small`}>
                                  {getWatchIcon(item.key)}
                                </div>
                              </div>
                              <div className="ingestion-monitor-watch-item__value">
                                {item.suffix
                                  ? (
                                    <>
                                      {formatNumber(item.value, item.precision || 0)}
                                      <small className="ingestion-monitor-watch-item__suffix">{item.suffix}</small>
                                    </>
                                  )
                                  : formatMetricValue(item.value, item.suffix, item.precision || 0)}
                              </div>
                              <div className="ingestion-monitor-watch-item__meta">{item.note}</div>
                            </button>
                          ))}
                        </div>
                        <div className="ingestion-monitor-source-section">
                          <div className="ingestion-monitor-source-section__title">高风险来源</div>
                          <div className="ingestion-monitor-source-list">
                          {dashboard.sourceClusters.slice(0, 5).map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              className="ingestion-monitor-source-item ingestion-monitor-clickable-card"
                              onClick={() => openSourceClusterDetail(item)}
                            >
                              <div>
                                <div className="ingestion-monitor-source-item__title">{item.sourceName}</div>
                                <div className="ingestion-monitor-source-item__meta">{item.sourceTypeLabel} / {item.statusLabel}</div>
                              </div>
                              <div className="ingestion-monitor-source-item__stats">
                                <span>{item.taskCount} 任务</span>
                                <span>{item.riskCount} 风险</span>
                              </div>
                            </button>
                          ))}
                          </div>
                        </div>
                      </WorkspacePanel>
                    </>
                  )}
                </div>

                <div className="ingestion-monitor-content">
                  {view === "overview" ? (
                    <div className="ingestion-monitor-view ingestion-monitor-view--overview">
                      <WorkspacePanel
                        title="运行趋势"
                        extra={(
                          <Segmented<MonitorTrendRange>
                            size="small"
                            value={trendRange}
                            onChange={(value) => setTrendRange(value)}
                            options={[
                              { label: "近24小时", value: "24h" },
                              { label: "近一周", value: "7d" },
                              { label: "近一月", value: "30d" },
                            ]}
                          />
                        )}
                      >
                        <ReactECharts option={trendOption} style={{ height: "100%" }} onEvents={{ click: handleTrendChartClick }} />
                      </WorkspacePanel>
                      <WorkspacePanel
                        title="接入链路"
                        extra={(
                          <Segmented<MonitorTopologyWeightMode>
                            size="small"
                            value={topologyWeightMode}
                            onChange={(value) => setTopologyWeightMode(value)}
                            options={[
                              { label: "任务数", value: "tasks" },
                              { label: "数据量", value: "volume" },
                            ]}
                          />
                        )}
                      >
                        <ReactECharts option={topologyOption} style={{ height: "100%" }} onEvents={{ click: handleTopologyChartClick }} />
                      </WorkspacePanel>
                      <div className="ingestion-monitor-view-row ingestion-monitor-view-row--triple">
                        <WorkspacePanel title="任务运行耗时 Top" className="ingestion-monitor-panel--short">
                          <ReactECharts option={durationChartOption} style={{ height: "100%" }} onEvents={{ click: handleDurationChartClick }} />
                        </WorkspacePanel>
                        <WorkspacePanel title="任务状态分布" className="ingestion-monitor-panel--short">
                          <ReactECharts option={runtimeStatusOption} style={{ height: "100%" }} onEvents={{ click: (params: any) => openRuntimeStatusDrilldown(String(params?.name || "")) }} />
                        </WorkspacePanel>
                        <WorkspacePanel title="重点任务风险分布" className="ingestion-monitor-panel--short">
                          <div className="ingestion-monitor-focus-list">
                            {dashboard.riskTasks.slice(0, 5).map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                className="ingestion-monitor-focus-item ingestion-monitor-clickable-card"
                                onClick={() => openTaskDrilldown(`风险任务 - ${item.taskName}`, [item], item.issueSummary)}
                              >
                                <div>
                                  <div className="ingestion-monitor-focus-item__title">{item.taskName}</div>
                                  <div className="ingestion-monitor-focus-item__meta">{item.sourceName} {"->"} {item.targetName}</div>
                                  <div className="ingestion-monitor-focus-item__meta">{item.issueSummary}</div>
                                </div>
                                <div className="ingestion-monitor-focus-item__side">
                                  <Tag bordered={false} className={severityClassName(item.severity)}>{getSeverityLabel(item.severity)}</Tag>
                                  <span className={scoreClassName(item.healthScore)}>{item.healthScore}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </WorkspacePanel>
                      </div>
                    </div>
                  ) : null}

                  {view === "operations" ? (
                    <div className="ingestion-monitor-view ingestion-monitor-view--operations">
                      <WorkspacePanel
                        title="健康趋势诊断"
                        className="ingestion-monitor-operations-trend-panel"
                        extra={(
                          <Segmented<MonitorTrendRange>
                            size="small"
                            value={trendRange}
                            onChange={(value) => setTrendRange(value)}
                            options={[
                              { label: "近24小时", value: "24h" },
                              { label: "近一周", value: "7d" },
                              { label: "近一月", value: "30d" },
                            ]}
                          />
                        )}
                      >
                        <div className="ingestion-monitor-operations-trend-grid">
                          <ReactECharts option={healthDurationTrendOption} style={{ height: "100%" }} />
                          <ReactECharts option={healthLoadTrendOption} style={{ height: "100%" }} />
                        </div>
                      </WorkspacePanel>
                      <WorkspacePanel
                        title="异常处置队列"
                        className="ingestion-monitor-operations-queue-panel"
                      >
                        <div className="ingestion-monitor-events ingestion-monitor-events--operations">
                          {dashboard.events.slice(0, 6).map((item) => (
                            <Tooltip
                              key={item.id}
                              title={buildMetricTooltipTitle(
                                item.title,
                                "按任务运行状态、SLA 时效、失败摘要和端点可用性生成的待处置事件，点击可查看该任务运行日志。",
                                item.detail,
                              )}
                              rootClassName="ingestion-monitor-metric-tooltip"
                              color="#ffffff"
                              placement="left"
                            >
                              <button
                                type="button"
                                className="ingestion-monitor-event ingestion-monitor-clickable-card"
                                onClick={() => openTaskLogs(item.taskId)}
                              >
                                <Tag bordered={false} className={severityClassName(item.severity)}>
                                  {getSeverityLabel(item.severity)}
                                </Tag>
                                <div className="ingestion-monitor-event__content">
                                  <div className="ingestion-monitor-event__title">{item.title}</div>
                                  <div className="ingestion-monitor-event__detail">{item.detail}</div>
                                  <div className="ingestion-monitor-event__meta">
                                    <span>{item.taskName}</span>
                                    <span>{formatDateTime(item.timestamp)}</span>
                                  </div>
                                </div>
                              </button>
                            </Tooltip>
                          ))}
                        </div>
                      </WorkspacePanel>
                      <WorkspacePanel
                        title="问题定位"
                        className="ingestion-monitor-health-issue-panel"
                        extra={(
                          <Segmented<HealthIssueView>
                            size="small"
                            value={healthIssueView}
                            onChange={(value) => setHealthIssueView(value)}
                            options={[
                              { label: <Tooltip title={buildMetricTooltipTitle("风险", OPERATION_METRIC_EXPLANATIONS.risk)} rootClassName="ingestion-monitor-metric-tooltip" color="#ffffff"><span>风险</span></Tooltip>, value: "risk" },
                              { label: <Tooltip title={buildMetricTooltipTitle("长尾", OPERATION_METRIC_EXPLANATIONS.longTail)} rootClassName="ingestion-monitor-metric-tooltip" color="#ffffff"><span>长尾</span></Tooltip>, value: "longTail" },
                              { label: <Tooltip title={buildMetricTooltipTitle("SLA", OPERATION_METRIC_EXPLANATIONS.sla)} rootClassName="ingestion-monitor-metric-tooltip" color="#ffffff"><span>SLA</span></Tooltip>, value: "sla" },
                              { label: <Tooltip title={buildMetricTooltipTitle("零写入", OPERATION_METRIC_EXPLANATIONS.zeroWrite)} rootClassName="ingestion-monitor-metric-tooltip" color="#ffffff"><span>零写入</span></Tooltip>, value: "zeroWrite" },
                              { label: <Tooltip title={buildMetricTooltipTitle("失败", OPERATION_METRIC_EXPLANATIONS.failure)} rootClassName="ingestion-monitor-metric-tooltip" color="#ffffff"><span>失败</span></Tooltip>, value: "failure" },
                              { label: <Tooltip title={buildMetricTooltipTitle("负载", OPERATION_METRIC_EXPLANATIONS.load)} rootClassName="ingestion-monitor-metric-tooltip" color="#ffffff"><span>负载</span></Tooltip>, value: "load" },
                            ]}
                          />
                        )}
                      >
                        <Table
                          rowKey="key"
                          size="small"
                          pagination={false}
                          scroll={{ x: 1010, y: isExpanded ? "calc(100vh - 542px)" : "calc(100vh - 594px)" }}
                          columns={healthIssueColumns}
                          dataSource={selectedHealthIssueRows.slice(0, 8)}
                          locale={{ emptyText: "当前范围暂无对应问题任务" }}
                          className="ingestion-monitor-runtime-table ingestion-monitor-health-issue-table"
                        />
                      </WorkspacePanel>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <Drawer
        open={drilldown.open}
        onClose={() => setDrilldown((current) => ({ ...current, open: false }))}
        width="min(840px, calc(100% - 120px))"
        zIndex={1301}
        title={drilldown.title}
        className="ingestion-monitor-drawer"
        destroyOnClose
        getContainer={false}
        rootStyle={{ position: "absolute", zIndex: 1301 }}
        styles={{
          mask: { position: "absolute" },
          wrapper: {
            position: "absolute",
            top: 52,
            right: 0,
            bottom: 52,
            height: "auto",
          },
          content: {
            borderRadius: "20px 0 0 20px",
            overflow: "hidden",
          },
        }}
        extra={drilldown.subtitle ? <Typography.Text type="secondary">{drilldown.subtitle}</Typography.Text> : null}
      >
        {drilldown.kind === "tasks" ? (
          <Table
            rowKey="key"
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1200 }}
            columns={drilldownTaskColumns}
            dataSource={drilldown.tasks || []}
            locale={{ emptyText: "暂无任务明细" }}
          />
        ) : null}
        {drilldown.kind === "runs" ? (
          <Table
            rowKey="key"
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1360 }}
            columns={drilldownRunColumns}
            dataSource={drilldown.runs || []}
            locale={{ emptyText: "暂无运行实例" }}
            expandable={{
              expandedRowRender: (record) => <MonitorRunExpandedContent run={record.run} currentTime={clock} />,
            }}
          />
        ) : null}
        {drilldown.kind === "sources" ? (
          <Table
            rowKey="key"
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 900 }}
            columns={drilldownSourceColumns}
            dataSource={drilldown.sources || []}
            locale={{ emptyText: "暂无来源明细" }}
          />
        ) : null}
        {drilldown.kind === "events" ? (
          <Table
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1260 }}
            columns={drilldownEventColumns}
            dataSource={drilldown.events || []}
            locale={{ emptyText: "暂无异常事件" }}
          />
        ) : null}
      </Drawer>
      <Modal
        open={logOpen}
        title={logTask ? `${logTask.taskName} 运行日志` : "运行日志"}
        footer={null}
        onCancel={() => {
          setLogOpen(false);
          setExpandedRunRowKeys([]);
        }}
        width="min(920px, calc(100% - 136px))"
        zIndex={1301}
        destroyOnHidden
        getContainer={false}
        centered
        style={{ top: 0, paddingBottom: 0 }}
        rootClassName="ingestion-monitor-modal"
      >
        {jobRuns.length === 0 && !logLoading ? (
          <Empty description="暂无运行记录" />
        ) : (
          <Table
            rowKey="id"
            loading={logLoading}
            pagination={false}
            dataSource={jobRuns}
            scroll={{ x: 1020, y: 560 }}
            expandable={{
              expandedRowKeys: expandedRunRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRunRowKeys(keys as number[]),
              expandedRowRender: (record) => <MonitorRunExpandedContent run={record} currentTime={clock} />,
            }}
            columns={[
              {
                title: "运行时间",
                key: "createdAt",
                width: 180,
                render: (_value, record) => formatDateTime(record.createdAt),
              },
              {
                title: "状态",
                key: "runStatus",
                width: 100,
                render: (_value, record) => <Tag color={RUN_STATUS_COLORS[record.runStatus] || "default"}>{getRunStatusLabel(record.runStatus)}</Tag>,
              },
              {
                title: "开始时间",
                key: "startTime",
                width: 180,
                render: (_value, record) => formatDateTime(record.startTime),
              },
              {
                title: "结束时间",
                key: "endTime",
                width: 180,
                render: (_value, record) => formatDateTime(record.endTime),
              },
              {
                title: "运行耗时",
                key: "duration",
                width: 140,
                render: (_value, record) => formatRunDuration(record.startTime, record.endTime, clock),
              },
              {
                title: "记录数",
                key: "recordsCount",
                width: 100,
                render: (_value, record) => formatNumber(Number(record.recordsCount || 0), 0),
              },
              {
                title: "失败摘要",
                key: "errorMessage",
                ellipsis: true,
                render: (_value, record) => summarizeText(record.errorMessage),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
