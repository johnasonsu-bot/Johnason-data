import { http } from "./http";
import type {
  ApiEnvelope,
  FieldMapping,
  IncrementalConfig,
  IngestionMonitorOverviewResponse,
  IngestionTargetConfig,
  IngestionTask,
  JobRun,
  JobRunFailureAnalysisResponse,
  ScheduleConfig,
  TransformRule
} from "../types/api";

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  syncMode?: string;
  lastRunStatus?: string;
  keyword?: string;
}

export interface RecommendTaskConfigPayload {
  sourceId: number;
  sourceTable: string;
  targetSourceId: number;
  targetTable?: string;
  targetTableMode?: "existing" | "create";
  taskName?: string;
  taskCode?: string;
  ownerName?: string;
  description?: string;
}

export interface CreateTaskPayload {
  taskName: string;
  taskCode?: string;
  sourceId: number;
  sourceTable: string;
  targetSourceId: number;
  targetTable: string;
  targetTableMode: "existing" | "create";
  targetConfig?: IngestionTargetConfig;
  syncMode: string;
  status?: string;
  description?: string;
  ownerName?: string;
  scheduleEnabled?: boolean;
  fieldMappings: FieldMapping[];
  transformRules?: TransformRule[];
  incrementalConfig?: IncrementalConfig;
  sourceConfig?: Record<string, unknown>;
  parseConfig?: Record<string, unknown>;
  errorConfig?: Record<string, unknown>;
  scheduleConfig?: ScheduleConfig;
}

export interface PreviewSourcePayload {
  sourceId: number;
  sourceTable: string;
  sourceConfig?: Record<string, unknown>;
  parseConfig?: Record<string, unknown>;
  limit?: number;
}

export interface ApiDocumentParserProposal {
  summary: string;
  confidence: "high" | "medium" | "low";
  assumptions: string[];
  missingItems: string[];
  reasoning: string[];
  sourceConfig: Record<string, any>;
  parseConfig: Record<string, any>;
  errorConfig: Record<string, any>;
}

export interface ApiDocumentParserResponse {
  proposal: ApiDocumentParserProposal;
  document: { fileName: string | null; fileType: string | null; extractedTextLength: number };
  model: { providerName?: string; modelName?: string };
}

export function fetchTasks(token: string, params?: TaskListParams) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.syncMode) searchParams.set("syncMode", params.syncMode);
  if (params?.lastRunStatus) searchParams.set("lastRunStatus", params.lastRunStatus);
  if (params?.keyword) searchParams.set("keyword", params.keyword);

  const query = searchParams.toString();
  return http<ApiEnvelope<IngestionTask[]>>(`/ingestion-tasks${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchIngestionMonitorOverview(token: string, options?: { pageSize?: number; runLimit?: number }) {
  const searchParams = new URLSearchParams();
  if (options?.pageSize) searchParams.set("pageSize", String(options.pageSize));
  if (options?.runLimit) searchParams.set("runLimit", String(options.runLimit));
  const query = searchParams.toString();
  return http<ApiEnvelope<IngestionMonitorOverviewResponse>>(`/ingestion-tasks/monitor-overview${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchTaskById(token: string, id: number) {
  return http<ApiEnvelope<IngestionTask>>(`/ingestion-tasks/${id}`, undefined, token);
}

export function createTask(token: string, payload: CreateTaskPayload) {
  return http<ApiEnvelope<IngestionTask>>("/ingestion-tasks", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateTask(token: string, id: number, payload: Partial<CreateTaskPayload>) {
  return http<ApiEnvelope<IngestionTask>>(`/ingestion-tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteTask(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/ingestion-tasks/${id}`, {
    method: "DELETE"
  }, token);
}

export function startTask(token: string, id: number) {
  return http<ApiEnvelope<IngestionTask>>(`/ingestion-tasks/${id}/start`, {
    method: "POST"
  }, token);
}

export function stopTask(token: string, id: number) {
  return http<ApiEnvelope<IngestionTask>>(`/ingestion-tasks/${id}/stop`, {
    method: "POST"
  }, token);
}

export function runTaskNow(token: string, id: number) {
  return http<ApiEnvelope<IngestionTask>>(`/ingestion-tasks/${id}/run`, {
    method: "POST"
  }, token);
}

export function previewIngestionSource(token: string, payload: PreviewSourcePayload) {
  return http<ApiEnvelope<{
    sourceId: number;
    sourceName: string;
    sourceType: string;
    sourceTable: string;
    rows: Array<Record<string, unknown>>;
    totalPreviewRows: number;
  }>>("/ingestion-tasks/preview-source", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchJobRuns(token: string, taskId: number) {
  return http<ApiEnvelope<JobRun[]>>(`/ingestion-tasks/${taskId}/runs`, undefined, token);
}


export function analyzeJobRunFailure(token: string, taskId: number, runId: number, payload?: { modelProviderId?: number; note?: string }) {
  return http<ApiEnvelope<JobRunFailureAnalysisResponse>>(`/ingestion-tasks/${taskId}/runs/${runId}/analyze-failure`, {
    method: "POST",
    body: JSON.stringify(payload || {})
  }, token);
}


export function recommendTaskConfig(token: string, payload: RecommendTaskConfigPayload) {
  return http<ApiEnvelope<any>>("/ingestion-tasks/recommend-config", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function parseApiDocument(token: string, payload: { sourceId: number; inputText?: string; file?: File | null }) {
  const body = new FormData();
  body.append("sourceId", String(payload.sourceId));
  if (payload.inputText?.trim()) body.append("inputText", payload.inputText.trim());
  if (payload.file) body.append("file", payload.file);
  return http<ApiEnvelope<ApiDocumentParserResponse>>("/ingestion-tasks/parse-api-document", {
    method: "POST",
    body,
  }, token);
}

