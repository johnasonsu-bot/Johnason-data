import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from "antd";
import type { TabsProps } from "antd";
import {
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  WarningOutlined
} from "@ant-design/icons";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createManagedService,
  createSystemUser,
  deleteManagedService,
  deleteSystemUser,
  fetchDatabaseArchitecture,
  fetchManagedServices,
  fetchSystemResources,
  fetchSystemUsers,
  operateManagedService,
  restartWebStack,
  runKafkaDemoPump,
  startDefaultServices,
  updateManagedService,
  updateSystemUser,
  type ManagedServicePayload,
  type SystemUserPayload
} from "../../services/systemManagement";
import type {
  ManagedProcessResource,
  ManagedServiceRecord,
  MetaDatabaseArchitecture,
  SystemResourceHistoryPeriod,
  SystemResourceHistoryPoint,
  SystemResourceSnapshot,
  SystemUserRecord
} from "../../types/api";
import "./SystemServiceManagementPage.css";

const serviceCategoryOptions = [
  { value: "application", label: "应用" },
  { value: "database", label: "数据库" },
  { value: "platform", label: "平台组件" },
  { value: "custom", label: "自定义" }
] as const;

const serviceTypeOptions = [
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "hive", label: "Hive" },
  { value: "kafka", label: "Kafka" },
  { value: "custom", label: "Custom" }
] as const;

const manageModeOptions = [
  { value: "process", label: "本地进程" },
  { value: "docker", label: "Docker 容器" },
  { value: "docker_compose", label: "Docker Compose" },
  { value: "command", label: "自定义命令" }
] as const;

const roleOptions = [
  { value: "admin", label: "管理员" },
  { value: "operator", label: "运维" },
  { value: "viewer", label: "只读" }
] as const;

const statusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" }
] as const;

const resourcePeriodOptions = [
  { label: "15 分钟", value: "15m" },
  { label: "1 小时", value: "1h" },
  { label: "6 小时", value: "6h" },
  { label: "24 小时", value: "24h" }
] as const;

const defaultServiceFormValues: Partial<ManagedServicePayload> = {
  serviceCategory: "custom",
  serviceType: "custom",
  manageMode: "command",
  host: "127.0.0.1",
  autoStart: false,
  status: "active",
  notes: ""
};

const PAGE_CACHE_KEY = "system-service-management-cache-v2";
const DEFAULT_TAB = "overview";

type PageCache = {
  services?: ManagedServiceRecord[];
  users?: SystemUserRecord[];
  architecture?: MetaDatabaseArchitecture | null;
  resourcesByPeriod?: Partial<Record<SystemResourceHistoryPeriod, SystemResourceSnapshot>>;
  activeTab?: string;
};

let pageCache: PageCache = readPageCache();

function readPageCache(): PageCache {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(PAGE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PageCache) : {};
  } catch {
    return {};
  }
}

function writePageCache(nextCache: PageCache) {
  pageCache = nextCache;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(nextCache));
  } catch {
  }
}

function updatePageCache(updater: (draft: PageCache) => PageCache) {
  writePageCache(updater(pageCache));
}

function formatLocalDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatBytes(value: number) {
  if (!value) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days} 天 ${hours} 小时 ${minutes} 分钟`;
}

function getServiceTypeLabel(value: ManagedServiceRecord["serviceType"]) {
  return serviceTypeOptions.find((item) => item.value === value)?.label || value;
}

function getServiceCategoryLabel(value: ManagedServiceRecord["serviceCategory"]) {
  return serviceCategoryOptions.find((item) => item.value === value)?.label || value;
}

function getManageModeLabel(value: ManagedServiceRecord["manageMode"]) {
  return manageModeOptions.find((item) => item.value === value)?.label || value;
}

function getRoleLabel(value: SystemUserRecord["roleCode"]) {
  return roleOptions.find((item) => item.value === value)?.label || value;
}

function getStatusLabel(value: SystemUserRecord["status"] | ManagedServiceRecord["status"]) {
  return statusOptions.find((item) => item.value === value)?.label || value;
}

function getLastItem<T>(items?: T[] | null) {
  if (!items?.length) {
    return null;
  }

  return items[items.length - 1] || null;
}

function getRuntimeTone(runtime?: ManagedServiceRecord["runtime"]) {
  if (runtime?.state === "running") {
    return { tagColor: "green", className: "is-running", text: "运行正常" };
  }

  if (runtime?.state === "degraded") {
    return { tagColor: "orange", className: "is-degraded", text: "状态异常" };
  }

  return { tagColor: "default", className: "is-stopped", text: "已停止" };
}

function getRuntimeDescription(record: ManagedServiceRecord) {
  if (record.runtime?.state === "degraded") {
    if (record.runtime.containerDetails?.length) {
      return record.runtime.containerDetails.map((item) => `${item.name}: ${item.state}`).join(" | ");
    }

    if (record.runtime.containerStatus) {
      return record.runtime.containerStatus;
    }

    if (record.runtime.healthStatus) {
      return record.runtime.healthStatus;
    }

    if (record.runtime.ready === false) {
      return "健康检查未通过";
    }

    return "服务入口不可用";
  }

  if (record.runtime?.pid) {
    return `PID ${record.runtime.pid}${record.runtime.processName ? ` · ${record.runtime.processName}` : ""}`;
  }

  return record.runtime?.containerStatus || record.runtime?.healthStatus || "暂无活跃进程";
}

function normalizeServicePayload(values: Record<string, unknown>): ManagedServicePayload | null {
  let config = {};

  if (values.configText) {
    try {
      config = JSON.parse(String(values.configText));
    } catch {
      message.error("高级配置必须是合法的 JSON");
      return null;
    }
  }

  return {
    serviceKey: String(values.serviceKey || ""),
    serviceName: String(values.serviceName || ""),
    serviceCategory: values.serviceCategory as ManagedServicePayload["serviceCategory"],
    serviceType: values.serviceType as ManagedServicePayload["serviceType"],
    manageMode: values.manageMode as ManagedServicePayload["manageMode"],
    host: values.host ? String(values.host) : undefined,
    port: typeof values.port === "number" ? values.port : null,
    autoStart: Boolean(values.autoStart),
    status: values.status as ManagedServicePayload["status"],
    notes: values.notes ? String(values.notes) : undefined,
    config
  };
}

function buildManagedProcessRows(services: ManagedServiceRecord[]): ManagedProcessResource[] {
  return services
    .filter((item) => item.runtime?.pid)
    .map((item) => ({
      serviceKey: item.serviceKey,
      serviceName: item.serviceName,
      pid: item.runtime?.pid || 0,
      port: item.runtime?.port || null,
      processName: item.runtime?.processName || null
    }));
}

function getPeriodLabel(period: SystemResourceHistoryPeriod) {
  return resourcePeriodOptions.find((item) => item.value === period)?.label || period;
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

type TrendMetricKey = "cpuUsage" | "memoryUsage" | "diskMaxUsage";

type TrendChartCardProps = {
  title: string;
  value: number;
  subtitle: string;
  history: SystemResourceHistoryPoint[];
  metricKey: TrendMetricKey;
  color: string;
};

function TrendChartCard(props: TrendChartCardProps) {
  const { title, value, subtitle, history, metricKey, color } = props;
  const gradientId = useId().replace(/:/g, "");
  const width = 320;
  const height = 124;
  const samples = history.length
    ? history
    : [{ timestamp: new Date().toISOString(), cpuUsage: 0, memoryUsage: 0, usedMemory: 0, totalMemory: 0, diskMaxUsage: 0 }];
  const plotted = samples.map((item, index) => {
    const x = samples.length === 1 ? width / 2 : (index / (samples.length - 1)) * width;
    const currentValue = Number(item[metricKey] || 0);
    const y = height - (Math.max(0, Math.min(currentValue, 100)) / 100) * height;
    return { x, y, value: currentValue };
  });
  const linePath = plotted.map((item, index) => `${index === 0 ? "M" : "L"} ${item.x.toFixed(2)} ${item.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${plotted[plotted.length - 1]?.x.toFixed(2) || width} ${height} L ${plotted[0]?.x.toFixed(2) || 0} ${height} Z`;
  const peak = history.length ? Math.max(...history.map((item) => Number(item[metricKey] || 0))) : value;
  const average = history.length ? history.reduce((sum, item) => sum + Number(item[metricKey] || 0), 0) / history.length : value;

  return (
    <Card bordered={false} className="system-panel trend-panel">
      <div className="trend-panel__header">
        <div>
          <Typography.Text className="trend-panel__label">{title}</Typography.Text>
          <div className="trend-panel__value">{formatPercent(value)}</div>
        </div>
        <div className="trend-panel__meta">
          <span>{subtitle}</span>
          <span>峰值 {formatPercent(peak)}</span>
          <span>均值 {formatPercent(average)}</span>
        </div>
      </div>
      <div className="trend-chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`gradient-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.34" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#gradient-${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {plotted.length ? <circle cx={plotted[plotted.length - 1]?.x} cy={plotted[plotted.length - 1]?.y} r="4" fill={color} stroke="#fff" strokeWidth="2" /> : null}
        </svg>
      </div>
    </Card>
  );
}

type SummaryMetricCardProps = {
  title: string;
  value: string | number;
  hint: string;
  accent: "teal" | "amber" | "blue" | "rose";
  icon: React.ReactNode;
};

function SummaryMetricCard(props: SummaryMetricCardProps) {
  return (
    <Card bordered={false} className={`system-panel summary-metric-card accent-${props.accent}`}>
      <div className="summary-metric-card__icon">{props.icon}</div>
      <div className="summary-metric-card__content">
        <Typography.Text className="summary-metric-card__title">{props.title}</Typography.Text>
        <div className="summary-metric-card__value">{props.value}</div>
        <Typography.Text type="secondary">{props.hint}</Typography.Text>
      </div>
    </Card>
  );
}

type LoadOptions = {
  silent?: boolean;
};

export function SystemServiceManagementPage() {
  const { token } = useAuth();
  const [services, setServices] = useState<ManagedServiceRecord[]>(() => pageCache.services || []);
  const [users, setUsers] = useState<SystemUserRecord[]>(() => pageCache.users || []);
  const [architecture, setArchitecture] = useState<MetaDatabaseArchitecture | null>(() => pageCache.architecture || null);
  const [resourcesByPeriod, setResourcesByPeriod] = useState<Partial<Record<SystemResourceHistoryPeriod, SystemResourceSnapshot>>>(
    () => pageCache.resourcesByPeriod || {}
  );
  const [activeTab, setActiveTab] = useState<string>(() => pageCache.activeTab || DEFAULT_TAB);
  const [resourcePeriod, setResourcePeriod] = useState<SystemResourceHistoryPeriod>("1h");
  const [servicesLoading, setServicesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [architectureLoading, setArchitectureLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [kafkaDemoResult, setKafkaDemoResult] = useState<{ topic: string; messageCount: number; mysqlCount: number; hiveCount: number } | null>(null);
  const [serviceActionKey, setServiceActionKey] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<ManagedServiceRecord | null>(null);
  const [editingUser, setEditingUser] = useState<SystemUserRecord | null>(null);
  const [serviceForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const serviceRequestRef = useRef<Promise<void> | null>(null);
  const userRequestRef = useRef<Promise<void> | null>(null);
  const architectureRequestRef = useRef<Promise<void> | null>(null);
  const resourceRequestRef = useRef<Partial<Record<SystemResourceHistoryPeriod, Promise<void>>>>({});

  const resources = resourcesByPeriod[resourcePeriod] || null;
  const managedProcesses = useMemo(() => buildManagedProcessRows(services), [services]);
  const visibleServices = useMemo(() => services.filter((item) => !["kafka", "hive"].includes(String(item.serviceType || "").toLowerCase())), [services]);
  const runningCount = useMemo(() => visibleServices.filter((item) => item.runtime?.state === "running").length, [visibleServices]);
  const degradedCount = useMemo(() => visibleServices.filter((item) => item.runtime?.state === "degraded").length, [visibleServices]);
  const databaseCount = useMemo(() => visibleServices.filter((item) => item.serviceCategory === "database").length, [visibleServices]);
  const autoStartCount = useMemo(() => visibleServices.filter((item) => item.autoStart).length, [visibleServices]);
  const coreServices = useMemo(() => {
    const preferred = visibleServices.filter((item) => item.isCore && ["backend", "frontend", "mysql", "postgresql"].includes(String(item.serviceType || "").toLowerCase()));
    return (preferred.length ? preferred : visibleServices.filter((item) => item.isCore)).slice(0, 6);
  }, [visibleServices]);
  const latestResourceSample = getLastItem(resources?.history);

  async function loadServices(options: LoadOptions = {}) {
    if (!token) {
      return;
    }

    if (serviceRequestRef.current) {
      return serviceRequestRef.current;
    }

    const request = (async () => {
      const shouldShowLoading = !options.silent || services.length === 0;

      try {
        if (shouldShowLoading) {
          setServicesLoading(true);
        }

        const response = await fetchManagedServices(token);
        setServices(response.data);
        updatePageCache((draft) => ({
          ...draft,
          services: response.data
        }));
      } catch (error: any) {
        if (!options.silent) {
          message.error(`加载服务列表失败: ${error.message || "未知错误"}`);
        }
      } finally {
        if (shouldShowLoading) {
          setServicesLoading(false);
        }
        serviceRequestRef.current = null;
      }
    })();

    serviceRequestRef.current = request;
    return request;
  }

  async function loadUsers(options: LoadOptions = {}) {
    if (!token) {
      return;
    }

    if (userRequestRef.current) {
      return userRequestRef.current;
    }

    const request = (async () => {
      const shouldShowLoading = !options.silent || users.length === 0;

      try {
        if (shouldShowLoading) {
          setUsersLoading(true);
        }

        const response = await fetchSystemUsers(token);
        setUsers(response.data);
        updatePageCache((draft) => ({
          ...draft,
          users: response.data
        }));
      } catch (error: any) {
        if (!options.silent) {
          message.error(`加载系统用户失败: ${error.message || "未知错误"}`);
        }
      } finally {
        if (shouldShowLoading) {
          setUsersLoading(false);
        }
        userRequestRef.current = null;
      }
    })();

    userRequestRef.current = request;
    return request;
  }

  async function loadArchitecture(options: LoadOptions = {}) {
    if (!token) {
      return;
    }

    if (architectureRequestRef.current) {
      return architectureRequestRef.current;
    }

    const request = (async () => {
      const shouldShowLoading = !options.silent || !architecture;

      try {
        if (shouldShowLoading) {
          setArchitectureLoading(true);
        }

        const response = await fetchDatabaseArchitecture(token);
        setArchitecture(response.data);
        updatePageCache((draft) => ({
          ...draft,
          architecture: response.data
        }));
      } catch (error: any) {
        if (!options.silent) {
          message.error(`加载数据库架构失败: ${error.message || "未知错误"}`);
        }
      } finally {
        if (shouldShowLoading) {
          setArchitectureLoading(false);
        }
        architectureRequestRef.current = null;
      }
    })();

    architectureRequestRef.current = request;
    return request;
  }

  async function loadResources(period = resourcePeriod, options: LoadOptions = {}) {
    if (!token) {
      return;
    }

    const currentRequest = resourceRequestRef.current[period];
    if (currentRequest) {
      return currentRequest;
    }

    const request = (async () => {
      const hasCachedSnapshot = Boolean(resourcesByPeriod[period] || pageCache.resourcesByPeriod?.[period]);
      const shouldShowLoading = !options.silent || !hasCachedSnapshot;

      try {
        if (shouldShowLoading) {
          setResourcesLoading(true);
        }

        const response = await fetchSystemResources(token, period);
        const nextSnapshot = {
          ...response.data,
          managedProcesses
        };

        setResourcesByPeriod((current) => ({
          ...current,
          [period]: nextSnapshot
        }));
        updatePageCache((draft) => ({
          ...draft,
          resourcesByPeriod: {
            ...(draft.resourcesByPeriod || {}),
            [period]: nextSnapshot
          }
        }));
      } catch (error: any) {
        if (!options.silent) {
          message.error(`加载系统资源失败: ${error.message || "未知错误"}`);
        }
      } finally {
        if (shouldShowLoading) {
          setResourcesLoading(false);
        }
        delete resourceRequestRef.current[period];
      }
    })();

    resourceRequestRef.current[period] = request;
    return request;
  }

  useEffect(() => {
    if (!services.length) {
      setServicesLoading(true);
    }
    if (!resourcesByPeriod[resourcePeriod]) {
      setResourcesLoading(true);
    }

    void loadServices({ silent: Boolean(pageCache.services?.length) });
    void loadResources(resourcePeriod, { silent: Boolean(pageCache.resourcesByPeriod?.[resourcePeriod]) });

    if (activeTab === "users" && !pageCache.users?.length) {
      void loadUsers();
    }

    if (activeTab === "architecture" && !pageCache.architecture) {
      void loadArchitecture();
    }
  }, [token]);

  useEffect(() => {
    setResourcesByPeriod((current) => {
      const snapshots = Object.entries(current) as Array<[SystemResourceHistoryPeriod, SystemResourceSnapshot | undefined]>;
      if (!snapshots.some((entry) => entry[1])) {
        return current;
      }

      const nextState = snapshots.reduce<Partial<Record<SystemResourceHistoryPeriod, SystemResourceSnapshot>>>((acc, [key, snapshot]) => {
        if (snapshot) {
          acc[key] = {
            ...snapshot,
            managedProcesses
          };
        }
        return acc;
      }, {});

      updatePageCache((draft) => ({
        ...draft,
        resourcesByPeriod: nextState
      }));

      return nextState;
    });
  }, [managedProcesses]);

  useEffect(() => {
    if (activeTab === "users") {
      setActiveTab("overview");
    }
  }, [activeTab]);

  useEffect(() => {
    updatePageCache((draft) => ({
      ...draft,
      activeTab
    }));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "users" && !users.length) {
      void loadUsers();
    }

    if (activeTab === "architecture" && !architecture) {
      void loadArchitecture();
    }

    if ((activeTab === "overview" || activeTab === "resources") && !resourcesByPeriod[resourcePeriod]) {
      void loadResources(resourcePeriod);
    }
  }, [activeTab, resourcePeriod, users.length, architecture, resourcesByPeriod, token]);

  useEffect(() => {
    if (!token || (activeTab !== "overview" && activeTab !== "services")) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        void loadServices({ silent: true });
      }
    }, 20000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeTab, token]);

  useEffect(() => {
    if (!token || (activeTab !== "overview" && activeTab !== "resources")) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        void loadResources(resourcePeriod, { silent: true });
      }
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeTab, resourcePeriod, token, managedProcesses]);

  function openCreateServiceModal() {
    setEditingService(null);
    serviceForm.resetFields();
    serviceForm.setFieldsValue({
      ...defaultServiceFormValues,
      configText: "{}"
    });
    setServiceModalOpen(true);
  }

  function openEditServiceModal(record: ManagedServiceRecord) {
    setEditingService(record);
    serviceForm.setFieldsValue({
      serviceKey: record.serviceKey,
      serviceName: record.serviceName,
      serviceCategory: record.serviceCategory,
      serviceType: record.serviceType,
      manageMode: record.manageMode,
      host: record.host || undefined,
      port: record.port ?? undefined,
      autoStart: record.autoStart,
      status: record.status,
      notes: record.notes || "",
      configText: JSON.stringify(record.config || {}, null, 2)
    });
    setServiceModalOpen(true);
  }

  function closeServiceModal() {
    setServiceModalOpen(false);
    setEditingService(null);
    serviceForm.resetFields();
  }

  function openCreateUserModal() {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({
      roleCode: "operator",
      status: "active"
    });
    setUserModalOpen(true);
  }

  function openEditUserModal(record: SystemUserRecord) {
    setEditingUser(record);
    userForm.setFieldsValue({
      username: record.username,
      displayName: record.displayName,
      roleCode: record.roleCode,
      status: record.status,
      password: ""
    });
    setUserModalOpen(true);
  }

  function closeUserModal() {
    setUserModalOpen(false);
    setEditingUser(null);
    userForm.resetFields();
  }

  async function handleServiceSubmit() {
    if (!token) {
      return;
    }

    try {
      const values = await serviceForm.validateFields();
      const payload = normalizeServicePayload(values);
      if (!payload) {
        return;
      }

      setServiceSubmitting(true);

      if (editingService) {
        await updateManagedService(token, editingService.id, payload);
        message.success("服务配置已更新");
      } else {
        await createManagedService(token, payload);
        message.success("服务配置已创建");
      }

      closeServiceModal();
      await loadServices();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存服务失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setServiceSubmitting(false);
    }
  }

  async function handleUserSubmit() {
    if (!token) {
      return;
    }

    try {
      const values = await userForm.validateFields();
      const payload: SystemUserPayload = {
        username: values.username,
        displayName: values.displayName,
        roleCode: values.roleCode,
        status: values.status,
        password: values.password || undefined
      };

      setUserSubmitting(true);

      if (editingUser) {
        await updateSystemUser(token, editingUser.id, payload);
        message.success("系统用户已更新");
      } else {
        await createSystemUser(token, payload);
        message.success("系统用户已创建");
      }

      closeUserModal();
      await loadUsers();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存用户失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setUserSubmitting(false);
    }
  }

  async function handleDeleteService(record: ManagedServiceRecord) {
    if (!token) {
      return;
    }

    try {
      await deleteManagedService(token, record.id);
      message.success("服务已删除");
      await loadServices();
    } catch (error: any) {
      message.error(`删除服务失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleDeleteUser(record: SystemUserRecord) {
    if (!token) {
      return;
    }

    try {
      await deleteSystemUser(token, record.id);
      message.success("用户已删除");
      await loadUsers();
    } catch (error: any) {
      message.error(`删除用户失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleServiceAction(record: ManagedServiceRecord, action: "start" | "stop" | "restart") {
    if (!token) {
      return;
    }

    try {
      setServiceActionKey(`${record.id}-${action}`);
      const response = await operateManagedService(token, record.id, action);
      message.success(response.data.message || `${record.serviceName} ${action} 指令已提交`);
      await loadServices({ silent: true });
      await loadResources(resourcePeriod, { silent: true });
    } catch (error: any) {
      message.error(`${record.serviceName} ${action} 失败: ${error.message || "未知错误"}`);
    } finally {
      setServiceActionKey(null);
    }
  }

  async function handleRestartWebStack() {
    if (!token) {
      return;
    }

    try {
      setBulkActionLoading(true);
      const response = await restartWebStack(token);
      message.success(response.data.message || "Docker 服务栈重启指令已提交");
      await loadServices({ silent: true });
    } catch (error: any) {
      message.error(`Docker 服务栈重启失败: ${error.message || "未知错误"}`);
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleStartDefaults() {
    if (!token) {
      return;
    }

    try {
      setBulkActionLoading(true);
      const response = await startDefaultServices(token);
      const names = response.data.startedServiceKeys.join("、");
      message.success(names ? `已启动默认服务: ${names}` : "没有可启动的默认服务");
      await loadServices({ silent: true });
      await loadResources(resourcePeriod, { silent: true });
    } catch (error: any) {
      message.error(`启动默认服务失败: ${error.message || "未知错误"}`);
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleRunKafkaDemoPump() {
    if (!token) {
      return;
    }

    try {
      setBulkActionLoading(true);
      const response = await runKafkaDemoPump(token);
      setKafkaDemoResult(response.data);
      message.success(
        `Kafka 示例已执行：topic ${response.data.topic}，MySQL ${response.data.mysqlCount} 条，Hive ${response.data.hiveCount} 条`
      );
      await loadServices({ silent: true });
    } catch (error: any) {
      message.error(`运行 Kafka 示例失败: ${error.message || "未知错误"}`);
    } finally {
      setBulkActionLoading(false);
    }
  }

  const serviceColumns = [
    {
      title: "服务",
      dataIndex: "serviceName",
      key: "serviceName",
      width: 260,
      render: (_: unknown, record: ManagedServiceRecord) => (
        <div className="service-name-cell">
          <Space wrap size={[6, 6]}>
            <Typography.Text strong>{record.serviceName}</Typography.Text>
            {record.isCore ? <Tag color="gold">核心</Tag> : null}
            <Tag color={record.status === "active" ? "green" : "default"}>{getStatusLabel(record.status)}</Tag>
          </Space>
          <Typography.Text type="secondary" className="cell-subtext">
            {record.serviceKey}
            {record.notes ? ` · ${record.notes}` : ""}
          </Typography.Text>
        </div>
      )
    },
    {
      title: "类型",
      key: "type",
      width: 220,
      render: (_: unknown, record: ManagedServiceRecord) => (
        <Space wrap size={[6, 6]}>
          <Tag>{getServiceTypeLabel(record.serviceType)}</Tag>
          <Tag color="blue">{getServiceCategoryLabel(record.serviceCategory)}</Tag>
          <Tag color="purple">{getManageModeLabel(record.manageMode)}</Tag>
        </Space>
      )
    },
    {
      title: "地址",
      key: "address",
      width: 160,
      render: (_: unknown, record: ManagedServiceRecord) => (
        <Typography.Text>{record.host || "-"}{record.port ? `:${record.port}` : ""}</Typography.Text>
      )
    },
    {
      title: "默认启动",
      dataIndex: "autoStart",
      key: "autoStart",
      width: 110,
      render: (value: boolean) => <Tag color={value ? "green" : "default"}>{value ? "是" : "否"}</Tag>
    },
    {
      title: "运行状态",
      key: "runtime",
      width: 280,
      render: (_: unknown, record: ManagedServiceRecord) => {
        const tone = getRuntimeTone(record.runtime);
        return (
          <div className="runtime-cell">
            <Tag color={tone.tagColor}>{tone.text}</Tag>
            <Typography.Text type="secondary" className="cell-subtext">
              {getRuntimeDescription(record)}
            </Typography.Text>
          </div>
        );
      }
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (value: string) => formatLocalDateTime(value)
    },
    {
      title: "操作",
      key: "actions",
      width: 260,
      render: (_: unknown, record: ManagedServiceRecord) => (
        <Space size={[0, 0]} wrap>
          <Button type="link" loading={serviceActionKey === `${record.id}-start`} onClick={() => void handleServiceAction(record, "start")}>
            启动
          </Button>
          <Button type="link" loading={serviceActionKey === `${record.id}-stop`} onClick={() => void handleServiceAction(record, "stop")}>
            停止
          </Button>
          <Button type="link" loading={serviceActionKey === `${record.id}-restart`} onClick={() => void handleServiceAction(record, "restart")}>
            重启
          </Button>
          <Button type="link" onClick={() => openEditServiceModal(record)}>
            编辑
          </Button>
          {!record.isCore ? (
            <Popconfirm title="确认删除该服务配置？" onConfirm={() => void handleDeleteService(record)}>
              <Button type="link" danger>
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      )
    }
  ];

  const userColumns = [
    { title: "用户名", dataIndex: "username", key: "username", width: 180 },
    { title: "显示名称", dataIndex: "displayName", key: "displayName", width: 180 },
    {
      title: "角色",
      dataIndex: "roleCode",
      key: "roleCode",
      width: 120,
      render: (value: SystemUserRecord["roleCode"]) => getRoleLabel(value)
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (value: SystemUserRecord["status"]) => <Tag color={value === "active" ? "green" : "default"}>{getStatusLabel(value)}</Tag>
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (value: string) => formatLocalDateTime(value)
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_: unknown, record: SystemUserRecord) => (
        <Space>
          <Button type="link" onClick={() => openEditUserModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该系统用户？" onConfirm={() => void handleDeleteUser(record)}>
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const overviewTab = (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card bordered={false} className="system-panel overview-fleet-card" loading={servicesLoading && services.length === 0}>
            <div className="panel-heading">
              <div>
                <Typography.Title level={4}>核心服务健康概览</Typography.Title>
                <Typography.Text type="secondary">状态按 20 秒轮询刷新，进入页面优先使用会话缓存回显。</Typography.Text>
              </div>
              <Button icon={<ReloadOutlined />} onClick={() => void loadServices()} loading={servicesLoading}>
                刷新服务
              </Button>
            </div>
            {coreServices.length ? (
              <div className="service-spotlight-grid">
                {coreServices.map((service) => {
                  const tone = getRuntimeTone(service.runtime);
                  return (
                    <div key={service.id} className={`service-spotlight-card ${tone.className}`}>
                      <div className="service-spotlight-card__top">
                        <div>
                          <Typography.Text strong>{service.serviceName}</Typography.Text>
                          <Typography.Text type="secondary" className="cell-subtext">
                            {service.serviceKey}
                          </Typography.Text>
                        </div>
                        <span className={`status-dot ${tone.className}`} />
                      </div>
                      <Space wrap size={[6, 6]}>
                        <Tag>{getServiceTypeLabel(service.serviceType)}</Tag>
                        <Tag color="blue">{getServiceCategoryLabel(service.serviceCategory)}</Tag>
                        <Tag color={tone.tagColor}>{tone.text}</Tag>
                      </Space>
                      <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                        {getRuntimeDescription(service)}
                      </Typography.Paragraph>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty description="暂无服务数据" />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card bordered={false} className="system-panel quick-actions-card">
            <div className="panel-heading">
              <div>
                <Typography.Title level={4}>操作中心</Typography.Title>
                <Typography.Text type="secondary">避免每次全量刷新，常用动作只触发局部更新。</Typography.Text>
              </div>
            </div>
            <div className="quick-actions-grid">
              <Button type="primary" icon={<ThunderboltOutlined />} loading={bulkActionLoading} onClick={() => void handleRestartWebStack()}>
                重启 Docker 服务栈
              </Button>
              <Button icon={<RocketOutlined />} loading={bulkActionLoading} onClick={() => void handleStartDefaults()}>
                启动默认服务
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void loadResources(resourcePeriod)} loading={resourcesLoading}>
                刷新资源监控
              </Button>
              <Button icon={<DeploymentUnitOutlined />} onClick={openCreateServiceModal}>
                新增服务配置
              </Button>
            </div>
            <Alert
              type="info"
              showIcon
              message="当前页面直接管理本机服务"
              description="资源监控已改为后台采样缓存 + 前端按周期查询，进入页面不再顺带加载用户和数据库架构，明显减少首次等待。"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <TrendChartCard
            title="CPU 趋势"
            value={resources?.cpuUsage || 0}
            subtitle={`最近 ${getPeriodLabel(resourcePeriod)}`}
            history={resources?.history || []}
            metricKey="cpuUsage"
            color="#0f766e"
          />
        </Col>
        <Col xs={24} lg={8}>
          <TrendChartCard
            title="内存趋势"
            value={resources?.memoryUsage || 0}
            subtitle={`已用 ${formatBytes(resources?.usedMemory || 0)} / ${formatBytes(resources?.totalMemory || 0)}`}
            history={resources?.history || []}
            metricKey="memoryUsage"
            color="#2563eb"
          />
        </Col>
        <Col xs={24} lg={8}>
          <TrendChartCard
            title="磁盘压力"
            value={latestResourceSample?.diskMaxUsage || 0}
            subtitle="取所有磁盘中的最高使用率"
            history={resources?.history || []}
            metricKey="diskMaxUsage"
            color="#ea580c"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card bordered={false} className="system-panel" loading={resourcesLoading && !resources}>
            <div className="panel-heading">
              <div>
                <Typography.Title level={4}>运行环境快照</Typography.Title>
                <Typography.Text type="secondary">
                  最近采样 {formatLocalDateTime(resources?.sampledAt)}，采样频率约 {resources?.sampleIntervalSeconds || 15} 秒一次。
                </Typography.Text>
              </div>
              <Segmented options={[...resourcePeriodOptions]} value={resourcePeriod} onChange={(value) => setResourcePeriod(value as SystemResourceHistoryPeriod)} />
            </div>
            <div className="snapshot-grid">
              <div className="snapshot-item">
                <span className="snapshot-item__label">主机</span>
                <strong>{resources?.hostname || "-"}</strong>
              </div>
              <div className="snapshot-item">
                <span className="snapshot-item__label">平台</span>
                <strong>{resources?.platform || "-"} / {resources?.arch || "-"}</strong>
              </div>
              <div className="snapshot-item">
                <span className="snapshot-item__label">运行时长</span>
                <strong>{resources ? formatUptime(resources.uptimeSeconds) : "-"}</strong>
              </div>
              <div className="snapshot-item">
                <span className="snapshot-item__label">托管进程</span>
                <strong>{managedProcesses.length}</strong>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card bordered={false} className="system-panel" loading={servicesLoading && services.length === 0}>
            <div className="panel-heading">
              <div>
                <Typography.Title level={4}>服务状态分布</Typography.Title>
                <Typography.Text type="secondary">核心服务动作后只刷新服务和资源，不再触发整页重载。</Typography.Text>
              </div>
            </div>
            <div className="service-distribution">
              <div className="service-distribution__row">
                <span>运行中</span>
                <strong>{runningCount}</strong>
              </div>
              <Progress percent={visibleServices.length ? Math.round((runningCount / visibleServices.length) * 100) : 0} strokeColor="#0f766e" showInfo={false} />
              <div className="service-distribution__row">
                <span>异常</span>
                <strong>{degradedCount}</strong>
              </div>
              <Progress percent={visibleServices.length ? Math.round((degradedCount / visibleServices.length) * 100) : 0} strokeColor="#ea580c" showInfo={false} />
              <div className="service-distribution__row">
                <span>已停止</span>
                <strong>{Math.max(visibleServices.length - runningCount - degradedCount, 0)}</strong>
              </div>
              <Progress
                percent={visibleServices.length ? Math.round((Math.max(visibleServices.length - runningCount - degradedCount, 0) / visibleServices.length) * 100) : 0}
                strokeColor="#64748b"
                showInfo={false}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </Space>
  );

  const servicesTab = (
    <Card
      bordered={false}
      className="system-panel"
      extra={
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void loadServices()} loading={servicesLoading}>
            刷新服务
          </Button>
          <Button type="primary" onClick={openCreateServiceModal}>
            新增服务
          </Button>
        </Space>
      }
    >
      <Table rowKey="id" loading={servicesLoading} columns={serviceColumns} dataSource={visibleServices} pagination={{ pageSize: 8 }} scroll={{ x: 1480 }} />
    </Card>
  );

  const resourcesTab = (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card bordered={false} className="system-panel">
        <div className="panel-heading">
          <div>
            <Typography.Title level={4}>系统资源监控</Typography.Title>
            <Typography.Text type="secondary">后端持续采样，前端可切换观察周期并自动轮询，不需要手动全页刷新。</Typography.Text>
          </div>
          <Space wrap>
            <Segmented options={[...resourcePeriodOptions]} value={resourcePeriod} onChange={(value) => setResourcePeriod(value as SystemResourceHistoryPeriod)} />
            <Button icon={<ReloadOutlined />} onClick={() => void loadResources(resourcePeriod)} loading={resourcesLoading}>
              刷新资源
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <TrendChartCard title="CPU 使用率" value={resources?.cpuUsage || 0} subtitle={`周期 ${getPeriodLabel(resourcePeriod)}`} history={resources?.history || []} metricKey="cpuUsage" color="#0f766e" />
        </Col>
        <Col xs={24} lg={8}>
          <TrendChartCard title="内存使用率" value={resources?.memoryUsage || 0} subtitle={`已用 ${formatBytes(resources?.usedMemory || 0)}`} history={resources?.history || []} metricKey="memoryUsage" color="#2563eb" />
        </Col>
        <Col xs={24} lg={8}>
          <TrendChartCard title="磁盘最高占用" value={latestResourceSample?.diskMaxUsage || 0} subtitle={`总样本 ${resources?.collectedSamples || 0}`} history={resources?.history || []} metricKey="diskMaxUsage" color="#ea580c" />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} className="system-panel" loading={resourcesLoading && !resources}>
            <Statistic title="CPU 当前值" value={resources?.cpuUsage || 0} suffix="%" precision={2} />
            <Progress percent={Math.round(resources?.cpuUsage || 0)} showInfo={false} strokeColor="#0f766e" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} className="system-panel" loading={resourcesLoading && !resources}>
            <Statistic title="内存当前值" value={resources?.memoryUsage || 0} suffix="%" precision={2} />
            <Typography.Text type="secondary">已用 {formatBytes(resources?.usedMemory || 0)} / 总计 {formatBytes(resources?.totalMemory || 0)}</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} className="system-panel" loading={resourcesLoading && !resources}>
            <Statistic title="系统运行时长" value={resources ? formatUptime(resources.uptimeSeconds) : "-"} />
            <Typography.Text type="secondary">{resources?.hostname || "-"} · {resources?.platform || "-"} · {resources?.arch || "-"}</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} className="system-panel" title="磁盘资源" loading={resourcesLoading && !resources}>
        <Table
          rowKey="name"
          dataSource={resources?.disks || []}
          pagination={false}
          columns={[
            { title: "磁盘", dataIndex: "label", key: "label" },
            { title: "总容量", dataIndex: "size", key: "size", render: (value: number) => formatBytes(value) },
            { title: "已用", dataIndex: "used", key: "used", render: (value: number) => formatBytes(value) },
            { title: "可用", dataIndex: "free", key: "free", render: (value: number) => formatBytes(value) },
            { title: "使用率", dataIndex: "usedPercent", key: "usedPercent", render: (value: number) => <Progress percent={Math.round(value)} size="small" strokeColor="#ea580c" /> }
          ]}
        />
      </Card>

      <Card bordered={false} className="system-panel" title="托管进程" loading={servicesLoading && services.length === 0}>
        <Table
          rowKey="serviceKey"
          dataSource={managedProcesses}
          pagination={false}
          locale={{ emptyText: "当前没有识别到托管进程" }}
          columns={[
            { title: "服务", dataIndex: "serviceName", key: "serviceName" },
            { title: "PID", dataIndex: "pid", key: "pid" },
            { title: "进程", dataIndex: "processName", key: "processName" },
            { title: "端口", dataIndex: "port", key: "port", render: (value: number | null) => value || "-" }
          ]}
        />
      </Card>
    </Space>
  );

  const architectureTab = (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Alert
        type="success"
        showIcon
        message="统一元数据库策略"
        description={architecture?.strategy || "平台长期保持一套 MySQL 和一套 PostgreSQL，新增服务根据职责落到其中之一。"}
      />
      <Row gutter={[16, 16]}>
        {(architecture?.instances || []).map((instance) => (
          <Col xs={24} xl={12} key={instance.key}>
            <Card
              bordered={false}
              className="system-panel"
              loading={architectureLoading && !architecture}
              title={instance.name}
              extra={<Tag color={instance.status === "running" ? "green" : instance.status === "degraded" ? "orange" : "default"}>{instance.status}</Tag>}
            >
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                <Typography.Text>{instance.engine.toUpperCase()} · {instance.host}:{instance.port}</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{instance.scope}</Typography.Paragraph>
                <div>
                  <Typography.Text strong>数据库：</Typography.Text>
                  <Space wrap style={{ marginLeft: 8 }}>
                    {instance.databases.map((database) => (
                      <Tag key={database}>{database}</Tag>
                    ))}
                  </Space>
                </div>
                <div>
                  <Typography.Text strong>职责边界：</Typography.Text>
                  <div className="tag-cloud">
                    {instance.boundaries.map((item) => (
                      <Tag key={item} color="blue">{item}</Tag>
                    ))}
                  </div>
                </div>
                <Table
                  rowKey={(row: { serviceKey: string; database: string; name: string }) => `${row.serviceKey}-${row.database}-${row.name}`}
                  pagination={false}
                  size="small"
                  dataSource={instance.services}
                  columns={[
                    { title: "服务", dataIndex: "name", key: "name" },
                    { title: "数据库", dataIndex: "database", key: "database" },
                    { title: "用途", dataIndex: "purpose", key: "purpose" }
                  ]}
                />
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className="system-panel" title="新服务落库规则" loading={architectureLoading && !architecture}>
        <Table
          rowKey="category"
          pagination={false}
          dataSource={architecture?.placementRules || []}
          columns={[
            { title: "服务类别", dataIndex: "category", key: "category", width: 220 },
            { title: "目标库", dataIndex: "target", key: "target", width: 120, render: (value: string) => <Tag color={value === "mysql" ? "gold" : value === "postgresql" ? "geekblue" : "purple"}>{value}</Tag> },
            { title: "适用示例", dataIndex: "examples", key: "examples", render: (value: string[]) => value.join("、") },
            { title: "原因", dataIndex: "reason", key: "reason" }
          ]}
        />
      </Card>
    </Space>
  );

  const usersTab = (
    <Card
      bordered={false}
      className="system-panel"
      extra={
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void loadUsers()} loading={usersLoading}>
            刷新用户
          </Button>
          <Button type="primary" onClick={openCreateUserModal}>
            创建用户
          </Button>
        </Space>
      }
    >
      <Table rowKey="id" loading={usersLoading} columns={userColumns} dataSource={users} pagination={{ pageSize: 8 }} />
    </Card>
  );

  const tabItems: TabsProps["items"] = [
    { key: "overview", label: "概览", children: overviewTab },
    { key: "services", label: "服务与数据库", children: servicesTab },
    { key: "resources", label: "资源监控", children: resourcesTab },
    { key: "architecture", label: "数据库架构", children: architectureTab },
  ];

  return (
    <div className="system-service-page">
      <section className="system-service-hero">
        <div className="system-service-hero__metrics">
          <SummaryMetricCard title="运行中服务" value={`${runningCount} / ${visibleServices.length || 0}`} hint="自动轮询，仅刷新服务列表" accent="teal" icon={<DashboardOutlined />} />
          <SummaryMetricCard title="异常服务" value={degradedCount} hint="优先关注健康检查失败和容器降级" accent="rose" icon={<WarningOutlined />} />
          <SummaryMetricCard title="数据库服务" value={databaseCount} hint="数据库实例和元数据边界统一展示" accent="blue" icon={<DatabaseOutlined />} />
          <SummaryMetricCard title="默认启动项" value={autoStartCount} hint="动作只触发默认服务，避免全局重载" accent="amber" icon={<RocketOutlined />} />
        </div>
      </section>

      <Tabs className="system-tabs" activeKey={activeTab} items={tabItems} onChange={setActiveTab} destroyInactiveTabPane={false} />

      <Modal open={serviceModalOpen} title={editingService ? "编辑服务配置" : "新增服务配置"} onCancel={closeServiceModal} onOk={() => void handleServiceSubmit()} confirmLoading={serviceSubmitting} width={760} destroyOnHidden>
        <Form layout="vertical" form={serviceForm}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serviceName" label="服务名称" rules={[{ required: true, message: "请输入服务名称" }]}>
                <Input placeholder="例如：Project MySQL" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serviceKey" label="服务编码" rules={[{ required: true, message: "请输入服务编码" }]}>
                <Input placeholder="例如：mysql_primary" disabled={Boolean(editingService?.isCore)} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="serviceCategory" label="服务分类" rules={[{ required: true }]}>
                <Select options={serviceCategoryOptions as any} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="serviceType" label="服务类型" rules={[{ required: true }]}>
                <Select options={serviceTypeOptions as any} disabled={Boolean(editingService?.isCore)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="manageMode" label="管理方式" rules={[{ required: true }]}>
                <Select options={manageModeOptions as any} disabled={Boolean(editingService?.isCore)} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="host" label="IP / Host">
                <Input placeholder="127.0.0.1" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="port" label="端口">
                <InputNumber style={{ width: "100%" }} placeholder="4000" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="autoStart" label="默认启动" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select options={statusOptions as any} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="说明服务用途、账号或部署说明" />
          </Form.Item>

          <Form.Item name="configText" label="高级配置 JSON">
            <Input.TextArea rows={12} placeholder='{"workingDirectory":"E:\\sjzt\\backend"}' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={userModalOpen} title={editingUser ? "编辑系统用户" : "创建系统用户"} onCancel={closeUserModal} onOk={() => void handleUserSubmit()} confirmLoading={userSubmitting} destroyOnHidden>
        <Form layout="vertical" form={userForm}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, max: 64, message: "用户名长度需为 3-64 位" },
              { pattern: /^[a-zA-Z0-9_]+$/, message: "用户名仅支持字母、数字和下划线" },
            ]}
          >
            <Input placeholder="例如：admin02" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[
              { required: true, message: "请输入显示名称" },
              { min: 2, max: 64, message: "显示名称长度需为 2-64 位" },
            ]}
          >
            <Input placeholder="例如：系统运维" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="roleCode" label="角色" rules={[{ required: true }]}>
                <Select options={roleOptions as any} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select options={statusOptions as any} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="password"
            label={editingUser ? "新密码" : "密码"}
            rules={[
              ...(editingUser ? [] : [{ required: true, message: "请输入密码" }]),
              { min: 6, max: 64, message: "密码长度需为 6-64 位" },
            ]}
          >
            <Input.Password placeholder={editingUser ? "留空则不修改" : "请输入密码"} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
