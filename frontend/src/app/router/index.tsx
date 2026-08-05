import { Spin } from "antd";
import { Suspense, lazy, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { PlaceholderPage } from "../../pages/dashboard/PlaceholderPage";

function RouteLoadingFallback() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <Spin size="large" />
      <span style={{ color: "rgba(0, 0, 0, 0.45)" }}>页面加载中...</span>
    </div>
  );
}

const LAZY_ROUTE_RELOAD_KEY = "medata-lazy-route-reload";

function isLazyRouteImportFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
}

function reloadForLazyRouteFailure(error: unknown) {
  if (!isLazyRouteImportFailure(error)) return false;
  const fingerprint = `${window.location.pathname}${window.location.search}`;
  if (sessionStorage.getItem(LAZY_ROUTE_RELOAD_KEY) === fingerprint) {
    sessionStorage.removeItem(LAZY_ROUTE_RELOAD_KEY);
    return false;
  }
  sessionStorage.setItem(LAZY_ROUTE_RELOAD_KEY, fingerprint);
  window.setTimeout(() => window.location.reload(), 300);
  return true;
}

function lazyPage<TProps extends object = Record<string, never>>(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string
) {
  const LazyComponent = lazy(async () => {
    try {
      const mod = await loader();
      sessionStorage.removeItem(LAZY_ROUTE_RELOAD_KEY);
      return { default: mod[exportName] as ComponentType<TProps> };
    } catch (error) {
      if (reloadForLazyRouteFailure(error)) return new Promise<never>(() => undefined);
      throw error;
    }
  });

  return function LazyRouteComponent(props: TProps) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

const DataLabSceneListPage = lazyPage(() => import("../../pages/data-lab/DataLabSceneListPage"), "DataLabSceneListPage");
const DataLabSceneEditorPage = lazyPage(() => import("../../pages/data-lab/DataLabSceneEditorPage"), "DataLabSceneEditorPage");
const DataLabSchemaDesignPage = lazyPage(() => import("../../pages/data-lab/DataLabSchemaDesignPage"), "DataLabSchemaDesignPage");
const DataLabStrategyConfigPage = lazyPage(() => import("../../pages/data-lab/DataLabStrategyConfigPage"), "DataLabStrategyConfigPage");
const DataLabDataPreviewPage = lazyPage(() => import("../../pages/data-lab/DataLabDataPreviewPage"), "DataLabDataPreviewPage");
const DataLabKafkaPreviewPage = lazyPage(() => import("../../pages/data-lab/DataLabKafkaPreviewPage"), "DataLabKafkaPreviewPage");
const DataLabRunLogPage = lazyPage(() => import("../../pages/data-lab/DataLabRunLogPage"), "DataLabRunLogPage");
const DataLabQualityReportPage = lazyPage(() => import("../../pages/data-lab/DataLabQualityReportPage"), "DataLabQualityReportPage");
const DataLabResultQueryPage = lazyPage(() => import("../../pages/data-lab/DataLabResultQueryPage"), "DataLabResultQueryPage");
const DataLabSceneWorkspacePage = lazyPage(() => import("../../pages/data-lab/DataLabSceneWorkspacePage"), "DataLabSceneWorkspacePage");
const DataLabOpsDashboardPage = lazyPage(() => import("../../pages/data-lab/DataLabOpsDashboardPage"), "DataLabOpsDashboardPage");
const DataLabIndustryIncubationPage = lazyPage(() => import("../../pages/data-lab/DataLabIndustryIncubationPage"), "DataLabIndustryIncubationPage");
const DataLabModelOverviewPage = lazyPage(() => import("../../pages/data-lab/DataLabModelOverviewPage"), "DataLabModelOverviewPage");
const DataLabPromptManagementPage = lazyPage(() => import("../../pages/data-lab/DataLabPromptManagementPage"), "DataLabPromptManagementPage");
const AiBusinessDataGenerationPage = lazyPage(() => import("../../pages/data-lab/scenario-management/AiBusinessDataGenerationPage"), "AiBusinessDataGenerationPage");
const LogicalModelListPage = lazyPage(() => import("../../pages/data-lab/scenario-management/LogicalModelListPage"), "LogicalModelListPage");
const PhysicalModelListPage = lazyPage(() => import("../../pages/data-lab/scenario-management/PhysicalModelListPage"), "PhysicalModelListPage");
const ScenarioIndustryDataSourceDetailPage = lazyPage(() => import("../../pages/data-lab/scenario-management/ScenarioIndustryDataSourceDetailPage"), "ScenarioIndustryDataSourceDetailPage");
const ScenarioInstanceDetailPage = lazyPage(() => import("../../pages/data-lab/scenario-management/ScenarioInstanceDetailPage"), "ScenarioInstanceDetailPage");
const ScenarioTemplateDetailPage = lazyPage(() => import("../../pages/data-lab/scenario-management/ScenarioTemplateDetailPage"), "ScenarioTemplateDetailPage");
const SimulationDataPage = lazyPage(() => import("../../pages/data-lab/scenario-management/SimulationDataPage"), "SimulationDataPage");
const QualityControlAnalysisPage = lazyPage(() => import("../../pages/quality-control/QualityControlAnalysisPage"), "QualityControlAnalysisPage");
const QualityControlInsightsPage = lazyPage(() => import("../../pages/quality-control/QualityControlInsightsPage"), "QualityControlInsightsPage");
const QualityControlIssuesPage = lazyPage(() => import("../../pages/quality-control/QualityControlIssuesPage"), "QualityControlIssuesPage");
const QualityControlReportsPage = lazyPage(() => import("../../pages/quality-control/QualityControlReportsPage"), "QualityControlReportsPage");
const QualityControlModelManagementPage = lazyPage(() => import("../../pages/quality-control/QualityControlModelManagementPage"), "QualityControlModelManagementPage");
const QualityControlRulesPage = lazyPage(() => import("../../pages/quality-control/QualityControlRulesPage"), "QualityControlRulesPage");
const QualityControlSourcesPage = lazyPage(() => import("../../pages/quality-control/QualityControlSourcesPage"), "QualityControlSourcesPage");
const QualityControlStrategiesPage = lazyPage(() => import("../../pages/quality-control/QualityControlStrategiesPage"), "QualityControlStrategiesPage");
const QualityControlTasksPage = lazyPage(() => import("../../pages/quality-control/QualityControlTasksPage"), "QualityControlTasksPage");
const ReportingChartLibraryPage = lazyPage(() => import("../../pages/reporting/ReportingChartLibraryPage"), "ReportingChartLibraryPage");
const ReportingDataSourcesPage = lazyPage(() => import("../../pages/reporting/ReportingDataSourcesPage"), "ReportingDataSourcesPage");
const ReportingDatasetsPage = lazyPage(() => import("../../pages/reporting/ReportingDatasetsPage"), "ReportingDatasetsPage");
const ReportingDashboardEditorPage = lazyPage(() => import("../../pages/reporting/ReportingDashboardEditorPage"), "ReportingDashboardEditorPage");
const ReportingModelManagementPage = lazyPage(() => import("../../pages/reporting/ReportingModelManagementPage"), "ReportingModelManagementPage");
const ReportingOverviewPage = lazyPage(() => import("../../pages/reporting/ReportingOverviewPage"), "ReportingOverviewPage");
const ReportingThemeTemplateCenterPage = lazyPage(() => import("../../pages/reporting/ReportingThemeTemplateCenterPage"), "ReportingThemeTemplateCenterPage");
const ReportingThemeTemplateEditorPage = lazyPage(() => import("../../pages/reporting/ReportingThemeTemplateEditorPage"), "ReportingThemeTemplateEditorPage");
const ReportingThemeTemplateRelationsPage = lazyPage(() => import("../../pages/reporting/ReportingThemeTemplateRelationsPage"), "ReportingThemeTemplateRelationsPage");
const ReportingWorkbenchPage = lazyPage(() => import("../../pages/reporting/ReportingWorkbenchPage"), "ReportingWorkbenchPage");
const DataDevelopmentPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentPage"), "DataDevelopmentPage");
const DataDevelopmentModelManagementPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentModelManagementPage"), "DataDevelopmentModelManagementPage");
const DataDevelopmentOrchestrationEditorPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentOrchestrationEditorPage"), "DataDevelopmentOrchestrationEditorPage");
const DataDevelopmentOrchestrationPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentOrchestrationPage"), "DataDevelopmentOrchestrationPage");
const DataDevelopmentProcessingPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentProcessingPage"), "DataDevelopmentProcessingPage");
const DataDevelopmentSchedulingPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentSchedulingPage"), "DataDevelopmentSchedulingPage");
const DataDevelopmentSqlTasksPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentSqlTasksPage"), "DataDevelopmentSqlTasksPage");
const DataDevelopmentWorkbench2Page = lazyPage(() => import("../../pages/data-development/DataDevelopmentWorkbench2Page"), "DataDevelopmentWorkbench2Page");
const DataDevelopmentWorkflowEditorPage = lazyPage(() => import("../../pages/data-development/DataDevelopmentWorkflowEditorPage"), "DataDevelopmentWorkflowEditorPage");
const DataServicesPage = lazyPage(() => import("../../pages/data-services/DataServicesPage"), "DataServicesPage");
const DataServiceOpsDashboardPage = lazyPage(() => import("../../pages/data-services/DataServiceOpsDashboardPage"), "DataServiceOpsDashboardPage");
const DataServiceModelManagementPage = lazyPage(() => import("../../pages/data-services/DataServiceModelManagementPage"), "DataServiceModelManagementPage");
const DataServiceUsagePage = lazyPage(() => import("../../pages/data-services/DataServiceUsagePage"), "DataServiceUsagePage");
const DataServiceUsageEditorPage = lazyPage(() => import("../../pages/data-services/DataServiceUsageEditorPage"), "DataServiceUsageEditorPage");
const DataServiceWorkspacePage = lazyPage(() => import("../../pages/data-services/DataServiceWorkspacePage"), "DataServiceWorkspacePage");
const AssetSearchPage = lazyPage(() => import("../../pages/asset-search/AssetSearchPage"), "AssetSearchPage");
const AssetSearchModelManagementPage = lazyPage(() => import("../../pages/asset-search/AssetSearchModelManagementPage"), "AssetSearchModelManagementPage");
const BusinessDataSearchPage = lazyPage(() => import("../../pages/asset-search/BusinessDataSearchPage"), "BusinessDataSearchPage");
const DataMapModelManagementPage = lazyPage(() => import("../../pages/data-map/DataMapModelManagementPage"), "DataMapModelManagementPage");
const DataMapPage = lazyPage<{ section: "departments" | "systems" | "sources" | "resources" }>(() => import("../../pages/data-map/DataMapPage"), "DataMapPage");
const DataMapResourceDetailPage = lazyPage(() => import("../../pages/data-map/DataMapResourceDetailPage"), "DataMapResourceDetailPage");
const DataStandardsPage = lazyPage<{ section: "overview" | "catalogs" | "elements" | "value-domains" | "references" | "mappings" | "models" }>(() => import("../../pages/data-standards/DataStandardsPage"), "DataStandardsPage");
const SystemModelProvidersPage = lazyPage(() => import("../../pages/system/SystemModelProvidersPage"), "SystemModelProvidersPage");
const SystemProjectManagementPage = lazyPage(() => import("../../pages/system/SystemProjectManagementPage"), "SystemProjectManagementPage");
const SystemServiceManagementPage = lazyPage(() => import("../../pages/system/SystemServiceManagementPage"), "SystemServiceManagementPage");
const SystemDatabaseDriversPage = lazyPage(() => import("../../pages/system/SystemDatabaseDriversPage"), "SystemDatabaseDriversPage");
const SystemUserManagementPage = lazyPage(() => import("../../pages/system/SystemUserManagementPage"), "SystemUserManagementPage");
const SystemRoleManagementPage = lazyPage(() => import("../../pages/system/SystemRoleManagementPage"), "SystemRoleManagementPage");
const SystemKnowledgeBasePage = lazyPage(() => import("../../pages/system/SystemKnowledgeBasePage"), "SystemKnowledgeBasePage");
const LoginPage = lazyPage(() => import("../../pages/auth/LoginPage"), "LoginPage");
const OverviewPage = lazyPage(() => import("../../pages/dashboard/OverviewPage"), "OverviewPage");
const DataSourcesPage = lazyPage(() => import("../../pages/data-sources/DataSourcesPage"), "DataSourcesPage");
const DataSourceResearchPage = lazyPage(() => import("../../pages/data-source-research/DataSourceResearchPage"), "DataSourceResearchPage");
const DataSourceResearchDetailPage = lazyPage(() => import("../../pages/data-source-research/DataSourceResearchDetailPage"), "DataSourceResearchDetailPage");
const DataIngestionJobsPage = lazyPage(() => import("../../pages/data-ingestion-jobs/DataIngestionJobsPage"), "DataIngestionJobsPage");
const TaskConfigPage = lazyPage(() => import("../../pages/data-ingestion-jobs/TaskConfigPage"), "TaskConfigPage");
const DataIngestionMonitorPage = lazyPage(() => import("../../pages/data-ingestion-monitor/DataIngestionMonitorPage"), "DataIngestionMonitorPage");
const IngestionAiManagementPage = lazyPage(() => import("../../pages/data-ingestion-monitor/IngestionAiManagementPage"), "IngestionAiManagementPage");
const FileImportTasksPage = lazyPage(() => import("../../pages/data-file-imports/FileImportTasksPage"), "FileImportTasksPage");
const FileImportCreatePage = lazyPage(() => import("../../pages/data-file-imports/FileImportCreatePage"), "FileImportCreatePage");
const ReportingDashboardPreviewPage = lazyPage(() => import("../../pages/reporting/ReportingDashboardPreviewPage"), "ReportingDashboardPreviewPage");
const TEXT = {
  processingTitle: "数据处理",
  processingDesc: "这里预留 ETL 编排、规则引擎、任务调度和质量校验等处理能力入口。",
  rulesTitle: "规则校验",
  rulesDesc: "这里预留字段规则、质量校验、标准映射和校验结果追踪能力。",
  scheduleTitle: "调度管理",
  scheduleDesc: "这里预留任务编排、依赖关系、执行窗口和调度历史能力。",
  servicesTitle: "数据服务",
  servicesDesc: "这里预留 API 发布、服务目录、权限审批和调用监控能力。",
  publishTitle: "授权审批",
  publishDesc: "这里预留服务授权审批、应用访问控制、Token 调用和权限回收能力。",
  auditTitle: "服务审计",
  auditDesc: "这里预留服务调用日志、审计留痕、访问分析和告警追踪能力。",
  reportingOverviewTitle: "报表概览",
  reportingOverviewDesc: "这里统一展示报表平台的数据源、数据集、图表资产和仪表板规模。",
};

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/reporting/runtime/:id",
    element: <ReportingDashboardPreviewPage />,
  },
  {
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/dashboard",
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview", element: <OverviewPage /> },
          { path: "data-sources", element: <DataSourcesPage /> },
          { path: "data-source-research", element: <DataSourceResearchPage /> },
          { path: "data-source-research/:taskId", element: <DataSourceResearchDetailPage /> },
          { path: "data-development/datasources", element: <DataDevelopmentPage /> },
          { path: "data-development/workbench", element: <Navigate to="/dashboard/data-development/workbench2" replace /> },
          { path: "data-development/workbench2", element: <DataDevelopmentWorkbench2Page /> },
          { path: "data-development/sql-tasks", element: <DataDevelopmentSqlTasksPage /> },
          { path: "data-development/processing", element: <DataDevelopmentProcessingPage /> },
          { path: "data-development/processing/:jobId", element: <DataDevelopmentProcessingPage /> },
          { path: "data-development/orchestration", element: <Navigate to="/dashboard/data-development/operator-platform" replace /> },
          { path: "data-development/orchestration/:id/edit", element: <DataDevelopmentOrchestrationEditorPage /> },
          { path: "data-development/operator-platform", element: <DataDevelopmentOrchestrationPage /> },
          { path: "data-development/operator-platform/:id/edit", element: <DataDevelopmentOrchestrationEditorPage /> },
          { path: "data-development/scheduling", element: <DataDevelopmentSchedulingPage /> },
          { path: "data-development/scheduling/:id/edit", element: <DataDevelopmentWorkflowEditorPage /> },
          { path: "data-development/models", element: <DataDevelopmentModelManagementPage /> },
          { path: "data-development/instances", element: <Navigate to="/dashboard/data-development/scheduling?tab=instances" replace /> },
          { path: "asset-search", element: <AssetSearchPage /> },
          { path: "asset-search/business-data", element: <BusinessDataSearchPage /> },
          { path: "asset-search/models", element: <AssetSearchModelManagementPage /> },
          { path: "data-map", element: <Navigate to="/dashboard/data-map/resources" replace /> },
          { path: "data-map/search", element: <Navigate to="/dashboard/asset-search" replace /> },
          { path: "data-map/departments", element: <DataMapPage section="departments" /> },
          { path: "data-map/systems", element: <DataMapPage section="systems" /> },
          { path: "data-map/sources", element: <DataMapPage section="sources" /> },
          { path: "data-map/resources", element: <DataMapPage section="resources" /> },
          { path: "data-map/resources/:id", element: <DataMapResourceDetailPage /> },
          { path: "data-map/models", element: <DataMapModelManagementPage /> },
          { path: "data-standards", element: <Navigate to="/dashboard/data-standards/overview" replace /> },
          { path: "data-standards/overview", element: <DataStandardsPage section="overview" /> },
          { path: "data-standards/catalogs", element: <DataStandardsPage section="catalogs" /> },
          { path: "data-standards/elements", element: <DataStandardsPage section="elements" /> },
          { path: "data-standards/value-domains", element: <DataStandardsPage section="value-domains" /> },
          { path: "data-standards/references", element: <DataStandardsPage section="references" /> },
          { path: "data-standards/mappings", element: <DataStandardsPage section="mappings" /> },
          { path: "data-standards/models", element: <DataStandardsPage section="models" /> },
          { path: "data-ingestion-jobs", element: <DataIngestionJobsPage /> },
          { path: "data-ingestion-jobs/create", element: <TaskConfigPage /> },
          { path: "data-ingestion-jobs/:id/edit", element: <TaskConfigPage /> },
          { path: "data-ingestion-monitor", element: <DataIngestionMonitorPage /> },
          { path: "data-file-imports", element: <FileImportTasksPage /> },
          { path: "data-file-imports/create", element: <FileImportCreatePage /> },
          { path: "data-file-imports/:id/edit", element: <FileImportCreatePage /> },
          { path: "data-ingestion-ai", element: <IngestionAiManagementPage /> },
          { path: "quality-control", element: <Navigate to="/dashboard/quality-control/data-sources" replace /> },
          { path: "quality-control/data-sources", element: <QualityControlSourcesPage /> },
          { path: "quality-control/rules", element: <QualityControlRulesPage /> },
          { path: "quality-control/models", element: <QualityControlModelManagementPage /> },
          { path: "quality-control/strategies", element: <QualityControlStrategiesPage /> },
          { path: "quality-control/strategies/:monitorTableId", element: <QualityControlStrategiesPage /> },
          { path: "quality-control/tasks", element: <QualityControlTasksPage /> },
          { path: "quality-control/analysis", element: <QualityControlAnalysisPage /> },
          { path: "quality-control/insights", element: <QualityControlInsightsPage /> },
          { path: "quality-control/issues", element: <QualityControlIssuesPage /> },
          { path: "quality-control/reports", element: <QualityControlReportsPage /> },
          { path: "processing", element: <PlaceholderPage title={TEXT.processingTitle} description={TEXT.processingDesc} /> },
          { path: "processing-rules", element: <PlaceholderPage title={TEXT.rulesTitle} description={TEXT.rulesDesc} /> },
          { path: "processing-schedule", element: <PlaceholderPage title={TEXT.scheduleTitle} description={TEXT.scheduleDesc} /> },
          { path: "service-data-sources", element: <DataServicesPage /> },
          { path: "service-ops", element: <DataServiceOpsDashboardPage /> },
          { path: "service-usage", element: <DataServiceUsagePage /> },
          { path: "service-usage/:taskKey/edit", element: <DataServiceUsageEditorPage /> },
          { path: "services/create", element: <DataServiceWorkspacePage /> },
          { path: "services/:id/edit", element: <DataServiceWorkspacePage /> },
          { path: "services", element: <DataServicesPage /> },
          { path: "service-apps", element: <DataServicesPage /> },
          { path: "service-authorizations", element: <DataServicesPage /> },
          { path: "service-publish", element: <Navigate to="/dashboard/service-authorizations" replace /> },
          { path: "service-audit", element: <DataServicesPage /> },
          { path: "service-models", element: <DataServiceModelManagementPage /> },

          { path: "reporting", element: <Navigate to="/dashboard/reporting/overview" replace /> },
          { path: "reporting/overview", element: <ReportingOverviewPage /> },
          { path: "reporting/data-sources", element: <ReportingDataSourcesPage /> },
          { path: "reporting/datasets", element: <ReportingDatasetsPage /> },
          { path: "reporting/workbench", element: <ReportingWorkbenchPage /> },
          { path: "reporting/workbench/create", element: <ReportingDashboardEditorPage /> },
          { path: "reporting/workbench/:id/edit", element: <ReportingDashboardEditorPage /> },
          { path: "reporting/chart-library", element: <ReportingChartLibraryPage /> },
          { path: "reporting/models", element: <ReportingModelManagementPage /> },
          { path: "reporting/theme-templates", element: <ReportingThemeTemplateCenterPage /> },
          { path: "reporting/theme-templates/create", element: <ReportingThemeTemplateEditorPage /> },
          { path: "reporting/theme-templates/:id/edit", element: <ReportingThemeTemplateEditorPage /> },
          { path: "reporting/theme-templates/relations", element: <ReportingThemeTemplateRelationsPage /> },

          { path: "data-modeling", element: <Navigate to="/dashboard/data-modeling/model-overview" replace /> },
          { path: "data-modeling/data-sources", element: <Navigate to="/dashboard/data-modeling/simulation" replace /> },
          { path: "data-modeling/model-overview", element: <DataLabModelOverviewPage /> },
          { path: "data-modeling/research", element: <DataLabIndustryIncubationPage /> },
          { path: "data-modeling/incubations", element: <Navigate to="/dashboard/data-modeling/research" replace /> },
          { path: "data-modeling/logical-models", element: <LogicalModelListPage /> },
          { path: "data-modeling/logical-models/:id", element: <ScenarioTemplateDetailPage /> },
          { path: "data-modeling/physical-models", element: <PhysicalModelListPage /> },
          { path: "data-modeling/physical-models/:id", element: <ScenarioInstanceDetailPage /> },
          { path: "data-modeling/simulation", element: <SimulationDataPage /> },
          { path: "data-modeling/ai-business-data", element: <AiBusinessDataGenerationPage /> },
          { path: "data-modeling/simulation/instances/:id", element: <ScenarioInstanceDetailPage /> },
          { path: "data-modeling/simulation/datasets/:id", element: <ScenarioIndustryDataSourceDetailPage /> },
          { path: "data-modeling/scenario-management", element: <Navigate to="/dashboard/data-modeling/logical-models" replace /> },
          { path: "data-modeling/scenario-management/templates/:id", element: <ScenarioTemplateDetailPage /> },
          { path: "data-modeling/scenario-management/instances/:id", element: <ScenarioInstanceDetailPage /> },
          { path: "data-modeling/scenario-management/data-sources/:id", element: <ScenarioIndustryDataSourceDetailPage /> },

          { path: "data-modeling/kb", element: <Navigate to="/dashboard/data-modeling/scenes" replace /> },
          { path: "data-modeling/kb/:id", element: <Navigate to="/dashboard/data-modeling/scenes" replace /> },
          { path: "data-modeling/scenes", element: <DataLabSceneListPage /> },
          { path: "data-modeling/scene-editor", element: <DataLabSceneEditorPage /> },
          { path: "data-modeling/scene-editor/:id", element: <DataLabSceneEditorPage /> },
          { path: "data-modeling/schema/:id", element: <DataLabSchemaDesignPage /> },
          { path: "data-modeling/strategy/:id", element: <DataLabStrategyConfigPage /> },
          { path: "data-modeling/result-query/:id", element: <DataLabResultQueryPage /> },
          { path: "data-modeling/data-preview/:id", element: <DataLabDataPreviewPage /> },
          { path: "data-modeling/kafka-preview/:id", element: <DataLabKafkaPreviewPage /> },
          { path: "data-modeling/run-log/:id", element: <DataLabRunLogPage /> },
          { path: "data-modeling/quality/:id", element: <DataLabQualityReportPage /> },
          { path: "data-modeling/scenes/:id", element: <DataLabSceneWorkspacePage /> },
          { path: "data-modeling/ops", element: <DataLabOpsDashboardPage /> },
          { path: "data-modeling/prompts", element: <DataLabPromptManagementPage /> },
          { path: "data-modeling/models", element: <Navigate to="/dashboard/data-modeling/prompts" replace /> },
          { path: "data-modeling/enhancements", element: <Navigate to="/dashboard/data-modeling/scenes" replace /> },

          { path: "system-services", element: <SystemServiceManagementPage /> },
          { path: "system-database-drivers", element: <SystemDatabaseDriversPage /> },
          { path: "system-users", element: <SystemUserManagementPage /> },
          { path: "system-roles", element: <SystemRoleManagementPage /> },
          { path: "system-models", element: <SystemModelProvidersPage /> },
          { path: "system-projects", element: <SystemProjectManagementPage /> },
          { path: "system-knowledge-bases/industry", element: <SystemKnowledgeBasePage /> },
          { path: "system-knowledge-bases/platform", element: <SystemKnowledgeBasePage /> },
          { path: "system-knowledge-bases/personal", element: <SystemKnowledgeBasePage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
