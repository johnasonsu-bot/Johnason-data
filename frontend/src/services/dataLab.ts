import { http } from "./http";
import { getSelectedProjectHeaders } from "./projectContext";
import type {
  ApiEnvelope,
  DataSourceColumn,
  DataSourceRecord,
  DataSourceSampleRow,
  DataSourceTable,
  LabAiBusinessDataBatchRecord,
  LabAiBusinessDataPlanRecord,
  LabAiBusinessDataState,
  LabAiBusinessDataTaskRecord,
  LabIndustryIncubationRecord,
  LabIndustryIncubationLogRecord,
  LabIndustryIncubationRoundRecord,
  LabIndustryIncubationStatsRecord,
  LabBusinessSystemDirtyDataVersionRecord,
  LabBusinessSystemGenerationVersionRecord,
  LabBusinessSystemTemplateBuildJobRecord,
  LabIndustryDataSourceRecord,
  LabIndustryDataSourceSharedEntityDetailRecord,
  LabIndustryDataSourceTheme,
  LabBusinessSystemLogicalModelVersionRecord,
  LabBusinessSystemPhysicalModelVersionRecord,
  LabBusinessSystemQualityReportRecord,
  LabKnowledgeBaseRecord,
  LabModelProfileRecord,
  LabOpsDashboard,
  LabOperationLogRecord,
  LabScenarioEnhancementRecord,
  LabScenarioRecognitionPreview,
  LabBusinessSystemInstanceRecord,
  LabBusinessSystemTemplateRecord,
  LabPromptTemplateRecord,
  LabPromptTemplateVersionRecord,
  LabQualityReportRecord,
  LabRunLogRecord,
  LabSceneAnalysisRecord,
  LabSceneRecord,
  LabSceneTemplateRecord,
  LabTopicRecord,
  ModelProviderRecord,
} from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface LabKnowledgeBasePayload {
  kbName: string;
  kbDesc?: string;
  industryType?: string;
  tags?: string[];
  status?: "active" | "inactive";
}

export interface LabScenePayload {
  id?: number;
  sceneCode?: string;
  sceneName: string;
  sceneDesc?: string;
  industryKbIds?: number[];
  industryKbId?: number | null;
  kbId?: number | null;
  enhancementProfileId?: number | null;
  offlineDataSourceId?: number | null;
  realtimeDataSourceId?: number | null;
  initVolume?: number;
  incrVolume?: number;
  incrCycle?: "MINUTE" | "HOUR" | "DAILY";
  dirtyEnabled?: boolean;
  dirtyRatio?: number;
  realtimeEnabled?: boolean;
  kafkaTopicMode?: "AUTO" | "MANUAL";
  kafkaBootstrapServers?: string;
  strategyModelId?: number | null;
  generateModelId?: number | null;
}

export interface LabModelPayload {
  id?: number;
  profileName: string;
  stageType:
    | "SCHEMA"
    | "STRATEGY"
    | "DIRTY"
    | "REALTIME"
    | "researcher"
    | "standard_extractor"
    | "distribution_analyst"
    | "schema_reviewer"
    | "realism_reviewer"
    | "arbiter";
  providerId?: number | null;
  modelName: string;
  modelVersion: string;
  modelCode: string;
  endpointUrl?: string;
  authMode?: "bearer" | "api_key" | "none";
  temperature?: number;
  maxContextLength?: number;
  systemPrompt?: string;
  isDefault?: boolean;
  status?: "active" | "inactive";
}

export interface LabBusinessSystemTemplatePayload {
  templateName: string;
  templateCode?: string;
  industryCode?: string | null;
  templateDesc?: string | null;
  sourceIncubationId?: number | null;
  sourceCategoryCodes?: string[];
  templateStatus?: "draft" | "active" | "archived";
}

export interface LabBusinessSystemTemplateUpdatePayload {
  templateName: string;
  templateCode?: string;
  industryCode?: string | null;
  templateDesc?: string | null;
  templateStatus?: "draft" | "active" | "archived";
}

export interface LabBusinessSystemLogicalModelSavePayload {
  logicalModel: Record<string, unknown>;
  summary?: string | null;
}

export interface LabBusinessSystemInstancePayload {
  templateId: number;
  instanceName: string;
  instanceCode?: string;
  dbType?: "mysql" | "postgresql" | "postgres";
  instanceStatus?: "draft" | "active" | "archived";
  targetDataSourceId?: number | null;
}

export interface LabIndustryDataSourcePayload {
  dataSourceName: string;
  dataSourceCode?: string | null;
  industryCode?: string | null;
  dataSourceDesc?: string | null;
  sourceStatus?: "draft" | "active" | "archived";
  selectedThemes?: LabIndustryDataSourceTheme[];
  instanceIds: number[];
}

export interface LabBusinessSystemPhysicalModelGeneratePayload {
  targetDataSourceId?: number | null;
  dbType?: "mysql" | "postgresql" | "postgres" | null;
  summary?: string | null;
}

export interface LabBusinessSystemPhysicalModelSavePayload {
  physicalVersionNo?: number | null;
  physicalModel: Record<string, unknown>;
  summary?: string | null;
}

export interface LabBusinessSystemPhysicalDesignDocPayload {
  physicalVersionNo?: number | null;
  dbType?: "mysql" | "postgresql" | "postgres" | null;
  summary?: string | null;
}

export interface LabBusinessSystemPhysicalModelDeployPayload {
  physicalVersionNo?: number | null;
  targetDataSourceId: number;
  summary?: string | null;
}

export interface LabBusinessSystemGenerationPlanGeneratePayload {
  physicalVersionNo?: number | null;
  targetDataSourceId?: number | null;
  initialDataVolume?: number;
  incrementalDataVolume?: number;
  incrementCycleDays?: number;
  sharedMasterSize?: number;
  businessMasterSize?: number;
  transactionScale?: number;
  sampleRowsPerTable?: number;
  timelineStartAt?: string | null;
  timelineDays?: number;
  summary?: string | null;
}

export interface LabBusinessSystemDirtyDataGeneratePayload {
  generationVersionNo?: number | null;
  dirtyRatio?: number;
  focusCategories?: Array<"D1" | "D2" | "D3" | "D4" | "D5" | "D6">;
  summary?: string | null;
}

export interface LabAiBusinessDataPlanGeneratePayload {
  physicalVersionNo?: number | null;
  targetDataSourceId?: number | null;
  generationMode?: "initial" | "incremental";
  totalRows?: number;
  batchRows?: number;
  timelineStartAt?: string | null;
  timelineDays?: number;
  requirementText?: string | null;
  summary?: string | null;
}

export interface LabAiBusinessDataBatchGeneratePayload {
  planId?: number | null;
  physicalVersionNo?: number | null;
  targetDataSourceId?: number | null;
  generationMode?: "initial" | "incremental";
  totalRows?: number;
  batchRows?: number;
  timelineStartAt?: string | null;
  timelineDays?: number;
  requirementText?: string | null;
  summary?: string | null;
}

export interface LabAiBusinessDataBatchLoadPayload {
  targetDataSourceId?: number | null;
  loadMode?: "append" | "replace";
}

export interface LabAiBusinessDataTaskSavePayload {
  id?: number | null;
  taskName: string;
  instanceId: number;
  physicalVersionNo: number;
  targetDataSourceId: number;
  planId?: number | null;
  scheduleEnabled?: boolean;
  scheduleType?: "manual" | "hourly" | "daily" | "weekly" | "cron";
  cronExpr?: string | null;
  generationMode?: "initial" | "incremental";
  totalRows?: number;
  batchRows?: number;
  timelineStartAt?: string | null;
  timelineDays?: number;
  requirementText?: string | null;
  autoLoad?: boolean;
  loadMode?: "append" | "replace";
}

export function fetchLabDataSources(token: string, options?: { includeConnectivity?: boolean }) {
  const searchParams = new URLSearchParams();
  if (options?.includeConnectivity) {
    searchParams.set("includeConnectivity", "true");
  }
  const query = searchParams.toString();
  return http<ApiEnvelope<DataSourceRecord[]>>(`/data-lab-sources${query ? `?${query}` : ""}`, undefined, token);
}

export function createLabDataSource(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataSourceRecord>>("/data-lab-sources", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateLabDataSource(token: string, id: number, payload: Record<string, unknown>) {
  return http<ApiEnvelope<DataSourceRecord>>(`/data-lab-sources/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteLabDataSource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab-sources/${id}`, {
    method: "DELETE"
  }, token);
}

export function testLabDataSourceConnection(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<{ success: boolean; message: string; error?: string }>>("/data-lab-sources/test-connection", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function fetchLabDataSourceTables(token: string, id: number) {
  return http<ApiEnvelope<DataSourceTable[]>>(`/data-lab-sources/${id}/tables`, undefined, token);
}

export function fetchLabDataSourceColumns(token: string, id: number, tableName: string) {
  return http<ApiEnvelope<DataSourceColumn[]>>(`/data-lab-sources/${id}/tables/${encodeURIComponent(tableName)}/columns`, undefined, token);
}

export function fetchLabDataSourceSampleRows(token: string, id: number, tableName: string, limit = 20) {
  return http<ApiEnvelope<DataSourceSampleRow[]>>(`/data-lab-sources/${id}/tables/${encodeURIComponent(tableName)}/sample?limit=${limit}`, undefined, token);
}

export function fetchKnowledgeBases(token: string) {
  return http<ApiEnvelope<LabKnowledgeBaseRecord[]>>("/data-lab/kb/list", undefined, token);
}

export function fetchKnowledgeBaseDetail(token: string, id: number) {
  return http<ApiEnvelope<LabKnowledgeBaseRecord>>(`/data-lab/kb/detail/${id}`, undefined, token);
}

export function createKnowledgeBase(token: string, payload: LabKnowledgeBasePayload) {
  return http<ApiEnvelope<LabKnowledgeBaseRecord>>("/data-lab/kb/create", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateKnowledgeBase(token: string, id: number, payload: LabKnowledgeBasePayload) {
  return http<ApiEnvelope<LabKnowledgeBaseRecord>>(`/data-lab/kb/update/${id}`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function uploadKnowledgeDocument(token: string, kbId: number, file: File) {
  const formData = new FormData();
  formData.append("kbId", String(kbId));
  formData.append("file", file);
  const response = await fetch(`/api/v1/data-modeling/kb/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...getSelectedProjectHeaders() },
    body: formData,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.message || "上传失败");
  }
  return data as ApiEnvelope<LabKnowledgeBaseRecord>;
}

export function reparseKnowledgeDocument(token: string, docId: number) {
  return http<ApiEnvelope<LabKnowledgeBaseRecord>>(`/data-lab/kb/doc/reparse/${docId}`, { method: "POST" }, token);
}

export function deleteKnowledgeBase(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab/kb/delete/${id}`, { method: "POST" }, token);
}

export function fetchScenes(token: string) {
  return http<ApiEnvelope<LabSceneRecord[]>>("/data-lab/scene/list", undefined, token);
}

export function fetchBusinessSystemTemplates(token: string) {
  return http<ApiEnvelope<LabBusinessSystemTemplateRecord[]>>("/data-lab/scenario-management/templates", undefined, token);
}

export function fetchBusinessSystemTemplateDetail(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemTemplateRecord>>(`/data-lab/scenario-management/templates/${id}`, undefined, token);
}

export function fetchBusinessSystemTemplateLogicalVersions(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemLogicalModelVersionRecord[]>>(`/data-lab/scenario-management/templates/${id}/logical-model/versions`, undefined, token);
}

export function createBusinessSystemTemplate(token: string, payload: LabBusinessSystemTemplatePayload) {
  return http<ApiEnvelope<LabBusinessSystemTemplateRecord>>("/data-lab/scenario-management/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function startBusinessSystemTemplateBuildJob(token: string, payload: LabBusinessSystemTemplatePayload) {
  return http<ApiEnvelope<LabBusinessSystemTemplateBuildJobRecord>>("/data-lab/scenario-management/templates/build-jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchBusinessSystemTemplateBuildJob(token: string, jobId: string) {
  return http<ApiEnvelope<LabBusinessSystemTemplateBuildJobRecord>>(`/data-lab/scenario-management/templates/build-jobs/${encodeURIComponent(jobId)}`, undefined, token);
}

export function deleteBusinessSystemTemplate(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; templateName: string }>>(`/data-lab/scenario-management/templates/${id}/delete`, {
    method: "POST",
  }, token);
}

export function updateBusinessSystemTemplateBasic(token: string, id: number, payload: LabBusinessSystemTemplateUpdatePayload) {
  return http<ApiEnvelope<LabBusinessSystemTemplateRecord>>(`/data-lab/scenario-management/templates/${id}/update-basic`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function saveBusinessSystemTemplateLogicalModel(token: string, id: number, payload: LabBusinessSystemLogicalModelSavePayload) {
  return http<ApiEnvelope<{ template: LabBusinessSystemTemplateRecord; version: LabBusinessSystemLogicalModelVersionRecord | null }>>(`/data-lab/scenario-management/templates/${id}/logical-model/save`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchBusinessSystemInstances(token: string) {
  return http<ApiEnvelope<LabBusinessSystemInstanceRecord[]>>("/data-lab/scenario-management/instances", undefined, token);
}

export function fetchBusinessSystemInstanceDetail(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemInstanceRecord>>(`/data-lab/scenario-management/instances/${id}`, undefined, token);
}

export function fetchIndustryDataSources(token: string) {
  return http<ApiEnvelope<LabIndustryDataSourceRecord[]>>("/data-lab/scenario-management/data-sources", undefined, token);
}

export function fetchIndustryDataSourceDetail(token: string, id: number) {
  return http<ApiEnvelope<LabIndustryDataSourceRecord>>(`/data-lab/scenario-management/data-sources/${id}`, undefined, token);
}

export function fetchIndustryDataSourceSharedEntityDetail(token: string, id: number, entityId: string) {
  return http<ApiEnvelope<LabIndustryDataSourceSharedEntityDetailRecord>>(`/data-lab/scenario-management/data-sources/${id}/entities/${encodeURIComponent(entityId)}`, undefined, token);
}

export function createIndustryDataSource(token: string, payload: LabIndustryDataSourcePayload) {
  return http<ApiEnvelope<LabIndustryDataSourceRecord>>("/data-lab/scenario-management/data-sources", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteIndustryDataSource(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; dataSourceName: string }>>(`/data-lab/scenario-management/data-sources/${id}/delete`, {
    method: "POST",
  }, token);
}

export function rebuildIndustryDataSourcePreview(token: string, id: number) {
  return http<ApiEnvelope<LabIndustryDataSourceRecord>>(`/data-lab/scenario-management/data-sources/${id}/rebuild-preview`, {
    method: "POST",
  }, token);
}

export function fetchBusinessSystemInstancePhysicalVersions(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemPhysicalModelVersionRecord[]>>(`/data-lab/scenario-management/instances/${id}/physical-model/versions`, undefined, token);
}

export function createBusinessSystemInstance(token: string, payload: LabBusinessSystemInstancePayload) {
  return http<ApiEnvelope<LabBusinessSystemInstanceRecord>>("/data-lab/scenario-management/instances", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteBusinessSystemInstance(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; instanceName: string }>>(`/data-lab/scenario-management/instances/${id}/delete`, {
    method: "POST",
  }, token);
}

export function generateBusinessSystemInstancePhysicalModel(token: string, id: number, payload: LabBusinessSystemPhysicalModelGeneratePayload = {}) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; version: LabBusinessSystemPhysicalModelVersionRecord | null }>>(`/data-lab/scenario-management/instances/${id}/physical-model/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function saveBusinessSystemInstancePhysicalModel(token: string, id: number, payload: LabBusinessSystemPhysicalModelSavePayload) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; version: LabBusinessSystemPhysicalModelVersionRecord | null }>>(`/data-lab/scenario-management/instances/${id}/physical-model/save`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteBusinessSystemInstancePhysicalVersion(token: string, id: number, versionId: number) {
  return http<ApiEnvelope<{ id: number; instanceId: number; versionNo: number }>>(`/data-lab/scenario-management/instances/${id}/physical-model/versions/${versionId}/delete`, {
    method: "POST",
  }, token);
}

export async function downloadBusinessSystemInstancePhysicalDesignDoc(
  token: string,
  id: number,
  payload: LabBusinessSystemPhysicalDesignDocPayload = {},
  fallbackFileName = "database_design_specification.docx"
) {
  const response = await fetch(`${API_BASE_URL}/data-modeling/scenario-management/instances/${id}/physical-model/design-doc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...getSelectedProjectHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "下载数据库设计说明书失败");
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

export function deployBusinessSystemInstancePhysicalModel(token: string, id: number, payload: LabBusinessSystemPhysicalModelDeployPayload) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; version: LabBusinessSystemPhysicalModelVersionRecord | null; operator?: string | null }>>(`/data-lab/scenario-management/instances/${id}/physical-model/deploy`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchBusinessSystemInstanceGenerationVersions(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemGenerationVersionRecord[]>>(`/data-lab/scenario-management/instances/${id}/generation-plan/versions`, undefined, token);
}

export function deleteBusinessSystemInstanceGenerationVersion(token: string, id: number, versionId: number) {
  return http<ApiEnvelope<{ id: number; instanceId: number; versionNo: number }>>(`/data-lab/scenario-management/instances/${id}/generation-plan/versions/${versionId}/delete`, {
    method: "POST",
  }, token);
}

export function generateBusinessSystemInstanceGenerationPlan(token: string, id: number, payload: LabBusinessSystemGenerationPlanGeneratePayload = {}) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; version: LabBusinessSystemGenerationVersionRecord | null }>>(`/data-lab/scenario-management/instances/${id}/generation-plan/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchBusinessSystemInstanceDirtyVersions(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemDirtyDataVersionRecord[]>>(`/data-lab/scenario-management/instances/${id}/dirty-data/versions`, undefined, token);
}

export function deleteBusinessSystemInstanceDirtyVersion(token: string, id: number, versionId: number) {
  return http<ApiEnvelope<{ id: number; instanceId: number; versionNo: number }>>(`/data-lab/scenario-management/instances/${id}/dirty-data/versions/${versionId}/delete`, {
    method: "POST",
  }, token);
}

export function generateBusinessSystemInstanceDirtyData(token: string, id: number, payload: LabBusinessSystemDirtyDataGeneratePayload = {}) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; version: LabBusinessSystemDirtyDataVersionRecord | null }>>(`/data-lab/scenario-management/instances/${id}/dirty-data/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function patchBusinessSystemDirtyDataVersion(token: string, versionId: number, payload: LabBusinessSystemDirtyDataGeneratePayload = {}) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; version: LabBusinessSystemDirtyDataVersionRecord | null }>>(`/data-lab/scenario-management/dirty-profiles/${versionId}/patch`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchBusinessSystemInstanceQualityReport(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemQualityReportRecord>>(`/data-lab/scenario-management/instances/${id}/quality-report`, undefined, token);
}

export function rebuildBusinessSystemInstanceQualityReport(token: string, id: number) {
  return http<ApiEnvelope<LabBusinessSystemQualityReportRecord>>(`/data-lab/scenario-management/instances/${id}/quality-report/rebuild`, {
    method: "POST",
  }, token);
}

export function fetchAiBusinessDataPlans(token: string, id: number) {
  return http<ApiEnvelope<LabAiBusinessDataPlanRecord[]>>(`/data-lab/scenario-management/instances/${id}/ai-business-data/plans`, undefined, token);
}

export function generateAiBusinessDataPlan(token: string, id: number, payload: LabAiBusinessDataPlanGeneratePayload) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; plan: LabAiBusinessDataPlanRecord; state: LabAiBusinessDataState; operator?: string }>>(`/data-lab/scenario-management/instances/${id}/ai-business-data/plans/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchAiBusinessDataBatches(token: string, id: number) {
  return http<ApiEnvelope<LabAiBusinessDataBatchRecord[]>>(`/data-lab/scenario-management/instances/${id}/ai-business-data/batches`, undefined, token);
}

export function generateAiBusinessDataBatch(token: string, id: number, payload: LabAiBusinessDataBatchGeneratePayload) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; plan?: LabAiBusinessDataPlanRecord | null; batch: LabAiBusinessDataBatchRecord; state: LabAiBusinessDataState; operator?: string }>>(`/data-lab/scenario-management/instances/${id}/ai-business-data/batches/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function loadAiBusinessDataBatch(token: string, id: number, batchId: number, payload: LabAiBusinessDataBatchLoadPayload) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; batch: LabAiBusinessDataBatchRecord; loadSummary: Record<string, unknown>; operator?: string }>>(`/data-lab/scenario-management/instances/${id}/ai-business-data/batches/${batchId}/load`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchAiBusinessDataTasks(token: string, instanceId?: number | null) {
  const query = instanceId ? `?instanceId=${instanceId}` : "";
  return http<ApiEnvelope<LabAiBusinessDataTaskRecord[]>>(`/data-lab/scenario-management/ai-business-data/tasks${query}`, undefined, token);
}

export function saveAiBusinessDataTask(token: string, payload: LabAiBusinessDataTaskSavePayload) {
  return http<ApiEnvelope<LabAiBusinessDataTaskRecord>>("/data-lab/scenario-management/ai-business-data/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateAiBusinessDataTaskSchedule(token: string, taskId: number, scheduleEnabled: boolean) {
  return http<ApiEnvelope<LabAiBusinessDataTaskRecord>>(`/data-lab/scenario-management/ai-business-data/tasks/${taskId}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduleEnabled }),
  }, token);
}

export function runAiBusinessDataTask(token: string, taskId: number) {
  return http<ApiEnvelope<{ instance: LabBusinessSystemInstanceRecord; plan?: LabAiBusinessDataPlanRecord | null; batch: LabAiBusinessDataBatchRecord; state: LabAiBusinessDataState; task: LabAiBusinessDataTaskRecord; loadSummary?: Record<string, unknown> | null; operator?: string }>>(`/data-lab/scenario-management/ai-business-data/tasks/${taskId}/run`, {
    method: "POST",
  }, token);
}

export function deleteAiBusinessDataTask(token: string, taskId: number) {
  return http<ApiEnvelope<{ id: number; instanceId: number }>>(`/data-lab/scenario-management/ai-business-data/tasks/${taskId}/delete`, {
    method: "POST",
  }, token);
}

export function fetchSceneDetail(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/detail/${id}`, undefined, token);
}

export function createScene(token: string, payload: LabScenePayload) {
  return http<ApiEnvelope<LabSceneRecord>>("/data-lab/scene/create", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateScene(token: string, payload: LabScenePayload & { id: number }) {
  return http<ApiEnvelope<LabSceneRecord>>("/data-lab/scene/update", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function copyScene(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/copy/${id}`, { method: "POST" }, token);
}

export function deleteScene(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab/scene/delete/${id}`, { method: "POST" }, token);
}

export function generateSchema(token: string, sceneId: number) {
  return http<ApiEnvelope<any>>("/data-lab/scene/schema/generate", { method: "POST", body: JSON.stringify({ sceneId }) }, token);
}

export function analyzeScene(token: string, sceneId: number) {
  return http<ApiEnvelope<LabSceneAnalysisRecord>>("/data-lab/scene/analyze", { method: "POST", body: JSON.stringify({ sceneId }) }, token);
}

export function adjustSchema(token: string, sceneId: number, adjustmentPrompt: string, versionId?: number) {
  return http<ApiEnvelope<any>>("/data-lab/scene/schema/adjust", { method: "POST", body: JSON.stringify({ sceneId, adjustmentPrompt, versionId }) }, token);
}

export function saveSchemaVersion(token: string, sceneId: number, schema: Record<string, unknown>, versionId?: number, summary?: string) {
  return http<ApiEnvelope<any>>("/data-lab/scene/schema/save", { method: "POST", body: JSON.stringify({ sceneId, schema, versionId, summary }) }, token);
}

export function confirmSchema(token: string, sceneId: number, versionId?: number) {
  return http<ApiEnvelope<any>>("/data-lab/scene/schema/confirm", { method: "POST", body: JSON.stringify({ sceneId, versionId }) }, token);
}

export function deploySceneSchema(token: string, payload: { sceneId: number; offlineDataSourceId: number; realtimeDataSourceId?: number | null }) {
  return http<ApiEnvelope<{ scene: LabSceneRecord; offlineDataSource: string; realtimeDataSource?: string | null; deployedTables: Array<Record<string, unknown>>; deployedTopics: Array<Record<string, unknown>> }>>("/data-lab/scene/schema/deploy", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function generateStrategy(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<any>>("/data-lab/scene/strategy/generate", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function adjustStrategy(token: string, sceneId: number, adjustmentPrompt: string, versionId?: number) {
  return http<ApiEnvelope<any>>("/data-lab/scene/strategy/adjust", { method: "POST", body: JSON.stringify({ sceneId, adjustmentPrompt, versionId }) }, token);
}

export function confirmStrategy(token: string, sceneId: number, versionId?: number) {
  return http<ApiEnvelope<any>>("/data-lab/scene/strategy/confirm", { method: "POST", body: JSON.stringify({ sceneId, versionId }) }, token);
}

export function fetchSchemaVersionDiff(token: string, sceneId: number, fromVersionId: number, toVersionId: number) {
  return http<ApiEnvelope<{ fromVersion: number; toVersion: number; changes: Array<Record<string, unknown>> }>>(`/data-lab/scene/schema/version/diff/${sceneId}?fromVersionId=${fromVersionId}&toVersionId=${toVersionId}`, undefined, token);
}

export function fetchStrategyVersionDiff(token: string, sceneId: number, fromVersionId: number, toVersionId: number) {
  return http<ApiEnvelope<{ fromVersion: number; toVersion: number; changes: Array<Record<string, unknown>> }>>(`/data-lab/scene/strategy/version/diff/${sceneId}?fromVersionId=${fromVersionId}&toVersionId=${toVersionId}`, undefined, token);
}

export function rollbackSchemaVersion(token: string, sceneId: number, versionId: number) {
  return http<ApiEnvelope<LabSceneRecord>>("/data-lab/scene/schema/version/rollback", { method: "POST", body: JSON.stringify({ sceneId, versionId }) }, token);
}

export function rollbackStrategyVersion(token: string, sceneId: number, versionId: number) {
  return http<ApiEnvelope<LabSceneRecord>>("/data-lab/scene/strategy/version/rollback", { method: "POST", body: JSON.stringify({ sceneId, versionId }) }, token);
}

export function initScene(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/init/${id}`, { method: "POST" }, token);
}

export function startSceneTask(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/task/start/${id}`, { method: "POST" }, token);
}

export function stopSceneTask(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/task/stop/${id}`, { method: "POST" }, token);
}

export function runSceneOnce(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/task/runOnce/${id}`, { method: "POST" }, token);
}

export function rerunFailedTasks(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/task/rerunFailed/${id}`, { method: "POST" }, token);
}

export function backfillScene(token: string, id: number, payload: { rows?: number; fromTime?: string; toTime?: string }) {
  return http<ApiEnvelope<{ sceneId: number; totalRows: number; fromTime?: string | null; toTime?: string | null }>>(`/data-lab/scene/backfill/${id}`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function startRealtime(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/realtime/start/${id}`, { method: "POST" }, token);
}

export function stopRealtime(token: string, id: number) {
  return http<ApiEnvelope<LabSceneRecord>>(`/data-lab/scene/realtime/stop/${id}`, { method: "POST" }, token);
}

export function fetchTopics(token: string, sceneId: number) {
  return http<ApiEnvelope<LabTopicRecord[]>>(`/data-lab/scene/topic/list/${sceneId}`, undefined, token);
}

export function previewTopicMessages(token: string, sceneId: number, topicName: string, limit = 20) {
  return http<ApiEnvelope<{ topicName: string; messages: Array<Record<string, unknown>>; metrics: Record<string, unknown> }>>(`/data-lab/scene/topic/message/preview?sceneId=${sceneId}&topicName=${encodeURIComponent(topicName)}&limit=${limit}`, undefined, token);
}

export function fetchSceneTables(token: string, sceneId: number) {
  return http<ApiEnvelope<Array<Record<string, unknown>>>>(`/data-lab/scene/table/list/${sceneId}`, undefined, token);
}

export function previewSceneTableData(token: string, sceneId: number, tableName: string) {
  return http<ApiEnvelope<{ table: Record<string, unknown>; total: number; page: number; pageSize: number; rows: Array<Record<string, unknown>> }>>(`/data-lab/scene/table/dataPreview?sceneId=${sceneId}&tableName=${encodeURIComponent(tableName)}`, undefined, token);
}

export function exportSceneTableCsv(token: string, sceneId: number, tableName: string) {
  return http<ApiEnvelope<{ fileName: string; content: string; total: number }>>(`/data-lab/scene/table/exportCsv?sceneId=${sceneId}&tableName=${encodeURIComponent(tableName)}`, undefined, token);
}

export function fetchQualityReport(token: string, sceneId: number) {
  return http<ApiEnvelope<LabQualityReportRecord | null>>(`/data-lab/scene/quality/report/${sceneId}`, undefined, token);
}

export function rebuildQualityReport(token: string, sceneId: number) {
  return http<ApiEnvelope<LabQualityReportRecord>>(`/data-lab/scene/quality/report/rebuild/${sceneId}`, { method: "POST" }, token);
}

export function reviewSceneRealism(token: string, sceneId: number, payload: { sampleTables?: number; sampleRows?: number; modelProfileId?: number | null } = {}) {
  return http<ApiEnvelope<any>>(`/data-lab/scene/reviewRealism/${sceneId}`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function generateDirtyScript(token: string, sceneId: number, payload: { dirtyRatio?: number; sampleTables?: number; sampleRows?: number; modelProfileId?: number | null } = {}) {
  return http<ApiEnvelope<any>>(`/data-lab/scene/dirty/script/${sceneId}`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function fetchRunLogs(token: string, sceneId: number) {
  return http<ApiEnvelope<LabRunLogRecord[]>>(`/data-lab/scene/run/log/${sceneId}`, undefined, token);
}

export function fetchOpsDashboard(token: string) {
  return http<ApiEnvelope<LabOpsDashboard>>("/data-lab/ops/dashboard", undefined, token);
}

export function fetchLabModels(token: string) {
  return http<ApiEnvelope<{ profiles: LabModelProfileRecord[]; providers: Pick<ModelProviderRecord, "id" | "configName" | "configCode" | "providerType" | "modelCategory" | "modelName" | "modelVersion" | "modelCatalog">[] }>>("/data-lab/model/list", undefined, token);
}

export function saveLabModel(token: string, payload: LabModelPayload) {
  return http<ApiEnvelope<{ profiles: LabModelProfileRecord[]; providers: Array<Record<string, unknown>> }>>("/data-lab/model/save", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function deleteLabModel(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab/model/delete/${id}`, { method: "POST" }, token);
}

export function setDefaultLabModel(token: string, id: number) {
  return http<ApiEnvelope<{ profiles: LabModelProfileRecord[]; providers: Array<Record<string, unknown>> }>>(`/data-lab/model/setDefault/${id}`, { method: "POST" }, token);
}

export function debugLabModel(token: string, payload: { profileId: number; prompt: string; systemPrompt?: string; temperature?: number; maxTokens?: number }) {
  return http<ApiEnvelope<{ rawText: string; parsedJson: unknown; validJson: boolean }>>("/data-lab/model/debug", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function fetchPromptTemplates(token: string) {
  return http<ApiEnvelope<LabPromptTemplateRecord[]>>("/data-lab/prompt/list", undefined, token);
}

export function syncDefaultPromptTemplates(token: string) {
  return http<ApiEnvelope<{ synced: Array<{ promptType: string; action: string; id: number }>; templates: LabPromptTemplateRecord[] }>>("/data-lab/prompt/sync-defaults", {
    method: "POST",
  }, token);
}

export function savePromptTemplate(token: string, payload: { id?: number; promptType: string; templateName: string; templateCode: string; content: string; userContent?: string; temperature?: number; maxTokens?: number; isDefault?: boolean; status?: string }) {
  return http<ApiEnvelope<LabPromptTemplateRecord[]>>("/data-lab/prompt/save", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function savePromptTemplateDraft(token: string, payload: { promptType: string; templateName: string; templateCode: string; content: string; userContent: string; temperature?: number; maxTokens?: number; defaultModelProviderId?: number | null; defaultModelName?: string | null; defaultModelVersion?: string | null }) {
  return http<ApiEnvelope<{ versions: LabPromptTemplateVersionRecord[] }>>("/data-lab/prompt/save-draft", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function publishPromptTemplate(token: string, payload: { id?: number; promptType: string; templateName: string; templateCode: string; content: string; userContent: string; temperature?: number; maxTokens?: number; defaultModelProviderId?: number | null; defaultModelName?: string | null; defaultModelVersion?: string | null; status?: string }) {
  return http<ApiEnvelope<LabPromptTemplateRecord[]>>("/data-lab/prompt/publish", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchPromptTemplateVersions(token: string, promptType: string) {
  return http<ApiEnvelope<LabPromptTemplateVersionRecord[]>>(`/data-lab/prompt/version/list/${encodeURIComponent(promptType)}`, undefined, token);
}

export function debugPromptTemplate(token: string, payload: { promptType: string; modelProviderId: number; prompt: string; systemPrompt: string; temperature?: number; maxTokens?: number }) {
  return http<ApiEnvelope<{ rawText: string; parsedJson: unknown; validJson: boolean }>>("/data-lab/prompt/debug", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deletePromptTemplate(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab/prompt/delete/${id}`, { method: "POST" }, token);
}

export function fetchSceneTemplates(token: string) {
  return http<ApiEnvelope<LabSceneTemplateRecord[]>>("/data-lab/template/list", undefined, token);
}

export function saveSceneTemplate(token: string, payload: { id?: number; templateName: string; templateCode: string; category?: string; sceneDesc?: string; schema: unknown; strategy?: unknown; status?: string }) {
  return http<ApiEnvelope<LabSceneTemplateRecord[]>>("/data-lab/template/save", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function deleteSceneTemplate(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab/template/delete/${id}`, { method: "POST" }, token);
}

export function fetchOperationLogs(token: string, sceneId?: number) {
  return http<ApiEnvelope<LabOperationLogRecord[]>>(`/data-lab/operation/logs${sceneId ? `?sceneId=${sceneId}` : ""}`, undefined, token);
}

export function fetchScenarioEnhancements(token: string) {
  return http<ApiEnvelope<LabScenarioEnhancementRecord[]>>("/data-lab/enhancement/list", undefined, token);
}

export function fetchScenarioEnhancementDetail(token: string, id: number) {
  return http<ApiEnvelope<LabScenarioEnhancementRecord>>(`/data-lab/enhancement/detail/${id}`, undefined, token);
}

export function saveScenarioEnhancement(token: string, payload: {
  id?: number;
  profileName: string;
  profileCode?: string;
  industry: string;
  subScenario?: string;
  profileDesc?: string;
  locale?: string;
  businessStyle?: string;
  confidenceThreshold?: number;
  priority?: number;
  status?: string;
  isSystem?: boolean;
  dictionaries?: Array<Record<string, unknown>>;
  distributionRules?: Array<Record<string, unknown>>;
  fieldRules?: Array<Record<string, unknown>>;
  complianceRules?: Array<Record<string, unknown>>;
  pluginBindings?: Array<Record<string, unknown>>;
  extendedRules?: Array<Record<string, unknown>>;
  recognition?: Record<string, unknown>;
  researchCatalog?: Record<string, unknown>;
  modulePlanner?: Record<string, unknown>;
  schemaGuides?: Record<string, unknown>;
  relationPatterns?: unknown[];
  stateMachines?: unknown[];
  codeRules?: unknown[];
  fieldSemantics?: unknown[];
  valueCorpora?: Record<string, unknown>;
  distributionProfiles?: Record<string, unknown>;
  qualityGates?: Record<string, unknown>;
  realismRules?: unknown[];
  dirtyDataProfiles?: Record<string, unknown>;
  trainingAssets?: Record<string, unknown>;
  evaluationRubric?: Record<string, unknown>;
  overridePolicies?: Record<string, unknown>;
}) {
  return http<ApiEnvelope<LabScenarioEnhancementRecord>>("/data-lab/enhancement/save", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteScenarioEnhancement(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab/enhancement/delete/${id}`, {
    method: "POST",
  }, token);
}

export function previewScenarioRecognition(token: string, payload: { sceneName: string; sceneDesc?: string; knowledgeText?: string }) {
  return http<ApiEnvelope<LabScenarioRecognitionPreview>>("/data-lab/enhancement/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function exportScenarioEnhancementPackage(token: string, id: number, fallbackFileName: string) {
  const response = await fetch(`/api/v1/data-modeling/enhancement/export/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getSelectedProjectHeaders(),
    },
  });

  const blob = await response.blob();
  if (!response.ok) {
    throw new Error(await blob.text());
  }

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

export async function importScenarioEnhancementPackage(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/v1/data-modeling/enhancement/import", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...getSelectedProjectHeaders(),
    },
    body: formData,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "导入失败");
  }
  return data as ApiEnvelope<LabScenarioEnhancementRecord>;
}

export function fetchIndustryIncubations(token: string) {
  return http<ApiEnvelope<LabIndustryIncubationRecord[]>>("/data-lab/incubation/list", undefined, token);
}

export function fetchIndustryIncubationDetail(token: string, id: number) {
  return http<ApiEnvelope<LabIndustryIncubationRecord>>(`/data-lab/incubation/detail/${id}`, undefined, token);
}

export function fetchIndustryIncubationStats(token: string, id: number) {
  return http<ApiEnvelope<LabIndustryIncubationStatsRecord>>(`/data-lab/incubation/stats/${id}`, undefined, token);
}

export function fetchIndustryIncubationLogs(token: string, id: number) {
  return http<ApiEnvelope<LabIndustryIncubationLogRecord[]>>(`/data-lab/incubation/logs/${id}`, undefined, token);
}

export function saveIndustryIncubation(token: string, payload: {
  id?: number;
  incubationName: string;
  incubationCode?: string;
  industryCode?: string;
  enhancementProfileId?: number | null;
  incubationDesc?: string;
  status?: string;
  languagePolicy?: Record<string, unknown>;
  autoResearchPolicy?: Record<string, unknown>;
  modelCommittee?: Record<string, unknown>;
  scenarioPool?: Record<string, unknown>;
  scenarioCoverage?: Record<string, unknown>;
  evidenceCatalog?: Record<string, unknown>;
  standardAssets?: Record<string, unknown>;
  publicDataProfiles?: Record<string, unknown>;
  trainingSettings?: Record<string, unknown>;
  evaluationRubric?: Record<string, unknown>;
  overridePolicies?: Record<string, unknown>;
}) {
  return http<ApiEnvelope<LabIndustryIncubationRecord>>("/data-lab/incubation/save", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteIndustryIncubation(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-lab/incubation/delete/${id}`, {
    method: "POST",
  }, token);
}

export function refreshIndustryIncubationMetadata(token: string, id: number) {
  return http<ApiEnvelope<{ incubation: LabIndustryIncubationRecord; enhancement?: LabScenarioEnhancementRecord | null; metadata: Record<string, unknown> }>>(`/data-lab/incubation/refresh-metadata/${id}`, {
    method: "POST",
  }, token);
}

export function startIndustryIncubationRun(token: string, id: number, payload: { roundCount?: number; categoryCode?: string; categoryName?: string }) {
  return http<ApiEnvelope<LabIndustryIncubationRecord>>(`/data-lab/incubation/run/start/${id}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function stopIndustryIncubationRun(token: string, id: number) {
  return http<ApiEnvelope<LabIndustryIncubationRecord>>(`/data-lab/incubation/run/stop/${id}`, {
    method: "POST",
  }, token);
}

export function updateIndustryCategoryIteration(token: string, id: number, payload: { categoryCode?: string | null; categoryName?: string | null; continueIteration: boolean }) {
  return http<ApiEnvelope<LabIndustryIncubationRecord>>(`/data-lab/incubation/category-iteration/${id}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function generateIndustryIncubationRound(token: string, incubationId: number) {
  return http<ApiEnvelope<LabIndustryIncubationRoundRecord>>("/data-lab/incubation/round/generate", {
    method: "POST",
    body: JSON.stringify({ incubationId }),
  }, token);
}

export function executeIndustryIncubationRound(token: string, id: number) {
  return http<ApiEnvelope<{ round: LabIndustryIncubationRoundRecord; syncResult?: { incubation: LabIndustryIncubationRecord; enhancement: LabScenarioEnhancementRecord } | null }>>(`/data-lab/incubation/round/execute/${id}`, {
    method: "POST",
  }, token);
}

export function updateIndustryIncubationRound(token: string, payload: {
  id: number;
  roundStatus?: string;
  resultSummary?: Record<string, unknown>;
  enhancementDelta?: Record<string, unknown>;
  startedAt?: string | null;
  endedAt?: string | null;
}) {
  return http<ApiEnvelope<LabIndustryIncubationRoundRecord>>("/data-lab/incubation/round/update", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function syncIndustryIncubationToEnhancement(token: string, id: number) {
  return http<ApiEnvelope<{ incubation: LabIndustryIncubationRecord; enhancement: LabScenarioEnhancementRecord }>>(`/data-lab/incubation/sync-enhancement/${id}`, {
    method: "POST",
  }, token);
}
