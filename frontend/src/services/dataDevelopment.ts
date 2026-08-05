import { http } from "./http";
import { getSelectedProjectHeaders } from "./projectContext";
import type {
  ApiEnvelope,
  DevColumnEntry,
  DevDatabaseEntry,
  DevDatasourceRecord,
  DevJobInstanceRecord,
  DevJobLogRecord,
  DevOrchestrationNodePreview,
  DevOrchestrationRunResult,
  DevOrchestrationTaskRecord,
  DevProcessingJobRecord,
  DevProcessingPreviewResult,
  DevProcessingRunRecord,
  DevOrchestrationSqlPreview,
  DevQueryExecutionResult,
  DevQueryHistoryRecord,
  DevRoutineEntry,
  DevSqlCopilotResponse,
  DevSqlCopilotMessage,
  DevSqlCopilotProcessStep,
  DevSqlCopilotSession,
  DevScriptFolderRecord,
  DevScriptRecord,
  DevScriptVersionRecord,
  DevTableEntry,
  DevWorkflowRecord,
  DevWorkflowRunRecord,
  DevWorkflowValidationResult,
} from "../types/api";

const BASE = "/data-development";

export function fetchDevDatasources(token: string) {
  return http<ApiEnvelope<DevDatasourceRecord[]>>(`${BASE}/datasources`, undefined, token);
}

export function fetchDevDatasource(token: string, id: number) {
  return http<ApiEnvelope<DevDatasourceRecord>>(`${BASE}/datasources/${id}`, undefined, token);
}

export function createDevDatasource(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevDatasourceRecord>>(`${BASE}/datasources`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDevDatasource(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevDatasourceRecord>>(`${BASE}/datasources/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDevDatasource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`${BASE}/datasources/${id}`, {
    method: "DELETE",
  }, token);
}

export function testDevDatasource(token: string, id: number) {
  return http<ApiEnvelope<{ success: boolean; message: string }>>(`${BASE}/datasources/${id}/test`, {
    method: "POST",
    body: JSON.stringify({}),
  }, token);
}

export function testDevDatasourceConfig(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ success: boolean; message: string }>>(`${BASE}/datasources/test`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDevDatabases(token: string, datasourceId: number) {
  return http<ApiEnvelope<DevDatabaseEntry[]>>(`${BASE}/datasources/${datasourceId}/databases`, undefined, token);
}

export function fetchDevTables(token: string, datasourceId: number, databaseName?: string) {
  const query = databaseName ? `?databaseName=${encodeURIComponent(databaseName)}` : "";
  return http<ApiEnvelope<DevTableEntry[]>>(`${BASE}/datasources/${datasourceId}/tables${query}`, undefined, token);
}

export function fetchDevColumns(token: string, datasourceId: number, databaseName: string | undefined, tableName: string) {
  const searchParams = new URLSearchParams();
  if (databaseName) searchParams.set("databaseName", databaseName);
  searchParams.set("tableName", tableName);
  return http<ApiEnvelope<DevColumnEntry[]>>(`${BASE}/datasources/${datasourceId}/columns?${searchParams.toString()}`, undefined, token);
}

export function fetchDevFunctions(token: string, datasourceId: number, databaseName?: string) {
  const query = databaseName ? `?databaseName=${encodeURIComponent(databaseName)}` : "";
  return http<ApiEnvelope<DevRoutineEntry[]>>(`${BASE}/datasources/${datasourceId}/functions${query}`, undefined, token);
}

export function executeDevQuery(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevQueryExecutionResult>>(`${BASE}/queries/execute`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDevQueryHistory(token: string, params?: { datasourceId?: number; scriptId?: number; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.datasourceId) searchParams.set("datasourceId", String(params.datasourceId));
  if (params?.scriptId) searchParams.set("scriptId", String(params.scriptId));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  return http<ApiEnvelope<DevQueryHistoryRecord[]>>(`${BASE}/queries/history${query ? `?${query}` : ""}`, undefined, token);
}

export function runDevSqlCopilot(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevSqlCopilotResponse>>(`${BASE}/copilot`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDevSqlCopilotSessions(token: string) {
  return http<ApiEnvelope<DevSqlCopilotSession[]>>(`${BASE}/copilot/sessions`, undefined, token);
}

export function fetchDevSqlCopilotSessionMessages(token: string, sessionId: number) {
  return http<ApiEnvelope<{ session: DevSqlCopilotSession; messages: DevSqlCopilotMessage[] }>>(
    `${BASE}/copilot/sessions/${sessionId}/messages`,
    undefined,
    token
  );
}

export async function runDevSqlCopilotStream(
  token: string,
  payload: Record<string, unknown>,
  handlers: {
    onSession?: (data: { sessionId: number }) => void;
    onProgress?: (data: DevSqlCopilotProcessStep) => void;
    onMeta?: (data: {
      taskType: string;
      provider: DevSqlCopilotResponse["provider"];
      referencedTables: string[];
      metadataTables: DevSqlCopilotResponse["metadataTables"];
      sampledTables: DevSqlCopilotResponse["sampledTables"];
    }) => void;
    onDelta?: (delta: string) => void;
    onDone?: (data: {
      sessionId: number | null;
      assistantMessage: DevSqlCopilotMessage | null;
      result: DevSqlCopilotResponse;
    }) => void;
  },
  options?: {
    signal?: AbortSignal;
  }
) {
  const response = await fetch(`/api/v1${BASE}/copilot/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...getSelectedProjectHeaders(),
    },
    signal: options?.signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    let parsed: { message?: string } = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    throw new Error(parsed?.message || "智能辅助流式调用失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const event = JSON.parse(trimmed);
      if (event.type === "meta") {
        handlers.onMeta?.(event.data);
      } else if (event.type === "session") {
        handlers.onSession?.(event.data);
      } else if (event.type === "progress") {
        handlers.onProgress?.(event.data);
      } else if (event.type === "delta") {
        handlers.onDelta?.(event.delta || "");
      } else if (event.type === "error") {
        throw new Error(event.message || "智能辅助流式调用失败");
      } else if (event.type === "done") {
        handlers.onDone?.(event.data);
      }
    }
  }
}

export function fetchDevScriptFolders(token: string) {
  return http<ApiEnvelope<DevScriptFolderRecord[]>>(`${BASE}/script-folders`, undefined, token);
}

export function createDevScriptFolder(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevScriptFolderRecord>>(`${BASE}/script-folders`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDevScriptFolder(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevScriptFolderRecord>>(`${BASE}/script-folders/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDevScriptFolder(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`${BASE}/script-folders/${id}`, {
    method: "DELETE",
  }, token);
}

export function fetchDevScripts(token: string, params?: { folderId?: number; keyword?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.folderId) searchParams.set("folderId", String(params.folderId));
  if (params?.keyword) searchParams.set("keyword", params.keyword);
  const query = searchParams.toString();
  return http<ApiEnvelope<DevScriptRecord[]>>(`${BASE}/scripts${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchDevScript(token: string, id: number) {
  return http<ApiEnvelope<DevScriptRecord>>(`${BASE}/scripts/${id}`, undefined, token);
}

export function createDevScript(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevScriptRecord>>(`${BASE}/scripts`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDevScript(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevScriptRecord>>(`${BASE}/scripts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDevScript(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`${BASE}/scripts/${id}`, {
    method: "DELETE",
  }, token);
}

export function saveDevScriptVersion(token: string, id: number) {
  return http<ApiEnvelope<DevScriptRecord>>(`${BASE}/scripts/${id}/save-version`, {
    method: "POST",
    body: JSON.stringify({}),
  }, token);
}

export function fetchDevScriptVersions(token: string, id: number) {
  return http<ApiEnvelope<DevScriptVersionRecord[]>>(`${BASE}/scripts/${id}/versions`, undefined, token);
}

export function saveDevScriptAs(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevScriptRecord>>(`${BASE}/scripts/${id}/save-as`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDevWorkflows(token: string) {
  return http<ApiEnvelope<DevWorkflowRecord[]>>(`${BASE}/scheduling/workflows`, undefined, token);
}

export function fetchDevOrchestrations(token: string) {
  return http<ApiEnvelope<DevOrchestrationTaskRecord[]>>(`${BASE}/operator-tasks`, undefined, token);
}

export function fetchDevProcessingJobs(token: string, params?: { keyword?: string; datasourceId?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.keyword) searchParams.set("keyword", params.keyword);
  if (params?.datasourceId) searchParams.set("datasourceId", String(params.datasourceId));
  const query = searchParams.toString();
  return http<ApiEnvelope<DevProcessingJobRecord[]>>(`${BASE}/processing/jobs${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchDevProcessingJob(token: string, id: number) {
  return http<ApiEnvelope<DevProcessingJobRecord>>(`${BASE}/processing/jobs/${id}`, undefined, token);
}

export function previewDevProcessingDraft(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevProcessingPreviewResult>>(`${BASE}/processing/jobs/preview`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function createDevProcessingJob(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevProcessingJobRecord>>(`${BASE}/processing/jobs`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDevProcessingJob(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevProcessingJobRecord>>(`${BASE}/processing/jobs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDevProcessingJob(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`${BASE}/processing/jobs/${id}`, {
    method: "DELETE",
  }, token);
}

export function previewDevProcessingJob(token: string, id: number) {
  return http<ApiEnvelope<DevProcessingPreviewResult>>(`${BASE}/processing/jobs/${id}/preview`, {
    method: "POST",
    body: JSON.stringify({}),
  }, token);
}

export function runDevProcessingJob(token: string, id: number, payload?: Record<string, unknown>) {
  return http<ApiEnvelope<DevProcessingRunRecord>>(`${BASE}/processing/jobs/${id}/run`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  }, token);
}

export function fetchDevProcessingJobRuns(token: string, id: number) {
  return http<ApiEnvelope<DevProcessingRunRecord[]>>(`${BASE}/processing/jobs/${id}/runs`, undefined, token);
}

export function fetchDevOrchestration(token: string, id: number) {
  return http<ApiEnvelope<DevOrchestrationTaskRecord>>(`${BASE}/operator-tasks/${id}`, undefined, token);
}

export function createDevOrchestration(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevOrchestrationTaskRecord>>(`${BASE}/operator-tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDevOrchestration(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevOrchestrationTaskRecord>>(`${BASE}/operator-tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDevOrchestration(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`${BASE}/operator-tasks/${id}`, {
    method: "DELETE",
  }, token);
}

export function saveDevOrchestrationGraph(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevOrchestrationTaskRecord>>(`${BASE}/operator-tasks/${id}/graph`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchDevOrchestrationSqlPreview(token: string, id: number) {
  return http<ApiEnvelope<DevOrchestrationSqlPreview>>(`${BASE}/operator-tasks/${id}/sql-preview`, undefined, token);
}

export function fetchDevOrchestrationNodePreview(token: string, id: number, nodeKey: string, limit = 20) {
  return http<ApiEnvelope<DevOrchestrationNodePreview>>(
    `${BASE}/operator-tasks/${id}/nodes/${encodeURIComponent(nodeKey)}/preview?limit=${limit}`,
    undefined,
    token
  );
}

export function runDevOrchestration(token: string, id: number) {
  return http<ApiEnvelope<DevOrchestrationRunResult>>(`${BASE}/operator-tasks/${id}/run`, {
    method: "POST",
    body: JSON.stringify({}),
  }, token);
}

export function fetchDevWorkflow(token: string, id: number) {
  return http<ApiEnvelope<DevWorkflowRecord>>(`${BASE}/scheduling/workflows/${id}`, undefined, token);
}

export function createDevWorkflow(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevWorkflowRecord>>(`${BASE}/scheduling/workflows`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function createDevWorkflowFromTask(
  token: string,
  payload: { taskType: "script" | "processing" | "operator_task"; taskId: number; name?: string }
) {
  return http<ApiEnvelope<DevWorkflowRecord>>(`${BASE}/scheduling/workflows/from-task`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateDevWorkflow(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevWorkflowRecord>>(`${BASE}/scheduling/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteDevWorkflow(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`${BASE}/scheduling/workflows/${id}`, {
    method: "DELETE",
  }, token);
}

export function saveDevWorkflowGraph(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DevWorkflowRecord>>(`${BASE}/scheduling/workflows/${id}/graph`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function validateDevWorkflow(token: string, id: number) {
  return http<ApiEnvelope<DevWorkflowValidationResult>>(`${BASE}/scheduling/workflows/${id}/validate`, {
    method: "POST",
    body: JSON.stringify({}),
  }, token);
}

export function runDevWorkflow(token: string, id: number, payload?: Record<string, unknown>) {
  return http<ApiEnvelope<DevWorkflowRunRecord>>(`${BASE}/scheduling/workflows/${id}/run`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  }, token);
}

export function fetchDevWorkflowRuns(token: string, id: number) {
  return http<ApiEnvelope<DevWorkflowRunRecord[]>>(`${BASE}/scheduling/workflows/${id}/runs`, undefined, token);
}

export function fetchDevInstances(token: string, params?: { workflowRunId?: number; workflowId?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.workflowRunId) searchParams.set("workflowRunId", String(params.workflowRunId));
  if (params?.workflowId) searchParams.set("workflowId", String(params.workflowId));
  const query = searchParams.toString();
  return http<ApiEnvelope<DevJobInstanceRecord[]>>(`${BASE}/scheduling/instances${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchDevInstance(token: string, id: number) {
  return http<ApiEnvelope<DevJobInstanceRecord>>(`${BASE}/scheduling/instances/${id}`, undefined, token);
}

export function fetchDevInstanceLogs(token: string, id: number) {
  return http<ApiEnvelope<DevJobLogRecord[]>>(`${BASE}/scheduling/instances/${id}/logs`, undefined, token);
}
