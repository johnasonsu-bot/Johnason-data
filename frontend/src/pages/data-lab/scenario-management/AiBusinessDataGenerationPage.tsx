import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SettingOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { DataTableCard } from "../../../components/ui/DataTableCard";
import { PageToolbar } from "../../../components/ui/PageToolbar";
import { StatCard } from "../../../components/ui/StatCard";
import {
  fetchAiBusinessDataBatches,
  fetchAiBusinessDataPlans,
  fetchAiBusinessDataTasks,
  fetchBusinessSystemInstancePhysicalVersions,
  fetchBusinessSystemInstances,
  fetchLabDataSources,
  generateAiBusinessDataBatch,
  generateAiBusinessDataPlan,
  loadAiBusinessDataBatch,
  deleteAiBusinessDataTask,
  runAiBusinessDataTask,
  saveAiBusinessDataTask,
  updateAiBusinessDataTaskSchedule,
  type LabAiBusinessDataBatchGeneratePayload,
  type LabAiBusinessDataBatchLoadPayload,
  type LabAiBusinessDataPlanGeneratePayload,
  type LabAiBusinessDataTaskSavePayload,
} from "../../../services/dataLab";
import type {
  DataSourceRecord,
  LabAiBusinessDataBatchRecord,
  LabAiBusinessDataPlanRecord,
  LabAiBusinessDataTaskRecord,
  LabBusinessSystemInstanceRecord,
  LabBusinessSystemPhysicalModelVersionRecord,
} from "../../../types/api";
import { formatDateTime } from "./scenarioManagementShared";

type GenerationFormValues = {
  taskId?: number;
  taskName?: string;
  instanceId?: number;
  physicalVersionNo?: number;
  targetDataSourceId?: number;
  generationMode?: "initial" | "incremental";
  totalRows?: number;
  batchRows?: number;
  timelineStartAt?: string;
  timelineDays?: number;
  requirementText?: string;
  scheduleEnabled?: boolean;
  scheduleType?: "manual" | "hourly" | "daily" | "weekly" | "cron";
  cronExpr?: string;
  autoLoad?: boolean;
  loadMode?: "append" | "replace";
};

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function renderGeneratorMode(mode?: string) {
  if (mode === "ai") return <Tag color="blue">AI</Tag>;
  if (mode === "fallback") return <Tag color="orange">兜底</Tag>;
  return <Tag>{mode || "-"}</Tag>;
}

function renderBatchStatus(status?: string) {
  if (status === "loaded") return <Tag color="green">已落库</Tag>;
  if (status === "previewed") return <Tag color="processing">待审核</Tag>;
  return <Tag>{status || "-"}</Tag>;
}

function renderTaskStatus(status?: string, enabled?: boolean) {
  if (enabled && status === "running") return <Tag color="green">已启用</Tag>;
  if (status === "running") return <Tag color="processing">运行中</Tag>;
  return <Tag>已停用</Tag>;
}

function renderRunStatus(status?: string | null) {
  if (status === "success") return <Tag color="green">成功</Tag>;
  if (status === "failed") return <Tag color="red">失败</Tag>;
  if (status === "running") return <Tag color="processing">执行中</Tag>;
  return <Tag>未执行</Tag>;
}

function formatSchedule(record: Pick<LabAiBusinessDataTaskRecord, "scheduleEnabled" | "scheduleType" | "cronExpr">) {
  if (record.scheduleType === "manual") return "手动";
  const label = record.scheduleType === "hourly"
    ? "每小时"
    : record.scheduleType === "daily"
      ? "每天 02:00"
      : record.scheduleType === "weekly"
        ? "每周一 02:00"
        : record.cronExpr || "Cron";
  return record.scheduleEnabled ? label : `${label}（停用）`;
}

function renderIssueLevel(level?: string) {
  if (level === "error") return <Tag color="red">错误</Tag>;
  if (level === "warning") return <Tag color="orange">警告</Tag>;
  return <Tag>{level || "info"}</Tag>;
}

function stringifyCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderPreviewName(name: string, comment?: string | null, options: { width?: number; count?: number } = {}) {
  const width = options.width || 150;
  return (
    <div style={{ maxWidth: width, minWidth: 0 }} title={comment ? `${name}\n${comment}` : name}>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "18px" }}>
        {options.count === undefined ? name : `${name} (${options.count})`}
      </div>
      {comment ? (
        <div
          style={{
            color: "#8c8c8c",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: "16px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {comment}
        </div>
      ) : null}
    </div>
  );
}

export function AiBusinessDataGenerationPage() {
  const { token } = useAuth();
  const { message } = AntdApp.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm<GenerationFormValues>();
  const selectedInstanceId = Form.useWatch("instanceId", form);
  const selectedScheduleType = Form.useWatch("scheduleType", form);

  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [loadLoading, setLoadLoading] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskRunningId, setTaskRunningId] = useState<number | null>(null);
  const [instances, setInstances] = useState<LabBusinessSystemInstanceRecord[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceRecord[]>([]);
  const [physicalVersions, setPhysicalVersions] = useState<LabBusinessSystemPhysicalModelVersionRecord[]>([]);
  const [plans, setPlans] = useState<LabAiBusinessDataPlanRecord[]>([]);
  const [batches, setBatches] = useState<LabAiBusinessDataBatchRecord[]>([]);
  const [tasks, setTasks] = useState<LabAiBusinessDataTaskRecord[]>([]);
  const [activeTask, setActiveTask] = useState<LabAiBusinessDataTaskRecord | null>(null);
  const [activePlan, setActivePlan] = useState<LabAiBusinessDataPlanRecord | null>(null);
  const [activeBatch, setActiveBatch] = useState<LabAiBusinessDataBatchRecord | null>(null);
  const taskIdParam = Number(searchParams.get("taskId") || 0);
  const isTaskDetailMode = searchParams.get("mode") === "new" || taskIdParam > 0;

  const selectedInstance = useMemo(
    () => instances.find((item) => item.id === Number(selectedInstanceId || 0)) || null,
    [instances, selectedInstanceId]
  );

  const instanceOptions = useMemo(
    () => instances.map((item) => ({
      value: item.id,
      label: `${item.instanceName} / ${item.templateName}`,
      disabled: !item.currentPhysicalVersion,
    })),
    [instances]
  );

  const dataSourceOptions = useMemo(
    () => dataSources
      .filter((item) => ["mysql", "postgresql", "postgres", "jdbc"].includes(String(item.sourceType || "").toLowerCase()))
      .map((item) => ({ value: item.id, label: `${item.sourceName} (${item.sourceType})` })),
    [dataSources]
  );

  const physicalVersionOptions = useMemo(
    () => physicalVersions.map((item) => ({
      value: item.versionNo,
      label: `V${item.versionNo} / ${item.dbType} / ${item.versionStatus}`,
    })),
    [physicalVersions]
  );

  async function loadTaskList() {
    if (!token) return;
    const taskResponse = await fetchAiBusinessDataTasks(token);
    setTasks(taskResponse.data);
    if (activeTask) {
      setActiveTask(taskResponse.data.find((item) => item.id === activeTask.id) || null);
    }
  }

  const kpis = useMemo(() => {
    const generatedRows = asNumber(activeBatch?.validation?.rowCount);
    const errorCount = asNumber(activeBatch?.validation?.errorCount);
    const enabledTaskCount = tasks.filter((item) => item.scheduleEnabled).length;
    return [
      { title: "物理模型实例", value: instances.length, icon: <DatabaseOutlined />, description: "可用于 AI 造数的已建模实例" },
      { title: "任务清单", value: tasks.length, icon: <SyncOutlined />, description: `${enabledTaskCount} 个任务已启用定时循环` },
      { title: "预览批次", value: batches.length, icon: <ApiOutlined />, description: "当前实例最近生成的数据批次" },
      { title: "本批数据", value: generatedRows, suffix: "行", icon: <CheckCircleOutlined />, description: errorCount > 0 ? `${errorCount} 个阻断问题` : "校验通过后可落库" },
    ];
  }, [activeBatch, batches.length, instances.length, tasks]);

  async function loadBaseData() {
    if (!token) return;
    setLoading(true);
    try {
      const [instanceResponse, dataSourceResponse, taskResponse] = await Promise.all([
        fetchBusinessSystemInstances(token),
        fetchLabDataSources(token, { includeConnectivity: false }),
        fetchAiBusinessDataTasks(token),
      ]);
      setInstances(instanceResponse.data);
      setDataSources(dataSourceResponse.data);
      setTasks(taskResponse.data);
      const firstDeployed = instanceResponse.data.find((item) => item.currentPhysicalVersion);
      if (firstDeployed && !form.getFieldValue("instanceId")) {
        form.setFieldsValue({
          taskName: `${firstDeployed.instanceName} V${firstDeployed.currentPhysicalVersion} 增量造数`,
          instanceId: firstDeployed.id,
          physicalVersionNo: firstDeployed.currentPhysicalVersion || undefined,
          targetDataSourceId: asNumber(firstDeployed.deployTarget?.targetDataSourceId) || undefined,
          generationMode: "incremental",
          totalRows: 300,
          batchRows: 80,
          timelineStartAt: "2025-01-01",
          timelineDays: 90,
          scheduleEnabled: false,
          scheduleType: "manual",
          autoLoad: false,
          loadMode: "append",
        });
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 AI 业务数据页面失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadInstanceData(instanceId: number) {
    if (!token || !instanceId) return;
    setLoading(true);
    try {
      const [versionResponse, planResponse, batchResponse] = await Promise.all([
        fetchBusinessSystemInstancePhysicalVersions(token, instanceId),
        fetchAiBusinessDataPlans(token, instanceId),
        fetchAiBusinessDataBatches(token, instanceId),
      ]);
      setPhysicalVersions(versionResponse.data);
      setPlans(planResponse.data);
      setBatches(batchResponse.data);
      setActivePlan(planResponse.data[0] || null);
      setActiveBatch(null);
      const instance = instances.find((item) => item.id === instanceId);
      form.setFieldsValue({
        physicalVersionNo: instance?.currentPhysicalVersion || versionResponse.data[0]?.versionNo,
        targetDataSourceId: asNumber(instance?.deployTarget?.targetDataSourceId) || form.getFieldValue("targetDataSourceId"),
        taskName: activeTask?.instanceId === instanceId
          ? form.getFieldValue("taskName")
          : `${instance?.instanceName || "业务模型"} V${instance?.currentPhysicalVersion || versionResponse.data[0]?.versionNo || "-"} 增量造数`,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载实例 AI 业务数据记录失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, [token]);

  useEffect(() => {
    const instanceId = Number(selectedInstanceId || 0);
    if (instanceId) {
      void loadInstanceData(instanceId);
    }
  }, [selectedInstanceId, token]);

  useEffect(() => {
    if (!activeTask?.planId) return;
    const matchedPlan = plans.find((item) => item.id === activeTask.planId);
    if (matchedPlan) {
      setActivePlan(matchedPlan);
    }
  }, [activeTask?.planId, plans]);

  useEffect(() => {
    if (!taskIdParam || tasks.length === 0) return;
    const task = tasks.find((item) => item.id === taskIdParam);
    if (task && activeTask?.id !== task.id) {
      applyTaskToForm(task);
    }
  }, [taskIdParam, tasks]);

  async function handleGeneratePlan() {
    if (!token) return;
    const values = await form.validateFields();
    const instanceId = Number(values.instanceId || 0);
    if (!instanceId) return;
    const payload: LabAiBusinessDataPlanGeneratePayload = {
      physicalVersionNo: values.physicalVersionNo,
      targetDataSourceId: values.targetDataSourceId,
      generationMode: values.generationMode || "initial",
      totalRows: values.totalRows,
      batchRows: values.batchRows,
      timelineStartAt: values.timelineStartAt || null,
      timelineDays: values.timelineDays,
      requirementText: values.requirementText || null,
    };
    setPlanLoading(true);
    try {
      const response = await generateAiBusinessDataPlan(token, instanceId, payload);
      setActivePlan(response.data.plan);
      await loadInstanceData(instanceId);
      message.success("AI 业务数据方案已生成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成 AI 业务数据方案失败");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleGenerateBatch() {
    if (!token) return;
    const values = await form.validateFields();
    const instanceId = Number(values.instanceId || 0);
    if (!instanceId) return;
    const payload: LabAiBusinessDataBatchGeneratePayload = {
      planId: activePlan?.id || null,
      physicalVersionNo: values.physicalVersionNo,
      targetDataSourceId: values.targetDataSourceId,
      generationMode: values.generationMode || "incremental",
      totalRows: values.totalRows,
      batchRows: values.batchRows,
      timelineStartAt: values.timelineStartAt || null,
      timelineDays: values.timelineDays,
      requirementText: values.requirementText || null,
    };
    setBatchLoading(true);
    try {
      const response = await generateAiBusinessDataBatch(token, instanceId, payload);
      setActiveBatch(response.data.batch);
      setBatches((current) => [response.data.batch, ...current.filter((item) => item.id !== response.data.batch.id)]);
      message.success("AI 业务数据预览批次已生成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成 AI 业务数据批次失败");
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleLoadBatch() {
    if (!token || !activeBatch) return;
    const values = form.getFieldsValue();
    const instanceId = Number(values.instanceId || selectedInstanceId || 0);
    if (!instanceId) return;
    const payload: LabAiBusinessDataBatchLoadPayload = {
      targetDataSourceId: values.targetDataSourceId,
      loadMode: values.loadMode || "append",
    };
    setLoadLoading(true);
    try {
      const response = await loadAiBusinessDataBatch(token, instanceId, activeBatch.id, payload);
      message.success(`已落库 ${asNumber(response.data.loadSummary.loadedRowCount)} 行业务数据`);
      setActiveBatch(response.data.batch);
      await loadInstanceData(instanceId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "AI 业务数据落库失败");
    } finally {
      setLoadLoading(false);
    }
  }

  function handleBackToTaskList() {
    setSearchParams({});
    setActiveTask(null);
    setActiveBatch(null);
  }

  function handleCreateTask() {
    const firstDeployed = instances.find((item) => item.currentPhysicalVersion);
    setActiveTask(null);
    setActivePlan(null);
    setActiveBatch(null);
    if (firstDeployed) {
      form.setFieldsValue({
        taskId: undefined,
        taskName: `${firstDeployed.instanceName} V${firstDeployed.currentPhysicalVersion} 增量造数`,
        instanceId: firstDeployed.id,
        physicalVersionNo: firstDeployed.currentPhysicalVersion || undefined,
        targetDataSourceId: asNumber(firstDeployed.deployTarget?.targetDataSourceId) || undefined,
        generationMode: "incremental",
        totalRows: 300,
        batchRows: 80,
        timelineStartAt: "2025-01-01",
        timelineDays: 90,
        requirementText: undefined,
        scheduleEnabled: false,
        scheduleType: "manual",
        cronExpr: undefined,
        autoLoad: false,
        loadMode: "append",
      });
    }
    setSearchParams({ mode: "new" });
  }

  function applyTaskToForm(task: LabAiBusinessDataTaskRecord) {
    setActiveTask(task);
    form.setFieldsValue({
      taskId: task.id,
      taskName: task.taskName,
      instanceId: task.instanceId,
      physicalVersionNo: task.physicalVersionNo,
      targetDataSourceId: task.targetDataSourceId || undefined,
      generationMode: task.generationMode === "initial" ? "initial" : "incremental",
      totalRows: task.totalRows,
      batchRows: task.batchRows,
      timelineStartAt: task.timelineStartAt || undefined,
      timelineDays: task.timelineDays,
      requirementText: task.requirementText || undefined,
      scheduleEnabled: task.scheduleEnabled,
      scheduleType: ["manual", "hourly", "daily", "weekly", "cron"].includes(task.scheduleType) ? task.scheduleType as GenerationFormValues["scheduleType"] : "manual",
      cronExpr: task.cronExpr || undefined,
      autoLoad: task.autoLoad,
      loadMode: task.loadMode === "replace" ? "replace" : "append",
    });
  }

  function openTaskDetail(task: LabAiBusinessDataTaskRecord) {
    applyTaskToForm(task);
    setSearchParams({ taskId: String(task.id) });
  }

  function buildTaskPayload(values: GenerationFormValues): LabAiBusinessDataTaskSavePayload {
    const instanceId = Number(values.instanceId || 0);
    const instance = instances.find((item) => item.id === instanceId);
    return {
      id: activeTask?.id || values.taskId || null,
      taskName: values.taskName || `${instance?.instanceName || "业务模型"} V${values.physicalVersionNo || "-"} 增量造数`,
      instanceId,
      physicalVersionNo: Number(values.physicalVersionNo || 0),
      targetDataSourceId: Number(values.targetDataSourceId || 0),
      planId: activePlan?.instanceId === instanceId ? activePlan.id : activeTask?.planId || null,
      scheduleEnabled: Boolean(values.scheduleEnabled),
      scheduleType: values.scheduleType || "manual",
      cronExpr: values.cronExpr || null,
      generationMode: values.generationMode || "incremental",
      totalRows: values.totalRows,
      batchRows: values.batchRows,
      timelineStartAt: values.timelineStartAt || null,
      timelineDays: values.timelineDays,
      requirementText: values.requirementText || null,
      autoLoad: Boolean(values.autoLoad),
      loadMode: values.loadMode || "append",
    };
  }

  async function handleSaveTask() {
    if (!token) return;
    const values = await form.validateFields();
    setTaskSaving(true);
    try {
      const response = await saveAiBusinessDataTask(token, buildTaskPayload(values));
      setActiveTask(response.data);
      applyTaskToForm(response.data);
      setSearchParams({ taskId: String(response.data.id) });
      await loadTaskList();
      message.success(response.data.scheduleEnabled ? "任务已保存并启用定时循环" : "任务已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存 AI 业务数据任务失败");
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleRunTask(record: LabAiBusinessDataTaskRecord) {
    if (!token) return;
    applyTaskToForm(record);
    setTaskRunningId(record.id);
    try {
      const response = await runAiBusinessDataTask(token, record.id);
      await loadInstanceData(record.instanceId);
      setActiveBatch(response.data.batch);
      setBatches((current) => [response.data.batch, ...current.filter((item) => item.id !== response.data.batch.id)]);
      await loadTaskList();
      message.success(response.data.loadSummary ? "任务已生成批次并自动落库" : "任务已生成预览批次");
    } catch (error) {
      await loadTaskList().catch(() => undefined);
      message.error(error instanceof Error ? error.message : "执行 AI 业务数据任务失败");
    } finally {
      setTaskRunningId(null);
    }
  }

  async function handleToggleTask(record: LabAiBusinessDataTaskRecord, enabled: boolean) {
    if (!token) return;
    try {
      const response = await updateAiBusinessDataTaskSchedule(token, record.id, enabled);
      setTasks((current) => current.map((item) => item.id === response.data.id ? response.data : item));
      if (activeTask?.id === response.data.id) {
        setActiveTask(response.data);
        form.setFieldsValue({ scheduleEnabled: response.data.scheduleEnabled });
      }
      message.success(enabled ? "任务定时已启用" : "任务定时已停用");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新任务定时状态失败");
    }
  }

  async function handleDeleteTask(record: LabAiBusinessDataTaskRecord) {
    if (!token) return;
    try {
      await deleteAiBusinessDataTask(token, record.id);
      setTasks((current) => current.filter((item) => item.id !== record.id));
      if (activeTask?.id === record.id) {
        setActiveTask(null);
        form.setFieldsValue({ taskId: undefined });
      }
      message.success("任务已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除任务失败");
    }
  }

  const planTableColumns: ColumnsType<Record<string, unknown>> = [
    { title: "表", dataIndex: "tableName", width: 180 },
    { title: "物理表", dataIndex: "physicalTableName", width: 180 },
    { title: "目标行数", dataIndex: "targetRows", width: 100 },
    { title: "原因", dataIndex: "reason", ellipsis: true },
  ];

  const issueColumns: ColumnsType<NonNullable<LabAiBusinessDataBatchRecord["validation"]>["issues"][number]> = [
    { title: "级别", dataIndex: "level", width: 90, render: (value: string) => renderIssueLevel(value) },
    { title: "编码", dataIndex: "code", width: 160 },
    { title: "位置", dataIndex: "path", width: 240, ellipsis: true },
    { title: "说明", dataIndex: "message", ellipsis: true },
  ];

  const batchColumns: ColumnsType<LabAiBusinessDataBatchRecord> = [
    { title: "批次", dataIndex: "batchNo", width: 80, render: (value: number) => `#${value}` },
    { title: "状态", dataIndex: "batchStatus", width: 100, render: (value: string) => renderBatchStatus(value) },
    { title: "模式", dataIndex: "generatorMode", width: 90, render: (value: string) => renderGeneratorMode(value) },
    { title: "行数", width: 90, render: (_, record) => asNumber(record.validation?.rowCount) },
    { title: "问题", width: 110, render: (_, record) => record.generatorMode === "ai" ? `${asNumber(record.validation?.errorCount)}/${asNumber(record.validation?.warningCount)}` : "不可落库" },
    { title: "创建时间", dataIndex: "createdAt", width: 180, render: (value: string) => formatDateTime(value) },
  ];

  const taskColumns: ColumnsType<LabAiBusinessDataTaskRecord> = [
    {
      title: "任务",
      dataIndex: "taskName",
      width: 230,
      render: (value: string, record) => (
        <div>
          <Typography.Text strong ellipsis style={{ display: "block", maxWidth: 210 }}>{value}</Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ display: "block", maxWidth: 210 }}>
            {record.instanceName || "-"} / V{record.physicalVersionNo}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "生成逻辑",
      width: 300,
      render: (_, record) => (
        <div>
          <Typography.Text ellipsis style={{ display: "block", maxWidth: 280 }}>
            {record.planId ? `方案 #${record.planId}` : "未绑定方案，运行时按物理模型兜底"}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ display: "block", maxWidth: 280 }}>
            {record.planSummary || record.requirementText || "按任务配置生成增量业务数据"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "执行策略",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{record.batchRows} 行/批</Typography.Text>
          {record.autoLoad ? <Tag color="green">{record.loadMode === "replace" ? "替换落库" : "追加落库"}</Tag> : <Tag>人工审核</Tag>}
        </Space>
      ),
    },
    { title: "周期", width: 140, render: (_, record) => formatSchedule(record) },
    {
      title: "状态",
      width: 170,
      render: (_, record) => (
        <div>
          <Space size={4}>{renderTaskStatus(record.taskStatus, record.scheduleEnabled)}{renderRunStatus(record.lastRunStatus)}</Space>
          <Typography.Text type="secondary" ellipsis style={{ display: "block", maxWidth: 150 }}>
            {record.lastRunAt ? formatDateTime(record.lastRunAt) : record.lastRunMessage || "-"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "操作",
      width: 230,
      render: (_, record) => (
        <Space size={6} onClick={(event) => event.stopPropagation()}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openTaskDetail(record)}>编辑</Button>
          <Button size="small" icon={<PlayCircleOutlined />} loading={taskRunningId === record.id} onClick={() => void handleRunTask(record)}>运行一次</Button>
          <Button
            size="small"
            icon={record.scheduleEnabled ? <PauseCircleOutlined /> : <SyncOutlined />}
            disabled={record.scheduleType === "manual"}
            onClick={() => void handleToggleTask(record, !record.scheduleEnabled)}
          >
            {record.scheduleEnabled ? "停用" : "启用"}
          </Button>
          <Popconfirm title="确认删除该生成任务？" okText="删除" cancelText="取消" onConfirm={() => void handleDeleteTask(record)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const previewTabs = (activeBatch?.previewTables || []).map((tableItem) => {
    const columnItems = (
      tableItem.columns.length > 0
        ? tableItem.columns.map((column) => (
          typeof column === "string"
            ? { columnName: column, columnComment: "" }
            : { columnName: column.columnName, columnComment: column.columnComment || "" }
        ))
        : Object.keys(tableItem.rows[0] || {}).map((columnName) => ({ columnName, columnComment: "" }))
    ).filter((column) => column.columnName).slice(0, 20);
    const columnNames = columnItems.map((column) => column.columnName);
    return {
      key: tableItem.logicalTableName,
      label: renderPreviewName(tableItem.logicalTableName, tableItem.tableComment, { width: 170, count: tableItem.rowCount }),
      children: (
        <Table<Record<string, unknown>>
          rowKey={(record) => `${tableItem.logicalTableName}-${String(record[columnNames[0]] ?? JSON.stringify(record))}`}
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
          dataSource={tableItem.rows}
          columns={columnItems.map((column) => ({
            title: renderPreviewName(column.columnName, column.columnComment, { width: 145 }),
            dataIndex: column.columnName,
            width: 160,
            ellipsis: true,
            render: (value: unknown) => stringifyCellValue(value),
          }))}
        />
      ),
    };
  });
  const activeBatchCanLoad = Boolean(activeBatch && activeBatch.generatorMode === "ai" && activeBatch.batchStatus !== "loaded" && activeBatch.validation?.passed);
  const taskListCard = (
    <DataTableCard<LabAiBusinessDataTaskRecord>
      title="生成任务清单"
      extra={<Typography.Text type="secondary">每个任务绑定一套物理模型版本和生成方案，启用后按周期循环生成增量批次</Typography.Text>}
      tableProps={{
        rowKey: "id",
        size: "small",
        loading,
        pagination: { pageSize: 8 },
        dataSource: tasks,
        columns: taskColumns,
        scroll: { x: 1120 },
      }}
    />
  );

  return (
    <Space direction="vertical" size={18} style={{ display: "flex" }}>
      <PageToolbar
        left={
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              {isTaskDetailMode ? "AI 业务数据任务配置" : "AI 业务数据任务"}
            </Typography.Title>
            <Typography.Text type="secondary">
              {isTaskDetailMode ? "维护单个物理模型的数据生成逻辑、循环周期和批次审核。" : "按物理模型维护业务数据生成任务，支持手动执行和定时循环生成增量批次。"}
            </Typography.Text>
          </div>
        }
        right={(
          <Space wrap>
            {isTaskDetailMode ? (
              <Button onClick={handleBackToTaskList}>返回任务清单</Button>
            ) : (
              <Button type="primary" icon={<SaveOutlined />} onClick={handleCreateTask}>新建任务</Button>
            )}
            <Link to="/dashboard/data-modeling/prompts">
              <Button icon={<SettingOutlined />}>模型管理</Button>
            </Link>
            <Button icon={<ReloadOutlined />} onClick={() => void loadBaseData()} loading={loading}>刷新</Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]}>
        {kpis.map((item) => (
          <Col xs={24} sm={12} xl={6} key={String(item.title)}>
            <StatCard {...item} />
          </Col>
        ))}
      </Row>

      {!isTaskDetailMode ? taskListCard : (
        <>
      <Card variant="borderless" title={activeTask ? `任务配置：${activeTask.taskName}` : "生成任务配置"}>
        <Form<GenerationFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            generationMode: "incremental",
            totalRows: 300,
            batchRows: 80,
            timelineStartAt: "2025-01-01",
            timelineDays: 90,
            scheduleEnabled: false,
            scheduleType: "manual",
            autoLoad: false,
            loadMode: "append",
          }}
        >
          <Row gutter={16}>
            <Col xs={24} lg={6}>
              <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
                <Input placeholder="例如：电商零售每日增量造数" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={6}>
              <Form.Item name="instanceId" label="物理模型实例" rules={[{ required: true, message: "请选择物理模型实例" }]}>
                <Select showSearch optionFilterProp="label" options={instanceOptions} placeholder="选择已生成物理模型的实例" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={6}>
              <Form.Item name="physicalVersionNo" label="物理版本" rules={[{ required: true, message: "请选择物理版本" }]}>
                <Select options={physicalVersionOptions} placeholder="默认当前物理版本" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={6}>
              <Form.Item name="targetDataSourceId" label="目标数据源" rules={[{ required: true, message: "请选择目标数据源" }]}>
                <Select showSearch optionFilterProp="label" options={dataSourceOptions} placeholder="默认部署目标源" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={4}>
              <Form.Item name="generationMode" label="生成模式">
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value="initial">首批</Radio.Button>
                  <Radio.Button value="incremental">增量</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={12} lg={4}>
              <Form.Item name="totalRows" label="方案目标行数">
                <InputNumber min={1} max={5000} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} lg={4}>
              <Form.Item name="batchRows" label="本批业务行数">
                <InputNumber min={1} max={5000} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} lg={4}>
              <Form.Item name="timelineStartAt" label="起始日期">
                <Input placeholder="2025-01-01" />
              </Form.Item>
            </Col>
            <Col xs={12} lg={4}>
              <Form.Item name="timelineDays" label="跨度天数">
                <InputNumber min={1} max={3650} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} lg={4}>
              <Form.Item name="loadMode" label="落库模式">
                <Radio.Group optionType="button">
                  <Radio.Button value="append">追加</Radio.Button>
                  <Radio.Button value="replace">替换</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} lg={4}>
              <Form.Item name="scheduleType" label="循环周期">
                <Select
                  options={[
                    { value: "manual", label: "手动" },
                    { value: "hourly", label: "每小时" },
                    { value: "daily", label: "每天" },
                    { value: "weekly", label: "每周" },
                    { value: "cron", label: "Cron" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={12} lg={4}>
              <Form.Item name="scheduleEnabled" label="定时状态">
                <Radio.Group optionType="button">
                  <Radio.Button value={false}>停用</Radio.Button>
                  <Radio.Button value={true}>启用</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={12} lg={4}>
              <Form.Item name="autoLoad" label="生成后落库">
                <Radio.Group optionType="button">
                  <Radio.Button value={false}>人工审核</Radio.Button>
                  <Radio.Button value={true}>自动落库</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            {selectedScheduleType === "cron" ? (
              <Col xs={24} lg={8}>
                <Form.Item name="cronExpr" label="Cron 表达式" rules={[{ required: true, message: "请输入 Cron 表达式" }]}>
                  <Input placeholder="例如：0 2 * * *" />
                </Form.Item>
              </Col>
            ) : null}
            <Col span={24}>
              <Form.Item name="requirementText" label="生成要求">
                <Input.TextArea
                  rows={3}
                  maxLength={4000}
                  placeholder="例如：覆盖真实交易链路，手机号/身份证/邮箱必须合规，地址和描述贴合业务；增量批次要复用已存在客户、商品或车辆。"
                />
              </Form.Item>
            </Col>
          </Row>
          <Space wrap>
            <Button icon={<SaveOutlined />} loading={taskSaving} onClick={() => void handleSaveTask()}>
              保存任务
            </Button>
            <Button type="primary" icon={<RobotOutlined />} loading={planLoading} onClick={() => void handleGeneratePlan()}>
              生成数据方案
            </Button>
            <Button icon={<PlayCircleOutlined />} loading={batchLoading} disabled={!selectedInstance} onClick={() => void handleGenerateBatch()}>
              生成预览批次
            </Button>
            <Popconfirm
              title="确认将当前审核批次写入目标数据源？"
              description="追加模式会保留已有数据；替换模式会清空该物理模型下的目标表后重装。"
              okText="确认落库"
              cancelText="取消"
              onConfirm={() => void handleLoadBatch()}
              disabled={!activeBatchCanLoad}
            >
              <Button
                icon={<CloudUploadOutlined />}
                loading={loadLoading}
                disabled={!activeBatchCanLoad}
              >
                确认落库
              </Button>
            </Popconfirm>
          </Space>
        </Form>
      </Card>

      {selectedInstance ? (
        <Descriptions bordered size="small" column={{ xs: 1, md: 2, xl: 4 }}>
          <Descriptions.Item label="实例">{selectedInstance.instanceName}</Descriptions.Item>
          <Descriptions.Item label="模板">{selectedInstance.templateName}</Descriptions.Item>
          <Descriptions.Item label="数据库">{selectedInstance.dbType}</Descriptions.Item>
          <Descriptions.Item label="当前物理版本">V{selectedInstance.currentPhysicalVersion || "-"}</Descriptions.Item>
        </Descriptions>
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            variant="borderless"
            title="AI 数据方案"
            extra={activePlan ? renderGeneratorMode(activePlan.generatorMode) : null}
          >
            {activePlan?.plan ? (
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                {activePlan.generatorMode === "fallback" ? (
                  <Alert type="warning" showIcon message="当前方案由平台兜底生成" description={activePlan.modelSummary || "模型调用不可用或返回内容未通过解析。"} />
                ) : null}
                <Typography.Paragraph>{activePlan.plan.summary || activePlan.modelSummary}</Typography.Paragraph>
                <Space wrap>
                  {(activePlan.plan.industryUnderstanding || []).slice(0, 6).map((item) => <Tag key={item}>{item}</Tag>)}
                </Space>
                <Typography.Text strong>表级行数计划</Typography.Text>
                <Table<Record<string, unknown>>
                  rowKey={(record) => String(record.tableName || record.physicalTableName)}
                  size="small"
                  pagination={false}
                  scroll={{ x: 720 }}
                  dataSource={activePlan.plan.rowAllocation || []}
                  columns={planTableColumns}
                />
              </Space>
            ) : (
              <Empty description="尚未生成 AI 数据方案" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <DataTableCard<LabAiBusinessDataBatchRecord>
            title="最近批次"
            tableProps={{
              rowKey: "id",
              size: "small",
              loading,
              pagination: false,
              dataSource: batches,
              columns: batchColumns,
              onRow: (record) => ({
                onClick: () => setActiveBatch(record),
              }),
            }}
          />
        </Col>
      </Row>

      <Card variant="borderless" title="批次校验与预览" extra={activeBatch ? renderBatchStatus(activeBatch.batchStatus) : null}>
        {activeBatch ? (
          <Space direction="vertical" size={14} style={{ display: "flex" }}>
            {activeBatch.generatorMode !== "ai" ? (
              <Alert
                type="warning"
                showIcon
                message="当前批次不是 AI 成功生成的数据"
                description={activeBatch.modelSummary || "模型调用失败后的兜底批次不可确认落库，请重新生成 AI 预览批次。"}
              />
            ) : null}
            <Alert
              type={activeBatch.validation?.passed && activeBatch.generatorMode === "ai" ? "success" : "error"}
              showIcon
              message={activeBatch.validation?.passed && activeBatch.generatorMode === "ai" ? "校验通过，可确认落库" : "校验未通过，需重新生成或调整要求"}
              description={`行数 ${asNumber(activeBatch.validation?.rowCount)}，错误 ${asNumber(activeBatch.validation?.errorCount)}，警告 ${asNumber(activeBatch.validation?.warningCount)}`}
            />
            {(activeBatch.validation?.issues || []).length > 0 ? (
              <Table
                rowKey={(record) => `${record.level}-${record.code}-${record.path || ""}-${record.message}`}
                size="small"
                pagination={{ pageSize: 6 }}
                dataSource={activeBatch.validation?.issues || []}
                columns={issueColumns}
              />
            ) : null}
            {previewTabs.length > 0 ? <Tabs items={previewTabs} /> : <Empty description="该批次列表记录不含行预览，请重新生成预览批次查看明细" />}
          </Space>
        ) : (
          <Empty description="尚未生成或选择预览批次" />
        )}
      </Card>
        </>
      )}
    </Space>
  );
}
