import type { DataNode } from "antd/es/tree";
import { Position, type Edge, type Node } from "reactflow";
import { inferDatasourceDialect } from "../../utils/datasource";

export type WorkflowNodeType = "start" | "end" | "script" | "processing" | "operator_task" | "branch" | "parallel" | "join";
export type WorkflowNodeStatus = "idle" | "running" | "success" | "failed" | "skipped";

export type WorkflowNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
  scriptId?: number | null;
  scriptName?: string;
  processingJobId?: number | null;
  processingJobName?: string;
  orchestrationTaskId?: number | null;
  orchestrationTaskName?: string;
  retryTimes?: number | null;
  retryIntervalSec?: number;
  timeoutSec?: number | null;
  triggerRule?: "all_success" | "all_done";
  nodeName: string;
  nodeConfig: Record<string, unknown>;
  status?: WorkflowNodeStatus;
};

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function formatWorkflowStatus(value?: string | null) {
  const labels: Record<string, string> = {
    pending: "等待运行",
    running: "运行中",
    success: "成功",
    failed: "失败",
    skipped: "已跳过",
    cancelled: "已取消",
    canceled: "已取消",
  };
  return labels[String(value || "").toLowerCase()] || "未知状态";
}

export function formatWorkflowTriggerType(value?: string | null) {
  const labels: Record<string, string> = {
    manual: "手动触发",
    cron: "周期调度",
    workflow: "工作流触发",
    recovery: "服务恢复",
  };
  return labels[String(value || "").toLowerCase()] || "其他触发";
}

export function formatWorkflowLogType(value?: string | null) {
  const labels: Record<string, string> = {
    info: "运行信息",
    sql: "SQL 语句",
    success: "执行成功",
    error: "执行错误",
    retry: "节点重试",
    branch: "条件判断",
    route: "分支路由",
    skip: "节点跳过",
  };
  return labels[String(value || "").toLowerCase()] || "运行日志";
}

export function buildFolderTree(folders: Array<{ id: number; name: string; parentId?: number | null }>): DataNode[] {
  const map = new Map<number, DataNode & { children: DataNode[] }>();
  const roots: Array<DataNode & { children: DataNode[] }> = [];

  folders.forEach((folder) => {
    map.set(folder.id, { key: String(folder.id), title: folder.name, children: [] });
  });

  folders.forEach((folder) => {
    const current = map.get(folder.id)!;
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(current);
    } else {
      roots.push(current);
    }
  });

  return roots;
}

export function detectSqlLanguage(type?: string) {
  switch (inferDatasourceDialect(type)) {
    case "mysql":
      return "mysql";
    case "postgresql":
      return "postgresql";
    case "hive":
      return "spark";
    default:
      return "sql";
  }
}

export function toFlowNode(node: any): Node<WorkflowNodeData> {
  const nodeType = (node.nodeType || "script") as WorkflowNodeType;
  return {
    id: node.nodeKey,
    position: { x: node.positionX, y: node.positionY },
    data: {
      label: node.nodeName,
      nodeType,
      scriptId: node.scriptId ?? null,
      scriptName: node.scriptName || "",
      processingJobId: node.processingJobId ?? null,
      processingJobName: node.processingJobName || "",
      orchestrationTaskId: node.orchestrationTaskId ?? null,
      orchestrationTaskName: node.orchestrationTaskName || "",
      retryTimes: node.retryTimes ?? null,
      retryIntervalSec: node.retryIntervalSec ?? 5,
      timeoutSec: node.timeoutSec ?? null,
      triggerRule: node.triggerRule || "all_success",
      nodeName: node.nodeName,
      nodeConfig: node.nodeConfig || {},
      status: "idle",
    },
    style: {
      width: node.width || 240,
      minHeight: node.height || 88,
      borderRadius: nodeType === "branch" ? 18 : 12,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "workflowNode",
  };
}

export function toFlowEdge(edge: any): Edge {
  return {
    id: `${edge.sourceNodeKey}-${edge.targetNodeKey}`,
    source: edge.sourceNodeKey,
    target: edge.targetNodeKey,
    type: "smoothstep",
    label: edge.edgeLabel && edge.edgeLabel !== "default" ? String(edge.edgeLabel).toUpperCase() : undefined,
    data: {
      edgeLabel: edge.edgeLabel || "default",
    },
  };
}
