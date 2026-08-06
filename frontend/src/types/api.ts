export interface LoginPayload {
  username: string;
  password: string;
}

export interface UserProfile {
  sub: number;
  id?: number;
  username: string;
  displayName: string;
  roleId?: number | null;
  roleCode: string;
  roleType?: string | null;
  roleName?: string | null;
  defaultProjectId?: number | null;
  permissions?: {
    modules: string[];
    mode?: "readonly" | string;
    actions?: string[];
  };
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface ProjectSpaceRecord {
  id: number;
  projectName: string;
  projectCode: string;
  projectType: "standard" | "demo" | "production" | "sandbox" | "government_data_project";
  description?: string | null;
  ownerUserId?: number | null;
  ownerName?: string | null;
  status: "active" | "inactive";
  resourceConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  memberCount?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberRecord {
  id: number;
  projectId: number;
  userId: number;
  username: string;
  displayName: string;
  projectRole: "owner" | "developer" | "operator" | "viewer";
  permissions?: {
    modules: string[];
  };
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSpaceDetail extends ProjectSpaceRecord {
  members: ProjectMemberRecord[];
}

export interface LicenseStatus {
  isActivated: boolean;
  status: "inactive" | "active" | "expired" | "tampered";
  message: string;
  serverTime: string;
  activatedAt?: string;
  expiresAt?: string;
  durationDays?: number;
  activationWindowDays?: number;
  machineCode?: string;
  licensedMachineCode?: string;
  maxConcurrentUsers?: number;
  subject?: string | null;
  productCode?: string;
  features?: string[];
}

export interface PlatformModule {
  key: string;
  name: string;
  description: string;
  capabilities: string[];
  total: number;
}

export interface DashboardStat {
  key: string;
  label: string;
  value: number;
}

export interface PlatformOverview {
  modules: PlatformModule[];
  stats: DashboardStat[];
}

export interface DataSourceRecord {
  id: number;
  sourceName: string;
  sourceCode: string;
  sourceDomain?: string;
  sourceType: string;
  taskReferenceCount?: number;
  sceneReferenceCount?: number;
  connectionConfig?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    rootPath?: string;
    passiveMode?: boolean;
    encoding?: string;
    maxPreviewBytes?: number;
    bootstrapServers?: string;
    bootstrapServer?: string;
    clientId?: string;
    topicPattern?: string;
    fromBeginning?: boolean;
    schema?: string;
    table?: string;
    topic?: string;
    groupId?: string;
    jdbcUrl?: string;
    driverClassName?: string;
    [key: string]: unknown;
  };
  ownerName: string;
  status: string;
  connectionStatus?: "online" | "offline" | "unknown" | "disabled";
  connectionMessage?: string;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceReferencedTask {
  referenceKey?: string;
  referenceType?: "task" | "job";
  id: number;
  taskName: string;
  taskCode: string;
  sourceId: number;
  sourceName?: string;
  targetSourceId: number | null;
  targetSourceName?: string;
  sourceTable?: string;
  targetTable?: string;
  syncMode: "full" | "incremental" | "cdc";
  status: "draft" | "active" | "paused" | "stopped" | "running";
  updatedAt: string;
}

export interface DataSourceTable {
  tableName: string;
  tableType: string;
  tableComment?: string;
  objectType?: "table" | "file" | "topic" | "directory" | string;
  fileSize?: number;
  modifiedAt?: string | null;
  partitionCount?: number;
}

export interface DataSourceColumn {
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  columnType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  columnDefault?: unknown;
  columnKey?: string;
  extra?: string;
  columnComment?: string;
}

export type DataSourceSampleRow = Record<string, unknown>;

export interface DataServiceQueryFilterConfig {
  columnName: string;
  label?: string;
  paramName?: string | null;
  startParamName?: string | null;
  endParamName?: string | null;
  operator: "eq" | "like" | "between";
  required: boolean;
  requirementMode?: "optional" | "required" | "one_of_group";
  requiredGroup?: string | null;
  dataType?: string;
}

export interface DataServiceResponseFieldConfig {
  columnName: string;
  fieldName: string;
  label?: string;
  dataType?: string;
}

export interface DataServiceDataSourceRecord {
  id: number;
  sourceName: string;
  sourceCode: string;
  sourceType: "mysql" | "postgresql" | string;
  connectionConfig?: DataSourceRecord["connectionConfig"];
  ownerName: string;
  status: "active" | "inactive" | string;
  serviceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataServiceSqlPreviewColumn {
  columnName: string;
  label?: string;
  dataType?: string;
}

export interface DataServiceSqlPreviewResult {
  columns: DataServiceSqlPreviewColumn[];
  sampleRows: Array<Record<string, unknown>>;
  rowCount: number;
}

export interface DataServiceRecommendResult {
  serviceName?: string;
  serviceCode?: string | null;
  servicePath?: string;
  requestMethod?: "GET" | "POST";
  serviceType?: "list" | "detail";
  description?: string;
  defaultSortField?: string | null;
  defaultSortOrder?: "asc" | "desc";
  queryFields?: Array<{
    columnName: string;
    operator?: "eq" | "like" | "between";
    required?: boolean;
    requirementMode?: "optional" | "required" | "one_of_group";
    requiredGroup?: string | null;
  }>;
  responseFieldNames?: string[];
  reasoning?: string[];
}

export interface DataServiceRecord {
  id: number;
  serviceName: string;
  serviceCode: string;
  servicePath: string;
  requestMethod: "GET" | "POST";
  dataDomain: string;
  sourceId: number | null;
  sourceName?: string | null;
  sourceType?: string | null;
  serviceMode?: "table" | "sql";
  sourceTable?: string | null;
  sourceSql?: string | null;
  serviceType: "list" | "detail";
  authType: "anonymous" | "token";
  status: "draft" | "published" | "disabled";
  description?: string | null;
  queryConfig: {
    filters: DataServiceQueryFilterConfig[];
    pagination?: boolean;
    defaultPageSize?: number;
    maxPageSize?: number;
    defaultSortField?: string | null;
    defaultSortOrder?: "asc" | "desc" | string;
  };
  responseConfig: {
    fields: DataServiceResponseFieldConfig[];
  };
  ownerName: string;
  publishedAt?: string | null;
  lastCalledAt?: string | null;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  avgLatencyMs: number;
  authorizationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataServiceAppRecord {
  id: number;
  departmentName?: string | null;
  appName: string;
  appCode: string;
  appToken: string;
  contactPhone?: string | null;
  appDescription?: string | null;
  ownerName: string;
  status: "active" | "inactive";
  authorizationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataServiceAuthorizationRecord {
  id: number;
  serviceId: number;
  serviceName: string;
  serviceCode: string;
  appId: number;
  appName: string;
  appCode: string;
  status: "active" | "inactive";
  rateLimitPerMinute: number;
  dailyLimit: number;
  ipWhitelist: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DataServiceAiConfigRecord {
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
  ownerName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface DataServiceLogRecord {
  id: number;
  serviceId: number;
  appId: number | null;
  serviceName?: string | null;
  serviceCode: string;
  appName?: string | null;
  appCode?: string | null;
  servicePath: string;
  requestMethod: string;
  authType: string;
  requestParams: Record<string, unknown>;
  responseStatus: string;
  success: boolean;
  httpStatus: number;
  latencyMs: number;
  clientIp?: string | null;
  errorMessage?: string | null;
  calledAt: string;
}

export interface DataServiceOverview {
  totalServices: number;
  publishedServices: number;
  totalApps: number;
  totalCallsToday: number;
  successRateToday: number;
  avgLatencyMsToday: number;
  topServices: Array<{
    serviceId: number;
    serviceName: string;
    serviceCode: string;
    callCount: number;
  }>;
  topApps: Array<{
    appId: number;
    appName: string;
    appCode: string;
    callCount: number;
  }>;
  recentErrors: Array<{
    id: number;
    serviceId: number;
    serviceName: string;
    serviceCode: string;
    appName?: string | null;
    errorMessage?: string | null;
    httpStatus: number;
    calledAt: string;
  }>;
}

export interface QualityMonitorSourceRecord {
  id?: number | null;
  sourceId: number;
  sourceDomain?: string;
  sourceName: string;
  sourceCode: string;
  sourceType: string;
  connectionConfig?: DataSourceRecord["connectionConfig"];
  ownerName?: string;
  sourceStatus?: string;
  sourceUpdatedAt?: string;
  scopeMode?: "all" | "manual";
  selectedTables?: string[];
  selectedTableCount?: number;
  detailTableName?: string;
  statsTableName?: string;
  status?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  databaseTableCount?: number | null;
  syncedTableCount?: number;
  submittedStrategyCount?: number;
  supportedQuality?: boolean;
}

export interface QualityMonitorTableRecord {
  id: number;
  monitorSourceId: number;
  sourceId: number;
  sourceName?: string;
  sourceCode?: string;
  sourceType?: string;
  tableName: string;
  fullTableName?: string | null;
  tableComment?: string | null;
  businessSystemId?: number | null;
  businessSystemName?: string | null;
  importanceLevel?: "critical" | "high" | "normal" | "low" | string;
  qualityTags?: string[];
  qualityTagIds?: number[];
  enabled: boolean;
  strategyStatus: "pending" | "draft" | "recommended" | "submitted" | "disabled" | string;
  currentSummary?: string | null;
  columnSnapshot?: DataSourceColumn[];
  lastProfile?: Record<string, unknown> | null;
  lastSyncAt?: string | null;
  lastRecommendedAt?: string | null;
  lastSubmittedAt?: string | null;
  strategyId?: number | null;
  currentVersionNo?: number | null;
  currentVersionId?: number | null;
  configuredRuleCount?: number;
  detailTableName?: string;
  statsTableName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QualityMonitorSourceDetail {
  source: DataSourceRecord;
  monitorSource: QualityMonitorSourceRecord | null;
  monitorTables: QualityMonitorTableRecord[];
  supportedQuality: boolean;
}

export interface QualityRegexRuleRecord {
  id: number;
  ruleCode: string;
  ruleName: string;
  ruleScene: string;
  regexPattern: string;
  matchExamples: string[];
  mismatchExamples: string[];
  severity: "low" | "medium" | "high" | string;
  status: "active" | "inactive" | string;
  isBuiltin: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QualityDictionaryItemRecord {
  id?: number;
  dictId?: number;
  itemCode: string;
  itemLabel: string;
  itemValue?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  sortOrder: number;
  status: "active" | "inactive" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QualityDictionaryRecord {
  id: number;
  dictCode: string;
  dictName: string;
  dictCategory: string;
  valueType: "string" | "number" | string;
  dictDesc?: string | null;
  registrationMode?: "manual" | "table" | string;
  sourceSystemId?: number | null;
  sourceSystemCode?: string | null;
  sourceSystemName?: string | null;
  sourceId?: number | null;
  sourceCode?: string | null;
  sourceName?: string | null;
  sourceTable?: string | null;
  codeField?: string | null;
  valueField?: string | null;
  labelField?: string | null;
  filterConfig?: Array<{
    field: string;
    operator: string;
    value?: string | number | Array<string | number> | null;
  }>;
  lastRegisteredAt?: string | null;
  status: "active" | "inactive" | string;
  createdBy?: string;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
  items?: QualityDictionaryItemRecord[];
}

export interface QualityStrategyFieldRecord {
  columnName: string;
  columnComment?: string;
  dataType?: string;
  columnType?: string;
  isNullable?: boolean;
  sampleValues: string[];
  valueRate: number;
  isPrimaryKey: boolean;
  nonNullCheck: boolean;
  complianceRuleCodes: string[];
  complianceRules?: Array<{
    ruleCode: string;
    ruleName: string;
    regexPattern: string;
    severity?: string;
  }>;
  duplicateCheck: boolean;
  recommendationReason?: string;
  businessRole?: string;
  semanticEvidence?: string;
  assetEvidence?: string;
  confidence?: "high" | "medium" | "low" | string;
  valueRangeConfig?: {
    mode: "none" | "dictionary" | "custom_list" | "number_range" | "date_range" | "list" | "range" | string;
    sourceType?: string | null;
    sourceId?: number | null;
    sourceLabel?: string;
    allowedValues?: string[];
    minValue?: number | null;
    maxValue?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  valueRangeSnapshot?: {
    mode: "none" | "list" | "range" | "date_range" | string;
    sourceType?: string | null;
    sourceId?: number | null;
    sourceLabel?: string;
    allowedValues?: string[];
    minValue?: number | null;
    maxValue?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  };
}

export interface QualityAdvancedRuleRecord {
  ruleId: string;
  ruleName: string;
  ruleScope: "table" | "row" | "cross_table" | "aggregate" | string;
  ruleCategory:
    | "conditional_required"
    | "conditional_regex"
    | "field_compare"
    | "composite_unique"
    | "freshness"
    | "cross_table_lookup"
    | "cross_table_consistency"
    | "volume_anomaly"
    | "null_rate_change"
    | "batch_completeness"
    | string;
  enabled: boolean;
  severity: "low" | "medium" | "high" | string;
  description?: string;
  config: Record<string, any>;
}

export interface QualityStrategyVersionRecord {
  id: number;
  strategyId: number;
  versionNo: number;
  versionStatus: "draft" | "recommended" | "submitted" | string;
  profileSnapshot?: Record<string, unknown> | null;
  recommendationContext?: Record<string, unknown> | null;
  fieldStrategies: QualityStrategyFieldRecord[];
  advancedRules?: QualityAdvancedRuleRecord[];
  aiSummaryText?: string | null;
  aiProviderId?: number | null;
  aiModelName?: string | null;
  aiModelVersion?: string | null;
  sqlBundle?: Record<string, unknown> | null;
  sqlContent?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface QualityStrategyRecord {
  id: number;
  monitorTableId: number;
  sourceId: number;
  tableName: string;
  currentVersionNo?: number | null;
  currentVersionId?: number | null;
  strategyStatus: "draft" | "recommended" | "submitted" | string;
  currentSummary?: string | null;
  lastRecommendedAt?: string | null;
  lastSubmittedAt?: string | null;
  submittedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface QualityStrategyDetail {
  monitorTable: QualityMonitorTableRecord;
  strategy: QualityStrategyRecord | null;
  currentVersion: QualityStrategyVersionRecord | null;
  versions: QualityStrategyVersionRecord[];
  fields: QualityStrategyFieldRecord[];
  advancedRules?: QualityAdvancedRuleRecord[];
  ruleSqlMap?: Record<string, string>;
  rowRules?: QualityAdvancedRuleRecord[];
  tableRules?: QualityAdvancedRuleRecord[];
  statRules?: QualityAdvancedRuleRecord[];
  crossTableRules?: QualityAdvancedRuleRecord[];
}

export type QualityRecommendationSampleMode = "random" | "latest" | "head";
export type QualityRecommendationTableKind = "master" | "transaction" | "event" | "batch" | "snapshot" | "reference" | "general";
export type QualityRecommendationDirection = "completeness" | "uniqueness" | "validity" | "consistency" | "timeliness" | "stability" | "referential_integrity";

export interface QualityRecommendationSettings {
  sampleSize?: number;
  sampleMode?: QualityRecommendationSampleMode;
  orderField?: string;
  tableKind?: QualityRecommendationTableKind;
  ruleStrength?: "basic" | "balanced" | "strict";
  monitorDirections?: QualityRecommendationDirection[];
  keyFields?: string[];
  referenceTables?: string[];
  baselineMode?: "last_batch" | "recent_avg";
  lookbackBatches?: number;
  minHistoryBatches?: number;
  warmupPolicy?: "collect_only" | "upper_threshold";
  warmupThreshold?: number | null;
}

export interface QualityRecommendationRun {
  id: number;
  monitorTableId: number;
  sourceId: number;
  tableName: string;
  runStatus: "queued" | "profiling" | "pending_review" | "failed" | "applied" | "rejected" | string;
  samplingConfig: QualityRecommendationSettings;
  profileSnapshot: {
    totalRows?: number;
    sampleSize?: number;
    fields?: QualityStrategyFieldRecord[];
  } | null;
  fieldStrategies: QualityStrategyFieldRecord[];
  advancedRules: QualityAdvancedRuleRecord[];
  summaryText?: string;
  modelUsed: boolean;
  aiModelName?: string | null;
  recommendationContext?: {
    fallbackUsed?: boolean;
    stage?: string;
    modelFailure?: { code?: string; message?: string } | null;
    failure?: { code?: string; message?: string } | null;
    timings?: Record<string, number>;
    assetStats?: Record<string, number | boolean>;
  } | null;
}

export interface QualityAnalysisOverview {
  detailTableName: string;
  statsTableName: string;
  detailTableExists: boolean;
  statsTableExists: boolean;
  totalIssues: number;
  detailIssueCount?: number;
  affectedTables: number;
  batchCount: number;
  latestDetectedAt?: string | null;
  topTables: Array<{ tableName: string; issueRows: number }>;
  topRules: Array<{ ruleCode: string; issueRows: number }>;
}

export interface QualityIssueStatRecord {
  statId: number;
  batchId: string;
  tableName: string;
  tableComment?: string | null;
  ruleCategory: string;
  ruleCode: string;
  ruleName?: string | null;
  ruleDescription?: string | null;
  ruleConfig?: Record<string, unknown>;
  fieldName: string;
  fieldComment?: string | null;
  totalRows: number;
  issueRows: number;
  issueRate: number;
  metricValue?: number | null;
  baselineValue?: number | null;
  thresholdValue?: number | null;
  detectedAt?: string;
  createdAt?: string;
}

export interface QualityIssueDetailRecord {
  issueId: number;
  batchId: string;
  tableName: string;
  tableComment?: string | null;
  ruleCategory: string;
  ruleCode: string;
  ruleName: string;
  ruleDescription?: string | null;
  ruleConfig?: Record<string, unknown>;
  fieldName: string;
  fieldComment?: string | null;
  pkText?: string | null;
  fieldValueText?: string | null;
  issueLevel: string;
  issueMessage?: string | null;
  detectedAt?: string;
  createdAt?: string;
}

export interface QualityAiConfigRecord {
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
  thinkingEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
  thinkingBudget?: number | null;
  systemPrompt?: string | null;
  description?: string | null;
  ownerName: string;
  status: "active" | "inactive" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QualityStrategyOptionRecord {
  monitorTableId: number;
  sourceId: number;
  tableName: string;
  tableComment?: string | null;
  sourceName: string;
  sourceCode: string;
  strategyId: number;
  strategyVersionId: number;
  currentVersionNo: number;
  latestVersionNo?: number | null;
  aiSummaryText?: string | null;
  hasTask?: boolean;
}

export type QualityTaskTimeFormat =
  | "date"
  | "datetime"
  | "compact_date"
  | "compact_datetime"
  | "month"
  | "epoch_seconds"
  | "epoch_millis";

export type QualityTaskTimeOffsetUnit =
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "month"
  | "year";

export type QualityTaskIncrementalMode = "cursor" | "time_window";

export type QualityTaskTimeAnchor = "now" | "day_start" | "day_end";

export interface QualityTaskFetchConfig {
  incrementalColumn?: string;
  incrementalMode?: QualityTaskIncrementalMode;
  startValue?: unknown;
  startValueMode?: "literal" | "dynamic_time";
  startValueFormatType?: QualityTaskTimeFormat;
  startValueOffsetValue?: number;
  startValueOffsetUnit?: QualityTaskTimeOffsetUnit;
  startValueAnchor?: QualityTaskTimeAnchor;
  endValue?: unknown;
  endValueMode?: "literal" | "dynamic_time";
  endValueFormatType?: QualityTaskTimeFormat;
  endValueOffsetValue?: number;
  endValueOffsetUnit?: QualityTaskTimeOffsetUnit;
  endValueAnchor?: QualityTaskTimeAnchor;
  lastValue?: unknown;
  lastRunStartValue?: unknown;
  lastRunEndValue?: unknown;
  lastRunAt?: string | null;
  sampleSize?: number;
  systemTimeField?: string;
  systemTimeFormatType?: QualityTaskTimeFormat;
  systemTimeOffsetValue?: number;
  systemTimeOffsetUnit?: QualityTaskTimeOffsetUnit;
}

export interface QualityTaskScheduleConfig {
  scheduleType: "manual" | "interval" | "daily" | "weekly" | "monthly" | "cron";
  cronExpression?: string;
  intervalMs?: number;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  timezone?: string;
}

export interface QualityTaskRecord {
  id: number;
  taskName: string;
  taskCode: string;
  monitorTableId: number;
  sourceId: number;
  sourceName?: string;
  sourceCode?: string;
  sourceType?: string;
  tableName: string;
  tableComment?: string | null;
  strategyId: number;
  strategyVersionId: number;
  taskVersionNo?: number | null;
  latestVersionNo?: number | null;
  latestStrategyVersionId?: number | null;
  detailTableName: string;
  statsTableName: string;
  fetchMode: "full" | "incremental" | "sample" | string;
  fetchConfig?: QualityTaskFetchConfig;
  scheduleEnabled: boolean;
  scheduleConfig?: QualityTaskScheduleConfig | null;
  status: "draft" | "active" | "paused" | "running" | "stopped" | string;
  ownerName: string;
  lastRunTime?: string | null;
  lastBatchId?: string | null;
  lastRunStatus?: string | null;
  latestExecutionInfo?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  connectionConfig?: DataSourceRecord["connectionConfig"];
}

export interface QualityTaskRunRecord {
  id: number;
  taskId: number;
  runStatus: "pending" | "running" | "completed" | "failed" | string;
  batchId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  issueCount: number;
  statsCount: number;
  errorMessage?: string | null;
  executionInfo?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface ModelProviderRecord {
  id: number;
  configName: string;
  configCode: string;
  providerType: "openai" | "azure_openai" | "anthropic" | "deepseek" | "qwen" | "zhipu" | "baidu" | "custom";
  modelCategory: "chat" | "embedding" | "rerank" | "vision" | "speech";
  modelName: string;
  modelVersion?: string | null;
  baseUrl?: string;
  apiKey: string;
  apiKeyMasked?: string;
  hasApiKey?: boolean;
  organizationId?: string;
  ownerName: string;
  status: "active" | "inactive";
  description?: string;
  extraConfig?: Record<string, unknown>;
  modelCatalog?: Array<{
    name: string;
    label: string;
    versions: Array<{ value: string; label: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SystemKnowledgeDocumentRecord {
  id: number;
  kbId: number;
  fileName: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  parseStatus: string;
  parseSummary?: string | null;
  vectorStatus: string;
  docStatus: string;
  chunkCount: number;
  lastParsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemKnowledgeDocumentChunkPreview {
  id: number;
  chunkIndex: number;
  content: string;
  keywords: string[];
  createdAt: string;
}

export interface SystemKnowledgeDocumentPreview {
  document: SystemKnowledgeDocumentRecord;
  chunks: SystemKnowledgeDocumentChunkPreview[];
  totalChunks: number;
  previewSource: "chunks" | "file" | "summary" | string;
  previewText: string;
  truncated: boolean;
}

export interface SystemKnowledgeBaseRecord {
  id: number;
  kbName: string;
  kbDesc?: string | null;
  tags: string[];
  status: "active" | "inactive" | string;
  createdBy: string;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
  documents?: SystemKnowledgeDocumentRecord[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    defaultProjectId?: number | null;
  };
  message?: string;
}

export interface ReportingOverview {
  totalSources: number;
  totalDatasets: number;
  totalCharts: number;
  totalDashboards: number;
  totalThemeTemplates: number;
}

export interface ReportingDataSourceRecord {
  id: number;
  sourceName: string;
  sourceCode: string;
  sourceType: string;
  connectionConfig?: DataSourceRecord["connectionConfig"];
  ownerName: string;
  status: "active" | "inactive" | string;
  datasetCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportingDatasetFolderRecord {
  id: number;
  folderName: string;
  parentId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportingDatasetFieldRecord {
  columnName: string;
  label?: string;
  dataType?: string;
  role?: "dimension" | "metric" | "time" | "category" | "value" | string;
  aggregation?: "sum" | "avg" | "count" | "count_distinct" | "max" | "min" | null | string;
  format?: string | null;
  visible?: boolean;
}

export interface ReportingDatasetRecord {
  id: number;
  datasetName: string;
  datasetCode: string;
  sourceId: number;
  sourceName?: string | null;
  sourceType?: string | null;
  datasetType: "table" | "sql" | string;
  sourceTable?: string | null;
  sourceSql?: string | null;
  folderId?: number | null;
  folderName?: string | null;
  fields: ReportingDatasetFieldRecord[];
  queryConfig?: Record<string, unknown>;
  cacheConfig?: Record<string, unknown>;
  ownerName: string;
  status: "draft" | "active" | "inactive" | string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportingDatasetPreview {
  fields: ReportingDatasetFieldRecord[];
  sampleRows: Array<Record<string, unknown>>;
  rowCount: number;
}

export interface ReportingAiResultProfile {
  rowCount: number;
  sampleCount: number;
  fields: Array<ReportingDatasetFieldRecord & {
    semanticType?: string | null;
    distinctCount?: number;
    sampleValues?: string[];
  }>;
  dimensions: ReportingDatasetFieldRecord[];
  metrics: ReportingDatasetFieldRecord[];
  timeFields: ReportingDatasetFieldRecord[];
  geographyFields: ReportingDatasetFieldRecord[];
}

export interface ReportingAiSqlPlanResponse {
  auditRunId?: number | null;
  provider?: {
    id: number;
    configName?: string;
    providerType?: string;
    modelName?: string;
    modelVersion?: string | null;
  } | null;
  dialect: string;
  summary: string;
  generatedSql: string;
  usedTables: Array<{ tableName: string; reason?: string; columns?: string[] }>;
  assumptions: string[];
  risks: string[];
  questions: string[];
  confidence?: number | null;
  autoCorrection?: {
    attempted: boolean;
    applied: boolean;
    reason?: string | null;
    originalSql?: string | null;
    revisedSql?: string | null;
    messages?: string[];
  };
  validation: {
    valid: boolean;
    syntaxValid: boolean;
    objectValid: boolean;
    explainValid: boolean;
    messages: string[];
  };
  metadata?: {
    availableTables?: DataSourceTable[];
    tableSchemas?: Array<{
      tableName: string;
      tableType?: string;
      tableComment?: string;
      columns?: Array<{ name: string; dataType?: string; columnType?: string; comment?: string }>;
    }>;
    tableSamples?: Array<{
      tableName: string;
      rowCount: number;
      sampleRows: Array<Record<string, unknown>>;
      loadError?: string;
    }>;
    rawText?: string;
  };
}

export interface ReportingAiAnalysisSuggestion {
  id?: string;
  rank?: number;
  title: string;
  analysisPrompt: string;
  businessScenario?: string;
  dimensions?: string[];
  metrics?: string[];
  filters?: string[];
  chartHint?: string;
  reason?: string;
  caveats?: string[];
}

export interface ReportingAiAnalysisSuggestionResponse {
  auditRunId?: number | null;
  provider?: {
    id: number;
    configName?: string;
    providerType?: string;
    modelName?: string;
    modelVersion?: string | null;
  } | null;
  summary?: string;
  suggestions: ReportingAiAnalysisSuggestion[];
  fallbackSuggestions?: ReportingAiAnalysisSuggestion[];
  warning?: string | null;
  metadata?: ReportingAiSqlPlanResponse["metadata"];
}

export interface ReportingAiQueryResponse {
  auditRunId?: number | null;
  sourceId: number;
  sourceSql: string;
  fields: ReportingDatasetFieldRecord[];
  sampleRows: Array<Record<string, unknown>>;
  rowCount: number;
  profile: ReportingAiResultProfile;
  durationMs: number;
  governance?: {
    limit?: number;
    timeoutMs?: number;
    explainValid?: boolean;
    messages?: string[];
  };
  autoCorrection?: {
    attempted: boolean;
    applied: boolean;
    reason?: string | null;
    originalSql?: string | null;
    revisedSql?: string | null;
    messages?: string[];
  } | null;
}

export interface ReportingAiChartRecommendation {
  rank?: number;
  chartFamily: string;
  chartAssetId?: number | null;
  chartName?: string;
  widgetType: "chart" | "kpi" | "table" | string;
  title: string;
  reason: string;
  score: number;
  fieldMap: Record<string, string>;
  fieldMapValidation?: {
    valid: boolean;
    messages: string[];
    missingRequiredKeys?: string[];
    unknownFields?: Array<{ key: string; value: string }>;
  };
}

export interface ReportingAiChartRecommendResponse {
  auditRunId?: number | null;
  provider?: {
    id: number;
    configName?: string;
    providerType?: string;
    modelName?: string;
    modelVersion?: string | null;
  } | null;
  profile: ReportingAiResultProfile;
  recommendations: ReportingAiChartRecommendation[];
  fallbackRecommendations: ReportingAiChartRecommendation[];
  warning?: string | null;
  rawText?: string;
}

export interface ReportingChartAssetRecord {
  id: number;
  chartName: string;
  chartCode: string;
  chartType: "echarts" | string;
  category: string;
  chartFamily?: string;
  variantName?: string;
  renderMode: "dataset" | "static" | string;
  coverImageUrl?: string | null;
  description?: string | null;
  tags: string[];
  config?: Record<string, unknown>;
  optionTemplate?: Record<string, unknown>;
  mappingSchema?: Record<string, unknown>;
  ownerName: string;
  status: "draft" | "active" | "inactive" | string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportingThemeTemplateRecord {
  id: number;
  themeName: string;
  themeCode: string;
  category: string;
  description?: string | null;
  isBuiltin: boolean;
  status: "draft" | "active" | "inactive" | string;
  previewImage?: string | null;
  createdBy: string;
  canvas?: Record<string, unknown>;
  chrome?: Record<string, unknown>;
  semantic?: Record<string, unknown>;
  chartCommon?: Record<string, unknown>;
  chartVariants?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReportingDashboardWidgetRecord {
  id?: number;
  widgetKey: string;
  widgetName: string;
  widgetType: "chart" | "kpi" | "table" | "text" | "filter" | string;
  datasetId?: number | null;
  chartAssetId?: number | null;
  position?: Record<string, unknown>;
  props?: Record<string, unknown>;
  queryParams?: Record<string, unknown>;
}

export interface ReportingDashboardRecord {
  id: number;
  dashboardName: string;
  dashboardCode: string;
  layoutMode: "grid" | "free" | string;
  themeTemplateId?: number | null;
  themeSettings?: Record<string, unknown>;
  themeConfig?: Record<string, unknown>;
  filterConfig?: Record<string, unknown>;
  canvasConfig?: Record<string, unknown>;
  ownerName: string;
  status: "draft" | "published" | "inactive" | string;
  description?: string | null;
  widgetCount?: number;
  widgets: ReportingDashboardWidgetRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportingDashboardPublishConfig {
  accessMode?: "public" | "login_user" | string;
  allowAnonymous?: boolean;
  allowedUsername?: string | null;
  allowedUsernames?: string[];
  shareToken?: string | null;
}

export interface ReportingDashboardPreview {
  widgetType?: "chart" | "kpi" | "table" | "tabs" | string;
  dataset: ReportingDatasetRecord | null;
  chartAsset: ReportingChartAssetRecord | null;
  fields?: Array<{ columnName: string; label?: string; dataType?: string }>;
  sampleRows: Array<Record<string, unknown>>;
  option?: Record<string, unknown>;
  fieldMap?: Record<string, string>;
  chrome?: {
    titleText?: string | null;
    showTitle?: boolean;
    titleAlign?: "left" | "center" | "right";
    titleColor?: string | null;
    titleFontSize?: number | null;
    titleFontWeight?: number | null;
    paddingPreset?: "compact" | "comfortable" | "spacious" | string;
    backgroundColor?: string | null;
    backgroundImage?: string | null;
    borderColor?: string | null;
    borderWidth?: number | null;
    borderRadius?: number | null;
    shadowPreset?: "none" | "soft" | "medium" | string;
  };
  chartStyle?: {
    palettePreset?: string | null;
    accentColor?: string | null;
    showLegend?: boolean;
    showAxis?: boolean;
    showLabels?: boolean;
    showDataLabels?: boolean;
    dataLabelColor?: string | null;
    dataLabelFontSize?: number | null;
    dataLabelFontWeight?: number | null;
    gaugeMetricName?: string | null;
    pieVariant?: string | null;
    pieTheme?: string | null;
    pieInnerRadius?: number | null;
    pieOuterRadius?: number | null;
    pieStartAngle?: number | null;
    pieMinAngle?: number | null;
    pieRoseMode?: string | null;
    pieLabelMode?: string | null;
    pieShowCategory?: boolean;
    pieShowPercent?: boolean;
    pieShowValue?: boolean;
    pieValueFormat?: string | null;
    pieLabelColor?: string | null;
    pieValueColor?: string | null;
    pieLabelFontSize?: number | null;
    pieValueFontSize?: number | null;
    pieLabelFontWeight?: number | null;
    pieValueFontWeight?: number | null;
    pieLabelLineShow?: boolean;
    pieLabelLineColor?: string | null;
    pieLabelLineWidth?: number | null;
    pieLabelLineLength?: number | null;
    pieLabelLineLength2?: number | null;
    pieShowCenter?: boolean;
    pieCenterTitle?: string | null;
    pieCenterValue?: string | null;
    pieCenterUnit?: string | null;
    pieCenterSubtitle?: string | null;
    pieCenterTitleColor?: string | null;
    pieCenterValueColor?: string | null;
    pieCenterMetaColor?: string | null;
    pieCenterTitleFontSize?: number | null;
    pieCenterValueFontSize?: number | null;
    pieCenterMetaFontSize?: number | null;
    pieSliceGap?: number | null;
    pieBorderRadius?: number | null;
    pieBorderWidth?: number | null;
    pieBorderColor?: string | null;
    pieSortOrder?: string | null;
    pieMaxSlices?: number | null;
    pieMergeOthers?: boolean;
    pieOthersName?: string | null;
    pieLegendPosition?: string | null;
    pieLegendShowValue?: boolean;
    pieLegendShowPercent?: boolean;
    pieHoverScale?: boolean;
    pieSelectedOffset?: number | null;
    pieShadowBlur?: number | null;
    pieShadowColor?: string | null;
  };
  mapStyle?: {
    provinceCode?: string | null;
    center?: [number, number] | null;
    zoom?: number | null;
  };
  chartAnalysis?: {
    showExtrema?: boolean;
  };
  kpi?: {
    mode?: "number" | "flipper" | "progress" | string;
    layout?: "vertical" | "horizontal" | string;
    items?: Array<{
      primaryValue?: number | string | null;
      compareValue?: number | string | null;
      targetValue?: number | string | null;
      trendPercent?: number | null;
      label?: string | null;
      formattedValue?: string | null;
    }>;
    primaryValue?: number | string | null;
    compareValue?: number | string | null;
    targetValue?: number | string | null;
    trendPercent?: number | null;
    label?: string | null;
    valuePrefix?: string | null;
    valueSuffix?: string | null;
    decimals?: number | null;
    showTrend?: boolean;
    formattedValue?: string | null;
    showMetricLabel?: boolean;
    metricLabelColor?: string | null;
    metricLabelFontSize?: number | null;
    metricLabelFontWeight?: number | null;
    compareLabel?: string | null;
    compareLabelColor?: string | null;
    compareLabelFontSize?: number | null;
    compareLabelFontWeight?: number | null;
  };
  kpiStyle?: {
    themeKey?: string | null;
    themeMode?: "all" | "number" | "flipper" | "progress" | string;
    itemSize?: "small" | "medium" | "large" | string;
    multiValueLayout?: "verticalList" | "horizontalList" | "grid" | string;
    contentOrientation?: "vertical" | "horizontal" | string;
    itemsPerRow?: number | null;
    itemsPerColumn?: number | null;
    itemMinWidth?: number | null;
    showDivider?: boolean;
    dividerStyle?: "solid" | "dashed" | "dotted" | "double" | "soft-band" | "glow-band" | string;
    dividerWidth?: number | null;
    dividerColor?: string | null;
    itemGap?: number | null;
    itemAlign?: "left" | "center" | "right" | string;
    itemBackgroundColor?: string | null;
    itemBorderColor?: string | null;
    itemBorderWidth?: number | null;
    itemBorderRadius?: number | null;
    flipperBackground?: string | null;
    flipperGap?: number | null;
    flipperDigitWidth?: number | null;
    flipperDigitHeight?: number | null;
    flipperDigitRadius?: number | null;
    hoverElevated?: boolean;
    trendColorMode?: "auto" | "fixed" | string;
    showValue?: boolean;
    valueColor?: string | null;
    valueFontSize?: number | null;
    valueFontWeight?: number | null;
    valuePrefixColor?: string | null;
    valuePrefixFontSize?: number | null;
    valueSuffixColor?: string | null;
    valueSuffixFontSize?: number | null;
    showMetricLabel?: boolean;
    metricLabelColor?: string | null;
    metricLabelFontSize?: number | null;
    metricLabelFontWeight?: number | null;
    compareLabelColor?: string | null;
    compareLabelFontSize?: number | null;
    compareLabelFontWeight?: number | null;
  };
  kpiAnalysis?: {
    showTrend?: boolean;
  };
  table?: {
    columns: Array<{ key: string; title: string; dataIndex: string }>;
    rows: Array<Record<string, unknown>>;
    pageSize?: number | null;
    showIndex?: boolean;
    compact?: boolean;
    striped?: boolean;
  };
  tableStyle?: {
    showIndex?: boolean;
    compact?: boolean;
    striped?: boolean;
  };
  tabs?: {
    defaultActiveKey?: string | null;
    items: Array<{
      key: string;
      title: string;
      widgetType: "chart" | "kpi" | "table" | string;
      option?: Record<string, unknown>;
      kpi?: ReportingDashboardPreview["kpi"];
      table?: ReportingDashboardPreview["table"];
      chrome?: ReportingDashboardPreview["chrome"];
      chartStyle?: ReportingDashboardPreview["chartStyle"];
      mapStyle?: ReportingDashboardPreview["mapStyle"];
      chartAnalysis?: ReportingDashboardPreview["chartAnalysis"];
      kpiStyle?: ReportingDashboardPreview["kpiStyle"];
      kpiAnalysis?: ReportingDashboardPreview["kpiAnalysis"];
      tableStyle?: ReportingDashboardPreview["tableStyle"];
    }>;
  };
  tabsStyle?: {
    tabBarBackgroundColor?: string | null;
    activeTextColor?: string | null;
    inactiveTextColor?: string | null;
  };
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  dataType?: string;
  defaultValue?: unknown;
  isPrimaryKey?: boolean;
}

export interface TransformRule {
  field: string;
  transformType: "rename" | "uppercase" | "lowercase" | "trim" | "date_format" | "custom";
  config?: Record<string, unknown>;
}

export interface IncrementalConfig {
  mode: "timestamp" | "id" | "cdc";
  cursorColumn?: string;
  timestampColumn?: string;
  idColumn?: string;
  startValue?: unknown;
  lastValue?: unknown;
  lastRunStartValue?: unknown;
  lastRunEndValue?: unknown;
  lastRunAt?: string;
  cdcColumns?: string[];
}

export interface ScheduleConfig {
  scheduleType: "manual" | "interval" | "daily" | "weekly" | "monthly" | "cron";
  cronExpression?: string;
  intervalMs?: number;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  timezone?: string;
  dependencyTaskIds?: number[];
  retryCount?: number;
  retryIntervalMs?: number;
}

export type IngestionWriteMode = "append" | "replace" | "upsert" | "overwrite" | "partition_overwrite";

export type FileImportWriteMode = "append" | "overwrite";

export interface FileImportFieldMapping {
  sourceField: string;
  targetField: string;
  dataType: string;
  inferredType?: string;
  enabled: boolean;
  mappingMode?: "source" | "custom";
  customValue?: string | null;
  autoMapped?: boolean;
  matchStatus?: "matched" | "unmatched" | "custom";
  isPrimaryKey?: boolean;
  nullable?: boolean;
  maxLength?: number;
  columnComment?: string;
  sampleValues?: unknown[];
  sourceFiles?: string[];
}

export interface FileImportPreviewFile {
  fileName: string;
  fileSize: number;
  fileType: string;
  availableSheets: string[];
  selectedSheetName?: string | null;
  parseMeta?: Record<string, unknown>;
  totalRows: number;
  sampleRows: Array<Record<string, unknown>>;
  rowErrors: Array<{
    rowNo?: number | null;
    errorType?: string;
    errorMessage: string;
    rawData?: Record<string, unknown> | null;
  }>;
  schema: Array<{
    sourceField: string;
    inferredType: string;
    suggestedType: string;
    nullable: boolean;
    maxLength: number;
    sampleValues: unknown[];
  }>;
}

export interface FileImportTaskFile {
  id: number;
  taskId: number;
  fileName: string;
  storedFileName: string;
  fileExt: string;
  filePath: string;
  fileSize: number;
  fileHash?: string | null;
  fileOrder: number;
  sheetName?: string | null;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FileImportRun {
  id: number;
  taskId: number;
  runStatus: string;
  startTime?: string | null;
  endTime?: string | null;
  totalRows: number;
  successRows: number;
  skippedRows: number;
  errorRows: number;
  errorMessage?: string | null;
  executionInfo?: Record<string, unknown>;
  createdAt: string;
}

export interface FileImportRunError {
  id: number;
  runId: number;
  fileId?: number | null;
  fileName?: string | null;
  sheetName?: string | null;
  rowNo?: number | null;
  columnName?: string | null;
  errorType: string;
  errorMessage: string;
  rawData?: Record<string, unknown>;
  createdAt: string;
}

export interface FileImportTask {
  id: number;
  taskName: string;
  taskCode: string;
  targetSourceId: number;
  targetSourceName?: string | null;
  targetSourceType?: string | null;
  targetTable: string;
  targetTableMode: "create" | "existing";
  writeMode: FileImportWriteMode;
  description?: string;
  ownerName: string;
  status: string;
  parseOptions?: Record<string, unknown>;
  fieldMappings?: FileImportFieldMapping[];
  previewSchema?: {
    files?: FileImportPreviewFile[];
    mergedSchema?: FileImportFieldMapping[];
  } | Record<string, unknown>;
  files?: FileImportTaskFile[];
  lastRun?: FileImportRun | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileImportPreviewResponse {
  files: FileImportPreviewFile[];
  mergedSchema: FileImportFieldMapping[];
  suggestedMappings: FileImportFieldMapping[];
}

export interface PartitionWriteConfig {
  mode?: "latest" | "custom";
  partitionColumn?: string;
  partitionValue?: string;
}

export interface IngestionTargetConfig {
  table?: string[];
  column?: string[];
  writeMode?: IngestionWriteMode;
  partitionConfig?: PartitionWriteConfig;
  [key: string]: unknown;
}

export interface IngestionTask {
  id: number;
  taskName: string;
  taskCode: string;
  sourceId: number;
  sourceName?: string;
  sourceType?: string;
  sourceTable: string;
  targetSourceId: number;
  targetSourceName?: string;
  targetSourceType?: string;
  targetType: "mysql" | "postgresql" | "gaussdb" | "jdbc" | "hive" | "kafka" | "file" | "api";
  targetTable: string;
  targetConfig?: IngestionTargetConfig;
  syncMode: "full" | "incremental" | "cdc";
  status: "draft" | "active" | "paused" | "stopped" | "running";
  description?: string;
  ownerName: string;
  scheduleEnabled: boolean;
  fieldMappings?: FieldMapping[];
  transformRules?: TransformRule[];
  incrementalConfig?: IncrementalConfig;
  sourceConfig?: Record<string, unknown> | null;
  parseConfig?: Record<string, unknown> | null;
  errorConfig?: Record<string, unknown> | null;
  scheduleConfig?: ScheduleConfig;
  lastRunTime?: string;
  lastEndTime?: string;
  lastRunStatus?: string;
  lastExecutionInfo?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobRun {
  id: number;
  taskId: number;
  runStatus: "pending" | "running" | "completed" | "failed" | "cancelled";
  startTime: string;
  endTime?: string;
  recordsCount?: number;
  executionInfo?: Record<string, unknown> | null;
  errorMessage?: string;
  createdAt?: string;
}


export interface JobRunFailureAnalysis {
  causeSummary: string;
  rootCause: string;
  evidence: string[];
  suggestions: string[];
  confidence: "high" | "medium" | "low";
  severity: "critical" | "high" | "medium" | "low";
}

export interface JobRunFailureAnalysisResponse {
  runId: number;
  taskId: number;
  modelProviderId: number;
  modelProviderName: string;
  modelName: string;
  analysis: JobRunFailureAnalysis;
  rawText: string;
}


export interface IngestionAiConfigRecord {
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
  ownerName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface QualityAiConfigVersionRecord {
  id: number;
  aiConfigId: number;
  versionNo: number;
  versionStatus: string;
  sceneName: string;
  sceneCode: string;
  defaultModelProviderId?: number | null;
  defaultModelProviderName?: string | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  thinkingEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
  thinkingBudget?: number | null;
  systemPrompt?: string | null;
  description?: string | null;
  ownerName?: string;
  createdBy?: string;
  publishedAt?: string | null;
  createdAt?: string;
}

export interface DevAiConfigRecord {
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
  ownerName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface ReportingAiConfigRecord {
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
  inputSchema?: Record<string, unknown>;
  systemPrompt?: string;
  description?: string;
  ownerName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceResearchRunRecord {
  id: number;
  taskId?: number | null;
  runNo?: number | null;
  sourceId: number;
  runName: string;
  sourceName: string;
  sourceType: string;
  databaseName?: string | null;
  schemaName?: string | null;
  tableScope: "all" | "manual";
  config: {
    sampleSize?: number;
    maxTables?: number;
    rowCountMode?: "estimated" | "exact";
    metadataConcurrency?: number;
    aiBatchSize?: number;
    notes?: string;
    researchItems?: Array<"table_classification" | "table_relationship" | "data_scale" | "quality_inspection" | "ingestion_advice" | "governance_advice" | "analysis_advice" | "metadata_inspection">;
  };
  selectedTables: string[];
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  progressPercent: number;
  currentStage?: string | null;
  report?: DataSourceResearchReport | null;
  summaryText?: string | null;
  errorMessage?: string | null;
  createdBy: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceResearchTaskRecord {
  id: number;
  taskName: string;
  sourceId: number;
  sourceName: string;
  sourceType: string;
  databaseName?: string | null;
  schemaName?: string | null;
  tableScope: "all" | "manual";
  config: DataSourceResearchRunRecord["config"];
  selectedTables: string[];
  status: "active" | "disabled";
  lastRunId?: number | null;
  lastRunStatus?: DataSourceResearchRunRecord["status"] | null;
  lastRunAt?: string | null;
  description?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceResearchLogRecord {
  id: number;
  runId: number;
  stageKey: string;
  logLevel: "info" | "warn" | "error";
  message: string;
  detail?: Record<string, unknown> | null;
  createdAt: string;
}

export interface IngestionMonitorOverviewResponse {
  tasks: IngestionTask[];
  dataSources: DataSourceRecord[];
  runsByTask: Record<string, JobRun[]>;
  runLimit: number;
  totalTasks: number;
}

export interface DataSourceResearchTableReport {
  tableName: string;
  tableComment?: string;
  columnCount: number;
  rowCount?: number | null;
  sampleCount: number;
  category: string;
  priority: string;
  confidence: number;
  evidence: string[];
  risks: string[];
  suggestedMode: string;
  incrementalColumn?: string | null;
  metadataIssues: string[];
  quality: {
    sampleCount: number;
    highNullColumns: number;
    nullRates: Record<string, number>;
  };
  fieldSummary?: {
    totalFields?: number;
    primaryKeys?: string[];
    timeFields?: string[];
    codeLikeFields?: string[];
    statusLikeFields?: string[];
    typeLikeFields?: string[];
    nameLikeFields?: string[];
    highNullFields?: string[];
    highCardinalityFields?: string[];
    lowCardinalityFields?: string[];
    missingCommentCount?: number;
    dataTypeDistribution?: Record<string, number>;
  };
  indexes: number;
  constraints: number;
  columns: Array<{
    columnName: string;
    dataType: string;
    columnType?: string;
    ordinalPosition?: number;
    isNullable?: boolean;
    isPrimaryKey: boolean;
    columnComment?: string;
  }>;
  fieldProfiles?: Array<{
    columnName: string;
    ordinalPosition: number;
    dataType: string;
    columnType?: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    columnComment?: string;
    nullRate?: number;
    distinctRatio?: number;
    sampleValues?: string[];
    issueTags?: string[];
  }>;
}

export interface DataSourceResearchTableRelationshipReport {
  summary: string;
  entities: Array<{
    tableName: string;
    tableComment?: string;
    category?: string;
    priority?: string;
    rowCount?: number | null;
    fields: Array<{
      columnName: string;
      dataType?: string;
      isPrimaryKey?: boolean;
      columnComment?: string;
    }>;
  }>;
  relations: Array<{
    fromTable: string;
    fromField: string;
    toTable: string;
    toField: string;
    relationType: "1:1" | "1:N" | "N:1" | "N:N";
    confidence: number;
    source: "constraint" | "name_rule" | "ai";
    fromFieldRole?: "FOREIGN_KEY" | "REFERENCE";
    toFieldRole?: "PRIMARY_KEY" | "UNIQUE_KEY" | "BUSINESS_KEY";
    constraintName?: string;
    joinCondition?: string;
    evidence: string[];
  }>;
}

export interface DataSourceResearchReport {
  source: {
    id: number;
    sourceName: string;
    sourceCode: string;
    sourceType: string;
    databaseName?: string | null;
    schemaName?: string | null;
  };
  run: {
    id: number;
    runName: string;
    createdAt: string;
    startedAt?: string;
  };
  config: {
    sampleSize?: number;
    maxTables?: number;
    rowCountMode?: "estimated" | "exact";
    metadataConcurrency?: number;
    aiBatchSize?: number;
    notes?: string;
    researchItems?: string[];
    tableScope: "all" | "manual";
    selectedTables: string[];
  };
  overview: {
    totalTables: number;
    totalRowCount: number;
    categoryStats: Record<string, number>;
    summary: string;
  };
  analysisBatches?: Array<{
    stageKey: string;
    batchNo: number;
    batchSize: number;
    status: string;
    durationMs?: number | null;
    errorMessage?: string | null;
  }>;
  tableRelationships?: DataSourceResearchTableRelationshipReport;
  insights?: {
    dataScale?: {
      summary?: string;
      largeTables?: string[];
      smallOrEmptyTables?: string[];
      complexTables?: string[];
      suggestions?: string[];
    };
    dataQuality?: {
      summary?: string;
      issueTypeStats?: Array<{ issueType: string; count: number }>;
      tableFindings?: Array<{ tableName: string; issueTypes?: string[]; evidence?: string[]; suggestion?: string }>;
      fieldFindings?: Array<{ tableName: string; columnName: string; issueTypes?: string[]; evidence?: string[]; suggestion?: string }>;
      suggestions?: string[];
    };
    ingestionAdvice?: {
      summary?: string;
      recommendedTables?: string[];
      deferredTables?: string[];
      tableModes?: Array<{ tableName: string; mode?: string; reason?: string; risk?: string }>;
      ingestionSuggestions?: string[];
    };
    governanceAdvice?: {
      summary?: string;
      mustFixBeforeIngestion?: string[];
      continuousImprovements?: string[];
      tableTasks?: Array<{ tableName: string; issueTypes?: string[]; priority?: string; action?: string }>;
      governanceSuggestions?: string[];
    };
    analysisAdvice?: {
      summary?: string;
      coreBusinessTables?: Array<{ tableName: string; reason?: string; analysisValue?: string; suggestedSubjects?: string[]; dimensions?: string[] }>;
      analysisDirections?: Array<{ direction: string; coreTable?: string; relatedTables?: string[]; measures?: string[]; dimensions?: string[]; sampleEvidence?: string[]; analysisQuestions?: string[]; outputSuggestions?: string[]; caveats?: string[] }>;
      analysisThemes?: Array<{ theme: string; tables?: string[]; keyFields?: string[]; value?: string; limitations?: string[] }>;
      watchItems?: string[];
      followUpQuestions?: string[];
      analysisSuggestions?: string[];
    };
  };
  tables: DataSourceResearchTableReport[];
  recommendations: {
    recommendedTables: string[];
    deferredTables: string[];
    governanceSuggestions: string[];
    ingestionSuggestions: string[];
    analysisSuggestions?: string[];
  };
}

export interface DataSourceResearchReportComparisonRecord {
  id: number;
  taskId: number;
  baseRunId: number;
  targetRunId: number;
  status: "pending" | "running" | "succeeded" | "failed";
  diff?: {
    source?: Record<string, unknown>;
    task?: Record<string, unknown>;
    overview?: {
      baseTotalTables?: number;
      targetTotalTables?: number;
      tableDelta?: number;
      baseTotalRowCount?: number;
      targetTotalRowCount?: number;
      rowCountDelta?: number;
      rowCountDeltaRate?: number | null;
    };
    tables?: {
      added?: Array<Record<string, unknown>>;
      removed?: Array<Record<string, unknown>>;
      changed?: Array<Record<string, unknown>>;
    };
    relationships?: {
      added?: Array<Record<string, unknown>>;
      removed?: Array<Record<string, unknown>>;
    };
    modules?: {
      tableClassification?: {
        addedTables?: Array<Record<string, unknown>>;
        removedTables?: Array<Record<string, unknown>>;
        changedTables?: Array<Record<string, unknown>>;
      };
      tableRelationship?: {
        added?: Array<Record<string, unknown>>;
        removed?: Array<Record<string, unknown>>;
      };
      dataScale?: {
        rowCountDelta?: number;
        rowCountDeltaRate?: number | null;
        changedTables?: Array<Record<string, unknown>>;
      };
      dataQuality?: {
        changedTables?: Array<Record<string, unknown>>;
        issueAddedCount?: number;
        issueRemovedCount?: number;
        highNullColumnsDelta?: number;
      };
      ingestionAdvice?: {
        recommendedTables?: { added?: string[]; removed?: string[] };
        deferredTables?: { added?: string[]; removed?: string[] };
      };
      governanceAdvice?: {
        suggestions?: { added?: string[]; removed?: string[] };
        taskTables?: { added?: string[]; removed?: string[] };
      };
      analysisAdvice?: {
        suggestions?: { added?: string[]; removed?: string[] };
        themes?: { added?: string[]; removed?: string[] };
      };
    };
    summaryText?: string;
  } | null;
  aiSummary?: {
    summary?: string;
    tableClassificationChanges?: string[];
    tableRelationshipChanges?: string[];
    dataScaleChanges?: string[];
    dataQualityChanges?: string[];
    ingestionAdviceChanges?: string[];
    governanceAdviceChanges?: string[];
    analysisAdviceChanges?: string[];
    qualityChanges?: string[];
    schemaChanges?: string[];
    relationshipChanges?: string[];
    risks?: string[];
    suggestions?: string[];
    confidence?: number;
  } | null;
  summaryText?: string | null;
  errorMessage?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedServiceRuntime {
  state: "running" | "stopped" | "degraded";
  reachable: boolean;
  ready?: boolean;
  readyUrl?: string | null;
  host?: string | null;
  port?: number | null;
  pid?: number | null;
  processName?: string | null;
  commandLine?: string | null;
  containerName?: string | null;
  containerStatus?: string | null;
  healthStatus?: string | null;
  projectName?: string | null;
  containers?: string[];
  containerDetails?: Array<{ name: string; state: string; status: string }>;
}

export interface ManagedServiceRecord {
  id: number;
  serviceKey: string;
  serviceName: string;
  serviceCategory: "application" | "database" | "platform" | "custom";
  serviceType: "backend" | "frontend" | "mysql" | "postgresql" | "hive" | "kafka" | "custom";
  manageMode: "process" | "docker" | "docker_compose" | "command";
  host?: string | null;
  port?: number | null;
  autoStart: boolean;
  status: "active" | "inactive";
  isCore: boolean;
  notes?: string | null;
  config?: Record<string, unknown>;
  runtime?: ManagedServiceRuntime;
  createdAt: string;
  updatedAt: string;
}

export interface SystemUserRecord {
  id: number;
  username: string;
  displayName: string;
  roleId?: number | null;
  roleCode: string;
  roleName?: string | null;
  roleType?: string | null;
  permissions?: {
    modules: string[];
    mode?: "readonly" | string;
    actions?: string[];
  };
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface SystemRoleRecord {
  id: number;
  roleName: string;
  roleCode: string;
  roleType: "admin" | "developer" | "operator" | "viewer" | "custom";
  permissions: {
    modules: string[];
    mode?: "readonly" | string;
    actions?: string[];
  };
  status: "active" | "inactive";
  isSystem: boolean;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemDiskResource {
  name: string;
  label: string;
  size: number;
  free: number;
  used: number;
  usedPercent: number;
}

export interface ManagedProcessResource {
  serviceKey: string;
  serviceName: string;
  pid: number;
  port?: number | null;
  processName?: string | null;
}

export type SystemResourceHistoryPeriod = "15m" | "1h" | "6h" | "24h";

export interface SystemResourceHistoryPoint {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  usedMemory: number;
  totalMemory: number;
  diskMaxUsage: number;
}

export interface SystemResourceSnapshot {
  hostname: string;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  cpuUsage: number;
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memoryUsage: number;
  disks: SystemDiskResource[];
  managedProcesses: ManagedProcessResource[];
  sampledAt?: string;
  history?: SystemResourceHistoryPoint[];
  historyPeriod?: SystemResourceHistoryPeriod;
  sampleIntervalSeconds?: number;
  collectedSamples?: number;
}

export interface MetaDatabaseServiceBinding {
  name: string;
  serviceKey: string;
  database: string;
  purpose: string;
}

export interface MetaDatabaseInstance {
  key: string;
  name: string;
  engine: "mysql" | "postgresql";
  host: string;
  port: number;
  status: "running" | "stopped" | "degraded";
  ready: boolean;
  databases: string[];
  scope: string;
  boundaries: string[];
  services: MetaDatabaseServiceBinding[];
}

export interface MetaDatabasePlacementRule {
  category: string;
  target: "mysql" | "postgresql" | "best_fit";
  examples: string[];
  reason: string;
}

export interface MetaDatabaseArchitecture {
  strategy: string;
  instances: MetaDatabaseInstance[];
  placementRules: MetaDatabasePlacementRule[];
}

export interface DevDatasourceRecord {
  id: number;
  name: string;
  type: "mysql" | "postgresql" | "gaussdb" | "jdbc" | "clickhouse" | "hive";
  host: string;
  port: number;
  databaseName?: string | null;
  username?: string | null;
  hasPassword: boolean;
  extraConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DevDatabaseEntry {
  name: string;
}

export interface DevTableEntry {
  name: string;
  type: string;
  comment?: string | null;
}

export interface DevRoutineEntry {
  name: string;
  type: "FUNCTION" | "PROCEDURE" | string;
  schema?: string;
}

export interface DevColumnEntry {
  name: string;
  position: number;
  dataType: string;
  columnType: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: unknown;
  comment?: string;
}

export interface DevScriptFolderRecord {
  id: number;
  name: string;
  parentId?: number | null;
  createdAt: string;
}

export interface DevScriptRecord {
  id: number;
  name: string;
  folderId?: number | null;
  datasourceId: number;
  datasourceName: string;
  datasourceType: string;
  defaultDatabase?: string | null;
  description?: string | null;
  tags: string[];
  content: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DevScriptVersionRecord {
  id: number;
  scriptId: number;
  versionNo: number;
  content: string;
  createdAt: string;
}

export interface DevQueryExecutionResult {
  fields: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  status: "success" | "failed";
  errorMessage?: string;
  executedAt: string;
  historyId: number;
  affectedRows?: number;
  executedSql?: string;
}

export interface DevQueryHistoryRecord {
  id: number;
  datasourceId: number;
  datasourceName: string;
  scriptId?: number | null;
  scriptName?: string | null;
  sqlText: string;
  databaseName?: string | null;
  status: "success" | "failed";
  durationMs: number;
  errorMessage?: string | null;
  resultPreview?: {
    fields?: string[];
    rows?: Record<string, unknown>[];
    rowCount?: number;
    affectedRows?: number;
  } | null;
  executedAt: string;
}

export type DevProcessingStepType = "filter" | "deduplicate" | "format" | "validate" | "lookup_fill";

export interface DevProcessingScopeConfig {
  mode?: "all" | "system_time_range";
  fieldName?: string;
  timeVariable?: "current_date" | "current_time" | "current_timestamp";
  timeFormat?: string;
  startOffset?: number | null;
  endOffset?: number | null;
  offsetUnit?: "day" | "hour" | "minute" | "month";
}

export interface DevProcessingTargetFieldMapping {
  sourceField: string;
  targetField: string;
}

export interface DevProcessingTargetConfig {
  targetMode?: "create" | "existing" | "source";
  writeMode?: "overwrite" | "append";
  targetDatabaseName?: string | null;
  targetTableName?: string | null;
  fieldMappings?: DevProcessingTargetFieldMapping[];
}

export interface DevProcessingScheduleConfig {
  enabled?: boolean;
  scheduleType?: "manual" | "daily" | "weekly" | "cron";
  executeTime?: string | null;
  executeDay?: number | null;
  cronExpr?: string | null;
}

export interface DevProcessingStepRecord {
  stepKey: string;
  stepName: string;
  stepType: DevProcessingStepType;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface DevProcessingPipelineRecord {
  sampleLimit: number;
  scope?: DevProcessingScopeConfig | null;
  schedule?: DevProcessingScheduleConfig | null;
  targetConfig?: DevProcessingTargetConfig | null;
  steps: DevProcessingStepRecord[];
}

export interface DevProcessingJobVersionRecord {
  id: number;
  jobId: number;
  versionNo: number;
  versionStatus: string;
  pipeline: DevProcessingPipelineRecord;
  compiledSql?: string | null;
  summary?: {
    stepCount?: number;
    enabledStepCount?: number;
    stepTypes?: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevProcessingRunRecord {
  id: number;
  jobId: number;
  versionNo: number;
  runStatus: string;
  triggerType: string;
  previewMode: boolean;
  sourceRowCount?: number | null;
  outputRowCount?: number | null;
  affectedRows?: number | null;
  targetTableName?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  resultPreview?: {
    fields?: string[];
    rows?: Record<string, unknown>[];
    rowCount?: number;
    affectedRows?: number;
  } | null;
  executedSql?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface DevProcessingJobRecord {
  id: number;
  name: string;
  description?: string | null;
  datasourceId: number;
  datasourceName?: string | null;
  datasourceType?: string | null;
  databaseName?: string | null;
  tableName: string;
  targetTableName?: string | null;
  outputMode: "overwrite_source" | "new_table" | "preview_only" | string;
  status: "draft" | "active" | string;
  ownerName?: string | null;
  tags: string[];
  currentVersionNo: number;
  publishedVersionNo?: number | null;
  lastRunStatus?: string | null;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version?: DevProcessingJobVersionRecord | null;
  runs?: DevProcessingRunRecord[];
}

export interface DevProcessingPreviewResult {
  previewSql: string;
  fields: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  warnings: string[];
  summary?: {
    stepCount?: number;
    enabledStepCount?: number;
    stepTypes?: string[];
  } | null;
  versionNo?: number;
}

export type DevSqlCopilotTaskType = "auto" | "generate_sql" | "analyze_sql" | "rewrite_sql" | "optimize_sql" | "explain_sql" | "data_research";

export interface DevSqlCopilotProcessStep {
  phase: string;
  title: string;
  detail?: string;
  status: "completed" | "active" | "failed";
}

export interface DevSqlCopilotDiagnostic {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface DevSqlCopilotUsedTable {
  tableName: string;
  reason: string;
  columns: string[];
}

export interface DevSqlCopilotSampledTable {
  tableName: string;
  rowCount: number;
  columns: string[];
  truncated?: boolean;
  sampleError?: string | null;
}

export interface DevSqlCopilotAnalysisDirection {
  title: string;
  businessQuestion: string;
  analysisObject: string;
  dimensions: string[];
  metrics: string[];
  statisticalScope: string;
  sourceFields: string[];
  businessValue: string;
}

export interface DevSqlCopilotResponse {
  taskType: DevSqlCopilotTaskType;
  provider: {
    id: number;
    configName: string;
    modelName: string;
    modelVersion?: string | null;
    providerType: string;
  };
  summary: string;
  explanation: string;
  generatedSql: string;
  assumptions: string[];
  risks: string[];
  suggestions: string[];
  analysisDirections?: DevSqlCopilotAnalysisDirection[];
  diagnostics: DevSqlCopilotDiagnostic[];
  usedTables: DevSqlCopilotUsedTable[];
  referencedTables: string[];
  metadataTables: Array<{
    tableName: string;
    tableType: string;
    columnCount: number;
  }>;
  sampledTables: DevSqlCopilotSampledTable[];
  activeExecution?: {
    historyId: number;
    status: "success" | "failed";
    sqlText: string;
    databaseName?: string | null;
    durationMs: number;
    errorMessage?: string | null;
    fields: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    affectedRows: number;
    previewTruncated?: boolean;
  } | null;
  validation?: {
    valid: boolean;
    syntaxValid: boolean;
    objectValid: boolean;
    explainValid: boolean;
    messages: string[];
  };
  rawText: string;
}

export interface DevSqlCopilotSession {
  id: number;
  projectId: number;
  userId: number;
  datasourceId: number;
  datasourceName?: string | null;
  databaseName?: string | null;
  sessionTitle?: string | null;
  status: string;
  lastMessageAt?: string | null;
  messageCount?: number | null;
  lastPreview?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevSqlCopilotMessage {
  id: number;
  sessionId: number;
  role: "user" | "assistant";
  taskType?: Exclude<DevSqlCopilotTaskType, "auto"> | null;
  messageText: string;
  payload?: {
    result?: DevSqlCopilotResponse;
    processSteps?: DevSqlCopilotProcessStep[];
  } | null;
  context?: {
    datasourceId?: number;
    databaseName?: string | null;
    selectedTables?: string[];
    activeExecutionHistoryId?: number | null;
    hasSelectedSql?: boolean;
    hasEditorSql?: boolean;
  } | null;
  createdAt: string;
}

export interface DevWorkflowNodeRecord {
  id: number;
  workflowId: number;
  nodeType: "start" | "end" | "script" | "processing" | "operator_task" | "branch" | "parallel" | "join";
  scriptId?: number | null;
  scriptName?: string | null;
  processingJobId?: number | null;
  processingJobName?: string | null;
  orchestrationTaskId?: number | null;
  orchestrationTaskName?: string | null;
  datasourceId?: number | null;
  datasourceName?: string | null;
  nodeKey: string;
  nodeName: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  retryTimes?: number | null;
  retryIntervalSec?: number;
  timeoutSec?: number | null;
  triggerRule?: "all_success" | "all_done";
  nodeConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DevWorkflowEdgeRecord {
  id: number;
  workflowId: number;
  sourceNodeKey: string;
  targetNodeKey: string;
  edgeType: string;
  edgeLabel?: "default" | "true" | "false" | string | null;
  createdAt: string;
}

export interface DevWorkflowRecord {
  id: number;
  name: string;
  description?: string | null;
  cronExpr?: string | null;
  isPaused: boolean;
  retryTimes: number;
  timeoutSec: number;
  publishedVersionNo?: number | null;
  runtimeConfig?: Record<string, unknown>;
  nodeCount?: number;
  nodes?: DevWorkflowNodeRecord[];
  edges?: DevWorkflowEdgeRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DevOrchestrationNodeRecord {
  id: number;
  taskId: number;
  nodeType: "source" | "operator" | "output";
  operatorCode: string;
  nodeKey: string;
  nodeName: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  nodeConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DevOrchestrationEdgeRecord {
  id: number;
  taskId: number;
  sourceNodeKey: string;
  sourcePort?: string | null;
  targetNodeKey: string;
  targetPort?: string | null;
  edgeType: string;
  edgeStatus?: "active" | "paused";
  createdAt: string;
}

export interface DevOrchestrationTaskRecord {
  id: number;
  name: string;
  description?: string | null;
  datasourceId?: number | null;
  datasourceName?: string | null;
  datasourceType?: string | null;
  databaseName?: string | null;
  cronExpr?: string | null;
  isPaused: boolean;
  retryTimes: number;
  timeoutSec: number;
  runtimeConfig?: Record<string, unknown>;
  nodeCount?: number;
  nodes?: DevOrchestrationNodeRecord[];
  edges?: DevOrchestrationEdgeRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DevOrchestrationSqlNodeRecord {
  nodeKey: string;
  nodeName: string;
  nodeType: "source" | "operator" | "output" | string;
  operatorCode: string;
  cteName: string;
  relationName?: string | null;
  sql: string;
  columns: string[];
}

export interface DevOrchestrationSqlStatement {
  nodeKey: string;
  nodeName: string;
  targetTable: string;
  sql: string;
}

export interface DevOrchestrationSqlPreview {
  taskId: number;
  taskName: string;
  datasourceId?: number | null;
  datasourceType?: string | null;
  databaseName?: string | null;
  dialect: string;
  executionOrder: string[];
  finalNodeKey: string;
  finalNodeName: string;
  previewSql: string;
  executeSql?: string | null;
  finalColumns: string[];
  warnings: string[];
  nodeSqls: DevOrchestrationSqlNodeRecord[];
  outputStatements: DevOrchestrationSqlStatement[];
}

export interface DevOrchestrationNodePreview {
  taskId: number;
  taskName: string;
  nodeKey: string;
  nodeName: string;
  nodeType: "source" | "operator" | "output" | string;
  operatorCode: string;
  cteName?: string | null;
  datasourceId?: number | null;
  datasourceType?: string | null;
  databaseName?: string | null;
  dialect: string;
  previewSql: string;
  nodeSql: string;
  columns: string[];
  columnMeta?: DevColumnEntry[];
  warnings: string[];
  fields: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

export interface DevOrchestrationRunResult {
  taskId: number;
  taskName: string;
  datasourceId?: number | null;
  datasourceType?: string | null;
  databaseName?: string | null;
  dialect: string;
  executedAt: string;
  durationMs: number;
  statementCount: number;
  targetTables: string[];
  warnings: string[];
}

export interface DevWorkflowValidationResult {
  valid: boolean;
  hasCycle: boolean;
  nodeCount: number;
  edgeCount: number;
  executionOrder: string[];
  errors?: string[];
}

export interface DevWorkflowRunRecord {
  id: number;
  workflowId: number;
  workflowName?: string | null;
  triggerType: string;
  status: string;
  runParams?: Record<string, unknown>;
  workflowVersionNo?: number | null;
  workflowRetryCount?: number;
  scheduledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface DevJobInstanceRecord {
  id: number;
  workflowRunId: number;
  workflowId: number;
  workflowNodeId: number;
  workflowNodeKey?: string | null;
  workflowName?: string | null;
  workflowNodeName?: string | null;
  nodeType: "start" | "end" | "script" | "processing" | "operator_task" | "branch" | "parallel" | "join";
  scriptId?: number | null;
  scriptName?: string | null;
  processingJobId?: number | null;
  processingJobName?: string | null;
  orchestrationTaskId?: number | null;
  orchestrationTaskName?: string | null;
  triggerType: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  retryCount: number;
  runAttempt?: number;
  errorMessage?: string | null;
  resultPreview?: {
    fields?: string[];
    rows?: Record<string, unknown>[];
    rowCount?: number;
    affectedRows?: number;
  } | null;
  branchResult?: {
    actualValue?: unknown;
    expectedValue?: unknown;
    operator?: string;
    matched?: boolean;
    selectedEdgeLabel?: string;
  } | null;
  createdAt: string;
}

export interface DevJobLogRecord {
  id: number;
  instanceId: number;
  logType: string;
  content: string;
  createdAt: string;
}

export interface LabKnowledgeDocRecord {
  id: number;
  kbId: number;
  fileName: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  parseStatus: string;
  parseSummary?: string | null;
  vectorStatus: string;
  docStatus: string;
  chunkCount: number;
  lastParsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabKnowledgeBaseRecord {
  id: number;
  kbName: string;
  kbDesc?: string | null;
  industryType?: string | null;
  tags: string[];
  status: string;
  createdBy: string;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
  documents?: LabKnowledgeDocRecord[];
}

export interface LabSchemaVersionRecord {
  id: number;
  sceneId: number;
  versionNo: number;
  versionStatus: string;
  content: any;
  adjustmentPrompt?: string | null;
  adjustmentHistory?: Array<{ prompt: string; at: string; summary: string }>;
  modelSummary?: string | null;
  diffSummary?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabStrategyVersionRecord {
  id: number;
  sceneId: number;
  versionNo: number;
  versionStatus: string;
  content: any;
  adjustmentPrompt?: string | null;
  modelSummary?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabSceneTableRecord {
  id: number;
  sceneId: number;
  schemaVersionId: number;
  physicalTableName: string;
  logicalTableName: string;
  tableLabel?: string | null;
  businessRole: string;
  generationPriority: number;
  tableComment?: string | null;
  ddlSql?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabSceneFieldRecord {
  id: number;
  sceneId: number;
  tableId: number;
  tableName: string;
  fieldName: string;
  fieldType: string;
  fieldLength?: number | null;
  nullable: boolean;
  primaryKey: boolean;
  uniqueKey: boolean;
  foreignKey: boolean;
  foreignRefTable?: string | null;
  foreignRefField?: string | null;
  defaultValue?: string | null;
  fieldComment?: string | null;
  businessSemantic?: string | null;
  validationRule?: string | null;
  dirtyRuleCandidates: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LabSceneDictRecord {
  id: number;
  sceneId: number;
  schemaVersionId: number;
  tableName: string;
  dictName?: string | null;
  dictKey: string;
  dictValue: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LabTopicRecord {
  id: number;
  sceneId: number;
  topicName: string;
  topicType: string;
  writeMode: string;
  status: string;
  messageCount: number;
  lastMessageAt?: string | null;
  lastErrorMessage?: string | null;
  metrics?: {
    fileExists: boolean;
    messageCount: number;
    lastMessageAt?: string | null;
    sizeBytes: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LabRunLogRecord {
  id: number;
  sceneId: number;
  runType: string;
  runStatus: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMs?: number | null;
  recordsCount: number;
  errorMessage?: string | null;
  executionInfo: Record<string, unknown>;
  createdAt: string;
}

export interface LabQualityReportRecord {
  id: number;
  sceneId: number;
  reportCode: string;
  score: number;
  summary: Record<string, unknown>;
  tableStats: Array<Record<string, unknown>>;
  fieldIssues: Array<Record<string, unknown>>;
  dirtyDistribution: Array<Record<string, unknown>>;
  kafkaStats: Array<Record<string, unknown>> | Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LabSceneRecord {
  id: number;
  sceneCode: string;
  sceneName: string;
  sceneDesc?: string | null;
  industryKbIds?: number[];
  industryKbNames?: string[];
  industryKbId?: number | null;
  industryKbName?: string | null;
  kbId?: number | null;
  kbName?: string | null;
  enhancementProfileId?: number | null;
  enhancementProfileName?: string | null;
  offlineDataSourceId?: number | null;
  offlineDataSourceName?: string | null;
  realtimeDataSourceId?: number | null;
  realtimeDataSourceName?: string | null;
  status: string;
  stageStatus: string;
  initVolume: number;
  incrVolume: number;
  incrCycle: string;
  dirtyEnabled: boolean;
  dirtyRatio: number;
  realtimeEnabled: boolean;
  realtimeStatus: string;
  kafkaTopicMode: string;
  kafkaBootstrapServers?: string | null;
  strategyModelId?: number | null;
  generateModelId?: number | null;
  currentSchemaVersion?: number | null;
  currentStrategyVersion?: number | null;
  taskEnabled: boolean;
  lastRunTime?: string | null;
  lastDeployedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tableCount?: number;
  totalDataCount?: number;
  schemaVersions?: LabSchemaVersionRecord[];
  strategyVersions?: LabStrategyVersionRecord[];
  sceneTables?: LabSceneTableRecord[];
  sceneFields?: LabSceneFieldRecord[];
  sceneDicts?: LabSceneDictRecord[];
  sceneRelations?: Array<Record<string, unknown>>;
  topics?: LabTopicRecord[];
  tasks?: Array<Record<string, unknown>>;
  runLogs?: LabRunLogRecord[];
  qualityReport?: LabQualityReportRecord | null;
}

export interface LabSceneAnalysisRecord {
  sceneId: number;
  sceneName: string;
  sceneDesc?: string | null;
  industryKbIds?: number[];
  industryKbNames?: string[];
  industryKbId?: number | null;
  industryKbName?: string | null;
  scenarioProfile?: Record<string, unknown> | null;
  researchPack?: Record<string, unknown> | null;
  modulePlan?: Record<string, unknown> | null;
  conceptPlan?: Record<string, unknown> | null;
  summary?: string | null;
}

export interface LabLogicalModelVersionRecord {
  id: number;
  versionNo: number;
  versionStatus: string;
  content: Record<string, unknown>;
}

export interface LabBusinessSystemLogicalModelVersionRecord {
  id: number;
  templateId: number;
  versionNo: number;
  versionStatus: string;
  modelSummary?: string | null;
  diffSummary?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
  sourceAssetSnapshot?: Record<string, unknown> | null;
  adjustmentHistory?: Array<Record<string, unknown>>;
  logicalModel?: Record<string, unknown> | null;
  moduleCount?: number;
  logicalTableCount?: number;
  dictionaryCount?: number;
  relationCount?: number;
}

export interface LabBusinessSystemTemplateRecord {
  id: number;
  templateCode: string;
  templateName: string;
  industryCode: string;
  sourceIncubationId?: number | null;
  sourceIncubationName?: string | null;
  sourceCategoryCodes: string[];
  templateDesc?: string | null;
  templateStatus: string;
  currentLogicalVersion?: number | null;
  currentDefaultGenerationVersion?: number | null;
  currentDefaultDirtyVersion?: number | null;
  logicalVersionId?: number | null;
  logicalVersionNo?: number | null;
  sourceCategoryCount?: number;
  moduleCount?: number;
  logicalTableCount?: number;
  dictionaryCount?: number;
  relationCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentLogicalModel?: Record<string, unknown> | null;
}

export interface LabBusinessSystemTemplateBuildJobLogRecord {
  seq: number;
  level: "info" | "warning" | "error" | string;
  stepKey: string;
  message: string;
  detail?: Record<string, unknown> | null;
  createdAt: string;
}

export interface LabBusinessSystemTemplateBuildJobRecord {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | string;
  templateName: string;
  templateCode?: string | null;
  progressPercent: number;
  currentStage: string;
  sourceCategoryCodes: string[];
  result?: {
    templateId: number;
    templateName: string;
  } | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string | null;
  logs: LabBusinessSystemTemplateBuildJobLogRecord[];
}

export interface LabBusinessSystemPhysicalModelVersionRecord {
  id: number;
  instanceId: number;
  versionNo: number;
  logicalVersionNo: number;
  dbType: string;
  versionStatus: string;
  modelSummary?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
  deployTarget?: Record<string, unknown> | null;
  physicalModel?: Record<string, unknown> | null;
  ddlBundle?: Record<string, unknown> | null;
  tableCount?: number;
  businessTableCount?: number;
  dictionaryTableCount?: number;
  columnCount?: number;
  indexCount?: number;
  relationCount?: number;
}

export interface LabBusinessSystemGenerationVersionRecord {
  id: number;
  instanceId: number;
  physicalVersionNo: number;
  versionNo: number;
  versionStatus: string;
  modelSummary?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
  generationPlan?: Record<string, unknown> | null;
  samplePreview?: Record<string, unknown> | null;
  tableCount?: number;
  businessTableCount?: number;
  dictionaryTableCount?: number;
  targetRowCount?: number;
  previewTableCount?: number;
  previewRowCount?: number;
}

export interface LabBusinessSystemDirtyDataVersionRecord {
  id: number;
  instanceId: number;
  generationVersionNo: number;
  versionNo: number;
  versionStatus: string;
  modelSummary?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
  dirtyPlan?: Record<string, unknown> | null;
  truthPreview?: Record<string, unknown> | null;
  observedPreview?: Record<string, unknown> | null;
  issuePreview?: Record<string, unknown> | null;
  issueCount?: number;
  dirtyCellCount?: number;
  affectedTableCount?: number;
  affectedRowCount?: number;
  dirtyRate?: number;
  previewRowCount?: number;
}

export interface LabBusinessSystemQualityReportRecord {
  instanceId: number;
  reportCode: string;
  score: number;
  summary: Record<string, unknown>;
  tableStats: Array<Record<string, unknown>>;
  fieldIssues: Array<Record<string, unknown>>;
  dirtyDistribution: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export type LabIndustryDataSourceTheme = "user" | "merchant" | "activity";

export interface LabIndustryDataSourceThemeCoverageRecord {
  themeCode: LabIndustryDataSourceTheme;
  themeLabel: string;
  instanceCount: number;
  tableCount: number;
  recordCount: number;
  sharedEntityCount: number;
  crossSystemEntityCount: number;
}

export interface LabIndustryDataSourceSharedEntityRecord {
  entityId: string;
  themeCode: LabIndustryDataSourceTheme;
  themeLabel: string;
  subtype: string;
  canonicalName: string;
  matchMethod: string;
  instanceCount: number;
  linkageCount: number;
  instanceNames: string[];
  tableNames: string[];
  keyAttributes: Array<{ fieldName: string; value: string }>;
  isCrossSystem: boolean;
}

export interface LabIndustryDataSourceSharedEntityMappingRecord {
  mappingId: string;
  instanceId: number;
  instanceName: string;
  instanceCode: string;
  currentGenerationVersion?: number | null;
  currentDirtyVersion?: number | null;
  logicalTableName: string;
  logicalLabel: string;
  rowIndex: number;
  rowKey: string;
  displayLabel: string;
  rowAttributes: Array<{ fieldName: string; value: string }>;
}

export interface LabIndustryDataSourceSharedEntityDetailRecord extends LabIndustryDataSourceSharedEntityRecord {
  dataSourceId: number;
  dataSourceCode: string;
  dataSourceName: string;
  generatedAt: string;
  signalField?: string | null;
  signalValue?: string | null;
  mappings: LabIndustryDataSourceSharedEntityMappingRecord[];
}

export interface LabIndustryDataSourceWarningRecord {
  level: string;
  code: string;
  instanceId?: number;
  instanceName?: string;
  message: string;
}

export interface LabIndustryDataSourceInstanceAssemblyRecord {
  instanceId: number;
  instanceName: string;
  instanceCode: string;
  dbType: string;
  currentGenerationVersion?: number | null;
  currentDirtyVersion?: number | null;
  assemblyStatus: string;
  readyThemeCount: number;
  previewTableCount: number;
  previewRowCount: number;
  activeThemes: LabIndustryDataSourceTheme[];
}

export interface LabIndustryDataSourceLinkagePreviewRecord {
  generatedAt: string;
  summary: Record<string, unknown>;
  themeCoverage: LabIndustryDataSourceThemeCoverageRecord[];
  sharedEntities: LabIndustryDataSourceSharedEntityRecord[];
  warnings: LabIndustryDataSourceWarningRecord[];
  instanceAssemblies: LabIndustryDataSourceInstanceAssemblyRecord[];
}

export interface LabBusinessSystemInstanceRecord {
  id: number;
  instanceCode: string;
  instanceName: string;
  templateId: number;
  templateName: string;
  templateCode?: string | null;
  industryCode?: string | null;
  dbType: string;
  deployTarget?: Record<string, unknown> | null;
  instanceStatus: string;
  currentLogicalVersion?: number | null;
  currentPhysicalVersion?: number | null;
  currentGenerationVersion?: number | null;
  currentDirtyVersion?: number | null;
  physicalVersionId?: number | null;
  physicalVersionNo?: number | null;
  currentPhysicalModel?: Record<string, unknown> | null;
  currentDdlBundle?: Record<string, unknown> | null;
  physicalTableCount?: number;
  businessTableCount?: number;
  dictionaryTableCount?: number;
  columnCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabAiBusinessDataPlanRecord {
  id: number;
  instanceId: number;
  instanceName?: string | null;
  physicalVersionNo: number;
  planStatus: string;
  generatorMode: string;
  requirement?: Record<string, unknown> | null;
  plan?: {
    summary?: string;
    industryUnderstanding?: string[];
    generationMode?: string;
    generationOrder?: string[];
    tableRoles?: Array<Record<string, unknown>>;
    rowAllocation?: Array<Record<string, unknown>>;
    fieldStrategies?: Array<Record<string, unknown>>;
    continuityPlan?: Record<string, unknown>;
    qualityChecks?: string[];
    generatedAt?: string;
  } | null;
  validation?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  modelSummary?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabAiBusinessDataPreviewTable {
  logicalTableName: string;
  physicalTableName: string;
  tableComment?: string | null;
  rowCount: number;
  columns: Array<string | {
    columnName: string;
    columnComment?: string | null;
  }>;
  rows: Array<Record<string, unknown>>;
}

export interface LabAiBusinessDataValidation {
  generatedAt?: string;
  passed: boolean;
  errorCount: number;
  warningCount: number;
  rowCount: number;
  tableSummaries: Array<{
    logicalTableName: string;
    physicalTableName?: string | null;
    rowCount: number;
    primaryKey?: string | null;
  }>;
  issues: Array<{
    level: "error" | "warning" | "info" | string;
    code: string;
    path?: string;
    message: string;
  }>;
}

export interface LabAiBusinessDataBatchRecord {
  id: number;
  instanceId: number;
  instanceName?: string | null;
  planId?: number | null;
  physicalVersionNo: number;
  batchNo: number;
  generationMode: string;
  batchStatus: string;
  generatorMode: string;
  requirement?: Record<string, unknown> | null;
  validation?: LabAiBusinessDataValidation | null;
  loadSummary?: Record<string, unknown> | null;
  rowsByTable?: Record<string, Array<Record<string, unknown>>> | null;
  previewTables?: LabAiBusinessDataPreviewTable[];
  modelSummary?: string | null;
  createdBy: string;
  loadedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabAiBusinessDataState {
  generatedAt?: string;
  physicalVersionNo?: number;
  targetDataSourceId?: number | null;
  targetDataSource?: Record<string, unknown> | null;
  tableStats?: Array<Record<string, unknown>>;
  entityPools?: Record<string, Array<Record<string, unknown>>>;
  warnings?: string[];
}

export interface LabAiBusinessDataTaskRecord {
  id: number;
  taskName: string;
  instanceId: number;
  instanceName?: string | null;
  templateName?: string | null;
  physicalVersionNo: number;
  targetDataSourceId?: number | null;
  targetDataSourceName?: string | null;
  targetDataSourceType?: string | null;
  planId?: number | null;
  planSummary?: string | null;
  taskStatus: string;
  scheduleEnabled: boolean;
  scheduleType: "manual" | "hourly" | "daily" | "weekly" | "cron" | string;
  cronExpr?: string | null;
  generationMode: string;
  totalRows: number;
  batchRows: number;
  timelineStartAt?: string | null;
  timelineDays: number;
  requirementText?: string | null;
  autoLoad: boolean;
  loadMode: string;
  runCount: number;
  lastBatchId?: number | null;
  lastRunStatus?: string | null;
  lastRunMessage?: string | null;
  lastRunAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabIndustryDataSourceLinkedInstanceRecord extends LabBusinessSystemInstanceRecord {
  linkRole?: string;
  sortOrder?: number;
  assemblyStatus?: string;
  readyThemeCount?: number;
  previewTableCount?: number;
  previewRowCount?: number;
  activeThemes?: LabIndustryDataSourceTheme[];
}

export interface LabIndustryDataSourceRecord {
  id: number;
  dataSourceCode: string;
  dataSourceName: string;
  industryCode: string;
  dataSourceDesc?: string | null;
  sourceStatus: string;
  selectedThemes: LabIndustryDataSourceTheme[];
  settings?: Record<string, unknown> | null;
  instanceCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  linkedInstances?: LabIndustryDataSourceLinkedInstanceRecord[];
  linkagePreview?: LabIndustryDataSourceLinkagePreviewRecord | null;
}

export interface LabModelProfileRecord {
  id: number;
  profileName: string;
  stageType: string;
  providerId?: number | null;
  providerName?: string | null;
  modelName: string;
  modelVersion?: string | null;
  modelCode: string;
  endpointUrl?: string | null;
  authMode: string;
  temperature: number;
  maxContextLength: number;
  systemPrompt?: string | null;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabOpsDashboard {
  overview: Record<string, number>;
  rankings: Record<string, Array<Record<string, unknown>>>;
  trends: Record<string, Array<Record<string, unknown>>>;
  sceneSnapshots: Array<Record<string, unknown>>;
}

export interface LabPromptTemplateRecord {
  id: number;
  promptType: string;
  templateName: string;
  templateCode: string;
  content: string;
  userContent: string;
  temperature?: number | null;
  maxTokens?: number | null;
  defaultModelProviderId?: number | null;
  defaultModelProviderName?: string | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  isDefault: boolean;
  status: string;
  latestVersionNo?: number | null;
  latestVersionStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabPromptTemplateVersionRecord {
  id: number;
  promptType: string;
  templateId?: number | null;
  versionNo: number;
  versionStatus: string;
  templateName: string;
  templateCode: string;
  content: string;
  userContent: string;
  temperature?: number | null;
  maxTokens?: number | null;
  defaultModelProviderId?: number | null;
  defaultModelProviderName?: string | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  createdBy: string;
  publishedAt?: string | null;
  createdAt: string;
}

export interface LabSceneTemplateRecord {
  id: number;
  templateName: string;
  templateCode: string;
  category?: string | null;
  sceneDesc?: string | null;
  schema: Record<string, unknown>;
  strategy: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabOperationLogRecord {
  id: number;
  sceneId?: number | null;
  operationType: string;
  operatorName: string;
  requestPayload?: Record<string, unknown> | null;
  resultSummary?: string | null;
  createdAt: string;
}

export interface LabScenarioDictionaryRecord {
  id: number;
  profileId: number;
  dictType: string;
  itemCode: string;
  itemLabel: string;
  itemValue?: Record<string, unknown>;
  weight: number;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabScenarioDistributionRuleRecord {
  id: number;
  profileId: number;
  ruleType: string;
  ruleName: string;
  ruleCode: string;
  ruleConfig?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabScenarioFieldRuleRecord {
  id: number;
  profileId: number;
  tableName: string;
  fieldName: string;
  generatorType: string;
  ruleConfig?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabScenarioComplianceRuleRecord {
  id: number;
  profileId: number;
  ruleCode: string;
  ruleName: string;
  tableName: string;
  fieldName: string;
  ruleType: string;
  ruleConfig?: Record<string, unknown>;
  issueCategory: string;
  severity: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabScenarioPluginBindingRecord {
  id: number;
  profileId: number;
  pluginKey: string;
  pluginName: string;
  bindingScope: string;
  bindingConfig?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabScenarioExtendedRuleRecord {
  id: number;
  profileId: number;
  ruleCategory: "linkage" | "temporal" | "cardinality" | "state_flow" | "code";
  moduleKey: string;
  ruleCode: string;
  ruleName: string;
  industryScope?: string | null;
  sceneScope?: string | null;
  tableName?: string | null;
  fieldName?: string | null;
  ruleConfig?: Record<string, unknown>;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabScenarioEnhancementVersionRecord {
  id: number;
  profileId: number;
  versionNo: number;
  versionStatus: string;
  snapshot?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface LabScenarioEnhancementRecord {
  id: number;
  profileName: string;
  profileCode: string;
  industry: string;
  subScenario?: string | null;
  profileDesc?: string | null;
  locale: string;
  businessStyle: string;
  confidenceThreshold: number;
  priority: number;
  status: string;
  isSystem: boolean;
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
  createdBy: string;
  dictionaryCount?: number;
  distributionRuleCount?: number;
  fieldRuleCount?: number;
  complianceRuleCount?: number;
  pluginBindingCount?: number;
  extendedRuleCount?: number;
  latestVersionNo?: number | null;
  latestVersionStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  dictionaries?: LabScenarioDictionaryRecord[];
  distributionRules?: LabScenarioDistributionRuleRecord[];
  fieldRules?: LabScenarioFieldRuleRecord[];
  complianceRules?: LabScenarioComplianceRuleRecord[];
  pluginBindings?: LabScenarioPluginBindingRecord[];
  extendedRules?: LabScenarioExtendedRuleRecord[];
  versions?: LabScenarioEnhancementVersionRecord[];
}

export interface LabScenarioRecognitionPreview {
  industry: string;
  subScenario: string;
  confidence: number;
  signals: string[];
  locale?: string;
  businessStyle?: string;
  subtype?: string;
  preferredCategories?: string[];
  managedProfileId?: number;
  managedProfileCode?: string;
  distributionRules?: Array<Record<string, unknown>>;
  fieldRules?: Array<Record<string, unknown>>;
  pluginBindings?: Array<Record<string, unknown>>;
  extendedRules?: Array<Record<string, unknown>>;
  cities?: Array<Record<string, unknown>>;
  paymentChannels?: Array<Record<string, unknown>>;
  orderStatuses?: Array<Record<string, unknown>>;
}

export interface LabIndustryIncubationRoundRecord {
  id: number;
  incubationId: number;
  roundNo: number;
  roundName: string;
  roundStatus: string;
  selectedScenarios?: Array<Record<string, unknown>>;
  evidenceSnapshot?: Array<Record<string, unknown>>;
  committeeSnapshot?: Record<string, unknown>;
  resultSummary?: Record<string, unknown>;
  enhancementDelta?: Record<string, unknown>;
  startedAt?: string | null;
  endedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabIndustryIncubationRecord {
  id: number;
  incubationName: string;
  incubationCode: string;
  industryCode: string;
  enhancementProfileId?: number | null;
  enhancementProfileName?: string | null;
  incubationDesc?: string | null;
  status: string;
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
  latestRoundNo?: number;
  lastSyncedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  rounds?: LabIndustryIncubationRoundRecord[];
}

export interface LabIndustryIncubationLogRecord {
  id: number;
  incubationId: number;
  roundNo?: number | null;
  logLevel: string;
  logType: string;
  stepKey: string;
  message: string;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  detail?: Record<string, unknown> | null;
  createdAt: string;
}

export interface LabIndustryIncubationCategoryStatsRecord {
  categoryCode: string;
  categoryName: string;
  tableCount: number;
  dictionaryGroupCount: number;
  dictionaryItemCount: number;
  evidenceCount: number;
  lastRoundNo: number;
}

export interface LabIndustryIncubationDictionaryGroupStatsRecord {
  dictType: string;
  dictName: string;
  itemCount: number;
}

export interface LabIndustryIncubationStatsRecord {
  incubationId: number;
  incubationName: string;
  totals: {
    categoryCount: number;
    tableCount: number;
    dictionaryGroupCount: number;
    dictionaryItemCount: number;
    publicDictionaryGroupCount: number;
    publicDictionaryItemCount: number;
  };
  categories: LabIndustryIncubationCategoryStatsRecord[];
  publicDictionaries: LabIndustryIncubationDictionaryGroupStatsRecord[];
}
