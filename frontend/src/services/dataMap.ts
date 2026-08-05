import { http } from "./http";
import type { ApiEnvelope, DataSourceColumn, DataSourceSampleRow, DataSourceTable } from "../types/api";

export type DataMapStatus = "active" | "inactive" | string;

export interface DataMapDepartment {
  id: number;
  departmentName: string;
  departmentCode: string;
  departmentShortName?: string;
  parentId?: number | null;
  parentName?: string | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  dataOwner?: string;
  dataSteward?: string;
  description?: string;
  tags?: string[];
  status: DataMapStatus;
  systemCount?: number;
  sourceCount?: number;
  resourceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataMapBusinessSystem {
  id: number;
  departmentId: number;
  departmentName?: string;
  departmentCode?: string;
  systemName: string;
  systemCode: string;
  systemShortName?: string;
  systemType?: string;
  systemLevel?: string;
  lifecycleStatus?: string;
  onlineDate?: string | null;
  contactName?: string;
  contactPhone?: string;
  vendorName?: string;
  techOwner?: string;
  description?: string;
  tags?: string[];
  status: DataMapStatus;
  sourceCount?: number;
  resourceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataMapDataSource {
  id: number;
  departmentId: number;
  departmentName?: string;
  departmentCode?: string;
  businessSystemId: number;
  systemName?: string;
  systemCode?: string;
  sourceName: string;
  sourceCode: string;
  sourceType: string;
  connectionConfig?: Record<string, unknown>;
  ownerName: string;
  environment?: string;
  purpose?: string;
  sourceRefModule?: string;
  sourceRefId?: number | null;
  sourceRefCode?: string;
  sourceRefSnapshot?: Record<string, unknown> | null;
  importedAt?: string | null;
  status: DataMapStatus;
  resourceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataMapExternalDataSource {
  refKey: string;
  module: string;
  id: number;
  sourceName: string;
  sourceCode: string;
  sourceType: string;
  connectionConfig: Record<string, unknown>;
  ownerName: string;
  status: string;
  sourceRefModule: string;
  sourceRefId: number;
  sourceRefCode: string;
  sourceRefSnapshot: Record<string, unknown>;
}

export interface DataMapCatalog {
  id: number;
  parentId?: number | null;
  catalogName: string;
  catalogShortCode: string;
  layerCode?: string;
  departmentId: number;
  departmentName?: string;
  departmentCode?: string;
  businessSystemId?: number | null;
  systemName?: string;
  systemCode?: string;
  ownerName?: string;
  description?: string;
  sortOrder?: number;
  status: DataMapStatus;
  resourceCount?: number;
  children?: DataMapCatalog[];
  createdAt: string;
  updatedAt: string;
}

export interface DataMapResource {
  id: number;
  resourceCode: string;
  catalogId: number;
  catalogName?: string;
  catalogShortCode?: string;
  departmentId: number;
  departmentName?: string;
  departmentCode?: string;
  businessSystemId: number;
  systemName?: string;
  systemCode?: string;
  dataSourceId: number;
  sourceName?: string;
  sourceCode?: string;
  sourceType?: string;
  tableName: string;
  tableComment?: string;
  rowCount?: number | null;
  rowCountMode?: string;
  columnCount?: number;
  resourceCategory?: string;
  businessTags?: string[];
  status: DataMapStatus;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataMapLineageEdge {
  id: number;
  sourceResourceId?: number | null;
  targetResourceId?: number | null;
  sourceDataSourceId?: number | null;
  targetDataSourceId?: number | null;
  sourceTableName: string;
  targetTableName: string;
  sourceResourceCode?: string;
  targetResourceCode?: string;
  sourceName?: string;
  targetName?: string;
  lineageType: string;
  relationSource: string;
  relationSourceId?: number | null;
  confidence: string;
}

export interface DataMapResourceContent {
  id?: number;
  resourceId?: number;
  businessName?: string;
  businessDefinition?: string;
  businessGrain?: string;
  updateFrequency?: string;
  dataOwner?: string;
  techOwner?: string;
  usageScenarios?: string[];
  usageInstruction?: string;
  qualityNote?: string;
  knownIssues?: string;
  retentionPeriod?: string;
  serviceSla?: string;
  extension?: Record<string, unknown>;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DataMapResourceProfile {
  id?: number;
  resourceId?: number;
  profileStatus: string;
  sampleCount: number;
  rowCount?: number | null;
  columnCount: number;
  nullableFieldCount: number;
  primaryKeyFields?: string[];
  timeRange?: Record<string, { min?: string; max?: string }>;
  qualitySummary?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  aiSummary?: string;
  aiOutput?: Record<string, unknown> | null;
  aiAnalyzedAt?: string | null;
  errorMessage?: string;
  profiledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DataMapResourceFieldProfile {
  id?: number;
  resourceId?: number;
  columnName: string;
  nullRate?: number | null;
  sampleValues?: unknown[];
  issueTags?: string[];
  semanticTags?: string[];
  featureTags?: string[];
  aiBusinessName?: string;
  aiBusinessMeaning?: string;
  aiOutput?: Record<string, unknown> | null;
}

export interface DataMapFieldStandardMapping {
  id: number;
  elementId: number;
  elementCode: string;
  elementNameCn: string;
  elementNameEn?: string;
  mappingStatus: "suggested" | "approved" | string;
  confidence?: number | null;
  evidence?: string[];
  updatedAt?: string | null;
}

export interface DataMapResourceField extends DataSourceColumn {
  businessName?: string;
  semanticTags?: string[];
  standardMapping?: DataMapFieldStandardMapping | null;
}

export interface DataMapResourceDetail extends DataMapResource {
  content: DataMapResourceContent;
  profile: DataMapResourceProfile;
  fieldProfiles: DataMapResourceFieldProfile[];
  fields: DataMapResourceField[];
  lineage: DataMapLineageEdge[];
}

export interface DataMapResourceSearchResult extends DataMapResource {
  businessName?: string;
  businessDefinition?: string;
  businessGrain?: string;
  dataOwner?: string;
  techOwner?: string;
  profileStatus?: string;
  sampleCount?: number;
  aiSummary?: string;
  profiledAt?: string | null;
  aiAnalyzedAt?: string | null;
  fieldCount?: number;
  fieldNames?: string[];
}

export interface DataMapLineageGraphNode {
  id: string;
  label: string;
  type: "current" | "resource" | "external" | string;
  data?: Record<string, unknown>;
}

export interface DataMapLineageGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: DataMapLineageEdge;
}

export interface DataMapLineageGraph {
  nodes: DataMapLineageGraphNode[];
  edges: DataMapLineageGraphEdge[];
}

export interface DataMapAiConfig {
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
  userPromptTemplate?: string;
  outputSchema?: Record<string, unknown>;
  description?: string;
  ownerName: string;
  status: "active" | "inactive" | string;
  createdAt: string;
  updatedAt: string;
}

export interface DataMapOverview {
  departments: number;
  businessSystems: number;
  dataSources: number;
  catalogs: number;
  resources: number;
  lineageEdges: number;
}

export function fetchDataMapOverview(token: string) {
  return http<ApiEnvelope<DataMapOverview>>("/data-map/overview", undefined, token);
}

export function fetchDataMapDepartments(token: string) {
  return http<ApiEnvelope<DataMapDepartment[]>>("/data-map/departments", undefined, token);
}

export function createDataMapDepartment(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapDepartment>>("/data-map/departments", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateDataMapDepartment(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapDepartment>>(`/data-map/departments/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export function deleteDataMapDepartment(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-map/departments/${id}`, { method: "DELETE" }, token);
}

export function fetchDataMapBusinessSystems(token: string) {
  return http<ApiEnvelope<DataMapBusinessSystem[]>>("/data-map/business-systems", undefined, token);
}

export function createDataMapBusinessSystem(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapBusinessSystem>>("/data-map/business-systems", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateDataMapBusinessSystem(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapBusinessSystem>>(`/data-map/business-systems/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export function deleteDataMapBusinessSystem(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-map/business-systems/${id}`, { method: "DELETE" }, token);
}

export function fetchDataMapDataSources(token: string) {
  return http<ApiEnvelope<DataMapDataSource[]>>("/data-map/data-sources", undefined, token);
}

export function fetchDataMapExternalDataSources(token: string, moduleKey?: string) {
  const query = moduleKey ? `?module=${encodeURIComponent(moduleKey)}` : "";
  return http<ApiEnvelope<DataMapExternalDataSource[]>>(`/data-map/data-sources/external${query}`, undefined, token);
}

export function createDataMapDataSource(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapDataSource>>("/data-map/data-sources", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateDataMapDataSource(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapDataSource>>(`/data-map/data-sources/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export function deleteDataMapDataSource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-map/data-sources/${id}`, { method: "DELETE" }, token);
}

export function testDataMapDataSource(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ success: boolean; message: string; error?: string }>>("/data-map/data-sources/test-connection", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchDataMapDataSourceTables(token: string, id: number) {
  return http<ApiEnvelope<DataSourceTable[]>>(`/data-map/data-sources/${id}/tables`, undefined, token);
}

export function fetchDataMapCatalogs(token: string) {
  return http<ApiEnvelope<DataMapCatalog[]>>("/data-map/catalogs", undefined, token);
}

export function fetchDataMapCatalogTree(token: string) {
  return http<ApiEnvelope<DataMapCatalog[]>>("/data-map/catalogs/tree", undefined, token);
}

export function createDataMapCatalog(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapCatalog>>("/data-map/catalogs", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateDataMapCatalog(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapCatalog>>(`/data-map/catalogs/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export function deleteDataMapCatalog(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-map/catalogs/${id}`, { method: "DELETE" }, token);
}

export function registerDataMapResources(token: string, catalogId: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapResource[]>>(`/data-map/catalogs/${catalogId}/register-resources`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchDataMapResources(token: string, filters?: Record<string, unknown>) {
  const searchParams = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return http<ApiEnvelope<DataMapResource[]>>(`/data-map/resources${query ? `?${query}` : ""}`, undefined, token);
}

export function searchDataMapResources(token: string, filters?: Record<string, unknown>) {
  const searchParams = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return http<ApiEnvelope<DataMapResourceSearchResult[]>>(`/data-map/search/resources${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchDataMapResourceDetail(token: string, id: number) {
  return http<ApiEnvelope<DataMapResourceDetail>>(`/data-map/resources/${id}`, undefined, token);
}

export function updateDataMapResourceContent(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapResourceContent>>(`/data-map/resources/${id}/content`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function updateDataMapResourceField(token: string, id: number, columnName: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapResourceDetail>>(`/data-map/resources/${id}/fields/${encodeURIComponent(columnName)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchDataMapResourceProfile(token: string, id: number) {
  return http<ApiEnvelope<{ profile: DataMapResourceProfile; fieldProfiles: DataMapResourceFieldProfile[] }>>(`/data-map/resources/${id}/profile`, undefined, token);
}

export function refreshDataMapResourceProfile(token: string, id: number, payload: Record<string, unknown> = {}) {
  return http<ApiEnvelope<{ profile: DataMapResourceProfile; fieldProfiles: DataMapResourceFieldProfile[] }>>(`/data-map/resources/${id}/profile/refresh`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function analyzeDataMapResourceProfile(token: string, id: number, payload: Record<string, unknown> = {}) {
  return http<ApiEnvelope<{ profile: DataMapResourceProfile; fieldProfiles: DataMapResourceFieldProfile[] }>>(`/data-map/resources/${id}/profile/ai-analyze`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function analyzeDataMapResourceContentProfile(token: string, id: number, payload: Record<string, unknown> = {}) {
  return http<ApiEnvelope<{ profile: DataMapResourceProfile; fieldProfiles: DataMapResourceFieldProfile[] }>>(`/data-map/resources/${id}/profile/content-ai-analyze`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function analyzeDataMapResourceFieldProfile(token: string, id: number, payload: Record<string, unknown> = {}) {
  return http<ApiEnvelope<{ profile: DataMapResourceProfile; fieldProfiles: DataMapResourceFieldProfile[] }>>(`/data-map/resources/${id}/profile/fields-ai-analyze`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchDataMapResourceLineageGraph(token: string, id: number, direction = "both") {
  return http<ApiEnvelope<DataMapLineageGraph>>(`/data-map/resources/${id}/lineage-graph?direction=${encodeURIComponent(direction)}`, undefined, token);
}

export function updateDataMapResource(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapResource>>(`/data-map/resources/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export function deleteDataMapResource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-map/resources/${id}`, { method: "DELETE" }, token);
}

export function deleteDataMapResources(token: string, ids: number[]) {
  return http<ApiEnvelope<{ deletedCount: number }>>("/data-map/resources/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids })
  }, token);
}

export function fetchDataMapResourceSample(token: string, id: number, limit = 20) {
  return http<ApiEnvelope<DataSourceSampleRow[]>>(`/data-map/resources/${id}/sample?limit=${limit}`, undefined, token);
}

export function refreshDataMapIngestionLineage(token: string) {
  return http<ApiEnvelope<{ syncedEdges: number }>>("/data-map/lineage/refresh-ingestion", { method: "POST" }, token);
}

export function fetchDataMapAiConfigs(token: string) {
  return http<ApiEnvelope<DataMapAiConfig[]>>("/data-map/ai-configs", undefined, token);
}

export function updateDataMapAiConfig(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataMapAiConfig>>(`/data-map/ai-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}
