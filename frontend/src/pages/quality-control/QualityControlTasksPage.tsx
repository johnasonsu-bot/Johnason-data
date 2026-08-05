import {
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Table,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatusTag } from "../../components/ui/StatusTag";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createQualityTask,
  deleteQualityTask,
  fetchQualitySources,
  fetchQualityStrategyDetail,
  fetchQualityTaskRuns,
  fetchQualityTaskStrategyOptions,
  fetchQualityTasks,
  previewExistingQualityTaskSql,
  previewQualityTaskSql,
  runQualityTaskNow,
  startQualityTask,
  stopQualityTask,
  updateQualityTask,
  type QualityTaskPayload,
  type QualityTaskSqlPreview,
} from "../../services/qualityControl";
import type {
  QualityTaskIncrementalMode,
  QualityStrategyFieldRecord,
  QualityStrategyOptionRecord,
  QualityTaskRecord,
  QualityTaskRunRecord,
  QualityTaskTimeAnchor,
  QualityTaskTimeFormat,
  QualityTaskTimeOffsetUnit,
} from "../../types/api";
import { formatQualityBatchId } from "../../utils/qualityBatch";

type BusinessScheduleType = "manual" | "interval" | "daily" | "weekly" | "monthly" | "cron";

type StrategySelectOption = {
  value: number;
  label: string;
  hasTask: boolean;
};

type TaskFormValues = {
  taskName?: string;
  taskCode?: string;
  strategyVersionId?: number;
  fetchMode?: "full" | "incremental" | "sample";
  incrementalColumn?: string;
  incrementalMode?: QualityTaskIncrementalMode;
  startValue?: string;
  startValueMode?: "literal" | "dynamic_time";
  startValueFormatType?: QualityTaskTimeFormat;
  startValueOffsetValue?: number;
  startValueOffsetUnit?: QualityTaskTimeOffsetUnit;
  startValueAnchor?: QualityTaskTimeAnchor;
  endValue?: string;
  endValueMode?: "literal" | "dynamic_time";
  endValueFormatType?: QualityTaskTimeFormat;
  endValueOffsetValue?: number;
  endValueOffsetUnit?: QualityTaskTimeOffsetUnit;
  endValueAnchor?: QualityTaskTimeAnchor;
  sampleSize?: number;
  scheduleEnabled?: boolean;
  scheduleType?: BusinessScheduleType;
  intervalSeconds?: number;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  timezone?: string;
  status?: QualityTaskRecord["status"];
};

function buildTaskCode(taskName?: string, fallback?: string) {
  const normalized = String(taskName || fallback || "quality_task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return (normalized || "quality_task").slice(0, 64);
}

const TASK_TIME_FORMAT_OPTIONS: Array<{ value: QualityTaskTimeFormat; label: string; placeholder: string }> = [
  { value: "date", label: "yyyy-MM-dd", placeholder: "例如：2026-04-21" },
  { value: "datetime", label: "yyyy-MM-dd HH:mm:ss", placeholder: "例如：2026-04-21 09:30:00" },
  { value: "compact_date", label: "yyyyMMdd", placeholder: "例如：20260421" },
  { value: "compact_datetime", label: "yyyyMMddHHmmss", placeholder: "例如：20260421093000" },
  { value: "month", label: "yyyyMM", placeholder: "例如：202604" },
  { value: "epoch_seconds", label: "Unix 秒", placeholder: "例如：1776735000" },
  { value: "epoch_millis", label: "Unix 毫秒", placeholder: "例如：1776735000000" },
];

const TASK_TIME_OFFSET_UNIT_OPTIONS: Array<{ value: QualityTaskTimeOffsetUnit; label: string }> = [
  { value: "second", label: "秒" },
  { value: "minute", label: "分钟" },
  { value: "hour", label: "小时" },
  { value: "day", label: "天" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
];

const TASK_INCREMENTAL_MODE_OPTIONS: Array<{ value: QualityTaskIncrementalMode; label: string }> = [
  { value: "cursor", label: "游标续跑" },
  { value: "time_window", label: "时间窗口" },
];

const TASK_TIME_ANCHOR_OPTIONS: Array<{ value: QualityTaskTimeAnchor; label: string }> = [
  { value: "now", label: "当前时间" },
  { value: "day_start", label: "当天开始" },
  { value: "day_end", label: "当天结束" },
];

function getTaskTimePlaceholder(formatType?: QualityTaskTimeFormat) {
  return TASK_TIME_FORMAT_OPTIONS.find((item) => item.value === formatType)?.placeholder || TASK_TIME_FORMAT_OPTIONS[1].placeholder;
}

function getTaskTimeAnchorLabel(anchor?: QualityTaskTimeAnchor) {
  return TASK_TIME_ANCHOR_OPTIONS.find((item) => item.value === anchor)?.label || "当前时间";
}

function formatTaskDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatTaskFetchMode(value?: string | null) {
  if (value === "incremental") return "增量";
  if (value === "sample") return "抽样";
  return "全量";
}

function formatTaskSchedule(record: QualityTaskRecord) {
  const type = record.scheduleEnabled ? record.scheduleConfig?.scheduleType || "manual" : "manual";
  if (type === "interval") return "固定间隔";
  if (type === "daily") return "每天执行";
  if (type === "weekly") return "每周执行";
  if (type === "monthly") return "每月执行";
  if (type === "cron") return "Cron";
  return "手动执行";
}

function formatTaskRunStatus(value?: string | null) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "completed") return "已完成";
  if (normalized === "running") return "运行中";
  if (normalized === "failed") return "失败";
  if (normalized === "pending") return "待执行";
  if (normalized === "cancelled") return "已取消";
  return value || "-";
}

function buildStrategyVersionLabel(option?: QualityStrategyOptionRecord | null) {
  if (!option) return "-";
  const latestSuffix = option.latestVersionNo && option.latestVersionNo !== option.currentVersionNo
    ? ` / 最新V${option.latestVersionNo}`
    : "";
  return `${option.sourceName} / ${option.tableComment || option.tableName} / ${option.tableName} / 当前V${option.currentVersionNo}${latestSuffix}`;
}

export function QualityControlTasksPage() {
  const { token, user } = useAuth();
  const [form] = Form.useForm<TaskFormValues>();
  const strategyVersionId = Form.useWatch("strategyVersionId", form);
  const fetchMode = Form.useWatch("fetchMode", form) || "full";
  const incrementalMode = Form.useWatch("incrementalMode", form) || "cursor";
  const startValueMode = Form.useWatch("startValueMode", form) || "literal";
  const incrementalColumn = Form.useWatch("incrementalColumn", form);
  const startValue = Form.useWatch("startValue", form);
  const startValueFormatType = Form.useWatch("startValueFormatType", form);
  const startValueOffsetValue = Form.useWatch("startValueOffsetValue", form);
  const startValueOffsetUnit = Form.useWatch("startValueOffsetUnit", form);
  const startValueAnchor = Form.useWatch("startValueAnchor", form) || "now";
  const endValueMode = Form.useWatch("endValueMode", form) || "literal";
  const endValue = Form.useWatch("endValue", form);
  const endValueFormatType = Form.useWatch("endValueFormatType", form);
  const endValueOffsetValue = Form.useWatch("endValueOffsetValue", form);
  const endValueOffsetUnit = Form.useWatch("endValueOffsetUnit", form);
  const endValueAnchor = Form.useWatch("endValueAnchor", form) || "now";
  const scheduleEnabled = Form.useWatch("scheduleEnabled", form) || false;
  const scheduleType = Form.useWatch("scheduleType", form) || "manual";

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [incrementalConfigOpen, setIncrementalConfigOpen] = useState(false);
  const [sqlPreviewOpen, setSqlPreviewOpen] = useState(false);
  const [sqlPreviewLoading, setSqlPreviewLoading] = useState(false);
  const [sqlPreview, setSqlPreview] = useState<QualityTaskSqlPreview | null>(null);
  const [runDetailOpen, setRunDetailOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<QualityTaskRunRecord | null>(null);
  const [strategyOptions, setStrategyOptions] = useState<QualityStrategyOptionRecord[]>([]);
  const [tasks, setTasks] = useState<QualityTaskRecord[]>([]);
  const [editingTask, setEditingTask] = useState<QualityTaskRecord | null>(null);
  const [onlyUnassignedStrategies, setOnlyUnassignedStrategies] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState<number | undefined>(undefined);
  const [sources, setSources] = useState<Array<{ value: number; label: string }>>([]);
  const [strategyFields, setStrategyFields] = useState<QualityStrategyFieldRecord[]>([]);
  const [expandedTaskKeys, setExpandedTaskKeys] = useState<number[]>([]);
  const [taskRunsMap, setTaskRunsMap] = useState<Record<number, QualityTaskRunRecord[]>>({});
  const [taskRunsLoadingMap, setTaskRunsLoadingMap] = useState<Record<number, boolean>>({});

  function clearIncrementalFields() {
    form.setFieldsValue({
      incrementalColumn: undefined,
      incrementalMode: "cursor",
      startValue: undefined,
      startValueMode: "literal",
      startValueFormatType: "datetime",
      startValueOffsetValue: undefined,
      startValueOffsetUnit: "day",
      startValueAnchor: "now",
      endValue: undefined,
      endValueMode: "literal",
      endValueFormatType: "datetime",
      endValueOffsetValue: undefined,
      endValueOffsetUnit: "day",
      endValueAnchor: "now",
    });
  }

  function applyYesterdayWindowPreset() {
    form.setFieldsValue({
      incrementalMode: "time_window",
      startValueMode: "dynamic_time",
      startValueFormatType: "datetime",
      startValueOffsetValue: -1,
      startValueOffsetUnit: "day",
      startValueAnchor: "day_start",
      endValueMode: "dynamic_time",
      endValueFormatType: "datetime",
      endValueOffsetValue: 0,
      endValueOffsetUnit: "day",
      endValueAnchor: "day_start",
      endValue: undefined,
    });
  }

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [sourceResponse, taskResponse, strategyResponse] = await Promise.all([
        fetchQualitySources(token, { includeTableStats: false }),
        fetchQualityTasks(token, { sourceId: sourceFilter, keyword: keyword.trim() || undefined }),
        fetchQualityTaskStrategyOptions(token),
      ]);
      setSources(sourceResponse.data.filter((item) => item.supportedQuality).map((item) => ({ value: item.sourceId, label: item.sourceName })));
      setTasks(taskResponse.data);
      setStrategyOptions(strategyResponse.data);
      setExpandedTaskKeys((current) => current.filter((id) => taskResponse.data.some((item) => item.id === id)));
    } catch (error: any) {
      message.error(error.message || "加载质量任务失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadTaskRuns(taskId: number, force = false) {
    if (!token) return;
    if (!force && taskRunsMap[taskId]) {
      return;
    }

    setTaskRunsLoadingMap((current) => ({ ...current, [taskId]: true }));
    try {
      const response = await fetchQualityTaskRuns(token, taskId);
      setTaskRunsMap((current) => ({ ...current, [taskId]: response.data }));
    } finally {
      setTaskRunsLoadingMap((current) => ({ ...current, [taskId]: false }));
    }
  }

  useEffect(() => {
    void loadData();
  }, [token, sourceFilter]);

  useEffect(() => {
    if (!token || !strategyVersionId) {
      setStrategyFields([]);
      return;
    }
    const option = strategyOptions.find((item) => item.strategyVersionId === Number(strategyVersionId));
    if (!option) return;
    void (async () => {
      const response = await fetchQualityStrategyDetail(token, option.monitorTableId);
      const fields = response.data.currentVersion?.fieldStrategies || response.data.fields;
      setStrategyFields(fields);
      if (!editingTask) {
        form.setFieldsValue({
          taskName: `${option.tableComment || option.tableName}-质量巡检`,
          taskCode: buildTaskCode(`${option.sourceCode}_${option.tableName}_quality`),
        });
      }
    })();
  }, [token, strategyVersionId, strategyOptions]);

  function openCreateModal() {
    setEditingTask(null);
    setOnlyUnassignedStrategies(false);
    setStrategyFields([]);
    setIncrementalConfigOpen(false);
    form.resetFields();
    form.setFieldsValue({
      fetchMode: "full",
      incrementalMode: "cursor",
      startValueMode: "literal",
      startValueFormatType: "datetime",
      startValueOffsetUnit: "day",
      startValueAnchor: "now",
      endValueMode: "literal",
      endValueFormatType: "datetime",
      endValueOffsetUnit: "day",
      endValueAnchor: "now",
      scheduleEnabled: false,
      scheduleType: "manual",
      timezone: "Asia/Shanghai",
      status: "draft",
    });
    setTaskModalOpen(true);
  }

  async function openEditModal(task: QualityTaskRecord) {
    setEditingTask(task);
    setOnlyUnassignedStrategies(false);
    setIncrementalConfigOpen(false);
    form.resetFields();
    const strategyOption = strategyOptions.find((item) => item.strategyVersionId === task.strategyVersionId);
    if (strategyOption && token) {
      const response = await fetchQualityStrategyDetail(token, strategyOption.monitorTableId);
      setStrategyFields(response.data.currentVersion?.fieldStrategies || response.data.fields);
    }
    form.setFieldsValue({
      taskName: task.taskName,
      taskCode: task.taskCode,
      strategyVersionId: task.strategyVersionId,
      fetchMode: task.fetchMode as "full" | "incremental" | "sample",
      incrementalColumn: task.fetchConfig?.incrementalColumn,
      incrementalMode: task.fetchConfig?.incrementalMode || "cursor",
      startValue: task.fetchConfig?.startValue === undefined || task.fetchConfig?.startValue === null ? undefined : String(task.fetchConfig.startValue),
      startValueMode: task.fetchConfig?.startValueMode || "literal",
      startValueFormatType: task.fetchConfig?.startValueFormatType || "datetime",
      startValueOffsetValue: task.fetchConfig?.startValueOffsetValue,
      startValueOffsetUnit: task.fetchConfig?.startValueOffsetUnit || "day",
      startValueAnchor: task.fetchConfig?.startValueAnchor || "now",
      endValue: task.fetchConfig?.endValue === undefined || task.fetchConfig?.endValue === null ? undefined : String(task.fetchConfig.endValue),
      endValueMode: task.fetchConfig?.endValueMode || "literal",
      endValueFormatType: task.fetchConfig?.endValueFormatType || "datetime",
      endValueOffsetValue: task.fetchConfig?.endValueOffsetValue,
      endValueOffsetUnit: task.fetchConfig?.endValueOffsetUnit || "day",
      endValueAnchor: task.fetchConfig?.endValueAnchor || "now",
      sampleSize: task.fetchConfig?.sampleSize,
      scheduleEnabled: task.scheduleEnabled,
      scheduleType: (task.scheduleConfig?.scheduleType as BusinessScheduleType | undefined) || "manual",
      intervalSeconds: task.scheduleConfig?.intervalMs ? Math.floor(task.scheduleConfig.intervalMs / 1000) : undefined,
      runTime: task.scheduleConfig?.runTime,
      weekDays: task.scheduleConfig?.weekDays,
      monthDay: task.scheduleConfig?.monthDay,
      timezone: task.scheduleConfig?.timezone || "Asia/Shanghai",
      status: task.status,
    });
    setTaskModalOpen(true);
  }

  function buildIncrementalFetchConfig(values: TaskFormValues) {
    if (values.fetchMode !== "incremental") {
      return values.fetchMode === "sample"
        ? { sampleSize: values.sampleSize }
        : {};
    }

    return {
      incrementalColumn: values.incrementalColumn,
      incrementalMode: values.incrementalMode || "cursor",
      startValue: values.startValueMode === "dynamic_time" ? undefined : values.startValue,
      startValueMode: values.startValueMode,
      startValueFormatType: values.startValueMode === "dynamic_time" ? values.startValueFormatType : undefined,
      startValueOffsetValue: values.startValueMode === "dynamic_time" ? values.startValueOffsetValue : undefined,
      startValueOffsetUnit: values.startValueMode === "dynamic_time" ? values.startValueOffsetUnit : undefined,
      startValueAnchor: values.startValueMode === "dynamic_time" ? values.startValueAnchor : undefined,
      endValue: values.incrementalMode === "time_window" && values.endValueMode !== "dynamic_time" ? values.endValue : undefined,
      endValueMode: values.incrementalMode === "time_window" ? values.endValueMode : undefined,
      endValueFormatType: values.incrementalMode === "time_window" && values.endValueMode === "dynamic_time" ? values.endValueFormatType : undefined,
      endValueOffsetValue: values.incrementalMode === "time_window" && values.endValueMode === "dynamic_time" ? values.endValueOffsetValue : undefined,
      endValueOffsetUnit: values.incrementalMode === "time_window" && values.endValueMode === "dynamic_time" ? values.endValueOffsetUnit : undefined,
      endValueAnchor: values.incrementalMode === "time_window" && values.endValueMode === "dynamic_time" ? values.endValueAnchor : undefined,
    };
  }

  async function handleSubmit() {
    if (!token) return;
    try {
      const values = await form.validateFields();
      const fetchConfig = buildIncrementalFetchConfig(values);

      const payload: QualityTaskPayload = {
        taskName: values.taskName || "",
        taskCode: values.taskCode || "",
        strategyVersionId: Number(values.strategyVersionId),
        fetchMode: values.fetchMode || "full",
        fetchConfig,
        scheduleEnabled,
        scheduleConfig: scheduleEnabled
          ? {
            scheduleType: values.scheduleType || "manual",
            intervalMs: values.scheduleType === "interval" && values.intervalSeconds ? Number(values.intervalSeconds) * 1000 : undefined,
            runTime: ["daily", "weekly", "monthly"].includes(String(values.scheduleType)) ? values.runTime : undefined,
            weekDays: values.scheduleType === "weekly" ? values.weekDays : undefined,
            monthDay: values.scheduleType === "monthly" ? values.monthDay : undefined,
            timezone: values.timezone || "Asia/Shanghai",
          }
          : { scheduleType: "manual", timezone: "Asia/Shanghai" },
        status: values.status as QualityTaskPayload["status"],
        ownerName: user?.displayName || user?.username || "system",
      };

      setSubmitting(true);
      if (editingTask) {
        await updateQualityTask(token, editingTask.id, payload);
        message.success("质量任务已更新");
      } else {
        await createQualityTask(token, payload);
        message.success("质量任务已创建");
      }
      setTaskModalOpen(false);
      setIncrementalConfigOpen(false);
      setEditingTask(null);
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || "保存质量任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function buildPayloadFromForm() {
    const values = await form.validateFields();
    const fetchConfig = buildIncrementalFetchConfig(values);

    return {
      taskName: values.taskName || "",
      taskCode: values.taskCode || "",
      strategyVersionId: Number(values.strategyVersionId),
      fetchMode: values.fetchMode || "full",
      fetchConfig,
      scheduleEnabled,
      scheduleConfig: scheduleEnabled
        ? {
          scheduleType: values.scheduleType || "manual",
          intervalMs: values.scheduleType === "interval" && values.intervalSeconds ? Number(values.intervalSeconds) * 1000 : undefined,
          runTime: ["daily", "weekly", "monthly"].includes(String(values.scheduleType)) ? values.runTime : undefined,
          weekDays: values.scheduleType === "weekly" ? values.weekDays : undefined,
          monthDay: values.scheduleType === "monthly" ? values.monthDay : undefined,
          timezone: values.timezone || "Asia/Shanghai",
        }
        : { scheduleType: "manual", timezone: "Asia/Shanghai" },
      status: values.status as QualityTaskPayload["status"],
      ownerName: user?.displayName || user?.username || "system",
    } as QualityTaskPayload;
  }

  async function handlePreviewSql() {
    if (!token) return;
    try {
      const payload = await buildPayloadFromForm();
      setSqlPreviewLoading(true);
      const response = editingTask
        ? await previewExistingQualityTaskSql(token, editingTask.id, payload)
        : await previewQualityTaskSql(token, payload);
      setSqlPreview(response.data);
      setSqlPreviewOpen(true);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || "生成任务 SQL 预览失败");
    } finally {
      setSqlPreviewLoading(false);
    }
  }

  async function handleRunNow(id: number) {
    if (!token) return;
    await runQualityTaskNow(token, id);
    message.success("任务已开始执行");
    await loadData();
    if (expandedTaskKeys.includes(id)) {
      await loadTaskRuns(id, true);
    }
  }

  async function handleStart(id: number) {
    if (!token) return;
    const task = tasks.find((item) => item.id === id) || null;
    if (!task || !task.scheduleConfig || !task.scheduleConfig.scheduleType || task.scheduleConfig.scheduleType === "manual") {
      message.warning("当前任务未配置调度，无法启用。请先编辑任务并设置调度策略。");
      return;
    }
    await startQualityTask(token, id);
    message.success("任务已启动调度");
    await loadData();
  }

  async function handleStop(id: number) {
    if (!token) return;
    await stopQualityTask(token, id);
    message.success("任务已停止调度");
    await loadData();
  }

  async function handleDelete(id: number) {
    if (!token) return;
    await deleteQualityTask(token, id);
    message.success("任务已删除");
    setExpandedTaskKeys((current) => current.filter((item) => item !== id));
    setTaskRunsMap((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    await loadData();
  }

  function openRunDetail(run: QualityTaskRunRecord) {
    setSelectedRun(run);
    setRunDetailOpen(true);
  }

  async function toggleTaskRuns(taskId: number) {
    const isExpanded = expandedTaskKeys.includes(taskId);
    if (isExpanded) {
      setExpandedTaskKeys((current) => current.filter((id) => id !== taskId));
      return;
    }

    setExpandedTaskKeys((current) => [...current, taskId]);
    await loadTaskRuns(taskId);
  }

  const strategySelectOptions = useMemo(
    () => {
      const options: StrategySelectOption[] = strategyOptions
        .filter((item) => editingTask || !onlyUnassignedStrategies || !item.hasTask)
        .map((item) => ({
          value: item.strategyVersionId,
          label: buildStrategyVersionLabel(item),
          hasTask: Boolean(item.hasTask),
        }));
      if (editingTask && !options.some((item) => item.value === editingTask.strategyVersionId)) {
        options.unshift({
          value: editingTask.strategyVersionId,
          label: `${editingTask.sourceName || "-"} / ${editingTask.tableComment || editingTask.tableName} / ${editingTask.tableName} / 当前V${editingTask.taskVersionNo || "-"} / 最新V${editingTask.latestVersionNo || editingTask.taskVersionNo || "-"}`,
          hasTask: true,
        });
      }
      return options;
    },
    [editingTask, onlyUnassignedStrategies, strategyOptions]
  );

  const selectedStrategyOption = useMemo(
    () => strategyOptions.find((item) => item.strategyVersionId === Number(strategyVersionId)) || null,
    [strategyOptions, strategyVersionId],
  );

  const incrementalSummary = useMemo(() => {
    if (fetchMode !== "incremental") return "";
    const parts = [];
    if (incrementalColumn) {
      parts.push(`增量字段：${incrementalColumn}`);
    }
    if (incrementalMode === "time_window") {
      const startSummary = startValueMode === "dynamic_time"
        ? `${getTaskTimeAnchorLabel(startValueAnchor)} ${startValueOffsetValue ?? 0}${startValueOffsetUnit || "day"} / ${startValueFormatType || "datetime"}`
        : (startValue || "未设置");
      const endSummary = endValueMode === "dynamic_time"
        ? `${getTaskTimeAnchorLabel(endValueAnchor)} ${endValueOffsetValue ?? 0}${endValueOffsetUnit || "day"} / ${endValueFormatType || "datetime"}`
        : (endValue || "未设置");
      parts.push(`时间窗口：>= ${startSummary}，< ${endSummary}`);
    } else {
      if (startValueMode === "literal" && startValue) {
        parts.push(`固定起始值：${startValue}`);
      }
      if (startValueMode === "dynamic_time") {
        parts.push(
          `动态起点：${getTaskTimeAnchorLabel(startValueAnchor)} ${startValueOffsetValue ?? 0}${startValueOffsetUnit || "day"} / ${startValueFormatType || "datetime"}`
        );
      }
    }
    return parts.length ? parts.join("，") : "尚未配置增量参数";
  }, [
    endValue,
    endValueAnchor,
    endValueFormatType,
    endValueMode,
    endValueOffsetUnit,
    endValueOffsetValue,
    fetchMode,
    incrementalColumn,
    incrementalMode,
    startValue,
    startValueAnchor,
    startValueFormatType,
    startValueMode,
    startValueOffsetUnit,
    startValueOffsetValue,
  ]);

  const taskColumns: ColumnsType<QualityTaskRecord> = [
    {
      title: "任务",
      key: "taskName",
      width: 340,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.tableComment ? `${record.tableComment}-质量巡检` : record.taskName}</Typography.Text>
          <Typography.Text type="secondary">{record.taskCode}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "数据源 / 数据表",
      key: "sourceTable",
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.sourceName || "-"}</Typography.Text>
          <Typography.Text type="secondary">{record.tableName}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "策略版本",
      key: "strategyVersion",
      width: 200,
      render: (_value, record) => {
        const hasNewVersion = Number(record.latestVersionNo || 0) > Number(record.taskVersionNo || 0);
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "center" }}>
            <div>
              <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>当前</Typography.Text>
              <Typography.Text>{`V${record.taskVersionNo || "-"}`}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>最新</Typography.Text>
              <Typography.Text>{`V${record.latestVersionNo || record.taskVersionNo || "-"}`}</Typography.Text>
            </div>
            <div style={{ gridColumn: "1 / span 2" }}>
              {hasNewVersion ? <Tag color="orange" style={{ marginInlineEnd: 0 }}>有新版本</Tag> : <Tag color="success" style={{ marginInlineEnd: 0 }}>已最新</Tag>}
            </div>
          </div>
        );
      },
    },
    { title: "取数模式", dataIndex: "fetchMode", key: "fetchMode", width: 90, render: (value) => formatTaskFetchMode(value) },
    {
      title: "调度",
      key: "schedule",
      width: 110,
      render: (_value, record) => (
        <StatusTag label={formatTaskSchedule(record)} tone={record.scheduleEnabled ? "processing" : "default"} />
      ),
    },
    { title: "状态", dataIndex: "status", key: "status", width: 90, render: (value) => <StatusTag status={value} /> },
    { title: "最近执行", dataIndex: "lastRunTime", key: "lastRunTime", width: 170, render: (value) => formatTaskDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 300,
      render: (_value, record) => (
        <Space size={2} style={{ width: "100%", whiteSpace: "nowrap", flexWrap: "nowrap" }}>
            <Button type="link" onClick={() => void openEditModal(record)}>编辑</Button>
            <Button type="link" onClick={() => void toggleTaskRuns(record.id)}>
              {expandedTaskKeys.includes(record.id) ? "收起记录" : "运行记录"}
            </Button>
            <Button type="link" icon={<PlayCircleOutlined />} onClick={() => void handleRunNow(record.id)}>执行</Button>
            {record.scheduleEnabled ? (
              <Button type="link" icon={<StopOutlined />} onClick={() => void handleStop(record.id)}>停止</Button>
            ) : (
              <Button type="link" icon={<PlayCircleOutlined />} onClick={() => void handleStart(record.id)}>启动</Button>
            )}
            <Popconfirm title="确认删除该任务？" onConfirm={() => void handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
        </Space>
      ),
    },
  ];

  const runColumns: ColumnsType<QualityTaskRunRecord> = [
    { title: "运行状态", dataIndex: "runStatus", key: "runStatus", width: 120, render: (value) => <StatusTag status={value} label={formatTaskRunStatus(value)} /> },
    { title: "批次号", dataIndex: "batchId", key: "batchId", width: 260, render: (value) => formatQualityBatchId(value) },
    { title: "问题数", dataIndex: "issueCount", key: "issueCount", width: 120 },
    { title: "统计数", dataIndex: "statsCount", key: "statsCount", width: 120 },
    { title: "开始时间", dataIndex: "startTime", key: "startTime", width: 180, render: (value) => formatTaskDateTime(value) },
    { title: "结束时间", dataIndex: "endTime", key: "endTime", width: 180, render: (value) => formatTaskDateTime(value) },
    { title: "错误信息", dataIndex: "errorMessage", key: "errorMessage", render: (value) => value || "-" },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_value, record) => (
        <Space>
          <Button type="link" onClick={() => openRunDetail(record)}>详情</Button>
          {record.runStatus === "failed" ? (
            <Button type="link" onClick={() => void handleRunNow(record.taskId)}>失败重跑</Button>
          ) : null}
        </Space>
      ),
    },
  ];

  function renderTaskRuns(record: QualityTaskRecord) {
    const runs = taskRunsMap[record.id] || [];
    const loadingRuns = Boolean(taskRunsLoadingMap[record.id]);

    return (
      <Card
        size="small"
        title={`${record.taskName} / 运行记录`}
        extra={(
          <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadTaskRuns(record.id, true)} loading={loadingRuns}>
            刷新记录
          </Button>
        )}
      >
        <Table<QualityTaskRunRecord>
          rowKey="id"
          size="small"
          columns={runColumns}
          dataSource={runs}
          loading={loadingRuns}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          locale={{ emptyText: "当前任务暂无运行记录" }}
        />
      </Card>
    );
  }

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Select allowClear style={{ width: 220 }} placeholder="按数据源过滤" value={sourceFilter} options={sources} onChange={(value) => setSourceFilter(value)} />
            <Input.Search allowClear className="toolbar-search" placeholder="搜索任务名称、编码或数据表" value={keyword} onChange={(event) => setKeyword(event.target.value)} onSearch={() => void loadData()} />
          </>
        )}
        right={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建任务</Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        <Card variant="borderless">
          <Table<QualityTaskRecord>
            rowKey="id"
            loading={loading}
            columns={taskColumns}
            dataSource={tasks}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            expandable={{
              expandedRowKeys: expandedTaskKeys,
              expandedRowRender: renderTaskRuns,
              showExpandColumn: false,
              onExpandedRowsChange: (keys) => setExpandedTaskKeys(keys.map((item) => Number(item))),
            }}
          />
        </Card>
      </div>

      <Modal
        open={taskModalOpen}
        title={editingTask ? "编辑质量任务" : "新建质量任务"}
        onCancel={() => setTaskModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={920}
        destroyOnHidden
        footer={[
          <Button key="preview" icon={<EyeOutlined />} onClick={() => void handlePreviewSql()} loading={sqlPreviewLoading}>预览 SQL</Button>,
          <Button key="cancel" onClick={() => setTaskModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={() => void handleSubmit()} loading={submitting}>保存</Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="strategyVersionId"
                label={(
                  <Space size={16}>
                    <span>已提交策略</span>
                    {!editingTask ? (
                      <Checkbox
                        checked={onlyUnassignedStrategies}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setOnlyUnassignedStrategies(checked);
                          const selectedOption = strategyOptions.find((item) => item.strategyVersionId === Number(form.getFieldValue("strategyVersionId")));
                          if (checked && selectedOption?.hasTask) {
                            form.setFieldValue("strategyVersionId", undefined);
                            setStrategyFields([]);
                          }
                        }}
                      >
                        仅查看未添加任务的策略
                      </Checkbox>
                    ) : null}
                  </Space>
                )}
                rules={[{ required: true, message: "请选择已提交策略" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={strategySelectOptions}
                  placeholder="选择已提交策略生成任务"
                  notFoundContent={onlyUnassignedStrategies ? "暂无未添加任务的策略" : "暂无已提交策略"}
                  optionRender={(option) => {
                    const item = option.data as StrategySelectOption;
                    return (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                        <Tag color={item.hasTask ? "orange" : "green"} style={{ flex: "none", marginInlineEnd: 0 }}>
                          {item.hasTask ? "已添加任务" : "未添加任务"}
                        </Tag>
                      </div>
                    );
                  }}
                />
              </Form.Item>
              {selectedStrategyOption ? (
                <Space size={8} style={{ marginTop: -8, marginBottom: 12 }}>
                  <Tag color={selectedStrategyOption.hasTask ? "orange" : "green"}>
                    {selectedStrategyOption.hasTask ? "已添加任务" : "未添加任务"}
                  </Tag>
                  <Tag color="blue">{`当前版本 V${selectedStrategyOption.currentVersionNo}`}</Tag>
                  <Tag color={selectedStrategyOption.latestVersionNo && selectedStrategyOption.latestVersionNo !== selectedStrategyOption.currentVersionNo ? "orange" : "success"}>
                    {selectedStrategyOption.latestVersionNo && selectedStrategyOption.latestVersionNo !== selectedStrategyOption.currentVersionNo
                      ? `最新版本 V${selectedStrategyOption.latestVersionNo}`
                      : "已是最新版本"}
                  </Tag>
                </Space>
              ) : null}
            </Col>
            <Col span={12}>
              <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taskCode" label="任务编码" rules={[{ required: true, message: "请输入任务编码" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" style={{ marginBottom: 16 }} title="任务基础配置">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="fetchMode" label="取数模式" rules={[{ required: true, message: "请选择取数模式" }]}>
                  <Select
                    options={[
                      { value: "full", label: "全量取数" },
                      { value: "incremental", label: "增量取数" },
                      { value: "sample", label: "抽样取数" },
                    ]}
                    onChange={(value: TaskFormValues["fetchMode"]) => {
                      if (value !== "incremental") {
                        clearIncrementalFields();
                        setIncrementalConfigOpen(false);
                      }
                      if (value !== "sample") {
                        form.setFieldValue("sampleSize", undefined);
                      }
                      if (value === "incremental") {
                        setTimeout(() => setIncrementalConfigOpen(true), 0);
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="status" label="状态">
                  <Select
                    options={[
                      { value: "draft", label: "草稿" },
                      { value: "active", label: "启用" },
                      { value: "paused", label: "暂停" },
                      { value: "stopped", label: "停用" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="scheduleEnabled" label="执行方式">
                  <Select
                    options={[
                      { value: false, label: "仅手动执行" },
                      { value: true, label: "启用调度" },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {fetchMode === "incremental" ? (
            <Card
              size="small"
              style={{ marginBottom: 16 }}
              title="增量参数"
              extra={
                <Button type="link" onClick={() => setIncrementalConfigOpen(true)}>
                  配置参数
                </Button>
              }
            >
              <Typography.Text type="secondary">{incrementalSummary}</Typography.Text>
            </Card>
          ) : null}

          {fetchMode === "sample" ? (
            <Card size="small" style={{ marginBottom: 16 }} title="抽样配置">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="sampleSize" label="抽样条数" rules={[{ required: true, message: "请输入抽样条数" }]}>
                    <InputNumber min={1} max={100000} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ) : null}

          {scheduleEnabled ? (
            <Card size="small" title="调度配置">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="scheduleType" label="调度方式">
                    <Select
                      options={[
                        { value: "manual", label: "手动执行" },
                        { value: "daily", label: "每天执行" },
                        { value: "weekly", label: "每周执行" },
                        { value: "monthly", label: "每月执行" },
                        { value: "interval", label: "固定间隔" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  {scheduleType === "interval" ? (
                    <Form.Item
                      name="intervalSeconds"
                      label="间隔秒数"
                      rules={[{ required: true, message: "请输入间隔秒数" }]}
                    >
                      <InputNumber min={1} style={{ width: "100%" }} />
                    </Form.Item>
                  ) : null}
                  {["daily", "weekly", "monthly"].includes(scheduleType) ? (
                    <Form.Item
                      name="runTime"
                      label="执行时间"
                      rules={[{ required: true, message: "请输入执行时间" }]}
                    >
                      <Input type="time" />
                    </Form.Item>
                  ) : null}
                </Col>
                <Col span={8}>
                  {scheduleType === "weekly" ? (
                    <Form.Item
                      name="weekDays"
                      label="每周执行日"
                      rules={[{ required: true, message: "请选择执行日" }]}
                    >
                      <Select
                        mode="multiple"
                        options={[
                          { value: 1, label: "周一" },
                          { value: 2, label: "周二" },
                          { value: 3, label: "周三" },
                          { value: 4, label: "周四" },
                          { value: 5, label: "周五" },
                          { value: 6, label: "周六" },
                          { value: 0, label: "周日" },
                        ]}
                      />
                    </Form.Item>
                  ) : null}
                  {scheduleType === "monthly" ? (
                    <Form.Item
                      name="monthDay"
                      label="每月执行日"
                      rules={[{ required: true, message: "请输入执行日" }]}
                    >
                      <InputNumber min={1} max={31} style={{ width: "100%" }} />
                    </Form.Item>
                  ) : null}
                </Col>
                <Col span={24}>
                  <Form.Item name="timezone" label="时区">
                    <Input placeholder="Asia/Shanghai" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ) : null}
        </Form>
      </Modal>

      <Modal
        open={incrementalConfigOpen}
        title="增量参数配置"
        onCancel={() => setIncrementalConfigOpen(false)}
        footer={(
          <Space>
            <Button onClick={() => setIncrementalConfigOpen(false)}>关闭</Button>
            <Button type="primary" onClick={() => setIncrementalConfigOpen(false)}>确认</Button>
          </Space>
        )}
        width={820}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="incrementalColumn"
                label="增量字段"
                rules={fetchMode === "incremental" ? [{ required: true, message: "请选择增量字段" }] : undefined}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={strategyFields.map((item) => ({
                    value: item.columnName,
                    label: item.columnComment ? `${item.columnName} (${item.columnComment})` : item.columnName,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="incrementalMode"
                label="增量方式"
                rules={fetchMode === "incremental" ? [{ required: true, message: "请选择起始参数模式" }] : undefined}
              >
                <Select options={TASK_INCREMENTAL_MODE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              {incrementalMode === "time_window" ? (
                <Form.Item label="快捷配置">
                  <Button block onClick={applyYesterdayWindowPreset}>套用昨天全天</Button>
                </Form.Item>
              ) : null}
            </Col>
          </Row>

          {incrementalMode === "cursor" ? (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="startValueMode"
                    label="起始参数模式"
                    rules={fetchMode === "incremental" ? [{ required: true, message: "请选择起始参数模式" }] : undefined}
                  >
                    <Select
                      options={[
                        { value: "literal", label: "固定值" },
                        { value: "dynamic_time", label: "动态时间" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {startValueMode === "literal" ? (
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="startValue" label="起始值">
                      <Input placeholder="例如：2026-01-01 00:00:00 或 0" />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item name="startValueAnchor" label="动态基准">
                        <Select options={TASK_TIME_ANCHOR_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="startValueFormatType" label="时间格式">
                        <Select
                          options={TASK_TIME_FORMAT_OPTIONS.map((item) => ({
                            value: item.value,
                            label: item.label,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="startValueOffsetValue" label="偏移量">
                        <InputNumber style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="startValueOffsetUnit" label="偏移单位">
                        <Select options={TASK_TIME_OFFSET_UNIT_OPTIONS} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Typography.Text type="secondary">
                    当前会按 {getTaskTimeAnchorLabel(startValueAnchor)} + {startValueOffsetValue ?? 0}{startValueOffsetUnit || "day"}，
                    输出 {getTaskTimePlaceholder(form.getFieldValue("startValueFormatType"))} 格式的动态起始值。
                  </Typography.Text>
                </>
              )}
            </>
          ) : (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="开始时间" styles={{ body: { paddingBottom: 12 } }}>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item
                          name="startValueMode"
                          label="开始参数模式"
                          rules={fetchMode === "incremental" ? [{ required: true, message: "请选择开始参数模式" }] : undefined}
                        >
                          <Select
                            options={[
                              { value: "literal", label: "固定值" },
                              { value: "dynamic_time", label: "动态时间" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      {startValueMode === "dynamic_time" ? (
                        <>
                          <Col span={12}>
                            <Form.Item name="startValueAnchor" label="动态基准">
                              <Select options={TASK_TIME_ANCHOR_OPTIONS} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="startValueFormatType" label="时间格式">
                              <Select
                                options={TASK_TIME_FORMAT_OPTIONS.map((item) => ({
                                  value: item.value,
                                  label: item.label,
                                }))}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="startValueOffsetValue" label="偏移量">
                              <InputNumber style={{ width: "100%" }} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="startValueOffsetUnit" label="偏移单位">
                              <Select options={TASK_TIME_OFFSET_UNIT_OPTIONS} />
                            </Form.Item>
                          </Col>
                        </>
                      ) : (
                        <Col span={24}>
                          <Form.Item name="startValue" label="开始值">
                            <Input placeholder="例如：2026-04-20 00:00:00" />
                          </Form.Item>
                        </Col>
                      )}
                    </Row>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="结束时间" styles={{ body: { paddingBottom: 12 } }}>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item
                          name="endValueMode"
                          label="结束参数模式"
                          rules={fetchMode === "incremental" ? [{ required: true, message: "请选择结束参数模式" }] : undefined}
                        >
                          <Select
                            options={[
                              { value: "literal", label: "固定值" },
                              { value: "dynamic_time", label: "动态时间" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      {endValueMode === "dynamic_time" ? (
                        <>
                          <Col span={12}>
                            <Form.Item name="endValueAnchor" label="动态基准">
                              <Select options={TASK_TIME_ANCHOR_OPTIONS} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="endValueFormatType" label="时间格式">
                              <Select
                                options={TASK_TIME_FORMAT_OPTIONS.map((item) => ({
                                  value: item.value,
                                  label: item.label,
                                }))}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="endValueOffsetValue" label="偏移量">
                              <InputNumber style={{ width: "100%" }} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="endValueOffsetUnit" label="偏移单位">
                              <Select options={TASK_TIME_OFFSET_UNIT_OPTIONS} />
                            </Form.Item>
                          </Col>
                        </>
                      ) : (
                        <Col span={24}>
                          <Form.Item name="endValue" label="结束值">
                            <Input placeholder="例如：2026-04-21 00:00:00" />
                          </Form.Item>
                        </Col>
                      )}
                    </Row>
                  </Card>
                </Col>
              </Row>
              <Typography.Text type="secondary">
                时间窗口按大于等于开始时间、且小于结束时间生成 SQL。
                “昨天全天”建议设置为：开始=当天开始 -1 天，结束=当天开始 +0 天。
              </Typography.Text>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        open={sqlPreviewOpen}
        title="任务 SQL 预览"
        onCancel={() => setSqlPreviewOpen(false)}
        footer={<Button type="primary" onClick={() => setSqlPreviewOpen(false)}>关闭</Button>}
        width={1100}
      >
        {sqlPreview?.resolvedParameters ? (
          <Card size="small" style={{ marginBottom: 12 }} title="已解析参数">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>
              {JSON.stringify(sqlPreview.resolvedParameters, null, 2)}
            </pre>
          </Card>
        ) : null}
        <Card size="small" style={{ marginBottom: 12 }} title="取数 SQL">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{sqlPreview?.sourceFilterSql || "-"}</pre>
        </Card>
        <Card size="small" title="质量检测 SQL">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 520, overflow: "auto" }}>{sqlPreview?.sqlContent || "-"}</pre>
        </Card>
      </Modal>

      <Modal
        open={runDetailOpen}
        title="运行详情"
        onCancel={() => setRunDetailOpen(false)}
        footer={<Button type="primary" onClick={() => setRunDetailOpen(false)}>关闭</Button>}
        width={1080}
      >
        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 16 }}>
          <Card size="small" title="运行摘要">
            <Space direction="vertical" size={8} style={{ display: "flex" }}>
              <Typography.Text>状态：{formatTaskRunStatus(selectedRun?.runStatus)}</Typography.Text>
              <Typography.Text>批次号：{formatQualityBatchId(selectedRun?.batchId)}</Typography.Text>
              <Typography.Text>问题数：{selectedRun?.issueCount || 0}</Typography.Text>
              <Typography.Text>统计数：{selectedRun?.statsCount || 0}</Typography.Text>
              <Typography.Text>开始时间：{formatTaskDateTime(selectedRun?.startTime)}</Typography.Text>
              <Typography.Text>结束时间：{formatTaskDateTime(selectedRun?.endTime)}</Typography.Text>
              <Typography.Text>错误信息：{selectedRun?.errorMessage || "-"}</Typography.Text>
            </Space>
          </Card>
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Card size="small" title="执行过程">
              {Array.isArray((selectedRun?.executionInfo as any)?.steps) && (selectedRun?.executionInfo as any).steps.length > 0 ? (
                <Space direction="vertical" size={10} style={{ display: "flex" }}>
                  {(selectedRun?.executionInfo as any).steps.map((item: any, index: number) => (
                    <div key={`${item.step || "step"}_${index}`} style={{ paddingBottom: 10, borderBottom: index === (selectedRun?.executionInfo as any).steps.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                      <Typography.Text strong>{item.step || `step_${index + 1}`}</Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 2 }}>{formatTaskDateTime(item.at)}</Typography.Text>
                      <Typography.Text style={{ display: "block", marginTop: 4 }}>{item.detail || "-"}</Typography.Text>
                    </div>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">当前暂无结构化执行步骤</Typography.Text>
              )}
            </Card>
            <Card size="small" title="执行明细">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>
                {JSON.stringify(selectedRun?.executionInfo || {}, null, 2)}
              </pre>
            </Card>
          </Space>
        </div>
      </Modal>
    </div>
  );
}

