import { http } from "./http";
import type { ApiEnvelope, ModelProviderRecord } from "../types/api";

export interface ModelProviderPayload {
  configName: string;
  configCode: string;
  providerType: ModelProviderRecord["providerType"];
  modelCategory: ModelProviderRecord["modelCategory"];
  modelName: string;
  modelVersion: string;
  baseUrl?: string;
  apiKey: string;
  organizationId?: string;
  ownerName: string;
  status: ModelProviderRecord["status"];
  description?: string;
  extraConfig?: Record<string, unknown>;
}

export interface ModelProviderTestPayload {
  id?: number;
  providerType: ModelProviderRecord["providerType"];
  modelCategory: ModelProviderRecord["modelCategory"];
  baseUrl: string;
  apiKey?: string;
  organizationId?: string;
  extraConfig?: Record<string, unknown>;
}

export function fetchModelProviders(token: string) {
  return http<ApiEnvelope<ModelProviderRecord[]>>("/model-providers", undefined, token);
}

export function createModelProvider(token: string, payload: ModelProviderPayload) {
  return http<ApiEnvelope<ModelProviderRecord>>("/model-providers", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateModelProvider(token: string, id: number, payload: ModelProviderPayload) {
  return http<ApiEnvelope<ModelProviderRecord>>(`/model-providers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteModelProvider(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/model-providers/${id}`, {
    method: "DELETE"
  }, token);
}

export function testModelProviderConnection(token: string, payload: ModelProviderTestPayload) {
  return http<ApiEnvelope<{ success: boolean; message: string; providerType: string; modelName: string | null; modelVersion: string | null; checkedEndpoint: string; models: Array<{ value: string; label: string }>; modelCatalog: Array<{ name: string; label: string; versions: Array<{ value: string; label: string }> }> }>>("/model-providers/test-connection", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}
