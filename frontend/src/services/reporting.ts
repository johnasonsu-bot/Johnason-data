import { http } from "./http";
import type {
  ApiEnvelope,
  DataSourceColumn,
  DataSourceSampleRow,
  DataSourceTable,
  ReportingAiAnalysisSuggestionResponse,
  ReportingChartAssetRecord,
  ReportingAiChartRecommendResponse,
  ReportingAiQueryResponse,
  ReportingAiSqlPlanResponse,
  ReportingDashboardPreview,
  ReportingDashboardRecord,
  ReportingDashboardPublishConfig,
  ReportingDataSourceRecord,
  ReportingDatasetFolderRecord,
  ReportingDatasetPreview,
  ReportingDatasetRecord,
  ReportingOverview,
  ReportingThemeTemplateRecord,
} from "../types/api";

export function fetchReportingOverview(token: string) {
  return http<ApiEnvelope<ReportingOverview>>("/reporting/overview", undefined, token);
}

export function fetchReportingDataSources(token: string) {
  return http<ApiEnvelope<ReportingDataSourceRecord[]>>("/reporting/data-sources", undefined, token);
}

export function createReportingDataSource(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDataSourceRecord>>("/reporting/data-sources", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateReportingDataSource(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDataSourceRecord>>(`/reporting/data-sources/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteReportingDataSource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/reporting/data-sources/${id}`, {
    method: "DELETE",
  }, token);
}

export function testReportingDataSourceConnection(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ success: boolean; message: string; error?: string }>>("/reporting/data-sources/test-connection", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchReportingDataSourceTables(token: string, id: number) {
  return http<ApiEnvelope<DataSourceTable[]>>(`/reporting/data-sources/${id}/tables`, undefined, token);
}

export function fetchReportingDataSourceColumns(token: string, id: number, tableName: string) {
  return http<ApiEnvelope<DataSourceColumn[]>>(`/reporting/data-sources/${id}/tables/${encodeURIComponent(tableName)}/columns`, undefined, token);
}

export function fetchReportingDataSourceSampleRows(token: string, id: number, tableName: string, limit = 20) {
  return http<ApiEnvelope<DataSourceSampleRow[]>>(`/reporting/data-sources/${id}/tables/${encodeURIComponent(tableName)}/sample?limit=${limit}`, undefined, token);
}

export function fetchReportingDatasets(token: string) {
  return http<ApiEnvelope<ReportingDatasetRecord[]>>("/reporting/datasets", undefined, token);
}

export function fetchReportingDatasetFolders(token: string) {
  return http<ApiEnvelope<ReportingDatasetFolderRecord[]>>("/reporting/dataset-folders", undefined, token);
}

export function createReportingDatasetFolder(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDatasetFolderRecord>>("/reporting/dataset-folders", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateReportingDatasetFolder(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDatasetFolderRecord>>(`/reporting/dataset-folders/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteReportingDatasetFolder(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/reporting/dataset-folders/${id}`, {
    method: "DELETE",
  }, token);
}

export function previewReportingDataset(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDatasetPreview>>("/reporting/datasets/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function planReportingAiChartSql(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingAiSqlPlanResponse>>("/reporting/ai/chart/sql-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function suggestReportingAiChartAnalysis(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingAiAnalysisSuggestionResponse>>("/reporting/ai/chart/analysis-suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function reviseReportingAiChartSql(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingAiSqlPlanResponse>>("/reporting/ai/chart/sql-revise", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function runReportingAiChartQuery(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingAiQueryResponse>>("/reporting/ai/chart/query", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function recommendReportingAiChart(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingAiChartRecommendResponse>>("/reporting/ai/chart/recommend", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function allocateReportingAiChartFieldMap(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{
    provider?: {
      id: number;
      configName?: string;
      providerType?: string;
      modelName?: string;
      modelVersion?: string | null;
    } | null;
    chartAssetId: number;
    chartFamily: string;
    fieldMap: Record<string, string>;
    reason?: string;
    warning?: string | null;
    rawText?: string;
    validation?: {
      valid: boolean;
      messages: string[];
      missingRequiredKeys?: string[];
      unknownFields?: Array<{ key: string; value: string }>;
    };
  }>>("/reporting/ai/chart/field-map", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function createReportingDataset(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDatasetRecord>>("/reporting/datasets", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateReportingDataset(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDatasetRecord>>(`/reporting/datasets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteReportingDataset(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/reporting/datasets/${id}`, {
    method: "DELETE",
  }, token);
}

export function fetchReportingChartAssets(token: string) {
  return http<ApiEnvelope<ReportingChartAssetRecord[]>>("/reporting/chart-assets", undefined, token);
}

export function createReportingChartAsset(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingChartAssetRecord>>("/reporting/chart-assets", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateReportingChartAsset(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingChartAssetRecord>>(`/reporting/chart-assets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteReportingChartAsset(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/reporting/chart-assets/${id}`, {
    method: "DELETE",
  }, token);
}

export function fetchReportingThemeTemplates(token: string, shareToken?: string, dashboardId?: number) {
  if (shareToken && dashboardId) {
    return http<ApiEnvelope<ReportingThemeTemplateRecord[]>>(`/reporting/runtime/dashboards/${dashboardId}/theme-templates?shareToken=${encodeURIComponent(shareToken)}`, undefined, token);
  }
  return http<ApiEnvelope<ReportingThemeTemplateRecord[]>>("/reporting/theme-templates", undefined, token);
}

export function createReportingThemeTemplate(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingThemeTemplateRecord>>("/reporting/theme-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateReportingThemeTemplate(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingThemeTemplateRecord>>(`/reporting/theme-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteReportingThemeTemplate(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/reporting/theme-templates/${id}`, {
    method: "DELETE",
  }, token);
}

export function fetchReportingDashboards(token: string) {
  return http<ApiEnvelope<ReportingDashboardRecord[]>>("/reporting/dashboards", undefined, token);
}

export function fetchReportingDashboard(token: string, id: number) {
  return http<ApiEnvelope<ReportingDashboardRecord>>(`/reporting/dashboards/${id}`, undefined, token);
}

export function previewReportingDashboardChart(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDashboardPreview>>("/reporting/dashboards/preview-chart", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function previewReportingRuntimeDashboardChart(id: number, shareToken: string, payload: Record<string, unknown>, token?: string) {
  return http<ApiEnvelope<ReportingDashboardPreview>>(`/reporting/runtime/dashboards/${id}/preview-chart?shareToken=${encodeURIComponent(shareToken)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function createReportingDashboard(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDashboardRecord>>("/reporting/dashboards", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateReportingDashboard(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<ReportingDashboardRecord>>(`/reporting/dashboards/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteReportingDashboard(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/reporting/dashboards/${id}`, {
    method: "DELETE",
  }, token);
}

export function fetchReportingDashboardRuntime(id: number, shareToken?: string, token?: string) {
  const query = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : "";
  return http<ApiEnvelope<ReportingDashboardRecord>>(`/reporting/runtime/dashboards/${id}${query}`, undefined, token);
}

export function publishReportingDashboard(token: string, id: number, payload: ReportingDashboardPublishConfig) {
  return http<ApiEnvelope<ReportingDashboardRecord>>(`/reporting/dashboards/${id}/publish`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}
