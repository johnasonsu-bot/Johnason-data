import { http } from "./http";
import type {
  ApiEnvelope,
  DataSourceColumn,
  DataSourceRecord,
  DataSourceTable,
  QualityAnalysisOverview,
  QualityAiConfigRecord,
  QualityAiConfigVersionRecord,
  QualityDictionaryRecord,
  QualityIssueDetailRecord,
  QualityIssueStatRecord,
  QualityMonitorSourceDetail,
  QualityMonitorSourceRecord,
  QualityRegexRuleRecord,
  QualityStrategyDetail,
  QualityRecommendationRun,
  QualityRecommendationSettings,
  QualityStrategyOptionRecord,
  QualityTaskRecord,
  QualityTaskRunRecord,
  QualityStrategyVersionRecord,
  QualityMonitorTableRecord,
} from "../types/api";
import { getSelectedProjectHeaders } from "./projectContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface QualityAssignableUser {
  id: number;
  username: string;
  displayName: string;
  roleCode: string;
  roleName: string;
}

export interface QualityMonitorSourcePayload {
  scopeMode: "all" | "manual";
  selectedTables: string[];
  detailTableName?: string;
  statsTableName?: string;
  status?: "active" | "inactive";
}

export interface QualitySourcePayload {
  sourceName: string;
  sourceCode: string;
  sourceType: string;
  ownerName?: string;
  status?: "active" | "inactive";
  connectionConfig?: Record<string, unknown>;
}

export interface QualityRegexRulePayload {
  id?: number;
  ruleCode: string;
  ruleName: string;
  ruleScene?: string;
  regexPattern: string;
  matchExamples?: string[];
  mismatchExamples?: string[];
  severity?: "low" | "medium" | "high";
  status?: "active" | "inactive";
  isBuiltin?: boolean;
}

export interface QualityRegexRuleAnalysisPayload {
  ruleName: string;
  ruleScene?: "compliance" | "general";
  currentRuleCode?: string;
}

export interface QualityRegexRuleAnalysisResult {
  ruleCode: string;
  regexPattern: string;
  matchExamples: string[];
  mismatchExamples: string[];
  severity: "low" | "medium" | "high";
  reason?: string;
  modelName?: string | null;
}

export interface QualityDictionaryPayload extends Omit<QualityDictionaryRecord, "id" | "itemCount" | "createdAt" | "updatedAt"> {
  id?: number;
}

export interface QualityDictionaryBusinessSystem {
  id: number;
  systemName: string;
  systemCode: string;
  systemShortName?: string | null;
}

export interface QualityDictionaryPreviewPayload {
  sourceId: number;
  sourceTable: string;
  codeField: string;
  valueField?: string;
  labelField?: string;
  filterConfig?: Array<{ field: string; operator: string; value?: string | number | Array<string | number> | null }>;
  limit?: number;
}

export interface QualityDictionaryPreviewResult extends QualityDictionaryPreviewPayload {
  sourceCode: string;
  sourceName: string;
  itemCount: number;
  items: NonNullable<QualityDictionaryRecord["items"]>;
}

export interface QualityDictionarySourcePreviewPayload {
  sourceId: number;
  sourceTable: string;
  filterConfig?: Array<{ field: string; operator: string; value?: string | number | Array<string | number> | null }>;
  limit?: number;
}

export interface QualityDictionarySourcePreviewResult extends QualityDictionarySourcePreviewPayload {
  sourceCode: string;
  sourceName: string;
  columns: DataSourceColumn[];
  rowCount: number;
  rows: Array<Record<string, unknown>>;
}

export interface QualityDictionaryAnalysisFieldMapping {
  tableMode: "single" | "combined";
  dictionaryTypeField?: string;
  dictionaryNameField?: string;
  itemCodeField: string;
  itemValueField: string;
  itemLabelField: string;
  dictionaryName?: string;
  dictionaryCode?: string;
  reason?: string;
}

export interface QualityDictionaryAnalysisCandidate {
  key: string;
  dictName: string;
  dictCode: string;
  dictDesc: string;
  groupValue?: string | number | null;
  filterConfig: NonNullable<QualityDictionaryRecord["filterConfig"]>;
  itemCount: number;
  items: NonNullable<QualityDictionaryRecord["items"]>;
}

export interface QualityDictionaryAnalysisPayload {
  sourceSystemId: number;
  sourceId: number;
  sourceTable: string;
  sampleSize?: number;
  sampleMode?: "random" | "head";
  fieldMapping?: QualityDictionaryAnalysisFieldMapping;
}

export interface QualityDictionaryAnalysisResult {
  sourceSystem: QualityDictionaryBusinessSystem;
  source: { id: number; sourceCode: string; sourceName: string };
  sourceTable: string;
  tableComment?: string;
  sampleSize: number;
  sampleMode: "random" | "head";
  modelUsed: boolean;
  modelName?: string | null;
  fieldMapping: QualityDictionaryAnalysisFieldMapping;
  columns: DataSourceColumn[];
  candidates: QualityDictionaryAnalysisCandidate[];
}

export interface QualityStrategyDraftPayload {
  summary?: string;
  fieldStrategies: QualityStrategyDetail["fields"];
  advancedRules?: NonNullable<QualityStrategyDetail["currentVersion"]>["advancedRules"];
  rowRules?: QualityStrategyDetail["rowRules"];
  tableRules?: QualityStrategyDetail["tableRules"];
  statRules?: QualityStrategyDetail["statRules"];
  crossTableRules?: QualityStrategyDetail["crossTableRules"];
}

export interface QualityAiConfigPayload {
  defaultModelProviderId?: number | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  thinkingEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
  thinkingBudget?: number | null;
  systemPrompt?: string;
}

export interface QualityTaskPayload {
  taskName: string;
  taskCode: string;
  strategyVersionId: number;
  fetchMode: "full" | "incremental" | "sample";
  fetchConfig?: {
    incrementalColumn?: string;
    incrementalMode?: "cursor" | "time_window";
    startValue?: unknown;
    startValueMode?: "literal" | "dynamic_time";
    startValueFormatType?: "date" | "datetime" | "compact_date" | "compact_datetime" | "month" | "epoch_seconds" | "epoch_millis";
    startValueOffsetValue?: number;
    startValueOffsetUnit?: "second" | "minute" | "hour" | "day" | "month" | "year";
    startValueAnchor?: "now" | "day_start" | "day_end";
    endValue?: unknown;
    endValueMode?: "literal" | "dynamic_time";
    endValueFormatType?: "date" | "datetime" | "compact_date" | "compact_datetime" | "month" | "epoch_seconds" | "epoch_millis";
    endValueOffsetValue?: number;
    endValueOffsetUnit?: "second" | "minute" | "hour" | "day" | "month" | "year";
    endValueAnchor?: "now" | "day_start" | "day_end";
    lastValue?: unknown;
    lastRunStartValue?: unknown;
    lastRunEndValue?: unknown;
    lastRunAt?: string;
    sampleSize?: number;
    systemTimeField?: string;
    systemTimeFormatType?: "date" | "datetime" | "compact_date" | "compact_datetime" | "month" | "epoch_seconds" | "epoch_millis";
    systemTimeOffsetValue?: number;
    systemTimeOffsetUnit?: "second" | "minute" | "hour" | "day" | "month" | "year";
  };
  scheduleEnabled?: boolean;
  scheduleConfig?: {
    scheduleType: "manual" | "interval" | "daily" | "weekly" | "monthly" | "cron";
    cronExpression?: string;
    intervalMs?: number;
    runTime?: string;
    weekDays?: number[];
    monthDay?: number;
    timezone?: string;
  };
  status?: "draft" | "active" | "paused" | "stopped";
  ownerName?: string;
  detailTableName?: string;
  statsTableName?: string;
}

export interface QualityTaskSqlPreview {
  taskName: string;
  taskCode: string;
  fetchMode: "full" | "incremental" | "sample" | string;
  sourceFilterSql: string;
  nextCursorValue?: unknown;
  resolvedParameters?: {
    systemTimeCutoff?: unknown;
    incrementalStartValue?: unknown;
    incrementalEndValue?: unknown;
  };
  sqlBundle?: Record<string, unknown> | null;
  sqlContent: string;
}

export function fetchQualitySources(token: string, options?: { includeTableStats?: boolean }) {
  const searchParams = new URLSearchParams();
  if (options?.includeTableStats === false) {
    searchParams.set("includeTableStats", "false");
  }
  const query = searchParams.toString();
  return http<ApiEnvelope<QualityMonitorSourceRecord[]>>(`/quality-control/data-sources${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualitySourceTables(token: string, sourceId: number) {
  return http<ApiEnvelope<DataSourceTable[]>>(`/quality-control/data-sources/${sourceId}/tables`, undefined, token);
}

export function fetchQualitySourceColumns(token: string, sourceId: number, tableName: string) {
  return http<ApiEnvelope<DataSourceColumn[]>>(
    `/quality-control/data-sources/${sourceId}/tables/${encodeURIComponent(tableName)}/columns`,
    undefined,
    token
  );
}

export function createQualitySource(token: string, payload: QualitySourcePayload) {
  return http<ApiEnvelope<DataSourceRecord>>("/quality-control/data-sources", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateQualitySource(token: string, sourceId: number, payload: QualitySourcePayload) {
  return http<ApiEnvelope<DataSourceRecord>>(`/quality-control/data-sources/${sourceId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteQualitySource(token: string, sourceId: number) {
  return http<ApiEnvelope<{ id: number }>>(`/quality-control/data-sources/${sourceId}`, {
    method: "DELETE",
  }, token);
}

export function fetchQualitySourceMonitor(token: string, sourceId: number) {
  return http<ApiEnvelope<QualityMonitorSourceDetail>>(`/quality-control/data-sources/${sourceId}/monitor`, undefined, token);
}

export function saveQualitySourceMonitor(token: string, sourceId: number, payload: QualityMonitorSourcePayload) {
  return http<ApiEnvelope<QualityMonitorSourceDetail>>(`/quality-control/data-sources/${sourceId}/monitor`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function syncQualitySourceTables(token: string, sourceId: number) {
  return http<ApiEnvelope<QualityMonitorSourceDetail>>(`/quality-control/data-sources/${sourceId}/sync-tables`, {
    method: "POST",
  }, token);
}

export function fetchQualityRegexRules(token: string) {
  return http<ApiEnvelope<QualityRegexRuleRecord[]>>("/quality-control/rules/regex", undefined, token);
}

export function analyzeQualityRegexRule(token: string, payload: QualityRegexRuleAnalysisPayload) {
  return http<ApiEnvelope<QualityRegexRuleAnalysisResult>>("/quality-control/rules/regex/ai-analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchQualityAiConfigs(token: string) {
  return http<ApiEnvelope<QualityAiConfigRecord[]>>("/quality-control/ai-configs", undefined, token);
}

export function fetchQualityAiConfigVersions(token: string, id: number) {
  return http<ApiEnvelope<QualityAiConfigVersionRecord[]>>(`/quality-control/ai-configs/${id}/versions`, undefined, token);
}

export function updateQualityAiConfig(token: string, id: number, payload: QualityAiConfigPayload) {
  return http<ApiEnvelope<QualityAiConfigRecord>>(`/quality-control/ai-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function saveQualityRegexRule(token: string, payload: QualityRegexRulePayload) {
  return http<ApiEnvelope<QualityRegexRuleRecord>>("/quality-control/rules/regex", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteQualityRegexRule(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/quality-control/rules/regex/${id}`, {
    method: "DELETE",
  }, token);
}

export function fetchQualityDictionaries(token: string) {
  return http<ApiEnvelope<QualityDictionaryRecord[]>>("/quality-control/rules/dictionaries", undefined, token);
}

export function fetchQualityDictionaryBusinessSystems(token: string) {
  return http<ApiEnvelope<QualityDictionaryBusinessSystem[]>>("/quality-control/rules/dictionaries/options/business-systems", undefined, token);
}

export function previewQualityDictionary(token: string, payload: QualityDictionaryPreviewPayload) {
  return http<ApiEnvelope<QualityDictionaryPreviewResult>>("/quality-control/rules/dictionaries/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function previewQualityDictionarySource(token: string, payload: QualityDictionarySourcePreviewPayload) {
  return http<ApiEnvelope<QualityDictionarySourcePreviewResult>>("/quality-control/rules/dictionaries/source-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchQualityDictionaryDetail(token: string, id: number) {
  return http<ApiEnvelope<QualityDictionaryRecord>>(`/quality-control/rules/dictionaries/${id}`, undefined, token);
}

export function saveQualityDictionary(token: string, payload: QualityDictionaryPayload) {
  return http<ApiEnvelope<QualityDictionaryRecord>>("/quality-control/rules/dictionaries", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function analyzeQualityDictionaryTable(token: string, payload: QualityDictionaryAnalysisPayload) {
  return http<ApiEnvelope<QualityDictionaryAnalysisResult>>("/quality-control/rules/dictionaries/ai-analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function batchSaveQualityDictionaries(token: string, dictionaries: QualityDictionaryPayload[]) {
  return http<ApiEnvelope<QualityDictionaryRecord[]>>("/quality-control/rules/dictionaries/batch", {
    method: "POST",
    body: JSON.stringify({ dictionaries }),
  }, token);
}

export function deleteQualityDictionary(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/quality-control/rules/dictionaries/${id}`, {
    method: "DELETE",
  }, token);
}

export function batchDeleteQualityDictionaries(token: string, ids: number[]) {
  return http<ApiEnvelope<{ deletedCount: number }>>("/quality-control/rules/dictionaries/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  }, token);
}

export function fetchQualityTaskStrategyOptions(token: string) {
  return http<ApiEnvelope<QualityStrategyOptionRecord[]>>("/quality-control/tasks/strategy-options", undefined, token);
}

export function fetchQualityTasks(token: string, filters?: { sourceId?: number; status?: string; keyword?: string }) {
  const searchParams = new URLSearchParams();
  if (filters?.sourceId) searchParams.set("sourceId", String(filters.sourceId));
  if (filters?.status) searchParams.set("status", filters.status);
  if (filters?.keyword) searchParams.set("keyword", filters.keyword);
  const query = searchParams.toString();
  return http<ApiEnvelope<QualityTaskRecord[]>>(`/quality-control/tasks${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualityTaskDetail(token: string, id: number) {
  return http<ApiEnvelope<QualityTaskRecord>>(`/quality-control/tasks/${id}`, undefined, token);
}

export function createQualityTask(token: string, payload: QualityTaskPayload) {
  return http<ApiEnvelope<QualityTaskRecord>>("/quality-control/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function previewQualityTaskSql(token: string, payload: QualityTaskPayload) {
  return http<ApiEnvelope<QualityTaskSqlPreview>>("/quality-control/tasks/preview-sql", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateQualityTask(token: string, id: number, payload: Partial<QualityTaskPayload>) {
  return http<ApiEnvelope<QualityTaskRecord>>(`/quality-control/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function previewExistingQualityTaskSql(token: string, id: number, payload: Partial<QualityTaskPayload>) {
  return http<ApiEnvelope<QualityTaskSqlPreview>>(`/quality-control/tasks/${id}/preview-sql`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteQualityTask(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/quality-control/tasks/${id}`, {
    method: "DELETE",
  }, token);
}

export function startQualityTask(token: string, id: number) {
  return http<ApiEnvelope<QualityTaskRecord>>(`/quality-control/tasks/${id}/start`, {
    method: "POST",
  }, token);
}

export function stopQualityTask(token: string, id: number) {
  return http<ApiEnvelope<QualityTaskRecord>>(`/quality-control/tasks/${id}/stop`, {
    method: "POST",
  }, token);
}

export function runQualityTaskNow(token: string, id: number) {
  return http<ApiEnvelope<QualityTaskRecord>>(`/quality-control/tasks/${id}/run`, {
    method: "POST",
  }, token);
}

export function fetchQualityTaskRuns(token: string, id: number, limit = 20) {
  return http<ApiEnvelope<QualityTaskRunRecord[]>>(`/quality-control/tasks/${id}/runs?limit=${limit}`, undefined, token);
}

export function fetchQualityStrategyTables(token: string, filters?: { sourceId?: number; strategyStatus?: string; businessSystemId?: number; keyword?: string }) {
  const searchParams = new URLSearchParams();
  if (filters?.sourceId) searchParams.set("sourceId", String(filters.sourceId));
  if (filters?.strategyStatus) searchParams.set("strategyStatus", String(filters.strategyStatus));
  if (filters?.businessSystemId) searchParams.set("businessSystemId", String(filters.businessSystemId));
  if (filters?.keyword) searchParams.set("keyword", String(filters.keyword));
  const query = searchParams.toString();
  return http<ApiEnvelope<QualityMonitorTableRecord[]>>(`/quality-control/strategies/tables${query ? `?${query}` : ""}`, undefined, token);
}

export function deleteQualityStrategyTable(token: string, monitorTableId: number) {
  return http<ApiEnvelope<{ id: number; sourceId: number; tableName: string }>>(`/quality-control/strategies/tables/${monitorTableId}`, {
    method: "DELETE",
  }, token);
}

export function fetchQualityStrategyDetail(token: string, monitorTableId: number) {
  return http<ApiEnvelope<QualityStrategyDetail>>(`/quality-control/strategies/tables/${monitorTableId}`, undefined, token);
}

export function recommendQualityStrategy(token: string, monitorTableId: number, payload: QualityRecommendationSettings) {
  return http<ApiEnvelope<QualityRecommendationRun>>(`/quality-control/strategies/tables/${monitorTableId}/recommend`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function startQualityRecommendation(token: string, monitorTableId: number, payload: QualityRecommendationSettings) {
  return http<ApiEnvelope<QualityRecommendationRun>>(`/quality-control/strategies/tables/${monitorTableId}/recommendations`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchQualityRecommendationRun(token: string, monitorTableId: number, runId: number) {
  return http<ApiEnvelope<QualityRecommendationRun>>(`/quality-control/strategies/tables/${monitorTableId}/recommendations/${runId}`, undefined, token);
}

export function applyQualityRecommendationRun(token: string, monitorTableId: number, runId: number, payload: QualityStrategyDraftPayload & { reviewedRuleIds?: string[] }) {
  return http<ApiEnvelope<QualityStrategyDetail>>(`/quality-control/strategies/tables/${monitorTableId}/recommendations/${runId}/apply`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function rejectQualityRecommendationRun(token: string, monitorTableId: number, runId: number) {
  return http<ApiEnvelope<QualityRecommendationRun>>(`/quality-control/strategies/tables/${monitorTableId}/recommendations/${runId}/reject`, {
    method: "POST",
  }, token);
}

export function saveQualityStrategyDraft(token: string, monitorTableId: number, payload: QualityStrategyDraftPayload) {
  return http<ApiEnvelope<QualityStrategyDetail>>(`/quality-control/strategies/tables/${monitorTableId}/save-draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function submitQualityStrategy(token: string, monitorTableId: number, payload: QualityStrategyDraftPayload) {
  return http<ApiEnvelope<QualityStrategyDetail>>(`/quality-control/strategies/tables/${monitorTableId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function fetchQualityStrategyVersions(token: string, monitorTableId: number) {
  return http<ApiEnvelope<QualityStrategyVersionRecord[]>>(`/quality-control/strategies/tables/${monitorTableId}/versions`, undefined, token);
}

export function deleteQualityStrategyVersion(token: string, monitorTableId: number, versionId: number) {
  return http<ApiEnvelope<{ id: number; monitorTableId: number; versionNo: number }>>(`/quality-control/strategies/tables/${monitorTableId}/versions/${versionId}`, {
    method: "DELETE",
  }, token);
}

export function fetchQualityStrategyVersionSql(token: string, versionId: number) {
  return http<ApiEnvelope<{ versionId: number; versionNo: number; versionStatus: string; sqlContent: string; sqlBundle?: Record<string, unknown> | null }>>(`/quality-control/strategies/versions/${versionId}/sql`, undefined, token);
}

export function fetchQualityAnalysisOverview(token: string, sourceId: number, filters?: { latestOnly?: boolean }) {
  const searchParams = new URLSearchParams();
  if (filters?.latestOnly) searchParams.set("latestOnly", "true");
  const query = searchParams.toString();
  return http<ApiEnvelope<QualityAnalysisOverview>>(`/quality-control/analysis/${sourceId}/overview${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualityAnalysisStats(token: string, sourceId: number, filters?: { tableName?: string; ruleCode?: string; batchId?: string; latestOnly?: boolean; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (filters?.tableName) searchParams.set("tableName", filters.tableName);
  if (filters?.ruleCode) searchParams.set("ruleCode", filters.ruleCode);
  if (filters?.batchId) searchParams.set("batchId", filters.batchId);
  if (filters?.latestOnly) searchParams.set("latestOnly", "true");
  if (filters?.limit) searchParams.set("limit", String(filters.limit));
  const query = searchParams.toString();
  return http<ApiEnvelope<QualityIssueStatRecord[]>>(`/quality-control/analysis/${sourceId}/stats${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualityAnalysisDetails(token: string, sourceId: number, filters?: { tableName?: string; ruleCode?: string; batchId?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (filters?.tableName) searchParams.set("tableName", filters.tableName);
  if (filters?.ruleCode) searchParams.set("ruleCode", filters.ruleCode);
  if (filters?.batchId) searchParams.set("batchId", filters.batchId);
  if (filters?.limit) searchParams.set("limit", String(filters.limit));
  const query = searchParams.toString();
  return http<ApiEnvelope<QualityIssueDetailRecord[]>>(`/quality-control/analysis/${sourceId}/details${query ? `?${query}` : ""}`, undefined, token);
}

export function deleteQualityAnalysisTableResults(token: string, sourceId: number, tableName: string) {
  return http<ApiEnvelope<{ sourceId: number; tableName: string; deletedBatchCount: number }>>(
    `/quality-control/analysis/${sourceId}/tables/${encodeURIComponent(tableName)}`,
    { method: "DELETE" },
    token
  );
}

export function fetchQualityInsightsOverview(token: string, filters?: { latestOnly?: boolean }) {
  const searchParams = new URLSearchParams();
  if (filters?.latestOnly) searchParams.set("latestOnly", "true");
  const query = searchParams.toString();
  return http<ApiEnvelope<any>>(`/quality-control/insights/overview${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualityOpsDashboard(token: string, range: "24h" | "7d" | "30d" = "7d", businessSystemId?: number) {
  const searchParams = new URLSearchParams({ range });
  if (businessSystemId) searchParams.set("businessSystemId", String(businessSystemId));
  return http<ApiEnvelope<any>>(`/quality-control/insights/ops-dashboard?${searchParams.toString()}`, undefined, token);
}

export type QualityOpsDrilldownParams = {
  scene: string;
  range: "24h" | "7d" | "30d";
  businessSystemId?: number;
  targetBusinessSystemId?: number;
  monitorTableId?: number;
  strategyVersionId?: number;
  ruleCode?: string;
  fieldName?: string;
  dimension?: string;
  itemType?: "issue" | "finding";
  itemId?: number;
};

export function fetchQualityOpsDrilldown(token: string, filters: QualityOpsDrilldownParams) {
  const searchParams = new URLSearchParams({ scene: filters.scene, range: filters.range });
  Object.entries(filters).forEach(([key, value]) => {
    if (["scene", "range"].includes(key) || value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });
  return http<ApiEnvelope<any>>(`/quality-control/insights/ops-drilldown?${searchParams.toString()}`, undefined, token);
}

export function fetchQualitySystemInsights(token: string, filters?: { latestOnly?: boolean; businessSystemId?: number }) {
  const searchParams = new URLSearchParams();
  if (filters?.latestOnly) searchParams.set("latestOnly", "true");
  if (filters?.businessSystemId) searchParams.set("businessSystemId", String(filters.businessSystemId));
  const query = searchParams.toString();
  return http<ApiEnvelope<any[]>>(`/quality-control/insights/systems${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualityTableInsights(token: string, filters?: { businessSystemId?: number; latestOnly?: boolean }) {
  const searchParams = new URLSearchParams();
  if (filters?.businessSystemId) searchParams.set("businessSystemId", String(filters.businessSystemId));
  if (filters?.latestOnly) searchParams.set("latestOnly", "true");
  const query = searchParams.toString();
  return http<ApiEnvelope<any[]>>(`/quality-control/insights/tables${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualityInsightTags(token: string) {
  return http<ApiEnvelope<Array<{ id: number; tagName: string; tagColor: string; tagDesc?: string }>>>("/quality-control/insights/tags", undefined, token);
}

export function fetchQualityInsightBusinessSystems(token: string) {
  return http<ApiEnvelope<Array<{ id: number; systemName: string; systemCode: string }>>>("/quality-control/insights/business-systems", undefined, token);
}

export function saveQualityInsightTag(token: string, payload: { tagName: string; tagColor?: string; tagDesc?: string }) {
  return http<ApiEnvelope<any>>("/quality-control/insights/tags", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateQualityMonitorTableGovernance(token: string, monitorTableId: number, payload: { businessSystemId?: number | null; importanceLevel?: string; tagIds?: number[] }) {
  return http<ApiEnvelope<any>>(`/quality-control/insights/tables/${monitorTableId}/governance`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export function fetchQualityTableBatches(token: string, monitorTableId: number) {
  return http<ApiEnvelope<any[]>>(`/quality-control/insights/table-batches?monitorTableId=${monitorTableId}`, undefined, token);
}

export function fetchQualityBatchComparison(token: string, monitorTableId: number, currentResultBatchId?: number, previousResultBatchId?: number) {
  const searchParams = new URLSearchParams({ monitorTableId: String(monitorTableId) });
  if (currentResultBatchId) searchParams.set("currentResultBatchId", String(currentResultBatchId));
  if (previousResultBatchId) searchParams.set("previousResultBatchId", String(previousResultBatchId));
  return http<ApiEnvelope<any>>(`/quality-control/insights/batch-comparison?${searchParams.toString()}`, undefined, token);
}

export function fetchQualityObservability(token: string, monitorTableId: number) {
  return http<ApiEnvelope<any>>(`/quality-control/insights/observability?monitorTableId=${monitorTableId}`, undefined, token);
}

export function fetchQualityReports(token: string) {
  return http<ApiEnvelope<any[]>>("/quality-control/insights/reports", undefined, token);
}

export function fetchQualityReportCenterOverview(token: string) {
  return http<ApiEnvelope<any>>("/quality-control/insights/report-center-overview", undefined, token);
}

export function fetchQualityReportDetail(token: string, id: number) {
  return http<ApiEnvelope<any>>(`/quality-control/insights/reports/${id}`, undefined, token);
}

export function fetchQualityReportComparisonOptions(token: string, comparisonType?: "table_report" | "system_report") {
  const query = comparisonType ? `?comparisonType=${comparisonType}` : "";
  return http<ApiEnvelope<any[]>>(`/quality-control/insights/report-comparison-options${query}`, undefined, token);
}

export function previewQualityReportComparison(token: string, payload: Record<string, unknown>) {
  return http<ApiEnvelope<any>>("/quality-control/insights/report-comparisons/preview", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function createQualityInsightReport(token: string, payload: { reportScope: string; comparisonType?: "batch" | "table_report" | "system_report"; scopeRefId?: number | null; reportTitle?: string; useAi?: boolean; resultBatchId?: number; currentResultBatchId?: number; previousResultBatchId?: number; currentReportId?: number; baselineReportId?: number }) {
  return http<ApiEnvelope<any>>("/quality-control/insights/reports", { method: "POST", body: JSON.stringify(payload) }, token);
}

async function downloadQualityReportFile(token: string, id: number, format: "md" | "docx", fallbackFileName: string) {
  const response = await fetch(`${API_BASE_URL}/quality-control/insights/reports/${id}/report.${format}`, {
    headers: { Authorization: `Bearer ${token}`, ...getSelectedProjectHeaders() },
  });
  if (!response.ok) throw new Error(await response.text() || "下载质量报告失败");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers.get("content-disposition") || "";
  const matchedFileName = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1];
  link.href = url;
  link.download = decodeURIComponent(matchedFileName || fallbackFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function downloadQualityReportMarkdown(token: string, id: number, fallbackFileName = `quality_report_${id}.md`) {
  return downloadQualityReportFile(token, id, "md", fallbackFileName);
}

export function downloadQualityReportWord(token: string, id: number, fallbackFileName = `quality_report_${id}.docx`) {
  return downloadQualityReportFile(token, id, "docx", fallbackFileName);
}


export function deleteQualityReport(token: string, id: number) {
  return http<ApiEnvelope<{ id: number; deleted: boolean }>>(`/quality-control/insights/reports/${id}`, { method: "DELETE" }, token);
}

export function fetchQualityIssues(token: string, filters?: { businessSystemId?: number }) {
  const searchParams = new URLSearchParams();
  if (filters?.businessSystemId) searchParams.set("businessSystemId", String(filters.businessSystemId));
  const query = searchParams.toString();
  return http<ApiEnvelope<any[]>>(`/quality-control/insights/issues${query ? `?${query}` : ""}`, undefined, token);
}

export function fetchQualityFindings(token: string, status?: string) {
  return http<ApiEnvelope<any[]>>(`/quality-control/insights/findings${status ? `?status=${encodeURIComponent(status)}` : ""}`, undefined, token);
}

export function fetchQualityAssignableUsers(token: string) {
  return http<ApiEnvelope<QualityAssignableUser[]>>("/quality-control/insights/assignable-users", undefined, token);
}

export function reviewQualityFinding(token: string, id: number, payload: { action: string; note?: string; ownerUserId?: number; dueDate?: string }) {
  return http<ApiEnvelope<any>>(`/quality-control/insights/findings/${id}/review`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function fetchQualityIssueDetail(token: string, id: number) {
  return http<ApiEnvelope<any>>(`/quality-control/insights/issues/${id}`, undefined, token);
}

export function updateQualityIssueStatus(token: string, id: number, payload: { issueStatus: string; note?: string; ownerUserId?: number; dueDate?: string }) {
  return http<ApiEnvelope<any>>(`/quality-control/insights/issues/${id}/status`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function refreshQualityFindings(token: string) {
  return http<ApiEnvelope<{ total: number }>>("/quality-control/insights/findings/refresh", { method: "POST" }, token);
}

export function runQualityAiAnalysis(token: string, payload: { scopeType: string; scopeRefId?: number | null }) {
  return http<ApiEnvelope<any>>("/quality-control/insights/ai-analysis", { method: "POST", body: JSON.stringify(payload) }, token);
}

export interface QualityOpsRobotCard {
  type: "stats" | "table";
  title: string;
  items?: Array<{ label: string; value: string | number }>;
  columns?: string[];
  rows?: Array<Record<string, string | number | null | undefined>>;
}

export interface QualityOpsRobotMessage {
  id: number;
  sessionId: number;
  role: "user" | "assistant";
  messageText: string;
  payload?: {
    text?: string;
    cards?: QualityOpsRobotCard[];
    suggestions?: string[];
    readOnly?: boolean;
  } | null;
  createdAt?: string | null;
}

export interface QualityOpsRobotSession {
  id: number;
  userId?: number | null;
  userName: string;
  sessionTitle?: string | null;
  status: string;
  lastMessageAt?: string | null;
  messageCount?: number | null;
  lastPreview?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export function queryQualityOpsRobot(token: string, payload: { question: string; sessionId?: number }) {
  return http<ApiEnvelope<{ sessionId: number; assistantMessage: QualityOpsRobotMessage }>>("/quality-control/insights/robot/query", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function fetchQualityOpsRobotSessions(token: string) {
  return http<ApiEnvelope<{ sessions: QualityOpsRobotSession[] }>>("/quality-control/insights/robot/sessions", undefined, token);
}

export function fetchQualityOpsRobotSessionMessages(token: string, sessionId: number) {
  return http<ApiEnvelope<{ session: QualityOpsRobotSession; messages: QualityOpsRobotMessage[] }>>(`/quality-control/insights/robot/sessions/${sessionId}/messages`, undefined, token);
}
