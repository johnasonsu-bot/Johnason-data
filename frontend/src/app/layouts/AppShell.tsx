import {
  ApartmentOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  BookOutlined,
  BranchesOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  LockOutlined,
  LogoutOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Button, Layout, Menu, Select, Typography } from "antd";
import type { ItemType } from "antd/es/menu/interface";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ReadOnlyModeGuard } from "../../components/ReadOnlyModeGuard";
import { hasLicensedFeature } from "../licenseFeatures";
import { hasModulePermission, type ModulePermission } from "../permissions";
import { useAuth } from "../providers/AuthProvider";
import { useProject } from "../providers/ProjectProvider";

const { Header, Sider, Content } = Layout;

const TEXT = {
  topQuality: "质量管控",
  topOverview: "总览",
  topGovernance: "数据治理",
  topAssetSearch: "资产检索",
  topIngestion: "数据接入",
  topDevelopment: "数据开发",
  topDataMap: "数据地图",
  topStandards: "数据标准",
  topLab: "数据建模",
  topReporting: "报表平台",
  topSystem: "系统管理",
  topProcessing: "数据处理",
  topServices: "数据服务",
  overview: "运营总览",
  assetSearch: "元数据检索",
  businessDataSearch: "业务数据检索",
  dataSourceManagement: "数据源管理",
  dataSourceResearch: "数据调研",
  departmentManagement: "部门管理",
  businessSystemManagement: "业务系统",
  resourceManagement: "资源管理",
  standardOverview: "标准总览",
  standardCatalogs: "标准目录",
  standardElements: "标准数据元",
  standardValueDomains: "值域与代码集",
  standardReferences: "引用标准",
  standardMappings: "字段采标映射",
  sqlWorkbench: "SQL分析",
  instanceMonitor: "实例监控",
  ingestionJobs: "接入任务",
  fileImports: "文件上传",
  ingestionMonitor: "接入概览",
  devModelManagement: "模型管理",
  dataProcessing: "数据处理",
  processingJobs: "处理任务",
  ruleValidation: "规则校验",
  scheduleManagement: "调度管理",
  serviceOpsDashboard: "服务运营",
  serviceUsage: "服务测试",
  serviceCatalog: "服务目录",
  reportOverview: "报表概览",
  reportDatasetManagement: "数据集市",
  reportWorkbench: "报表开发",
  reportChartLibrary: "图表资产",
  reportModelManagement: "模型管理",
  reportThemeTemplates: "模板中心",
  reportThemeRelations: "模板应用关系",
  experimentLabWorkbench: "数据实验室",
  publishApproval: "授权审批",
  callAudit: "服务审计",
  opsDashboard: "运维看板",
  research: "数据调研",
  modelManagement: "模型管理",
  knowledgeBaseManagement: "知识库管理",
  serviceManagement: "服务管理",
  projectManagement: "项目管理",
  userManagement: "用户管理",
  roleManagement: "角色管理",
  platformName: "AI智能数据中台",
  logout: "退出系统",
};

type TopModule = {
  key: string;
  label: ReactNode;
  permissions: ModulePermission[];
  licenseFeature?: string;
  children?: TopModule[];
  popupClassName?: string;
  popupOffset?: [number, number];
};

type MenuEntry = {
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  permission?: ModulePermission;
  permissions?: ModulePermission[];
  licenseFeature?: string;
  children?: MenuEntry[];
};

const moduleTitleMap: Record<string, string> = {
  overview: TEXT.topOverview,
  asset_search: TEXT.topAssetSearch,
  ingestion: TEXT.topIngestion,
  quality: TEXT.topQuality,
  development: TEXT.topDevelopment,
  data_map: TEXT.topDataMap,
  standards: TEXT.topStandards,
  data_modeling: TEXT.topLab,
  reporting: TEXT.topReporting,
  services: TEXT.topServices,
  system: TEXT.topSystem,
  processing: TEXT.topProcessing,
};

const topModules: TopModule[] = [
  { key: "overview", label: <Link to="/dashboard/overview">{TEXT.topOverview}</Link>, permissions: ["overview"], licenseFeature: "overview" },
  { key: "asset_search", label: <Link to="/dashboard/asset-search">{TEXT.topAssetSearch}</Link>, permissions: ["data_map", "ingestion", "quality", "services"], licenseFeature: "data_map" },
  { key: "ingestion", label: <Link to="/dashboard/data-ingestion-monitor">{TEXT.topIngestion}</Link>, permissions: ["ingestion"], licenseFeature: "ingestion" },
  { key: "quality", label: <Link to="/dashboard/quality-control/insights">{TEXT.topQuality}</Link>, permissions: ["quality"], licenseFeature: "quality" },
  { key: "development", label: <Link to="/dashboard/data-development/datasources">{TEXT.topDevelopment}</Link>, permissions: ["ingestion"], licenseFeature: "development" },
  { key: "data_modeling", label: <Link to="/dashboard/data-modeling/model-overview">{TEXT.topLab}</Link>, permissions: ["data_modeling"], licenseFeature: "data_modeling" },
  { key: "services", label: <Link to="/dashboard/service-ops">{TEXT.topServices}</Link>, permissions: ["services"], licenseFeature: "services" },
  {
    key: "governance",
    label: TEXT.topGovernance,
    permissions: ["data_map", "standards"],
    popupClassName: "top-nav-governance-popup",
    popupOffset: [-30, 0],
    children: [
      { key: "standards", label: <Link to="/dashboard/data-standards/overview">{TEXT.topStandards}</Link>, permissions: ["standards"], licenseFeature: "standards" },
      { key: "data_map", label: <Link to="/dashboard/data-map/resources">{TEXT.topDataMap}</Link>, permissions: ["data_map"], licenseFeature: "data_map" },
    ],
  },
  { key: "reporting", label: <Link to="/dashboard/reporting/overview">{TEXT.topReporting}</Link>, permissions: ["reporting"], licenseFeature: "reporting" },
  { key: "system", label: <Link to="/dashboard/system-models">{TEXT.topSystem}</Link>, permissions: ["system_services", "system_users", "system_roles", "system_models", "system_projects"] },
];

const sideMenuMap: Record<string, MenuEntry[]> = {
  overview: [
    { key: "/dashboard/overview", icon: <BarChartOutlined />, label: <Link to="/dashboard/overview">{TEXT.overview}</Link>, permission: "overview" },
  ],
  asset_search: [
    { key: "/dashboard/asset-search", icon: <SearchOutlined />, label: <Link to="/dashboard/asset-search">{TEXT.assetSearch}</Link>, permissions: ["data_map", "ingestion", "quality", "services"], licenseFeature: "data_map" },
    { key: "/dashboard/asset-search/business-data", icon: <DatabaseOutlined />, label: <Link to="/dashboard/asset-search/business-data">{TEXT.businessDataSearch}</Link>, permission: "data_map", licenseFeature: "data_map" },
    { key: "/dashboard/asset-search/models", icon: <SettingOutlined />, label: <Link to="/dashboard/asset-search/models">{TEXT.modelManagement}</Link>, permissions: ["data_map", "ingestion", "quality", "services"], licenseFeature: "data_map" },
  ],
  ingestion: [
    { key: "/dashboard/data-ingestion-monitor", icon: <RadarChartOutlined />, label: <Link to="/dashboard/data-ingestion-monitor">{TEXT.ingestionMonitor}</Link>, permission: "ingestion" },
    { key: "/dashboard/data-sources", icon: <DatabaseOutlined />, label: <Link to="/dashboard/data-sources">{TEXT.dataSourceManagement}</Link>, permission: "ingestion" },
    { key: "/dashboard/data-source-research", icon: <BranchesOutlined />, label: <Link to="/dashboard/data-source-research">{TEXT.dataSourceResearch}</Link>, permission: "ingestion" },
    { key: "/dashboard/data-ingestion-jobs", icon: <ApartmentOutlined />, label: <Link to="/dashboard/data-ingestion-jobs">{TEXT.ingestionJobs}</Link>, permission: "ingestion" },
    { key: "/dashboard/data-file-imports", icon: <UploadOutlined />, label: <Link to="/dashboard/data-file-imports">{TEXT.fileImports}</Link>, permission: "ingestion" },
    { key: "/dashboard/data-ingestion-ai", icon: <SettingOutlined />, label: <Link to="/dashboard/data-ingestion-ai">模型管理</Link>, permission: "ingestion" },
  ],
  quality: [
    { key: "/dashboard/quality-control/insights", icon: <BarChartOutlined />, label: <Link to="/dashboard/quality-control/insights">质量大屏</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/data-sources", icon: <DatabaseOutlined />, label: <Link to="/dashboard/quality-control/data-sources">数据源管理</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/rules", icon: <SafetyCertificateOutlined />, label: <Link to="/dashboard/quality-control/rules">规则管理</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/strategies", icon: <SettingOutlined />, label: <Link to="/dashboard/quality-control/strategies">策略管理</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/tasks", icon: <ApartmentOutlined />, label: <Link to="/dashboard/quality-control/tasks">任务调度</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/analysis", icon: <RadarChartOutlined />, label: <Link to="/dashboard/quality-control/analysis">结果统计</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/reports", icon: <FileTextOutlined />, label: <Link to="/dashboard/quality-control/reports">分析报告</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/issues", icon: <FileSearchOutlined />, label: <Link to="/dashboard/quality-control/issues">问题管理</Link>, permission: "quality" },
    { key: "/dashboard/quality-control/models", icon: <SettingOutlined />, label: <Link to="/dashboard/quality-control/models">模型管理</Link>, permission: "quality" },
  ],
  development: [
    { key: "/dashboard/data-development/datasources", icon: <DatabaseOutlined />, label: <Link to="/dashboard/data-development/datasources">{TEXT.dataSourceManagement}</Link>, permission: "ingestion", licenseFeature: "development" },
    { key: "/dashboard/data-development/sql-tasks", icon: <BranchesOutlined />, label: <Link to="/dashboard/data-development/sql-tasks">{TEXT.sqlWorkbench}</Link>, permission: "ingestion", licenseFeature: "development" },
    { key: "/dashboard/data-development/processing", icon: <DeploymentUnitOutlined />, label: <Link to="/dashboard/data-development/processing">{TEXT.dataProcessing}</Link>, permission: "ingestion", licenseFeature: "development" },
    { key: "/dashboard/data-development/operator-platform", icon: <PartitionOutlined />, label: <Link to="/dashboard/data-development/operator-platform">算子平台</Link>, permission: "ingestion", licenseFeature: "development" },
    { key: "/dashboard/data-development/scheduling", icon: <NodeIndexOutlined />, label: <Link to="/dashboard/data-development/scheduling">调度管理</Link>, permission: "ingestion", licenseFeature: "development" },
    { key: "/dashboard/data-development/models", icon: <SettingOutlined />, label: <Link to="/dashboard/data-development/models">{TEXT.devModelManagement}</Link>, permission: "ingestion", licenseFeature: "development" },
  ],
  data_map: [
    { key: "/dashboard/data-map/departments", icon: <ApartmentOutlined />, label: <Link to="/dashboard/data-map/departments">{TEXT.departmentManagement}</Link>, permission: "data_map", licenseFeature: "data_map" },
    { key: "/dashboard/data-map/systems", icon: <BranchesOutlined />, label: <Link to="/dashboard/data-map/systems">{TEXT.businessSystemManagement}</Link>, permission: "data_map", licenseFeature: "data_map" },
    { key: "/dashboard/data-map/sources", icon: <DatabaseOutlined />, label: <Link to="/dashboard/data-map/sources">{TEXT.dataSourceManagement}</Link>, permission: "data_map", licenseFeature: "data_map" },
    { key: "/dashboard/data-map/resources", icon: <FolderOpenOutlined />, label: <Link to="/dashboard/data-map/resources">{TEXT.resourceManagement}</Link>, permission: "data_map", licenseFeature: "data_map" },
    { key: "/dashboard/data-map/models", icon: <SettingOutlined />, label: <Link to="/dashboard/data-map/models">{TEXT.modelManagement}</Link>, permission: "data_map", licenseFeature: "data_map" },
  ],
  standards: [
    { key: "/dashboard/data-standards/overview", icon: <BarChartOutlined />, label: <Link to="/dashboard/data-standards/overview">{TEXT.standardOverview}</Link>, permission: "standards", licenseFeature: "standards" },
    { key: "/dashboard/data-standards/catalogs", icon: <ApartmentOutlined />, label: <Link to="/dashboard/data-standards/catalogs">{TEXT.standardCatalogs}</Link>, permission: "standards", licenseFeature: "standards" },
    { key: "/dashboard/data-standards/elements", icon: <SafetyCertificateOutlined />, label: <Link to="/dashboard/data-standards/elements">{TEXT.standardElements}</Link>, permission: "standards", licenseFeature: "standards" },
    { key: "/dashboard/data-standards/value-domains", icon: <FolderOpenOutlined />, label: <Link to="/dashboard/data-standards/value-domains">{TEXT.standardValueDomains}</Link>, permission: "standards", licenseFeature: "standards" },
    { key: "/dashboard/data-standards/references", icon: <BranchesOutlined />, label: <Link to="/dashboard/data-standards/references">{TEXT.standardReferences}</Link>, permission: "standards", licenseFeature: "standards" },
    { key: "/dashboard/data-standards/mappings", icon: <PartitionOutlined />, label: <Link to="/dashboard/data-standards/mappings">{TEXT.standardMappings}</Link>, permission: "standards", licenseFeature: "standards" },
    { key: "/dashboard/data-standards/models", icon: <SettingOutlined />, label: <Link to="/dashboard/data-standards/models">{TEXT.modelManagement}</Link>, permission: "standards", licenseFeature: "standards" },
  ],
  processing: [
    { key: "/dashboard/processing", icon: <DeploymentUnitOutlined />, label: <Link to="/dashboard/processing">{TEXT.processingJobs}</Link>, permission: "processing" },
    { key: "/dashboard/processing-rules", icon: <ApartmentOutlined />, label: <Link to="/dashboard/processing-rules">{TEXT.ruleValidation}</Link>, permission: "processing" },
    { key: "/dashboard/processing-schedule", icon: <RadarChartOutlined />, label: <Link to="/dashboard/processing-schedule">{TEXT.scheduleManagement}</Link>, permission: "processing" },
  ],
  services: [
    { key: "/dashboard/service-ops", icon: <BarChartOutlined />, label: <Link to="/dashboard/service-ops">{TEXT.serviceOpsDashboard}</Link>, permission: "services" },
    { key: "/dashboard/service-data-sources", icon: <DatabaseOutlined />, label: <Link to="/dashboard/service-data-sources">数据源管理</Link>, permission: "services" },
    { key: "/dashboard/services", icon: <LockOutlined />, label: <Link to="/dashboard/services">{TEXT.serviceCatalog}</Link>, permission: "services" },
    { key: "/dashboard/service-apps", icon: <AppstoreOutlined />, label: <Link to="/dashboard/service-apps">应用管理</Link>, permission: "services" },
    { key: "/dashboard/service-authorizations", icon: <ApartmentOutlined />, label: <Link to="/dashboard/service-authorizations">{TEXT.publishApproval}</Link>, permission: "services" },
    { key: "/dashboard/service-audit", icon: <RadarChartOutlined />, label: <Link to="/dashboard/service-audit">{TEXT.callAudit}</Link>, permission: "services" },
    { key: "/dashboard/service-usage", icon: <ApiOutlined />, label: <Link to="/dashboard/service-usage">{TEXT.serviceUsage}</Link>, permission: "services" },
    { key: "/dashboard/service-models", icon: <SettingOutlined />, label: <Link to="/dashboard/service-models">模型管理</Link>, permission: "services" },
  ],
  reporting: [
    { key: "/dashboard/reporting/overview", icon: <BarChartOutlined />, label: <Link to="/dashboard/reporting/overview">{TEXT.reportOverview}</Link>, permission: "reporting" },
    { key: "/dashboard/reporting/data-sources", icon: <DatabaseOutlined />, label: <Link to="/dashboard/reporting/data-sources">{TEXT.dataSourceManagement}</Link>, permission: "reporting" },
    { key: "/dashboard/reporting/datasets", icon: <ApartmentOutlined />, label: <Link to="/dashboard/reporting/datasets">{TEXT.reportDatasetManagement}</Link>, permission: "reporting" },
    { key: "/dashboard/reporting/workbench", icon: <BranchesOutlined />, label: <Link to="/dashboard/reporting/workbench">{TEXT.reportWorkbench}</Link>, permission: "reporting" },
    { key: "/dashboard/reporting/chart-library", icon: <AppstoreOutlined />, label: <Link to="/dashboard/reporting/chart-library">{TEXT.reportChartLibrary}</Link>, permission: "reporting" },
    { key: "/dashboard/reporting/theme-templates", icon: <BgColorsOutlined />, label: <Link to="/dashboard/reporting/theme-templates">{TEXT.reportThemeTemplates}</Link>, permission: "reporting" },
    { key: "/dashboard/reporting/models", icon: <SettingOutlined />, label: <Link to="/dashboard/reporting/models">{TEXT.reportModelManagement}</Link>, permission: "reporting" },
  ],
  data_modeling: [
    { key: "/dashboard/data-modeling/model-overview", icon: <BarChartOutlined />, label: <Link to="/dashboard/data-modeling/model-overview">模型概览</Link>, permission: "data_modeling" },
    { key: "/dashboard/data-modeling/research", icon: <BranchesOutlined />, label: <Link to="/dashboard/data-modeling/research">{TEXT.research}</Link>, permission: "data_modeling" },
    { key: "/dashboard/data-modeling/logical-models", icon: <NodeIndexOutlined />, label: <Link to="/dashboard/data-modeling/logical-models">逻辑模型</Link>, permission: "data_modeling" },
    { key: "/dashboard/data-modeling/physical-models", icon: <DeploymentUnitOutlined />, label: <Link to="/dashboard/data-modeling/physical-models">物理模型</Link>, permission: "data_modeling" },
    { key: "/dashboard/data-modeling/simulation", icon: <ExperimentOutlined />, label: <Link to="/dashboard/data-modeling/simulation">模型部署</Link>, permission: "data_modeling" },
    { key: "/dashboard/data-modeling/ai-business-data", icon: <ApiOutlined />, label: <Link to="/dashboard/data-modeling/ai-business-data">AI 业务数据</Link>, permission: "data_modeling" },
    { key: "/dashboard/data-modeling/prompts", icon: <SettingOutlined />, label: <Link to="/dashboard/data-modeling/prompts">模型管理</Link>, permission: "data_modeling" },
  ],
  system: [
    { key: "/dashboard/system-services", icon: <DeploymentUnitOutlined />, label: <Link to="/dashboard/system-services">{TEXT.serviceManagement}</Link>, permission: "system_services", licenseFeature: "system_services" },
    { key: "/dashboard/system-database-drivers", icon: <DatabaseOutlined />, label: <Link to="/dashboard/system-database-drivers">驱动管理</Link>, permission: "system_services", licenseFeature: "system_services" },
    {
      key: "system-knowledge-group",
      icon: <DatabaseOutlined />,
      label: TEXT.knowledgeBaseManagement,
      children: [
        { key: "/dashboard/system-knowledge-bases/industry", icon: <DatabaseOutlined />, label: <Link to="/dashboard/system-knowledge-bases/industry">行业知识库</Link>, permission: "system_services", licenseFeature: "system_services" },
        { key: "/dashboard/system-knowledge-bases/platform", icon: <DatabaseOutlined />, label: <Link to="/dashboard/system-knowledge-bases/platform">平台知识库</Link>, permission: "system_services", licenseFeature: "system_services" },
        { key: "/dashboard/system-knowledge-bases/personal", icon: <DatabaseOutlined />, label: <Link to="/dashboard/system-knowledge-bases/personal">个人知识库</Link>, permission: "system_services", licenseFeature: "system_services" },
      ],
    },
    { key: "/dashboard/system-models", icon: <SettingOutlined />, label: <Link to="/dashboard/system-models">{TEXT.modelManagement}</Link>, permission: "system_models", licenseFeature: "system_models" },
    { key: "/dashboard/system-projects", icon: <ApartmentOutlined />, label: <Link to="/dashboard/system-projects">{TEXT.projectManagement}</Link>, permission: "system_projects", licenseFeature: "system_projects" },
    { key: "/dashboard/system-users", icon: <TeamOutlined />, label: <Link to="/dashboard/system-users">{TEXT.userManagement}</Link>, permission: "system_users", licenseFeature: "system_users" },
    { key: "/dashboard/system-roles", icon: <BranchesOutlined />, label: <Link to="/dashboard/system-roles">{TEXT.roleManagement}</Link>, permission: "system_roles", licenseFeature: "system_roles" },
  ],
};

function resolveCurrentModule(pathname: string) {
  if (pathname.startsWith("/dashboard/asset-search")) return "asset_search";
  if (pathname.startsWith("/dashboard/data-development")) return "development";
  if (pathname.startsWith("/dashboard/data-standards")) return "standards";
  if (pathname.startsWith("/dashboard/data-map")) return "data_map";
  if (pathname.startsWith("/dashboard/reporting")) return "reporting";
  if (pathname.startsWith("/dashboard/data-modeling")) return "data_modeling";
  if (pathname.startsWith("/dashboard/quality-control")) return "quality";
  if (pathname.startsWith("/dashboard/data-")) return "ingestion";
  if (pathname.startsWith("/dashboard/processing")) return "processing";
  if (pathname.startsWith("/dashboard/services") || pathname.startsWith("/dashboard/service-")) return "services";
  if (pathname.startsWith("/dashboard/system")) return "system";
  return "overview";
}

function resolveSelectedMenuKey(pathname: string) {
  if (pathname.startsWith("/dashboard/data-source-research/")) return "/dashboard/data-source-research";
  if (pathname.startsWith("/dashboard/data-file-imports/")) return "/dashboard/data-file-imports";
  if (pathname.startsWith("/dashboard/services/")) return "/dashboard/services";
  if (pathname.startsWith("/dashboard/data-development/workbench")) return "/dashboard/data-development/sql-tasks";
  if (pathname.startsWith("/dashboard/data-development/orchestration")) return "/dashboard/data-development/operator-platform";
  if (pathname.startsWith("/dashboard/data-development/operator-platform/")) return "/dashboard/data-development/operator-platform";
  if (pathname.startsWith("/dashboard/data-development/scheduling/")) return "/dashboard/data-development/scheduling";
  if (pathname.startsWith("/dashboard/data-map/resources/")) return "/dashboard/data-map/resources";
  if (pathname.startsWith("/dashboard/quality-control/strategies/")) return "/dashboard/quality-control/strategies";
  if (pathname.startsWith("/dashboard/data-modeling/logical-models/")) return "/dashboard/data-modeling/logical-models";
  if (pathname.startsWith("/dashboard/data-modeling/physical-models/")) return "/dashboard/data-modeling/physical-models";
  if (pathname.startsWith("/dashboard/data-modeling/data-sources")) return "/dashboard/data-modeling/simulation";
  if (pathname.startsWith("/dashboard/data-modeling/simulation/")) return "/dashboard/data-modeling/simulation";
  if (pathname.startsWith("/dashboard/data-modeling/scenario-management/templates/")) return "/dashboard/data-modeling/logical-models";
  if (pathname.startsWith("/dashboard/data-modeling/scenario-management/instances/")) return "/dashboard/data-modeling/physical-models";
  if (pathname.startsWith("/dashboard/data-modeling/scenario-management/data-sources/")) return "/dashboard/data-modeling/simulation";
  return pathname;
}

function filterMenuEntries(entries: MenuEntry[], user: ReturnType<typeof useAuth>["user"], licenseStatus: ReturnType<typeof useAuth>["licenseStatus"]): MenuEntry[] {
  return entries
    .map((entry) => {
      const children = entry.children ? filterMenuEntries(entry.children, user, licenseStatus) : undefined;
      const entryPermissions = entry.permissions || (entry.permission ? [entry.permission] : []);
      const allowedByPermission = entryPermissions.length > 0
        ? entryPermissions.some((permission) => hasModulePermission(user, permission))
        : Boolean(children?.length);
      const licenseFeature = entry.licenseFeature || entry.permission || null;
      const allowedByLicense = licenseFeature ? hasLicensedFeature(licenseStatus, licenseFeature) : Boolean(children?.length);
      if (!allowedByPermission || !allowedByLicense) return null;
      return children && children.length > 0 ? { ...entry, children } : { ...entry, children: undefined };
    })
    .filter(Boolean) as MenuEntry[];
}

function toMenuItems(entries: MenuEntry[]): ItemType[] {
  return entries.map((entry) => ({
    key: entry.key,
    icon: entry.icon,
    label: entry.label,
    children: entry.children ? toMenuItems(entry.children) : undefined,
  }));
}

function filterTopModules(entries: TopModule[], user: ReturnType<typeof useAuth>["user"], licenseStatus: ReturnType<typeof useAuth>["licenseStatus"]): TopModule[] {
  return entries
    .map((entry) => {
      const children = entry.children ? filterTopModules(entry.children, user, licenseStatus) : undefined;
      if (children && children.length > 0) {
        return { ...entry, children };
      }
      const allowedByPermission = entry.permissions.some((permission) => hasModulePermission(user, permission));
      const allowedByLicense = entry.licenseFeature ? hasLicensedFeature(licenseStatus, entry.licenseFeature) : true;
      return allowedByPermission && allowedByLicense ? { ...entry, children: undefined } : null;
    })
    .filter(Boolean) as TopModule[];
}

function toTopMenuItems(entries: TopModule[]): ItemType[] {
  return entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    popupClassName: entry.popupClassName,
    popupOffset: entry.popupOffset,
    children: entry.children ? toTopMenuItems(entry.children) : undefined,
  }));
}

function resolveTopSelectedKey(moduleKey: string) {
  return ["data_map", "standards"].includes(moduleKey) ? "governance" : moduleKey;
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, licenseStatus } = useAuth();
  const { projects, currentProjectId, loading: projectLoading, switchProject } = useProject();
  const isReportingEditor = /^\/dashboard\/reporting\/workbench\/(?:create|\d+\/edit)$/.test(location.pathname);
  const currentModuleKey = resolveCurrentModule(location.pathname);
  const topSelectedKey = resolveTopSelectedKey(currentModuleKey);
  const selectedMenuKey = resolveSelectedMenuKey(location.pathname);
  const sideMenuItems = filterMenuEntries(sideMenuMap[currentModuleKey] || [], user, licenseStatus);
  const visibleTopModules = filterTopModules(topModules, user, licenseStatus);
  const currentModuleTitle = useMemo(
    () =>
      moduleTitleMap[currentModuleKey]
      || visibleTopModules.find((item) => item.key === currentModuleKey)?.label
      || visibleTopModules[0]?.label
      || TEXT.topOverview,
    [currentModuleKey, visibleTopModules]
  );
  const defaultOpenKeys = useMemo(() => {
    if (location.pathname.startsWith("/dashboard/system-knowledge-bases")) {
      return ["system-knowledge-group"];
    }
    return [];
  }, [location.pathname]);
  const [openKeys, setOpenKeys] = useState<string[]>(defaultOpenKeys);

  useEffect(() => {
    setOpenKeys(defaultOpenKeys);
  }, [defaultOpenKeys]);

  useEffect(() => {
    if (isReportingEditor) {
      document.body.classList.add("reporting-editor-mode");
    } else {
      document.body.classList.remove("reporting-editor-mode");
    }
    return () => {
      document.body.classList.remove("reporting-editor-mode");
    };
  }, [isReportingEditor]);

  return (
    <Layout className="app-shell">
      <ReadOnlyModeGuard />
      {isReportingEditor ? null : (
      <Header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__topbar">
            <div className="app-header__brand">
              <span className="app-header__brand-mark">
                <NodeIndexOutlined />
              </span>
              <Typography.Title level={4} className="app-header__brand-title">
                {TEXT.platformName}
              </Typography.Title>
            </div>
            <div className="app-header__nav">
              <Menu
                selectedKeys={[topSelectedKey, currentModuleKey]}
                mode="horizontal"
                triggerSubMenuAction="hover"
                items={toTopMenuItems(visibleTopModules)}
                className="top-nav-menu"
              />
            </div>
            <div className="app-header__project" data-readonly-allow-action="true" style={{ minWidth: 156 }}>
              <Select
                loading={projectLoading}
                value={currentProjectId || undefined}
                placeholder="选择项目"
                style={{ width: 156 }}
                options={projects.map((item) => ({ value: item.id, label: item.projectName }))}
                onChange={(projectId) => {
                  switchProject(Number(projectId));
                  window.location.reload();
                }}
              />
            </div>
            <Button
              className="app-header__logout"
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              {TEXT.logout}
            </Button>
          </div>
        </div>
      </Header>
      )}
      <Layout className="app-main-layout">
        {isReportingEditor ? null : (
        <Sider theme="light" className="app-sider">
          <div className="app-sider__inner">
            <div className="app-sider__title">
              <Typography.Text strong>{currentModuleTitle}</Typography.Text>
            </div>
            <div className="app-sider__menu-scroll">
              <Menu
                mode="inline"
                selectedKeys={[selectedMenuKey]}
                openKeys={openKeys}
                onOpenChange={(keys) => setOpenKeys(keys as string[])}
                items={toMenuItems(sideMenuItems)}
                className="app-menu"
              />
            </div>
          </div>
        </Sider>
        )}
        <Layout className="app-content-layout">
          <Content className="app-content">
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
