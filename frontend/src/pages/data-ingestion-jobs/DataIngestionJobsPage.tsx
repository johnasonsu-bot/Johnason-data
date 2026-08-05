import {
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Popover,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SettingOutlined,
  StopOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { analyzeJobRunFailure, createTask, deleteTask, fetchJobRuns, fetchTaskById, fetchTasks, runTaskNow, startTask, stopTask, type CreateTaskPayload } from "../../services/ingestionTask";
import { fetchDataSources } from "../../services/platform";
import type { DataSourceRecord, IngestionTask, JobRun, JobRunFailureAnalysisResponse } from "../../types/api";

const TASK_LIST_COLUMN_STORAGE_KEY = "data_ingestion_job_list_columns_v1";
const DEFAULT_VISIBLE_COLUMNS = [
  "taskName",
  "taskCode",
  "sourceName",
  "sourceTable",
  "targetSourceName",
  "targetTable",
  "syncMode",
  "incrementalCursor",
  "status",
  "lastRunStatus",
  "runDuration",
  "speed",
  "lastRunTime"
] as const;

const statusColors: Record<string, string> = {
  draft: "default",
  running: "blue",
  paused: "orange",
  stopped: "red",
  completed: "green",
  failed: "red",
  active: "green",
  pending: "gold",
  cancelled: "default"
};

const statusLabels: Record<string, string> = {
  draft: "草稿",
  running: "运行中",
  paused: "已暂停",
  stopped: "已停止",
  completed: "已完成",
  failed: "失败",
  active: "已启用",
  pending: "待执行",
  cancelled: "已取消"
};

const analysisConfidenceLabels: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低"
};

const analysisSeverityLabels: Record<string, string> = {
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低"
};

const analysisSeverityColors: Record<string, string> = {
  critical: "red",
  high: "volcano",
  medium: "gold",
  low: "blue"
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function getDataSourceStatusMeta(record?: DataSourceRecord | null) {
  if (!record) {
    return { color: "default", label: "未知" };
  }

  switch (record.connectionStatus) {
    case "online":
      return { color: "green", label: "在线" };
    case "offline":
      return { color: "red", label: "离线" };
    case "disabled":
      return { color: "default", label: "已停用" };
    default:
      return { color: "gold", label: "未探测" };
  }
}

function renderDataSourceWithStatus(name?: string, dataSource?: DataSourceRecord | null) {
  const meta = getDataSourceStatusMeta(dataSource);

  return (
    <Space direction="vertical" size={2}>
      <Typography.Text>{name || "-"}</Typography.Text>
      <Tag color={meta.color} style={{ width: "fit-content", marginInlineEnd: 0 }}>
        {meta.label}
      </Tag>
    </Space>
  );
}

interface TaskExportItem extends CreateTaskPayload {
  sourceName?: string;
  targetSourceName?: string;
}

interface TaskExportFile {
  version: string;
  exportedAt: string;
  tasks: TaskExportItem[];
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function buildImportPayload(task: IngestionTask): TaskExportItem {
  return {
    taskName: task.taskName,
    taskCode: task.taskCode,
    sourceId: task.sourceId,
    sourceTable: task.sourceTable,
    targetSourceId: task.targetSourceId,
    targetTable: task.targetTable,
    targetTableMode: "existing",
    targetConfig: task.targetConfig || {},
    syncMode: task.syncMode,
    status: task.status,
    description: task.description,
    ownerName: task.ownerName,
    scheduleEnabled: task.scheduleEnabled,
    fieldMappings: task.fieldMappings || [],
    transformRules: task.transformRules || [],
    incrementalConfig: task.incrementalConfig || undefined,
    scheduleConfig: task.scheduleConfig || undefined,
    sourceName: task.sourceName,
    targetSourceName: task.targetSourceName
  };
}

function formatDuration(startTime?: string | null, endTime?: string | null, currentTime = Date.now()) {
  if (!startTime) {
    return "-";
  }

  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) {
    return "-";
  }

  const end = endTime ? new Date(endTime).getTime() : currentTime;
  if (Number.isNaN(end)) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}小时 ${String(minutes).padStart(2, "0")}分 ${String(seconds).padStart(2, "0")}秒`;
  }

  if (minutes > 0) {
    return `${minutes}分 ${String(seconds).padStart(2, "0")}秒`;
  }

  return `${seconds}秒`;
}

function summarizeText(value?: string | null, maxLength = 120) {
  if (!value) {
    return "-";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "-";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function getExecutionInfo(record: JobRun) {
  return (record.executionInfo || {}) as Record<string, any>;
}

function getTaskExecutionInfo(task: IngestionTask) {
  return (task.lastExecutionInfo || {}) as Record<string, any>;
}

function getIncrementalCursor(task: IngestionTask) {
  const incrementalConfig = task.incrementalConfig;
  if (!incrementalConfig || task.syncMode !== "incremental") {
    return "-";
  }

  const cursorValue = incrementalConfig.lastValue ?? incrementalConfig.startValue;
  if (cursorValue === null || cursorValue === undefined || cursorValue === "") {
    return "-";
  }

  if (incrementalConfig.mode === "timestamp") {
    return formatDateTime(String(cursorValue));
  }

  return String(cursorValue);
}

function getNestedExecutionInfo(record: JobRun) {
  const executionInfo = getExecutionInfo(record);
  return (executionInfo.executionInfo ||
    executionInfo.result ||
    {}) as Record<string, any>;
}

function getMetrics(record: JobRun) {
  const executionInfo = getExecutionInfo(record);
  const nested = getNestedExecutionInfo(record);

  return (executionInfo.metrics ||
    nested.metrics ||
    {}) as Record<string, any>;
}

function getTaskMetrics(task: IngestionTask) {
  const executionInfo = getTaskExecutionInfo(task);
  return (executionInfo.metrics ||
    executionInfo.result?.metrics ||
    {}) as Record<string, any>;
}

function getTaskRunDuration(task: IngestionTask, currentTime: number) {
  if (!task.lastRunTime) {
    return "-";
  }

  const endTime = task.lastRunStatus === "running" ? undefined : task.lastEndTime;
  return formatDuration(task.lastRunTime, endTime, currentTime);
}

function loadVisibleColumns() {
  if (typeof window === "undefined") {
    return [...DEFAULT_VISIBLE_COLUMNS];
  }

  try {
    const rawValue = window.localStorage.getItem(TASK_LIST_COLUMN_STORAGE_KEY);
    if (!rawValue) {
      return [...DEFAULT_VISIBLE_COLUMNS];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_VISIBLE_COLUMNS];
    }

    const nextColumns = parsed.filter((item): item is string => typeof item === "string");
    return nextColumns.length > 0 ? nextColumns : [...DEFAULT_VISIBLE_COLUMNS];
  } catch (_error) {
    return [...DEFAULT_VISIBLE_COLUMNS];
  }
}

function getLogContent(record: JobRun, field: "stdout" | "stderr") {
  const executionInfo = getExecutionInfo(record);
  const nested = getNestedExecutionInfo(record);
  const error = executionInfo.error as Record<string, any> | undefined;

  return (
    executionInfo[field] ||
    nested[field] ||
    error?.[field] ||
    ""
  ) as string;
}

function getErrorSummary(record: JobRun) {
  const executionInfo = getExecutionInfo(record);
  const error = executionInfo.error as Record<string, any> | undefined;

  return record.errorMessage || error?.message || "-";
}

function renderLogBlock(content: string, mode: "default" | "error" = "default") {
  return (
    <pre
      style={{
        margin: 0,
        padding: 16,
        maxHeight: 360,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        borderRadius: 12,
        border: `1px solid ${mode === "error" ? "#ffccc7" : "#1f2937"}`,
        background: mode === "error" ? "#fff2f0" : "#0f172a",
        color: mode === "error" ? "#a61d24" : "#e5eefb",
        fontSize: 12,
        lineHeight: 1.65,
        fontFamily: "Consolas, 'Courier New', monospace"
      }}
    >
      {content || "暂无内容"}
    </pre>
  );
}

function LogDetail({
  record,
  currentTime,
  analysisResult,
  analysisLoading,
  onAnalyze
}: {
  record: JobRun;
  currentTime: number;
  analysisResult?: JobRunFailureAnalysisResponse;
  analysisLoading: boolean;
  onAnalyze: (record: JobRun) => void;
}) {
  const metrics = getMetrics(record);
  const stdout = getLogContent(record, "stdout");
  const stderr = getLogContent(record, "stderr");
  const executionInfo = getExecutionInfo(record);

  const logPanels = [
    record.errorMessage
      ? {
          key: "error-summary",
          label: "错误摘要",
          children: renderLogBlock(record.errorMessage, "error")
        }
      : null,
    stderr
      ? {
          key: "stderr",
          label: `错误输出${stderr ? ` (${stderr.length} 字符)` : ""}`,
          children: renderLogBlock(stderr, "error")
        }
      : null,
    stdout
      ? {
          key: "stdout",
          label: `标准输出${stdout ? ` (${stdout.length} 字符)` : ""}`,
          children: renderLogBlock(stdout)
        }
      : null,
    {
      key: "json",
      label: "执行详情 JSON",
      children: renderLogBlock(JSON.stringify(executionInfo, null, 2))
    }
  ].filter(Boolean) as Array<{ key: string; label: string; children: ReactNode }>;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Descriptions bordered size="small" column={2} styles={{ label: { width: 120 } }}>
        <Descriptions.Item label="运行状态">
          <Tag color={statusColors[record.runStatus] || "default"}>
            {statusLabels[record.runStatus] || record.runStatus}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="处理记录数">{record.recordsCount ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="开始时间">{formatDateTime(record.startTime)}</Descriptions.Item>
        <Descriptions.Item label="结束时间">{formatDateTime(record.endTime)}</Descriptions.Item>
      </Descriptions>

      <Row gutter={12}>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="读取记录" value={metrics.totalRecords ?? "-"} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="错误记录" value={metrics.errorRecords ?? "-"} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="运行时长" value={formatDuration(record.startTime, record.endTime, currentTime)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="执行速度" value={metrics.speed ?? "-"} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="失败原因"
        extra={
          record.runStatus === "failed" ? (
            <Button type="primary" icon={<RobotOutlined />} loading={analysisLoading} onClick={() => onAnalyze(record)}>
              AI分析失败原因
            </Button>
          ) : null
        }
        styles={{ body: { padding: 16 } }}
      >
        {record.runStatus === "failed" ? (
          <div style={{ marginTop: 16 }}>
            {analysisResult ? (
              <Card
                size="small"
                title="AI 分析结果"
                extra={
                  <Space wrap>
                    <Tag color="processing">{analysisResult.modelProviderName} / {analysisResult.modelName}</Tag>
                    <Tag color={analysisSeverityColors[analysisResult.analysis.severity] || "default"}>
                      严重级别: {analysisSeverityLabels[analysisResult.analysis.severity] || analysisResult.analysis.severity}
                    </Tag>
                    <Tag>
                      置信度: {analysisConfidenceLabels[analysisResult.analysis.confidence] || analysisResult.analysis.confidence}
                    </Tag>
                  </Space>
                }
                styles={{ body: { padding: 16 } }}
              >
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="原因概述">{analysisResult.analysis.causeSummary}</Descriptions.Item>
                  <Descriptions.Item label="根因分析">{analysisResult.analysis.rootCause || "-"}</Descriptions.Item>
                  <Descriptions.Item label="关键证据">
                    {analysisResult.analysis.evidence.length ? analysisResult.analysis.evidence.join("；") : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="建议动作">
                    {analysisResult.analysis.suggestions.length ? analysisResult.analysis.suggestions.join("；") : "-"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ) : (
              <Card size="small" styles={{ body: { padding: 16 } }}>
                <Typography.Text type="secondary">
                  当前分析使用 AI管理 中为“日志分析”维护的默认模型和系统提示词。
                </Typography.Text>
              </Card>
            )}
          </div>
        ) : null}

        <Typography.Paragraph style={{ margin: record.runStatus === "failed" ? "16px 0 0" : 0 }}>
          {getErrorSummary(record)}
        </Typography.Paragraph>
      </Card>

      <Collapse
        size="small"
        items={logPanels}
        defaultActiveKey={record.runStatus === "failed" ? ["error-summary", "stderr"] : ["stdout"]}
      />
    </Space>
  );
}

export function DataIngestionJobsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<IngestionTask[]>([]);
  const [dataSourceMap, setDataSourceMap] = useState<Record<number, DataSourceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>();
  const [syncModeFilter, setSyncModeFilter] = useState<string>();
  const [lastRunStatusFilter, setLastRunStatusFilter] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logTask, setLogTask] = useState<IngestionTask | null>(null);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [analysisLoadingByRun, setAnalysisLoadingByRun] = useState<Record<number, boolean>>({});
  const [analysisResultByRun, setAnalysisResultByRun] = useState<Record<number, JobRunFailureAnalysisResponse>>({});
  const [expandedRunRowKeys, setExpandedRunRowKeys] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => loadVisibleColumns());
  const pollingTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const relatedSourceIds = useMemo(
    () => Array.from(new Set(
      records.flatMap((item) => [item.sourceId, item.targetSourceId].filter((value): value is number => Number.isFinite(Number(value)) && Number(value) > 0))
    )).sort((left, right) => left - right),
    [records]
  );

  async function loadDataSourceStatuses(options?: { silent?: boolean; sourceIds?: number[] }) {
    if (!token) {
      return;
    }

    const sourceIds = Array.from(new Set((options?.sourceIds || []).filter((value) => Number.isFinite(Number(value)) && Number(value) > 0)));
    if (!sourceIds.length) {
      setDataSourceMap({});
      return;
    }

    try {
      const response = await fetchDataSources(token, { includeConnectivity: true, ids: sourceIds });
      setDataSourceMap(
        Object.fromEntries(response.data.map((item) => [item.id, item]))
      );
    } catch (error: any) {
      if (!options?.silent) {
        message.error(`加载数据源状态失败: ${error.message || "未知错误"}`);
      }
    }
  }

  async function loadData(searchKeyword = keyword, nextPage = page, nextPageSize = pageSize) {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetchTasks(token, {
        status: statusFilter,
        syncMode: syncModeFilter,
        lastRunStatus: lastRunStatusFilter,
        keyword: searchKeyword || undefined,
        page: nextPage,
        pageSize: nextPageSize
      });
      setRecords(response.data);
      setTotal(Number(response.meta?.total ?? response.data.length));
      setPage(Number(response.meta?.page ?? nextPage));
      setPageSize(Number(response.meta?.pageSize ?? nextPageSize));
      setSelectedRowKeys((current) =>
        current.filter((key) => response.data.some((item) => item.id === key))
      );
    } catch (error: any) {
      message.error(`加载任务列表失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(keyword, 1, pageSize);
  }, [token, statusFilter, syncModeFilter, lastRunStatusFilter]);

  useEffect(() => {
    if (!token || relatedSourceIds.length === 0) {
      setDataSourceMap({});
      return;
    }

    void loadDataSourceStatuses({ sourceIds: relatedSourceIds });
  }, [token, relatedSourceIds]);

  useEffect(() => {
    if (!token || relatedSourceIds.length === 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadDataSourceStatuses({ silent: true, sourceIds: relatedSourceIds });
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, [token, relatedSourceIds]);

  useEffect(() => {
    const hasRunningTask = records.some(
      (item) => item.status === "running" || item.lastRunStatus === "running"
    );

    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    if (token && hasRunningTask) {
      pollingTimerRef.current = window.setInterval(() => {
        void loadData();
      }, 3000);
    }

    return () => {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [records, token, statusFilter, syncModeFilter, lastRunStatusFilter, keyword, page, pageSize]);

  useEffect(() => {
    if (!token || !logOpen || !logTask) {
      return undefined;
    }

    const hasRunningRun = jobRuns.some((item) => item.runStatus === "running");
    if (!hasRunningRun) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadJobRunsForTask(logTask, { silent: true });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [token, logOpen, logTask, jobRuns]);

  useEffect(() => {
    if (!logOpen) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [logOpen]);

  useEffect(() => {
    const hasRunningTask = records.some((item) => item.lastRunStatus === "running" || item.status === "running");
    if (!hasRunningTask) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [records]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TASK_LIST_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  const selectedRecords = records.filter((item) => selectedRowKeys.includes(item.id));

  async function exportTasks(targetRecords: IngestionTask[], filenamePrefix: string) {
    if (!token || targetRecords.length === 0) {
      return;
    }

    setExporting(true);
    try {
      const details = await Promise.all(
        targetRecords.map(async (record) => {
          const response = await fetchTaskById(token, record.id);
          return buildImportPayload(response.data);
        })
      );

      const payload: TaskExportFile = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tasks: details
      };

      downloadJson(
        `${filenamePrefix}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
        payload
      );
      message.success(`已导出 ${details.length} 个任务`);
    } catch (error: any) {
      message.error(`导出任务失败: ${error.message || "未知错误"}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleBatchDelete() {
    if (!token || selectedRowKeys.length === 0) {
      return;
    }

    setBatchDeleting(true);
    try {
      const failures: string[] = [];
      let successCount = 0;

      for (const record of selectedRecords) {
        try {
          await deleteTask(token, record.id);
          successCount += 1;
        } catch (error: any) {
          failures.push(`${record.taskName}: ${error.message || "删除失败"}`);
        }
      }

      if (successCount > 0) {
        message.success(`已删除 ${successCount} 个任务`);
      }
      if (failures.length > 0) {
        message.error(`有 ${failures.length} 个任务删除失败`);
      }

      setSelectedRowKeys([]);
      await loadData();
    } finally {
      setBatchDeleting(false);
    }
  }

  function openImportDialog() {
    importInputRef.current?.click();
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !token) {
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as TaskExportFile | TaskExportItem[];
      const tasks = Array.isArray(parsed) ? parsed : parsed.tasks;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new Error("导入文件中没有可用任务");
      }

      const failures: string[] = [];
      let successCount = 0;

      for (const item of tasks) {
        try {
          await createTask(token, {
            taskName: item.taskName,
            taskCode: item.taskCode,
            sourceId: item.sourceId,
            sourceTable: item.sourceTable,
            targetSourceId: item.targetSourceId,
            targetTable: item.targetTable,
            targetTableMode: item.targetTableMode || "existing",
            targetConfig: item.targetConfig || {},
            syncMode: item.syncMode,
            status: item.status,
            description: item.description,
            ownerName: item.ownerName,
            scheduleEnabled: item.scheduleEnabled,
            fieldMappings: item.fieldMappings || [],
            transformRules: item.transformRules || [],
            incrementalConfig: item.incrementalConfig,
            scheduleConfig: item.scheduleConfig
          });
          successCount += 1;
        } catch (error: any) {
          failures.push(`${item.taskName || item.taskCode || "未命名任务"}: ${error.message || "导入失败"}`);
        }
      }

      if (successCount > 0) {
        message.success(`成功导入 ${successCount} 个任务`);
      }
      if (failures.length > 0) {
        message.error(`有 ${failures.length} 个任务导入失败`);
      }

      await loadData();
    } catch (error: any) {
      message.error(`导入任务失败: ${error.message || "文件格式错误"}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(record: IngestionTask) {
    if (!token) {
      return;
    }

    setDeletingId(record.id);
    try {
      await deleteTask(token, record.id);
      message.success("任务删除成功");
      await loadData();
    } catch (error: any) {
      message.error(`删除失败: ${error.message || "未知错误"}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRun(type: "start" | "stop" | "run", record: IngestionTask) {
    if (!token) {
      return;
    }

    setActionLoading(record.id);
    try {
      if (type === "start") {
        await startTask(token, record.id);
        message.success("任务启动成功");
      } else if (type === "stop") {
        await stopTask(token, record.id);
        message.success("任务停止成功");
      } else {
        const response = await runTaskNow(token, record.id);
        setRecords((current) =>
          current.map((item) => (item.id === record.id ? { ...item, ...response.data, status: "running" } : item))
        );
        message.success("任务已触发执行");
      }
      await loadData();
    } catch (error: any) {
      const actionLabel = type === "run" ? "执行" : type === "start" ? "启动" : "停止";
      message.error(`${actionLabel}失败: ${error.message || "未知错误"}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function loadJobRunsForTask(
    record: IngestionTask,
    options?: {
      resetExpandedRows?: boolean;
      silent?: boolean;
      openModal?: boolean;
    }
  ) {
    if (!token) {
      return;
    }

    const shouldResetExpandedRows = options?.resetExpandedRows ?? false;
    const silent = options?.silent ?? false;
    const shouldOpenModal = options?.openModal ?? false;

    if (shouldResetExpandedRows) {
      setExpandedRunRowKeys([]);
    }

    setLogTask(record);
    if (shouldOpenModal) {
      setLogOpen(true);
    }
    if (!silent) {
      setLogLoading(true);
    }
    try {
      const response = await fetchJobRuns(token, record.id);
      setJobRuns(response.data);
      setExpandedRunRowKeys((current) =>
        current.filter((key) => response.data.some((item) => item.id === key))
      );
    } catch (error: any) {
      if (!silent) {
        message.error(`加载运行日志失败: ${error.message || "未知错误"}`);
        setJobRuns([]);
      }
    } finally {
      if (!silent) {
        setLogLoading(false);
      }
    }
  }

  async function openLogs(record: IngestionTask) {
    await loadJobRunsForTask(record, {
      resetExpandedRows: true,
      openModal: true
    });
  }


  async function handleAnalyzeFailure(record: JobRun) {
    if (!token || !logTask) {
      return;
    }

    setExpandedRunRowKeys((current) => (current.includes(record.id) ? current : [...current, record.id]));
    setAnalysisLoadingByRun((current) => ({ ...current, [record.id]: true }));
    try {
      const response = await analyzeJobRunFailure(token, logTask.id, record.id);
      setAnalysisResultByRun((current) => ({ ...current, [record.id]: response.data }));
      message.success("AI 分析完成");
    } catch (error: any) {
      message.error(`AI 分析失败: ${error.message || "未知错误"}`);
    } finally {
      setAnalysisLoadingByRun((current) => ({ ...current, [record.id]: false }));
    }
  }

  const taskColumns: ColumnsType<IngestionTask> = [
    {
      key: "taskName",
      title: "任务名称",
      dataIndex: "taskName",
      width: 160,
      ellipsis: true
    },
    {
      key: "taskCode",
      title: "任务编码",
      dataIndex: "taskCode",
      width: 140,
      ellipsis: true
    },
    {
      key: "sourceName",
      title: "来源数据源",
      dataIndex: "sourceName",
      width: 180,
      render: (value: string | undefined, record) =>
        renderDataSourceWithStatus(value, dataSourceMap[record.sourceId])
    },
    {
      key: "sourceTable",
      title: "来源表",
      dataIndex: "sourceTable",
      width: 150,
      ellipsis: true
    },
    {
      key: "targetSourceName",
      title: "目标数据源",
      dataIndex: "targetSourceName",
      width: 180,
      render: (value: string | undefined, record) =>
        renderDataSourceWithStatus(value, dataSourceMap[record.targetSourceId])
    },
    {
      key: "targetTable",
      title: "目标表",
      dataIndex: "targetTable",
      width: 150,
      ellipsis: true
    },
    {
      key: "syncMode",
      title: "同步模式",
      dataIndex: "syncMode",
      width: 120,
      render: (value: string) => ({ full: "全量", incremental: "增量", cdc: "CDC" }[value] || value)
    },
    {
      key: "incrementalCursor",
      title: "增量游标",
      dataIndex: "incrementalConfig",
      width: 180,
      ellipsis: true,
      render: (_value, record) => getIncrementalCursor(record)
    },
    {
      key: "status",
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: string) => (
        <Tag color={statusColors[value] || "default"}>{statusLabels[value] || value}</Tag>
      )
    },
    {
      key: "lastRunStatus",
      title: "最近运行",
      dataIndex: "lastRunStatus",
      width: 110,
      render: (value: string | undefined, record) =>
        value ? (
          <Tag
            color={statusColors[value] || "default"}
            style={{ cursor: "pointer" }}
            onClick={() => openLogs(record)}
          >
            {statusLabels[value] || value}
          </Tag>
        ) : (
          "-"
        )
    },
    {
      key: "runDuration",
      title: "运行耗时",
      dataIndex: "lastRunTime",
      width: 120,
      render: (_value, record) => getTaskRunDuration(record, currentTime)
    },
    {
      key: "speed",
      title: "执行速度",
      dataIndex: "lastExecutionInfo",
      width: 120,
      render: (_value, record) => {
        const metrics = getTaskMetrics(record);
        const speed = metrics.recordSpeed || metrics.speed;
        return speed || "-";
      }
    },
    {
      key: "lastRunTime",
      title: "最后执行时间",
      dataIndex: "lastRunTime",
      width: 160,
      render: (value?: string) => formatDateTime(value)
    },
    {
      key: "actions",
      title: "操作",
      fixed: "right",
      width: 280,
      render: (_, record) => (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            disabled={actionLoading === record.id}
            onClick={() => navigate(`/dashboard/data-ingestion-jobs/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            icon={<PlayCircleOutlined />}
            disabled={actionLoading === record.id}
            onClick={() => handleRun("run", record)}
          >
            执行
          </Button>
          <Button
            type="text"
            size="small"
            icon={record.scheduleEnabled && record.status === "active" ? <StopOutlined /> : <PlayCircleOutlined />}
            disabled={actionLoading === record.id}
            onClick={() => void handleRun(record.scheduleEnabled && record.status === "active" ? "stop" : "start", record)}
          >
            {record.scheduleEnabled && record.status === "active" ? "停止" : "启动"}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openLogs(record)}
          >
            日志
          </Button>
          <Popconfirm
            title="确认删除该任务？"
            description="删除后不可恢复。"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
              disabled={actionLoading === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const runColumns: ColumnsType<JobRun> = [
    {
      title: "运行时间",
      dataIndex: "createdAt",
      width: 180,
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: "状态",
      dataIndex: "runStatus",
      width: 100,
      render: (value: string) => (
        <Tag color={statusColors[value] || "default"}>{statusLabels[value] || value}</Tag>
      )
    },
    {
      title: "开始时间",
      dataIndex: "startTime",
      width: 180,
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: "结束时间",
      dataIndex: "endTime",
      width: 180,
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: "运行耗时",
      dataIndex: "startTime",
      width: 140,
      render: (_value, record) => formatDuration(record.startTime, record.endTime, currentTime)
    },
    {
      title: "记录数",
      dataIndex: "recordsCount",
      width: 100,
      align: "right",
      render: (value?: number) => value ?? "-"
    },
    {
      title: "失败摘要",
      dataIndex: "errorMessage",
      width: 360,
      render: (_value, record) => (
        <Typography.Text type={record.runStatus === "failed" ? "danger" : undefined}>
          {summarizeText(getErrorSummary(record), 90)}
        </Typography.Text>
      )
    }
  ];

  const columnOptions = taskColumns
    .filter((column) => column.key && column.key !== "actions")
    .map((column) => ({
      label: String(column.title),
      value: String(column.key)
    }));

  const visibleTaskColumns = taskColumns.filter((column) => {
    const key = String(column.key || "");
    if (key === "actions") {
      return true;
    }
    return visibleColumnKeys.includes(key);
  });

  const columnSettingContent = (
    <div style={{ width: 360 }}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div>
          <Typography.Text strong>显示字段</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
            选择任务列表中需要展示的列
          </Typography.Paragraph>
        </div>

        <Checkbox.Group
          style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
          value={visibleColumnKeys}
          options={columnOptions}
          onChange={(values) => setVisibleColumnKeys(values as string[])}
        />

        <Divider style={{ margin: 0 }} />

        <Space size={8} wrap>
          <Button size="small" onClick={() => setVisibleColumnKeys([...DEFAULT_VISIBLE_COLUMNS])}>
            恢复默认
          </Button>
          <Button size="small" onClick={() => setVisibleColumnKeys(columnOptions.map((item) => String(item.value)))}>
            显示全部
          </Button>
          <Typography.Text type="secondary">
            已选 {visibleColumnKeys.length} 列
          </Typography.Text>
        </Space>
      </Space>
    </div>
  );

  return (
    <Space direction="vertical" size={24} style={{ display: "flex" }}>
      <Card bordered={false} styles={{ body: { padding: 20 } }}>
        <Row gutter={[10, 10]} justify="space-between" align="middle" style={{ marginBottom: 12 }}>
          <Col flex="auto">
            <Row gutter={[10, 10]}>
              <Col>
                <Select
                  placeholder="任务状态"
                  allowClear
                  size="middle"
                  style={{ width: 132 }}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "draft", label: "草稿" },
                    { value: "active", label: "已启用" },
                    { value: "paused", label: "已暂停" },
                    { value: "stopped", label: "已停止" }
                  ]}
                />
              </Col>
              <Col>
                <Select
                  placeholder="同步模式"
                  allowClear
                  size="middle"
                  style={{ width: 124 }}
                  value={syncModeFilter}
                  onChange={setSyncModeFilter}
                  options={[
                    { value: "full", label: "全量" },
                    { value: "incremental", label: "增量" },
                    { value: "cdc", label: "CDC" }
                  ]}
                />
              </Col>
              <Col>
                <Select
                  placeholder="最近运行"
                  allowClear
                  size="middle"
                  style={{ width: 132 }}
                  value={lastRunStatusFilter}
                  onChange={setLastRunStatusFilter}
                  options={[
                    { value: "running", label: "运行中" },
                    { value: "completed", label: "已完成" },
                    { value: "failed", label: "失败" },
                    { value: "cancelled", label: "已取消" }
                  ]}
                />
              </Col>
              <Col>
                <Input.Search
                  allowClear
                  size="middle"
                  style={{ width: 200 }}
                  placeholder="搜索任务编码、表名或名称"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onSearch={(value) => loadData(value, 1, pageSize)}
                />
              </Col>
              <Col>
                <Popover
                  trigger="click"
                  placement="bottomRight"
                  content={columnSettingContent}
                  overlayStyle={{ width: 392 }}
                >
                  <Button size="middle" icon={<SettingOutlined />}>
                    字段配置
                    {visibleColumnKeys.length !== columnOptions.length ? ` (${visibleColumnKeys.length})` : ""}
                  </Button>
                </Popover>
              </Col>
              <Col>
                <Button
                  size="middle"
                  icon={<DownloadOutlined />}
                  loading={exporting}
                  disabled={selectedRowKeys.length === 0}
                  onClick={() => void exportTasks(selectedRecords, "ingestion_tasks_selected")}
                >
                  导出选中
                </Button>
              </Col>
              <Col>
                <Button
                  size="middle"
                  icon={<ImportOutlined />}
                  loading={importing}
                  onClick={openImportDialog}
                >
                  导入任务
                </Button>
              </Col>
              <Col>
                <Popconfirm
                  title="确认删除选中的任务？"
                  description={`将删除 ${selectedRowKeys.length} 个任务，删除后不可恢复。`}
                  onConfirm={() => void handleBatchDelete()}
                  disabled={selectedRowKeys.length === 0}
                >
                  <Button
                    size="middle"
                    danger
                    icon={<DeleteOutlined />}
                    loading={batchDeleting}
                    disabled={selectedRowKeys.length === 0}
                  >
                    批量删除
                  </Button>
                </Popconfirm>
              </Col>
              <Col>
                <Typography.Text type="secondary">
                  已选 {selectedRowKeys.length} 项
                </Typography.Text>
              </Col>
              <Col>
                <Button type="primary" onClick={() => navigate("/dashboard/data-ingestion-jobs/create")}>
                  新建接入任务
                </Button>
              </Col>
            </Row>
          </Col>
          <Col>
            <Space />
          </Col>
        </Row>

        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(event) => void handleImportFile(event)}
        />

        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={records}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
            selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE]
          }}
          scroll={{ x: "max-content" }}
          pagination={{
            total,
            current: page,
            pageSize,
            showSizeChanger: true,
            showTotal: (currentTotal) => `共 ${currentTotal} 条`,
            onChange: (nextPage, nextPageSize) => {
              void loadData(keyword, nextPage, nextPageSize);
            }
          }}
          columns={visibleTaskColumns}
        />
      </Card>

      <Modal
        open={logOpen}
        title={logTask ? `${logTask.taskName} 运行日志` : "运行日志"}
        footer={null}
        onCancel={() => setLogOpen(false)}
        width={1280}
        styles={{
          body: {
            paddingTop: 12
          }
        }}
      >
        {jobRuns.length === 0 && !logLoading ? (
          <Empty description="暂无运行记录" />
        ) : (
          <Table
            rowKey="id"
            loading={logLoading}
            pagination={false}
            dataSource={jobRuns}
            scroll={{ x: 1080, y: 620 }}
            expandable={{
              expandedRowKeys: expandedRunRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRunRowKeys(keys as number[]),
              expandedRowRender: (record) => (
                <LogDetail
                  record={record}
                  currentTime={currentTime}
                  analysisResult={analysisResultByRun[record.id]}
                  analysisLoading={Boolean(analysisLoadingByRun[record.id])}
                  onAnalyze={handleAnalyzeFailure}
                />
              )
            }}
            columns={runColumns}
          />
        )}
      </Modal>
    </Space>
  );
}


