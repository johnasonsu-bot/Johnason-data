import { Card, Col, Empty, Row, Segmented, Space, Statistic, Table, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchOpsDashboard } from "../../services/dataLab";
import type { LabOpsDashboard } from "../../types/api";

type RankingMode = "sceneScale" | "topicMessage" | "dataVolume";
type TrendMode = "daily" | "hourly";

const summaryItems = [
  { key: "totalScenes", label: "场景总数" },
  { key: "runningScenes", label: "运行中场景" },
  { key: "pausedScenes", label: "已暂停场景" },
  { key: "errorScenes", label: "异常场景" },
  { key: "totalDataScale", label: "总数据量" },
  { key: "totalIncrementScale", label: "当前增量规模" },
  { key: "totalKafkaMessages", label: "Topic 消息总量" },
  { key: "todayNewRows", label: "今日新增数据" },
];

function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatDateTime(value?: unknown) {
  if (!value) return "-";
  return String(value).replace("T", " ").replace(/\.\d+Z?$/, "");
}

function buildHorizontalBarOption(data: Array<Record<string, unknown>>, valueKey: string, color: string) {
  const items = data.slice(0, 8);
  return {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#eef2f7" } },
      axisLabel: { color: "#6b7280" },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: items.map((item) => item.sceneName),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#111827", width: 160, overflow: "truncate" },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    series: [
      {
        type: "bar",
        data: items.map((item) => Number(item[valueKey] || 0)),
        barWidth: 18,
        itemStyle: { color, borderRadius: [0, 10, 10, 0] },
        label: {
          show: true,
          position: "right",
          color: "#4b5563",
          formatter: ({ value }: { value: number }) => formatNumber(value),
        },
      },
    ],
  };
}

function buildTrendOption(data: Array<Record<string, unknown>>, color: string) {
  const items = data.slice(-24);
  return {
    grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: items.map((item) => item.label),
      axisLine: { lineStyle: { color: "#dbe3ea" } },
      axisLabel: { color: "#6b7280" },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#eef2f7" } },
      axisLabel: { color: "#6b7280" },
    },
    tooltip: { trigger: "axis" },
    series: [
      {
        type: "line",
        smooth: true,
        data: items.map((item) => Number(item.value || 0)),
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { width: 3, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}55` },
              { offset: 1, color: `${color}08` },
            ],
          },
        },
      },
    ],
  };
}

export function DataLabOpsDashboardPage() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<LabOpsDashboard | null>(null);
  const [rankingMode, setRankingMode] = useState<RankingMode>("sceneScale");
  const [trendMode, setTrendMode] = useState<TrendMode>("daily");

  useEffect(() => {
    if (!token) return;
    fetchOpsDashboard(token)
      .then((response) => setDashboard(response.data))
      .catch(() => setDashboard(null));
  }, [token]);

  const overview = dashboard?.overview || {};

  const rankingConfig = useMemo(() => {
    if (rankingMode === "topicMessage") {
      return {
        valueKey: "messageCount",
        color: "#2563eb",
        data: (dashboard?.rankings?.topicMessageRanking || []) as Array<Record<string, unknown>>,
      };
    }
    if (rankingMode === "dataVolume") {
      return {
        valueKey: "totalDataCount",
        color: "#ea580c",
        data: (dashboard?.rankings?.dataVolumeRanking || []) as Array<Record<string, unknown>>,
      };
    }
    return {
      valueKey: "tableCount",
      color: "#0f766e",
      data: (dashboard?.rankings?.sceneScaleRanking || []) as Array<Record<string, unknown>>,
    };
  }, [dashboard, rankingMode]);

  const trendConfig = useMemo(() => {
    if (trendMode === "hourly") {
      return {
        title: "小时级数据量变化",
        color: "#7c3aed",
        data: (dashboard?.trends?.hourlyDataVolume || []) as Array<Record<string, unknown>>,
      };
    }
    return {
      title: "日级数据量变化",
      color: "#0f766e",
      data: (dashboard?.trends?.dailyDataVolume || []) as Array<Record<string, unknown>>,
    };
  }, [dashboard, trendMode]);

  const sceneSnapshots = ((dashboard?.sceneSnapshots || []) as Array<Record<string, unknown>>).slice(0, 12);

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Row gutter={[16, 16]}>
        {summaryItems.map((item) => (
          <Col span={6} key={item.key}>
            <Card bordered={false}>
              <Statistic title={item.label} value={Number(overview[item.key] || 0)} formatter={(value) => formatNumber(value)} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            bordered={false}
            title="核心排名"
            extra={
              <Segmented
                size="small"
                value={rankingMode}
                onChange={(value) => setRankingMode(value as RankingMode)}
                options={[
                  { label: "场景规模", value: "sceneScale" },
                  { label: "Topic 消息量", value: "topicMessage" },
                  { label: "数据量", value: "dataVolume" },
                ]}
              />
            }
          >
            {rankingConfig.data.length ? (
              <ReactECharts option={buildHorizontalBarOption(rankingConfig.data, rankingConfig.valueKey, rankingConfig.color)} style={{ height: 360 }} />
            ) : (
              <Empty description="暂无排名数据" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            bordered={false}
            title={trendConfig.title}
            extra={
              <Segmented
                size="small"
                value={trendMode}
                onChange={(value) => setTrendMode(value as TrendMode)}
                options={[
                  { label: "按日", value: "daily" },
                  { label: "按小时", value: "hourly" },
                ]}
              />
            }
          >
            {trendConfig.data.length ? (
              <ReactECharts option={buildTrendOption(trendConfig.data, trendConfig.color)} style={{ height: 360 }} />
            ) : (
              <Empty description="暂无趋势数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Card bordered={false} title="场景运行快照">
        <Table
          rowKey={(record) => String(record.sceneId || record.sceneName)}
          dataSource={sceneSnapshots}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: "场景名称", dataIndex: "sceneName", ellipsis: true },
            {
              title: "状态",
              dataIndex: "status",
              width: 110,
              render: (value: string) => <Tag color={value === "RUNNING" ? "green" : value === "PAUSED" ? "gold" : value === "ERROR" ? "red" : "blue"}>{value || "-"}</Tag>,
            },
            { title: "表数量", dataIndex: "tableCount", width: 90, render: (value: unknown) => formatNumber(value) },
            { title: "Topic 数量", dataIndex: "topicCount", width: 100, render: (value: unknown) => formatNumber(value) },
            { title: "Topic 消息量", dataIndex: "messageCount", width: 120, render: (value: unknown) => formatNumber(value) },
            { title: "总数据量", dataIndex: "totalDataCount", width: 120, render: (value: unknown) => formatNumber(value) },
            { title: "最近运行时间", dataIndex: "lastRunTime", width: 180, render: (value: unknown) => formatDateTime(value) },
          ]}
        />
      </Card>
    </Space>
  );
}
