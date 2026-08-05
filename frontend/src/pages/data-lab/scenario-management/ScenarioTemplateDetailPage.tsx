import "reactflow/dist/style.css";

import { CloseOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  fetchBusinessSystemTemplateDetail,
  fetchBusinessSystemTemplateLogicalVersions,
  saveBusinessSystemTemplateLogicalModel,
  deleteBusinessSystemTemplate,
  updateBusinessSystemTemplateBasic,
  type LabBusinessSystemTemplateUpdatePayload,
} from "../../../services/dataLab";
import type {
  LabBusinessSystemLogicalModelVersionRecord,
  LabBusinessSystemTemplateRecord,
} from "../../../types/api";

type ModuleRow = {
  moduleKey: string;
  moduleLabel: string;
  summary?: string;
  tableNames: string[];
};

type FieldRow = {
  fieldName: string;
  fieldType: string;
  required: boolean;
  businessSemantic?: string;
  fieldComment?: string;
};

type TableRow = {
  tableName: string;
  tableLabel?: string;
  tableComment?: string;
  businessRole?: string;
  fields: FieldRow[];
  keyInfoItems?: any[];
  sourceRefs?: string[];
};

type DictItemRow = {
  itemCode: string;
  itemLabel: string;
  valueRange?: any;
  sourceRefs?: string[];
};

type DictTableRow = {
  dictType: string;
  dictName?: string;
  categoryCode?: string;
  items: DictItemRow[];
  sourceRefs?: string[];
};

type RelationRow = {
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  relationType: string;
};

type LogicalModelState = {
  modules: ModuleRow[];
  tables: TableRow[];
  dictTables: DictTableRow[];
  relations: RelationRow[];
};

type DictItemFormValues = {
  itemCode: string;
  itemLabel: string;
  valueRangeText?: string;
};

const TEMPLATE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "\u8349\u7a3f" },
  active: { color: "processing", label: "\u542f\u7528" },
  archived: { color: "gold", label: "\u5f52\u6863" },
};

const VERSION_STATUS_META: Record<string, { color: string; label: string }> = {
  generated: { color: "blue", label: "\u81ea\u52a8\u751f\u6210" },
  edited: { color: "processing", label: "\u4eba\u5de5\u7f16\u8f91" },
  published: { color: "success", label: "\u5df2\u53d1\u5e03" },
};

const BUSINESS_ROLE_OPTIONS = [
  "MASTER",
  "TRANSACTION",
  "DETAIL",
  "BRIDGE",
  "LOG",
  "SNAPSHOT",
  "DICTIONARY",
].map((value) => ({ label: value, value }));

const FIELD_TYPE_OPTIONS = [
  "STRING",
  "NUMBER",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "DECIMAL",
  "JSON",
].map((value) => ({ label: value, value }));

const RELATION_TYPE_OPTIONS = ["1:1", "1:N", "N:1", "N:N"].map((value) => ({ label: value, value }));

const LOGICAL_ROLE_META: Record<string, { label: string; accent: string; surface: string }> = {
  MASTER: { label: "\u4e3b\u6570\u636e", accent: "#1677ff", surface: "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)" },
  TRANSACTION: { label: "\u4ea4\u6613\u4e8b\u5b9e", accent: "#7c3aed", surface: "linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)" },
  DETAIL: { label: "\u660e\u7ec6", accent: "#0f766e", surface: "linear-gradient(180deg, #ecfeff 0%, #ffffff 100%)" },
  BRIDGE: { label: "\u6865\u63a5", accent: "#d97706", surface: "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" },
  LOG: { label: "\u65e5\u5fd7", accent: "#be123c", surface: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)" },
  SNAPSHOT: { label: "\u5feb\u7167", accent: "#1d4ed8", surface: "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)" },
  DICTIONARY: { label: "\u5b57\u5178", accent: "#4f46e5", surface: "linear-gradient(180deg, #eef2ff 0%, #ffffff 100%)" },
  DEFAULT: { label: "\u903b\u8f91\u8868", accent: "#3f3f46", surface: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)" },
};

type LogicalTableNodeData = {
  table: TableRow;
  relationCount: number;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeStringArray(value: unknown) {
  return Array.from(new Set(safeArray(value).map((item) => String(item || "").trim()).filter(Boolean)));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return String(value).replace("T", " ").replace(/\.\d+Z?$/, "");
}

function renderStatus(value: string, metaMap: Record<string, { color: string; label: string }>) {
  const meta = metaMap[value] || { color: "default", label: value || "-" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function renderCodeTags(values: string[]) {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return (
    <Space size={[4, 4]} wrap>
      {values.map((item) => <Tag key={item}>{item}</Tag>)}
    </Space>
  );
}

function stringifyValueRange(value: unknown) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function parseValueRange(value?: string) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function deriveRelations(tables: TableRow[]): RelationRow[] {
  const relations = tables.flatMap((table) =>
    (table.fields || []).map((field) => {
      if (!field.fieldName.endsWith("_id")) return null;
      const target = tables.find((candidate) =>
        candidate.tableName !== table.tableName
        && (candidate.fields || []).some((candidateField) => candidateField.fieldName === field.fieldName)
      );
      if (!target) return null;
      return {
        fromTable: table.tableName,
        fromField: field.fieldName,
        toTable: target.tableName,
        toField: field.fieldName,
        relationType: "N:1",
      };
    })
  ).filter((item): item is RelationRow => Boolean(item));
  return Array.from(
    new Map(relations.map((item) => [`${item.fromTable}.${item.fromField}.${item.toTable}.${item.toField}`, item])).values()
  );
}

function buildLogicalModelState(value: unknown): LogicalModelState {
  const source = safeObject(value);
  const tables = safeArray<Record<string, unknown>>(source.tables).map((table, tableIndex) => ({
    tableName: String(table.tableName || `table_${tableIndex + 1}`),
    tableLabel: String(table.tableLabel || table.tableName || `Table ${tableIndex + 1}`),
    tableComment: String(table.tableComment || ""),
    businessRole: String(table.businessRole || "MASTER"),
    keyInfoItems: safeArray(table.keyInfoItems),
    sourceRefs: safeStringArray(table.sourceRefs),
    fields: safeArray<Record<string, unknown>>(table.fields).map((field, fieldIndex) => ({
      fieldName: String(field.fieldName || `field_${fieldIndex + 1}`),
      fieldType: String(field.fieldType || "STRING"),
      required: Boolean(field.required),
      businessSemantic: String(field.businessSemantic || ""),
      fieldComment: String(field.fieldComment || ""),
    })),
  }));
  const modules = safeArray<Record<string, unknown>>(source.modules).map((module, moduleIndex) => ({
    moduleKey: String(module.moduleKey || `module_${moduleIndex + 1}`),
    moduleLabel: String(module.moduleLabel || module.moduleKey || `模块 ${moduleIndex + 1}`),
    summary: String(module.summary || ""),
    tableNames: safeStringArray(module.tableNames),
  }));
  const dictTables = safeArray<Record<string, unknown>>(source.dictTables).map((dictTable, dictIndex) => ({
    dictType: String(dictTable.dictType || `dict_${dictIndex + 1}`),
    dictName: String(dictTable.dictName || dictTable.dictType || `字典 ${dictIndex + 1}`),
    categoryCode: String(dictTable.categoryCode || ""),
    sourceRefs: safeStringArray(dictTable.sourceRefs),
    items: safeArray<Record<string, unknown>>(dictTable.items).map((item, itemIndex) => ({
      itemCode: String(item.itemCode || `item_${itemIndex + 1}`),
      itemLabel: String(item.itemLabel || item.itemCode || `项 ${itemIndex + 1}`),
      valueRange: item.valueRange ?? null,
      sourceRefs: safeStringArray(item.sourceRefs),
    })),
  }));
  const relationRows = safeArray<Record<string, unknown>>(source.relations).map((relation) => ({
    fromTable: String(relation.fromTable || ""),
    fromField: String(relation.fromField || ""),
    toTable: String(relation.toTable || ""),
    toField: String(relation.toField || ""),
    relationType: String(relation.relationType || "N:1"),
  })).filter((relation) => relation.fromTable && relation.fromField && relation.toTable && relation.toField);
  return {
    modules,
    tables,
    dictTables,
    relations: relationRows.length > 0 ? relationRows : deriveRelations(tables),
  };
}

function buildLogicalModelPayload(
  state: LogicalModelState,
  template: LabBusinessSystemTemplateRecord,
  baseVersion: LabBusinessSystemLogicalModelVersionRecord | null
) {
  const baseModel = safeObject(baseVersion?.logicalModel);
  return {
    meta: {
      ...safeObject(baseModel.meta),
      templateName: template.templateName,
      templateCode: template.templateCode,
    },
    blueprint: {
      ...safeObject(baseModel.blueprint),
      industryCode: template.industryCode,
      templateDesc: template.templateDesc || "",
      sourceCategoryCodes: template.sourceCategoryCodes || [],
      sourceIncubationId: template.sourceIncubationId ?? null,
    },
    modules: state.modules,
    tables: state.tables,
    dictTables: state.dictTables,
    relations: state.relations,
  };
}

function buildSummary(state: LogicalModelState) {
  return {
    moduleCount: state.modules.length,
    tableCount: state.tables.length,
    fieldCount: state.tables.reduce((sum, item) => sum + item.fields.length, 0),
    dictCount: state.dictTables.length,
    relationCount: state.relations.length,
  };
}

function LegacyErGraph({ tables, relations }: { tables: TableRow[]; relations: RelationRow[] }) {
  if (tables.length === 0) {
    return <Empty description="暂无逻辑表，无法生成 ER 预览" />;
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, tables.length))));
  const nodes = tables.map((table, index) => ({
    table,
    x: 40 + (index % cols) * 320,
    y: 40 + Math.floor(index / cols) * 220,
    width: 240,
    height: 132,
  }));
  const map = new Map(nodes.map((node) => [node.table.tableName, node]));
  const width = Math.max(900, ...nodes.map((node) => node.x + node.width + 60));
  const height = Math.max(320, ...nodes.map((node) => node.y + node.height + 60));

  return (
    <div style={{ overflowX: "auto", border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
      <svg width={width} height={height}>
        {relations.map((relation, index) => {
          const from = map.get(relation.fromTable);
          const to = map.get(relation.toTable);
          if (!from || !to) return null;
          const x1 = from.x + from.width;
          const y1 = from.y + from.height / 2;
          const x2 = to.x;
          const y2 = to.y + to.height / 2;
          const mx = (x1 + x2) / 2;
          return (
            <g key={`${relation.fromTable}.${relation.fromField}.${relation.toTable}.${relation.toField}.${index}`}>
              <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#8c8c8c" strokeWidth="2" fill="none" />
              <text x={mx} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="12" fill="#8c8c8c">
                {relation.relationType}
              </text>
            </g>
          );
        })}
        {nodes.map((node) => (
          <g key={node.table.tableName}>
            <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="12" fill="#fff" stroke="#d9d9d9" />
            <text x={node.x + 16} y={node.y + 26} fontSize="16" fontWeight="bold">{node.table.tableName}</text>
            <text x={node.x + 16} y={node.y + 48} fontSize="12" fill="#8c8c8c">
              {node.table.tableLabel || node.table.tableComment || node.table.tableName}
            </text>
            <text x={node.x + 16} y={node.y + 72} fontSize="12" fill="#595959">字段数：{node.table.fields.length}</text>
            <text x={node.x + 16} y={node.y + 94} fontSize="12" fill="#595959">角色：{node.table.businessRole || "-"}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function getLogicalRoleMeta(role?: string) {
  return LOGICAL_ROLE_META[role || ""] || LOGICAL_ROLE_META.DEFAULT;
}

function getRelationMeta(relationType: string) {
  switch (relationType) {
    case "1:1":
      return { stroke: "#1677ff", background: "rgba(22, 119, 255, 0.14)" };
    case "1:N":
      return { stroke: "#7c3aed", background: "rgba(124, 58, 237, 0.16)" };
    case "N:1":
      return { stroke: "#08979c", background: "rgba(8, 151, 156, 0.16)" };
    case "N:N":
      return { stroke: "#d97706", background: "rgba(217, 119, 6, 0.16)" };
    default:
      return { stroke: "#8c8c8c", background: "rgba(140, 140, 140, 0.16)" };
  }
}

const ER_NODE_WIDTH = 300;
const ER_SOURCE_HANDLE_IDS = {
  left: "source-left",
  right: "source-right",
  top: "source-top",
  bottom: "source-bottom",
} as const;
const ER_TARGET_HANDLE_IDS = {
  left: "target-left",
  right: "target-right",
  top: "target-top",
  bottom: "target-bottom",
} as const;

function resolveErHandleDirections(sourcePosition: { x: number; y: number }, targetPosition: { x: number; y: number }) {
  const sourceCenterX = sourcePosition.x + ER_NODE_WIDTH / 2;
  const sourceCenterY = sourcePosition.y + 180;
  const targetCenterX = targetPosition.x + ER_NODE_WIDTH / 2;
  const targetCenterY = targetPosition.y + 180;
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: ER_SOURCE_HANDLE_IDS.right, targetHandle: ER_TARGET_HANDLE_IDS.left }
      : { sourceHandle: ER_SOURCE_HANDLE_IDS.left, targetHandle: ER_TARGET_HANDLE_IDS.right };
  }
  return dy >= 0
    ? { sourceHandle: ER_SOURCE_HANDLE_IDS.bottom, targetHandle: ER_TARGET_HANDLE_IDS.top }
    : { sourceHandle: ER_SOURCE_HANDLE_IDS.top, targetHandle: ER_TARGET_HANDLE_IDS.bottom };
}

function buildRelationCountMap(tables: TableRow[], relations: RelationRow[]) {
  const countMap = new Map<string, number>(tables.map((table) => [table.tableName, 0]));
  relations.forEach((relation) => {
    if (countMap.has(relation.fromTable)) {
      countMap.set(relation.fromTable, (countMap.get(relation.fromTable) || 0) + 1);
    }
    if (countMap.has(relation.toTable) && relation.toTable !== relation.fromTable) {
      countMap.set(relation.toTable, (countMap.get(relation.toTable) || 0) + 1);
    }
  });
  return countMap;
}

function buildErPositions(tables: TableRow[], relations: RelationRow[]) {
  const tableMap = new Map(tables.map((table) => [table.tableName, table]));
  const relationCountMap = buildRelationCountMap(tables, relations);
  const positions = new Map<string, { x: number; y: number }>();
  const anchorTables = tables
    .filter((table) => String(table.businessRole || "").toUpperCase() === "MASTER")
    .sort((left, right) => {
      const relationDelta = (relationCountMap.get(right.tableName) || 0) - (relationCountMap.get(left.tableName) || 0);
      if (relationDelta !== 0) return relationDelta;
      return right.fields.length - left.fields.length;
    });
  const fallbackAnchors = tables
    .filter((table) => !anchorTables.some((anchor) => anchor.tableName === table.tableName))
    .sort((left, right) => {
      const relationDelta = (relationCountMap.get(right.tableName) || 0) - (relationCountMap.get(left.tableName) || 0);
      if (relationDelta !== 0) return relationDelta;
      return right.fields.length - left.fields.length;
    });
  const anchors = anchorTables.length > 0 ? anchorTables : fallbackAnchors.slice(0, Math.max(1, Math.ceil(tables.length / 4)));
  const anchorNames = new Set(anchors.map((table) => table.tableName));
  const groupedSatellites = new Map<string, TableRow[]>(anchors.map((table) => [table.tableName, []]));
  const overflowTables: TableRow[] = [];

  fallbackAnchors.forEach((table) => {
    if (anchorNames.has(table.tableName)) return;
    const linkedAnchors = relations
      .filter((relation) => relation.fromTable === table.tableName || relation.toTable === table.tableName)
      .map((relation) => (relation.fromTable === table.tableName ? relation.toTable : relation.fromTable))
      .filter((tableName) => anchorNames.has(tableName));
    const anchorName = linkedAnchors[0] || anchors[0]?.tableName;
    if (!anchorName) {
      overflowTables.push(table);
      return;
    }
    groupedSatellites.get(anchorName)?.push(table);
  });

  const anchorColumns = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(Math.max(1, anchors.length)))));
  const anchorCellWidth = 760;
  const anchorCellHeight = 660;

  anchors.forEach((anchor, index) => {
    const col = index % anchorColumns;
    const row = Math.floor(index / anchorColumns);
    const groupOriginX = 52 + col * anchorCellWidth;
    const groupOriginY = 32 + row * anchorCellHeight;
    const anchorX = groupOriginX + 230;
    const anchorY = groupOriginY + 210;
    positions.set(anchor.tableName, { x: anchorX, y: anchorY });

    const satellites = (groupedSatellites.get(anchor.tableName) || []).sort((left, right) => {
      const relationDelta = (relationCountMap.get(right.tableName) || 0) - (relationCountMap.get(left.tableName) || 0);
      if (relationDelta !== 0) return relationDelta;
      return right.fields.length - left.fields.length;
    });
    const slots = [
      { x: -320, y: -170 },
      { x: 320, y: -170 },
      { x: -340, y: 150 },
      { x: 340, y: 150 },
      { x: 0, y: -320 },
      { x: 0, y: 320 },
      { x: -300, y: 400 },
      { x: 300, y: 400 },
    ];

    satellites.forEach((table, satelliteIndex) => {
      const ringIndex = Math.floor(satelliteIndex / slots.length);
      const slot = slots[satelliteIndex % slots.length];
      const spreadX = ringIndex * 130;
      const spreadY = ringIndex * 120;
      positions.set(table.tableName, {
        x: anchorX + slot.x + (slot.x >= 0 ? spreadX : -spreadX),
        y: anchorY + slot.y + (slot.y >= 0 ? spreadY : -spreadY),
      });
    });
  });

  overflowTables.forEach((table, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    positions.set(table.tableName, {
      x: 90 + col * 430,
      y: 60 + Math.ceil(anchors.length / anchorColumns) * anchorCellHeight + row * 320,
    });
  });

  return positions;
}

function buildErNodes(tables: TableRow[], relations: RelationRow[]): Node<LogicalTableNodeData>[] {
  const positions = buildErPositions(tables, relations);
  const relationCountMap = buildRelationCountMap(tables, relations);
  return tables.map((table) => ({
    id: table.tableName,
    type: "logicalTable",
    position: positions.get(table.tableName) || { x: 0, y: 0 },
    data: {
      table,
      relationCount: relationCountMap.get(table.tableName) || 0,
    },
  }));
}

function buildErEdges(relations: RelationRow[], nodePositions: Map<string, { x: number; y: number }>): Edge[] {
  return relations
    .filter((relation) => nodePositions.has(relation.fromTable) && nodePositions.has(relation.toTable))
    .map((relation, index) => {
      const relationMeta = getRelationMeta(relation.relationType);
      const sourcePosition = nodePositions.get(relation.fromTable) || { x: 0, y: 0 };
      const targetPosition = nodePositions.get(relation.toTable) || { x: 0, y: 0 };
      const { sourceHandle, targetHandle } = resolveErHandleDirections(sourcePosition, targetPosition);
      return {
        id: `${relation.fromTable}.${relation.fromField}.${relation.toTable}.${relation.toField}.${index}`,
        source: relation.fromTable,
        target: relation.toTable,
        sourceHandle,
        targetHandle,
        type: "smoothstep",
        animated: false,
        label: relation.relationType,
        style: {
          stroke: relationMeta.stroke,
          strokeWidth: 3.4,
        },
        labelStyle: {
          fill: "#262626",
          fontSize: 12,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: relationMeta.background,
          fillOpacity: 1,
          stroke: relationMeta.stroke,
          strokeOpacity: 0.18,
        },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 14,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: relationMeta.stroke,
        },
      };
    });
}

function LogicalTableNodeView({ data, selected }: NodeProps<LogicalTableNodeData>) {
  const roleMeta = getLogicalRoleMeta(data.table.businessRole);
  const previewFields = data.table.fields.slice(0, 6);
  const hiddenFieldCount = Math.max(0, data.table.fields.length - previewFields.length);

  return (
    <div
      style={{
        width: 300,
        borderRadius: 20,
        border: "1px solid " + (selected ? roleMeta.accent : "rgba(15, 23, 42, 0.08)"),
        background: roleMeta.surface,
        boxShadow: selected
          ? "0 0 0 3px " + roleMeta.accent + "22, 0 24px 56px rgba(15, 23, 42, 0.16)"
          : "0 18px 40px rgba(15, 23, 42, 0.10)",
        overflow: "hidden",
      }}
    >
      <Handle id={ER_TARGET_HANDLE_IDS.left} type="target" position={Position.Left} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />
      <Handle id={ER_TARGET_HANDLE_IDS.right} type="target" position={Position.Right} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />
      <Handle id={ER_TARGET_HANDLE_IDS.top} type="target" position={Position.Top} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />
      <Handle id={ER_TARGET_HANDLE_IDS.bottom} type="target" position={Position.Bottom} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />
      <Handle id={ER_SOURCE_HANDLE_IDS.left} type="source" position={Position.Left} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />
      <Handle id={ER_SOURCE_HANDLE_IDS.right} type="source" position={Position.Right} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />
      <Handle id={ER_SOURCE_HANDLE_IDS.top} type="source" position={Position.Top} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />
      <Handle id={ER_SOURCE_HANDLE_IDS.bottom} type="source" position={Position.Bottom} style={{ width: 11, height: 11, background: roleMeta.accent, border: "2px solid #ffffff" }} />

      <div
        style={{
          padding: "16px 18px 14px",
          background: "linear-gradient(135deg, " + roleMeta.accent + " 0%, " + roleMeta.accent + "cc 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, opacity: 0.86 }}>{roleMeta.label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, wordBreak: "break-word" }}>{data.table.tableName}</div>
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, opacity: 0.92 }}>
          {data.table.tableLabel || data.table.tableComment || "\u672a\u8865\u5145\u4e1a\u52a1\u8bf4\u660e"}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div style={{ borderRadius: 14, background: "rgba(15, 23, 42, 0.04)", padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>{"\u5b57\u6bb5\u6570"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1f1f1f" }}>{data.table.fields.length}</div>
          </div>
          <div style={{ borderRadius: 14, background: "rgba(15, 23, 42, 0.04)", padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>{"\u5173\u8054\u6570"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1f1f1f" }}>{data.relationCount}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            borderRadius: 16,
            border: "1px solid rgba(15, 23, 42, 0.06)",
            background: "#ffffff",
            padding: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#434343", marginBottom: 8 }}>{"\u5b57\u6bb5\u9884\u89c8"}</div>
          <Space direction="vertical" size={6} style={{ display: "flex" }}>
            {previewFields.map((field) => (
              <div
                key={field.fieldName}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <Typography.Text style={{ fontFamily: "Consolas, Menlo, monospace", color: "#1f1f1f" }}>
                  {field.fieldName}
                </Typography.Text>
                <Typography.Text type="secondary">{field.fieldType}</Typography.Text>
              </div>
            ))}
            {hiddenFieldCount > 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                +{hiddenFieldCount}{" \u4e2a\u5b57\u6bb5\u672a\u5c55\u5f00"}
              </Typography.Text>
            ) : null}
          </Space>
        </div>
      </div>
    </div>
  );
}

const erNodeTypes = { logicalTable: LogicalTableNodeView };

function ErGraphCanvas({
  tables,
  relations,
  onInspectTable,
  onEditTable,
  onCreateField,
}: {
  tables: TableRow[];
  relations: RelationRow[];
  onInspectTable?: (tableName: string) => void;
  onEditTable?: (tableName: string) => void;
  onCreateField?: (tableName: string) => void;
}) {
  if (tables.length === 0) {
    return <Empty description={"\u6682\u65e0\u903b\u8f91\u8868\uff0c\u65e0\u6cd5\u751f\u6210 ER \u9884\u89c8"} />;
  }

  const flowNodes = useMemo(() => buildErNodes(tables, relations), [tables, relations]);
  const [nodes, setNodes] = useState<Node<LogicalTableNodeData>[]>(flowNodes);
  const [selectedTableName, setSelectedTableName] = useState<string>("");

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes]);

  useEffect(() => {
    setSelectedTableName((current) => (tables.some((table) => table.tableName === current) ? current : ""));
  }, [tables]);

  const flowEdges = useMemo(() => {
    const nodePositionMap = new Map(nodes.map((node) => [node.id, node.position]));
    return buildErEdges(relations, nodePositionMap);
  }, [nodes, relations]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.tableName === selectedTableName) || null,
    [selectedTableName, tables]
  );
  const selectedRelations = useMemo(
    () => relations.filter((relation) => relation.fromTable === selectedTable?.tableName || relation.toTable === selectedTable?.tableName),
    [relations, selectedTable?.tableName]
  );
  const selectedRoleMeta = getLogicalRoleMeta(selectedTable?.businessRole);

  return (
    <ReactFlowProvider>
      <Space direction="vertical" size={12} style={{ display: "flex" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          <div style={{ flex: selectedTable ? "1 1 900px" : "1 1 100%", minWidth: 0 }}>
            <div
              style={{
                height: 680,
                borderRadius: 24,
                overflow: "hidden",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                background: "linear-gradient(180deg, #fcfcfd 0%, #f8fafc 100%)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
              }}
            >
              <ReactFlow
                fitView
                minZoom={0.35}
                maxZoom={1.6}
                nodes={nodes}
                edges={flowEdges}
                nodeTypes={erNodeTypes}
                nodesConnectable={false}
                onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
                onNodeClick={(_event, node) => setSelectedTableName(node.id)}
                onNodeDoubleClick={(_event, node) => onEditTable?.(node.id)}
                onPaneClick={() => setSelectedTableName("")}
                fitViewOptions={{ padding: 0.1, maxZoom: 1.16 }}
                defaultEdgeOptions={{ type: "smoothstep" }}
                proOptions={{ hideAttribution: true }}
                style={{ background: "transparent" }}
              >
                <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#dbe4f0" />
                <MiniMap
                  pannable
                  zoomable
                  nodeBorderRadius={12}
                  maskColor="rgba(15, 23, 42, 0.08)"
                  nodeColor={(node) => getLogicalRoleMeta((node.data as LogicalTableNodeData | undefined)?.table.businessRole).accent}
                  style={{
                    background: "rgba(255, 255, 255, 0.92)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                    borderRadius: 16,
                  }}
                />
                <Controls
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
                  }}
                />
              </ReactFlow>
            </div>
          </div>

          {selectedTable ? (
            <Card
              title={"\u8bbe\u8ba1\u8be6\u60c5"}
              extra={(
                <Space size={8}>
                  <Tag color="processing">{selectedRoleMeta.label}</Tag>
                  <Button type="text" size="small" icon={<CloseOutlined />} aria-label={"\u5173\u95ed\u8be6\u60c5"} onClick={() => setSelectedTableName("")} />
                </Space>
              )}
              style={{
                flex: "0 0 340px",
                width: 340,
                maxWidth: "100%",
                borderRadius: 24,
                border: "1px solid rgba(15, 23, 42, 0.08)",
              }}
              styles={{ body: { paddingTop: 12 } }}
            >
              <Space direction="vertical" size={14} style={{ display: "flex" }}>
                <div
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    background: selectedRoleMeta.surface,
                    border: "1px solid " + selectedRoleMeta.accent + "22",
                  }}
                >
                  <Typography.Title level={5} style={{ margin: 0, wordBreak: "break-word" }}>
                    {selectedTable.tableName}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {selectedTable.tableLabel || selectedTable.tableComment || "\u672a\u8865\u5145\u4e1a\u52a1\u8bf4\u660e"}
                  </Typography.Text>
                  <div style={{ marginTop: 10 }}>
                    <Tag color="blue">{selectedTable.fields.length}{" \u4e2a\u5b57\u6bb5"}</Tag>
                    <Tag color="cyan">{selectedRelations.length}{" \u6761\u5173\u7cfb"}</Tag>
                  </div>
                </div>

                <Space wrap>
                  <Button type="primary" onClick={() => onInspectTable?.(selectedTable.tableName)}>
                    {"\u67e5\u770b\u8868\u8bbe\u8ba1"}
                  </Button>
                  <Button onClick={() => onEditTable?.(selectedTable.tableName)}>{"\u7f16\u8f91\u903b\u8f91\u8868"}</Button>
                  <Button onClick={() => onCreateField?.(selectedTable.tableName)}>{"\u65b0\u589e\u5b57\u6bb5"}</Button>
                </Space>

                <div>
                  <Typography.Text strong>{"\u8868\u8bf4\u660e"}</Typography.Text>
                  <div style={{ marginTop: 8, color: "#595959", lineHeight: 1.7 }}>
                    {selectedTable.tableComment || "\u6682\u65e0\u8868\u8bf4\u660e"}
                  </div>
                </div>

                <div>
                  <Typography.Text strong>{"\u5b57\u6bb5\u6e05\u5355"}</Typography.Text>
                  <div
                    style={{
                      marginTop: 10,
                      maxHeight: 280,
                      overflowY: "auto",
                      borderRadius: 16,
                      border: "1px solid rgba(15, 23, 42, 0.06)",
                      background: "#fafafa",
                      padding: 12,
                    }}
                  >
                    <Space direction="vertical" size={8} style={{ display: "flex" }}>
                      {selectedTable.fields.map((field) => (
                        <div
                          key={field.fieldName}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: 10,
                            alignItems: "start",
                            padding: "8px 10px",
                            borderRadius: 12,
                            background: "#ffffff",
                          }}
                        >
                          <div>
                            <Typography.Text style={{ fontFamily: "Consolas, Menlo, monospace", color: "#1f1f1f" }}>
                              {field.fieldName}
                            </Typography.Text>
                            <div style={{ marginTop: 4, fontSize: 12, color: "#8c8c8c" }}>
                              {field.businessSemantic || field.fieldComment || "\u672a\u8865\u5145\u5b57\u6bb5\u8bf4\u660e"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <Tag>{field.fieldType}</Tag>
                            {field.required ? <Tag color="processing">{"\u5fc5\u586b"}</Tag> : null}
                          </div>
                        </div>
                      ))}
                    </Space>
                  </div>
                </div>

                <div>
                  <Typography.Text strong>{"\u5173\u7cfb\u6d41\u8f6c"}</Typography.Text>
                  <Space direction="vertical" size={8} style={{ display: "flex", marginTop: 10 }}>
                    {selectedRelations.length === 0 ? (
                      <Typography.Text type="secondary">{"\u5f53\u524d\u4e3b\u6570\u636e\u8868\u6682\u65e0\u5173\u7cfb\u5b9a\u4e49"}</Typography.Text>
                    ) : (
                      selectedRelations.map((relation) => {
                        const targetTableName = relation.fromTable === selectedTable.tableName ? relation.toTable : relation.fromTable;
                        const relationMeta = getRelationMeta(relation.relationType);
                        return (
                          <div
                            key={relation.fromTable + "." + relation.fromField + "." + relation.toTable + "." + relation.toField}
                            style={{
                              padding: 12,
                              borderRadius: 14,
                              background: "#ffffff",
                              border: "1px solid rgba(15, 23, 42, 0.06)",
                            }}
                          >
                            <Space direction="vertical" size={6} style={{ display: "flex" }}>
                              <Space wrap>
                                <Tag color="blue">{relation.fromTable}.{relation.fromField}</Tag>
                                <Tag color="geekblue">{relation.relationType}</Tag>
                                <Tag color="cyan">{relation.toTable}.{relation.toField}</Tag>
                              </Space>
                              <Button
                                type="link"
                                style={{ color: relationMeta.stroke, padding: 0, height: "auto", alignSelf: "flex-start" }}
                                onClick={() => setSelectedTableName(targetTableName)}
                              >
                                {"\u8df3\u8f6c\u5230 "}{targetTableName}
                              </Button>
                            </Space>
                          </div>
                        );
                      })
                    )}
                  </Space>
                </div>
              </Space>
            </Card>
          ) : null}
        </div>
      </Space>
    </ReactFlowProvider>
  );
}

function ErGraph(props: {
  tables: TableRow[];
  relations: RelationRow[];
  onInspectTable?: (tableName: string) => void;
  onEditTable?: (tableName: string) => void;
  onCreateField?: (tableName: string) => void;
}) {
  if (props.tables.length === 0) {
    return <Empty description="暂无逻辑表，无法生成 ER 预览" />;
  }
  return <ErGraphCanvas {...props} />;
}

export function ScenarioTemplateDetailPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const templateId = Number(id || 0);
  const [template, setTemplate] = useState<LabBusinessSystemTemplateRecord | null>(null);
  const [versions, setVersions] = useState<LabBusinessSystemLogicalModelVersionRecord[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | undefined>(undefined);
  const [logicalState, setLogicalState] = useState<LogicalModelState>({ modules: [], tables: [], dictTables: [], relations: [] });
  const [versionSummary, setVersionSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [dictItemOpen, setDictItemOpen] = useState(false);
  const [relationOpen, setRelationOpen] = useState(false);
  const [moduleIndex, setModuleIndex] = useState<number | null>(null);
  const [tableIndex, setTableIndex] = useState<number | null>(null);
  const [fieldContext, setFieldContext] = useState<{ tableIndex: number; fieldIndex: number | null } | null>(null);
  const [dictContext, setDictContext] = useState<{ dictIndex: number; itemIndex: number | null } | null>(null);
  const [relationIndex, setRelationIndex] = useState<number | null>(null);
  const [basicForm] = Form.useForm<LabBusinessSystemTemplateUpdatePayload>();
  const [moduleForm] = Form.useForm<ModuleRow>();
  const [tableForm] = Form.useForm<TableRow>();
  const [fieldForm] = Form.useForm<FieldRow>();
  const [dictForm] = Form.useForm<DictTableRow>();
  const [dictItemForm] = Form.useForm<DictItemFormValues>();
  const [relationForm] = Form.useForm<RelationRow>();

  const activeVersion = useMemo(
    () => versions.find((item) => item.id === activeVersionId) || versions[0] || null,
    [activeVersionId, versions]
  );
  const currentRelations = useMemo(
    () => (logicalState.relations.length > 0 ? logicalState.relations : deriveRelations(logicalState.tables)),
    [logicalState.relations, logicalState.tables]
  );
  const summary = useMemo(
    () => buildSummary({ ...logicalState, relations: currentRelations }),
    [currentRelations, logicalState]
  );
  const tableOptions = useMemo(
    () => logicalState.tables.map((item) => ({ label: item.tableName, value: item.tableName })),
    [logicalState.tables]
  );
  const selectedFromTable = Form.useWatch("fromTable", relationForm);
  const selectedToTable = Form.useWatch("toTable", relationForm);
  const fromFieldOptions = useMemo(
    () => (logicalState.tables.find((item) => item.tableName === selectedFromTable)?.fields || []).map((field) => ({
      label: field.fieldName,
      value: field.fieldName,
    })),
    [logicalState.tables, selectedFromTable]
  );
  const toFieldOptions = useMemo(
    () => (logicalState.tables.find((item) => item.tableName === selectedToTable)?.fields || []).map((field) => ({
      label: field.fieldName,
      value: field.fieldName,
    })),
    [logicalState.tables, selectedToTable]
  );

  async function loadData(preferredVersionId?: number) {
    if (!token || !templateId) return;
    setLoading(true);
    try {
      const [templateResponse, versionResponse] = await Promise.all([
        fetchBusinessSystemTemplateDetail(token, templateId),
        fetchBusinessSystemTemplateLogicalVersions(token, templateId),
      ]);
      const nextTemplate = templateResponse.data;
      const nextVersions = versionResponse.data;
      setTemplate(nextTemplate);
      setVersions(nextVersions);
      basicForm.setFieldsValue({
        templateName: nextTemplate.templateName,
        templateCode: nextTemplate.templateCode,
        industryCode: nextTemplate.industryCode,
        templateDesc: nextTemplate.templateDesc || undefined,
        templateStatus: (nextTemplate.templateStatus as "draft" | "active" | "archived") || "draft",
      });
      const nextActiveVersionId = preferredVersionId
        || nextVersions.find((item) => item.isCurrent)?.id
        || nextTemplate.logicalVersionId
        || nextVersions[0]?.id;
      setActiveVersionId(nextActiveVersionId || undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !templateId) return;
    void loadData();
  }, [token, templateId]);

  useEffect(() => {
    setLogicalState(buildLogicalModelState(activeVersion?.logicalModel || template?.currentLogicalModel || null));
    setVersionSummary("");
  }, [activeVersion?.id, template?.id]);

  function findTableIndex(tableName: string) {
    return logicalState.tables.findIndex((item) => item.tableName === tableName);
  }

  function findDictIndex(dictType: string) {
    return logicalState.dictTables.findIndex((item) => item.dictType === dictType);
  }

  async function handleSaveBasic() {
    if (!token || !templateId) return;
    const values = await basicForm.validateFields();
    setSavingBasic(true);
    try {
      const response = await updateBusinessSystemTemplateBasic(token, templateId, values);
      setTemplate(response.data);
      basicForm.setFieldsValue({
        templateName: response.data.templateName,
        templateCode: response.data.templateCode,
        industryCode: response.data.industryCode,
        templateDesc: response.data.templateDesc || undefined,
        templateStatus: (response.data.templateStatus as "draft" | "active" | "archived") || "draft",
      });
      message.success("模板基础信息已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "模板基础信息保存失败");
    } finally {
      setSavingBasic(false);
    }
  }

  async function handleSaveLogicalVersion() {
    if (!token || !templateId || !template) return;
    setSavingVersion(true);
    try {
      const response = await saveBusinessSystemTemplateLogicalModel(token, templateId, {
        logicalModel: buildLogicalModelPayload({ ...logicalState, relations: currentRelations }, template, activeVersion),
        summary: versionSummary || undefined,
      });
      message.success(`逻辑模型已保存为 V${response.data.version?.versionNo || "-"}`);
      await loadData(response.data.version?.id || undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "逻辑模型保存失败");
    } finally {
      setSavingVersion(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!token || !templateId || !template) return;
    setDeletingTemplate(true);
    try {
      const response = await deleteBusinessSystemTemplate(token, templateId);
      message.success(`已删除模板：${response.data.templateName}`);
      navigate("/dashboard/data-modeling/logical-models");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除模板失败");
    } finally {
      setDeletingTemplate(false);
    }
  }

  function openModule(index: number | null) {
    setModuleIndex(index);
    moduleForm.setFieldsValue(index === null
      ? { moduleKey: "", moduleLabel: "", summary: "", tableNames: [] }
      : logicalState.modules[index]);
    setModuleOpen(true);
  }

  async function saveModule() {
    const values = await moduleForm.validateFields();
    setLogicalState((current) => {
      const next = clone(current);
      const row: ModuleRow = {
        moduleKey: String(values.moduleKey || "").trim(),
        moduleLabel: String(values.moduleLabel || "").trim(),
        summary: String(values.summary || "").trim(),
        tableNames: values.tableNames || [],
      };
      if (moduleIndex === null) next.modules.push(row);
      else next.modules[moduleIndex] = row;
      return next;
    });
    setModuleOpen(false);
  }

  function openTable(index: number | null) {
    setTableIndex(index);
    tableForm.setFieldsValue(index === null
      ? { tableName: "", tableLabel: "", tableComment: "", businessRole: "MASTER", fields: [] }
      : logicalState.tables[index]);
    setTableOpen(true);
  }

  async function saveTable() {
    const values = await tableForm.validateFields();
    setLogicalState((current) => {
      const next = clone(current);
      const fields = tableIndex === null ? [] : next.tables[tableIndex].fields;
      const keyInfoItems = tableIndex === null ? [] : next.tables[tableIndex].keyInfoItems;
      const sourceRefs = tableIndex === null ? [] : next.tables[tableIndex].sourceRefs;
      const previousTableName = tableIndex === null ? null : next.tables[tableIndex].tableName;
      const row: TableRow = {
        tableName: String(values.tableName || "").trim(),
        tableLabel: String(values.tableLabel || values.tableName || "").trim(),
        tableComment: String(values.tableComment || "").trim(),
        businessRole: String(values.businessRole || "MASTER"),
        fields,
        keyInfoItems,
        sourceRefs,
      };
      if (tableIndex === null) next.tables.push(row);
      else next.tables[tableIndex] = row;

      if (previousTableName && previousTableName !== row.tableName) {
        next.modules = next.modules.map((module) => ({
          ...module,
          tableNames: module.tableNames.map((tableName) => (tableName === previousTableName ? row.tableName : tableName)),
        }));
        next.relations = next.relations.map((relation) => ({
          ...relation,
          fromTable: relation.fromTable === previousTableName ? row.tableName : relation.fromTable,
          toTable: relation.toTable === previousTableName ? row.tableName : relation.toTable,
        }));
      }
      return next;
    });
    setTableOpen(false);
  }

  function openField(nextTableIndex: number, fieldIndex: number | null) {
    setFieldContext({ tableIndex: nextTableIndex, fieldIndex });
    fieldForm.setFieldsValue(fieldIndex === null
      ? { fieldName: "", fieldType: "STRING", required: false, businessSemantic: "", fieldComment: "" }
      : logicalState.tables[nextTableIndex].fields[fieldIndex]);
    setFieldOpen(true);
  }

  async function saveField() {
    if (!fieldContext) return;
    const values = await fieldForm.validateFields();
    setLogicalState((current) => {
      const next = clone(current);
      const previousFieldName = fieldContext.fieldIndex === null
        ? null
        : next.tables[fieldContext.tableIndex].fields[fieldContext.fieldIndex].fieldName;
      const row: FieldRow = {
        fieldName: String(values.fieldName || "").trim(),
        fieldType: String(values.fieldType || "STRING"),
        required: Boolean(values.required),
        businessSemantic: String(values.businessSemantic || "").trim(),
        fieldComment: String(values.fieldComment || "").trim(),
      };
      if (fieldContext.fieldIndex === null) next.tables[fieldContext.tableIndex].fields.push(row);
      else next.tables[fieldContext.tableIndex].fields[fieldContext.fieldIndex] = row;

      if (previousFieldName && previousFieldName !== row.fieldName) {
        const tableName = next.tables[fieldContext.tableIndex].tableName;
        next.relations = next.relations.map((relation) => ({
          ...relation,
          fromField: relation.fromTable === tableName && relation.fromField === previousFieldName ? row.fieldName : relation.fromField,
          toField: relation.toTable === tableName && relation.toField === previousFieldName ? row.fieldName : relation.toField,
        }));
      }
      return next;
    });
    setFieldOpen(false);
  }

  function openDict(index: number | null) {
    setDictContext(null);
    setTableIndex(null);
    dictForm.setFieldsValue(index === null
      ? { dictType: "", dictName: "", categoryCode: "", items: [] }
      : logicalState.dictTables[index]);
    setTableIndex(index);
    setDictOpen(true);
  }

  async function saveDict() {
    const values = await dictForm.validateFields();
    setLogicalState((current) => {
      const next = clone(current);
      const items = tableIndex === null ? [] : next.dictTables[tableIndex].items;
      const sourceRefs = tableIndex === null ? [] : next.dictTables[tableIndex].sourceRefs;
      const row: DictTableRow = {
        dictType: String(values.dictType || "").trim(),
        dictName: String(values.dictName || values.dictType || "").trim(),
        categoryCode: String(values.categoryCode || "").trim(),
        items,
        sourceRefs,
      };
      if (tableIndex === null) next.dictTables.push(row);
      else next.dictTables[tableIndex] = row;
      return next;
    });
    setDictOpen(false);
  }

  function openDictItem(dictIndex: number, itemIndex: number | null) {
    setDictContext({ dictIndex, itemIndex });
    dictItemForm.setFieldsValue(itemIndex === null
      ? { itemCode: "", itemLabel: "", valueRangeText: "" }
      : {
        itemCode: logicalState.dictTables[dictIndex].items[itemIndex].itemCode,
        itemLabel: logicalState.dictTables[dictIndex].items[itemIndex].itemLabel,
        valueRangeText: stringifyValueRange(logicalState.dictTables[dictIndex].items[itemIndex].valueRange),
      });
    setDictItemOpen(true);
  }

  async function saveDictItem() {
    if (!dictContext) return;
    const values = await dictItemForm.validateFields();
    setLogicalState((current) => {
      const next = clone(current);
      const sourceRefs = dictContext.itemIndex === null
        ? []
        : next.dictTables[dictContext.dictIndex].items[dictContext.itemIndex].sourceRefs;
      const row: DictItemRow = {
        itemCode: String(values.itemCode || "").trim(),
        itemLabel: String(values.itemLabel || "").trim(),
        valueRange: parseValueRange(values.valueRangeText),
        sourceRefs,
      };
      if (dictContext.itemIndex === null) next.dictTables[dictContext.dictIndex].items.push(row);
      else next.dictTables[dictContext.dictIndex].items[dictContext.itemIndex] = row;
      return next;
    });
    setDictItemOpen(false);
  }

  function openRelation(index: number | null) {
    setRelationIndex(index);
    relationForm.setFieldsValue(index === null
      ? { fromTable: "", fromField: "", toTable: "", toField: "", relationType: "N:1" }
      : currentRelations[index]);
    setRelationOpen(true);
  }

  async function saveRelation() {
    const values = await relationForm.validateFields();
    setLogicalState((current) => {
      const next = clone(current);
      next.relations = clone(currentRelations);
      const row: RelationRow = {
        fromTable: String(values.fromTable || "").trim(),
        fromField: String(values.fromField || "").trim(),
        toTable: String(values.toTable || "").trim(),
        toField: String(values.toField || "").trim(),
        relationType: String(values.relationType || "N:1"),
      };
      if (relationIndex === null) next.relations.push(row);
      else next.relations[relationIndex] = row;
      return next;
    });
    setRelationOpen(false);
  }

  const sourceAssetSnapshot = safeObject(activeVersion?.sourceAssetSnapshot);
  const sourceCategories = safeArray<Record<string, unknown>>(sourceAssetSnapshot.categoryCodes);

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false} loading={loading} styles={{ body: { padding: 16 } }}>
        <Space direction="vertical" size={10} style={{ display: "flex" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
                逻辑模型设计
              </Typography.Title>
            </div>
            <Space wrap>
              <Button onClick={() => navigate("/dashboard/data-modeling/logical-models")}>返回清单</Button>
              <Button loading={savingBasic} onClick={() => void handleSaveBasic()}>保存模板信息</Button>
              <Button type="primary" loading={savingVersion} onClick={() => void handleSaveLogicalVersion()}>
                保存为新版本
              </Button>
            </Space>
          </div>

          {!template ? (
            <Empty description="模板不存在或尚未加载完成" />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                <Card size="small" style={{ borderRadius: 18 }} styles={{ body: { padding: 14 } }}>
                  <Typography.Text type="secondary">模板编码</Typography.Text>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{template.templateCode}</div>
                </Card>
                <Card size="small" style={{ borderRadius: 18 }} styles={{ body: { padding: 14 } }}>
                  <Typography.Text type="secondary">行业编码</Typography.Text>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{template.industryCode}</div>
                </Card>
                <Card size="small" style={{ borderRadius: 18 }} styles={{ body: { padding: 14 } }}>
                  <Typography.Text type="secondary">逻辑表 / 字典表 / 关系</Typography.Text>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>
                    {summary.tableCount} / {summary.dictCount} / {summary.relationCount}
                  </div>
                </Card>
                <Card size="small" style={{ borderRadius: 18 }} styles={{ body: { padding: 14 } }}>
                  <Typography.Text type="secondary">当前版本</Typography.Text>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>
                    V{activeVersion?.versionNo || template.currentLogicalVersion || "-"}
                  </div>
                </Card>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 280px) minmax(280px, 1fr) minmax(220px, 320px)",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <div>
                  <Typography.Text strong>当前编辑版本</Typography.Text>
                  <Select
                    style={{ width: "100%", marginTop: 8 }}
                    value={activeVersion?.id}
                    options={versions.map((item) => ({
                      label: `V${item.versionNo}${item.isCurrent ? "（当前）" : ""}`,
                      value: item.id,
                    }))}
                    placeholder="选择要加载的版本"
                    onChange={(value) => setActiveVersionId(value)}
                  />
                </div>
                <div>
                  <Typography.Text strong>新版本说明</Typography.Text>
                  <Input
                    style={{ marginTop: 8 }}
                    value={versionSummary}
                    placeholder="例如：补充订单履约链路、完善字典项、修正主数据关系"
                    onChange={(event) => setVersionSummary(event.target.value)}
                  />
                </div>
                <div>
                  <Space size={[8, 8]} wrap>
                    {renderStatus(template.templateStatus, TEMPLATE_STATUS_META)}
                    {activeVersion ? renderStatus(activeVersion.versionStatus, VERSION_STATUS_META) : null}
                    <Tag color="blue">{summary.tableCount} 张逻辑表</Tag>
                    <Tag color="cyan">{summary.dictCount} 张字典表</Tag>
                    <Tag color="geekblue">{summary.fieldCount} 个字段</Tag>
                    <Tag color="purple">{sourceCategories.length || template.sourceCategoryCodes.length || 0} 个来源子类目</Tag>
                  </Space>
                </div>
              </div>
            </>
          )}
        </Space>
      </Card>

      <Card bordered={false}>
        <Tabs
          items={[
            {
              key: "modules",
              label: "模块规划",
              children: (
                <Space direction="vertical" size={12} style={{ display: "flex" }}>
                  <Button type="primary" onClick={() => openModule(null)}>新增模块</Button>
                  <Table<ModuleRow>
                    rowKey="moduleKey"
                    dataSource={logicalState.modules}
                    pagination={false}
                    locale={{ emptyText: <Empty description="暂无模块规划" /> }}
                    columns={[
                      { title: "模块标识", dataIndex: "moduleKey", width: 180 },
                      { title: "模块名称", dataIndex: "moduleLabel", width: 220 },
                      { title: "模块说明", dataIndex: "summary" },
                      { title: "关联逻辑表", dataIndex: "tableNames", render: (value: string[]) => renderCodeTags(value) },
                      {
                        title: "操作",
                        width: 180,
                        render: (_value, _record, index) => (
                          <Space>
                            <Button type="link" onClick={() => openModule(index)}>编辑</Button>
                            <Popconfirm
                              title="确认删除该模块？"
                              onConfirm={() => setLogicalState((current) => ({
                                ...current,
                                modules: current.modules.filter((_, currentIndex) => currentIndex !== index),
                              }))}
                            >
                              <Button type="link" danger>删除</Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: "tables",
              label: "逻辑表",
              children: (
                <Space direction="vertical" size={12} style={{ display: "flex" }}>
                  <Button type="primary" onClick={() => openTable(null)}>新增逻辑表</Button>
                  <Table<TableRow>
                    rowKey="tableName"
                    dataSource={logicalState.tables}
                    pagination={false}
                    locale={{ emptyText: <Empty description="暂无逻辑表" /> }}
                    expandable={{
                      expandedRowRender: (record) => {
                        const nextTableIndex = findTableIndex(record.tableName);
                        if (nextTableIndex < 0) return null;
                        return (
                          <Table<FieldRow>
                            rowKey="fieldName"
                            dataSource={logicalState.tables[nextTableIndex].fields}
                            pagination={false}
                            size="small"
                            columns={[
                              { title: "字段名", dataIndex: "fieldName", width: 220 },
                              { title: "字段类型", dataIndex: "fieldType", width: 120 },
                              {
                                title: "必填",
                                dataIndex: "required",
                                width: 100,
                                render: (value: boolean) => (value ? <Tag color="processing">必填</Tag> : <Tag>可空</Tag>),
                              },
                              { title: "业务语义", dataIndex: "businessSemantic", width: 180 },
                              { title: "字段说明", dataIndex: "fieldComment" },
                              {
                                title: "操作",
                                width: 180,
                                render: (_value, fieldRecord, fieldIndex) => (
                                  <Space>
                                    <Button type="link" onClick={() => openField(nextTableIndex, fieldIndex)}>编辑</Button>
                                    <Popconfirm
                                      title="确认删除该字段？"
                                      onConfirm={() => setLogicalState((current) => {
                                        const next = clone(current);
                                        next.tables[nextTableIndex].fields = next.tables[nextTableIndex].fields.filter((_, currentIndex) => currentIndex !== fieldIndex);
                                        next.relations = currentRelations.filter((relation) =>
                                          !(relation.fromTable === record.tableName && relation.fromField === fieldRecord.fieldName)
                                          && !(relation.toTable === record.tableName && relation.toField === fieldRecord.fieldName)
                                        );
                                        return next;
                                      })}
                                    >
                                      <Button type="link" danger>删除</Button>
                                    </Popconfirm>
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        );
                      },
                    }}
                    columns={[
                      { title: "逻辑表名", dataIndex: "tableName", width: 220 },
                      { title: "表标签", dataIndex: "tableLabel", width: 180 },
                      { title: "业务角色", dataIndex: "businessRole", width: 140 },
                      { title: "字段数", width: 90, align: "center", render: (_value, record) => record.fields.length },
                      { title: "表说明", dataIndex: "tableComment" },
                      {
                        title: "操作",
                        width: 240,
                        render: (_value, record, index) => (
                          <Space>
                            <Button type="link" onClick={() => openTable(index)}>编辑表</Button>
                            <Button type="link" onClick={() => openField(index, null)}>新增字段</Button>
                            <Popconfirm
                              title="确认删除该逻辑表？"
                              onConfirm={() => setLogicalState((current) => {
                                const next = clone(current);
                                next.tables = next.tables.filter((_, currentIndex) => currentIndex !== index);
                                next.modules = next.modules.map((module) => ({
                                  ...module,
                                  tableNames: module.tableNames.filter((tableName) => tableName !== record.tableName),
                                }));
                                next.relations = currentRelations.filter((relation) =>
                                  relation.fromTable !== record.tableName && relation.toTable !== record.tableName
                                );
                                return next;
                              })}
                            >
                              <Button type="link" danger>删除</Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: "dict",
              label: "字典表",
              children: (
                <Space direction="vertical" size={12} style={{ display: "flex" }}>
                  <Button type="primary" onClick={() => openDict(null)}>新增字典表</Button>
                  <Table<DictTableRow>
                    rowKey="dictType"
                    dataSource={logicalState.dictTables}
                    pagination={false}
                    locale={{ emptyText: <Empty description="暂无字典表" /> }}
                    expandable={{
                      expandedRowRender: (record) => {
                        const nextDictIndex = findDictIndex(record.dictType);
                        if (nextDictIndex < 0) return null;
                        return (
                          <Table<DictItemRow>
                            rowKey="itemCode"
                            dataSource={logicalState.dictTables[nextDictIndex].items}
                            pagination={false}
                            size="small"
                            columns={[
                              { title: "字典项编码", dataIndex: "itemCode", width: 220 },
                              { title: "字典项名称", dataIndex: "itemLabel", width: 220 },
                              {
                                title: "值域",
                                dataIndex: "valueRange",
                                render: (value: unknown) => {
                                  const text = stringifyValueRange(value);
                                  return text ? <Typography.Text style={{ whiteSpace: "pre-wrap" }}>{text}</Typography.Text> : "-";
                                },
                              },
                              {
                                title: "操作",
                                width: 180,
                                render: (_value, _itemRecord, itemIndex) => (
                                  <Space>
                                    <Button type="link" onClick={() => openDictItem(nextDictIndex, itemIndex)}>编辑</Button>
                                    <Popconfirm
                                      title="确认删除该字典项？"
                                      onConfirm={() => setLogicalState((current) => {
                                        const next = clone(current);
                                        next.dictTables[nextDictIndex].items = next.dictTables[nextDictIndex].items.filter((_, currentIndex) => currentIndex !== itemIndex);
                                        return next;
                                      })}
                                    >
                                      <Button type="link" danger>删除</Button>
                                    </Popconfirm>
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        );
                      },
                    }}
                    columns={[
                      { title: "字典类型", dataIndex: "dictType", width: 220 },
                      { title: "字典名称", dataIndex: "dictName", width: 220 },
                      { title: "所属子类目", dataIndex: "categoryCode", width: 180 },
                      { title: "字典项数", width: 100, align: "center", render: (_value, record) => record.items.length },
                      {
                        title: "操作",
                        width: 220,
                        render: (_value, _record, index) => (
                          <Space>
                            <Button type="link" onClick={() => openDict(index)}>编辑</Button>
                            <Button type="link" onClick={() => openDictItem(index, null)}>新增字典项</Button>
                            <Popconfirm
                              title="确认删除该字典表？"
                              onConfirm={() => setLogicalState((current) => ({
                                ...current,
                                dictTables: current.dictTables.filter((_, currentIndex) => currentIndex !== index),
                              }))}
                            >
                              <Button type="link" danger>删除</Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: "relations",
              label: "关系模型",
              children: (
                <Space direction="vertical" size={12} style={{ display: "flex" }}>
                  <Button type="primary" onClick={() => openRelation(null)}>新增关系</Button>
                  <Table<RelationRow>
                    rowKey={(record) => `${record.fromTable}.${record.fromField}.${record.toTable}.${record.toField}`}
                    dataSource={currentRelations}
                    pagination={false}
                    locale={{ emptyText: <Empty description="暂无关系定义" /> }}
                    columns={[
                      { title: "来源表", dataIndex: "fromTable", width: 180 },
                      { title: "来源字段", dataIndex: "fromField", width: 160 },
                      { title: "目标表", dataIndex: "toTable", width: 180 },
                      { title: "目标字段", dataIndex: "toField", width: 160 },
                      { title: "关系类型", dataIndex: "relationType", width: 120 },
                      {
                        title: "操作",
                        width: 180,
                        render: (_value, _record, index) => (
                          <Space>
                            <Button type="link" onClick={() => openRelation(index)}>编辑</Button>
                            <Popconfirm
                              title="确认删除该关系？"
                              onConfirm={() => setLogicalState((current) => ({
                                ...current,
                                relations: currentRelations.filter((_, currentIndex) => currentIndex !== index),
                              }))}
                            >
                              <Button type="link" danger>删除</Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: "er",
              label: "ER 视图",
              children: (
                <ErGraph
                  tables={logicalState.tables}
                  relations={currentRelations}
                  onInspectTable={(tableName) => {
                    const nextTableIndex = findTableIndex(tableName);
                    if (nextTableIndex >= 0) openTable(nextTableIndex);
                  }}
                  onEditTable={(tableName) => {
                    const nextTableIndex = findTableIndex(tableName);
                    if (nextTableIndex >= 0) openTable(nextTableIndex);
                  }}
                  onCreateField={(tableName) => {
                    const nextTableIndex = findTableIndex(tableName);
                    if (nextTableIndex >= 0) openField(nextTableIndex, null);
                  }}
                />
              ),
            },
            {
              key: "versions",
              label: "版本记录",
              children: (
                <Table<LabBusinessSystemLogicalModelVersionRecord>
                  rowKey="id"
                  dataSource={versions}
                  pagination={false}
                  locale={{ emptyText: <Empty description="暂无版本记录" /> }}
                  columns={[
                    {
                      title: "版本",
                      width: 120,
                      render: (_value, record) => (
                        <Space>
                          <Typography.Text strong>{`V${record.versionNo}`}</Typography.Text>
                          {record.isCurrent ? <Tag color="success">当前</Tag> : null}
                        </Space>
                      ),
                    },
                    { title: "状态", dataIndex: "versionStatus", width: 120, render: (value: string) => renderStatus(value, VERSION_STATUS_META) },
                    { title: "模块", dataIndex: "moduleCount", width: 80, align: "center" },
                    { title: "逻辑表", dataIndex: "logicalTableCount", width: 90, align: "center" },
                    { title: "字典", dataIndex: "dictionaryCount", width: 80, align: "center" },
                    { title: "关系", dataIndex: "relationCount", width: 80, align: "center" },
                    { title: "版本说明", dataIndex: "modelSummary" },
                    { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
                    {
                      title: "操作",
                      width: 120,
                      render: (_value, record) => (
                        <Button type="link" onClick={() => setActiveVersionId(record.id)}>
                          载入编辑器
                        </Button>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "settings",
              label: "模型设置",
              children: (
                <Space direction="vertical" size={16} style={{ display: "flex" }}>
                  <Card size="small" title="版本控制">
                    <Space direction="vertical" size={12} style={{ display: "flex" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) minmax(320px, 1fr)", gap: 16 }}>
                        <div>
                          <Typography.Text strong>当前编辑版本</Typography.Text>
                          <Select
                            style={{ width: "100%", marginTop: 8 }}
                            value={activeVersion?.id}
                            options={versions.map((item) => ({
                              label: `V${item.versionNo}${item.isCurrent ? "（当前）" : ""}`,
                              value: item.id,
                            }))}
                            placeholder="选择要加载的版本"
                            onChange={(value) => setActiveVersionId(value)}
                          />
                        </div>
                        <div>
                          <Typography.Text strong>新版本说明</Typography.Text>
                          <Input
                            style={{ marginTop: 8 }}
                            value={versionSummary}
                            placeholder="例如：补充订单履约链路、完善字典项、修正主数据关系"
                            onChange={(event) => setVersionSummary(event.target.value)}
                          />
                        </div>
                      </div>

                      <Descriptions bordered size="small" column={3}>
                        <Descriptions.Item label="版本状态">
                          {activeVersion ? renderStatus(activeVersion.versionStatus, VERSION_STATUS_META) : "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="版本创建时间">{formatDateTime(activeVersion?.createdAt)}</Descriptions.Item>
                        <Descriptions.Item label="来源子类目数">
                          {sourceCategories.length || template?.sourceCategoryCodes.length || 0}
                        </Descriptions.Item>
                      </Descriptions>
                    </Space>
                  </Card>

                  <Card
                    size="small"
                    title="模板信息"
                    extra={(
                      <Popconfirm
                        title="确认删除当前模板？"
                        description="删除后会同步移除模板及其逻辑版本；若模板下已存在业务系统实例，系统会阻止删除。"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={() => void handleDeleteTemplate()}
                      >
                        <Button danger loading={deletingTemplate}>删除模板</Button>
                      </Popconfirm>
                    )}
                  >
                    <Form form={basicForm} layout="vertical">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                        <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: "请输入模板名称" }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="templateCode" label="模板编码" rules={[{ required: true, message: "请输入模板编码" }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="industryCode" label="行业编码" rules={[{ required: true, message: "请输入行业编码" }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="templateStatus" label="模板状态" rules={[{ required: true, message: "请选择模板状态" }]}>
                          <Select
                            options={[
                              { label: "草稿", value: "draft" },
                              { label: "启用", value: "active" },
                              { label: "归档", value: "archived" },
                            ]}
                          />
                        </Form.Item>
                      </div>
                      <Form.Item name="templateDesc" label="模板说明">
                        <Input.TextArea rows={4} placeholder="描述业务系统边界、核心流程、主数据对象和建设目标" />
                      </Form.Item>
                    </Form>
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={moduleOpen} title="模块设计" onCancel={() => setModuleOpen(false)} onOk={() => void saveModule()} destroyOnHidden>
        <Form form={moduleForm} layout="vertical">
          <Form.Item name="moduleKey" label="模块标识" rules={[{ required: true, message: "请输入模块标识" }]}><Input /></Form.Item>
          <Form.Item name="moduleLabel" label="模块名称" rules={[{ required: true, message: "请输入模块名称" }]}><Input /></Form.Item>
          <Form.Item name="summary" label="模块说明"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="tableNames" label="关联逻辑表"><Select mode="multiple" allowClear options={tableOptions} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={tableOpen} title="逻辑表设计" onCancel={() => setTableOpen(false)} onOk={() => void saveTable()} destroyOnHidden>
        <Form form={tableForm} layout="vertical">
          <Form.Item name="tableName" label="逻辑表名" rules={[{ required: true, message: "请输入逻辑表名" }]}><Input /></Form.Item>
          <Form.Item name="tableLabel" label="表标签"><Input /></Form.Item>
          <Form.Item name="tableComment" label="表说明"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="businessRole" label="业务角色" rules={[{ required: true, message: "请选择业务角色" }]}><Select options={BUSINESS_ROLE_OPTIONS} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={fieldOpen} title="字段设计" onCancel={() => setFieldOpen(false)} onOk={() => void saveField()} destroyOnHidden>
        <Form form={fieldForm} layout="vertical">
          <Form.Item name="fieldName" label="字段名" rules={[{ required: true, message: "请输入字段名" }]}><Input /></Form.Item>
          <Form.Item name="fieldType" label="字段类型" rules={[{ required: true, message: "请选择字段类型" }]}><Select options={FIELD_TYPE_OPTIONS} /></Form.Item>
          <Form.Item name="businessSemantic" label="业务语义"><Input /></Form.Item>
          <Form.Item name="fieldComment" label="字段说明"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="required" valuePropName="checked"><Checkbox>设为必填字段</Checkbox></Form.Item>
        </Form>
      </Modal>

      <Modal open={dictOpen} title="字典表设计" onCancel={() => setDictOpen(false)} onOk={() => void saveDict()} destroyOnHidden>
        <Form form={dictForm} layout="vertical">
          <Form.Item name="dictType" label="字典类型" rules={[{ required: true, message: "请输入字典类型" }]}><Input /></Form.Item>
          <Form.Item name="dictName" label="字典名称" rules={[{ required: true, message: "请输入字典名称" }]}><Input /></Form.Item>
          <Form.Item name="categoryCode" label="所属子类目"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal open={dictItemOpen} title="字典项设计" onCancel={() => setDictItemOpen(false)} onOk={() => void saveDictItem()} destroyOnHidden>
        <Form form={dictItemForm} layout="vertical">
          <Form.Item name="itemCode" label="字典项编码" rules={[{ required: true, message: "请输入字典项编码" }]}><Input /></Form.Item>
          <Form.Item name="itemLabel" label="字典项名称" rules={[{ required: true, message: "请输入字典项名称" }]}><Input /></Form.Item>
          <Form.Item name="valueRangeText" label="值域"><Input.TextArea rows={5} placeholder="支持填写纯文本，也支持 JSON 结构" /></Form.Item>
        </Form>
      </Modal>

      <Modal open={relationOpen} title="关系设计" onCancel={() => setRelationOpen(false)} onOk={() => void saveRelation()} destroyOnHidden>
        <Form form={relationForm} layout="vertical">
          <Form.Item name="fromTable" label="来源表" rules={[{ required: true, message: "请选择来源表" }]}><Select showSearch options={tableOptions} /></Form.Item>
          <Form.Item name="fromField" label="来源字段" rules={[{ required: true, message: "请选择来源字段" }]}><Select showSearch options={fromFieldOptions} /></Form.Item>
          <Form.Item name="toTable" label="目标表" rules={[{ required: true, message: "请选择目标表" }]}><Select showSearch options={tableOptions} /></Form.Item>
          <Form.Item name="toField" label="目标字段" rules={[{ required: true, message: "请选择目标字段" }]}><Select showSearch options={toFieldOptions} /></Form.Item>
          <Form.Item name="relationType" label="关系类型" rules={[{ required: true, message: "请选择关系类型" }]}><Select options={RELATION_TYPE_OPTIONS} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
