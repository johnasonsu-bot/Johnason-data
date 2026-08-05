import { http } from "./http";
import type {
  ApiEnvelope,
  FileImportFieldMapping,
  FileImportPreviewResponse,
  FileImportRun,
  FileImportRunError,
  FileImportTask,
} from "../types/api";

export interface FileImportPreviewPayload {
  parseOptions?: Record<string, unknown>;
  fileOptions?: Array<Record<string, unknown>>;
}

export interface FileImportCreatePayload extends FileImportPreviewPayload {
  taskName: string;
  taskCode?: string;
  targetSourceId: number;
  targetTable: string;
  targetTableMode?: "create" | "existing";
  writeMode?: "append" | "overwrite";
  description?: string;
  ownerName?: string;
  status?: string;
  fieldMappings?: FileImportFieldMapping[];
}

export function previewFileImports(token: string, files: File[], payload: FileImportPreviewPayload) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("config", JSON.stringify(payload || {}));
  return http<ApiEnvelope<FileImportPreviewResponse>>("/file-imports/preview", {
    method: "POST",
    body: formData,
  }, token);
}

export function createFileImportTask(token: string, files: File[], payload: FileImportCreatePayload) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("config", JSON.stringify(payload || {}));
  return http<ApiEnvelope<FileImportTask>>("/file-imports", {
    method: "POST",
    body: formData,
  }, token);
}

export function updateFileImportTask(token: string, id: number, payload: FileImportCreatePayload) {
  return http<ApiEnvelope<FileImportTask>>(`/file-imports/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchFileImportTasks(token: string, params?: { page?: number; pageSize?: number; status?: string; keyword?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.keyword) searchParams.set("keyword", params.keyword);
  const query = searchParams.toString();
  return http<ApiEnvelope<FileImportTask[]>>(`/file-imports${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchFileImportTaskById(token: string, id: number) {
  return http<ApiEnvelope<FileImportTask>>(`/file-imports/${id}`, undefined, token);
}

export function runFileImportTask(token: string, id: number) {
  return http<ApiEnvelope<{ taskId: number; runId: number }>>(`/file-imports/${id}/run`, {
    method: "POST",
  }, token);
}

export function cancelFileImportRun(token: string, taskId: number, runId: number) {
  return http<ApiEnvelope<{ taskId: number; runId: number; runStatus: string }>>(`/file-imports/${taskId}/runs/${runId}/cancel`, {
    method: "POST",
  }, token);
}

export function fetchFileImportRuns(token: string, taskId: number, limit = 20) {
  return http<ApiEnvelope<FileImportRun[]>>(`/file-imports/${taskId}/runs?limit=${limit}`, undefined, token);
}

export function fetchFileImportRunErrors(
  token: string,
  taskId: number,
  runId: number,
  params: number | { page?: number; pageSize?: number; limit?: number } = { page: 1, pageSize: 20 },
) {
  const searchParams = new URLSearchParams();
  if (typeof params === "number") {
    searchParams.set("limit", String(params));
  } else {
    if (params.page) searchParams.set("page", String(params.page));
    if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
    if (params.limit) searchParams.set("limit", String(params.limit));
  }
  const query = searchParams.toString();
  return http<ApiEnvelope<FileImportRunError[]>>(`/file-imports/${taskId}/runs/${runId}/errors${query ? `?${query}` : ""}`, undefined, token);
}

export function deleteFileImportTask(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/file-imports/${id}`, {
    method: "DELETE",
  }, token);
}

export type FileImportSuggestFieldContext = string | {
  sourceField: string;
  targetField?: string;
  columnComment?: string;
  dataType?: string;
  inferredType?: string;
  maxLength?: number;
  nullable?: boolean;
  sampleValues?: unknown[];
};

export function suggestTechnicalNames(token: string, payload: { fields: FileImportSuggestFieldContext[]; technicalNameMode?: "snake_case" | "camelCase" | "upper_snake"; modelProviderId?: number | null }) {
  return http<ApiEnvelope<{
    mode: string;
    modelConfigured?: boolean;
    fallbackReason?: "not_configured" | "model_error";
    errorMessage?: string;
    suggestions: Array<{
      sourceField: string;
      targetField?: string;
      englishName?: string;
      dataType?: string;
      columnComment?: string;
      chineseComment?: string;
      reason: string;
    }>;
  }>>("/file-imports/suggest-technical-names", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}
