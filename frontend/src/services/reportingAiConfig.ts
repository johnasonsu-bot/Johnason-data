import { http } from "./http";
import type { ApiEnvelope, ReportingAiConfigRecord } from "../types/api";

export interface ReportingAiConfigPayload {
  sceneName: string;
  sceneCode: string;
  defaultModelProviderId?: number | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  inputSchema?: Record<string, unknown>;
  systemPrompt?: string;
  description?: string;
  ownerName: string;
  status: ReportingAiConfigRecord["status"];
}

export function fetchReportingAiConfigs(token: string) {
  return http<ApiEnvelope<ReportingAiConfigRecord[]>>("/reporting-ai-configs", undefined, token);
}

export function updateReportingAiConfig(token: string, id: number, payload: ReportingAiConfigPayload) {
  return http<ApiEnvelope<ReportingAiConfigRecord>>(`/reporting-ai-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}
