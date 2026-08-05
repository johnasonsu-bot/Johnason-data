import { http } from "./http";
import type {
  ApiEnvelope,
  ManagedServiceRecord,
  MetaDatabaseArchitecture,
  SystemResourceHistoryPeriod,
  SystemResourceSnapshot,
  SystemRoleRecord,
  SystemUserRecord
} from "../types/api";

export interface ManagedServicePayload {
  serviceKey: string;
  serviceName: string;
  serviceCategory: ManagedServiceRecord["serviceCategory"];
  serviceType: ManagedServiceRecord["serviceType"];
  manageMode: ManagedServiceRecord["manageMode"];
  host?: string;
  port?: number | null;
  autoStart: boolean;
  status: ManagedServiceRecord["status"];
  notes?: string;
  config?: Record<string, unknown>;
}

export interface SystemRolePayload {
  roleName: string;
  roleCode: string;
  roleType: SystemRoleRecord["roleType"];
  permissions: {
    modules: string[];
    mode?: "readonly" | string;
    actions?: string[];
  };
  status: SystemRoleRecord["status"];
}

export interface SystemUserPayload {
  username: string;
  displayName: string;
  roleId?: number;
  roleCode?: string;
  status: SystemUserRecord["status"];
  password?: string;
}

export type DatabaseDriverTarget = "query" | "dataxReader" | "dataxWriter";

export interface DatabaseDriverPackage {
  id: number;
  databaseType: "mysql" | "postgresql" | "oracle" | "dm";
  driverName: string;
  version: string;
  driverClass: string;
  originalFileName: string;
  fileSize: number;
  sha256: string;
  targets: DatabaseDriverTarget[];
  validationStatus: "pending" | "validated" | "failed";
  validationMessage?: string | null;
  javaVersion?: string | null;
  uploadedByName: string;
  createdAt: string;
}

export interface DatabaseDriverBinding {
  id: number;
  databaseType: DatabaseDriverPackage["databaseType"];
  target: DatabaseDriverTarget;
  packageId: number;
  previousPackageId?: number | null;
  driverName: string;
  version: string;
  driverClass: string;
  sha256: string;
  activatedByName: string;
  activatedAt: string;
}

export interface DatabaseDriverOperationLog {
  id: number;
  packageId?: number | null;
  databaseType: DatabaseDriverPackage["databaseType"];
  action: string;
  status: string;
  detail: Record<string, unknown>;
  operatorName: string;
  createdAt: string;
}

export interface DatabaseDriverManagementData {
  packages: DatabaseDriverPackage[];
  bindings: DatabaseDriverBinding[];
  logs: DatabaseDriverOperationLog[];
  capabilities: DatabaseDriverCapabilityStatus[];
  runtimeManifest: { bindings: Record<string, unknown>; updatedAt?: string | null };
}

export interface DatabaseDriverCapabilityStatus {
  type: DatabaseDriverPackage["databaseType"];
  label: string;
  driverClassName: string;
  queryReady: boolean;
  dataxReaderReady: boolean;
  dataxWriterReady: boolean;
  managedQueryDriver?: { packageId: number; version: string; sha256: string } | null;
}

export function fetchManagedServices(token: string) {
  return http<ApiEnvelope<ManagedServiceRecord[]>>("/system-management/services", undefined, token);
}

export function createManagedService(token: string, payload: ManagedServicePayload) {
  return http<ApiEnvelope<ManagedServiceRecord>>("/system-management/services", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateManagedService(token: string, id: number, payload: ManagedServicePayload) {
  return http<ApiEnvelope<ManagedServiceRecord>>(`/system-management/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteManagedService(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/system-management/services/${id}`, {
    method: "DELETE"
  }, token);
}

export function operateManagedService(token: string, id: number, action: "start" | "stop" | "restart") {
  return http<ApiEnvelope<{ accepted: boolean; action: string; message?: string }>>(`/system-management/services/${id}/actions/${action}`, {
    method: "POST"
  }, token);
}

export function restartWebStack(token: string) {
  return http<ApiEnvelope<{ accepted: boolean; message: string }>>("/system-management/services/actions/restart-web-stack", {
    method: "POST"
  }, token);
}

export function startDefaultServices(token: string) {
  return http<ApiEnvelope<{ accepted: boolean; startedServiceKeys: string[] }>>("/system-management/services/actions/start-default", {
    method: "POST"
  }, token);
}

export function runKafkaDemoPump(token: string) {
  return http<ApiEnvelope<{ topic: string; messageCount: number; mysqlCount: number; hiveCount: number }>>("/system-management/services/actions/run-kafka-demo-pump", {
    method: "POST"
  }, token);
}

export function fetchSystemRoles(token: string) {
  return http<ApiEnvelope<SystemRoleRecord[]>>("/system-management/roles", undefined, token);
}

export function createSystemRole(token: string, payload: SystemRolePayload) {
  return http<ApiEnvelope<SystemRoleRecord>>("/system-management/roles", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateSystemRole(token: string, id: number, payload: SystemRolePayload) {
  return http<ApiEnvelope<SystemRoleRecord>>(`/system-management/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteSystemRole(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/system-management/roles/${id}`, {
    method: "DELETE"
  }, token);
}

export function fetchSystemUsers(token: string) {
  return http<ApiEnvelope<SystemUserRecord[]>>("/system-management/users", undefined, token);
}

export function createSystemUser(token: string, payload: SystemUserPayload) {
  return http<ApiEnvelope<SystemUserRecord>>("/system-management/users", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function updateSystemUser(token: string, id: number, payload: SystemUserPayload) {
  return http<ApiEnvelope<SystemUserRecord>>(`/system-management/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteSystemUser(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/system-management/users/${id}`, {
    method: "DELETE"
  }, token);
}

export function fetchSystemResources(token: string, period: SystemResourceHistoryPeriod = "1h") {
  return http<ApiEnvelope<SystemResourceSnapshot>>(`/system-management/resources?period=${period}`, undefined, token);
}

export function fetchDatabaseArchitecture(token: string) {
  return http<ApiEnvelope<MetaDatabaseArchitecture>>("/system-management/database-architecture", undefined, token);
}


export function fetchDatabaseDrivers(token: string) {
  return http<ApiEnvelope<DatabaseDriverManagementData>>("/system-management/database-drivers", undefined, token);
}

export function uploadDatabaseDriver(token: string, payload: {
  databaseType: string;
  driverName: string;
  version: string;
  driverClass: string;
  targets: DatabaseDriverTarget[];
  file: File;
}) {
  const body = new FormData();
  body.append("databaseType", payload.databaseType);
  body.append("driverName", payload.driverName);
  body.append("version", payload.version);
  body.append("driverClass", payload.driverClass);
  body.append("targets", JSON.stringify(payload.targets));
  body.append("file", payload.file);
  return http<ApiEnvelope<DatabaseDriverPackage>>("/system-management/database-drivers/upload", { method: "POST", body }, token);
}

export function uploadAndActivateDatabaseDriver(token: string, databaseType: DatabaseDriverPackage["databaseType"], file: File) {
  const body = new FormData();
  body.append("databaseType", databaseType);
  body.append("file", file);
  return http<ApiEnvelope<DatabaseDriverManagementData>>("/system-management/database-drivers/upload-and-activate", { method: "POST", body }, token);
}

export function validateDatabaseDriver(token: string, id: number) {
  return http<ApiEnvelope<DatabaseDriverPackage>>(`/system-management/database-drivers/${id}/validate`, { method: "POST" }, token);
}

export function activateDatabaseDriver(token: string, id: number, targets: DatabaseDriverTarget[]) {
  return http<ApiEnvelope<DatabaseDriverManagementData>>(`/system-management/database-drivers/${id}/activate`, {
    method: "POST",
    body: JSON.stringify({ targets }),
  }, token);
}

export function rollbackDatabaseDriver(token: string, databaseType: string, target: DatabaseDriverTarget) {
  return http<ApiEnvelope<{ bindings: DatabaseDriverBinding[] }>>("/system-management/database-drivers/rollback", {
    method: "POST",
    body: JSON.stringify({ databaseType, target }),
  }, token);
}

export function deactivateDatabaseDriver(token: string, databaseType: string, target: DatabaseDriverTarget) {
  return http<ApiEnvelope<{ bindings: DatabaseDriverBinding[] }>>("/system-management/database-drivers/deactivate", {
    method: "POST",
    body: JSON.stringify({ databaseType, target }),
  }, token);
}

export function deleteDatabaseDriver(token: string, id: number) {
  return http<ApiEnvelope<{ id: number }>>(`/system-management/database-drivers/${id}`, { method: "DELETE" }, token);
}
