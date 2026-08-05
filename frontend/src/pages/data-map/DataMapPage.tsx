import {
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  ImportOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  UpOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tree,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { FormSection } from "../../components/ui/FormSection";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  createDataMapBusinessSystem,
  createDataMapCatalog,
  createDataMapDataSource,
  createDataMapDepartment,
  deleteDataMapBusinessSystem,
  deleteDataMapCatalog,
  deleteDataMapDataSource,
  deleteDataMapDepartment,
  deleteDataMapResource,
  deleteDataMapResources,
  fetchDataMapBusinessSystems,
  fetchDataMapCatalogTree,
  fetchDataMapCatalogs,
  fetchDataMapDataSourceTables,
  fetchDataMapDataSources,
  fetchDataMapDepartments,
  fetchDataMapExternalDataSources,
  fetchDataMapResources,
  registerDataMapResources,
  testDataMapDataSource,
  updateDataMapBusinessSystem,
  updateDataMapCatalog,
  updateDataMapDataSource,
  updateDataMapDepartment,
  updateDataMapResource,
  type DataMapBusinessSystem,
  type DataMapCatalog,
  type DataMapDataSource,
  type DataMapDepartment,
  type DataMapExternalDataSource,
  type DataMapResource,
} from "../../services/dataMap";
import type { DataSourceTable } from "../../types/api";
import {
  buildConnectionConfigFromForm,
  DATABASE_SOURCE_TYPE_OPTIONS,
  DATASOURCE_CODE_PATTERN,
  getDefaultPort,
  normalizeDatasourceCode,
  normalizeDatasourceType,
} from "../../utils/datasource";

type SectionKey = "departments" | "systems" | "sources" | "resources";
type CatalogTreeNode = {
  key: number;
  title: string;
  children?: CatalogTreeNode[];
};

type Props = {
  section: SectionKey;
};
type ResourceColumnSetting = {
  key: string;
  visible: boolean;
};
type ResourceFilterDimension = "departmentId" | "businessSystemId" | "catalogId" | "resourceCategory" | "businessTags";
type ResourceFilterState = {
  keyword: string;
  departmentId?: number;
  businessSystemId?: number;
  catalogId?: number;
  resourceCategory?: string;
  businessTags?: string[];
};

const RESOURCE_LIST_COLUMN_STORAGE_KEY = "data_map_resource_list_columns_v2";
const LEGACY_RESOURCE_LIST_COLUMN_STORAGE_KEY = "data_map_resource_list_columns_v1";
const DEFAULT_RESOURCE_COLUMN_KEYS = [
  "resourceCode",
  "tableName",
  "tableComment",
  "rowCount",
  "resourceCategory",
  "systemName",
  "sourceName",
  "catalogName",
  "businessTags",
  "columnCount",
  "status",
] as const;

const sourceTypeOptions = [
  ...DATABASE_SOURCE_TYPE_OPTIONS,
  { value: "gaussdb", label: "GaussDB" },
  { value: "jdbc", label: "JDBC" },
  { value: "hive", label: "Hive" },
  { value: "clickhouse", label: "ClickHouse" },
  { value: "api", label: "API" },
  { value: "sftp", label: "SFTP" },
  { value: "kafka", label: "Kafka" },
  { value: "other", label: "其他" },
];

const externalModuleOptions = [
  { value: "", label: "全部模块" },
  { value: "ingestion", label: "数据接入" },
  { value: "quality", label: "质量管控" },
  { value: "reporting", label: "报表平台" },
  { value: "services", label: "数据服务" },
  { value: "development", label: "数据开发" },
];

const categoryOptions = [
  { value: "business", label: "业务表" },
  { value: "dictionary", label: "字典表" },
  { value: "relation", label: "关联表" },
  { value: "log", label: "日志表" },
  { value: "temporary", label: "临时表" },
  { value: "low_value", label: "低价值表" },
];
const categoryLabelMap = Object.fromEntries(categoryOptions.map((item) => [item.value, item.label]));

const statusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
];

const lifecycleOptions = [
  { value: "planning", label: "规划中" },
  { value: "online", label: "已上线" },
  { value: "offline", label: "已下线" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
}

function formatFormDate(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value && "format" in value && typeof (value as { format?: unknown }).format === "function") {
    return (value as { format: (format: string) => string }).format("YYYY-MM-DD");
  }
  return String(value).slice(0, 10);
}

function formatCsvValue(value: unknown) {
  const text = Array.isArray(value) ? value.join("、") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function resourceMatchesKeyword(record: DataMapResource, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  return [
    record.resourceCode,
    record.tableName,
    record.tableComment,
  ].some((value) => String(value || "").toLowerCase().includes(normalizedKeyword));
}

function resourceMatchesFilters(record: DataMapResource, filters: ResourceFilterState, omit?: ResourceFilterDimension) {
  if (!resourceMatchesKeyword(record, filters.keyword)) return false;
  if (omit !== "departmentId" && filters.departmentId && record.departmentId !== Number(filters.departmentId)) return false;
  if (omit !== "businessSystemId" && filters.businessSystemId && record.businessSystemId !== Number(filters.businessSystemId)) return false;
  if (omit !== "catalogId" && filters.catalogId && record.catalogId !== Number(filters.catalogId)) return false;
  if (omit !== "resourceCategory" && filters.resourceCategory && record.resourceCategory !== filters.resourceCategory) return false;
  if (omit !== "businessTags" && (filters.businessTags || []).length > 0) {
    const tagSet = new Set(record.businessTags || []);
    if (!(filters.businessTags || []).some((tag) => tagSet.has(tag))) return false;
  }
  return true;
}

type RegisterTablePickerProps = {
  value?: string[];
  onChange?: (value: string[]) => void;
  tables: DataSourceTable[];
  disabledTableNames: Set<string>;
  keyword: string;
  onKeywordChange: (value: string) => void;
};

function RegisterTablePicker({
  value,
  onChange,
  tables,
  disabledTableNames,
  keyword,
  onKeywordChange,
}: RegisterTablePickerProps) {
  const selectedNames = Array.isArray(value) ? value : [];
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredTables = tables.filter((item) => {
    if (!normalizedKeyword) return true;
    return `${item.tableName} ${item.tableComment || ""}`.toLowerCase().includes(normalizedKeyword);
  });
  const availableFilteredTables = filteredTables.filter((item) => !disabledTableNames.has(item.tableName));

  function normalizeSelection(nextNames: string[]) {
    const nextSet = new Set(nextNames.filter((name) => !disabledTableNames.has(name)));
    return tables.filter((item) => nextSet.has(item.tableName)).map((item) => item.tableName);
  }

  function selectFilteredTables() {
    onChange?.(normalizeSelection([...selectedNames, ...availableFilteredTables.map((item) => item.tableName)]));
  }

  function clearSelectedTables() {
    onChange?.([]);
  }

  const columns: ColumnsType<DataSourceTable> = [
    {
      title: "表名",
      dataIndex: "tableName",
      width: 280,
      render: (text: string, record) => (
        <Space size={8}>
          <Typography.Text strong={!disabledTableNames.has(record.tableName)}>{text}</Typography.Text>
          {disabledTableNames.has(record.tableName) ? <Tag>已归属当前组织分类</Tag> : null}
        </Space>
      ),
    },
    {
      title: "表描述",
      dataIndex: "tableComment",
      render: (text?: string) => text || "-",
    },
    {
      title: "类型",
      dataIndex: "tableType",
      width: 120,
    },
  ];

  return (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
        <Input.Search
          allowClear
          placeholder="搜索表名 / 表描述"
          style={{ width: 320 }}
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        <Space wrap>
          <Typography.Text type="secondary">
            已选 {selectedNames.length} / 可选 {Math.max(tables.length - disabledTableNames.size, 0)}
            {normalizedKeyword ? `，当前筛选 ${availableFilteredTables.length}` : ""}
          </Typography.Text>
          <Button size="small" onClick={selectFilteredTables} disabled={!availableFilteredTables.length}>
            全选当前筛选
          </Button>
          <Button size="small" onClick={clearSelectedTables} disabled={!selectedNames.length}>
            清空已选
          </Button>
        </Space>
      </Space>
      <Table<DataSourceTable>
        rowKey="tableName"
        size="small"
        columns={columns}
        dataSource={filteredTables}
        rowSelection={{
          selectedRowKeys: selectedNames,
          preserveSelectedRowKeys: true,
          getCheckboxProps: (record) => ({ disabled: disabledTableNames.has(record.tableName) }),
          onChange: (keys) => onChange?.(normalizeSelection(keys.map(String))),
        }}
        pagination={filteredTables.length > 8 ? { pageSize: 8, size: "small", showSizeChanger: false } : false}
        scroll={{ y: 280 }}
      />
    </Space>
  );
}

function tagsToText(tags?: string[]) {
  return (Array.isArray(tags) ? tags : []).join(",");
}

function textToTags(value?: unknown) {
  return String(value || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTagValues(values?: unknown[]) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function buildResourceColumnSettings(visibleKeys?: string[]): ResourceColumnSetting[] {
  const orderedVisibleKeys = visibleKeys || [...DEFAULT_RESOURCE_COLUMN_KEYS];
  const visibleKeySet = new Set(orderedVisibleKeys);
  const orderedKeys = [
    ...orderedVisibleKeys,
    ...DEFAULT_RESOURCE_COLUMN_KEYS.filter((key) => !visibleKeySet.has(key)),
  ];

  return orderedKeys.map((key) => ({ key, visible: visibleKeySet.has(key) }));
}

function normalizeResourceColumnKeys(keys: unknown[]) {
  const allowedColumns = new Set<string>(DEFAULT_RESOURCE_COLUMN_KEYS);
  const seenColumns = new Set<string>();

  return keys.filter((item): item is string => {
    if (typeof item !== "string" || !allowedColumns.has(item) || seenColumns.has(item)) {
      return false;
    }
    seenColumns.add(item);
    return true;
  });
}

function normalizeResourceColumnSettings(value: unknown): ResourceColumnSetting[] {
  if (!Array.isArray(value)) {
    return buildResourceColumnSettings();
  }

  if (value.every((item) => typeof item === "string")) {
    const visibleKeys = normalizeResourceColumnKeys(value);
    return visibleKeys.length > 0 ? buildResourceColumnSettings(visibleKeys) : buildResourceColumnSettings();
  }

  const allowedColumns = new Set<string>(DEFAULT_RESOURCE_COLUMN_KEYS);
  const seenColumns = new Set<string>();
  const nextSettings: ResourceColumnSetting[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const key = String((item as ResourceColumnSetting).key || "");
    if (!allowedColumns.has(key) || seenColumns.has(key)) return;
    seenColumns.add(key);
    nextSettings.push({ key, visible: (item as ResourceColumnSetting).visible !== false });
  });

  DEFAULT_RESOURCE_COLUMN_KEYS.forEach((key) => {
    if (!seenColumns.has(key)) {
      nextSettings.push({ key, visible: true });
    }
  });

  return nextSettings.length > 0 ? nextSettings : buildResourceColumnSettings();
}

function loadResourceColumnSettings() {
  if (typeof window === "undefined") {
    return buildResourceColumnSettings();
  }

  try {
    const rawValue = window.localStorage.getItem(RESOURCE_LIST_COLUMN_STORAGE_KEY);
    if (rawValue) {
      return normalizeResourceColumnSettings(JSON.parse(rawValue));
    }
  } catch (_error) {
    return buildResourceColumnSettings();
  }

  try {
    const legacyValue = window.localStorage.getItem(LEGACY_RESOURCE_LIST_COLUMN_STORAGE_KEY);
    if (legacyValue) {
      return normalizeResourceColumnSettings(JSON.parse(legacyValue));
    }
  } catch (_error) {
    return buildResourceColumnSettings();
  }

  return buildResourceColumnSettings();
}

function buildTreeData(catalogs: DataMapCatalog[]): CatalogTreeNode[] {
  return catalogs.map((item) => ({
    key: item.id,
    title: item.catalogName,
    children: item.children ? buildTreeData(item.children) : undefined,
  }));
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

function buildCatalogOptionsWithPath(catalogs: DataMapCatalog[], parentPath = ""): Array<{ value: number; label: string }> {
  return catalogs.flatMap((item) => {
    const currentPath = parentPath ? `${parentPath} / ${item.catalogName}` : item.catalogName;
    const option = {
      value: item.id,
      label: `${currentPath} (${item.catalogShortCode})`,
    };
    return [option, ...buildCatalogOptionsWithPath(item.children || [], currentPath)];
  });
}

function buildSourcePayload(values: Record<string, unknown>) {
  return {
    businessSystemId: values.businessSystemId,
    sourceName: String(values.sourceName || "").trim(),
    sourceCode: normalizeDatasourceCode(values.sourceCode),
    sourceType: values.sourceType,
    ownerName: String(values.ownerName || "system").trim(),
    environment: values.environment || "prod",
    purpose: String(values.purpose || "").trim(),
    connectionConfig: buildConnectionConfigFromForm(values),
    sourceRefModule: values.sourceRefModule || "",
    sourceRefId: values.sourceRefId || null,
    sourceRefCode: values.sourceRefCode || "",
    sourceRefSnapshot: values.sourceRefSnapshot || null,
    status: values.status || "active",
  };
}

export function DataMapPage({ section }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [departmentForm] = Form.useForm();
  const [systemForm] = Form.useForm();
  const [sourceForm] = Form.useForm();
  const [catalogForm] = Form.useForm();
  const [resourceForm] = Form.useForm();
  const [modal, modalContextHolder] = Modal.useModal();

  const [departments, setDepartments] = useState<DataMapDepartment[]>([]);
  const [systems, setSystems] = useState<DataMapBusinessSystem[]>([]);
  const [sources, setSources] = useState<DataMapDataSource[]>([]);
  const [catalogs, setCatalogs] = useState<DataMapCatalog[]>([]);
  const [catalogTree, setCatalogTree] = useState<DataMapCatalog[]>([]);
  const [resources, setResources] = useState<DataMapResource[]>([]);
  const [externalSources, setExternalSources] = useState<DataMapExternalDataSource[]>([]);
  const [sourceTables, setSourceTables] = useState<DataSourceTable[]>([]);
  const [registerTableKeyword, setRegisterTableKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);

  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [systemModalOpen, setSystemModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [externalModalOpen, setExternalModalOpen] = useState(false);

  const [editingDepartment, setEditingDepartment] = useState<DataMapDepartment | null>(null);
  const [editingSystem, setEditingSystem] = useState<DataMapBusinessSystem | null>(null);
  const [editingSource, setEditingSource] = useState<DataMapDataSource | null>(null);
  const [editingCatalog, setEditingCatalog] = useState<DataMapCatalog | null>(null);
  const [updatingResourceIds, setUpdatingResourceIds] = useState<number[]>([]);

  const [keyword, setKeyword] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>();
  const [systemFilter, setSystemFilter] = useState<number | undefined>();
  const [catalogFilter, setCatalogFilter] = useState<number | undefined>();
  const [catalogPanelVisible, setCatalogPanelVisible] = useState(true);
  const [catalogPanelWidth, setCatalogPanelWidth] = useState(320);
  const [catalogPanelResizing, setCatalogPanelResizing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [businessTagFilter, setBusinessTagFilter] = useState<string[]>([]);
  const [externalModule, setExternalModule] = useState("");
  const [sourceRefSnapshot, setSourceRefSnapshot] = useState<Record<string, unknown> | null>(null);
  const [resourceColumnSettings, setResourceColumnSettings] = useState<ResourceColumnSetting[]>(() => loadResourceColumnSettings());
  const [selectedResourceRowKeys, setSelectedResourceRowKeys] = useState<number[]>([]);
  const catalogPanelResizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const currentSourceType = Form.useWatch("sourceType", sourceForm);
  const catalogDepartmentId = Form.useWatch("departmentId", catalogForm);
  const registerCatalogId = Form.useWatch("catalogId", resourceForm);
  const registerDataSourceId = Form.useWatch("dataSourceId", resourceForm);
  const jdbcMode = normalizeDatasourceType(currentSourceType) === "jdbc";

  const departmentOptions = useMemo(
    () => departments.map((item) => ({ value: item.id, label: `${item.departmentName} (${item.departmentCode})` })),
    [departments]
  );
  const systemOptions = useMemo(
    () => systems.map((item) => ({ value: item.id, label: `${item.systemName} (${item.systemCode})`, departmentId: item.departmentId })),
    [systems]
  );
  const catalogPathMap = useMemo(
    () => buildCatalogPathMap(catalogTree),
    [catalogTree]
  );
  const catalogPathOptions = useMemo(
    () => buildCatalogOptionsWithPath(catalogTree),
    [catalogTree]
  );
  const businessTagOptions = useMemo(
    () => normalizeTagValues(resources.flatMap((item) => item.businessTags || []))
      .sort((left, right) => left.localeCompare(right, "zh-CN"))
      .map((tag) => ({ value: tag, label: tag })),
    [resources]
  );
  const resourceFilters = useMemo<ResourceFilterState>(() => ({
    keyword,
    departmentId: departmentFilter,
    businessSystemId: systemFilter,
    catalogId: catalogFilter,
    resourceCategory: categoryFilter,
    businessTags: businessTagFilter,
  }), [keyword, departmentFilter, systemFilter, catalogFilter, categoryFilter, businessTagFilter]);
  const visibleResources = useMemo(
    () => resources.filter((item) => resourceMatchesFilters(item, resourceFilters)),
    [resources, resourceFilters]
  );
  const departmentFilterOptions = useMemo(() => {
    const availableIds = new Set(resources
      .filter((item) => resourceMatchesFilters(item, resourceFilters, "departmentId"))
      .map((item) => item.departmentId));
    return departmentOptions.filter((item) => availableIds.has(item.value) || item.value === departmentFilter);
  }, [departmentFilter, departmentOptions, resourceFilters, resources]);
  const systemFilterOptions = useMemo(() => {
    const availableIds = new Set(resources
      .filter((item) => resourceMatchesFilters(item, resourceFilters, "businessSystemId"))
      .map((item) => item.businessSystemId));
    return systemOptions.filter((item) => availableIds.has(item.value) || item.value === systemFilter);
  }, [resourceFilters, resources, systemFilter, systemOptions]);
  const catalogFilterOptions = useMemo(() => {
    const availableIds = new Set(resources
      .filter((item) => resourceMatchesFilters(item, resourceFilters, "catalogId"))
      .map((item) => item.catalogId));
    return catalogPathOptions.filter((item) => availableIds.has(item.value) || item.value === catalogFilter);
  }, [catalogFilter, catalogPathOptions, resourceFilters, resources]);
  const selectedCatalogPath = useMemo(() => {
    if (!catalogFilter) return undefined;
    return catalogPathMap.get(catalogFilter) || catalogs.find((item) => item.id === catalogFilter)?.catalogName;
  }, [catalogFilter, catalogPathMap, catalogs]);
  const showCatalogPanel = section === "resources" && catalogPanelVisible;
  const categoryFilterOptions = useMemo(() => {
    const availableValues = new Set(resources
      .filter((item) => resourceMatchesFilters(item, resourceFilters, "resourceCategory"))
      .map((item) => item.resourceCategory)
      .filter(Boolean));
    return categoryOptions.filter((item) => availableValues.has(item.value) || item.value === categoryFilter);
  }, [categoryFilter, resourceFilters, resources]);
  const businessTagFilterOptions = useMemo(() => {
    const availableTags = new Set(resources
      .filter((item) => resourceMatchesFilters(item, resourceFilters, "businessTags"))
      .flatMap((item) => item.businessTags || []));
    return businessTagOptions.filter((item) => availableTags.has(item.value) || businessTagFilter.includes(item.value));
  }, [businessTagFilter, businessTagOptions, resourceFilters, resources]);
  const registerCatalogOptions = useMemo(
    () => buildCatalogOptionsWithPath(catalogTree),
    [catalogTree]
  );
  const catalogSystemOptions = useMemo(
    () => systemOptions.filter((item) => !catalogDepartmentId || item.departmentId === Number(catalogDepartmentId)),
    [catalogDepartmentId, systemOptions]
  );
  const registerSourceOptions = useMemo(
    () => sources.map((item) => ({ value: item.id, label: `${item.sourceName} (${item.sourceCode})` })),
    [sources]
  );
  const registeredTableNameSet = useMemo(() => {
    if (!registerCatalogId || !registerDataSourceId) return new Set<string>();
    return new Set(resources
      .filter((item) => item.catalogId === Number(registerCatalogId) && item.dataSourceId === Number(registerDataSourceId))
      .map((item) => item.tableName));
  }, [registerCatalogId, registerDataSourceId, resources]);

  async function loadAll(targetSection: SectionKey = section) {
    if (!token) return;
    setLoading(true);
    try {
      if (targetSection === "departments") {
        const deptRes = await fetchDataMapDepartments(token);
        setDepartments(deptRes.data);
        return;
      }

      if (targetSection === "systems") {
        const [deptRes, sysRes] = await Promise.all([
          fetchDataMapDepartments(token),
          fetchDataMapBusinessSystems(token),
        ]);
        setDepartments(deptRes.data);
        setSystems(sysRes.data);
        return;
      }

      if (targetSection === "sources") {
        const [sysRes, sourceRes] = await Promise.all([
          fetchDataMapBusinessSystems(token),
          fetchDataMapDataSources(token),
        ]);
        setSystems(sysRes.data);
        setSources(sourceRes.data);
        return;
      }

      const [deptRes, sysRes, sourceRes, catalogRes, treeRes, resourceRes] = await Promise.all([
        fetchDataMapDepartments(token),
        fetchDataMapBusinessSystems(token),
        fetchDataMapDataSources(token),
        fetchDataMapCatalogs(token),
        fetchDataMapCatalogTree(token),
        fetchDataMapResources(token),
      ]);
      setDepartments(deptRes.data);
      setSystems(sysRes.data);
      setSources(sourceRes.data);
      setCatalogs(catalogRes.data);
      setCatalogTree(treeRes.data);
      setResources(resourceRes.data);
    } catch (error) {
      message.error(`加载数据地图失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [section, token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESOURCE_LIST_COLUMN_STORAGE_KEY, JSON.stringify(resourceColumnSettings));
  }, [resourceColumnSettings]);

  useEffect(() => {
    const existingIds = new Set(visibleResources.map((item) => item.id));
    setSelectedResourceRowKeys((current) => current.filter((id) => existingIds.has(Number(id))));
  }, [visibleResources]);

  useEffect(() => {
    if (!catalogPanelResizing) {
      return undefined;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function handleMouseMove(event: MouseEvent) {
      const state = catalogPanelResizeStateRef.current;
      if (!state) return;
      const nextWidth = Math.min(460, Math.max(240, state.startWidth + (event.clientX - state.startX)));
      setCatalogPanelWidth(nextWidth);
    }

    function handleMouseUp() {
      catalogPanelResizeStateRef.current = null;
      setCatalogPanelResizing(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [catalogPanelResizing]);

  function handleDepartmentFilterChange(value?: number) {
    const nextValue = value ? Number(value) : undefined;
    setDepartmentFilter(nextValue);
    if (!nextValue) return;

    const selectedSystem = systems.find((item) => item.id === systemFilter);
    if (selectedSystem && selectedSystem.departmentId !== nextValue) {
      setSystemFilter(undefined);
    }

    const selectedCatalog = catalogs.find((item) => item.id === catalogFilter);
    if (selectedCatalog && selectedCatalog.departmentId !== nextValue) {
      setCatalogFilter(undefined);
    }
  }

  function handleSystemFilterChange(value?: number) {
    const nextValue = value ? Number(value) : undefined;
    setSystemFilter(nextValue);
    if (!nextValue) return;

    const selectedCatalog = catalogs.find((item) => item.id === catalogFilter);
    if (selectedCatalog?.businessSystemId && selectedCatalog.businessSystemId !== nextValue) {
      setCatalogFilter(undefined);
    }
  }

  function handleCatalogFilterChange(value?: number) {
    setCatalogFilter(value ? Number(value) : undefined);
  }

  function startCatalogPanelResize(clientX: number) {
    catalogPanelResizeStateRef.current = {
      startX: clientX,
      startWidth: catalogPanelWidth,
    };
    setCatalogPanelResizing(true);
  }

  async function openExternalSourceModal() {
    if (!token) return;
    setExternalModalOpen(true);
    try {
      const response = await fetchDataMapExternalDataSources(token, externalModule || undefined);
      setExternalSources(response.data);
    } catch (error) {
      message.error(`加载可引用数据源失败：${getErrorMessage(error)}`);
    }
  }

  async function refreshExternalSources(moduleKey: string) {
    if (!token) return;
    setExternalModule(moduleKey);
    try {
      const response = await fetchDataMapExternalDataSources(token, moduleKey || undefined);
      setExternalSources(response.data);
    } catch (error) {
      message.error(`加载可引用数据源失败：${getErrorMessage(error)}`);
    }
  }

  function applyExternalSource(record: DataMapExternalDataSource) {
    const config = record.connectionConfig || {};
    sourceForm.setFieldsValue({
      sourceName: record.sourceName,
      sourceCode: normalizeDatasourceCode(record.sourceCode),
      sourceType: record.sourceType,
      ownerName: record.ownerName || "system",
      host: config.host,
      port: config.port ?? getDefaultPort(record.sourceType),
      databaseName: config.database || config.databaseName,
      username: config.username || config.user,
      password: config.password,
      jdbcUrl: config.jdbcUrl,
      schema: config.schema,
      driverClassName: config.driverClassName,
      sourceRefModule: record.sourceRefModule,
      sourceRefId: record.sourceRefId,
      sourceRefCode: record.sourceRefCode,
    });
    setSourceRefSnapshot(record.sourceRefSnapshot);
    setExternalModalOpen(false);
  }

  function openCreateDepartment() {
    setEditingDepartment(null);
    departmentForm.resetFields();
    departmentForm.setFieldsValue({ status: "active", tagsText: "" });
    setDepartmentModalOpen(true);
  }

  function openEditDepartment(record: DataMapDepartment) {
    setEditingDepartment(record);
    departmentForm.setFieldsValue({ ...record, tagsText: tagsToText(record.tags) });
    setDepartmentModalOpen(true);
  }

  async function submitDepartment() {
    if (!token) return;
    const values = await departmentForm.validateFields();
    const payload = { ...values, tags: textToTags(values.tagsText) };
    setSubmitting(true);
    try {
      if (editingDepartment) {
        await updateDataMapDepartment(token, editingDepartment.id, payload);
        message.success("部门已更新");
      } else {
        await createDataMapDepartment(token, payload);
        message.success("部门已创建");
      }
      setDepartmentModalOpen(false);
      await loadAll();
    } catch (error) {
      message.error(`保存部门失败：${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateSystem() {
    setEditingSystem(null);
    systemForm.resetFields();
    systemForm.setFieldsValue({ status: "active", lifecycleStatus: "online", tagsText: "" });
    setSystemModalOpen(true);
  }

  function openEditSystem(record: DataMapBusinessSystem) {
    setEditingSystem(record);
    systemForm.setFieldsValue({
      ...record,
      onlineDate: record.onlineDate ? dayjs(record.onlineDate) : undefined,
      tagsText: tagsToText(record.tags),
    });
    setSystemModalOpen(true);
  }

  async function submitSystem() {
    if (!token) return;
    const values = await systemForm.validateFields();
    const payload = { ...values, onlineDate: formatFormDate(values.onlineDate), tags: textToTags(values.tagsText) };
    setSubmitting(true);
    try {
      if (editingSystem) {
        await updateDataMapBusinessSystem(token, editingSystem.id, payload);
        message.success("业务系统已更新");
      } else {
        await createDataMapBusinessSystem(token, payload);
        message.success("业务系统已创建");
      }
      setSystemModalOpen(false);
      await loadAll();
    } catch (error) {
      message.error(`保存业务系统失败：${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateSource() {
    setEditingSource(null);
    setSourceRefSnapshot(null);
    sourceForm.resetFields();
    sourceForm.setFieldsValue({ sourceType: "mysql", status: "active", environment: "prod", port: 3306 });
    setSourceModalOpen(true);
  }

  function openEditSource(record: DataMapDataSource) {
    const config = record.connectionConfig || {};
    setEditingSource(record);
    setSourceRefSnapshot(record.sourceRefSnapshot || null);
    sourceForm.setFieldsValue({
      ...record,
      host: config.host,
      port: config.port ?? getDefaultPort(record.sourceType),
      databaseName: config.database || config.databaseName,
      username: config.username || config.user,
      password: config.password,
      jdbcUrl: config.jdbcUrl,
      schema: config.schema,
      driverClassName: config.driverClassName,
    });
    setSourceModalOpen(true);
  }

  async function submitSource() {
    if (!token) return;
    const values = await sourceForm.validateFields();
    const payload = buildSourcePayload({ ...values, sourceRefSnapshot });
    setSubmitting(true);
    try {
      if (editingSource) {
        await updateDataMapDataSource(token, editingSource.id, payload);
        message.success("数据源已更新");
      } else {
        await createDataMapDataSource(token, payload);
        message.success("数据源已创建");
      }
      setSourceModalOpen(false);
      await loadAll();
    } catch (error) {
      message.error(`保存数据源失败：${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function testSourceConnection() {
    if (!token) return;
    const values = await sourceForm.validateFields([
      "sourceType",
      "host",
      "port",
      "databaseName",
      "username",
      "password",
      "jdbcUrl",
      "schema",
      "driverClassName",
    ]);
    setTesting(true);
    try {
      const response = await testDataMapDataSource(token, {
        sourceType: values.sourceType,
        connectionConfig: buildConnectionConfigFromForm(values),
      });
      if (response.data.success) {
        message.success(response.data.message);
      } else {
        message.error(response.data.error || response.data.message);
      }
    } catch (error) {
      message.error(`连接测试失败：${getErrorMessage(error)}`);
    } finally {
      setTesting(false);
    }
  }

  function openCreateCatalog(parentId?: number) {
    setEditingCatalog(null);
    catalogForm.resetFields();
    catalogForm.setFieldsValue({ parentId, status: "active", sortOrder: 0 });
    setCatalogModalOpen(true);
  }

  function openEditCatalog(record: DataMapCatalog) {
    setEditingCatalog(record);
    catalogForm.setFieldsValue(record);
    setCatalogModalOpen(true);
  }

  async function submitCatalog() {
    if (!token) return;
    const values = await catalogForm.validateFields();
    setSubmitting(true);
    try {
      if (editingCatalog) {
        await updateDataMapCatalog(token, editingCatalog.id, values);
        message.success("组织分类已更新");
      } else {
        await createDataMapCatalog(token, values);
        message.success("组织分类已创建");
      }
      setCatalogModalOpen(false);
      await loadAll();
    } catch (error) {
      message.error(`保存组织分类失败：${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDeleteCatalog(record: DataMapCatalog) {
    if (!token) return;
    modal.confirm({
      title: "确认删除该组织分类？",
      content: record.resourceCount ? "该分类已关联资源，删除可能会被系统拦截，请先处理资源后再删除。" : `将删除“${record.catalogName}”。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteDataMapCatalog(token, record.id);
          if (catalogFilter === record.id) {
            setCatalogFilter(undefined);
          }
          message.success("组织分类已删除");
          await loadAll();
        } catch (error) {
          message.error(`删除组织分类失败：${getErrorMessage(error)}`);
        }
      },
    });
  }

  async function openRegisterResource(catalog?: DataMapCatalog) {
    resourceForm.resetFields();
    resourceForm.setFieldsValue({ catalogId: catalog?.id, rowCountMode: "estimated", businessTags: [], resourceCategory: "business" });
    setSourceTables([]);
    setRegisterTableKeyword("");
    setResourceModalOpen(true);
  }

  async function loadTablesForRegister(sourceId: number) {
    if (!token || !sourceId) return;
    try {
      const response = await fetchDataMapDataSourceTables(token, sourceId);
      setSourceTables(response.data);
    } catch (error) {
      message.error(`加载数据源表失败：${getErrorMessage(error)}`);
    }
  }

  async function submitResource() {
    if (!token) return;
    const values = await resourceForm.validateFields();
    setSubmitting(true);
    try {
      await registerDataMapResources(token, Number(values.catalogId), {
        dataSourceId: values.dataSourceId,
        tableNames: values.tableNames,
        resourceCategory: values.resourceCategory || "",
        businessTags: normalizeTagValues(values.businessTags),
        rowCountMode: values.rowCountMode || "estimated",
      });
      message.success("资源已注册");
      setResourceModalOpen(false);
      await loadAll();
    } catch (error) {
      message.error(`保存资源失败：${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateResourceInline(record: DataMapResource, payload: {
    resourceCategory?: string;
    businessTags?: string[];
    status?: string;
  }) {
    if (!token) return;
    setUpdatingResourceIds((current) => [...current, record.id]);
    try {
      await updateDataMapResource(token, record.id, payload);
      message.success("资源已更新");
      await loadAll();
    } catch (error) {
      message.error(`更新资源失败：${getErrorMessage(error)}`);
    } finally {
      setUpdatingResourceIds((current) => current.filter((id) => id !== record.id));
    }
  }

  function openResourceDetail(record: DataMapResource) {
    navigate(`/dashboard/data-map/resources/${record.id}`);
  }

  const departmentColumns: ColumnsType<DataMapDepartment> = [
    { title: "部门名称", dataIndex: "departmentName", width: 180 },
    { title: "部门编码", dataIndex: "departmentCode", width: 140 },
    { title: "联系人", dataIndex: "contactName", width: 120 },
    { title: "数据负责人", dataIndex: "dataOwner", width: 120 },
    { title: "业务系统", dataIndex: "systemCount", width: 100 },
    { title: "资源数", dataIndex: "resourceCount", width: 100 },
    { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    { title: "更新时间", dataIndex: "updatedAt", width: 180, render: formatDateTime },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditDepartment(record)}>编辑</Button>
          <Popconfirm title="确认删除该部门？" onConfirm={() => token && deleteDataMapDepartment(token, record.id).then(() => loadAll()).catch((error) => message.error(getErrorMessage(error)))}>
            <Button danger type="link">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const systemColumns: ColumnsType<DataMapBusinessSystem> = [
    { title: "系统名称", dataIndex: "systemName", width: 180 },
    { title: "系统编码", dataIndex: "systemCode", width: 140 },
    { title: "所属部门", dataIndex: "departmentName", width: 160 },
    { title: "系统类型", dataIndex: "systemType", width: 120 },
    { title: "上线时间", dataIndex: "onlineDate", width: 120, render: formatDateOnly },
    { title: "联系人", dataIndex: "contactName", width: 120 },
    { title: "数据源", dataIndex: "sourceCount", width: 100 },
    { title: "资源数", dataIndex: "resourceCount", width: 100 },
    { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditSystem(record)}>编辑</Button>
          <Popconfirm title="确认删除该业务系统？" onConfirm={() => token && deleteDataMapBusinessSystem(token, record.id).then(() => loadAll()).catch((error) => message.error(getErrorMessage(error)))}>
            <Button danger type="link">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sourceColumns: ColumnsType<DataMapDataSource> = [
    { title: "数据源名称", dataIndex: "sourceName", width: 180 },
    { title: "数据源编码", dataIndex: "sourceCode", width: 160 },
    { title: "类型", dataIndex: "sourceType", width: 110 },
    { title: "所属系统", dataIndex: "systemName", width: 160 },
    { title: "所属部门", dataIndex: "departmentName", width: 160 },
    { title: "环境", dataIndex: "environment", width: 90 },
    {
      title: "配置来源",
      key: "sourceRefModule",
      width: 140,
      render: (_, record) => record.sourceRefModule ? <Tag>{record.sourceRefModule}</Tag> : <Typography.Text type="secondary">手工维护</Typography.Text>,
    },
    { title: "资源数", dataIndex: "resourceCount", width: 90 },
    { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditSource(record)}>编辑</Button>
          <Popconfirm title="确认删除该数据源？" onConfirm={() => token && deleteDataMapDataSource(token, record.id).then(() => loadAll()).catch((error) => message.error(getErrorMessage(error)))}>
            <Button danger type="link">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const resourceColumns: ColumnsType<DataMapResource> = [
    { key: "resourceCode", title: "资源编码", dataIndex: "resourceCode", width: 220 },
    {
      key: "tableName",
      title: "表名称",
      dataIndex: "tableName",
      width: 220,
      render: (value: string, record) => (
        <Button type="link" style={{ paddingInline: 0, height: "auto" }} onClick={() => void openResourceDetail(record)}>
          {value}
        </Button>
      ),
    },
    { key: "tableComment", title: "表描述", dataIndex: "tableComment", width: 220, ellipsis: true },
    { key: "rowCount", title: "数据量", dataIndex: "rowCount", width: 120, render: (value) => value ?? "-" },
    {
      key: "resourceCategory",
      title: "分类",
      dataIndex: "resourceCategory",
      width: 140,
      render: (value: string, record) => (
        <Select
          value={value || "business"}
          options={categoryOptions}
          disabled={updatingResourceIds.includes(record.id)}
          onChange={(nextValue) => {
            if (nextValue !== record.resourceCategory) {
              void updateResourceInline(record, { resourceCategory: nextValue });
            }
          }}
          style={{ width: "100%" }}
        />
      ),
    },
    { key: "systemName", title: "来源系统", dataIndex: "systemName", width: 160 },
    { key: "sourceName", title: "数据源", dataIndex: "sourceName", width: 160 },
    {
      key: "catalogName",
      title: "组织分类",
      dataIndex: "catalogName",
      width: 240,
      render: (_, record) => (
        <Typography.Text ellipsis title={catalogPathMap.get(record.catalogId) || record.catalogName || "-"}>
          {catalogPathMap.get(record.catalogId) || record.catalogName || "-"}
        </Typography.Text>
      ),
    },
    {
      key: "businessTags",
      title: "业务标签",
      dataIndex: "businessTags",
      width: 240,
      render: (tags: string[] | undefined, record) => (
        <Select
          mode="tags"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="输入或选择标签"
          options={businessTagOptions}
          value={tags || []}
          disabled={updatingResourceIds.includes(record.id)}
          maxTagCount="responsive"
          style={{ width: "100%" }}
          onChange={(nextTags) => {
            const normalizedTags = normalizeTagValues(nextTags);
            const currentTags = normalizeTagValues(record.businessTags || []);
            if (normalizedTags.join("|") !== currentTags.join("|")) {
              void updateResourceInline(record, { businessTags: normalizedTags });
            }
          }}
        />
      ),
    },
    { key: "columnCount", title: "字段数", dataIndex: "columnCount", width: 90 },
    {
      key: "status",
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string, record) => (
        <Select
          value={value || "active"}
          options={statusOptions}
          disabled={updatingResourceIds.includes(record.id)}
          onChange={(nextValue) => {
            if (nextValue !== record.status) {
              void updateResourceInline(record, { status: nextValue });
            }
          }}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 128,
      render: (_, record) => (
        <Space size={12} wrap={false}>
          <Button type="link" style={{ paddingInline: 0 }} onClick={() => void openResourceDetail(record)}>详情</Button>
          <Popconfirm title="确认删除该资源？" onConfirm={() => token && deleteDataMapResource(token, record.id).then(() => loadAll()).catch((error) => message.error(getErrorMessage(error)))}>
            <Button danger type="link" style={{ paddingInline: 0 }}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const resourceColumnOptions = resourceColumns
    .filter((column) => column.key && column.key !== "actions")
    .map((column) => ({ label: String(column.title), value: String(column.key) }));
  const resourceColumnLabelMap = new Map(resourceColumnOptions.map((item) => [String(item.value), String(item.label)]));
  const resourceColumnMap = new Map(resourceColumns
    .filter((column) => column.key && column.key !== "actions")
    .map((column) => [String(column.key), column]));
  const actionResourceColumn = resourceColumns.find((column) => column.key === "actions");
  const visibleResourceColumnKeys = resourceColumnSettings.filter((item) => item.visible).map((item) => item.key);
  const visibleResourceColumns = [
    ...visibleResourceColumnKeys
      .map((key) => resourceColumnMap.get(key))
      .filter((column): column is ColumnsType<DataMapResource>[number] => Boolean(column)),
    actionResourceColumn,
  ].filter((column): column is ColumnsType<DataMapResource>[number] => Boolean(column));
  const resourceTableScrollX = Math.max(
    900,
    visibleResourceColumns.reduce((sum, column) => sum + (typeof column.width === "number" ? column.width : 160), 0)
  );
  const selectedResources = useMemo(
    () => visibleResources.filter((item) => selectedResourceRowKeys.includes(item.id)),
    [selectedResourceRowKeys, visibleResources]
  );

  function getResourceExportValue(record: DataMapResource, columnKey: string) {
    if (columnKey === "resourceCategory") return categoryLabelMap[record.resourceCategory || ""] || record.resourceCategory || "";
    if (columnKey === "businessTags") return record.businessTags || [];
    const value = record[columnKey as keyof DataMapResource];
    return value ?? "";
  }

  function exportResources() {
    const exportRows = selectedResources.length > 0 ? selectedResources : visibleResources;
    if (exportRows.length === 0) {
      message.warning("暂无可导出的资源");
      return;
    }
    const exportColumnKeys = visibleResourceColumnKeys.length > 0 ? visibleResourceColumnKeys : [...DEFAULT_RESOURCE_COLUMN_KEYS];
    const header = exportColumnKeys.map((key) => resourceColumnLabelMap.get(key) || key);
    const csvRows = [
      header.map(formatCsvValue).join(","),
      ...exportRows.map((record) => exportColumnKeys
        .map((key) => formatCsvValue(getResourceExportValue(record, key)))
        .join(",")),
    ];
    const blob = new Blob([`\uFEFF${csvRows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `数据地图资源清单_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function confirmBatchDeleteResources() {
    if (!token || selectedResourceRowKeys.length === 0) return;
    modal.confirm({
      title: `确认删除选中的 ${selectedResourceRowKeys.length} 个资源？`,
      content: "删除后会同步刷新数据接入血缘关系，字段、画像和内容信息会随资源一并删除。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          const response = await deleteDataMapResources(token, selectedResourceRowKeys);
          message.success(`已删除 ${response.data.deletedCount} 个资源`);
          setSelectedResourceRowKeys([]);
          await loadAll();
        } catch (error) {
          message.error(`批量删除资源失败：${getErrorMessage(error)}`);
        }
      },
    });
  }

  function updateResourceColumnVisibility(columnKey: string, visible: boolean) {
    setResourceColumnSettings((current) => current.map((item) => (
      item.key === columnKey ? { ...item, visible } : item
    )));
  }

  function moveResourceColumnSetting(index: number, direction: -1 | 1) {
    setResourceColumnSettings((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const nextSettings = [...current];
      [nextSettings[index], nextSettings[targetIndex]] = [nextSettings[targetIndex], nextSettings[index]];
      return nextSettings;
    });
  }

  const resourceColumnSettingContent = (
    <div style={{ width: 420 }}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div>
          <Typography.Text strong>显示字段</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
            勾选需要展示的列，并通过上下按钮调整展示顺序
          </Typography.Paragraph>
        </div>
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          {resourceColumnSettings.map((item, index) => {
            const label = resourceColumnLabelMap.get(item.key) || item.key;
            return (
              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
                <Checkbox
                  checked={item.visible}
                  onChange={(event) => updateResourceColumnVisibility(item.key, event.target.checked)}
                  style={{ flex: "1 1 0", minWidth: 0 }}
                >
                  <Typography.Text ellipsis>{label}</Typography.Text>
                </Checkbox>
                <Space size={2}>
                  <Button
                    size="small"
                    type="text"
                    icon={<UpOutlined />}
                    disabled={index === 0}
                    onClick={() => moveResourceColumnSetting(index, -1)}
                  />
                  <Button
                    size="small"
                    type="text"
                    icon={<DownOutlined />}
                    disabled={index === resourceColumnSettings.length - 1}
                    onClick={() => moveResourceColumnSetting(index, 1)}
                  />
                </Space>
              </div>
            );
          })}
        </Space>
        <Divider style={{ margin: 0 }} />
        <Space size={8} wrap>
          <Button size="small" onClick={() => setResourceColumnSettings(buildResourceColumnSettings())}>恢复默认</Button>
          <Button size="small" onClick={() => setResourceColumnSettings((current) => current.map((item) => ({ ...item, visible: true })))}>显示全部</Button>
          <Typography.Text type="secondary">已选 {visibleResourceColumnKeys.length} 列</Typography.Text>
        </Space>
      </Space>
    </div>
  );

  function renderToolbarRight() {
    if (section === "departments") return <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDepartment}>新建部门</Button>;
    if (section === "systems") return <Button type="primary" icon={<PlusOutlined />} onClick={openCreateSystem}>新建业务系统</Button>;
    if (section === "sources") return <Button type="primary" icon={<PlusOutlined />} onClick={openCreateSource}>新建数据源</Button>;
    return (
      <>
        <Popover trigger="click" placement="bottomRight" content={resourceColumnSettingContent} overlayStyle={{ width: 452 }}>
          <Button icon={<SettingOutlined />}>
            字段配置
            {visibleResourceColumnKeys.length !== resourceColumnOptions.length ? ` (${visibleResourceColumnKeys.length})` : ""}
          </Button>
        </Popover>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => void openRegisterResource()}>注册资源</Button>
      </>
    );
  }

  return (
    <div className="app-page">
      {modalContextHolder}
      <PageToolbar
        className={section === "resources" ? "data-map-resource-toolbar" : undefined}
        left={(
          <>
            <Input.Search allowClear className="toolbar-search" placeholder="搜索关键字" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            {section === "resources" ? (
              <>
                <Select allowClear showSearch optionFilterProp="label" placeholder="部门" className="data-map-resource-filter" options={departmentFilterOptions} value={departmentFilter} onChange={handleDepartmentFilterChange} />
                <Select allowClear showSearch optionFilterProp="label" placeholder="业务系统" className="data-map-resource-filter" options={systemFilterOptions} value={systemFilter} onChange={handleSystemFilterChange} />
                <Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="业务标签" className="data-map-resource-filter" options={businessTagFilterOptions} value={businessTagFilter} onChange={(values) => setBusinessTagFilter(values.map(String))} maxTagCount="responsive" />
                <Select allowClear placeholder="资源分类" className="data-map-resource-filter" options={categoryFilterOptions} value={categoryFilter} onChange={setCategoryFilter} />
              </>
            ) : null}
          </>
        )}
        right={(
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadAll()} loading={loading}>刷新</Button>
            {renderToolbarRight()}
          </>
        )}
      />

      <div className="app-page-body">
        {section === "departments" ? (
          <DataTableCard<DataMapDepartment> title="部门管理" tableProps={{ rowKey: "id", loading, columns: departmentColumns, dataSource: departments, scroll: { x: 1280 } }} />
        ) : null}

        {section === "systems" ? (
          <DataTableCard<DataMapBusinessSystem> title="业务系统管理" tableProps={{ rowKey: "id", loading, columns: systemColumns, dataSource: systems, scroll: { x: 1400 } }} />
        ) : null}

        {section === "sources" ? (
          <DataTableCard<DataMapDataSource> title="数据地图数据源" tableProps={{ rowKey: "id", loading, columns: sourceColumns, dataSource: sources, scroll: { x: 1500 } }} />
        ) : null}

        {section === "resources" ? (
          <div className="workspace-page-body data-map-resource-workspace">
            <div className="workspace-side-dock">
              <Button
                className="workspace-side-dock__button data-map-resource-dock__button"
                icon={catalogPanelVisible ? <LeftOutlined /> : <RightOutlined />}
                title={catalogPanelVisible ? "隐藏组织分类" : "显示组织分类"}
                onClick={() => setCatalogPanelVisible((value) => !value)}
              />
            </div>
            <div
              className="workspace-layout workspace-layout--compact"
              style={{ gridTemplateColumns: showCatalogPanel ? `${catalogPanelWidth}px 10px minmax(0, 1fr)` : "minmax(0, 1fr)" }}
            >
              {showCatalogPanel ? (
                <aside className="workspace-sidebar data-map-resource-catalog-panel">
                  <section className="workspace-sidebar__section workspace-sidebar__section--compact">
                    <div className="workspace-sidebar__stack">
                      <div className="data-map-resource-catalog-panel__header">
                        <Typography.Title level={4} style={{ margin: 0 }}>
                          组织分类
                        </Typography.Title>
                        <Space size={8}>
                          {catalogFilter ? <Button size="small" onClick={() => handleCatalogFilterChange(undefined)}>清除</Button> : null}
                          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openCreateCatalog()}>新建</Button>
                        </Space>
                      </div>
                      {selectedCatalogPath ? (
                        <Card size="small" className="data-map-resource-catalog-summary">
                          <Space direction="vertical" size={4}>
                            <Typography.Text type="secondary">当前筛选</Typography.Text>
                            <Typography.Text strong>{selectedCatalogPath}</Typography.Text>
                          </Space>
                        </Card>
                      ) : null}
                      <div className="workspace-sidebar__scroll data-map-resource-catalog-scroll">
                        {catalogTree.length > 0 ? (
                          <Tree
                            blockNode
                            className="data-map-resource-catalog-tree"
                            selectedKeys={catalogFilter ? [catalogFilter] : []}
                            treeData={buildTreeData(catalogTree)}
                            onSelect={(keys) => handleCatalogFilterChange(keys[0] ? Number(keys[0]) : undefined)}
                            titleRender={(node) => (
                              <Dropdown
                                trigger={["contextMenu"]}
                                menu={{
                                  items: [
                                    { key: "edit", icon: <EditOutlined />, label: "编辑" },
                                    { key: "delete", icon: <DeleteOutlined />, label: "删除", danger: true },
                                  ],
                                  onClick: ({ key, domEvent }) => {
                                    domEvent.preventDefault();
                                    domEvent.stopPropagation();
                                    const catalog = catalogs.find((item) => item.id === Number(node.key));
                                    if (!catalog) return;
                                    if (key === "delete") {
                                      confirmDeleteCatalog(catalog);
                                    } else {
                                      openEditCatalog(catalog);
                                    }
                                  },
                                }}
                              >
                                <span className="data-map-resource-catalog-tree__title" title={String(node.title)}>
                                  {String(node.title)}
                                </span>
                              </Dropdown>
                            )}
                          />
                        ) : (
                          <Typography.Text type="secondary">暂无组织分类，请先新建 ODS/DWD 等分类。</Typography.Text>
                        )}
                      </div>
                    </div>
                  </section>
                </aside>
              ) : null}
              {showCatalogPanel ? (
                <div
                  className={`workspace-splitter${catalogPanelResizing ? " is-active" : ""}`}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="调整组织分类面板宽度"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    startCatalogPanelResize(event.clientX);
                  }}
                />
              ) : null}

              <DataTableCard<DataMapResource>
                title={(
                  <Space size={8} wrap>
                    <span>资源清单</span>
                    {selectedResourceRowKeys.length > 0 ? <Tag color="blue">已选 {selectedResourceRowKeys.length}</Tag> : null}
                    {selectedCatalogPath ? <Tag color="gold">组织分类：{selectedCatalogPath}</Tag> : null}
                  </Space>
                )}
                extra={(
                  <Space>
                    {selectedCatalogPath ? <Button type="link" onClick={() => handleCatalogFilterChange(undefined)}>清除分类</Button> : null}
                    <Button icon={<DownloadOutlined />} onClick={exportResources}>
                      {selectedResourceRowKeys.length > 0 ? "导出选中" : "导出当前"}
                    </Button>
                    <Button danger icon={<DeleteOutlined />} disabled={selectedResourceRowKeys.length === 0} onClick={confirmBatchDeleteResources}>批量删除</Button>
                  </Space>
                )}
                tableProps={{
                  rowKey: "id",
                  loading,
                  columns: visibleResourceColumns,
                  dataSource: visibleResources,
                  rowSelection: {
                    selectedRowKeys: selectedResourceRowKeys,
                    onChange: (keys) => setSelectedResourceRowKeys(keys.map((key) => Number(key))),
                  },
                  scroll: { x: resourceTableScrollX },
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Modal open={departmentModalOpen} title={editingDepartment ? "编辑部门" : "新建部门"} onCancel={() => setDepartmentModalOpen(false)} onOk={() => void submitDepartment()} confirmLoading={submitting} destroyOnHidden width={760}>
        <Form form={departmentForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="departmentName" label="部门名称" rules={[{ required: true, message: "请输入部门名称" }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="departmentCode" label="部门编码" rules={[{ required: true }, { pattern: DATASOURCE_CODE_PATTERN }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="departmentShortName" label="部门简称"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="parentId" label="上级部门"><Select allowClear options={departmentOptions.filter((item) => item.value !== editingDepartment?.id)} /></Form.Item></Col>
            <Col span={8}><Form.Item name="contactName" label="联系人"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="contactPhone" label="联系电话"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="contactEmail" label="邮箱"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="dataOwner" label="数据负责人"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="dataSteward" label="数据管理员"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={statusOptions} /></Form.Item></Col>
            <Col span={24}><Form.Item name="tagsText" label="标签"><Input placeholder="多个标签用逗号分隔" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="部门描述"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={systemModalOpen} title={editingSystem ? "编辑业务系统" : "新建业务系统"} onCancel={() => setSystemModalOpen(false)} onOk={() => void submitSystem()} confirmLoading={submitting} destroyOnHidden width={820}>
        <Form form={systemForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="departmentId" label="所属部门" rules={[{ required: true }]}><Select options={departmentOptions} /></Form.Item></Col>
            <Col span={12}><Form.Item name="systemName" label="系统名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="systemCode" label="系统编码" rules={[{ required: true }, { pattern: DATASOURCE_CODE_PATTERN }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="systemShortName" label="系统简称"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="systemType" label="系统类型"><Input placeholder="业务/支撑/外部" /></Form.Item></Col>
            <Col span={8}><Form.Item name="systemLevel" label="系统等级"><Input placeholder="核心/重要/一般" /></Form.Item></Col>
            <Col span={8}><Form.Item name="lifecycleStatus" label="生命周期"><Select options={lifecycleOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="onlineDate" label="上线时间"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="contactName" label="系统联系人"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="contactPhone" label="联系电话"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="vendorName" label="厂商"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="techOwner" label="技术负责人"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
            <Col span={24}><Form.Item name="tagsText" label="标签"><Input placeholder="多个标签用逗号分隔" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="系统描述"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={sourceModalOpen} title={editingSource ? "编辑数据源" : "新建数据源"} onCancel={() => setSourceModalOpen(false)} onOk={() => void submitSource()} confirmLoading={submitting} destroyOnHidden width={880} footer={[
        <Button key="import" icon={<ImportOutlined />} onClick={() => void openExternalSourceModal()}>加载其他模块配置</Button>,
        <Button key="test" onClick={() => void testSourceConnection()} loading={testing}>测试连接</Button>,
        <Button key="cancel" onClick={() => setSourceModalOpen(false)}>取消</Button>,
        <Button key="ok" type="primary" onClick={() => void submitSource()} loading={submitting}>保存</Button>,
      ]}>
        <Form form={sourceForm} layout="vertical" onValuesChange={(changed) => {
          if ("sourceType" in changed) {
            sourceForm.setFieldValue("port", getDefaultPort(changed.sourceType));
          }
        }}>
          <Form.Item name="sourceRefModule" hidden><Input /></Form.Item>
          <Form.Item name="sourceRefId" hidden><Input /></Form.Item>
          <Form.Item name="sourceRefCode" hidden><Input /></Form.Item>
          <FormSection title="基础信息" description="数据地图独立维护的数据源配置，引用其他模块时仅复制参数。">
            <Row gutter={16}>
              <Col span={12}><Form.Item name="businessSystemId" label="所属业务系统" rules={[{ required: true }]}><Select options={systemOptions} /></Form.Item></Col>
              <Col span={12}><Form.Item name="sourceName" label="数据源名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="sourceCode" label="数据源编码" rules={[{ required: true }, { pattern: DATASOURCE_CODE_PATTERN }]}><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="sourceType" label="数据源类型" rules={[{ required: true }]}><Select options={sourceTypeOptions} /></Form.Item></Col>
              <Col span={8}><Form.Item name="ownerName" label="负责人" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col span={8}><Form.Item name="environment" label="环境"><Select options={[{ value: "prod", label: "生产" }, { value: "test", label: "测试" }, { value: "dev", label: "开发" }]} /></Form.Item></Col>
              <Col span={8}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
              <Col span={24}><Form.Item name="purpose" label="用途说明"><Input.TextArea rows={2} /></Form.Item></Col>
            </Row>
          </FormSection>
          <FormSection title="连接信息" description="支持主机端口模式和 JDBC URL。">
            <Row gutter={16}>
              <Col span={12}><Form.Item name="host" label="主机地址" rules={jdbcMode ? [] : [{ required: true, message: "请输入主机地址" }]}><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="port" label="端口" rules={jdbcMode ? [] : [{ required: true, message: "请输入端口" }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="databaseName" label="数据库"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="schema" label="Schema"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="username" label="用户名"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="password" label="密码"><Input.Password /></Form.Item></Col>
              <Col span={24}><Form.Item name="jdbcUrl" label="JDBC URL" rules={jdbcMode ? [{ required: true, message: "请输入 JDBC URL" }] : []}><Input /></Form.Item></Col>
              <Col span={24}><Form.Item name="driverClassName" label="驱动类名"><Input /></Form.Item></Col>
            </Row>
          </FormSection>
        </Form>
      </Modal>

      <Modal open={externalModalOpen} title="加载其他模块数据源配置" onCancel={() => setExternalModalOpen(false)} footer={null} width={920}>
        <Space style={{ marginBottom: 12 }}>
          <Select style={{ width: 180 }} value={externalModule} options={externalModuleOptions} onChange={(value) => void refreshExternalSources(value)} />
          <Typography.Text type="secondary">选择后会复制连接参数到当前数据地图配置，不与来源模块共用记录。</Typography.Text>
        </Space>
        <Table<DataMapExternalDataSource>
          rowKey="refKey"
          size="small"
          dataSource={externalSources}
          columns={[
            { title: "模块", dataIndex: "module", width: 110 },
            { title: "名称", dataIndex: "sourceName", width: 180 },
            { title: "编码", dataIndex: "sourceCode", width: 160 },
            { title: "类型", dataIndex: "sourceType", width: 100 },
            { title: "负责人", dataIndex: "ownerName", width: 120 },
            { title: "操作", width: 100, render: (_, record) => <Button type="link" onClick={() => applyExternalSource(record)}>加载</Button> },
          ]}
          pagination={{ pageSize: 8 }}
        />
      </Modal>

      <Modal open={catalogModalOpen} title={editingCatalog ? "编辑组织分类" : "新建组织分类"} onCancel={() => setCatalogModalOpen(false)} onOk={() => void submitCatalog()} confirmLoading={submitting} destroyOnHidden width={760}>
        <Form form={catalogForm} layout="vertical" onValuesChange={(changed) => {
          if ("departmentId" in changed) {
            catalogForm.setFieldValue("businessSystemId", undefined);
          }
        }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="parentId" label="上级分类"><Select allowClear showSearch optionFilterProp="label" options={catalogPathOptions.filter((item) => item.value !== editingCatalog?.id)} /></Form.Item></Col>
            <Col span={12}><Form.Item name="catalogName" label="分类名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="catalogShortCode" label="分类简称" rules={[{ required: true }, { pattern: DATASOURCE_CODE_PATTERN }]}><Input placeholder="ODS / DWD" /></Form.Item></Col>
            <Col span={12}><Form.Item name="layerCode" label="分层编码"><Input placeholder="ods / dwd / ads" /></Form.Item></Col>
            <Col span={12}><Form.Item name="departmentId" label="绑定部门" rules={[{ required: true }]}><Select options={departmentOptions} /></Form.Item></Col>
            <Col span={12}><Form.Item name="businessSystemId" label="绑定业务系统"><Select allowClear options={catalogSystemOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="ownerName" label="负责人"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="分类描述"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={resourceModalOpen} title="注册数据资源" onCancel={() => setResourceModalOpen(false)} onOk={() => void submitResource()} confirmLoading={submitting} destroyOnHidden width={960}>
        <Form form={resourceForm} layout="vertical" onValuesChange={(changed) => {
          if ("catalogId" in changed) {
            resourceForm.setFieldsValue({ dataSourceId: undefined, tableNames: [] });
            setSourceTables([]);
            setRegisterTableKeyword("");
          }
          if ("dataSourceId" in changed) {
            void loadTablesForRegister(Number(changed.dataSourceId));
            resourceForm.setFieldValue("tableNames", []);
            setRegisterTableKeyword("");
          }
        }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="catalogId" label="注册组织分类" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={registerCatalogOptions} /></Form.Item></Col>
            <Col span={12}><Form.Item name="dataSourceId" label="数据源" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={registerSourceOptions} /></Form.Item></Col>
            <Col span={24}>
              <Form.Item name="tableNames" label="选择表范围" rules={[{ required: true, message: "请选择表" }]}>
                <RegisterTablePicker
                  tables={sourceTables}
                  disabledTableNames={registeredTableNameSet}
                  keyword={registerTableKeyword}
                  onKeywordChange={setRegisterTableKeyword}
                />
              </Form.Item>
            </Col>
            <Col span={8}><Form.Item name="resourceCategory" label="资源分类"><Select options={categoryOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="rowCountMode" label="数据量统计"><Select options={[{ value: "estimated", label: "估算" }, { value: "exact", label: "精确 COUNT" }]} /></Form.Item></Col>
            <Col span={8}>
              <Form.Item name="businessTags" label="业务标签">
                <Select
                  mode="tags"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="输入或选择业务标签"
                  options={businessTagOptions}
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

    </div>
  );
}
