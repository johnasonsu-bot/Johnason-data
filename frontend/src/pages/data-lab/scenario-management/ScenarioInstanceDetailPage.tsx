import { Button, Card, Checkbox, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  deleteBusinessSystemInstanceDirtyVersion,
  deleteBusinessSystemInstanceGenerationVersion,
  deleteBusinessSystemInstancePhysicalVersion,
  downloadBusinessSystemInstancePhysicalDesignDoc,
  fetchBusinessSystemInstanceDetail,
  fetchBusinessSystemInstanceDirtyVersions,
  fetchBusinessSystemInstanceGenerationVersions,
  fetchBusinessSystemInstancePhysicalVersions,
  fetchBusinessSystemInstanceQualityReport,
  fetchLabDataSources,
  generateBusinessSystemInstanceDirtyData,
  generateBusinessSystemInstanceGenerationPlan,
  generateBusinessSystemInstancePhysicalModel,
  patchBusinessSystemDirtyDataVersion,
  rebuildBusinessSystemInstanceQualityReport,
  saveBusinessSystemInstancePhysicalModel,
  type LabBusinessSystemDirtyDataGeneratePayload,
  type LabBusinessSystemGenerationPlanGeneratePayload,
} from "../../../services/dataLab";
import type {
  DataSourceRecord,
  LabBusinessSystemDirtyDataVersionRecord,
  LabBusinessSystemGenerationVersionRecord,
  LabBusinessSystemInstanceRecord,
  LabBusinessSystemPhysicalModelVersionRecord,
  LabBusinessSystemQualityReportRecord,
} from "../../../types/api";
import { isScenarioDatabaseSource } from "../../../utils/datasource";

const INSTANCE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "\u8349\u7a3f" },
  active: { color: "processing", label: "\u542f\u7528" },
  archived: { color: "gold", label: "\u5f52\u6863" },
};

const VERSION_STATUS_META: Record<string, { color: string; label: string }> = {
  generated: { color: "blue", label: "\u81ea\u52a8\u751f\u6210" },
  edited: { color: "cyan", label: "\u4eba\u5de5\u7f16\u8f91" },
  deployed: { color: "success", label: "\u5df2\u90e8\u7f72" },
};

const DEFAULT_DIRTY_FOCUS_CATEGORIES: Array<"D1" | "D2" | "D3" | "D4" | "D5" | "D6"> = ["D1", "D2", "D3", "D4", "D5", "D6"];
const INSTANCE_TAB_KEYS = ["physical", "plan", "versions"] as const;
const PHYSICAL_TABLE_KIND_LABELS: Record<string, string> = {
  BUSINESS: "\u4e1a\u52a1\u8868",
  DICTIONARY: "\u5b57\u5178\u8868",
};
const PHYSICAL_BUSINESS_ROLE_LABELS: Record<string, string> = {
  MASTER: "\u4e3b\u6570\u636e",
  TRANSACTION: "\u4ea4\u6613\u4e8b\u5b9e",
  DETAIL: "\u660e\u7ec6",
  BRIDGE: "\u6865\u63a5",
  LOG: "\u65e5\u5fd7",
  SNAPSHOT: "\u5feb\u7167",
  DICTIONARY: "\u5b57\u5178",
};
const PHYSICAL_TABLE_KIND_OPTIONS = Object.entries(PHYSICAL_TABLE_KIND_LABELS).map(([value, label]) => ({ value, label }));
const PHYSICAL_BUSINESS_ROLE_OPTIONS = Object.entries(PHYSICAL_BUSINESS_ROLE_LABELS).map(([value, label]) => ({ value, label }));
const PHYSICAL_COLUMN_TYPE_OPTIONS = [
  "BIGINT",
  "INT",
  "VARCHAR(64)",
  "VARCHAR(128)",
  "VARCHAR(255)",
  "DECIMAL(18,2)",
  "DATE",
  "DATETIME",
  "TIMESTAMP",
  "BOOLEAN",
  "JSON",
  "JSONB",
  "TEXT",
].map((value) => ({ value, label: value }));

type PhysicalColumnRow = {
  columnName: string;
  columnType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  sourceFieldName?: string;
  columnComment?: string;
  defaultValue?: unknown;
};

type PhysicalTableRow = {
  tableKind: string;
  logicalTableName: string;
  logicalLabel?: string;
  physicalTableName: string;
  tableComment?: string;
  businessRole?: string;
  columns: PhysicalColumnRow[];
  ddl?: string;
  deploymentStatements?: string[];
  indexes?: Array<Record<string, unknown>>;
};

type PhysicalModelState = {
  meta?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  tables: PhysicalTableRow[];
  relations?: Array<Record<string, unknown>>;
};

type PhysicalTableFormValues = {
  tableKind: string;
  businessRole?: string;
  logicalTableName: string;
  logicalLabel?: string;
  physicalTableName: string;
  tableComment?: string;
};

type PhysicalFieldFormValues = {
  columnName: string;
  columnType: string;
  sourceFieldName?: string;
  columnComment?: string;
  defaultValue?: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
};

type PreviewTableRow = {
  tableKind: string;
  logicalTableName: string;
  physicalTableName: string;
  businessRole?: string;
  rowCountTarget?: number;
  previewRowCount?: number;
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
};

type PlanTableRow = {
  tableKind: string;
  logicalTableName: string;
  physicalTableName: string;
  businessRole?: string;
  entityTier?: string;
  primaryKey?: string | null;
  dependencyTables?: string[];
  targetRows?: number;
  incrementalRowsPerCycle?: number;
  loadedRows?: number;
  distributionWeight?: number;
  previewRows?: number;
};

type DirtyIssueRow = {
  issueId: string;
  category: string;
  categoryLabel?: string;
  issueCode: string;
  issueLabel?: string;
  issueDescription?: string;
  logicalTableName: string;
  physicalTableName: string;
  rowIndex: number;
  rowKey?: string | number;
  fieldName: string;
  relatedFieldName?: string | null;
  truthValue?: unknown;
  observedValue?: unknown;
  severity?: string;
  rootCause?: string;
  injectionPoint?: string;
  impactScope?: string;
  recoverable?: boolean;
};

type DirtyTableStatRow = {
  tableKind: string;
  logicalTableName: string;
  physicalTableName: string;
  previewRowCount?: number;
  dirtyIssueCount?: number;
  dirtyRowCount?: number;
  dirtyCellCount?: number;
};

type QualityTableStatRow = {
  tableName: string;
  logicalTableName?: string;
  physicalTableName?: string;
  tableKind?: string;
  rowCount?: number;
  dirtyRows?: number;
  dirtyIssueCount?: number;
  dirtyCellCount?: number;
  dirtyCellRate?: number;
  issueFields?: string[];
};

type QualityIssueRow = {
  tableName: string;
  physicalTableName?: string;
  fieldName: string;
  issueCategory?: string;
  issueCode?: string;
  issueType?: string;
  issueCount?: number;
  injectionPoint?: string | null;
  rootCause?: string | null;
  sampleTruthValue?: unknown;
  sampleObservedValue?: unknown;
};

type InstanceTabKey = (typeof INSTANCE_TAB_KEYS)[number];

function renderStatus(value: string, metaMap: Record<string, { color: string; label: string }>) {
  const meta = metaMap[value] || { color: "default", label: value || "-" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function formatDateTime(value?: string | null) {
  return value ? String(value).replace("T", " ").replace(/\.\d+Z?$/, "") : "-";
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function defaultPlanStartAt() {
  const now = new Date();
  now.setDate(now.getDate() - 29);
  return now.toISOString().slice(0, 10);
}

function renderCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "\u662f" : "\u5426";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeInstanceTabKey(value?: string | null): InstanceTabKey {
  return INSTANCE_TAB_KEYS.includes(value as InstanceTabKey) ? (value as InstanceTabKey) : "physical";
}

function translatePhysicalTableKind(value?: string) {
  return PHYSICAL_TABLE_KIND_LABELS[String(value || "").toUpperCase()] || String(value || "-");
}

function translatePhysicalBusinessRole(value?: string) {
  return PHYSICAL_BUSINESS_ROLE_LABELS[String(value || "").toUpperCase()] || String(value || "-");
}

function normalizeEditableName(value: string, fallback: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 128);
  return normalized || fallback;
}

function buildDefaultColumnType(_dbType?: string) {
  return "BIGINT";
}

function buildDefaultPhysicalColumn(dbType?: string): PhysicalColumnRow {
  return {
    columnName: "id",
    columnType: buildDefaultColumnType(dbType),
    isNullable: false,
    isPrimaryKey: true,
    sourceFieldName: "id",
    columnComment: "\u4e3b\u952e",
    defaultValue: null,
  };
}

export function ScenarioInstanceDetailPage() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
  const instanceId = Number(id || 0);
  const requestedTab = normalizeInstanceTabKey(searchParams.get("tab"));
  const isSimulationEntry = location.pathname.includes("/dashboard/data-modeling/simulation/");
  const backPath = isSimulationEntry ? "/dashboard/data-modeling/simulation" : "/dashboard/data-modeling/physical-models";
  const pageTitle = isSimulationEntry ? "\u4eff\u771f\u4e1a\u52a1\u5b9e\u4f8b" : "\u7269\u7406\u6a21\u578b\u5b9e\u4f8b";
  const pageDescription = isSimulationEntry
    ? "\u67e5\u770b\u5e76\u7ef4\u62a4\u4eff\u771f\u5165\u53e3\u751f\u6210\u7684\u7269\u7406\u6a21\u578b\u3001DDL \u811a\u672c\u548c\u7248\u672c\u8bb0\u5f55\u3002"
    : "\u67e5\u770b\u5e76\u7ef4\u62a4\u4e1a\u52a1\u5b9e\u4f8b\u7684\u7269\u7406\u6a21\u578b\u3001DDL \u811a\u672c\u548c\u7248\u672c\u8bb0\u5f55\u3002";

  const [instance, setInstance] = useState<LabBusinessSystemInstanceRecord | null>(null);
  const [physicalVersions, setPhysicalVersions] = useState<LabBusinessSystemPhysicalModelVersionRecord[]>([]);
  const [generationVersions, setGenerationVersions] = useState<LabBusinessSystemGenerationVersionRecord[]>([]);
  const [dirtyVersions, setDirtyVersions] = useState<LabBusinessSystemDirtyDataVersionRecord[]>([]);
  const [qualityReport, setQualityReport] = useState<LabBusinessSystemQualityReportRecord | null>(null);
  const [activePhysicalVersionId, setActivePhysicalVersionId] = useState<number | undefined>();
  const [activeGenerationVersionId, setActiveGenerationVersionId] = useState<number | undefined>();
  const [activeDirtyVersionId, setActiveDirtyVersionId] = useState<number | undefined>();
  const [selectedPreviewTable, setSelectedPreviewTable] = useState<string | undefined>();
  const [selectedDirtyTable, setSelectedDirtyTable] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [generatingPhysical, setGeneratingPhysical] = useState(false);
  const [generatingDesignDoc, setGeneratingDesignDoc] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatingDirty, setGeneratingDirty] = useState(false);
  const [savingPhysical, setSavingPhysical] = useState(false);
  const [savingDirty, setSavingDirty] = useState(false);
  const [deletingVersionKey, setDeletingVersionKey] = useState<string | null>(null);
  const [rebuildingQuality, setRebuildingQuality] = useState(false);
  const [ddlOpen, setDdlOpen] = useState(false);
  const [ddlTitle, setDdlTitle] = useState("");
  const [ddlContent, setDdlContent] = useState("");
  const [activeTab, setActiveTab] = useState<InstanceTabKey>(requestedTab);
  const [availableDataSources, setAvailableDataSources] = useState<DataSourceRecord[]>([]);
  const [physicalDraft, setPhysicalDraft] = useState<PhysicalModelState | null>(null);
  const [physicalDirty, setPhysicalDirty] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingTableIndex, setEditingTableIndex] = useState<number | null>(null);
  const [fieldTableIndex, setFieldTableIndex] = useState<number | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [physicalForm] = Form.useForm<{ summary?: string }>();
  const [physicalTableForm] = Form.useForm<PhysicalTableFormValues>();
  const [physicalFieldForm] = Form.useForm<PhysicalFieldFormValues>();
  const [planForm] = Form.useForm<LabBusinessSystemGenerationPlanGeneratePayload>();
  const [dirtyForm] = Form.useForm<LabBusinessSystemDirtyDataGeneratePayload>();

  async function loadData(preferredPhysicalVersionId?: number, preferredGenerationVersionId?: number, preferredDirtyVersionId?: number) {
    if (!token || !instanceId) return;
    setLoading(true);
    try {
      const [instanceResponse, physicalResponse, generationResponse, dirtyResponse, qualityResponse, sourceResponse] = await Promise.all([
        fetchBusinessSystemInstanceDetail(token, instanceId),
        fetchBusinessSystemInstancePhysicalVersions(token, instanceId),
        fetchBusinessSystemInstanceGenerationVersions(token, instanceId),
        fetchBusinessSystemInstanceDirtyVersions(token, instanceId),
        fetchBusinessSystemInstanceQualityReport(token, instanceId),
        fetchLabDataSources(token, { includeConnectivity: true }),
      ]);
      const nextInstance = instanceResponse.data;
      const nextPhysicalVersions = physicalResponse.data;
      const nextGenerationVersions = generationResponse.data;
      const nextDirtyVersions = dirtyResponse.data;
      const currentPhysicalVersionId = nextPhysicalVersions.find((item) => item.isCurrent)?.id
        || nextInstance.physicalVersionId
        || nextPhysicalVersions[0]?.id;
      const currentGenerationVersionId = nextGenerationVersions.find((item) => item.isCurrent)?.id;
      const currentDirtyVersionId = nextDirtyVersions.find((item) => item.isCurrent)?.id;
      setInstance(nextInstance);
      setPhysicalVersions(nextPhysicalVersions);
      setGenerationVersions(nextGenerationVersions);
      setDirtyVersions(nextDirtyVersions);
      setQualityReport(qualityResponse.data || null);
      setAvailableDataSources(sourceResponse.data.filter((item) => isScenarioDatabaseSource(item)));
      setActivePhysicalVersionId(preferredPhysicalVersionId || currentPhysicalVersionId || undefined);
      setActiveGenerationVersionId(preferredGenerationVersionId || currentGenerationVersionId || undefined);
      setActiveDirtyVersionId(preferredDirtyVersionId || currentDirtyVersionId || undefined);
      const defaultTargetDataSourceId = Number(
        (nextInstance.deployTarget as { targetDataSourceId?: number } | null)?.targetDataSourceId
          || 0
      ) || undefined;
      physicalForm.setFieldsValue({ summary: "" });
      planForm.setFieldsValue({
        physicalVersionNo: nextPhysicalVersions.find((item) => item.id === (preferredPhysicalVersionId || currentPhysicalVersionId))?.versionNo
          || nextInstance.currentPhysicalVersion
          || undefined,
        targetDataSourceId: defaultTargetDataSourceId,
        initialDataVolume: 1000,
        incrementalDataVolume: 100,
        incrementCycleDays: 1,
        sampleRowsPerTable: 5,
        timelineDays: 30,
        timelineStartAt: defaultPlanStartAt(),
        summary: "",
      });
      dirtyForm.setFieldsValue({
        generationVersionNo: nextGenerationVersions.find((item) => item.id === (preferredGenerationVersionId || currentGenerationVersionId))?.versionNo
          || nextInstance.currentGenerationVersion
          || undefined,
        dirtyRatio: 0.08,
        focusCategories: DEFAULT_DIRTY_FOCUS_CATEGORIES,
        summary: "",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !instanceId) return;
    void loadData();
  }, [token, instanceId]);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const activePhysicalVersion = useMemo(
    () => physicalVersions.find((item) => item.id === activePhysicalVersionId) || physicalVersions[0] || null,
    [activePhysicalVersionId, physicalVersions]
  );
  const activeGenerationVersion = useMemo(
    () => generationVersions.find((item) => item.id === activeGenerationVersionId) || null,
    [activeGenerationVersionId, generationVersions]
  );
  const activeDirtyVersion = useMemo(
    () => dirtyVersions.find((item) => item.id === activeDirtyVersionId) || null,
    [activeDirtyVersionId, dirtyVersions]
  );
  useEffect(() => {
    if (activePhysicalVersion?.versionNo) {
      planForm.setFieldValue("physicalVersionNo", activePhysicalVersion.versionNo);
    }
  }, [activePhysicalVersion?.versionNo, planForm]);

  useEffect(() => {
    const targetDataSourceId = Number(
      safeObject(activePhysicalVersion?.deployTarget || instance?.deployTarget).targetDataSourceId || 0
    ) || undefined;
    if (targetDataSourceId) {
      planForm.setFieldValue("targetDataSourceId", targetDataSourceId);
    }
  }, [activePhysicalVersion?.deployTarget, instance?.deployTarget, planForm]);

  useEffect(() => {
    if (!activeDirtyVersion?.id && activeGenerationVersion?.versionNo) {
      dirtyForm.setFieldValue("generationVersionNo", activeGenerationVersion.versionNo);
    }
  }, [activeDirtyVersion?.id, activeGenerationVersion?.versionNo, dirtyForm]);

  const physicalModel = safeObject(activePhysicalVersion?.physicalModel || instance?.currentPhysicalModel || null);
  useEffect(() => {
    const nextDraft = {
      ...clone(physicalModel),
      tables: safeArray<PhysicalTableRow>(physicalModel.tables),
      relations: safeArray<Record<string, unknown>>(physicalModel.relations),
    } as PhysicalModelState;
    setPhysicalDraft(nextDraft);
    setPhysicalDirty(false);
  }, [activePhysicalVersion?.id, instance?.id]);

  const editablePhysicalModel = safeObject(physicalDraft || physicalModel);
  const physicalTables = safeArray<PhysicalTableRow>(editablePhysicalModel.tables);
  const physicalColumnCount = useMemo(
    () => physicalTables.reduce((sum, table) => sum + (Array.isArray(table.columns) ? table.columns.length : 0), 0),
    [physicalTables]
  );
  const physicalBusinessTableCount = useMemo(
    () => physicalTables.filter((table) => String(table.tableKind || "").toUpperCase() === "BUSINESS").length,
    [physicalTables]
  );
  const physicalDictionaryTableCount = useMemo(
    () => physicalTables.filter((table) => String(table.tableKind || "").toUpperCase() === "DICTIONARY").length,
    [physicalTables]
  );
  const ddlBundle = safeObject(activePhysicalVersion?.ddlBundle || instance?.currentDdlBundle || null);
  const instanceDeployTarget = safeObject(instance?.deployTarget || null);
  const generationPlan = safeObject(activeGenerationVersion?.generationPlan || null);
  const generationMeta = safeObject(generationPlan.meta);
  const planSummary = safeObject(generationPlan.summary);
  const planSizing = safeObject(generationPlan.sizing);
  const planTimeline = safeObject(planSizing.timeline);
  const planDeployTarget = safeObject(generationMeta.deployTarget);
  const planLoadSummary = safeObject(generationPlan.loadSummary);
  const planTables = safeArray<PlanTableRow>(generationPlan.tablePlans);
  const samplePreview = safeObject(activeGenerationVersion?.samplePreview || null);
  const sampleSummary = safeObject(samplePreview.summary);
  const previewTables = safeArray<PreviewTableRow>(samplePreview.tables);
  const dirtyPlan = safeObject(activeDirtyVersion?.dirtyPlan || null);
  const dirtySummary = safeObject(dirtyPlan.summary);
  const dirtyConfig = safeObject(dirtyPlan.config);
  const dirtyIssues = safeArray<DirtyIssueRow>(activeDirtyVersion?.issuePreview && safeObject(activeDirtyVersion.issuePreview).issues);
  const dirtyTableStats = safeArray<DirtyTableStatRow>(activeDirtyVersion?.issuePreview && safeObject(activeDirtyVersion.issuePreview).tables);
  const truthPreview = safeObject(activeDirtyVersion?.truthPreview || null);
  const observedPreview = safeObject(activeDirtyVersion?.observedPreview || null);
  const truthTables = safeArray<PreviewTableRow>(truthPreview.tables);
  const observedTables = safeArray<PreviewTableRow>(observedPreview.tables);
  const qualitySummary = safeObject(qualityReport?.summary);
  const qualityTableStats = safeArray<QualityTableStatRow>(qualityReport?.tableStats);
  const qualityFieldIssues = safeArray<QualityIssueRow>(qualityReport?.fieldIssues);

  useEffect(() => {
    if (!activeDirtyVersion) return;
    const focusCategories = safeArray<string>(dirtyConfig.focusCategories)
      .filter((item): item is "D1" | "D2" | "D3" | "D4" | "D5" | "D6" => DEFAULT_DIRTY_FOCUS_CATEGORIES.includes(item as any));
    dirtyForm.setFieldsValue({
      generationVersionNo: activeDirtyVersion.generationVersionNo || activeGenerationVersion?.versionNo || undefined,
      dirtyRatio: Number(dirtyConfig.dirtyRatio || activeDirtyVersion.dirtyRate || 0.08),
      focusCategories: focusCategories.length > 0 ? focusCategories : DEFAULT_DIRTY_FOCUS_CATEGORIES,
      summary: activeDirtyVersion.modelSummary || "",
    });
  }, [
    activeDirtyVersion,
    activeGenerationVersion?.versionNo,
    dirtyConfig.dirtyRatio,
    dirtyConfig.focusCategories,
    dirtyForm,
  ]);

  useEffect(() => {
    if (previewTables.length === 0) {
      setSelectedPreviewTable(undefined);
      return;
    }
    if (!previewTables.find((item) => item.logicalTableName === selectedPreviewTable)) {
      setSelectedPreviewTable(previewTables[0]?.logicalTableName);
    }
  }, [previewTables, selectedPreviewTable]);

  const activePreviewTable = useMemo(
    () => previewTables.find((item) => item.logicalTableName === selectedPreviewTable) || previewTables[0] || null,
    [previewTables, selectedPreviewTable]
  );
  const previewColumns = useMemo(() => {
    const names = [...new Set([...(activePreviewTable?.columns || []), ...Object.keys(activePreviewTable?.rows?.[0] || {})])];
    return names.map((name) => ({ title: name, dataIndex: name, key: name, width: 180, render: (value: unknown) => renderCell(value) }));
  }, [activePreviewTable]);
  const previewRows = useMemo(
    () => (activePreviewTable?.rows || []).map((row, index) => ({ __rowKey: `${activePreviewTable.logicalTableName}_${index + 1}`, ...row })),
    [activePreviewTable]
  );

  useEffect(() => {
    if (dirtyTableStats.length === 0) {
      setSelectedDirtyTable(undefined);
      return;
    }
    if (!dirtyTableStats.find((item) => item.logicalTableName === selectedDirtyTable)) {
      setSelectedDirtyTable(dirtyTableStats[0]?.logicalTableName);
    }
  }, [dirtyTableStats, selectedDirtyTable]);

  const activeTruthTable = useMemo(
    () => truthTables.find((item) => item.logicalTableName === selectedDirtyTable) || truthTables[0] || null,
    [truthTables, selectedDirtyTable]
  );
  const activeObservedTable = useMemo(
    () => observedTables.find((item) => item.logicalTableName === selectedDirtyTable) || observedTables[0] || null,
    [observedTables, selectedDirtyTable]
  );
  const dirtyPreviewColumns = useMemo(() => {
    const names = [...new Set([
      ...(activeTruthTable?.columns || []),
      ...(activeObservedTable?.columns || []),
      ...Object.keys(activeTruthTable?.rows?.[0] || {}),
      ...Object.keys(activeObservedTable?.rows?.[0] || {}),
    ])];
    return names.map((name) => ({ title: name, dataIndex: name, key: name, width: 180, render: (value: unknown) => renderCell(value) }));
  }, [activeObservedTable, activeTruthTable]);
  const truthRows = useMemo(
    () => (activeTruthTable?.rows || []).map((row, index) => ({ __rowKey: `${activeTruthTable.logicalTableName}_truth_${index + 1}`, ...row })),
    [activeTruthTable]
  );
  const observedRows = useMemo(
    () => (activeObservedTable?.rows || []).map((row, index) => ({ __rowKey: `${activeObservedTable.logicalTableName}_observed_${index + 1}`, ...row })),
    [activeObservedTable]
  );
  const activeDirtyTableIssues = useMemo(
    () => dirtyIssues.filter((item) => item.logicalTableName === (selectedDirtyTable || activeObservedTable?.logicalTableName)),
    [activeObservedTable?.logicalTableName, dirtyIssues, selectedDirtyTable]
  );

  function mutatePhysicalDraft(mutator: (draft: PhysicalModelState) => void) {
    setPhysicalDraft((current) => {
      const baseDraft = clone((current || {
        ...physicalModel,
        tables: safeArray<PhysicalTableRow>(physicalModel.tables),
        relations: safeArray<Record<string, unknown>>(physicalModel.relations),
      }) as PhysicalModelState);
      baseDraft.tables = safeArray<PhysicalTableRow>(baseDraft.tables);
      baseDraft.relations = safeArray<Record<string, unknown>>(baseDraft.relations);
      mutator(baseDraft);
      return baseDraft;
    });
    setPhysicalDirty(true);
  }

  function resetPhysicalDraft() {
    setPhysicalDraft({
      ...clone(physicalModel),
      tables: safeArray<PhysicalTableRow>(physicalModel.tables),
      relations: safeArray<Record<string, unknown>>(physicalModel.relations),
    } as PhysicalModelState);
    setPhysicalDirty(false);
  }

  function openTableEditor(index: number | null) {
    setEditingTableIndex(index);
    const record = index === null ? null : physicalTables[index] || null;
    physicalTableForm.setFieldsValue(record ? {
      tableKind: record.tableKind || "BUSINESS",
      businessRole: record.businessRole || "MASTER",
      logicalTableName: record.logicalTableName,
      logicalLabel: record.logicalLabel || "",
      physicalTableName: record.physicalTableName,
      tableComment: record.tableComment || "",
    } : {
      tableKind: "BUSINESS",
      businessRole: "MASTER",
      logicalTableName: "",
      logicalLabel: "",
      physicalTableName: "",
      tableComment: "",
    });
    setTableModalOpen(true);
  }

  async function handleSaveTable() {
    const values = await physicalTableForm.validateFields();
    const nextLogicalTableName = String(values.logicalTableName || "").trim();
    const nextPhysicalTableName = normalizeEditableName(values.physicalTableName || nextLogicalTableName, `table_${physicalTables.length + 1}`);
    const duplicateTable = physicalTables.find((item, index) =>
      index !== editingTableIndex
      && (
        String(item.logicalTableName || "").trim() === nextLogicalTableName
        || String(item.physicalTableName || "").trim() === nextPhysicalTableName
      )
    );
    if (duplicateTable) {
      message.error("逻辑表名或物理表名已存在，请调整后重试");
      return;
    }

    const dbType = activePhysicalVersion?.dbType || instance?.dbType;
    mutatePhysicalDraft((draft) => {
      const tables = safeArray<PhysicalTableRow>(draft.tables);
      const previousTable = editingTableIndex === null ? null : tables[editingTableIndex] || null;
      const nextTable: PhysicalTableRow = {
        tableKind: values.tableKind || "BUSINESS",
        businessRole: values.tableKind === "DICTIONARY" ? "DICTIONARY" : String(values.businessRole || "MASTER"),
        logicalTableName: nextLogicalTableName,
        logicalLabel: String(values.logicalLabel || "").trim() || nextLogicalTableName,
        physicalTableName: nextPhysicalTableName,
        tableComment: String(values.tableComment || "").trim() || undefined,
        columns: previousTable?.columns?.length ? previousTable.columns : [buildDefaultPhysicalColumn(dbType)],
        ddl: previousTable?.ddl,
        deploymentStatements: previousTable?.deploymentStatements,
        indexes: previousTable?.indexes,
      };
      if (editingTableIndex === null) {
        tables.push(nextTable);
      } else {
        tables[editingTableIndex] = nextTable;
        if (previousTable && previousTable.logicalTableName !== nextLogicalTableName) {
          draft.relations = safeArray<Record<string, unknown>>(draft.relations).map((relation) => ({
            ...relation,
            fromTable: relation.fromTable === previousTable.logicalTableName ? nextLogicalTableName : relation.fromTable,
            toTable: relation.toTable === previousTable.logicalTableName ? nextLogicalTableName : relation.toTable,
          }));
        }
        if (previousTable && previousTable.physicalTableName !== nextPhysicalTableName) {
          draft.relations = safeArray<Record<string, unknown>>(draft.relations).map((relation) => ({
            ...relation,
            fromPhysicalTableName: relation.fromPhysicalTableName === previousTable.physicalTableName ? nextPhysicalTableName : relation.fromPhysicalTableName,
            toPhysicalTableName: relation.toPhysicalTableName === previousTable.physicalTableName ? nextPhysicalTableName : relation.toPhysicalTableName,
          }));
        }
      }
      draft.tables = tables;
    });
    setTableModalOpen(false);
  }

  function handleDeleteTable(tableIndex: number) {
    const targetTable = physicalTables[tableIndex];
    if (!targetTable) return;
    mutatePhysicalDraft((draft) => {
      draft.tables = safeArray<PhysicalTableRow>(draft.tables).filter((_, index) => index !== tableIndex);
      draft.relations = safeArray<Record<string, unknown>>(draft.relations).filter((relation) =>
        relation.fromTable !== targetTable.logicalTableName
        && relation.toTable !== targetTable.logicalTableName
      );
    });
  }

  function openFieldEditor(tableIndex: number, fieldIndex: number | null) {
    setFieldTableIndex(tableIndex);
    setEditingFieldIndex(fieldIndex);
    const record = fieldIndex === null ? null : physicalTables[tableIndex]?.columns?.[fieldIndex] || null;
    physicalFieldForm.setFieldsValue(record ? {
      columnName: record.columnName,
      columnType: record.columnType,
      sourceFieldName: record.sourceFieldName || "",
      columnComment: record.columnComment || "",
      defaultValue: record.defaultValue === null || record.defaultValue === undefined ? "" : String(record.defaultValue),
      isNullable: Boolean(record.isNullable),
      isPrimaryKey: Boolean(record.isPrimaryKey),
    } : {
      columnName: "",
      columnType: buildDefaultColumnType(activePhysicalVersion?.dbType || instance?.dbType),
      sourceFieldName: "",
      columnComment: "",
      defaultValue: "",
      isNullable: true,
      isPrimaryKey: false,
    });
    setFieldModalOpen(true);
  }

  async function handleSaveField() {
    if (fieldTableIndex === null) return;
    const values = await physicalFieldForm.validateFields();
    const table = physicalTables[fieldTableIndex];
    if (!table) return;
    const nextColumnName = normalizeEditableName(values.columnName, `column_${(table.columns?.length || 0) + 1}`);
    const nextSourceFieldName = normalizeEditableName(values.sourceFieldName || nextColumnName, nextColumnName);
    const duplicateField = (table.columns || []).find((item, index) =>
      index !== editingFieldIndex
      && (
        item.columnName === nextColumnName
        || String(item.sourceFieldName || "") === nextSourceFieldName
      )
    );
    if (duplicateField) {
      message.error("字段名或来源字段名已存在，请调整后重试");
      return;
    }

    mutatePhysicalDraft((draft) => {
      const tables = safeArray<PhysicalTableRow>(draft.tables);
      const nextTable = tables[fieldTableIndex];
      if (!nextTable) return;
      const fields = Array.isArray(nextTable.columns) ? [...nextTable.columns] : [];
      const previousField = editingFieldIndex === null ? null : fields[editingFieldIndex] || null;
      const nextField: PhysicalColumnRow = {
        columnName: nextColumnName,
        columnType: String(values.columnType || buildDefaultColumnType(activePhysicalVersion?.dbType || instance?.dbType)).trim().toUpperCase(),
        sourceFieldName: nextSourceFieldName,
        columnComment: String(values.columnComment || "").trim() || undefined,
        defaultValue: String(values.defaultValue || "").trim() || null,
        isNullable: values.isPrimaryKey ? false : Boolean(values.isNullable),
        isPrimaryKey: Boolean(values.isPrimaryKey),
      };
      if (editingFieldIndex === null) {
        fields.push(nextField);
      } else {
        fields[editingFieldIndex] = nextField;
        if (previousField) {
          const previousRelationKey = String(previousField.sourceFieldName || previousField.columnName || "");
          draft.relations = safeArray<Record<string, unknown>>(draft.relations).map((relation) => ({
            ...relation,
            fromField: relation.fromTable === nextTable.logicalTableName && (relation.fromField === previousRelationKey || relation.fromField === previousField.columnName)
              ? nextSourceFieldName
              : relation.fromField,
            toField: relation.toTable === nextTable.logicalTableName && (relation.toField === previousRelationKey || relation.toField === previousField.columnName)
              ? nextSourceFieldName
              : relation.toField,
          }));
        }
      }
      nextTable.columns = fields;
      tables[fieldTableIndex] = nextTable;
      draft.tables = tables;
    });
    setFieldModalOpen(false);
  }

  function handleDeleteField(tableIndex: number, fieldIndex: number) {
    const table = physicalTables[tableIndex];
    const field = table?.columns?.[fieldIndex];
    if (!table || !field) return;
    if ((table.columns || []).length <= 1) {
      message.warning("每张表至少需要保留一个字段");
      return;
    }
    mutatePhysicalDraft((draft) => {
      const tables = safeArray<PhysicalTableRow>(draft.tables);
      const nextTable = tables[tableIndex];
      if (!nextTable) return;
      nextTable.columns = safeArray<PhysicalColumnRow>(nextTable.columns).filter((_, index) => index !== fieldIndex);
      tables[tableIndex] = nextTable;
      draft.tables = tables;
      const relationKeys = new Set([String(field.sourceFieldName || ""), String(field.columnName || "")].filter(Boolean));
      draft.relations = safeArray<Record<string, unknown>>(draft.relations).filter((relation) => !(
        (relation.fromTable === table.logicalTableName && relationKeys.has(String(relation.fromField || "")))
        || (relation.toTable === table.logicalTableName && relationKeys.has(String(relation.toField || "")))
      ));
    });
  }

  async function handleGeneratePhysical() {
    if (!token || !instanceId) return;
    const values = await physicalForm.validateFields();
    setGeneratingPhysical(true);
    try {
      const response = await generateBusinessSystemInstancePhysicalModel(token, instanceId, {
        summary: values.summary || undefined,
      });
      message.success(`已生成物理结构 V${response.data.version?.versionNo || "-"}`);
      await loadData(response.data.version?.id || undefined, undefined);
      physicalForm.setFieldsValue({ summary: "" });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "物理结构生成失败");
    } finally {
      setGeneratingPhysical(false);
    }
  }

  async function handleSavePhysicalDraft() {
    if (!token || !instanceId || !physicalDraft) return;
    setSavingPhysical(true);
    try {
      const response = await saveBusinessSystemInstancePhysicalModel(token, instanceId, {
        physicalVersionNo: activePhysicalVersion?.versionNo || instance?.currentPhysicalVersion || undefined,
        physicalModel: physicalDraft as unknown as Record<string, unknown>,
        summary: activePhysicalVersion?.versionNo
          ? `基于物理版本 V${activePhysicalVersion.versionNo} 编辑保存`
          : "人工编辑物理结构",
      });
      message.success(`物理结构已保存为 V${response.data.version?.versionNo || "-"}`);
      await loadData(response.data.version?.id || undefined, undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "物理结构保存失败");
    } finally {
      setSavingPhysical(false);
    }
  }

  async function handleDownloadDesignDoc() {
    if (!token || !instanceId || !instance) return;
    setGeneratingDesignDoc(true);
    try {
      await downloadBusinessSystemInstancePhysicalDesignDoc(
        token,
        instanceId,
        {
          physicalVersionNo: activePhysicalVersion?.versionNo || instance.currentPhysicalVersion || undefined,
          dbType: (activePhysicalVersion?.dbType || instance.dbType || "mysql") as "mysql" | "postgresql",
        },
        `${instance.instanceCode || "business_instance"}_database_design_specification_summary.docx`
      );
      message.success("数据库设计说明书已开始下载");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "数据库设计说明书下载失败");
    } finally {
      setGeneratingDesignDoc(false);
    }
  }

  async function handleGeneratePlan() {
    if (!token || !instanceId) return;
    const values = await planForm.validateFields();
    setGeneratingPlan(true);
    try {
      const response = await generateBusinessSystemInstanceGenerationPlan(token, instanceId, {
        ...values,
        targetDataSourceId: values.targetDataSourceId || Number(instanceDeployTarget.targetDataSourceId || 0) || undefined,
        summary: values.summary || undefined,
        timelineStartAt: values.timelineStartAt || undefined,
      });
      message.success(`已生成样本方案 V${response.data.version?.versionNo || "-"}`);
      await loadData(activePhysicalVersion?.id || undefined, response.data.version?.id || undefined);
      planForm.setFieldValue("summary", "");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "样本方案生成失败");
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function handleGenerateDirty() {
    if (!token || !instanceId) return;
    const values = await dirtyForm.validateFields();
    setGeneratingDirty(true);
    try {
      const response = await generateBusinessSystemInstanceDirtyData(token, instanceId, {
        ...values,
        summary: values.summary || undefined,
      });
      message.success(`已生成缺陷方案 V${response.data.version?.versionNo || "-"}`);
      await loadData(activePhysicalVersion?.id || undefined, activeGenerationVersion?.id || undefined, response.data.version?.id || undefined);
      dirtyForm.setFieldValue("summary", "");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "缺陷方案生成失败");
    } finally {
      setGeneratingDirty(false);
    }
  }

  async function handlePatchDirty() {
    if (!token || !activeDirtyVersion) return;
    const values = await dirtyForm.validateFields();
    setSavingDirty(true);
    try {
      const response = await patchBusinessSystemDirtyDataVersion(token, activeDirtyVersion.id, {
        ...values,
        summary: values.summary || undefined,
      });
      const nextGenerationVersionId = generationVersions.find(
        (item) => item.versionNo === Number(response.data.version?.generationVersionNo || values.generationVersionNo || 0)
      )?.id;
      message.success("已更新缺陷方案 V" + String(response.data.version?.versionNo || "-"));
      await loadData(activePhysicalVersion?.id || undefined, nextGenerationVersionId, response.data.version?.id || activeDirtyVersion.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "缺陷方案更新失败");
    } finally {
      setSavingDirty(false);
    }
  }

  async function handleRebuildQuality() {
    if (!token || !instanceId) return;
    setRebuildingQuality(true);
    try {
      const response = await rebuildBusinessSystemInstanceQualityReport(token, instanceId);
      setQualityReport(response.data || null);
      message.success("已重新生成质量评估");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "质量评估生成失败");
    } finally {
      setRebuildingQuality(false);
    }
  }
  async function handleDeletePhysicalVersion(versionId: number) {
    if (!token || !instanceId) return;
    setDeletingVersionKey("physical_" + versionId);
    try {
      const response = await deleteBusinessSystemInstancePhysicalVersion(token, instanceId, versionId);
      message.success("已删除物理版本 V" + response.data.versionNo);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "物理版本删除失败");
    } finally {
      setDeletingVersionKey(null);
    }
  }

  async function handleDeleteGenerationVersion(versionId: number) {
    if (!token || !instanceId) return;
    setDeletingVersionKey("generation_" + versionId);
    try {
      const response = await deleteBusinessSystemInstanceGenerationVersion(token, instanceId, versionId);
      message.success("已删除样本版本 V" + response.data.versionNo);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "样本版本删除失败");
    } finally {
      setDeletingVersionKey(null);
    }
  }

  async function handleDeleteDirtyVersion(versionId: number) {
    if (!token || !instanceId) return;
    setDeletingVersionKey("dirty_" + versionId);
    try {
      const response = await deleteBusinessSystemInstanceDirtyVersion(token, instanceId, versionId);
      message.success("已删除缺陷版本 V" + response.data.versionNo);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "缺陷版本删除失败");
    } finally {
      setDeletingVersionKey(null);
    }
  }

  function openDdl(table: PhysicalTableRow) {
    setDdlTitle(table.physicalTableName);
    setDdlContent(String(table.ddl || ""));
    setDdlOpen(true);
  }

  async function handleCopyText(content: string, successText = "\u590d\u5236\u6210\u529f") {
    if (!content) {
      message.warning("\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9");
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      message.success(successText);
    } catch {
      message.error("\u590d\u5236\u5931\u8d25");
    }
  }

  function handleTabChange(nextKey: string) {
    const normalized = normalizeInstanceTabKey(nextKey);
    setActiveTab(normalized);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (normalized === "physical") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", normalized);
    }
    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false} loading={loading}>
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>{pageTitle}</Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {pageDescription}
                  </Typography.Paragraph>
                </div>
                <Space wrap>
                  <Button onClick={() => navigate(backPath)}>{"\u8fd4\u56de\u5217\u8868"}</Button>
                  {instance ? <Button onClick={() => navigate("/dashboard/data-modeling/logical-models/" + instance.templateId)}>{"\u67e5\u770b\u903b\u8f91\u6a21\u578b\u8bbe\u8ba1"}</Button> : null}
                </Space>
              </div>

              {!instance ? <Empty description={"\u5b9e\u4f8b\u4e0d\u5b58\u5728\u6216\u5c1a\u672a\u52a0\u8f7d\u5b8c\u6210"} /> : (
                <>
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                    <Descriptions.Item label={"\u5b9e\u4f8b\u540d\u79f0"}>{instance.instanceName}</Descriptions.Item>
                    <Descriptions.Item label={"\u5b9e\u4f8b\u7f16\u7801"}>{instance.instanceCode}</Descriptions.Item>
                    <Descriptions.Item label={"\u5b9e\u4f8b\u72b6\u6001"}>{renderStatus(instance.instanceStatus, INSTANCE_STATUS_META)}</Descriptions.Item>
                    <Descriptions.Item label={"\u6765\u6e90\u6a21\u677f"}>{instance.templateName}</Descriptions.Item>
                    <Descriptions.Item label={"\u6570\u636e\u5e93\u7c7b\u578b"}>{String(instance.dbType || "-").toUpperCase()}</Descriptions.Item>
                    <Descriptions.Item label={"\u5f53\u524d\u7269\u7406\u7248\u672c"}>V{instance.currentPhysicalVersion || "-"}</Descriptions.Item>
                    <Descriptions.Item label={"\u5f53\u524d\u6837\u672c\u7248\u672c"}>V{instance.currentGenerationVersion || "-"}</Descriptions.Item>
                    <Descriptions.Item label={"\u5f53\u524d\u7f3a\u9677\u7248\u672c"}>V{instance.currentDirtyVersion || "-"}</Descriptions.Item>
                    <Descriptions.Item label={"\u521b\u5efa\u65f6\u95f4"}>{formatDateTime(instance.createdAt)}</Descriptions.Item>
                  </Descriptions>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "stretch" }}>
                    <div
                      style={{
                        border: "1px solid #e8edf5",
                        borderRadius: 18,
                        padding: 20,
                        background: "linear-gradient(180deg, #f9fbff 0%, #ffffff 100%)",
                        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div>
                        <Typography.Text strong style={{ fontSize: 16 }}>
                          {"\u8bbe\u8ba1\u8bf4\u660e\u4e66\u6458\u8981"}
                        </Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                          {"\u57fa\u4e8e\u5f53\u524d\u7269\u7406\u6a21\u578b\u5185\u5bb9\u751f\u6210\u4e1a\u52a1\u5b9e\u4f8b\u6570\u636e\u5e93\u8bbe\u8ba1\u8bf4\u660e\u4e66\u6458\u8981\uff0c\u9002\u5408\u5bf9\u5916\u5c55\u793a\u548c\u65b9\u6848\u8bc4\u5ba1\u3002"}
                        </Typography.Paragraph>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 12,
                          padding: 12,
                          borderRadius: 14,
                          background: "#ffffff",
                          border: "1px solid #eef2f8",
                        }}
                      >
                        <div>
                          <Typography.Text type="secondary">{"\u5f53\u524d\u7269\u7406\u7248\u672c"}</Typography.Text>
                          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 600 }}>{"V" + (instance.currentPhysicalVersion || "-")}</div>
                        </div>
                        <div>
                          <Typography.Text type="secondary">{"\u6570\u636e\u5e93\u7c7b\u578b"}</Typography.Text>
                          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 600 }}>{String(instance.dbType || "-").toUpperCase()}</div>
                        </div>
                      </div>
                      <Button loading={generatingDesignDoc} onClick={() => void handleDownloadDesignDoc()}>
                        {"\u751f\u6210\u4e1a\u52a1\u5b9e\u4f8b\u6570\u636e\u5e93\u8bbe\u8ba1\u8bf4\u660e\u4e66\u6458\u8981"}
                      </Button>
                    </div>

                    <div
                      style={{
                        border: "1px solid #e8edf5",
                        borderRadius: 18,
                        padding: 20,
                        background: "#ffffff",
                        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      <Form form={physicalForm} layout="vertical">
                        <Typography.Text strong style={{ fontSize: 16 }}>
                          {"\u7269\u7406\u7ed3\u6784 SQL"}
                        </Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 16 }}>
                          {"\u586b\u5199\u672c\u6b21\u7248\u672c\u8bf4\u660e\u540e\u751f\u6210 SQL\uff0c\u5c06\u6cbf\u7528\u5f53\u524d\u5b9e\u4f8b\u5df2\u9009\u5b9a\u7684 " + String(instance.dbType || "-").toUpperCase() + " \u6570\u636e\u5e93\u7c7b\u578b\u3002"}
                        </Typography.Paragraph>
                        <Form.Item name="summary" label={"\u7248\u672c\u8bf4\u660e"} style={{ marginBottom: 16 }}>
                          <Input.TextArea
                            rows={3}
                            placeholder={"\u4f8b\u5982\uff1a\u8c03\u6574\u7269\u7406\u8868\u547d\u540d\u3001\u5b57\u6bb5\u6ce8\u91ca\u6216\u540c\u6b65\u6700\u65b0\u903b\u8f91\u6a21\u578b"}
                          />
                        </Form.Item>
                        <Button type="primary" block loading={generatingPhysical} onClick={() => void handleGeneratePhysical()}>
                          {"\u751f\u6210\u7269\u7406\u7ed3\u6784 SQL"}
                        </Button>
                      </Form>
                    </div>
                  </div>

                </>
              )}
        </Space>
      </Card>

      <Card bordered={false}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              {
                key: "physical",
                label: "\u7269\u7406\u6a21\u578b",
                children: (
                  <Space direction="vertical" size={16} style={{ display: "flex" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <Space wrap>
                        <Button type="primary" onClick={() => openTableEditor(null)}>{"\u65b0\u589e\u6570\u636e\u8868"}</Button>
                        <Button onClick={() => resetPhysicalDraft()} disabled={!physicalDirty}>{"\u91cd\u7f6e\u8349\u7a3f"}</Button>
                        <Button type="primary" loading={savingPhysical} disabled={!physicalDirty} onClick={() => void handleSavePhysicalDraft()}>{"\u4fdd\u5b58\u5f53\u524d\u7248\u672c"}</Button>
                      </Space>
                      <Typography.Text type="secondary">
                        {"\u5f53\u524d\u7248\u672c"} V{activePhysicalVersion?.versionNo || "-"} / {String(activePhysicalVersion?.dbType || instance?.dbType || "-").toUpperCase()}
                      </Typography.Text>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      <Card bordered={false}><Statistic title={"\u6570\u636e\u8868"} value={physicalTables.length} /></Card>
                      <Card bordered={false}><Statistic title={"\u4e1a\u52a1\u8868"} value={physicalBusinessTableCount} /></Card>
                      <Card bordered={false}><Statistic title={"\u5b57\u5178\u8868"} value={physicalDictionaryTableCount} /></Card>
                      <Card bordered={false}><Statistic title={"\u5b57\u6bb5\u6570"} value={physicalColumnCount} /></Card>
                    </div>

                    <Table<PhysicalTableRow>
                      rowKey="physicalTableName"
                      dataSource={physicalTables}
                      pagination={{ pageSize: 8, size: "small" }}
                      scroll={{ x: 1320 }}
                      locale={{ emptyText: <Empty description={"\u6682\u65e0\u7269\u7406\u8868"} /> }}
                      expandable={{
                        expandedRowRender: (record) => {
                          const tableIndex = physicalTables.findIndex((item) => item.physicalTableName === record.physicalTableName);
                          return (
                            <Table<PhysicalColumnRow>
                              rowKey="columnName"
                              dataSource={record.columns || []}
                              pagination={false}
                              size="small"
                              scroll={{ x: 1280 }}
                              title={() => (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                  <Typography.Text strong>{"\u5b57\u6bb5\u6e05\u5355"}</Typography.Text>
                                  <Button type="link" onClick={() => openFieldEditor(tableIndex, null)}>{"\u65b0\u589e\u5b57\u6bb5"}</Button>
                                </div>
                              )}
                              columns={[
                                { title: "\u5b57\u6bb5\u540d", dataIndex: "columnName", width: 220 },
                                { title: "\u5b57\u6bb5\u7c7b\u578b", dataIndex: "columnType", width: 170 },
                                { title: "\u6765\u6e90\u5b57\u6bb5", dataIndex: "sourceFieldName", width: 180 },
                                { title: "\u53ef\u4e3a\u7a7a", dataIndex: "isNullable", width: 100, render: (value: boolean) => (value ? "\u662f" : "\u5426") },
                                { title: "\u4e3b\u952e", dataIndex: "isPrimaryKey", width: 90, render: (value: boolean) => (value ? "\u662f" : "\u5426") },
                                { title: "\u9ed8\u8ba4\u503c", dataIndex: "defaultValue", width: 140, render: (value: unknown) => renderCell(value) },
                                { title: "\u8bf4\u660e", dataIndex: "columnComment", width: 420 },
                                {
                                  title: "\u64cd\u4f5c",
                                  width: 180,
                                  fixed: "right",
                                  render: (_value, _fieldRecord, fieldIndex) => (
                                    <Space size={0}>
                                      <Button type="link" onClick={() => openFieldEditor(tableIndex, fieldIndex)}>{"\u7f16\u8f91"}</Button>
                                      <Popconfirm title={"\u786e\u8ba4\u5220\u9664\u5f53\u524d\u5b57\u6bb5\uff1f"} onConfirm={() => handleDeleteField(tableIndex, fieldIndex)}>
                                        <Button type="link" danger>{"\u5220\u9664"}</Button>
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
                        { title: "\u7269\u7406\u8868\u540d", dataIndex: "physicalTableName", width: 210, fixed: "left" },
                        { title: "\u663e\u793a\u540d\u79f0", dataIndex: "logicalLabel", width: 200, render: (value: string, record) => value || record.logicalTableName || "-" },
                        { title: "\u8868\u7c7b\u578b", dataIndex: "tableKind", width: 110, render: (value: string) => translatePhysicalTableKind(value) },
                        { title: "\u4e1a\u52a1\u89d2\u8272", dataIndex: "businessRole", width: 120, render: (value: string) => translatePhysicalBusinessRole(value) },
                        { title: "\u8bf4\u660e", dataIndex: "tableComment", width: 320, render: (value: string) => renderCell(value) },
                        {
                          title: "\u64cd\u4f5c",
                          width: 250,
                          fixed: "right",
                          render: (_value, record, tableIndex) => (
                            <Space size={0}>
                              <Button type="link" onClick={() => openTableEditor(tableIndex)}>{"\u7f16\u8f91\u8868"}</Button>
                              <Button type="link" onClick={() => openFieldEditor(tableIndex, null)}>{"\u65b0\u589e\u5b57\u6bb5"}</Button>
                              {!physicalDirty ? <Button type="link" onClick={() => openDdl(record)}>{"\u67e5\u770b DDL"}</Button> : <Typography.Text type="secondary">{"\u4fdd\u5b58\u8349\u7a3f\u540e\u53ef\u67e5\u770b DDL"}</Typography.Text>}
                              <Popconfirm title={"\u786e\u8ba4\u5220\u9664\u5f53\u524d\u6570\u636e\u8868\uff1f"} onConfirm={() => handleDeleteTable(tableIndex)}>
                                <Button type="link" danger>{"\u5220\u9664"}</Button>
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
                key: "plan",
                label: "\u6837\u672c\u6570\u636e",
                children: activeGenerationVersion ? (
                  <Space direction="vertical" size={16} style={{ display: "flex" }}>
                    <Descriptions bordered size="small" column={2}>
                      <Descriptions.Item label={"\u6837\u672c\u7248\u672c"}>{"V" + activeGenerationVersion.versionNo}</Descriptions.Item>
                      <Descriptions.Item label={"\u7269\u7406\u7248\u672c"}>{"V" + activeGenerationVersion.physicalVersionNo}</Descriptions.Item>
                      <Descriptions.Item label={"\u76ee\u6807\u6570\u636e\u6e90"}>{String(planDeployTarget.targetDataSourceName || instanceDeployTarget.targetDataSourceName || "-")}</Descriptions.Item>
                      <Descriptions.Item label={"\u6570\u636e\u5e93"}>{String(planDeployTarget.targetDataSourceType || instance?.dbType || "-").toUpperCase() + " / " + String(planDeployTarget.databaseName || instanceDeployTarget.databaseName || "-")}</Descriptions.Item>
                      <Descriptions.Item label={"\u521d\u59cb\u6570\u636e\u91cf"}>{String(planSizing.initialDataVolume || "-")}</Descriptions.Item>
                      <Descriptions.Item label={"\u589e\u91cf\u6570\u636e\u91cf"}>{String(planSizing.incrementalDataVolume || "-")}</Descriptions.Item>
                      <Descriptions.Item label={"\u6bcf\u8868\u6837\u672c\u884c\u6570"}>{String(planSizing.sampleRowsPerTable || "-")}</Descriptions.Item>
                      <Descriptions.Item label={"\u65f6\u95f4\u8de8\u5ea6"}>{planTimeline.days ? String(planTimeline.days) + " \u5929" : "-"}</Descriptions.Item>
                    </Descriptions>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                      <Card bordered={false}><Statistic title={"\u6837\u672c\u8868\u6570"} value={Number(planSummary.tableCount || 0)} /></Card>
                      <Card bordered={false}><Statistic title={"\u76ee\u6807\u884c\u6570"} value={Number(planSummary.targetRowCount || 0)} /></Card>
                      <Card bordered={false}><Statistic title={"\u5df2\u88c5\u8f7d\u884c\u6570"} value={Number(planSummary.loadedRowCount || planLoadSummary.loadedRowCount || 0)} /></Card>
                      <Card bordered={false}><Statistic title={"\u9884\u89c8\u8868\u6570"} value={Number(sampleSummary.previewTableCount || 0)} /></Card>
                    </div>

                    <Table<PreviewTableRow>
                      rowKey="logicalTableName"
                      dataSource={previewTables}
                      pagination={{ pageSize: 8, size: "small" }}
                      scroll={{ x: 980 }}
                      locale={{ emptyText: <Empty description={"\u6682\u65e0\u6837\u672c\u9884\u89c8"} /> }}
                      columns={[
                        { title: "\u7269\u7406\u8868", dataIndex: "physicalTableName", width: 280 },
                        { title: "\u903b\u8f91\u5bf9\u8c61", dataIndex: "logicalTableName", width: 180 },
                        { title: "\u8868\u7c7b\u578b", dataIndex: "tableKind", width: 120, render: (value: string) => translatePhysicalTableKind(value) },
                        { title: "\u4e1a\u52a1\u89d2\u8272", dataIndex: "businessRole", width: 120, render: (value: string) => translatePhysicalBusinessRole(value) },
                        { title: "\u76ee\u6807\u884c\u6570", dataIndex: "rowCountTarget", width: 100, align: "center" },
                        { title: "\u9884\u89c8\u884c\u6570", dataIndex: "previewRowCount", width: 100, align: "center" },
                        { title: "\u64cd\u4f5c", width: 120, render: (_value, record) => <Button type="link" onClick={() => setSelectedPreviewTable(record.logicalTableName)}>{"\u67e5\u770b"}</Button> },
                      ]}
                    />

                    {activePreviewTable ? (
                      <Card bordered={false} title={"\u6837\u672c\u6570\u636e / " + activePreviewTable.physicalTableName}>
                        <Table<Record<string, unknown> & { __rowKey: string }>
                          rowKey="__rowKey"
                          dataSource={previewRows}
                          pagination={false}
                          scroll={{ x: Math.max(960, previewColumns.length * 160) }}
                          columns={previewColumns}
                        />
                      </Card>
                    ) : (
                      <Empty description={"\u8bf7\u9009\u62e9\u4e00\u5f20\u9884\u89c8\u8868"} />
                    )}
                  </Space>
                ) : <Empty description={"\u6682\u65e0\u6837\u672c\u65b9\u6848"} />,
              },
              {
                key: "versions",
                label: "\u7248\u672c\u7ba1\u7406",
                children: (
                  <Space direction="vertical" size={16} style={{ display: "flex" }}>
                    <Table<LabBusinessSystemPhysicalModelVersionRecord>
                      rowKey="id"
                      dataSource={physicalVersions}
                      pagination={false}
                      scroll={{ x: 1180 }}
                      locale={{ emptyText: <Empty description={"\u6682\u65e0\u7269\u7406\u7248\u672c"} /> }}
                      columns={[
                        { title: "\u7248\u672c", width: 120, render: (_value, record) => <Space><Typography.Text strong>{"V" + record.versionNo}</Typography.Text>{record.isCurrent ? <Tag color="success">{"\u5f53\u524d"}</Tag> : null}</Space> },
                        { title: "\u72b6\u6001", dataIndex: "versionStatus", width: 120, render: (value: string) => renderStatus(value, VERSION_STATUS_META) },
                        { title: "\u903b\u8f91\u7248\u672c", dataIndex: "logicalVersionNo", width: 100, align: "center", render: (value: number) => "V" + value },
                        { title: "\u6570\u636e\u5e93", dataIndex: "dbType", width: 120, render: (value: string) => String(value || "-").toUpperCase() },
                        { title: "\u8868\u6570", dataIndex: "tableCount", width: 90, align: "center" },
                        { title: "\u5b57\u6bb5\u6570", dataIndex: "columnCount", width: 90, align: "center" },
                        { title: "\u7248\u672c\u8bf4\u660e", dataIndex: "modelSummary" },
                        { title: "\u66f4\u65b0\u65f6\u95f4", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
                        {
                          title: "\u64cd\u4f5c",
                          width: 190,
                          render: (_value, record) => (
                            <Space size={0}>
                              <Button type="link" onClick={() => setActivePhysicalVersionId(record.id)}>{"\u67e5\u770b"}</Button>
                              <Popconfirm title={"\u786e\u8ba4\u5220\u9664\u8be5\u7269\u7406\u7248\u672c\uff1f"} onConfirm={() => void handleDeletePhysicalVersion(record.id)}>
                                <Button type="link" danger loading={deletingVersionKey === ("physical_" + record.id)}>{"\u5220\u9664"}</Button>
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                    {ddlBundle.script ? (
                      <Card
                        bordered={false}
                        title={"DDL \u811a\u672c"}
                        extra={<Button type="primary" size="small" onClick={() => void handleCopyText(String(ddlBundle.script), "DDL \u5df2\u590d\u5236")}>{"\u4e00\u952e\u590d\u5236"}</Button>}
                      >
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>{String(ddlBundle.script)}</pre>
                      </Card>
                    ) : null}
                  </Space>
                ),
              },
            ]}
          />
      </Card>

      <Modal open={tableModalOpen} title={"\u7f16\u8f91\u6570\u636e\u8868"} onCancel={() => setTableModalOpen(false)} onOk={() => void handleSaveTable()} destroyOnHidden>
        <Form form={physicalTableForm} layout="vertical" onValuesChange={(changedValues: Partial<PhysicalTableFormValues>) => {
          if (changedValues.tableKind === "DICTIONARY") {
            physicalTableForm.setFieldValue("businessRole", "DICTIONARY");
          }
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item name="tableKind" label={"\u8868\u7c7b\u578b"} rules={[{ required: true, message: "\u8bf7\u9009\u62e9\u8868\u7c7b\u578b" }]}>
              <Select options={PHYSICAL_TABLE_KIND_OPTIONS} />
            </Form.Item>
            <Form.Item name="businessRole" label={"\u4e1a\u52a1\u89d2\u8272"} rules={[{ required: true, message: "\u8bf7\u9009\u62e9\u4e1a\u52a1\u89d2\u8272" }]}>
              <Select options={PHYSICAL_BUSINESS_ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item name="logicalTableName" label={"\u903b\u8f91\u8868\u540d"} rules={[{ required: true, message: "\u8bf7\u8f93\u5165\u903b\u8f91\u8868\u540d" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="physicalTableName" label={"\u7269\u7406\u8868\u540d"} rules={[{ required: true, message: "\u8bf7\u8f93\u5165\u7269\u7406\u8868\u540d" }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="logicalLabel" label={"\u663e\u793a\u540d\u79f0"}>
            <Input />
          </Form.Item>
          <Form.Item name="tableComment" label={"\u8bf4\u660e"}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={fieldModalOpen} title={"\u7f16\u8f91\u5b57\u6bb5"} onCancel={() => setFieldModalOpen(false)} onOk={() => void handleSaveField()} destroyOnHidden>
        <Form form={physicalFieldForm} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item name="columnName" label={"\u5b57\u6bb5\u540d"} rules={[{ required: true, message: "\u8bf7\u8f93\u5165\u5b57\u6bb5\u540d" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="columnType" label={"\u5b57\u6bb5\u7c7b\u578b"} rules={[{ required: true, message: "\u8bf7\u9009\u62e9\u5b57\u6bb5\u7c7b\u578b" }]}>
              <Select showSearch options={PHYSICAL_COLUMN_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="sourceFieldName" label={"\u6765\u6e90\u5b57\u6bb5"}>
              <Input />
            </Form.Item>
            <Form.Item name="defaultValue" label={"\u9ed8\u8ba4\u503c"}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="columnComment" label={"\u8bf4\u660e"}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space size={24}>
            <Form.Item name="isNullable" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>{"\u53ef\u4e3a\u7a7a"}</Checkbox>
            </Form.Item>
            <Form.Item name="isPrimaryKey" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>{"\u4e3b\u952e"}</Checkbox>
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal open={ddlOpen} title={"DDL \u811a\u672c / " + ddlTitle} width={960} footer={null} onCancel={() => setDdlOpen(false)}>
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="primary" onClick={() => void handleCopyText(ddlContent, "DDL \u5df2\u590d\u5236")}>{"\u4e00\u952e\u590d\u5236 DDL"}</Button>
          </div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>{ddlContent || "--"}</pre>
        </Space>
      </Modal>
    </Space>
  );
}
