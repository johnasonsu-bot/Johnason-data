import "reactflow/dist/style.css";

import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tabs,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  type NodeProps,
  Position,
  ReactFlowInstance,
  ReactFlowProvider,
} from "reactflow";
import {
  fetchDevInstances,
  fetchDevWorkflowRuns,
  runDevWorkflow,
  saveDevWorkflowGraph,
  updateDevWorkflow,
} from "../../../services/dataDevelopment";
import type {
  DevDatasourceRecord,
  DevJobInstanceRecord,
  DevOrchestrationTaskRecord,
  DevProcessingJobRecord,
  DevScriptRecord,
  DevWorkflowRecord,
  DevWorkflowRunRecord,
} from "../../../types/api";
import {
  formatWorkflowStatus,
  toFlowEdge,
  toFlowNode,
  type WorkflowNodeData,
  type WorkflowNodeStatus,
  type WorkflowNodeType,
} from "../helpers";
import {
  buildCronFromWorkflowSchedule,
  getWorkflowIntervalMax,
  parseCronToWorkflowSchedule,
  workflowIntervalUnitOptions,
  workflowWeekDayOptions,
  type WorkflowIntervalUnit,
  type WorkflowScheduleType,
} from "../workflowSchedule";

interface WorkflowDesignerProps {
  token: string;
  datasources: DevDatasourceRecord[];
  scripts: DevScriptRecord[];
  processingJobs: DevProcessingJobRecord[];
  orchestrationTasks: DevOrchestrationTaskRecord[];
  selectedWorkflowId?: number;
  selectedWorkflow?: DevWorkflowRecord | null;
  onRefresh: () => Promise<void>;
  onReloadDetail: (id: number) => Promise<void>;
  onOpenInstances: (workflowId: number) => void;
  onBackToList: () => void;
}

type NodeTemplate = {
  nodeType: WorkflowNodeType;
  label: string;
  description: string;
  defaultConfig?: Record<string, unknown>;
};

type WorkflowScheduleFormValues = {
  scheduleType: WorkflowScheduleType;
  intervalValue?: number;
  intervalUnit?: WorkflowIntervalUnit;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  cronExpr?: string;
  retryTimes: number;
  timeoutSec: number;
  isPaused: boolean;
};

const FUNCTION_NODE_TEMPLATES: NodeTemplate[] = [
  { nodeType: "start", label: "开始", description: "流程入口，仅允许一条输出连线。" },
  { nodeType: "end", label: "结束", description: "流程终点，不允许继续向后连接。" },
  {
    nodeType: "branch",
    label: "分支判断",
    description: "执行 SQL 判断条件，按 true / false 路由。",
    defaultConfig: { operator: "eq", expectedValue: "", resultLimit: 1, emptyAs: false },
  },
  { nodeType: "parallel", label: "并行分支", description: "同时激活多条下游分支。" },
  { nodeType: "join", label: "并行汇聚", description: "等待有效上游完成后继续执行。" },
];

const STATUS_META: Record<WorkflowNodeStatus, { text: string; color: string; background: string; border: string }> = {
  idle: { text: "待执行", color: "#5b6b7f", background: "#ffffff", border: "#d9e0ea" },
  running: { text: "运行中", color: "#0958d9", background: "#e6f4ff", border: "#91caff" },
  success: { text: "成功", color: "#237804", background: "#f6ffed", border: "#b7eb8f" },
  failed: { text: "失败", color: "#cf1322", background: "#fff1f0", border: "#ffccc7" },
  skipped: { text: "已跳过", color: "#8c8c8c", background: "#fafafa", border: "#d9d9d9" },
};

const NODE_META: Record<WorkflowNodeType, { badge: string; accent: string; background: string }> = {
  start: { badge: "START", accent: "#389e0d", background: "linear-gradient(135deg, #f6ffed 0%, #ffffff 100%)" },
  end: { badge: "END", accent: "#722ed1", background: "linear-gradient(135deg, #f9f0ff 0%, #ffffff 100%)" },
  script: { badge: "SQL", accent: "#1677ff", background: "linear-gradient(135deg, #e6f4ff 0%, #ffffff 100%)" },
  processing: { badge: "ETL", accent: "#08979c", background: "linear-gradient(135deg, #e6fffb 0%, #ffffff 100%)" },
  operator_task: { badge: "OP", accent: "#531dab", background: "linear-gradient(135deg, #f9f0ff 0%, #ffffff 100%)" },
  branch: { badge: "IF", accent: "#d46b08", background: "linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)" },
  parallel: { badge: "PAR", accent: "#0958d9", background: "linear-gradient(135deg, #e6f4ff 0%, #ffffff 100%)" },
  join: { badge: "JOIN", accent: "#c41d7f", background: "linear-gradient(135deg, #fff0f6 0%, #ffffff 100%)" },
};

const DESIGNER_CANVAS_HEIGHT = 740;

function buildNodeStyle(nodeType: WorkflowNodeType, status: WorkflowNodeStatus) {
  const statusMeta = STATUS_META[status];
  const typeMeta = NODE_META[nodeType];
  return {
    width: 260,
    minHeight: nodeType === "branch" ? 116 : 96,
    borderRadius: nodeType === "branch" ? 18 : 14,
    border: `1px solid ${statusMeta.border}`,
    background: status === "idle" ? typeMeta.background : statusMeta.background,
    boxShadow: status === "running"
      ? "0 0 0 3px rgba(22, 119, 255, 0.14), 0 16px 36px rgba(9, 88, 217, 0.18)"
      : "0 12px 28px rgba(15, 23, 42, 0.08)",
  };
}

function WorkflowNodeView({ data, selected }: NodeProps<WorkflowNodeData>) {
  const nodeType = data.nodeType || "script";
  const status = data.status || "idle";
  const typeMeta = NODE_META[nodeType];
  const statusMeta = STATUS_META[status];

  return (
    <div
      style={{
        ...buildNodeStyle(nodeType, status),
        padding: 14,
        outline: selected ? "2px solid rgba(22, 119, 255, 0.45)" : "none",
      }}
    >
      {nodeType !== "start" ? <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: typeMeta.accent }} /> : null}
      {nodeType !== "end" ? <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: typeMeta.accent }} /> : null}
      <Space direction="vertical" size={10} style={{ display: "flex" }}>
        <Space align="start" style={{ justifyContent: "space-between", width: "100%" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: typeMeta.accent }}>{typeMeta.badge}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1f1f1f" }}>{data.nodeName}</div>
          </div>
          <Tag bordered={false} color={status === "failed" ? "error" : status === "success" ? "success" : status === "running" ? "processing" : "default"}>
            {statusMeta.text}
          </Tag>
        </Space>
        {nodeType === "script" ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {data.scriptName || "未绑定SQL任务"}
          </Typography.Text>
        ) : null}
        {nodeType === "processing" ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {data.processingJobName || "未绑定数据处理任务"}
          </Typography.Text>
        ) : null}
        {nodeType === "operator_task" ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {data.orchestrationTaskName || "未绑定算子任务"}
          </Typography.Text>
        ) : null}
        {nodeType === "branch" ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {(data.nodeConfig?.operator as string) || "eq"} / {(data.nodeConfig?.expectedValue as string) || "未设置目标值"}
          </Typography.Text>
        ) : null}
      </Space>
    </div>
  );
}

const WORKFLOW_NODE_TYPES = { workflowNode: WorkflowNodeView };

function buildNodeId(nodeType: WorkflowNodeType) {
  return `${nodeType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createFunctionNode(template: NodeTemplate, position = { x: 160, y: 120 }): Node<WorkflowNodeData> {
  return {
    id: buildNodeId(template.nodeType),
    type: "workflowNode",
    position,
    data: {
      label: template.label,
      nodeType: template.nodeType,
      scriptId: null,
      scriptName: "",
      nodeName: template.label,
      retryTimes: 0,
      retryIntervalSec: 5,
      timeoutSec: 300,
      triggerRule: "all_success",
      nodeConfig: template.defaultConfig || {},
      status: "idle",
    },
    style: buildNodeStyle(template.nodeType, "idle"),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

function createScriptNode(script: DevScriptRecord, position = { x: 200, y: 160 }): Node<WorkflowNodeData> {
  return {
    id: buildNodeId("script"),
    type: "workflowNode",
    position,
    data: {
      label: script.name,
      nodeType: "script",
      scriptId: script.id,
      scriptName: script.name,
      nodeName: script.name,
      retryTimes: 0,
      retryIntervalSec: 5,
      timeoutSec: 300,
      triggerRule: "all_success",
      nodeConfig: {
        databaseName: script.defaultDatabase || "",
        resultLimit: 200,
        timeoutSec: 300,
      },
      status: "idle",
    },
    style: buildNodeStyle("script", "idle"),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

function createProcessingNode(job: DevProcessingJobRecord, position = { x: 200, y: 160 }): Node<WorkflowNodeData> {
  return {
    id: buildNodeId("processing"),
    type: "workflowNode",
    position,
    data: {
      label: job.name,
      nodeType: "processing",
      processingJobId: job.id,
      processingJobName: job.name,
      nodeName: job.name,
      retryTimes: 0,
      retryIntervalSec: 5,
      timeoutSec: 300,
      triggerRule: "all_success",
      nodeConfig: {},
      status: "idle",
    },
    style: buildNodeStyle("processing", "idle"),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

function createOperatorTaskNode(task: DevOrchestrationTaskRecord, position = { x: 200, y: 160 }): Node<WorkflowNodeData> {
  return {
    id: buildNodeId("operator_task"),
    type: "workflowNode",
    position,
    data: {
      label: task.name,
      nodeType: "operator_task",
      orchestrationTaskId: task.id,
      orchestrationTaskName: task.name,
      nodeName: task.name,
      retryTimes: 0,
      retryIntervalSec: 5,
      timeoutSec: task.timeoutSec || 300,
      triggerRule: "all_success",
      nodeConfig: {},
      status: "idle",
    },
    style: buildNodeStyle("operator_task", "idle"),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

export function WorkflowDesigner({
  token,
  datasources,
  scripts,
  processingJobs,
  orchestrationTasks,
  selectedWorkflowId,
  selectedWorkflow,
  onRefresh,
  onReloadDetail,
  onOpenInstances,
  onBackToList,
}: WorkflowDesignerProps) {
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>((selectedWorkflow?.nodes || []).map(toFlowNode));
  const [edges, setEdges] = useState<Edge[]>((selectedWorkflow?.edges || []).map(toFlowEdge));
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [nodeDrawerOpen, setNodeDrawerOpen] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRun, setActiveRun] = useState<DevWorkflowRunRecord | null>(null);
  const [instances, setInstances] = useState<DevJobInstanceRecord[]>([]);
  const pollingRef = useRef<number | null>(null);
  const [scheduleForm] = Form.useForm<WorkflowScheduleFormValues>();
  const scheduleType = Form.useWatch("scheduleType", scheduleForm) || "manual";
  const intervalUnit = Form.useWatch("intervalUnit", scheduleForm) || "minute";

  const selectedNode = useMemo(() => nodes.find((item) => item.id === selectedNodeId), [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((item) => item.id === selectedEdgeId), [edges, selectedEdgeId]);

  useEffect(() => {
    setNodes((selectedWorkflow?.nodes || []).map(toFlowNode));
    setEdges((selectedWorkflow?.edges || []).map(toFlowEdge));
    setSelectedNodeId(undefined);
    setSelectedEdgeId(undefined);
    setNodeDrawerOpen(false);
  }, [selectedWorkflow]);

  useEffect(() => {
    if (!selectedWorkflowId || !token) {
      setActiveRun(null);
      setInstances([]);
      return;
    }
    void refreshRunState();
    return () => stopPolling();
  }, [selectedWorkflowId, token]);

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (!selectedEdgeId) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = String(target.tagName || "").toLowerCase();
        const isEditable = target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
        if (isEditable) {
          return;
        }
      }

      event.preventDefault();
      setEdges((prev) => prev.filter((item) => item.id !== selectedEdgeId));
      setSelectedEdgeId(undefined);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId]);

  const instanceStatusMap = useMemo(() => {
    const map = new Map<string, WorkflowNodeStatus>();
    for (const instance of instances) {
      if (!instance.workflowNodeKey) continue;
      let status: WorkflowNodeStatus = "idle";
      if (instance.status === "running" || instance.status === "pending") status = "running";
      if (instance.status === "success") status = "success";
      if (instance.status === "failed") status = "failed";
      if (instance.status === "skipped") status = "skipped";
      map.set(instance.workflowNodeKey, status);
    }
    return map;
  }, [instances]);

  const displayNodes = useMemo(
    () => nodes.map((node) => {
      const status = instanceStatusMap.get(node.id) || "idle";
      return {
        ...node,
        data: {
          ...node.data,
          status,
        },
        style: {
          ...buildNodeStyle(node.data.nodeType, status),
          ...(node.style || {}),
        },
      };
    }),
    [instanceStatusMap, nodes]
  );

  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      const edgeLabel = String((edge.data as { edgeLabel?: string } | undefined)?.edgeLabel || "default").toLowerCase();
      const sourceStatus = instanceStatusMap.get(edge.source);
      const targetStatus = instanceStatusMap.get(edge.target);
      const isVisited = Boolean(sourceStatus && targetStatus && targetStatus !== "idle");
      const isAnimated = targetStatus === "running";
      const isSelected = edge.id === selectedEdgeId;
      const strokeColor = isSelected
        ? "#ff4d4f"
        : isAnimated
          ? "#1677ff"
          : isVisited
            ? "#52c41a"
            : "#cbd5e1";
      return {
        ...edge,
        animated: isAnimated,
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        label: edgeLabel !== "default" ? edgeLabel.toUpperCase() : undefined,
        labelStyle: {
          fill: isSelected ? "#cf1322" : edgeLabel === "true" ? "#389e0d" : edgeLabel === "false" ? "#d46b08" : "#64748b",
          fontWeight: 700,
          fontSize: 11,
        },
        style: {
          strokeWidth: isSelected ? 3.5 : isAnimated ? 3 : 2,
          stroke: strokeColor,
        },
      } as Edge;
    });
  }, [edges, instanceStatusMap, selectedEdgeId]);

  function stopPolling() {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  function startPolling(workflowId: number, runId: number) {
    stopPolling();
    pollingRef.current = window.setInterval(() => {
      void refreshRunState(workflowId, runId);
    }, 2000);
  }

  async function refreshRunState(workflowId = selectedWorkflowId, preferredRunId?: number) {
    if (!token || !workflowId) return;
    try {
      const runRes = await fetchDevWorkflowRuns(token, workflowId);
      const selectedRun = preferredRunId
        ? runRes.data.find((item) => item.id === preferredRunId) || runRes.data[0] || null
        : runRes.data[0] || null;
      setActiveRun(selectedRun);

      if (!selectedRun) {
        setInstances([]);
        stopPolling();
        setRunning(false);
        return;
      }

      const instanceRes = await fetchDevInstances(token, { workflowRunId: selectedRun.id });
      setInstances([...instanceRes.data].sort((left, right) => left.id - right.id));

      const isActive = selectedRun.status === "running" || selectedRun.status === "pending";
      setRunning(isActive);
      if (isActive) {
        startPolling(workflowId, selectedRun.id);
      } else {
        stopPolling();
      }
    } catch (error: any) {
      stopPolling();
      setRunning(false);
      message.error(error.message || "加载工作流运行状态失败");
    }
  }

  function updateNode(nodeId: string, updater: (node: Node<WorkflowNodeData>) => Node<WorkflowNodeData>) {
    setNodes((prev) => prev.map((item) => item.id === nodeId ? updater(item) : item));
  }

  async function handleSaveGraph() {
    if (!selectedWorkflowId) return;
    setSaving(true);
    try {
      await saveDevWorkflowGraph(token, selectedWorkflowId, {
        nodes: nodes.map((node) => ({
          nodeType: node.data.nodeType,
          scriptId: node.data.nodeType === "script" ? node.data.scriptId : null,
          processingJobId: node.data.nodeType === "processing" ? node.data.processingJobId : null,
          orchestrationTaskId: node.data.nodeType === "operator_task" ? node.data.orchestrationTaskId : null,
          nodeKey: node.id,
          nodeName: node.data.nodeName,
          positionX: node.position.x,
          positionY: node.position.y,
          width: Number(node.style?.width || 260),
          height: Number(node.style?.minHeight || 96),
          retryTimes: node.data.retryTimes ?? null,
          retryIntervalSec: node.data.retryIntervalSec ?? 5,
          timeoutSec: node.data.timeoutSec ?? null,
          triggerRule: node.data.triggerRule || "all_success",
          nodeConfig: node.data.nodeConfig || {},
        })),
        edges: edges.map((edge) => ({
          sourceNodeKey: edge.source,
          targetNodeKey: edge.target,
          edgeType: edge.type || "smoothstep",
          edgeLabel: (edge.data as { edgeLabel?: string } | undefined)?.edgeLabel || "default",
        })),
      });
      message.success("画布已保存");
      await onRefresh();
      await onReloadDetail(selectedWorkflowId);
    } catch (error: any) {
      message.error(error.message || "保存画布失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    if (!selectedWorkflowId) return;
    try {
      const res = await runDevWorkflow(token, selectedWorkflowId, { triggerType: "manual" });
      message.success("工作流已触发运行");
      setActiveRun(res.data);
      setInstances([]);
      setRunning(true);
      startPolling(selectedWorkflowId, res.data.id);
    } catch (error: any) {
      message.error(error.message || "触发工作流失败");
    }
  }

  function openScheduleModal() {
    if (!selectedWorkflow) return;
    const parsedSchedule = parseCronToWorkflowSchedule(selectedWorkflow.cronExpr);
    scheduleForm.setFieldsValue({
      scheduleType: parsedSchedule.scheduleType || "manual",
      intervalValue: parsedSchedule.intervalValue || 5,
      intervalUnit: parsedSchedule.intervalUnit || "minute",
      runTime: parsedSchedule.runTime || "02:00",
      weekDays: parsedSchedule.weekDays,
      monthDay: parsedSchedule.monthDay,
      cronExpr: parsedSchedule.cronExpr || selectedWorkflow.cronExpr || undefined,
      isPaused: selectedWorkflow.isPaused,
      retryTimes: selectedWorkflow.retryTimes,
      timeoutSec: selectedWorkflow.timeoutSec,
    });
    setScheduleModalOpen(true);
  }

  async function handleSaveSchedule() {
    if (!selectedWorkflowId || !selectedWorkflow) return;
    try {
      const values = await scheduleForm.validateFields();
      const cronExpr = buildCronFromWorkflowSchedule(values);
      await updateDevWorkflow(token, selectedWorkflowId, {
        name: selectedWorkflow.name,
        description: selectedWorkflow.description,
        cronExpr,
        isPaused: values.scheduleType === "manual" ? true : values.isPaused,
        retryTimes: values.retryTimes,
        timeoutSec: values.timeoutSec,
        runtimeConfig: selectedWorkflow.runtimeConfig || {},
      });
      message.success("调度配置已保存");
      setScheduleModalOpen(false);
      await onRefresh();
      await onReloadDetail(selectedWorkflowId);
    } catch (error: any) {
      message.error(error.message || "保存调度配置失败");
    }
  }

  function deleteNode(nodeId: string) {
    setNodes((prev) => prev.filter((item) => item.id !== nodeId));
    setEdges((prev) => prev.filter((item) => item.source !== nodeId && item.target !== nodeId));
    setSelectedNodeId(undefined);
    setSelectedEdgeId(undefined);
    setNodeDrawerOpen(false);
  }

  function deleteEdge(edgeId: string) {
    setEdges((prev) => prev.filter((item) => item.id !== edgeId));
    setSelectedEdgeId(undefined);
  }

  function assignEdgeLabel(sourceNode: Node<WorkflowNodeData> | undefined, existingEdges: Edge[], sourceId: string) {
    const outgoingEdges = existingEdges.filter((item) => item.source === sourceId);
    if (!sourceNode) {
      return { allowed: true, edgeLabel: "default" };
    }
    if (sourceNode.data.nodeType === "end") {
      return { allowed: false, messageText: "结束节点不允许继续连线" };
    }
    if (sourceNode.data.nodeType === "branch") {
      const labels = new Set(outgoingEdges.map((item) => String((item.data as { edgeLabel?: string } | undefined)?.edgeLabel || "default")));
      if (!labels.has("true")) {
        return { allowed: true, edgeLabel: "true" };
      }
      if (!labels.has("false")) {
        return { allowed: true, edgeLabel: "false" };
      }
      return { allowed: false, messageText: "分支节点只能有 true / false 两条输出" };
    }
    if (sourceNode.data.nodeType === "parallel") {
      return { allowed: true, edgeLabel: "default" };
    }
    if (outgoingEdges.length >= 1) {
      return { allowed: false, messageText: "当前节点最多只允许一条输出" };
    }
    return { allowed: true, edgeLabel: "default" };
  }

  function handleConnect(params: Edge | Connection) {
    if (!params.source || !params.target) return;
    if (params.source === params.target) {
      message.error("节点不能连接自身");
      return;
    }

    const sourceNode = nodes.find((item) => item.id === params.source);
    const targetNode = nodes.find((item) => item.id === params.target);
    if (targetNode?.data.nodeType === "start") {
      message.error("开始节点不允许输入连线");
      return;
    }
    const edgeRule = assignEdgeLabel(sourceNode, edges, params.source);
    if (!edgeRule.allowed) {
      message.error(edgeRule.messageText || "当前连接不允许");
      return;
    }

    if (edges.some((item) => item.source === params.source && item.target === params.target)) {
      message.warning("该连接已存在");
      return;
    }

    const edgeLabel = edgeRule.edgeLabel || "default";
    setEdges((prev) => addEdge({
      ...params,
      type: "smoothstep",
      interactionWidth: 32,
      markerEnd: { type: MarkerType.ArrowClosed },
      label: edgeLabel !== "default" ? edgeLabel.toUpperCase() : undefined,
      data: { edgeLabel },
    }, prev));
    setSelectedEdgeId(undefined);
  }

  return (
    <ReactFlowProvider>
      <Space direction="vertical" size={16} style={{ display: "flex" }}>
        <Card size="small">
          <Row gutter={[16, 16]} align="middle" justify="space-between">
            <Col flex="auto">
              <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={onBackToList}>
                  返回清单
                </Button>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {selectedWorkflow?.name || "工作流编辑"}
                </Typography.Title>
              </Space>
            </Col>
            <Col>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  disabled={!selectedWorkflowId}
                  loading={running}
                  onClick={() => void handleRun()}
                >
                  运行
                </Button>
                <Button icon={<SaveOutlined />} disabled={!selectedWorkflowId} loading={saving} onClick={() => void handleSaveGraph()}>
                  保存
                </Button>
                <Button icon={<SettingOutlined />} disabled={!selectedWorkflowId} onClick={openScheduleModal}>
                  调度
                </Button>
                {selectedWorkflowId ? <Button onClick={() => onOpenInstances(selectedWorkflowId)}>实例监控</Button> : null}
              </Space>
            </Col>
          </Row>
          {activeRun ? (
            <Space style={{ marginTop: 12 }}>
              <Tag color={activeRun.status === "failed" ? "error" : activeRun.status === "success" ? "success" : "processing"}>
                {formatWorkflowStatus(activeRun.status)}
              </Tag>
              <Typography.Text type="secondary">最近运行 #{activeRun.id}</Typography.Text>
              {activeRun.errorMessage ? <Typography.Text type="danger">{activeRun.errorMessage}</Typography.Text> : null}
            </Space>
          ) : null}
        </Card>

        <Row gutter={16}>
          <Col span={5}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card
                size="small"
                title="任务资源"
                styles={{ body: { height: 390, overflowY: "auto", overflowX: "hidden" } }}
              >
                <Tabs
                  size="small"
                  items={[
                    {
                      key: "sql",
                      label: "SQL任务",
                      children: (
                        <List
                          size="small"
                          dataSource={scripts}
                          locale={{ emptyText: <Empty description="暂无SQL任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                          renderItem={(item) => (
                            <List.Item
                              draggable
                              onDragStart={(event) => event.dataTransfer.setData("application/medata-script", JSON.stringify(item))}
                              style={{ cursor: "grab", borderRadius: 10, paddingInline: 10 }}
                            >
                              <List.Item.Meta title={item.name} description={item.datasourceName} />
                            </List.Item>
                          )}
                        />
                      ),
                    },
                    {
                      key: "processing",
                      label: "数据处理",
                      children: (
                        <List
                          size="small"
                          dataSource={processingJobs}
                          locale={{ emptyText: <Empty description="暂无数据处理任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                          renderItem={(item) => (
                            <List.Item
                              draggable
                              onDragStart={(event) => event.dataTransfer.setData("application/medata-processing-job", JSON.stringify(item))}
                              style={{ cursor: "grab", borderRadius: 10, paddingInline: 10 }}
                            >
                              <List.Item.Meta title={item.name} description={item.datasourceName || item.tableName} />
                            </List.Item>
                          )}
                        />
                      ),
                    },
                    {
                      key: "operator",
                      label: "算子任务",
                      children: (
                        <List
                          size="small"
                          dataSource={orchestrationTasks}
                          locale={{ emptyText: <Empty description="暂无算子任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                          renderItem={(item) => (
                            <List.Item
                              draggable
                              onDragStart={(event) => event.dataTransfer.setData("application/medata-operator-task", JSON.stringify(item))}
                              style={{ cursor: "grab", borderRadius: 10, paddingInline: 10 }}
                            >
                              <List.Item.Meta title={item.name} description={item.datasourceName || "算子平台"} />
                            </List.Item>
                          )}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
              <Card
                size="small"
                title="功能节点"
                styles={{ body: { height: 250, overflowY: "auto", overflowX: "hidden" } }}
              >
                <List
                  size="small"
                  dataSource={FUNCTION_NODE_TEMPLATES}
                  renderItem={(item) => (
                    <List.Item
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("application/medata-function-node", JSON.stringify(item))}
                      style={{ cursor: "grab", borderRadius: 10, paddingInline: 10 }}
                    >
                      <List.Item.Meta title={item.label} description={item.description} />
                    </List.Item>
                  )}
                />
              </Card>
            </div>
          </Col>

          <Col span={19}>
            <div
              ref={canvasContainerRef}
              style={{ position: "relative", height: DESIGNER_CANVAS_HEIGHT, border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden", background: "#fbfdff" }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!reactFlowInstance) return;
                const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const scriptPayload = event.dataTransfer.getData("application/medata-script");
                if (scriptPayload) {
                  const script = JSON.parse(scriptPayload) as DevScriptRecord;
                  setNodes((prev) => prev.concat(createScriptNode(script, position)));
                  return;
                }
                const processingPayload = event.dataTransfer.getData("application/medata-processing-job");
                if (processingPayload) {
                  const job = JSON.parse(processingPayload) as DevProcessingJobRecord;
                  setNodes((prev) => prev.concat(createProcessingNode(job, position)));
                  return;
                }
                const operatorTaskPayload = event.dataTransfer.getData("application/medata-operator-task");
                if (operatorTaskPayload) {
                  const task = JSON.parse(operatorTaskPayload) as DevOrchestrationTaskRecord;
                  setNodes((prev) => prev.concat(createOperatorTaskNode(task, position)));
                  return;
                }
                const functionPayload = event.dataTransfer.getData("application/medata-function-node");
                if (functionPayload) {
                  const template = JSON.parse(functionPayload) as NodeTemplate;
                  setNodes((prev) => prev.concat(createFunctionNode(template, position)));
                }
              }}
            >
              {selectedEdge ? (
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ position: "absolute", top: 12, right: 12, zIndex: 5 }}
                  onClick={() => deleteEdge(selectedEdge.id)}
                >
                  删除连线
                </Button>
              ) : null}
              <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={WORKFLOW_NODE_TYPES}
                onInit={setReactFlowInstance}
                onNodesChange={(changes) => setNodes((prev) => applyNodeChanges(changes, prev))}
                onEdgesChange={(changes) => {
                  const removedIds = new Set(changes.filter((item) => item.type === "remove").map((item) => item.id));
                  if (selectedEdgeId && removedIds.has(selectedEdgeId)) {
                    setSelectedEdgeId(undefined);
                  }
                  setEdges((prev) => applyEdgeChanges(changes, prev));
                }}
                onConnect={handleConnect}
                onNodeClick={(_, node) => {
                  setSelectedEdgeId(undefined);
                  setSelectedNodeId(node.id);
                  setNodeDrawerOpen(true);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedNodeId(undefined);
                  setNodeDrawerOpen(false);
                  setSelectedEdgeId(edge.id);
                }}
                onEdgeDoubleClick={(_, edge) => {
                  deleteEdge(edge.id);
                }}
                onEdgeContextMenu={(event, edge) => {
                  event.preventDefault();
                  deleteEdge(edge.id);
                }}
                onPaneClick={() => {
                  setSelectedEdgeId(undefined);
                }}
                fitView
              >
                <Background gap={18} size={1} color="#dbeafe" />
                <MiniMap zoomable pannable style={{ background: "#ffffff", border: "1px solid #d9e0ea" }} />
                <Controls />
              </ReactFlow>
            </div>
          </Col>
        </Row>
      </Space>

      <Drawer
        open={nodeDrawerOpen}
        title={selectedNode ? `节点配置 / ${selectedNode.data.nodeName}` : "节点配置"}
        width={420}
        getContainer={() => canvasContainerRef.current!}
        rootStyle={{ position: "absolute" }}
        destroyOnClose
        onClose={() => {
          setNodeDrawerOpen(false);
          setSelectedNodeId(undefined);
        }}
      >
        {selectedNode ? (
          <Form
            key={selectedNode.id}
            layout="vertical"
            initialValues={{
              nodeName: selectedNode.data.nodeName,
              scriptId: selectedNode.data.scriptId || undefined,
              processingJobId: selectedNode.data.processingJobId || undefined,
              orchestrationTaskId: selectedNode.data.orchestrationTaskId || undefined,
              databaseName: String(selectedNode.data.nodeConfig?.databaseName || ""),
              datasourceId: selectedNode.data.nodeConfig?.datasourceId,
              resultLimit: Number(selectedNode.data.nodeConfig?.resultLimit || 200),
              retryTimes: selectedNode.data.retryTimes ?? 0,
              retryIntervalSec: selectedNode.data.retryIntervalSec ?? 5,
              timeoutSec: Number(selectedNode.data.timeoutSec ?? selectedNode.data.nodeConfig?.timeoutSec ?? 300),
              triggerRule: selectedNode.data.triggerRule || "all_success",
              description: String(selectedNode.data.nodeConfig?.description || ""),
              sqlText: String(selectedNode.data.nodeConfig?.sqlText || ""),
              operator: String(selectedNode.data.nodeConfig?.operator || "eq"),
              expectedValue: String(selectedNode.data.nodeConfig?.expectedValue || ""),
              emptyAs: Boolean(selectedNode.data.nodeConfig?.emptyAs),
            }}
            onValuesChange={(_, values) => {
              updateNode(selectedNode.id, (item) => {
                const nextScript = values.scriptId ? scripts.find((script) => script.id === values.scriptId) : undefined;
                const nextProcessingJob = values.processingJobId ? processingJobs.find((job) => job.id === values.processingJobId) : undefined;
                const nextOrchestrationTask = values.orchestrationTaskId ? orchestrationTasks.find((task) => task.id === values.orchestrationTaskId) : undefined;
                const nextNodeName = values.nodeName || item.data.nodeName;
                const nextConfig = { ...item.data.nodeConfig };

                if ("databaseName" in values) nextConfig.databaseName = values.databaseName;
                if ("datasourceId" in values) nextConfig.datasourceId = values.datasourceId;
                if ("resultLimit" in values) nextConfig.resultLimit = values.resultLimit;
                if ("description" in values) nextConfig.description = values.description;
                if ("sqlText" in values) nextConfig.sqlText = values.sqlText;
                if ("operator" in values) nextConfig.operator = values.operator;
                if ("expectedValue" in values) nextConfig.expectedValue = values.expectedValue;
                if ("emptyAs" in values) nextConfig.emptyAs = values.emptyAs;

                return {
                  ...item,
                  data: {
                    ...item.data,
                    label: nextNodeName,
                    nodeName: nextNodeName,
                    scriptId: item.data.nodeType === "script" ? (values.scriptId ?? item.data.scriptId ?? null) : null,
                    scriptName: item.data.nodeType === "script" ? (nextScript?.name || item.data.scriptName || "") : item.data.scriptName,
                    processingJobId: item.data.nodeType === "processing" ? (values.processingJobId ?? item.data.processingJobId ?? null) : null,
                    processingJobName: item.data.nodeType === "processing" ? (nextProcessingJob?.name || item.data.processingJobName || "") : item.data.processingJobName,
                    orchestrationTaskId: item.data.nodeType === "operator_task" ? (values.orchestrationTaskId ?? item.data.orchestrationTaskId ?? null) : null,
                    orchestrationTaskName: item.data.nodeType === "operator_task" ? (nextOrchestrationTask?.name || item.data.orchestrationTaskName || "") : item.data.orchestrationTaskName,
                    retryTimes: values.retryTimes ?? item.data.retryTimes ?? 0,
                    retryIntervalSec: values.retryIntervalSec ?? item.data.retryIntervalSec ?? 5,
                    timeoutSec: values.timeoutSec ?? item.data.timeoutSec ?? 300,
                    triggerRule: values.triggerRule || item.data.triggerRule || "all_success",
                    nodeConfig: nextConfig,
                  },
                };
              });
            }}
          >
            <Form.Item label="节点名称" name="nodeName" rules={[{ required: true, message: "请输入节点名称" }]}>
              <Input />
            </Form.Item>
            {selectedNode.data.nodeType === "script" ? (
              <>
                <Form.Item label="绑定SQL任务" name="scriptId" rules={[{ required: true, message: "请选择SQL任务" }]}>
                  <Select
                    showSearch
                    placeholder="选择SQL任务"
                    optionFilterProp="label"
                    options={scripts.map((item) => ({ value: item.id, label: `${item.name} / ${item.datasourceName}` }))}
                  />
                </Form.Item>
                <Form.Item label="运行库" name="databaseName">
                  <Input />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="结果行数" name="resultLimit">
                      <InputNumber min={1} max={1000} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="超时秒数" name="timeoutSec">
                      <InputNumber min={1} max={7200} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            ) : null}

            {selectedNode.data.nodeType === "processing" ? (
              <>
                <Form.Item label="绑定数据处理任务" name="processingJobId" rules={[{ required: true, message: "请选择数据处理任务" }]}>
                  <Select
                    showSearch
                    placeholder="选择数据处理任务"
                    optionFilterProp="label"
                    options={processingJobs.map((item) => ({ value: item.id, label: `${item.name} / ${item.datasourceName || item.tableName}` }))}
                  />
                </Form.Item>
                <Form.Item label="超时秒数" name="timeoutSec">
                  <InputNumber min={1} max={7200} style={{ width: "100%" }} />
                </Form.Item>
              </>
            ) : null}

            {selectedNode.data.nodeType === "operator_task" ? (
              <>
                <Form.Item label="绑定算子任务" name="orchestrationTaskId" rules={[{ required: true, message: "请选择算子任务" }]}>
                  <Select
                    showSearch
                    placeholder="选择算子任务"
                    optionFilterProp="label"
                    options={orchestrationTasks.map((item) => ({ value: item.id, label: `${item.name} / ${item.datasourceName || "算子平台"}` }))}
                  />
                </Form.Item>
                <Form.Item label="超时秒数" name="timeoutSec">
                  <InputNumber min={1} max={7200} style={{ width: "100%" }} />
                </Form.Item>
              </>
            ) : null}

            {selectedNode.data.nodeType === "branch" ? (
              <>
                <Form.Item label="数据源" name="datasourceId" rules={[{ required: true, message: "请选择数据源" }]}>
                  <Select
                    showSearch
                    placeholder="选择数据源"
                    optionFilterProp="label"
                    options={datasources.map((item) => ({ value: item.id, label: `${item.name} / ${item.type}` }))}
                  />
                </Form.Item>
                <Form.Item label="运行库" name="databaseName">
                  <Input />
                </Form.Item>
                <Form.Item label="判断 SQL" name="sqlText" rules={[{ required: true, message: "请输入判断 SQL" }]}>
                  <Input.TextArea rows={8} placeholder="SELECT COUNT(1) FROM ... WHERE ..." />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="比较符" name="operator" rules={[{ required: true, message: "请选择比较符" }]}>
                      <Select
                        options={[
                          { value: "eq", label: "等于" },
                          { value: "ne", label: "不等于" },
                          { value: "gt", label: "大于" },
                          { value: "gte", label: "大于等于" },
                          { value: "lt", label: "小于" },
                          { value: "lte", label: "小于等于" },
                          { value: "contains", label: "包含" },
                          { value: "in", label: "属于" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="目标值" name="expectedValue">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="查询行数" name="resultLimit">
                      <InputNumber min={1} max={20} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="超时秒数" name="timeoutSec">
                      <InputNumber min={1} max={7200} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="空结果按 true 处理" name="emptyAs" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            ) : null}

            {["script", "processing", "operator_task", "branch"].includes(selectedNode.data.nodeType) ? (
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="节点重试次数" name="retryTimes">
                    <InputNumber min={0} max={10} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="重试间隔(秒)" name="retryIntervalSec">
                    <InputNumber min={0} max={3600} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            ) : null}

            {selectedNode.data.nodeType === "join" ? (
              <Form.Item label="汇聚触发规则" name="triggerRule">
                <Select
                  options={[
                    { value: "all_success", label: "有效上游全部成功" },
                    { value: "all_done", label: "有效上游全部完成" },
                  ]}
                />
              </Form.Item>
            ) : null}

            {["start", "end", "parallel", "join"].includes(selectedNode.data.nodeType) ? (
              <Form.Item label="节点说明" name="description">
                <Input.TextArea rows={4} />
              </Form.Item>
            ) : null}

            <Button danger block icon={<DeleteOutlined />} onClick={() => deleteNode(selectedNode.id)}>
              删除节点
            </Button>
          </Form>
        ) : <Empty description="点击节点后进行配置" />}
      </Drawer>

      <Modal open={scheduleModalOpen} title="调度配置" onOk={() => void handleSaveSchedule()} onCancel={() => setScheduleModalOpen(false)}>
        <Form layout="vertical" form={scheduleForm}>
          <Form.Item name="scheduleType" label="调度方式" rules={[{ required: true, message: "请选择调度方式" }]}>
            <Select
              options={[
                { value: "manual", label: "手动触发" },
                { value: "interval", label: "固定间隔" },
                { value: "daily", label: "每天执行" },
                { value: "weekly", label: "每周执行" },
                { value: "monthly", label: "每月执行" },
                { value: "custom", label: "自定义 Cron" },
              ]}
            />
          </Form.Item>
          {scheduleType === "interval" ? (
            <Form.Item label="执行间隔" required>
              <Space.Compact block>
                <Form.Item name="intervalValue" noStyle rules={[{ required: true, message: "请输入间隔时间" }]}>
                  <InputNumber min={1} max={getWorkflowIntervalMax(intervalUnit)} style={{ width: "70%" }} />
                </Form.Item>
                <Form.Item name="intervalUnit" noStyle rules={[{ required: true, message: "请选择间隔单位" }]}>
                  <Select options={workflowIntervalUnitOptions} style={{ width: "30%" }} />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          ) : null}
          {scheduleType === "daily" || scheduleType === "weekly" || scheduleType === "monthly" ? (
            <Form.Item name="runTime" label="执行时间" rules={[{ required: true, message: "请选择执行时间" }]}>
              <Input type="time" />
            </Form.Item>
          ) : null}
          {scheduleType === "weekly" ? (
            <Form.Item name="weekDays" label="执行日" rules={[{ required: true, message: "请选择执行日" }]}>
              <Select mode="multiple" options={workflowWeekDayOptions} placeholder="选择每周执行日" />
            </Form.Item>
          ) : null}
          {scheduleType === "monthly" ? (
            <Form.Item name="monthDay" label="每月日期" rules={[{ required: true, message: "请输入每月日期" }]}>
              <InputNumber min={1} max={31} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          {scheduleType === "custom" ? (
            <Form.Item name="cronExpr" label="Cron 表达式" rules={[{ required: true, message: "请输入 Cron 表达式" }]}>
              <Input placeholder="例如：*/5 * * * *" />
            </Form.Item>
          ) : null}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="retryTimes" label="失败重试次数">
                <InputNumber min={0} max={10} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="timeoutSec" label="运行超时(秒)">
                <InputNumber min={1} max={7200} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          {scheduleType !== "manual" ? (
            <Form.Item name="isPaused" label="暂停调度" valuePropName="checked">
              <Switch />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </ReactFlowProvider>
  );
}


