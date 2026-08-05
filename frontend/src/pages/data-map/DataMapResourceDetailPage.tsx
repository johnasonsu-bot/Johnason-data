import "reactflow/dist/style.css";

import {
  ArrowLeftOutlined,
  BranchesOutlined,
  EditOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Popover,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, Position, ReactFlowProvider, applyNodeChanges, type Edge, type Node, type NodeChange } from "reactflow";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  analyzeDataMapResourceContentProfile,
  analyzeDataMapResourceFieldProfile,
  fetchDataMapCatalogTree,
  fetchDataMapResourceDetail,
  fetchDataMapResourceLineageGraph,
  fetchDataMapResourceSample,
  updateDataMapResourceContent,
  updateDataMapResourceField,
  type DataMapCatalog,
  type DataMapLineageGraph,
  type DataMapResourceDetail,
  type DataMapResourceField,
  type DataMapResourceFieldProfile,
} from "../../services/dataMap";
import {
  fetchStandardDataElementDetail,
  fetchStandardDataElements,
  fetchValueDomainDetail,
  type StandardDataElement,
  type ValueDomain,
  type ValueDomainItem,
} from "../../services/dataStandards";
import type { DataSourceSampleRow } from "../../types/api";

type FieldRow = DataMapResourceField & {
  profile?: DataMapResourceFieldProfile;
};

type SampleRow = DataSourceSampleRow & {
  __rowKey: string;
};

type LineageDirection = "both" | "upstream" | "downstream";
type LineageGraphNode = DataMapLineageGraph["nodes"][number];
type LineageGraphEdge = DataMapLineageGraph["edges"][number];
type StandardElementOption = { value: number; label: string; element: Partial<StandardDataElement> };

const PREVIEW_COLUMN_STORAGE_KEY_PREFIX = "data_map_resource_preview_columns_v1";
const LINEAGE_NODE_WIDTH = 260;
const LINEAGE_NODE_CONTENT_WIDTH = LINEAGE_NODE_WIDTH - 28;

const categoryOptions = [
  { value: "business", label: "业务表" },
  { value: "dictionary", label: "字典表" },
  { value: "relation", label: "关联表" },
  { value: "log", label: "日志表" },
  { value: "temporary", label: "临时表" },
  { value: "low_value", label: "低价值表" },
];

const statusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
];

const featureTagOptions = [
  { value: "primary_key", label: "主键", color: "blue" },
  { value: "foreign_key", label: "外键", color: "geekblue" },
  { value: "system_time", label: "系统时间", color: "purple" },
  { value: "business_time", label: "业务时间", color: "green" },
  { value: "dictionary_value", label: "字典值", color: "orange" },
];
const featureTagMeta = Object.fromEntries(featureTagOptions.map((item) => [item.value, item]));
const mappingStatusMeta: Record<string, { label: string; color: string }> = {
  approved: { label: "人工确认", color: "green" },
  suggested: { label: "AI推荐", color: "blue" },
};

function toStandardElementOption(element: Partial<StandardDataElement>): StandardElementOption | null {
  if (!element.id) return null;
  const code = element.elementCode || "";
  const name = element.elementNameCn || element.elementNameEn || "";
  return {
    value: Number(element.id),
    label: `${code}${name ? ` / ${name}` : ""}`,
    element,
  };
}

function mergeStandardElementOptions(options: StandardElementOption[], additions: Array<StandardElementOption | null>) {
  const map = new Map(options.map((item) => [item.value, item]));
  additions.filter(Boolean).forEach((item) => {
    if (item) map.set(item.value, item);
  });
  return Array.from(map.values());
}

function hasDiscreteValueDomainItems(domainType?: string) {
  return domainType === "enumeration" || domainType === "reference";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function percent(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function textToTags(value?: unknown) {
  return String(value || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsToText(tags?: string[]) {
  return (Array.isArray(tags) ? tags : []).join(",");
}

function buildCatalogPathMap(catalogs: DataMapCatalog[]) {
  const pathMap = new Map<number, string>();
  const visit = (nodes: DataMapCatalog[], parentPath = "") => {
    nodes.forEach((node) => {
      const currentPath = parentPath ? `${parentPath} / ${node.catalogName}` : node.catalogName;
      pathMap.set(node.id, currentPath);
      visit(node.children || [], currentPath);
    });
  };
  visit(catalogs);
  return pathMap;
}

function getArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function isNumericText(value: string) {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}

function isDateLikeText(value: string) {
  return /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(value);
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatParsedDate(date: Date, dateOnly = false) {
  const dateText = `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
  if (dateOnly) {
    return dateText;
  }
  return `${dateText} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`;
}

function formatTemporalValue(value: unknown, columnType?: string) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z?$/);
  if (!isoMatch) {
    return text;
  }

  const normalizedType = String(columnType || "").toLowerCase();
  if (normalizedType === "date") {
    return isoMatch[1];
  }

  return `${isoMatch[1]} ${isoMatch[2]}`;
}

function formatTaggedTimeValue(value: unknown, columnType?: string) {
  const text = formatTemporalValue(value, columnType);
  if (!text) {
    return "";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return formatParsedDate(parsed, String(columnType || "").toLowerCase() === "date");
}

function formatSampleValues(values?: unknown[], columnType?: string) {
  return (values || [])
    .slice(0, 3)
    .map((item) => formatTemporalValue(item, columnType))
    .filter(Boolean);
}

function compareCellText(a: unknown, b: unknown, columnType?: string) {
  const left = formatTemporalValue(a, columnType);
  const right = formatTemporalValue(b, columnType);

  if (isNumericText(left) && isNumericText(right)) {
    return Number(left) - Number(right);
  }

  if (isDateLikeText(left) && isDateLikeText(right)) {
    return left.localeCompare(right);
  }

  return left.localeCompare(right, "zh-CN");
}

function buildFilterOptions(values: unknown[], limit = 12) {
  const seen = new Set<string>();
  const options: Array<{ text: string; value: string }> = [];

  values.forEach((value) => {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text) || options.length >= limit) {
      return;
    }
    seen.add(text);
    options.push({ text, value: text });
  });

  return options;
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveSearchInput(input: string) {
  const text = String(input || "").trim();
  if (!text) {
    return { text, exact: false };
  }

  if (text.startsWith("=") || text.startsWith("＝")) {
    return { text: text.slice(1).trim(), exact: true };
  }

  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'")) || (text.startsWith("“") && text.endsWith("”"))) {
    return { text: text.slice(1, -1).trim(), exact: true };
  }

  return { text, exact: false };
}

function matchFilterOption(input: string, option?: { text?: React.ReactNode; value?: boolean | React.Key }) {
  const query = resolveSearchInput(input);
  if (!query.text) {
    return true;
  }

  const target = normalizeSearchText(option?.text ?? option?.value);
  const keyword = normalizeSearchText(query.text);
  return query.exact ? target === keyword : target.includes(keyword);
}

function translateLineageType(value?: string) {
  const typeLabelMap: Record<string, string> = {
    ingestion: "数据接入",
    manual: "手工维护",
    etl: "ETL任务",
    sync: "同步任务",
  };
  return typeLabelMap[String(value || "").toLowerCase()] || value || "血缘关系";
}

function getLineageTypeColor(value?: string) {
  const colorMap: Record<string, string> = {
    ingestion: "processing",
    manual: "default",
    etl: "purple",
    sync: "green",
  };
  return colorMap[String(value || "").toLowerCase()] || "blue";
}

function translateRelationSource(value?: string) {
  const sourceLabelMap: Record<string, string> = {
    ingestion_task: "接入任务",
    manual: "手工维护",
    etl_job: "ETL任务",
    sync_job: "同步任务",
  };
  return sourceLabelMap[String(value || "").toLowerCase()] || value || "-";
}

function formatLineageConfidence(value?: string) {
  const confidenceLabelMap: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };
  return confidenceLabelMap[String(value || "").toLowerCase()] || value || "-";
}

function formatLineageEdgeLabel(edge: DataMapLineageGraph["edges"][number]) {
  const lineageType = edge.data?.lineageType;
  const relationSourceId = edge.data?.relationSourceId;
  if (lineageType) {
    return relationSourceId ? `${translateLineageType(lineageType)} #${relationSourceId}` : translateLineageType(lineageType);
  }

  return String(edge.label || "").replace(/\bingestion\b/gi, "数据接入");
}

function getLineageNodeSearchText(node?: LineageGraphNode) {
  if (!node) return "";
  const data = node.data || {};
  return normalizeSearchText([
    node.id,
    node.label,
    node.type,
    data.resourceCode,
    data.sourceName,
    data.systemName,
    data.dataSourceId,
  ].join(" "));
}

function getLineageEdgeSearchText(edge: LineageGraphEdge, nodeMap: Map<string, LineageGraphNode>) {
  const data = edge.data;
  return normalizeSearchText([
    edge.id,
    edge.label,
    getLineageNodeSearchText(nodeMap.get(edge.source)),
    getLineageNodeSearchText(nodeMap.get(edge.target)),
    data?.sourceTableName,
    data?.targetTableName,
    data?.sourceResourceCode,
    data?.targetResourceCode,
    data?.sourceName,
    data?.targetName,
    data?.lineageType,
    data?.relationSource,
    data?.relationSourceId,
    data?.confidence,
  ].join(" "));
}

function filterLineageGraph(graph: DataMapLineageGraph, currentNodeId: string, lineageTypeFilter: string, keyword: string): DataMapLineageGraph {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const normalizedKeyword = normalizeSearchText(keyword);
  const normalizedType = lineageTypeFilter === "all" ? "" : lineageTypeFilter;
  const edges = graph.edges.filter((edge) => {
    const edgeType = String(edge.data?.lineageType || edge.label || "");
    const typeMatched = !normalizedType || edgeType === normalizedType;
    const keywordMatched = !normalizedKeyword || getLineageEdgeSearchText(edge, nodeMap).includes(normalizedKeyword);
    return typeMatched && keywordMatched;
  });
  const includedNodeIds = new Set<string>([currentNodeId]);
  edges.forEach((edge) => {
    includedNodeIds.add(edge.source);
    includedNodeIds.add(edge.target);
  });

  return {
    nodes: graph.nodes.filter((node) => includedNodeIds.has(node.id)),
    edges,
  };
}

function buildLineageStats(graph: DataMapLineageGraph, currentNodeId: string) {
  const upstreamIds = new Set(graph.edges.filter((edge) => edge.target === currentNodeId).map((edge) => edge.source));
  const downstreamIds = new Set(graph.edges.filter((edge) => edge.source === currentNodeId).map((edge) => edge.target));
  return {
    upstreamCount: upstreamIds.size,
    downstreamCount: downstreamIds.size,
    edgeCount: graph.edges.length,
    externalCount: graph.nodes.filter((node) => node.type === "external").length,
  };
}

function getCandidateTimeValues(record: FieldRow, sampleRows: DataSourceSampleRow[], timeRange?: DataMapResourceDetail["profile"]["timeRange"]) {
  return [
    timeRange?.[record.columnName]?.max,
    ...(record.profile?.sampleValues || []),
    ...sampleRows.map((row) => row?.[record.columnName]),
  ].filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

function getLatestTaggedTimeValue(
  fieldRows: FieldRow[],
  sampleRows: DataSourceSampleRow[],
  timeRange: DataMapResourceDetail["profile"]["timeRange"] | undefined,
  featureTag: "business_time" | "system_time"
) {
  let latestValue: unknown;
  let latestField: FieldRow | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const field of fieldRows) {
    if (!(field.profile?.featureTags || []).includes(featureTag)) {
      continue;
    }

    for (const value of getCandidateTimeValues(field, sampleRows, timeRange)) {
      const time = new Date(String(value)).getTime();
      if (Number.isNaN(time)) {
        continue;
      }
      if (time > latestTime) {
        latestValue = value;
        latestField = field;
        latestTime = time;
      }
    }
  }

  if (!latestField) {
    return { value: "-", fieldName: "" };
  }

  return {
    value: formatTaggedTimeValue(latestValue, latestField.columnType),
    fieldName: latestField.columnName,
  };
}

function loadStoredPreviewColumnKeys(resourceId: number) {
  if (typeof window === "undefined" || !resourceId) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(`${PREVIEW_COLUMN_STORAGE_KEY_PREFIX}:${resourceId}`);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch (_error) {
    return null;
  }
}

function buildFlowElements(
  graph: DataMapLineageGraph,
  currentNodeId: string,
  selectedNodeId?: string | null,
  nodePositions: Record<string, Node["position"]> = {}
) {
  const upstreamIds = graph.edges.filter((edge) => edge.target === currentNodeId).map((edge) => edge.source);
  const downstreamIds = graph.edges.filter((edge) => edge.source === currentNodeId).map((edge) => edge.target);
  const upstreamSet = new Set(upstreamIds);
  const downstreamSet = new Set(downstreamIds);
  const positionCursor = { upstream: 0, downstream: 0, other: 0 };

  const nodes: Node[] = graph.nodes.map((item) => {
    const role = item.id === currentNodeId ? "current" : upstreamSet.has(item.id) ? "upstream" : downstreamSet.has(item.id) ? "downstream" : "other";
    const index = role === "upstream" ? positionCursor.upstream++ : role === "downstream" ? positionCursor.downstream++ : positionCursor.other++;
    const x = role === "upstream" ? 0 : role === "current" ? 380 : role === "downstream" ? 760 : 380;
    const y = role === "current" ? 160 : 80 + index * 120;
    const isExternal = item.type === "external";
    const isSelected = item.id === selectedNodeId;
    const nodeMeta = String(item.data?.resourceCode || item.data?.sourceName || "");
    const position = nodePositions[item.id] || { x, y };
    return {
      id: item.id,
      position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div style={{ width: LINEAGE_NODE_CONTENT_WIDTH, maxWidth: "100%", overflow: "hidden", textAlign: "center" }}>
            <Typography.Text strong ellipsis={{ tooltip: item.label }} style={{ display: "block", width: "100%" }}>
              {item.label}
            </Typography.Text>
            <div style={{ marginTop: 4 }}>
              <Tag color={role === "current" ? "blue" : isExternal ? "orange" : role === "upstream" ? "cyan" : "green"}>
                {role === "current" ? "当前资源" : role === "upstream" ? "上游" : role === "downstream" ? "下游" : "关联"}
              </Tag>
              {isExternal ? <Tag>未注册</Tag> : null}
            </div>
            <Typography.Text type="secondary" ellipsis={{ tooltip: nodeMeta }} style={{ display: "block", width: "100%", marginTop: 4, fontSize: 12 }}>
              {nodeMeta}
            </Typography.Text>
          </div>
        ),
      },
      style: {
        width: LINEAGE_NODE_WIDTH,
        boxSizing: "border-box",
        border: isSelected ? "2px solid #fa8c16" : role === "current" ? "1px solid #1677ff" : "1px solid #d9e2ec",
        borderRadius: 12,
        padding: 10,
        background: role === "current" ? "#eef6ff" : isExternal ? "#fff7e6" : "#ffffff",
        boxShadow: isSelected ? "0 12px 28px rgba(250, 140, 22, 0.18)" : "0 8px 24px rgba(15, 23, 42, 0.08)",
        cursor: "grab",
        overflow: "hidden",
      },
    };
  });

  const edges: Edge[] = graph.edges.map((item) => {
    const isRelatedToSelected = selectedNodeId && (item.source === selectedNodeId || item.target === selectedNodeId);
    return {
      id: item.id,
      source: item.source,
      target: item.target,
      label: formatLineageEdgeLabel(item),
      type: "smoothstep",
      animated: Boolean(isRelatedToSelected || item.source === currentNodeId || item.target === currentNodeId),
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: isRelatedToSelected ? "#fa8c16" : "#1677ff", strokeWidth: isRelatedToSelected ? 2.4 : 1.6 },
    };
  });

  return { nodes, edges };
}

export function DataMapResourceDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const resourceId = Number(params.id || 0);
  const [form] = Form.useForm();
  const [fieldForm] = Form.useForm();
  const [detail, setDetail] = useState<DataMapResourceDetail | null>(null);
  const [catalogTree, setCatalogTree] = useState<DataMapCatalog[]>([]);
  const [editingField, setEditingField] = useState<FieldRow | null>(null);
  const [standardElementOptions, setStandardElementOptions] = useState<StandardElementOption[]>([]);
  const [standardElementLoading, setStandardElementLoading] = useState(false);
  const [standardElementDetail, setStandardElementDetail] = useState<StandardDataElement | null>(null);
  const [valueDomainDetail, setValueDomainDetail] = useState<ValueDomain | null>(null);
  const [sampleRows, setSampleRows] = useState<DataSourceSampleRow[]>([]);
  const [lineageGraph, setLineageGraph] = useState<DataMapLineageGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contentAnalyzing, setContentAnalyzing] = useState(false);
  const [fieldAnalyzing, setFieldAnalyzing] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState("profile");
  const [sampleLimit, setSampleLimit] = useState(100);
  const [lineageDirection, setLineageDirection] = useState<LineageDirection>("both");
  const [lineageLoading, setLineageLoading] = useState(false);
  const [lineageKeyword, setLineageKeyword] = useState("");
  const [lineageTypeFilter, setLineageTypeFilter] = useState("all");
  const [selectedLineageNodeId, setSelectedLineageNodeId] = useState<string | null>(null);
  const [lineageFlowNodes, setLineageFlowNodes] = useState<Node[]>([]);
  const [lineageFlowEdges, setLineageFlowEdges] = useState<Edge[]>([]);
  const [visiblePreviewColumnKeys, setVisiblePreviewColumnKeys] = useState<string[]>([]);
  const [previewColumnsInitialized, setPreviewColumnsInitialized] = useState(false);
  const [previewColumnsDirty, setPreviewColumnsDirty] = useState(false);
  const previewColumnsInitializedRef = useRef(false);
  const activePreviewResourceRef = useRef<number | null>(null);

  async function loadData() {
    if (!token || !resourceId) return;
    setLoading(true);
    try {
      const [detailRes, sampleRes, catalogTreeRes] = await Promise.all([
        fetchDataMapResourceDetail(token, resourceId),
        fetchDataMapResourceSample(token, resourceId, 20),
        fetchDataMapCatalogTree(token),
      ]);
      setDetail(detailRes.data);
      setSampleRows(sampleRes.data || []);
      setCatalogTree(catalogTreeRes.data || []);
    } catch (error) {
      message.error(`加载资源详情失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadLineageGraph(direction: LineageDirection = lineageDirection) {
    if (!token || !resourceId) return;
    setLineageLoading(true);
    try {
      const graphRes = await fetchDataMapResourceLineageGraph(token, resourceId, direction);
      setLineageGraph(graphRes.data || { nodes: [], edges: [] });
      setSelectedLineageNodeId(null);
    } catch (error) {
      message.error(`加载数据血缘失败：${getErrorMessage(error)}`);
    } finally {
      setLineageLoading(false);
    }
  }

  function handleLineageNodesChange(changes: NodeChange[]) {
    setLineageFlowNodes((nodes) => applyNodeChanges(changes, nodes));
  }

  useEffect(() => {
    void loadData();
  }, [token, resourceId]);

  useEffect(() => {
    void loadLineageGraph(lineageDirection);
  }, [token, resourceId, lineageDirection]);

  useEffect(() => {
    previewColumnsInitializedRef.current = false;
    activePreviewResourceRef.current = null;
    setPreviewColumnsInitialized(false);
    setPreviewColumnsDirty(false);
    setVisiblePreviewColumnKeys([]);
  }, [resourceId]);

  useEffect(() => {
    setLineageKeyword("");
    setLineageTypeFilter("all");
    setLineageDirection("both");
    setSelectedLineageNodeId(null);
    setLineageFlowNodes([]);
    setLineageFlowEdges([]);
  }, [resourceId]);

  useEffect(() => {
    if (!detail) return;
    form.setFieldsValue({
      ...detail.content,
      usageScenariosText: tagsToText(detail.content?.usageScenarios),
    });
  }, [detail, form]);

  async function saveContent() {
    if (!token || !detail) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await updateDataMapResourceContent(token, detail.id, {
        ...values,
        dataOwner: detail.content?.dataOwner,
        techOwner: detail.content?.techOwner,
        serviceSla: detail.content?.serviceSla,
        usageScenarios: textToTags(values.usageScenariosText),
      });
      message.success("扩展信息已保存");
      await loadData();
    } catch (error) {
      message.error(`保存扩展信息失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function analyzeContentProfile() {
    if (!token || !detail) return;
    setContentAnalyzing(true);
    try {
      const response = await analyzeDataMapResourceContentProfile(token, detail.id, { sampleLimit });
      setDetail({ ...detail, profile: response.data.profile, fieldProfiles: response.data.fieldProfiles });
      message.success("内容画像分析已更新");
      await loadData();
    } catch (error) {
      message.error(`内容画像分析失败：${getErrorMessage(error)}`);
    } finally {
      setContentAnalyzing(false);
    }
  }

  async function analyzeFieldProfile() {
    if (!token || !detail) return;
    setFieldAnalyzing(true);
    try {
      const response = await analyzeDataMapResourceFieldProfile(token, detail.id, { sampleLimit });
      setDetail({ ...detail, profile: response.data.profile, fieldProfiles: response.data.fieldProfiles });
      message.success("字段信息分析已更新");
      await loadData();
    } catch (error) {
      message.error(`字段信息分析失败：${getErrorMessage(error)}`);
    } finally {
      setFieldAnalyzing(false);
    }
  }

  async function searchStandardElements(keyword = "") {
    if (!token) return;
    setStandardElementLoading(true);
    try {
      const response = await fetchStandardDataElements(token, keyword ? { keyword } : undefined);
      const options = (response.data || [])
        .slice(0, 80)
        .map(toStandardElementOption)
        .filter(Boolean) as StandardElementOption[];
      setStandardElementOptions((current) => mergeStandardElementOptions(options, current.filter((item) => item.value === fieldForm.getFieldValue("standardElementId"))));
    } catch (error) {
      message.error(`加载标准数据元失败：${getErrorMessage(error)}`);
    } finally {
      setStandardElementLoading(false);
    }
  }

  async function openStandardElementDetail(elementId?: number | null) {
    if (!token || !elementId) return;
    try {
      const response = await fetchStandardDataElementDetail(token, elementId);
      setStandardElementDetail(response.data);
    } catch (error) {
      message.error(`加载数据元明细失败：${getErrorMessage(error)}`);
    }
  }

  async function openValueDomainDetail(valueDomainId?: number | null) {
    if (!token || !valueDomainId) return;
    try {
      const response = await fetchValueDomainDetail(token, valueDomainId);
      setValueDomainDetail(response.data);
    } catch (error) {
      message.error(`加载值域明细失败：${getErrorMessage(error)}`);
    }
  }

  function openEditField(record: FieldRow) {
    setEditingField(record);
    const currentOption = toStandardElementOption({
      id: record.standardMapping?.elementId,
      elementCode: record.standardMapping?.elementCode,
      elementNameCn: record.standardMapping?.elementNameCn,
      elementNameEn: record.standardMapping?.elementNameEn,
    });
    setStandardElementOptions((current) => mergeStandardElementOptions(current, [currentOption]));
    fieldForm.setFieldsValue({
      columnComment: record.columnComment || "",
      aiBusinessName: record.profile?.aiBusinessName || record.businessName || "",
      aiBusinessMeaning: record.profile?.aiBusinessMeaning || "",
      featureTags: record.profile?.featureTags || [],
      standardElementId: record.standardMapping?.elementId || null,
    });
    void searchStandardElements(record.standardMapping?.elementCode || record.columnComment || record.columnName);
  }

  async function saveFieldMetadata() {
    if (!token || !detail || !editingField) return;
    const values = await fieldForm.validateFields();
    setSavingField(true);
    try {
      const response = await updateDataMapResourceField(token, detail.id, editingField.columnName, {
        columnComment: values.columnComment || "",
        aiBusinessName: values.aiBusinessName || "",
        aiBusinessMeaning: values.aiBusinessMeaning || "",
        semanticTags: editingField.profile?.semanticTags || editingField.semanticTags || [],
        featureTags: values.featureTags || [],
        standardElementId: values.standardElementId || null,
      });
      setDetail(response.data);
      setEditingField(null);
      message.success("字段信息已保存");
    } catch (error) {
      message.error(`保存字段信息失败：${getErrorMessage(error)}`);
    } finally {
      setSavingField(false);
    }
  }

  const fieldRows = useMemo<FieldRow[]>(() => {
    if (!detail) return [];
    const profileMap = new Map((detail.fieldProfiles || []).map((item) => [item.columnName, item]));
    return detail.fields.map((field) => ({ ...field, profile: profileMap.get(field.columnName) }));
  }, [detail]);

  const sampleColumns = useMemo(() => {
    const first = sampleRows[0] || {};
    const fieldMetaMap = new Map(fieldRows.map((item) => [item.columnName, { comment: item.columnComment || "", columnType: item.columnType || "" }]));
    return Object.keys(first).map((key) => ({
      title: (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.2 }}>
          <span style={{ fontWeight: 600, color: "#1f2937" }}>{key}</span>
          <span
            title={fieldMetaMap.get(key)?.comment || "-"}
            style={{
              color: "#8c8c8c",
              fontSize: 12,
              fontWeight: 400,
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fieldMetaMap.get(key)?.comment || "-"}
          </span>
        </div>
      ),
      dataIndex: key,
      key,
      width: 160,
      filters: buildFilterOptions(sampleRows.map((row) => formatTemporalValue(row[key], fieldMetaMap.get(key)?.columnType))),
      filterSearch: matchFilterOption,
      onFilter: (value: boolean | React.Key, record: SampleRow) => formatTemporalValue(record[key], fieldMetaMap.get(key)?.columnType) === String(value),
      sorter: (left: SampleRow, right: SampleRow) => compareCellText(left[key], right[key], fieldMetaMap.get(key)?.columnType),
      render: (value: unknown) => {
        const displayValue = formatTemporalValue(value, fieldMetaMap.get(key)?.columnType);
        return (
          <div
            title={displayValue}
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayValue}
          </div>
        );
      },
    }));
  }, [fieldRows, sampleRows]);

  const previewColumnOptions = useMemo(
    () =>
      sampleColumns.map((column) => {
        const key = String(column.key || column.dataIndex || "");
        const matchedField = fieldRows.find((item) => item.columnName === key);
        const comment = matchedField?.columnComment || "";
        return {
          label: comment ? `${key} / ${comment}` : key,
          value: key,
        };
      }),
    [fieldRows, sampleColumns]
  );

  useEffect(() => {
    const currentKeys = sampleColumns.map((column) => String(column.key || column.dataIndex || "")).filter(Boolean);
    if (currentKeys.length === 0) {
      previewColumnsInitializedRef.current = false;
      setPreviewColumnsInitialized(false);
      setVisiblePreviewColumnKeys([]);
      return;
    }

    if (!previewColumnsInitializedRef.current || activePreviewResourceRef.current !== resourceId) {
      previewColumnsInitializedRef.current = true;
      activePreviewResourceRef.current = resourceId;
      const storedKeys = loadStoredPreviewColumnKeys(resourceId);
      if (!storedKeys || storedKeys.length === 0) {
        setVisiblePreviewColumnKeys(currentKeys);
      } else {
        const storedKeySet = new Set(storedKeys);
        const matchedKeys = currentKeys.filter((key) => storedKeySet.has(key));
        if (matchedKeys.length === 0) {
          setVisiblePreviewColumnKeys(currentKeys);
        } else {
          const appendedKeys = currentKeys.filter((key) => !storedKeySet.has(key));
          setVisiblePreviewColumnKeys([...matchedKeys, ...appendedKeys]);
        }
      }
      setPreviewColumnsInitialized(true);
      return;
    }

    setVisiblePreviewColumnKeys((previous) => {
      const previousSet = new Set(previous);
      const keptKeys = currentKeys.filter((key) => previousSet.has(key));

      if (previous.length === 0) {
        return previous;
      }

      if (keptKeys.length === 0) {
        return currentKeys;
      }

      const appendedKeys = currentKeys.filter((key) => !previousSet.has(key));
      const mergedKeys = [...keptKeys, ...appendedKeys];

      if (mergedKeys.length === previous.length && mergedKeys.every((key, index) => key === previous[index])) {
        return previous;
      }

      return mergedKeys;
    });
    setPreviewColumnsInitialized(true);
  }, [resourceId, sampleColumns]);

  useEffect(() => {
    if (typeof window === "undefined" || !resourceId || !previewColumnsInitialized || !previewColumnsDirty || activePreviewResourceRef.current !== resourceId) {
      return;
    }

    window.localStorage.setItem(`${PREVIEW_COLUMN_STORAGE_KEY_PREFIX}:${resourceId}`, JSON.stringify(visiblePreviewColumnKeys));
  }, [previewColumnsDirty, previewColumnsInitialized, resourceId, visiblePreviewColumnKeys]);

  function commitPreviewColumnKeys(nextKeys: string[]) {
    setVisiblePreviewColumnKeys(nextKeys);
    setPreviewColumnsDirty(true);
  }

  const visibleSampleColumns = useMemo(
    () => {
      const visibleSet = new Set(visiblePreviewColumnKeys);
      return sampleColumns.filter((column) => visibleSet.has(String(column.key || column.dataIndex || "")));
    },
    [sampleColumns, visiblePreviewColumnKeys]
  );

  const allPreviewColumnsSelected = previewColumnOptions.length > 0 && visiblePreviewColumnKeys.length === previewColumnOptions.length;
  const previewColumnsIndeterminate =
    visiblePreviewColumnKeys.length > 0 && visiblePreviewColumnKeys.length < previewColumnOptions.length;

  const sampleTableRows = useMemo<SampleRow[]>(
    () => sampleRows.map((row, index) => ({ ...row, __rowKey: `${index}-${JSON.stringify(row).slice(0, 80)}` })),
    [sampleRows]
  );

  const latestBusinessTime = useMemo(
    () => getLatestTaggedTimeValue(fieldRows, sampleRows, detail?.profile?.timeRange, "business_time"),
    [detail?.profile?.timeRange, fieldRows, sampleRows]
  );

  const latestSystemTime = useMemo(
    () => getLatestTaggedTimeValue(fieldRows, sampleRows, detail?.profile?.timeRange, "system_time"),
    [detail?.profile?.timeRange, fieldRows, sampleRows]
  );
  const catalogPathMap = useMemo(
    () => buildCatalogPathMap(catalogTree),
    [catalogTree]
  );
  const catalogPathLabel = detail ? (catalogPathMap.get(detail.catalogId) || detail.catalogName || "-") : "-";
  const detailSummaryColumns = screens.xxl || screens.xl ? 5 : screens.lg ? 3 : screens.md ? 2 : 1;
  const detailSummaryItems = detail ? [
    {
      label: "资源分类",
      value: categoryOptions.find((item) => item.value === detail.resourceCategory)?.label || detail.resourceCategory || "-",
    },
    {
      label: "组织分类",
      value: catalogPathLabel,
      title: catalogPathLabel,
    },
    {
      label: "数据量",
      value: detail.rowCount ?? "-",
    },
    {
      label: "字段数",
      value: detail.columnCount,
    },
    {
      label: "状态",
      value: statusOptions.find((item) => item.value === detail.status)?.label || detail.status || "-",
    },
    {
      label: "部门",
      value: detail.departmentName || "-",
    },
    {
      label: "业务系统",
      value: detail.systemName || "-",
    },
    {
      label: "数据源",
      value: detail.sourceName || "-",
    },
    {
      label: "最近同步",
      value: formatDateTime(detail.lastSyncedAt),
    },
    {
      label: "最新业务时间",
      value: latestBusinessTime.value,
      title: `业务字段 ${latestBusinessTime.fieldName || "-"}: ${latestBusinessTime.value}`,
    },
    {
      label: "最新系统时间",
      value: latestSystemTime.value,
      title: `系统字段 ${latestSystemTime.fieldName || "-"}: ${latestSystemTime.value}`,
    },
    {
      label: "业务标签",
      value: (detail.businessTags || []).length > 0 ? (
        <Space wrap size={[6, 6]}>
          {(detail.businessTags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </Space>
      ) : "-",
    },
    {
      label: "表描述",
      value: detail.tableComment || "-",
      title: detail.tableComment || "-",
    },
  ] : [];

  const currentLineageNodeId = `resource:${resourceId}`;
  const lineageTypeOptions = useMemo(() => {
    const optionMap = new Map<string, { label: string; value: string }>();
    lineageGraph.edges.forEach((edge) => {
      const lineageType = String(edge.data?.lineageType || edge.label || "").trim();
      if (!lineageType || optionMap.has(lineageType)) {
        return;
      }
      optionMap.set(lineageType, { label: translateLineageType(lineageType), value: lineageType });
    });
    return [{ label: "全部关系", value: "all" }, ...Array.from(optionMap.values())];
  }, [lineageGraph.edges]);
  const filteredLineageGraph = useMemo(
    () => filterLineageGraph(lineageGraph, currentLineageNodeId, lineageTypeFilter, lineageKeyword),
    [currentLineageNodeId, lineageGraph, lineageKeyword, lineageTypeFilter]
  );
  const filteredLineageNodeMap = useMemo(
    () => new Map(filteredLineageGraph.nodes.map((node) => [node.id, node])),
    [filteredLineageGraph.nodes]
  );
  const lineageStats = useMemo(() => buildLineageStats(filteredLineageGraph, currentLineageNodeId), [currentLineageNodeId, filteredLineageGraph]);
  const selectedLineageNode = useMemo(
    () => selectedLineageNodeId ? filteredLineageNodeMap.get(selectedLineageNodeId) || null : null,
    [filteredLineageNodeMap, selectedLineageNodeId]
  );
  const selectedLineageEdges = useMemo(
    () => selectedLineageNode
      ? filteredLineageGraph.edges.filter((edge) => edge.source === selectedLineageNode.id || edge.target === selectedLineageNode.id)
      : [],
    [filteredLineageGraph.edges, selectedLineageNode]
  );
  const upstreamLineageNodes = useMemo(
    () =>
      filteredLineageGraph.edges
        .filter((edge) => edge.target === currentLineageNodeId)
        .map((edge) => filteredLineageNodeMap.get(edge.source))
        .filter((node): node is LineageGraphNode => Boolean(node)),
    [currentLineageNodeId, filteredLineageGraph.edges, filteredLineageNodeMap]
  );
  const downstreamLineageNodes = useMemo(
    () =>
      filteredLineageGraph.edges
        .filter((edge) => edge.source === currentLineageNodeId)
        .map((edge) => filteredLineageNodeMap.get(edge.target))
        .filter((node): node is LineageGraphNode => Boolean(node)),
    [currentLineageNodeId, filteredLineageGraph.edges, filteredLineageNodeMap]
  );
  useEffect(() => {
    setLineageFlowNodes((previousNodes) => {
      const previousPositions = Object.fromEntries(previousNodes.map((node) => [node.id, node.position])) as Record<string, Node["position"]>;
      return buildFlowElements(filteredLineageGraph, currentLineageNodeId, selectedLineageNode?.id, previousPositions).nodes;
    });
    setLineageFlowEdges(buildFlowElements(filteredLineageGraph, currentLineageNodeId, selectedLineageNode?.id).edges);
  }, [currentLineageNodeId, filteredLineageGraph, selectedLineageNode?.id]);

  const lineageEdgeColumns = useMemo<ColumnsType<LineageGraphEdge>>(() => [
    {
      title: "来源",
      dataIndex: "source",
      width: 220,
      render: (value: string) => {
        const node = filteredLineageNodeMap.get(value);
        return (
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setSelectedLineageNodeId(value)}>
            {node?.label || value}
          </Button>
        );
      },
    },
    {
      title: "目标",
      dataIndex: "target",
      width: 220,
      render: (value: string) => {
        const node = filteredLineageNodeMap.get(value);
        return (
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setSelectedLineageNodeId(value)}>
            {node?.label || value}
          </Button>
        );
      },
    },
    {
      title: "关系类型",
      width: 110,
      render: (_, record) => {
        const lineageType = record.data?.lineageType || record.label;
        return <Tag color={getLineageTypeColor(lineageType)}>{translateLineageType(lineageType)}</Tag>;
      },
    },
    {
      title: "关系来源",
      width: 120,
      render: (_, record) => translateRelationSource(record.data?.relationSource),
    },
    {
      title: "来源编号",
      width: 100,
      render: (_, record) => record.data?.relationSourceId ? `#${record.data.relationSourceId}` : "-",
    },
    {
      title: "置信度",
      width: 90,
      render: (_, record) => formatLineageConfidence(record.data?.confidence),
    },
  ], [filteredLineageNodeMap]);

  const featureTagFilters = useMemo(
    () => buildFilterOptions(fieldRows.flatMap((item) => (item.profile?.featureTags || []).map((tag) => featureTagMeta[tag]?.label || tag))),
    [fieldRows]
  );

  const sampleValueFilters = useMemo(
    () => buildFilterOptions(fieldRows.flatMap((item) => formatSampleValues(item.profile?.sampleValues, item.columnType))),
    [fieldRows]
  );

  const standardMappingFilters = useMemo(
    () => buildFilterOptions(fieldRows.map((item) => item.standardMapping?.elementCode || "未对标")),
    [fieldRows]
  );

  const fieldColumns = useMemo<ColumnsType<FieldRow>>(() => [
    {
      title: "字段名",
      dataIndex: "columnName",
      width: 150,
      fixed: "left",
      filters: buildFilterOptions(fieldRows.map((item) => item.columnName)),
      filterSearch: matchFilterOption,
      onFilter: (value, record) => record.columnName === String(value),
      sorter: (left, right) => left.columnName.localeCompare(right.columnName, "zh-CN"),
    },
    {
      title: "描述",
      dataIndex: "columnComment",
      width: 190,
      ellipsis: true,
      filters: buildFilterOptions(fieldRows.map((item) => item.columnComment || "-")),
      filterSearch: matchFilterOption,
      onFilter: (value, record) => String(record.columnComment || "-") === String(value),
      sorter: (left, right) => String(left.columnComment || "").localeCompare(String(right.columnComment || ""), "zh-CN"),
      render: (value) => (
        <Typography.Text title={String(value || "-")} ellipsis style={{ maxWidth: 170 }}>
          {String(value || "-")}
        </Typography.Text>
      ),
    },
    {
      title: "类型",
      dataIndex: "columnType",
      width: 150,
      filters: buildFilterOptions(fieldRows.map((item) => item.columnType || "-")),
      filterSearch: matchFilterOption,
      onFilter: (value, record) => String(record.columnType || "-") === String(value),
      sorter: (left, right) => String(left.columnType || "").localeCompare(String(right.columnType || ""), "zh-CN"),
    },
    {
      title: "主键",
      dataIndex: "isPrimaryKey",
      width: 96,
      filters: [
        { text: "是", value: "是" },
        { text: "否", value: "否" },
      ],
      onFilter: (value, record) => (record.isPrimaryKey ? "是" : "否") === String(value),
      sorter: (left, right) => Number(left.isPrimaryKey) - Number(right.isPrimaryKey),
      render: (value) => value ? "是" : "否",
    },
    {
      title: "可空",
      dataIndex: "isNullable",
      width: 96,
      filters: [
        { text: "是", value: "是" },
        { text: "否", value: "否" },
      ],
      onFilter: (value, record) => (record.isNullable ? "是" : "否") === String(value),
      sorter: (left, right) => Number(left.isNullable) - Number(right.isNullable),
      render: (value) => value ? "是" : "否",
    },
    {
      title: "样例值",
      width: 190,
      filters: sampleValueFilters,
      filterSearch: matchFilterOption,
      onFilter: (value, record) => formatSampleValues(record.profile?.sampleValues, record.columnType).includes(String(value)),
      sorter: (left, right) => compareCellText(
        formatSampleValues(left.profile?.sampleValues, left.columnType)[0] || "",
        formatSampleValues(right.profile?.sampleValues, right.columnType)[0] || "",
        left.columnType || right.columnType,
      ),
      render: (_, record) => {
        const sampleValues = formatSampleValues(record.profile?.sampleValues, record.columnType);
        return sampleValues.length > 0 ? (
          <Space size={6} style={{ width: "100%", flexWrap: "nowrap", overflow: "hidden" }}>
            {sampleValues.map((item) => (
              <Tag
                key={item}
                color="processing"
                title={item}
                style={{
                  maxWidth: 54,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "inline-block",
                  flex: "0 1 auto",
                }}
              >
                {item}
              </Tag>
            ))}
          </Space>
        ) : (
          "-"
        );
      },
    },
    {
      title: "数据对标",
      width: 280,
      filters: standardMappingFilters,
      filterSearch: matchFilterOption,
      onFilter: (value, record) => (record.standardMapping?.elementCode || "未对标") === String(value),
      sorter: (left, right) => String(left.standardMapping?.elementCode || "").localeCompare(String(right.standardMapping?.elementCode || ""), "zh-CN"),
      render: (_, record) => {
        const mapping = record.standardMapping;
        if (!mapping?.elementId) return "-";
        const statusMeta = mappingStatusMeta[mapping.mappingStatus] || { label: mapping.mappingStatus || "已映射", color: "default" };
        return (
          <Space size={6} wrap={false} style={{ width: "100%", whiteSpace: "nowrap" }}>
              <Button type="link" style={{ padding: 0, height: "auto" }} onClick={() => void openStandardElementDetail(mapping.elementId)}>
                {mapping.elementCode}
              </Button>
              <Typography.Text type="secondary" ellipsis title={mapping.elementNameCn} style={{ maxWidth: 132 }}>
                {mapping.elementNameCn || "-"}
              </Typography.Text>
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
          </Space>
        );
      },
    },
    {
      title: "特征标签",
      width: 170,
      filters: featureTagFilters,
      filterSearch: matchFilterOption,
      onFilter: (value, record) => (record.profile?.featureTags || []).some((tag) => (featureTagMeta[tag]?.label || tag) === String(value)),
      sorter: (left, right) => (left.profile?.featureTags?.length || 0) - (right.profile?.featureTags?.length || 0),
      render: (_, record) => (record.profile?.featureTags || []).map((tag) => {
        const meta = featureTagMeta[tag] || { label: tag, color: "default" };
        return <Tag key={tag} color={meta.color}>{meta.label}</Tag>;
      }),
    },
    {
      title: "空值率",
      width: 90,
      sorter: (left, right) => Number(left.profile?.nullRate || 0) - Number(right.profile?.nullRate || 0),
      render: (_, record) => percent(record.profile?.nullRate),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 80,
      render: (_, record) => <Button type="link" icon={<EditOutlined />} onClick={() => openEditField(record)}>编辑</Button>,
    },
  ], [featureTagFilters, fieldRows, sampleValueFilters, standardMappingFilters]);

  const aiOutput = detail?.profile?.aiOutput || {};
  const usageSuggestions = getArray(aiOutput.usageSuggestions);
  const qualityFindings = getArray(aiOutput.qualityFindings);
  const riskNotes = getArray(aiOutput.riskNotes);
  const aiTags = getArray(aiOutput.tags);

  return (
    <div className="app-page">
      <Space direction="vertical" size={16} style={{ display: "flex" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }} align="center">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/data-map/resources")}>返回资源清单</Button>
          </Space>
        </Space>

        {detail ? (
          <>
            <Card loading={loading} variant="borderless">
              <Space direction="vertical" size={14} style={{ width: "100%" }}>
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>{detail.tableName} / {detail.resourceCode}</Typography.Title>
                </div>
                <Descriptions bordered size="small" column={detailSummaryColumns}>
                  {detailSummaryItems.map((item) => (
                    <Descriptions.Item key={item.label} label={item.label}>
                      {typeof item.value === "string" || typeof item.value === "number" ? (
                        <Typography.Text ellipsis title={item.title || String(item.value || "")} style={{ maxWidth: 240 }}>
                          {item.value}
                        </Typography.Text>
                      ) : (
                        item.value
                      )}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Space>
            </Card>

            <Card variant="borderless">
              <Tabs
                activeKey={activeTabKey}
                onChange={setActiveTabKey}
                tabBarExtraContent={{
                  right: (
                    activeTabKey === "profile" || activeTabKey === "fields" ? (
                      <Space wrap>
                        <Space.Compact>
                          <div style={{ height: 32, lineHeight: "30px", padding: "0 11px", border: "1px solid #d9d9d9", borderRight: 0, borderRadius: "6px 0 0 6px", background: "#fafafa" }}>抽样条数</div>
                          <InputNumber min={1} max={500} value={sampleLimit} onChange={(value) => setSampleLimit(Number(value || 100))} style={{ width: 110 }} />
                        </Space.Compact>
                        {activeTabKey === "profile" ? (
                          <Button
                            type="primary"
                            icon={<RobotOutlined />}
                            onClick={() => void analyzeContentProfile()}
                            loading={contentAnalyzing}
                            disabled={fieldAnalyzing}
                          >
                            内容画像AI分析
                          </Button>
                        ) : (
                          <Button
                            type="primary"
                            icon={<RobotOutlined />}
                            onClick={() => void analyzeFieldProfile()}
                            loading={fieldAnalyzing}
                            disabled={contentAnalyzing}
                          >
                            字段信息AI分析
                          </Button>
                        )}
                      </Space>
                    ) : null
                  ),
                }}
                items={[
                  {
                    key: "profile",
                    label: "内容画像",
                    children: (
                      <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        {detail.profile?.errorMessage ? <Alert type="warning" showIcon message={detail.profile.errorMessage} /> : null}
                        <Descriptions bordered size="small" column={4}>
                          <Descriptions.Item label="画像状态">{detail.profile?.profileStatus || "-"}</Descriptions.Item>
                          <Descriptions.Item label="样本量">{detail.profile?.sampleCount ?? 0}</Descriptions.Item>
                          <Descriptions.Item label="字段数">{detail.profile?.columnCount ?? detail.columnCount}</Descriptions.Item>
                          <Descriptions.Item label="画像时间">{formatDateTime(detail.profile?.profiledAt)}</Descriptions.Item>
                          <Descriptions.Item label="主键字段" span={2}>{(detail.profile?.primaryKeyFields || []).join(",") || "-"}</Descriptions.Item>
                          <Descriptions.Item label="AI分析时间" span={2}>{formatDateTime(detail.profile?.aiAnalyzedAt)}</Descriptions.Item>
                        </Descriptions>
                        <Card size="small" title="AI分析结果">
                          {detail.profile?.aiSummary ? (
                            <Space direction="vertical" size={12} style={{ width: "100%" }}>
                              <Typography.Paragraph>{detail.profile.aiSummary}</Typography.Paragraph>
                              <Typography.Text strong>业务含义</Typography.Text>
                              <Typography.Paragraph>{String(aiOutput.businessMeaning || "-")}</Typography.Paragraph>
                              <Typography.Text strong>数据粒度</Typography.Text>
                              <Typography.Paragraph>{String(aiOutput.businessGrain || "-")}</Typography.Paragraph>
                              <Space wrap>{aiTags.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}</Space>
                              <Row gutter={16}>
                                <Col span={8}><Typography.Text strong>使用建议</Typography.Text>{usageSuggestions.map((item) => <p key={item}>{item}</p>)}</Col>
                                <Col span={8}><Typography.Text strong>质量发现</Typography.Text>{qualityFindings.map((item) => <p key={item}>{item}</p>)}</Col>
                                <Col span={8}><Typography.Text strong>风险提示</Typography.Text>{riskNotes.map((item) => <p key={item}>{item}</p>)}</Col>
                              </Row>
                            </Space>
                          ) : (
                            <Empty description="暂无AI分析结果，请点击“内容画像AI分析”" />
                          )}
                        </Card>
                      </Space>
                    ),
                  },
                  {
                    key: "fields",
                    label: "字段信息",
                    children: <Table<FieldRow> rowKey="columnName" size="small" columns={fieldColumns} dataSource={fieldRows} pagination={{ pageSize: 10 }} scroll={{ x: 1500 }} />,
                  },
                  {
                    key: "sample",
                    label: "数据预览",
                    children: (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Space style={{ justifyContent: "space-between", width: "100%" }} align="center">
                          <Typography.Text type="secondary">支持按字段控制预览列显示范围。</Typography.Text>
                          <Popover
                            trigger="click"
                            placement="bottomRight"
                            content={(
                              <Space direction="vertical" size={12} style={{ width: 320 }}>
                                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                                    <Checkbox
                                    indeterminate={previewColumnsIndeterminate}
                                    checked={allPreviewColumnsSelected}
                                    onChange={(event) =>
                                      commitPreviewColumnKeys(event.target.checked ? previewColumnOptions.map((item) => item.value) : [])
                                    }
                                  >
                                    全选字段
                                  </Checkbox>
                                  <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => commitPreviewColumnKeys([])}>
                                    清空
                                  </Button>
                                </Space>
                                <Typography.Text type="secondary">
                                  已选择 {visiblePreviewColumnKeys.length} / {previewColumnOptions.length} 个字段
                                </Typography.Text>
                                <Checkbox.Group
                                  style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}
                                  options={previewColumnOptions}
                                  value={visiblePreviewColumnKeys}
                                  onChange={(values) => commitPreviewColumnKeys(values.map((item) => String(item)))}
                                />
                              </Space>
                            )}
                          >
                            <Button>字段显示（{visiblePreviewColumnKeys.length}/{previewColumnOptions.length}）</Button>
                          </Popover>
                        </Space>
                        {visibleSampleColumns.length > 0 ? (
                          <Table<SampleRow>
                            rowKey="__rowKey"
                            size="small"
                            columns={visibleSampleColumns}
                            dataSource={sampleTableRows}
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: "max-content" }}
                          />
                        ) : (
                          <Empty description="请至少选择一个预览字段" />
                        )}
                      </Space>
                    ),
                  },
                  {
                    key: "lineage",
                    label: "数据血缘",
                    children: lineageGraph.nodes.length > 0 ? (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Space style={{ justifyContent: "space-between", width: "100%" }} align="center" wrap>
                          <Typography.Text type="secondary">
                            支持按方向、关系类型和关键词查看上游来源、下游影响与关系明细。
                          </Typography.Text>
                          <Space wrap>
                            <Select<LineageDirection>
                              value={lineageDirection}
                              style={{ width: 120 }}
                              onChange={(value) => setLineageDirection(value)}
                              options={[
                                { label: "全部血缘", value: "both" },
                                { label: "只看上游", value: "upstream" },
                                { label: "只看下游", value: "downstream" },
                              ]}
                            />
                            <Select
                              value={lineageTypeFilter}
                              style={{ width: 130 }}
                              onChange={setLineageTypeFilter}
                              options={lineageTypeOptions}
                            />
                            <Input.Search
                              allowClear
                              placeholder="搜索表名/编码/数据源"
                              value={lineageKeyword}
                              onChange={(event) => setLineageKeyword(event.target.value)}
                              onSearch={setLineageKeyword}
                              style={{ width: 240 }}
                            />
                            <Button icon={<ReloadOutlined />} loading={lineageLoading} onClick={() => void loadLineageGraph(lineageDirection)}>
                              刷新
                            </Button>
                          </Space>
                        </Space>

                        <Row gutter={[12, 12]}>
                          <Col xs={12} md={6}>
                            <Card size="small" loading={lineageLoading}>
                              <Typography.Text type="secondary">上游来源</Typography.Text>
                              <Typography.Title level={4} style={{ margin: "4px 0 0" }}>{lineageStats.upstreamCount}</Typography.Title>
                            </Card>
                          </Col>
                          <Col xs={12} md={6}>
                            <Card size="small" loading={lineageLoading}>
                              <Typography.Text type="secondary">下游影响</Typography.Text>
                              <Typography.Title level={4} style={{ margin: "4px 0 0" }}>{lineageStats.downstreamCount}</Typography.Title>
                            </Card>
                          </Col>
                          <Col xs={12} md={6}>
                            <Card size="small" loading={lineageLoading}>
                              <Typography.Text type="secondary">血缘关系</Typography.Text>
                              <Typography.Title level={4} style={{ margin: "4px 0 0" }}>{lineageStats.edgeCount}</Typography.Title>
                            </Card>
                          </Col>
                          <Col xs={12} md={6}>
                            <Card size="small" loading={lineageLoading}>
                              <Typography.Text type="secondary">未注册节点</Typography.Text>
                              <Typography.Title level={4} style={{ margin: "4px 0 0" }}>{lineageStats.externalCount}</Typography.Title>
                            </Card>
                          </Col>
                        </Row>

                        {lineageGraph.edges.length > 0 && filteredLineageGraph.edges.length === 0 ? (
                          <Alert type="warning" showIcon message="当前筛选条件下没有匹配的血缘关系，图谱中仅保留当前资源节点。" />
                        ) : null}

                        <Card size="small" title="血缘图谱" loading={lineageLoading}>
                          <div style={{ position: "relative", height: 560, width: "100%", border: "1px solid #eef2f7", borderRadius: 10, overflow: "hidden", background: "#f8fbff" }}>
                            <ReactFlowProvider>
                              <ReactFlow
                                nodes={lineageFlowNodes}
                                edges={lineageFlowEdges}
                                fitView
                                fitViewOptions={{ padding: 0.18 }}
                                nodesDraggable
                                nodesConnectable={false}
                                elementsSelectable
                                onNodesChange={handleLineageNodesChange}
                                onNodeClick={(event, node) => {
                                  event.stopPropagation();
                                  setSelectedLineageNodeId(node.id);
                                }}
                                onPaneClick={() => setSelectedLineageNodeId(null)}
                              >
                                <Background gap={18} size={1} color="#dbe4f0" />
                                <Controls />
                              </ReactFlow>
                            </ReactFlowProvider>
                            <Drawer
                              open={Boolean(selectedLineageNode)}
                              title="节点详情"
                              placement="right"
                              width="min(420px, 92vw)"
                              mask={false}
                              getContainer={false}
                              rootStyle={{ position: "absolute", pointerEvents: "none" }}
                              styles={{
                                wrapper: { pointerEvents: "auto" },
                                body: { paddingTop: 12, overflowY: "auto" },
                              }}
                              onClose={() => setSelectedLineageNodeId(null)}
                              destroyOnHidden
                            >
                              {selectedLineageNode ? (
                                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                                  <Typography.Text strong ellipsis={{ tooltip: selectedLineageNode.label }} style={{ display: "block", width: "100%" }}>
                                    {selectedLineageNode.label}
                                  </Typography.Text>
                                  <Space wrap>
                                    <Tag color={selectedLineageNode.id === currentLineageNodeId ? "blue" : selectedLineageNode.type === "external" ? "orange" : "geekblue"}>
                                      {selectedLineageNode.id === currentLineageNodeId ? "当前资源" : selectedLineageNode.type === "external" ? "未注册表" : "已登记资源"}
                                    </Tag>
                                    {selectedLineageEdges.length > 0 ? <Tag color="processing">关联 {selectedLineageEdges.length} 条</Tag> : null}
                                  </Space>
                                  <Descriptions size="small" column={1}>
                                    <Descriptions.Item label="资源编码">{String(selectedLineageNode.data?.resourceCode || "-")}</Descriptions.Item>
                                    <Descriptions.Item label="业务系统">{String(selectedLineageNode.data?.systemName || "-")}</Descriptions.Item>
                                    <Descriptions.Item label="数据源">{String(selectedLineageNode.data?.sourceName || "-")}</Descriptions.Item>
                                    <Descriptions.Item label="节点ID">{selectedLineageNode.id}</Descriptions.Item>
                                  </Descriptions>
                                  <Space wrap>
                                    {selectedLineageEdges.map((edge) => {
                                      const peerId = edge.source === selectedLineageNode.id ? edge.target : edge.source;
                                      const peer = filteredLineageNodeMap.get(peerId);
                                      const peerLabel = peer?.label || peerId;
                                      return (
                                        <Tag
                                          key={edge.id}
                                          color={getLineageTypeColor(edge.data?.lineageType)}
                                          title={peerLabel}
                                          style={{ maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}
                                        >
                                          {edge.source === selectedLineageNode.id ? "输出到" : "输入自"}：{peerLabel}
                                        </Tag>
                                      );
                                    })}
                                  </Space>
                                </Space>
                              ) : null}
                            </Drawer>
                          </div>
                        </Card>

                        <Card size="small" title="影响分析" loading={lineageLoading}>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                              <Typography.Text strong>上游来源</Typography.Text>
                              <div style={{ marginTop: 8 }}>
                                {upstreamLineageNodes.length > 0 ? (
                                  <Space wrap>
                                    {upstreamLineageNodes.map((node, index) => (
                                      <Tag
                                        key={`${node.id}-${index}`}
                                        color={node.type === "external" ? "orange" : "cyan"}
                                        title={node.label}
                                        style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}
                                      >
                                        {node.label}
                                      </Tag>
                                    ))}
                                  </Space>
                                ) : (
                                  <Typography.Text type="secondary">暂无上游来源</Typography.Text>
                                )}
                              </div>
                            </Col>
                            <Col xs={24} md={12}>
                              <Typography.Text strong>下游影响</Typography.Text>
                              <div style={{ marginTop: 8 }}>
                                {downstreamLineageNodes.length > 0 ? (
                                  <Space wrap>
                                    {downstreamLineageNodes.map((node, index) => (
                                      <Tag
                                        key={`${node.id}-${index}`}
                                        color={node.type === "external" ? "orange" : "green"}
                                        title={node.label}
                                        style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}
                                      >
                                        {node.label}
                                      </Tag>
                                    ))}
                                  </Space>
                                ) : (
                                  <Typography.Text type="secondary">暂无下游影响</Typography.Text>
                                )}
                              </div>
                            </Col>
                          </Row>
                        </Card>

                        <Card size="small" title="血缘关系明细" loading={lineageLoading}>
                          <Table<LineageGraphEdge>
                            rowKey="id"
                            size="small"
                            columns={lineageEdgeColumns}
                            dataSource={filteredLineageGraph.edges}
                            pagination={{ pageSize: 5, hideOnSinglePage: true }}
                            scroll={{ x: 860 }}
                          />
                        </Card>
                      </Space>
                    ) : <Empty image={<BranchesOutlined style={{ fontSize: 40 }} />} description="暂无血缘关系" />,
                  },
                  {
                    key: "content",
                    label: "扩展信息",
                    forceRender: true,
                    children: (
                      <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        <Space style={{ justifyContent: "space-between", width: "100%" }} align="center">
                          <Typography.Text type="secondary">维护资源的业务定义、使用说明、适用场景和保留周期。</Typography.Text>
                          <Button type="primary" icon={<SaveOutlined />} onClick={() => void saveContent()} loading={saving}>保存</Button>
                        </Space>
                        <Form form={form} layout="vertical">
                          <Row gutter={[18, 12]}>
                            <Col xs={24} md={12} xl={6}><Form.Item name="businessName" label="业务名称"><Input /></Form.Item></Col>
                            <Col xs={24} md={12} xl={6}><Form.Item name="businessGrain" label="数据粒度"><Input placeholder="如：用户日快照 / 订单明细" /></Form.Item></Col>
                            <Col xs={24} md={12} xl={6}><Form.Item name="updateFrequency" label="更新频率"><Input placeholder="如：每日 / 实时 / 每小时" /></Form.Item></Col>
                            <Col xs={24} md={12} xl={6}><Form.Item name="retentionPeriod" label="保留周期"><Input /></Form.Item></Col>
                            <Col span={24}><Form.Item name="usageScenariosText" label="适用场景"><Input placeholder="多个场景用逗号分隔" /></Form.Item></Col>
                            <Col xs={24} lg={12}><Form.Item name="businessDefinition" label="业务定义"><Input.TextArea rows={5} /></Form.Item></Col>
                            <Col xs={24} lg={12}><Form.Item name="usageInstruction" label="使用说明"><Input.TextArea rows={5} /></Form.Item></Col>
                            <Col xs={24} lg={12}><Form.Item name="qualityNote" label="质量说明"><Input.TextArea rows={4} /></Form.Item></Col>
                            <Col xs={24} lg={12}><Form.Item name="knownIssues" label="已知问题"><Input.TextArea rows={4} /></Form.Item></Col>
                          </Row>
                        </Form>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </>
        ) : (
          <Card loading={loading} variant="borderless">
            <Empty description="资源不存在或正在加载" />
          </Card>
        )}
      </Space>
      <Modal
        open={Boolean(standardElementDetail)}
        title={standardElementDetail?.elementNameCn || "数据元明细"}
        onCancel={() => setStandardElementDetail(null)}
        footer={null}
        width={900}
      >
        {standardElementDetail ? (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="数据元编码">{standardElementDetail.elementCode}</Descriptions.Item>
            <Descriptions.Item label="标识符">{standardElementDetail.elementIdentifier}</Descriptions.Item>
            <Descriptions.Item label="中文名称">{standardElementDetail.elementNameCn}</Descriptions.Item>
            <Descriptions.Item label="英文名称">{standardElementDetail.elementNameEn || "-"}</Descriptions.Item>
            <Descriptions.Item label="目录">{standardElementDetail.catalogName || "-"}</Descriptions.Item>
            <Descriptions.Item label="生命周期">{standardElementDetail.lifecycleStatus || "-"}</Descriptions.Item>
            <Descriptions.Item label="对象类">{standardElementDetail.objectClass || "-"}</Descriptions.Item>
            <Descriptions.Item label="属性">{standardElementDetail.propertyName || "-"}</Descriptions.Item>
            <Descriptions.Item label="表示词">{standardElementDetail.representationTerm || "-"}</Descriptions.Item>
            <Descriptions.Item label="数据类型">{standardElementDetail.dataType || "-"}</Descriptions.Item>
            <Descriptions.Item label="值域">
              {standardElementDetail.valueDomainName ? (
                standardElementDetail.valueDomainId ? (
                  <Button
                    type="link"
                    style={{ padding: 0, height: "auto" }}
                    onClick={() => void openValueDomainDetail(standardElementDetail.valueDomainId)}
                  >
                    {standardElementDetail.valueDomainName}
                  </Button>
                ) : standardElementDetail.valueDomainName
              ) : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="引用标准">{standardElementDetail.referenceStandardName || "-"}</Descriptions.Item>
            <Descriptions.Item label="引用条款" span={2}>{standardElementDetail.referenceClause || "-"}</Descriptions.Item>
            <Descriptions.Item label="定义" span={2}>{standardElementDetail.definition || "-"}</Descriptions.Item>
            <Descriptions.Item label="别名" span={2}>
              {(standardElementDetail.aliases || []).length > 0
                ? (standardElementDetail.aliases || []).map((item) => <Tag key={item}>{item}</Tag>)
                : "-"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(valueDomainDetail)}
        title={valueDomainDetail?.domainName || "值域明细"}
        onCancel={() => setValueDomainDetail(null)}
        footer={null}
        width={920}
      >
        {valueDomainDetail ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="值域编码">{valueDomainDetail.domainCode}</Descriptions.Item>
              <Descriptions.Item label="值域名称">{valueDomainDetail.domainName}</Descriptions.Item>
              <Descriptions.Item label="值域类型">{valueDomainDetail.domainType}</Descriptions.Item>
              <Descriptions.Item label="值类型">{valueDomainDetail.valueType}</Descriptions.Item>
              <Descriptions.Item label="数据类型">{valueDomainDetail.dataType || "-"}</Descriptions.Item>
              <Descriptions.Item label="单位">{valueDomainDetail.unit || "-"}</Descriptions.Item>
              <Descriptions.Item label="最小值">{valueDomainDetail.minValue ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="最大值">{valueDomainDetail.maxValue ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="正则格式">{valueDomainDetail.regexPattern || "-"}</Descriptions.Item>
              <Descriptions.Item label="格式模式">{valueDomainDetail.formatPattern || "-"}</Descriptions.Item>
              <Descriptions.Item label="引用标准">{valueDomainDetail.referenceStandardName || "-"}</Descriptions.Item>
              <Descriptions.Item label="引用条款">{valueDomainDetail.referenceClause || "-"}</Descriptions.Item>
              <Descriptions.Item label="说明" span={2}>{valueDomainDetail.description || "-"}</Descriptions.Item>
            </Descriptions>
            {hasDiscreteValueDomainItems(valueDomainDetail.domainType) ? (
              <Table<ValueDomainItem>
                rowKey={(record) => String(record.id || record.itemCode)}
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                dataSource={valueDomainDetail.items || []}
                columns={[
                  { title: "代码", dataIndex: "itemCode", width: 130 },
                  { title: "标签", dataIndex: "itemLabel", width: 180 },
                  { title: "值", dataIndex: "itemValue", width: 140, render: (value) => value || "-" },
                  { title: "含义", dataIndex: "itemMeaning", render: (value) => value || "-" },
                  { title: "排序", dataIndex: "sortOrder", width: 90 },
                ]}
              />
            ) : null}
          </Space>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(editingField)}
        title={editingField ? `编辑字段：${editingField.columnName}` : "编辑字段"}
        onCancel={() => setEditingField(null)}
        onOk={() => void saveFieldMetadata()}
        confirmLoading={savingField}
        destroyOnHidden
        width={760}
      >
        <Form form={fieldForm} layout="vertical">
          <Row gutter={16}>
            <Col span={24}><Form.Item name="columnComment" label="描述"><Input.TextArea rows={2} /></Form.Item></Col>
            <Col span={12}><Form.Item name="aiBusinessName" label="AI业务名"><Input /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="featureTags" label="特征标签">
                <Select mode="multiple" allowClear options={featureTagOptions.map(({ value, label }) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="standardElementId" label="标准数据元">
                <Select
                  allowClear
                  showSearch
                  filterOption={false}
                  loading={standardElementLoading}
                  placeholder="搜索标准数据元编码、名称或定义"
                  options={standardElementOptions.map((item) => ({ value: item.value, label: item.label }))}
                  onFocus={() => void searchStandardElements()}
                  onSearch={(value) => void searchStandardElements(value)}
                />
              </Form.Item>
            </Col>
            <Col span={24}><Form.Item name="aiBusinessMeaning" label="AI说明"><Input.TextArea rows={4} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
