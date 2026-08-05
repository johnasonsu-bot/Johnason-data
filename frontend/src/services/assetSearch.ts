import { http } from "./http";
import type { ApiEnvelope } from "../types/api";

export type AssetType =
  | "table"
  | "field"
  | "datasource"
  | "ingestion_task"
  | "quality_rule"
  | "quality_strategy"
  | "quality_result"
  | "service_api"
  | "service_app";

export type AssetSourceModule = "data_map" | "ingestion" | "quality" | "services";

export interface AssetSearchResult {
  id: string;
  assetType: AssetType;
  sourceModule: AssetSourceModule;
  sourceId: number | string;
  title: string;
  subtitle?: string;
  description?: string;
  status?: string;
  owner?: string;
  tags?: string[];
  score: number;
  matchedFields: string[];
  highlights: Array<{ field: string; text: string }>;
  context: Record<string, unknown>;
  actions: Array<{ label: string; path: string }>;
}

export interface AssetSearchAiInfo {
  enabled: boolean;
  intent?: string;
  expandedKeywords?: string[];
  summary?: string;
  suggestions?: string[];
  recommendedResults?: Array<{ id: string; reason: string }>;
  usedStages?: string[];
  fallbackReason?: string;
}

export interface AssetSearchResponse {
  mode: "basic" | "basic_fallback" | "ai" | string;
  keyword: string;
  ai: AssetSearchAiInfo;
  results: AssetSearchResult[];
  facets: {
    assetTypes?: Array<{ value: string; count: number }>;
    sourceModules?: Array<{ value: string; count: number }>;
    statuses?: Array<{ value: string; count: number }>;
  };
  stats: {
    total: number;
    byAssetType: Record<string, number>;
    bySourceModule: Record<string, number>;
    byStatus?: Record<string, number>;
  };
  errors?: Array<{ sourceModule: string; message: string }>;
}

export interface AssetSearchRequest {
  keyword?: string;
  aiEnabled?: boolean;
  scopes?: AssetType[];
  sourceModules?: AssetSourceModule[];
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface AssetSearchFacetOptions {
  sourceModules: Array<{ value: AssetSourceModule; label: string }>;
  assetTypes: Array<{ value: AssetType; label: string }>;
  departments: Array<{ id: number; label: string; code: string }>;
  businessSystems: Array<{ id: number; label: string; code: string; departmentId: number }>;
  dataSources: Array<{ id: number; label: string; code: string; sourceModule: AssetSourceModule }>;
  statuses: Array<{ value: string; label: string }>;
}

export interface AssetSearchAiConfig {
  id: number;
  sceneName: string;
  sceneCode: string;
  defaultModelProviderId?: number | null;
  defaultModelProviderName?: string | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  systemPrompt?: string;
  description?: string;
  ownerName?: string;
  status: "active" | "inactive" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetSearchAiConfigPayload {
  defaultModelProviderId?: number | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  systemPrompt?: string;
  description?: string;
  ownerName?: string;
  status?: string;
}

export interface AssetSearchAiRunRecord {
  id: number;
  keyword?: string;
  mode: string;
  status: string;
  fallbackReason?: string | null;
  sourceModules: string[];
  scopes: string[];
  expandedKeywords: string[];
  configuredStages: string[];
  usedStages: string[];
  candidateCount: number;
  resultCount: number;
  durationMs: number;
  errorMessage?: string | null;
  submittedBy?: string;
  createdAt?: string;
}

export interface BusinessDataSearchCondition {
  elementId: number;
  values: string[];
}

export interface BusinessDataSearchRequest {
  conditions: BusinessDataSearchCondition[];
  matchMode?: "all" | "any";
  filters?: {
    catalogId?: number;
    departmentId?: number;
    businessSystemId?: number;
    dataSourceId?: number;
    status?: string;
  };
  limit?: number;
  perResourceLimit?: number;
}

export interface BusinessDataSearchMatchedField {
  elementId: number;
  elementCode: string;
  elementNameCn: string;
  columnName: string;
  columnComment?: string;
  dataType?: string;
  columnType?: string;
  mappingStatus?: string;
  confidence?: number | null;
  values: string[];
}

export interface BusinessDataSearchTableResult {
  resourceId: number;
  resourceCode: string;
  tableName: string;
  tableComment?: string;
  resourceCategory?: string;
  resourceStatus?: string;
  catalogId: number;
  catalogName: string;
  catalogShortCode?: string;
  departmentId: number;
  departmentName: string;
  departmentCode?: string;
  businessSystemId: number;
  businessSystemName: string;
  businessSystemCode?: string;
  dataSourceId: number;
  dataSourceName: string;
  dataSourceCode?: string;
  hitCount: number;
  returnedCount: number;
  matchedFields: BusinessDataSearchMatchedField[];
  rows: Record<string, unknown>[];
  actions: Array<{ label: string; path: string }>;
}

export interface BusinessDataSearchResponse {
  matchMode: "all" | "any";
  conditions: BusinessDataSearchCondition[];
  stats: {
    targetFieldCount: number;
    targetResourceCount: number;
    totalTables: number;
    totalRows: number;
  };
  results: BusinessDataSearchTableResult[];
  errors?: Array<{ resourceId: number; resourceCode?: string; tableName: string; message: string }>;
}

export function searchAssets(token: string, payload: AssetSearchRequest) {
  return http<ApiEnvelope<AssetSearchResponse>>("/asset-search/search", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function searchBusinessData(token: string, payload: BusinessDataSearchRequest) {
  return http<ApiEnvelope<BusinessDataSearchResponse>>("/asset-search/business-data/search", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchAssetSearchFacets(token: string) {
  return http<ApiEnvelope<AssetSearchFacetOptions>>("/asset-search/facets", undefined, token);
}

export function sendAssetSearchFeedback(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ accepted: boolean; stored: boolean; id?: number }>>("/asset-search/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchAssetSearchAiConfigs(token: string) {
  return http<ApiEnvelope<AssetSearchAiConfig[]>>("/asset-search/ai-configs", undefined, token);
}

export function updateAssetSearchAiConfig(token: string, id: number, payload: AssetSearchAiConfigPayload) {
  return http<ApiEnvelope<AssetSearchAiConfig>>(`/asset-search/ai-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchAssetSearchAiRuns(token: string, limit = 20) {
  return http<ApiEnvelope<AssetSearchAiRunRecord[]>>(`/asset-search/ai-runs?limit=${limit}`, undefined, token);
}
