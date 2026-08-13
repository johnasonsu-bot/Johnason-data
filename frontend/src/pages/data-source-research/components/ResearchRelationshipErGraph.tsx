import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Empty, Input, Select, Slider, Space, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlowProvider,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { DataSourceResearchTableRelationshipReport } from "../../../types/api";

type RelationshipReport = DataSourceResearchTableRelationshipReport;
type RelationshipEntity = RelationshipReport["entities"][number];
type RelationshipRelation = RelationshipReport["relations"][number];

type RelationshipNodeData = {
  entity: RelationshipEntity;
  relationCount: number;
  accent: string;
  relatedFieldNames: string[];
};

type Props = {
  value?: RelationshipReport;
  height?: number;
};

const NODE_WIDTH = 300;
const NODE_HEIGHT_ESTIMATE = 430;
const LAYER_GAP_X = 520;
const LAYER_COLUMN_GAP_X = 390;
const LAYER_ROW_GAP_Y = 520;
const COMPONENT_GAP_X = 260;
const COMPONENT_GAP_Y = 220;
const LAYOUT_START_X = 80;
const LAYOUT_START_Y = 70;
const SOURCE_HANDLE_IDS = { left: "source-left", right: "source-right", top: "source-top", bottom: "source-bottom" };
const TARGET_HANDLE_IDS = { left: "target-left", right: "target-right", top: "target-top", bottom: "target-bottom" };
const fieldSourceHandleId = (fieldName: string) => `field-source:${fieldName}`;
const fieldTargetHandleId = (fieldName: string) => `field-target:${fieldName}`;

const CATEGORY_LABELS: Record<string, string> = {
  business: "业务表",
  dictionary: "字典表",
  relation: "关联表",
  log: "日志表",
  temporary: "临时表",
  low_value: "低价值表",
};

const RELATION_SOURCE_LABELS: Record<string, string> = {
  constraint: "显式约束",
  name_rule: "命名规则",
  ai: "模型判断",
};

const ROLE_META: Record<string, { accent: string; bg: string }> = {
  business: { accent: "#1677ff", bg: "#eff6ff" },
  dictionary: { accent: "#4f46e5", bg: "#eef2ff" },
  relation: { accent: "#0f766e", bg: "#ecfeff" },
  log: { accent: "#be123c", bg: "#fff1f2" },
  temporary: { accent: "#d97706", bg: "#fffbeb" },
  low_value: { accent: "#64748b", bg: "#f8fafc" },
  default: { accent: "#334155", bg: "#f8fafc" },
};

function categoryLabel(value?: string) {
  return CATEGORY_LABELS[String(value || "").trim().toLowerCase()] || value || "数据表";
}

function relationSourceLabel(value?: string) {
  return RELATION_SOURCE_LABELS[String(value || "")] || value || "-";
}

function formatConfidence(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Math.round(Number(value) * 100)}%`;
}

function relationKey(relation: RelationshipRelation) {
  return `${relation.fromTable}.${relation.fromField}.${relation.toTable}.${relation.toField}.${relation.relationType}`;
}

function getRoleMeta(category?: string) {
  return ROLE_META[String(category || "").toLowerCase()] || ROLE_META.default;
}

function buildRelationCountMap(entities: RelationshipEntity[], relations: RelationshipRelation[]) {
  const map = new Map<string, number>(entities.map((entity) => [entity.tableName, 0]));
  relations.forEach((relation) => {
    if (map.has(relation.fromTable)) map.set(relation.fromTable, Number(map.get(relation.fromTable) || 0) + 1);
    if (map.has(relation.toTable)) map.set(relation.toTable, Number(map.get(relation.toTable) || 0) + 1);
  });
  return map;
}

function buildComponents(entities: RelationshipEntity[], relations: RelationshipRelation[]) {
  const entityNames = new Set(entities.map((entity) => entity.tableName));
  const adjacency = new Map<string, Set<string>>(entities.map((entity) => [entity.tableName, new Set<string>()]));
  relations.forEach((relation) => {
    if (!entityNames.has(relation.fromTable) || !entityNames.has(relation.toTable)) return;
    adjacency.get(relation.fromTable)?.add(relation.toTable);
    adjacency.get(relation.toTable)?.add(relation.fromTable);
  });

  const visited = new Set<string>();
  const components: string[][] = [];
  entities.forEach((entity) => {
    if (visited.has(entity.tableName)) return;
    const queue = [entity.tableName];
    const names: string[] = [];
    visited.add(entity.tableName);
    while (queue.length) {
      const current = queue.shift() as string;
      names.push(current);
      adjacency.get(current)?.forEach((next) => {
        if (visited.has(next)) return;
        visited.add(next);
        queue.push(next);
      });
    }
    components.push(names);
  });
  return components;
}

function buildPositions(entities: RelationshipEntity[], relations: RelationshipRelation[]) {
  const relationCountMap = buildRelationCountMap(entities, relations);
  const entityMap = new Map(entities.map((entity) => [entity.tableName, entity]));
  const components = buildComponents(entities, relations).sort((left, right) => {
    const leftScore = left.reduce((sum, name) => sum + Number(relationCountMap.get(name) || 0), 0);
    const rightScore = right.reduce((sum, name) => sum + Number(relationCountMap.get(name) || 0), 0);
    return rightScore - leftScore || right.length - left.length;
  });

  const degreeMap = new Map(entities.map((entity) => [entity.tableName, { incoming: 0, outgoing: 0 }]));
  const directedAdjacency = new Map(entities.map((entity) => [entity.tableName, new Set<string>()]));
  const undirectedAdjacency = new Map(entities.map((entity) => [entity.tableName, new Set<string>()]));
  const entityNames = new Set(entities.map((entity) => entity.tableName));
  relations.forEach((relation) => {
    if (!entityNames.has(relation.fromTable) || !entityNames.has(relation.toTable)) return;
    const fromDegree = degreeMap.get(relation.fromTable);
    const toDegree = degreeMap.get(relation.toTable);
    if (fromDegree) fromDegree.outgoing += 1;
    if (toDegree) toDegree.incoming += 1;
    directedAdjacency.get(relation.fromTable)?.add(relation.toTable);
    undirectedAdjacency.get(relation.fromTable)?.add(relation.toTable);
    undirectedAdjacency.get(relation.toTable)?.add(relation.fromTable);
  });

  const compareByBusinessWeight = (left: string, right: string) => {
    const leftDegree = degreeMap.get(left) || { incoming: 0, outgoing: 0 };
    const rightDegree = degreeMap.get(right) || { incoming: 0, outgoing: 0 };
    const leftFlowScore = leftDegree.outgoing - leftDegree.incoming;
    const rightFlowScore = rightDegree.outgoing - rightDegree.incoming;
    if (rightFlowScore !== leftFlowScore) return rightFlowScore - leftFlowScore;
    const relationDelta = Number(relationCountMap.get(right) || 0) - Number(relationCountMap.get(left) || 0);
    if (relationDelta !== 0) return relationDelta;
    const leftFields = entityMap.get(left)?.fields?.length || 0;
    const rightFields = entityMap.get(right)?.fields?.length || 0;
    return rightFields - leftFields || left.localeCompare(right);
  };

  const buildLayeredComponentLayout = (component: string[]) => {
    const sorted = [...component].sort(compareByBusinessWeight);
    const layerByName = new Map<string, number>();
    const queue: string[] = [];
    sorted.forEach((tableName) => {
      if (layerByName.has(tableName)) return;
      layerByName.set(tableName, 0);
      queue.push(tableName);
      while (queue.length) {
        const current = queue.shift() as string;
        const currentLayer = layerByName.get(current) || 0;
        const outgoing = [...(directedAdjacency.get(current) || [])].sort(compareByBusinessWeight);
        const remaining = [...(undirectedAdjacency.get(current) || [])]
          .filter((name) => !outgoing.includes(name))
          .sort(compareByBusinessWeight);
        [...outgoing, ...remaining].forEach((next) => {
          if (!component.includes(next) || layerByName.has(next)) return;
          layerByName.set(next, currentLayer + 1);
          queue.push(next);
        });
      }
    });

    const layers = [...layerByName.entries()]
      .reduce<string[][]>((result, [tableName, layerIndex]) => {
        if (!result[layerIndex]) result[layerIndex] = [];
        result[layerIndex].push(tableName);
        return result;
      }, [])
      .filter(Boolean)
      .map((layer) => layer.sort(compareByBusinessWeight));

    const maxRowsPerLayer = component.length > 14 ? 5 : 4;
    const layerMetrics = layers.map((layer) => {
      const rowCount = Math.min(layer.length, maxRowsPerLayer);
      const columnCount = Math.max(1, Math.ceil(layer.length / maxRowsPerLayer));
      return {
        height: Math.max(0, rowCount - 1) * LAYER_ROW_GAP_Y,
        width: Math.max(0, columnCount - 1) * LAYER_COLUMN_GAP_X,
      };
    });
    const maxLayerHeight = Math.max(0, ...layerMetrics.map((metric) => metric.height));
    const localPositions = new Map<string, { x: number; y: number }>();
    let layerX = 0;
    layers.forEach((layer, layerIndex) => {
      const metric = layerMetrics[layerIndex];
      const layerTop = (maxLayerHeight - metric.height) / 2;
      layer.forEach((tableName, index) => {
        const columnIndex = Math.floor(index / maxRowsPerLayer);
        const rowIndex = index % maxRowsPerLayer;
        localPositions.set(tableName, {
          x: layerX + columnIndex * LAYER_COLUMN_GAP_X,
          y: layerTop + rowIndex * LAYER_ROW_GAP_Y,
        });
      });
      layerX += metric.width + LAYER_GAP_X;
    });

    return {
      positions: localPositions,
      width: Math.max(NODE_WIDTH, layerX - LAYER_GAP_X + NODE_WIDTH),
      height: maxLayerHeight + NODE_HEIGHT_ESTIMATE,
    };
  };

  const componentLayouts = components.map((component) => buildLayeredComponentLayout(component));
  const positions = new Map<string, { x: number; y: number }>();
  const columns = Math.max(1, Math.min(2, Math.ceil(Math.sqrt(Math.max(1, componentLayouts.length)))));
  let rowTop = LAYOUT_START_Y;
  for (let startIndex = 0; startIndex < componentLayouts.length; startIndex += columns) {
    const rowLayouts = componentLayouts.slice(startIndex, startIndex + columns);
    let columnLeft = LAYOUT_START_X;
    rowLayouts.forEach((layout) => {
      layout.positions.forEach((position, tableName) => {
        positions.set(tableName, { x: columnLeft + position.x, y: rowTop + position.y });
      });
      columnLeft += layout.width + COMPONENT_GAP_X;
    });
    rowTop += Math.max(...rowLayouts.map((layout) => layout.height)) + COMPONENT_GAP_Y;
  }

  return positions;
}

function resolveHandleDirections(sourcePosition: { x: number; y: number }, targetPosition: { x: number; y: number }) {
  const dx = (targetPosition.x + NODE_WIDTH / 2) - (sourcePosition.x + NODE_WIDTH / 2);
  const dy = (targetPosition.y + NODE_HEIGHT_ESTIMATE / 2) - (sourcePosition.y + NODE_HEIGHT_ESTIMATE / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: SOURCE_HANDLE_IDS.right, targetHandle: TARGET_HANDLE_IDS.left }
      : { sourceHandle: SOURCE_HANDLE_IDS.left, targetHandle: TARGET_HANDLE_IDS.right };
  }
  return dy >= 0
    ? { sourceHandle: SOURCE_HANDLE_IDS.bottom, targetHandle: TARGET_HANDLE_IDS.top }
    : { sourceHandle: SOURCE_HANDLE_IDS.top, targetHandle: TARGET_HANDLE_IDS.bottom };
}

function buildNodes(entities: RelationshipEntity[], relations: RelationshipRelation[]): Node<RelationshipNodeData>[] {
  const positions = buildPositions(entities, relations);
  const relationCountMap = buildRelationCountMap(entities, relations);
  return entities.map((entity) => {
    const meta = getRoleMeta(entity.category);
    return {
      id: entity.tableName,
      type: "researchRelationshipTable",
      position: positions.get(entity.tableName) || { x: 0, y: 0 },
      data: {
        entity,
        relationCount: relationCountMap.get(entity.tableName) || 0,
        accent: meta.accent,
        relatedFieldNames: Array.from(new Set(relations.flatMap((relation) => [
          ...(relation.fromTable === entity.tableName ? [relation.fromField] : []),
          ...(relation.toTable === entity.tableName ? [relation.toField] : []),
        ]))),
      },
    };
  });
}

function buildEdges(relations: RelationshipRelation[], nodes: Node<RelationshipNodeData>[], selectedTableName?: string): Edge[] {
  const nodePositionMap = new Map(nodes.map((node) => [node.id, node.position]));
  return relations
    .filter((relation) => nodePositionMap.has(relation.fromTable) && nodePositionMap.has(relation.toTable))
    .map((relation) => {
      const sourcePosition = nodePositionMap.get(relation.fromTable) || { x: 0, y: 0 };
      const targetPosition = nodePositionMap.get(relation.toTable) || { x: 0, y: 0 };
      const active = !selectedTableName || relation.fromTable === selectedTableName || relation.toTable === selectedTableName;
      const color = relation.source === "constraint" ? "#1677ff" : relation.source === "ai" ? "#7c3aed" : "#0f766e";
      resolveHandleDirections(sourcePosition, targetPosition);
      return {
        id: relationKey(relation),
        source: relation.fromTable,
        target: relation.toTable,
        sourceHandle: fieldSourceHandleId(relation.fromField),
        targetHandle: fieldTargetHandleId(relation.toField),
        type: "smoothstep",
        label: `${relation.fromField} (${relation.fromFieldRole === "FOREIGN_KEY" ? "FK" : "REF"}) → ${relation.toField} (${relation.toFieldRole === "PRIMARY_KEY" ? "PK" : relation.toFieldRole === "UNIQUE_KEY" ? "UK" : "BK"}) · ${relation.relationType}`,
        animated: relation.source === "constraint",
        style: { stroke: color, strokeWidth: active ? 3.2 : 2, opacity: active ? 0.95 : 0.25 },
        labelStyle: { fill: "#1f2937", fontSize: 12, fontWeight: 700, opacity: active ? 1 : 0.35 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: active ? 1 : 0.5, stroke: color, strokeOpacity: 0.18 },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 12,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color,
        },
      };
    });
}

function tableMatchesQuery(entity: RelationshipEntity | undefined, query: string) {
  if (!entity) return false;
  const text = [
    entity.tableName,
    entity.tableComment,
    entity.category,
    ...(entity.fields || []).flatMap((field) => [field.columnName, field.dataType, field.columnComment]),
  ].join(" ").toLowerCase();
  return text.includes(query.toLowerCase());
}

function relationMatchesQuery(relation: RelationshipRelation, query: string) {
  return [
    relation.fromTable,
    relation.fromField,
    relation.toTable,
    relation.toField,
    relation.relationType,
    relation.source,
    ...(relation.evidence || []),
  ].join(" ").toLowerCase().includes(query.toLowerCase());
}

function RelationshipTableNode({ data, selected }: NodeProps<RelationshipNodeData>) {
  const fields = data.entity.fields || [];
  const relatedFieldNames = new Set(data.relatedFieldNames);
  const previewFields = [
    ...fields.filter((field) => relatedFieldNames.has(field.columnName)),
    ...fields.filter((field) => field.isPrimaryKey && !relatedFieldNames.has(field.columnName)),
    ...fields.filter((field) => !field.isPrimaryKey && !relatedFieldNames.has(field.columnName)),
  ].slice(0, Math.max(8, data.relatedFieldNames.length));
  const hiddenFieldCount = Math.max(0, fields.length - previewFields.length);
  const meta = getRoleMeta(data.entity.category);

  return (
    <div
      style={{
        width: NODE_WIDTH,
        borderRadius: 8,
        border: `1px solid ${selected ? data.accent : "rgba(15, 23, 42, 0.10)"}`,
        background: "#ffffff",
        boxShadow: selected ? `0 0 0 3px ${data.accent}22, 0 20px 44px rgba(15, 23, 42, 0.16)` : "0 14px 34px rgba(15, 23, 42, 0.10)",
        overflow: "hidden",
      }}
    >
      <Handle id={TARGET_HANDLE_IDS.left} type="target" position={Position.Left} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />
      <Handle id={TARGET_HANDLE_IDS.right} type="target" position={Position.Right} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />
      <Handle id={TARGET_HANDLE_IDS.top} type="target" position={Position.Top} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />
      <Handle id={TARGET_HANDLE_IDS.bottom} type="target" position={Position.Bottom} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />
      <Handle id={SOURCE_HANDLE_IDS.left} type="source" position={Position.Left} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />
      <Handle id={SOURCE_HANDLE_IDS.right} type="source" position={Position.Right} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />
      <Handle id={SOURCE_HANDLE_IDS.top} type="source" position={Position.Top} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />
      <Handle id={SOURCE_HANDLE_IDS.bottom} type="source" position={Position.Bottom} style={{ width: 10, height: 10, background: data.accent, border: "2px solid #ffffff" }} />

      <div style={{ borderTop: `5px solid ${data.accent}`, padding: "14px 16px 12px", background: meta.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{categoryLabel(data.entity.category)}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{data.relationCount} 关系</Typography.Text>
        </div>
        <div
          style={{
            marginTop: 8,
            minHeight: 42,
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.4,
            wordBreak: "break-word",
            color: "#0f172a",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data.entity.tableName}
        </div>
        <div
          style={{
            marginTop: 5,
            minHeight: 36,
            fontSize: 12,
            lineHeight: 1.5,
            color: "#475569",
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data.entity.tableComment || "未补充说明"}
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <div style={{ borderRadius: 8, background: "#f8fafc", padding: "8px 10px" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>字段数</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{fields.length}</div>
          </div>
          <div style={{ borderRadius: 8, background: "#f8fafc", padding: "8px 10px" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>行数</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{data.entity.rowCount ?? "-"}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#ffffff", padding: 10 }}>
          <Space direction="vertical" size={5} style={{ display: "flex" }}>
            {previewFields.map((field) => (
              <div key={field.columnName} style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.5, background: relatedFieldNames.has(field.columnName) ? "#f0f7ff" : "transparent", borderRadius: 4, padding: "2px 4px" }}>
                {relatedFieldNames.has(field.columnName) ? <Handle id={fieldTargetHandleId(field.columnName)} type="target" position={Position.Left} style={{ left: -16, width: 9, height: 9, background: data.accent, border: "2px solid #fff" }} /> : null}
                <Typography.Text style={{ fontFamily: "Consolas, Menlo, monospace", color: field.isPrimaryKey ? data.accent : "#111827" }} ellipsis>
                  {field.isPrimaryKey ? "PK " : ""}{field.columnName}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ flex: "0 0 auto" }}>{field.dataType || "-"}</Typography.Text>
                {relatedFieldNames.has(field.columnName) ? <Handle id={fieldSourceHandleId(field.columnName)} type="source" position={Position.Right} style={{ right: -16, width: 9, height: 9, background: data.accent, border: "2px solid #fff" }} /> : null}
              </div>
            ))}
            {hiddenFieldCount > 0 ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>+{hiddenFieldCount} 个字段</Typography.Text> : null}
          </Space>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { researchRelationshipTable: RelationshipTableNode };

export function ResearchRelationshipErGraph({ value, height = 640 }: Props) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | undefined>();
  const [minConfidence, setMinConfidence] = useState(70);
  const [hideIsolated, setHideIsolated] = useState(true);
  const [selectedTableName, setSelectedTableName] = useState("");

  const rawEntities = value?.entities || [];
  const rawRelations = value?.relations || [];
  const filteredRelations = useMemo(() => rawRelations.filter((relation) => {
    if (sourceFilter && relation.source !== sourceFilter) return false;
    if (Number(relation.confidence || 0) * 100 < minConfidence) return false;
    if (query && !relationMatchesQuery(relation, query)) {
      const fromEntity = rawEntities.find((entity) => entity.tableName === relation.fromTable);
      const toEntity = rawEntities.find((entity) => entity.tableName === relation.toTable);
      if (!tableMatchesQuery(fromEntity as RelationshipEntity, query) && !tableMatchesQuery(toEntity as RelationshipEntity, query)) {
        return false;
      }
    }
    return true;
  }), [minConfidence, query, rawEntities, rawRelations, sourceFilter]);

  const filteredEntities = useMemo(() => {
    const relationNames = new Set(filteredRelations.flatMap((relation) => [relation.fromTable, relation.toTable]));
    return rawEntities.filter((entity) => {
      const matchedByQuery = !query || tableMatchesQuery(entity, query) || relationNames.has(entity.tableName);
      if (!matchedByQuery) return false;
      if (hideIsolated && !relationNames.has(entity.tableName)) return false;
      return true;
    });
  }, [filteredRelations, hideIsolated, query, rawEntities]);

  const flowNodes = useMemo(() => buildNodes(filteredEntities, filteredRelations), [filteredEntities, filteredRelations]);
  const [nodes, setNodes] = useState<Node<RelationshipNodeData>[]>(flowNodes);
  useEffect(() => {
    setNodes(flowNodes);
    setSelectedTableName((current) => (flowNodes.some((node) => node.id === current) ? current : ""));
  }, [flowNodes]);

  const flowEdges = useMemo(() => buildEdges(filteredRelations, nodes, selectedTableName), [filteredRelations, nodes, selectedTableName]);
  const selectedEntity = useMemo(() => filteredEntities.find((entity) => entity.tableName === selectedTableName) || null, [filteredEntities, selectedTableName]);
  const selectedRelations = useMemo(() => filteredRelations.filter((relation) => relation.fromTable === selectedTableName || relation.toTable === selectedTableName), [filteredRelations, selectedTableName]);

  if (!value?.entities?.length) {
    return <Empty description="暂无可生成 ER 图的表关系数据" />;
  }

  return (
    <ReactFlowProvider>
      <Space direction="vertical" size={12} style={{ display: "flex" }}>
        <Card size="small" variant="borderless" style={{ border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 180px 230px auto", gap: 12, alignItems: "center" }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索表名、字段、关系依据"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select
              allowClear
              placeholder="关系来源"
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: "constraint", label: "显式约束" },
                { value: "name_rule", label: "命名规则" },
                { value: "ai", label: "模型判断" },
              ]}
            />
            <Space.Compact style={{ width: "100%" }}>
              <div style={{ flex: "0 0 74px", paddingTop: 5, color: "#64748b" }}>置信度</div>
              <Slider min={50} max={100} step={5} value={minConfidence} onChange={setMinConfidence} style={{ flex: 1 }} />
            </Space.Compact>
            <Checkbox checked={hideIsolated} onChange={(event) => setHideIsolated(event.target.checked)}>隐藏孤立表</Checkbox>
          </div>
        </Card>
        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div
              style={{
                height,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                background: "linear-gradient(180deg, #fcfcfd 0%, #f8fafc 100%)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
              }}
            >
              {nodes.length ? (
                <ReactFlow
                  fitView
                  minZoom={0.25}
                  maxZoom={1.6}
                  nodes={nodes}
                  edges={flowEdges}
                  nodeTypes={nodeTypes}
                  nodesConnectable={false}
                  onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
                  onNodeClick={(_event, node) => setSelectedTableName(node.id)}
                  onPaneClick={() => setSelectedTableName("")}
                  defaultEdgeOptions={{ type: "smoothstep" }}
                  fitViewOptions={{ padding: 0.18, maxZoom: 0.85 }}
                  proOptions={{ hideAttribution: true }}
                  style={{ background: "transparent" }}
                >
                  <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#dbe4f0" />
                  <MiniMap
                    pannable
                    zoomable
                    nodeBorderRadius={8}
                    maskColor="rgba(15, 23, 42, 0.08)"
                    nodeColor={(node) => (node.data as RelationshipNodeData | undefined)?.accent || "#64748b"}
                    style={{ background: "rgba(255, 255, 255, 0.92)", border: "1px solid rgba(15, 23, 42, 0.08)", borderRadius: 8 }}
                  />
                  <Controls style={{ borderRadius: 8, overflow: "hidden", boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" }} />
                </ReactFlow>
              ) : (
                <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                  <Empty description="当前筛选条件下没有可展示的关系图" />
                </div>
              )}
            </div>
          </div>
          {selectedEntity ? (
            <Card
              size="small"
              title="表详情"
              extra={<Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSelectedTableName("")} />}
              style={{ flex: "0 0 360px", width: 360, borderRadius: 8, border: "1px solid rgba(15, 23, 42, 0.08)" }}
            >
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                <div>
                  <Typography.Title level={5} style={{ margin: 0, wordBreak: "break-word" }}>{selectedEntity.tableName}</Typography.Title>
                  <Typography.Text type="secondary">{selectedEntity.tableComment || "未补充说明"}</Typography.Text>
                </div>
                <Space wrap>
                  <Tag color="blue">{categoryLabel(selectedEntity.category)}</Tag>
                  <Tag color="cyan">{selectedEntity.fields.length} 字段</Tag>
                  <Tag color="geekblue">{selectedRelations.length} 关系</Tag>
                </Space>
                <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #eef2f7", borderRadius: 8, padding: 10, background: "#fafafa" }}>
                  <Space direction="vertical" size={8} style={{ display: "flex" }}>
                    {selectedEntity.fields.map((field) => (
                      <div key={field.columnName} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, padding: 8, borderRadius: 8, background: "#ffffff" }}>
                        <div>
                          <Typography.Text style={{ fontFamily: "Consolas, Menlo, monospace" }}>{field.isPrimaryKey ? "PK " : ""}{field.columnName}</Typography.Text>
                          <div style={{ color: "#64748b", fontSize: 12 }}>{field.columnComment || "未补充字段说明"}</div>
                        </div>
                        <Tag>{field.dataType || "-"}</Tag>
                      </div>
                    ))}
                  </Space>
                </div>
                <Table
                  rowKey={relationKey}
                  size="small"
                  pagination={false}
                  dataSource={selectedRelations}
                  columns={[
                    {
                      title: "关系",
                      key: "relation",
                      render: (_value, record) => (
                        <Space direction="vertical" size={4}>
                          <Typography.Text style={{ fontFamily: "Consolas, Menlo, monospace", fontSize: 12 }}>{record.fromTable}.{record.fromField}</Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>→ {record.toTable}.{record.toField}</Typography.Text>
                        </Space>
                      ),
                    },
                    { title: "来源", dataIndex: "source", width: 86, render: (value) => relationSourceLabel(value) },
                    { title: "置信", dataIndex: "confidence", width: 70, render: (value) => formatConfidence(value) },
                  ]}
                />
              </Space>
            </Card>
          ) : null}
        </div>
        <Table
          rowKey={relationKey}
          size="small"
          pagination={{ pageSize: 6, showSizeChanger: false }}
          dataSource={filteredRelations}
          columns={[
            { title: "引用方", key: "from", width: 260, render: (_value, record) => `${record.fromTable}.${record.fromField}` },
            { title: "被引用方", key: "to", width: 260, render: (_value, record) => `${record.toTable}.${record.toField}` },
            { title: "关系", dataIndex: "relationType", key: "relationType", width: 90 },
            { title: "引用字段角色", dataIndex: "fromFieldRole", key: "fromFieldRole", width: 120, render: (value) => value === "FOREIGN_KEY" ? "FK 外键" : "REF 引用" },
            { title: "目标字段角色", dataIndex: "toFieldRole", key: "toFieldRole", width: 130, render: (value) => value === "PRIMARY_KEY" ? "PK 主键" : value === "UNIQUE_KEY" ? "UK 唯一键" : "BK 业务键" },
            { title: "来源", dataIndex: "source", key: "source", width: 120, render: (value) => relationSourceLabel(value) },
            { title: "置信度", dataIndex: "confidence", key: "confidence", width: 90, render: (value) => formatConfidence(value) },
            { title: "依据", dataIndex: "evidence", key: "evidence", render: (value) => Array.isArray(value) && value.length ? value.join("；") : "-" },
          ]}
          locale={{ emptyText: "未识别到稳定表关系" }}
        />
      </Space>
    </ReactFlowProvider>
  );
}
