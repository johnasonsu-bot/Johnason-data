import { http } from "./http";
import type { ApiEnvelope, IngestionAiConfigRecord } from "../types/api";

export interface IngestionAiConfigPayload {
  sceneName: string;
  sceneCode: string;
  defaultModelProviderId?: number | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  systemPrompt?: string;
  description?: string;
  ownerName: string;
  status: IngestionAiConfigRecord["status"];
}

export function fetchIngestionAiConfigs(token: string) {
  return http<ApiEnvelope<IngestionAiConfigRecord[]>>("/ingestion-ai-configs", undefined, token);
}

export function createIngestionAiConfig(token: string, payload: IngestionAiConfigPayload) {
  return http<ApiEnvelope<IngestionAiConfigRecord>>("/ingestion-ai-configs", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateIngestionAiConfig(token: string, id: number, payload: IngestionAiConfigPayload) {
  return http<ApiEnvelope<IngestionAiConfigRecord>>(`/ingestion-ai-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteIngestionAiConfig(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/ingestion-ai-configs/${id}`, {
    method: "DELETE"
  }, token);
}
