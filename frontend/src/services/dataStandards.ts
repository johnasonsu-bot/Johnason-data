import { http } from "./http";
import { getSelectedProjectId } from "./projectContext";
import type { ApiEnvelope } from "../types/api";

export type StandardStatus = "active" | "inactive" | string;
export type StandardLifecycleStatus = "draft" | "review" | "published" | "deprecated" | string;

export interface StandardCatalog {
  id: number;
  parentId?: number | null;
  parentName?: string | null;
  catalogName: string;
  catalogCode: string;
  catalogType: string;
  ownerName?: string;
  description?: string;
  sortOrder: number;
  status: StandardStatus;
  elementCount?: number;
  nationalElementCount?: number;
  industryElementCount?: number;
  enterpriseElementCount?: number;
  children?: StandardCatalog[];
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceStandard {
  id: number;
  standardCode: string;
  standardName: string;
  standardType: string;
  standardNo?: string;
  publisher?: string;
  effectiveDate?: string | null;
  standardUrl?: string;
  description?: string;
  status: StandardStatus;
  elementCount?: number;
  valueDomainCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ValueDomainItem {
  id?: number;
  domainId?: number;
  itemCode: string;
  itemLabel: string;
  itemValue?: string;
  itemMeaning?: string;
  sortOrder?: number;
  status?: StandardStatus;
}

export interface ValueDomain {
  id: number;
  domainCode: string;
  domainName: string;
  domainType: "enumeration" | "range" | "regex" | "reference" | "free_text" | string;
  valueType: "string" | "number" | "date" | "datetime" | "boolean" | string;
  dataType?: string;
  minValue?: number | null;
  maxValue?: number | null;
  regexPattern?: string;
  formatPattern?: string;
  unit?: string;
  referenceStandardId?: number | null;
  referenceStandardName?: string;
  referenceClause?: string;
  description?: string;
  status: StandardStatus;
  itemCount?: number;
  elementCount?: number;
  items?: ValueDomainItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StandardDataElement {
  id: number;
  standardType?: "national" | "industry" | "enterprise" | string;
  elementIdentifier: string;
  elementCode: string;
  elementNameCn: string;
  elementNameEn?: string;
  catalogId?: number | null;
  catalogName?: string;
  catalogCode?: string;
  objectClass?: string;
  propertyName?: string;
  representationTerm?: string;
  qualifiers?: string[];
  definition?: string;
  dataType: string;
  maxLength?: number | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
  datetimePrecision?: string;
  formatPattern?: string;
  unit?: string;
  valueDomainId?: number | null;
  valueDomainName?: string;
  valueDomainCode?: string;
  referenceStandardId?: number | null;
  referenceStandardName?: string;
  referenceClause?: string;
  aliases?: string[];
  tags?: string[];
  ownerName?: string;
  stewardName?: string;
  lifecycleStatus: StandardLifecycleStatus;
  currentVersionNo: number;
  status: StandardStatus;
  mappingCount?: number;
  versions?: Array<{
    id: number;
    versionNo: number;
    versionStatus: string;
    changeSummary?: string;
    createdAt: string;
    publishedAt?: string | null;
  }>;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataStandardsOverview {
  elementCount: number;
  publishedElementCount: number;
  draftElementCount: number;
  catalogCount: number;
  valueDomainCount: number;
  referenceStandardCount: number;
  mappingCount: number;
  approvedMappingCount: number;
  suggestedMappingCount: number;
  recentElements: StandardDataElement[];
}

export interface StandardAiConfig {
  id: number;
  sceneName: string;
  sceneCode: string;
  defaultModelProviderId?: number | null;
  defaultModelProviderName?: string;
  defaultModelName?: string;
  defaultModelVersion?: string;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  systemPrompt?: string;
  userPromptTemplate?: string;
  outputSchema?: Record<string, unknown>;
  description?: string;
  ownerName: string;
  status: StandardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StandardFieldMapping {
  id: number;
  elementId: number;
  elementCode: string;
  elementNameCn: string;
  sourceModule: string;
  resourceId?: number | null;
  resourceCode?: string;
  tableName: string;
  columnName: string;
  mappingStatus: string;
  confidence?: number | null;
  evidence?: string[];
  createdBy: string;
  reviewedBy?: string;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StandardImportPreview {
  id?: number;
  status?: string;
  importType: "bundle" | "elements" | "value-domains";
  strategy: "append" | "update" | "merge" | "overwrite";
  templateVersion: string;
  summary: {
    totalRows: number;
    createRows: number;
    updateRows: number;
    errorRows: number;
    sheetCounts: Record<string, number>;
  };
  errors: Array<{
    sheetName: string;
    rowNumber: number;
    businessCode?: string | null;
    fieldName?: string | null;
    rawValue?: string;
    errorType: string;
    errorMessage: string;
  }>;
}

export interface StandardImportBatch {
  id: number;
  importType: string;
  strategy: string;
  fileName: string;
  status: string;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  createdBy: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

function buildQuery(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function fetchDataStandardsOverview(token?: string) {
  return http<ApiEnvelope<DataStandardsOverview>>("/data-standards/overview", undefined, token);
}

export function fetchStandardCatalogs(token?: string) {
  return http<ApiEnvelope<StandardCatalog[]>>("/data-standards/catalogs", undefined, token);
}

export function fetchStandardCatalogTree(token?: string) {
  return http<ApiEnvelope<StandardCatalog[]>>("/data-standards/catalogs/tree", undefined, token);
}

export function saveStandardCatalog(token: string | undefined, payload: Partial<StandardCatalog> & { id?: number }) {
  const body = JSON.stringify(payload);
  return payload.id
    ? http<ApiEnvelope<StandardCatalog>>(`/data-standards/catalogs/${payload.id}`, { method: "PUT", body }, token)
    : http<ApiEnvelope<StandardCatalog>>("/data-standards/catalogs", { method: "POST", body }, token);
}

export function deleteStandardCatalog(token: string | undefined, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-standards/catalogs/${id}`, { method: "DELETE" }, token);
}

export function fetchReferenceStandards(token?: string, params?: Record<string, unknown>) {
  return http<ApiEnvelope<ReferenceStandard[]>>(`/data-standards/reference-standards${buildQuery(params)}`, undefined, token);
}

export function saveReferenceStandard(token: string | undefined, payload: Partial<ReferenceStandard> & { id?: number }) {
  const body = JSON.stringify(payload);
  return payload.id
    ? http<ApiEnvelope<ReferenceStandard>>(`/data-standards/reference-standards/${payload.id}`, { method: "PUT", body }, token)
    : http<ApiEnvelope<ReferenceStandard>>("/data-standards/reference-standards", { method: "POST", body }, token);
}

export function deleteReferenceStandard(token: string | undefined, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-standards/reference-standards/${id}`, { method: "DELETE" }, token);
}

export function fetchValueDomains(token?: string, params?: Record<string, unknown>) {
  return http<ApiEnvelope<ValueDomain[]>>(`/data-standards/value-domains${buildQuery(params)}`, undefined, token);
}

export function fetchValueDomainDetail(token: string | undefined, id: number) {
  return http<ApiEnvelope<ValueDomain>>(`/data-standards/value-domains/${id}`, undefined, token);
}

export function saveValueDomain(token: string | undefined, payload: Partial<ValueDomain> & { id?: number }) {
  const body = JSON.stringify(payload);
  return payload.id
    ? http<ApiEnvelope<ValueDomain>>(`/data-standards/value-domains/${payload.id}`, { method: "PUT", body }, token)
    : http<ApiEnvelope<ValueDomain>>("/data-standards/value-domains", { method: "POST", body }, token);
}

export function deleteValueDomain(token: string | undefined, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-standards/value-domains/${id}`, { method: "DELETE" }, token);
}

export function fetchStandardDataElements(token?: string, params?: Record<string, unknown>) {
  return http<ApiEnvelope<StandardDataElement[]>>(`/data-standards/elements${buildQuery(params)}`, undefined, token);
}

export function fetchStandardDataElementDetail(token: string | undefined, id: number) {
  return http<ApiEnvelope<StandardDataElement>>(`/data-standards/elements/${id}`, undefined, token);
}

export function saveStandardDataElement(token: string | undefined, payload: Partial<StandardDataElement> & { id?: number }) {
  const body = JSON.stringify(payload);
  return payload.id
    ? http<ApiEnvelope<StandardDataElement>>(`/data-standards/elements/${payload.id}`, { method: "PUT", body }, token)
    : http<ApiEnvelope<StandardDataElement>>("/data-standards/elements", { method: "POST", body }, token);
}

export function publishStandardDataElement(token: string | undefined, id: number, payload: { changeSummary?: string }) {
  return http<ApiEnvelope<StandardDataElement>>(`/data-standards/elements/${id}/publish`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function deleteStandardDataElement(token: string | undefined, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/data-standards/elements/${id}`, { method: "DELETE" }, token);
}

export function fetchStandardFieldMappings(token?: string, params?: Record<string, unknown>) {
  return http<ApiEnvelope<StandardFieldMapping[]>>(`/data-standards/mappings${buildQuery(params)}`, undefined, token);
}

export function fetchStandardAiConfigs(token?: string) {
  return http<ApiEnvelope<StandardAiConfig[]>>("/data-standards/ai-configs", undefined, token);
}

export function updateStandardAiConfig(token: string | undefined, id: number, payload: Partial<StandardAiConfig>) {
  return http<ApiEnvelope<StandardAiConfig>>(`/data-standards/ai-configs/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export function suggestStandardDataElements(token: string | undefined, payload: { sourceText: string; catalogId?: number; referenceStandardId?: number }) {
  return http<ApiEnvelope<{ candidates?: Array<Partial<StandardDataElement> & { confidence?: number; evidence?: string[]; risks?: string[] }>; mode?: string }>>(
    "/data-standards/ai/suggest-elements",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

async function downloadExcel(token: string | undefined, path: string, fallbackFileName: string) {
  const projectId = getSelectedProjectId();
  const response = await fetch(`/api/v1${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(projectId ? { "X-Project-Id": String(projectId) } : {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Excel 下载失败");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = disposition.match(/filename="([^"]+)"/i)?.[1];
  const fileName = decodeURIComponent(encoded || quoted || fallbackFileName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadStandardTemplate(token: string | undefined, type: "bundle" | "elements" | "value-domains" = "bundle") {
  return downloadExcel(token, `/data-standards/import-templates?type=${type}`, `数据标准批量注册模板_${type}.xlsx`);
}

export function exportStandardExcel(token: string | undefined, type: "bundle" | "elements" | "value-domains" = "bundle") {
  return downloadExcel(token, `/data-standards/exports?type=${type}`, `数据标准导出_${type}.xlsx`);
}

export async function previewStandardImport(token: string | undefined, file: File, payload: { importType: string; strategy: string }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("importType", payload.importType);
  formData.append("strategy", payload.strategy);
  return http<ApiEnvelope<StandardImportPreview>>("/data-standards/imports/preview", { method: "POST", body: formData }, token);
}

export async function commitStandardImport(token: string | undefined, file: File, payload: { importType: string; strategy: string }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("importType", payload.importType);
  formData.append("strategy", payload.strategy);
  return http<ApiEnvelope<StandardImportPreview>>("/data-standards/imports", { method: "POST", body: formData }, token);
}

export function fetchStandardImportBatches(token?: string) {
  return http<ApiEnvelope<StandardImportBatch[]>>("/data-standards/imports", undefined, token);
}

export function downloadStandardImportErrors(token: string | undefined, id: number) {
  return downloadExcel(token, `/data-standards/imports/${id}/errors`, `数据标准导入错误_${id}.xlsx`);
}
