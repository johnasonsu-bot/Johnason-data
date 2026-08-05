import { http } from "./http";
import { getSelectedProjectHeaders } from "./projectContext";
import type {
  ApiEnvelope,
  DataServiceAiConfigRecord,
  DataServiceAppRecord,
  DataServiceAuthorizationRecord,
  DataServiceDataSourceRecord,
  DataServiceLogRecord,
  DataServiceOverview,
  DataServiceRecommendResult,
  DataServiceRecord,
  DataSourceColumn,
  DataSourceSampleRow,
  DataServiceSqlPreviewResult,
  DataSourceTable,
} from "../types/api";

export function fetchDataServiceOverview(token: string) {
  return http<ApiEnvelope<DataServiceOverview>>("/data-services/overview", undefined, token);
}

export function fetchDataServiceOpsDashboard(token: string) {
  return http<ApiEnvelope<any>>("/data-services/ops-dashboard", undefined, token);
}

export function fetchDataServices(token: string) {
  return http<ApiEnvelope<DataServiceRecord[]>>("/data-services/services", undefined, token);
}

export function fetchDataServiceDataSources(token: string) {
  return http<ApiEnvelope<DataServiceDataSourceRecord[]>>("/data-services/data-sources", undefined, token);
}

export function createDataServiceDataSource(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceDataSourceRecord>>("/data-services/data-sources", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDataServiceDataSource(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceDataSourceRecord>>(`/data-services/data-sources/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDataServiceDataSource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/data-services/data-sources/${id}`, {
    method: "DELETE",
  }, token);
}

export function testDataServiceDataSourceConnection(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ success: boolean; message: string; error?: string }>>("/data-services/data-sources/test-connection", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDataServiceDataSourceTables(token: string, id: number) {
  return http<ApiEnvelope<DataSourceTable[]>>(`/data-services/data-sources/${id}/tables`, undefined, token);
}

export function fetchDataServiceDataSourceColumns(token: string, id: number, tableName: string) {
  return http<ApiEnvelope<DataSourceColumn[]>>(
    `/data-services/data-sources/${id}/tables/${encodeURIComponent(tableName)}/columns`,
    undefined,
    token
  );
}

export function fetchDataServiceDataSourceSampleRows(token: string, id: number, tableName: string, limit = 20) {
  return http<ApiEnvelope<DataSourceSampleRow[]>>(
    `/data-services/data-sources/${id}/tables/${encodeURIComponent(tableName)}/sample?limit=${limit}`,
    undefined,
    token
  );
}

export function fetchDataServiceSqlPreview(token: string, payload: { sourceId: number; sql: string }) {
  return http<ApiEnvelope<DataServiceSqlPreviewResult>>("/data-services/data-sources/sql-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function createDataService(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceRecord>>("/data-services/services", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDataService(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceRecord>>(`/data-services/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDataServiceStatus(token: string, id: number, status: "draft" | "published" | "disabled") {
  return http<ApiEnvelope<DataServiceRecord>>(`/data-services/services/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  }, token);
}

export function deleteDataService(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/data-services/services/${id}`, {
    method: "DELETE",
  }, token);
}

export function debugDataService(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ data: unknown; meta: Record<string, unknown> }>>(`/data-services/services/${id}/debug`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function recommendDataServiceConfig(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{
    modelProviderId: number;
    modelProviderName: string;
    modelName: string;
    recommendation: DataServiceRecommendResult;
  }>>("/data-services/services/recommend-config", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDataServiceAiConfigs(token: string) {
  return http<ApiEnvelope<DataServiceAiConfigRecord[]>>("/data-services/ai-configs", undefined, token);
}

export function updateDataServiceAiConfig(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceAiConfigRecord>>(`/data-services/ai-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDataServiceApps(token: string) {
  return http<ApiEnvelope<DataServiceAppRecord[]>>("/data-services/apps", undefined, token);
}

export function createDataServiceApp(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceAppRecord>>("/data-services/apps", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDataServiceApp(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceAppRecord>>(`/data-services/apps/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDataServiceApp(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/data-services/apps/${id}`, {
    method: "DELETE",
  }, token);
}

export function fetchDataServiceAuthorizations(token: string) {
  return http<ApiEnvelope<DataServiceAuthorizationRecord[]>>("/data-services/authorizations", undefined, token);
}

export function createDataServiceAuthorization(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceAuthorizationRecord>>("/data-services/authorizations", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDataServiceAuthorization(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataServiceAuthorizationRecord>>(`/data-services/authorizations/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDataServiceAuthorization(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/data-services/authorizations/${id}`, {
    method: "DELETE",
  }, token);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export async function downloadDataServiceInterfaceDoc(token: string, serviceId: number, baseUrl: string, fallbackFileName: string) {
  const response = await fetch(`${API_BASE_URL}/data-services/services/${serviceId}/docx?baseUrl=${encodeURIComponent(baseUrl)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getSelectedProjectHeaders(),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "下载失败");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers.get("content-disposition") || "";
  const matchedFileName = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)?.[1];
  link.href = url;
  link.download = decodeURIComponent(matchedFileName || fallbackFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function fetchDataServiceLogs(
  token: string,
  options?: {
    serviceId?: number;
    appId?: number;
    departmentName?: string;
    startAt?: string;
    endAt?: string;
    paramsKeyword?: string;
    limit?: number;
  }
) {
  const searchParams = new URLSearchParams();
  if (options?.serviceId) {
    searchParams.set("serviceId", String(options.serviceId));
  }
  if (options?.appId) {
    searchParams.set("appId", String(options.appId));
  }
  if (options?.departmentName) {
    searchParams.set("departmentName", options.departmentName);
  }
  if (options?.startAt) {
    searchParams.set("startAt", options.startAt);
  }
  if (options?.endAt) {
    searchParams.set("endAt", options.endAt);
  }
  if (options?.paramsKeyword) {
    searchParams.set("paramsKeyword", options.paramsKeyword);
  }
  if (options?.limit) {
    searchParams.set("limit", String(options.limit));
  }

  const query = searchParams.toString();
  return http<ApiEnvelope<DataServiceLogRecord[]>>(`/data-services/logs${query ? `?${query}` : ""}`, undefined, token);
}

export async function invokeRuntimeDataService(options: {
  path: string;
  method: "GET" | "POST";
  params?: Record<string, unknown>;
  appToken?: string;
}) {
  const normalizedPath = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const query = new URLSearchParams();
  if (options.method === "GET") {
    Object.entries(options.params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      query.set(key, typeof value === "string" ? value : JSON.stringify(value));
    });
  }

  const response = await fetch(
    `${API_BASE_URL.replace(/\/v1$/, "")}/service${normalizedPath}${query.toString() ? `?${query.toString()}` : ""}`,
    {
      method: options.method,
      headers: {
        ...(options.method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(options.appToken ? { Authorization: `Bearer ${options.appToken}` } : {}),
      },
      body: options.method === "POST" ? JSON.stringify(options.params || {}) : undefined,
    }
  );

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || "服务调用失败");
  }
  return data;
}
