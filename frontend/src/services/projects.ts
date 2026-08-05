import { http } from "./http";
import type {
  ApiEnvelope,
  ProjectMemberRecord,
  ProjectSpaceDetail,
  ProjectSpaceRecord,
} from "../types/api";

const inflightMyProjectRequests = new Map<string, Promise<ApiEnvelope<ProjectSpaceRecord[]>>>();

export interface ProjectSpacePayload {
  projectName: string;
  projectCode: string;
  projectType: ProjectSpaceRecord["projectType"];
  description?: string;
  ownerUserId?: number | null;
  ownerName?: string;
  status: ProjectSpaceRecord["status"];
  resourceConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface ProjectMemberPayload {
  userId: number;
  projectRole: ProjectMemberRecord["projectRole"];
  permissions?: {
    modules: string[];
  };
  status: ProjectMemberRecord["status"];
}

export interface ProjectAssetImportPreview {
  sourceProject: {
    id?: number;
    code?: string;
    name?: string;
    type?: string;
  };
  exportedAt: string;
  sensitiveMode: string;
  packageVersion?: string;
  sourcePackageVersion?: string;
  integrityVerified?: boolean;
  warnings?: string[];
  coverage?: {
    configurationAssets?: boolean;
    projectRuntimeFiles?: boolean;
    externalPhysicalData?: boolean;
  };
  modules: Array<{
    moduleKey: string;
    moduleName: string;
    tableCount: number;
    rowCount: number;
  }>;
  tableCount: number;
  rowCount: number;
  runtimeFileCount?: number;
}

export interface ProjectAssetTransferLog {
  id: number;
  projectId: number | null;
  operationType: "export" | "import";
  packageVersion: string;
  modules: unknown[];
  status: "success" | "failed" | "running";
  summary: Record<string, unknown>;
  errorMessage?: string | null;
  operatorName: string;
  createdAt: string;
  updatedAt: string;
}

export function fetchMyProjects(token: string) {
  const inflight = inflightMyProjectRequests.get(token);
  if (inflight) {
    return inflight;
  }

  const request = http<ApiEnvelope<ProjectSpaceRecord[]>>("/projects/my", undefined, token)
    .finally(() => {
      inflightMyProjectRequests.delete(token);
    });
  inflightMyProjectRequests.set(token, request);
  return request;
}

export function fetchProjects(token: string) {
  return http<ApiEnvelope<ProjectSpaceRecord[]>>("/projects", undefined, token);
}

export function fetchProjectDetail(token: string, id: number) {
  return http<ApiEnvelope<ProjectSpaceDetail>>(`/projects/${id}`, undefined, token);
}

export function createProject(token: string, payload: ProjectSpacePayload) {
  return http<ApiEnvelope<ProjectSpaceRecord>>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateProject(token: string, id: number, payload: ProjectSpacePayload) {
  return http<ApiEnvelope<ProjectSpaceRecord>>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteProject(token: string, id: number) {
  return http<ApiEnvelope<{ projectId: number; deleted: boolean }>>(`/projects/${id}`, {
    method: "DELETE",
  }, token);
}

export function updateProjectStatus(token: string, id: number, status: ProjectSpaceRecord["status"]) {
  return http<ApiEnvelope<ProjectSpaceRecord>>(`/projects/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  }, token);
}

export function setDefaultProject(token: string, id: number) {
  return http<ApiEnvelope<{ defaultProjectId: number; project: ProjectSpaceRecord }>>(`/projects/${id}/default`, {
    method: "POST",
  }, token);
}

export function upsertProjectMember(token: string, projectId: number, payload: ProjectMemberPayload) {
  return http<ApiEnvelope<ProjectMemberRecord>>(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function removeProjectMember(token: string, projectId: number, userId: number) {
  return http<ApiEnvelope<{ projectId: number; userId: number }>>(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  }, token);
}

export async function exportProjectAssets(token: string, projectId: number, options: { sensitiveMode?: "desensitized" | "encrypted"; packageKey?: string } = {}) {
  const sensitiveMode = options.sensitiveMode || "desensitized";
  const response = await fetch(`/api/v1/projects/${projectId}/assets/export?sensitiveMode=${sensitiveMode}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.packageKey ? { "X-Project-Package-Key": options.packageKey } : {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "导出项目资产失败");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const matched = disposition.match(/filename="([^"]+)"/);
  const fileName = matched?.[1] || `project-assets-${Date.now()}.medata-project.json`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function createProjectAssetBackup(token: string, projectId: number) {
  return http<ApiEnvelope<{ id: number; projectId: number; packageVersion: string; packageSha256?: string | null; createdAt: string }>>(
    `/projects/${projectId}/assets/backups`,
    { method: "POST" },
    token
  );
}

export async function previewProjectAssetImport(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return http<ApiEnvelope<ProjectAssetImportPreview>>("/projects/assets/import/preview", {
    method: "POST",
    body: formData,
  }, token);
}

export async function importProjectAssets(token: string, file: File, payload: { mode: "new" | "overwrite"; targetProjectId?: number | null; targetProjectName?: string; targetProjectCode?: string; packageKey?: string }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", payload.mode);
  if (payload.targetProjectId) {
    formData.append("targetProjectId", String(payload.targetProjectId));
  }
  if (payload.targetProjectName) {
    formData.append("targetProjectName", payload.targetProjectName);
  }
  if (payload.targetProjectCode) {
    formData.append("targetProjectCode", payload.targetProjectCode);
  }
  return http<ApiEnvelope<{ projectId: number; summary: Record<string, unknown> }>>("/projects/assets/import", {
    method: "POST",
    body: formData,
    headers: payload.packageKey ? { "X-Project-Package-Key": payload.packageKey } : undefined,
  }, token);
}

export function fetchProjectAssetTransferLogs(token: string, projectId?: number | null) {
  const query = projectId ? `?projectId=${projectId}` : "";
  return http<ApiEnvelope<ProjectAssetTransferLog[]>>(`/projects/asset-transfer-logs${query}`, undefined, token);
}
