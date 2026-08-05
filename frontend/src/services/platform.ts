import { http } from "./http";
import { getSelectedProjectHeaders } from "./projectContext";
import type {
  ApiEnvelope,
  DataSourceColumn,
  DataSourceRecord,
  DataSourceReferencedTask,
  DataSourceResearchLogRecord,
  DataSourceResearchReportComparisonRecord,
  DataSourceResearchReport,
  DataSourceResearchRunRecord,
  DataSourceResearchTaskRecord,
  DataSourceSampleRow,
  DataSourceTable,
  PlatformOverview
} from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export function fetchPlatformOverview(token: string) {
  return http<ApiEnvelope<PlatformOverview>>("/platform/overview", undefined, token);
}

export type DatabaseCapabilityStatus = {
  type: string;
  label: string;
  defaultPort: number;
  driverClassName: string;
  driverLoaded: boolean;
  dataxReaderReady: boolean;
  dataxWriterReady: boolean;
  capabilities: Record<string, boolean>;
};

export function fetchDatabaseCapabilities(token: string) {
  return http<ApiEnvelope<DatabaseCapabilityStatus[]>>("/platform/database-capabilities", undefined, token);
}

export function fetchDataSources(token: string, options?: { includeConnectivity?: boolean; ids?: number[] }) {
  const searchParams = new URLSearchParams();
  if (options?.includeConnectivity) {
    searchParams.set("includeConnectivity", "true");
  }
  if (options?.ids?.length) {
    searchParams.set("ids", Array.from(new Set(options.ids.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0))).join(","));
  }

  const query = searchParams.toString();
  return http<ApiEnvelope<DataSourceRecord[]>>(`/data-sources${query ? `?${query}` : ""}`, undefined, token);
}

export function createDataSource(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataSourceRecord>>("/data-sources", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateDataSource(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataSourceRecord>>(`/data-sources/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteDataSource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-sources/${id}`, {
    method: "DELETE"
  }, token);
}

export function testDataSourceConnection(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ success: boolean; message: string; error?: string }>>("/data-sources/test-connection", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchDataSourceTables(token: string, id: number, options?: { includeDirectories?: boolean }) {
  const searchParams = new URLSearchParams();
  if (options?.includeDirectories) searchParams.set("includeDirectories", "true");
  const query = searchParams.toString();
  return http<ApiEnvelope<DataSourceTable[]>>(`/data-sources/${id}/tables${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchDataSourceColumns(token: string, id: number, tableName: string) {
  return http<ApiEnvelope<DataSourceColumn[]>>(`/data-sources/${id}/tables/${encodeURIComponent(tableName)}/columns`, undefined, token);
}

export function fetchDataSourceSampleRows(token: string, id: number, tableName: string, limit = 20) {
  return http<ApiEnvelope<DataSourceSampleRow[]>>(`/data-sources/${id}/tables/${encodeURIComponent(tableName)}/sample?limit=${limit}`, undefined, token);
}

export function fetchDataSourceReferencedTasks(token: string, id: number) {
  return http<ApiEnvelope<DataSourceReferencedTask[]>>(`/data-sources/${id}/tasks`, undefined, token);
}

export function fetchDataSourceResearchTasks(token: string, options?: { sourceId?: number; status?: string; keyword?: string }) {
  const searchParams = new URLSearchParams();
  if (options?.sourceId) searchParams.set("sourceId", String(options.sourceId));
  if (options?.status) searchParams.set("status", options.status);
  if (options?.keyword) searchParams.set("keyword", options.keyword);
  const query = searchParams.toString();
  return http<ApiEnvelope<DataSourceResearchTaskRecord[]>>(`/data-source-research/tasks${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchDataSourceResearchTask(token: string, taskId: number) {
  return http<ApiEnvelope<DataSourceResearchTaskRecord>>(`/data-source-research/tasks/${taskId}`, undefined, token);
}

export function createDataSourceResearchTask(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataSourceResearchTaskRecord>>("/data-source-research/tasks", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateDataSourceResearchTask(token: string, taskId: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataSourceResearchTaskRecord>>(`/data-source-research/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteDataSourceResearchTask(token: string, taskId: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-source-research/tasks/${taskId}`, {
    method: "DELETE"
  }, token);
}

export function fetchDataSourceResearchTaskRuns(token: string, taskId: number) {
  return http<ApiEnvelope<DataSourceResearchRunRecord[]>>(`/data-source-research/tasks/${taskId}/runs`, undefined, token);
}

export function createDataSourceResearchTaskRun(token: string, taskId: number) {
  return http<ApiEnvelope<DataSourceResearchRunRecord>>(`/data-source-research/tasks/${taskId}/runs`, {
    method: "POST"
  }, token);
}

export function compareDataSourceResearchReports(token: string, taskId: number, payload: { baseRunId: number; targetRunId: number }) {
  return http<ApiEnvelope<DataSourceResearchReportComparisonRecord>>(`/data-source-research/tasks/${taskId}/compare`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchDataSourceResearchComparisons(token: string, taskId: number) {
  return http<ApiEnvelope<DataSourceResearchReportComparisonRecord[]>>(`/data-source-research/tasks/${taskId}/comparisons`, undefined, token);
}

export function createDataSourceResearchRun(token: string, sourceId: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataSourceResearchRunRecord>>(`/data-source-research/source/${sourceId}/runs`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchDataSourceResearchRuns(token: string, sourceId: number) {
  return http<ApiEnvelope<DataSourceResearchRunRecord[]>>(`/data-source-research/source/${sourceId}/runs`, undefined, token);
}

export function fetchDataSourceResearchRun(token: string, runId: number) {
  return http<ApiEnvelope<DataSourceResearchRunRecord>>(`/data-source-research/runs/${runId}`, undefined, token);
}

export function fetchDataSourceResearchLogs(token: string, runId: number) {
  return http<ApiEnvelope<DataSourceResearchLogRecord[]>>(`/data-source-research/runs/${runId}/logs`, undefined, token);
}

export function fetchDataSourceResearchReport(token: string, runId: number) {
  return http<ApiEnvelope<DataSourceResearchReport | null>>(`/data-source-research/runs/${runId}/report`, undefined, token);
}

export async function downloadDataSourceResearchReportWord(token: string, runId: number, fallbackFileName: string) {
  const response = await fetch(`${API_BASE_URL}/data-source-research/runs/${runId}/report.docx`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getSelectedProjectHeaders(),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "下载 Word 报告失败");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers.get("content-disposition") || "";
  const encodedFileName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainFileName = disposition.match(/filename="([^"]+)"/i)?.[1];
  link.href = url;
  link.download = encodedFileName ? decodeURIComponent(encodedFileName) : plainFileName || fallbackFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function terminateDataSourceResearchRun(token: string, runId: number) {
  return http<ApiEnvelope<DataSourceResearchRunRecord>>(`/data-source-research/runs/${runId}/terminate`, {
    method: "POST"
  }, token);
}

export function deleteDataSourceResearchRun(token: string, runId: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-source-research/runs/${runId}`, {
    method: "DELETE"
  }, token);
}
