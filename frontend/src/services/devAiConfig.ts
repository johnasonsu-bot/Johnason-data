import { http } from "./http";
import type { ApiEnvelope, DevAiConfigRecord } from "../types/api";

export interface DevAiConfigPayload {
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
  status: DevAiConfigRecord["status"];
}

export function fetchDevAiConfigs(token: string) {
  return http<ApiEnvelope<DevAiConfigRecord[]>>("/dev-ai-configs", undefined, token);
}

export function updateDevAiConfig(token: string, id: number, payload: DevAiConfigPayload) {
  return http<ApiEnvelope<DevAiConfigRecord>>(`/dev-ai-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}
