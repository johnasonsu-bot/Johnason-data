import type { UserProfile } from "../types/api";

export const READ_ONLY_MODE_KEY = "medata_readonly_mode";

export function isReadOnlyUser(user: Pick<UserProfile, "roleCode" | "roleType" | "permissions"> | null | undefined) {
  const roleCode = String(user?.roleCode || "").toLowerCase();
  const roleType = String(user?.roleType || "").toLowerCase();
  const mode = String(user?.permissions?.mode || "").toLowerCase();
  return roleCode === "viewer" || roleType === "viewer" || mode === "readonly";
}

export function isReadOnlyModeActive() {
  return localStorage.getItem(READ_ONLY_MODE_KEY) === "1";
}

export function syncReadOnlyMode(user: Pick<UserProfile, "roleCode" | "roleType" | "permissions"> | null | undefined) {
  if (isReadOnlyUser(user)) {
    localStorage.setItem(READ_ONLY_MODE_KEY, "1");
    return;
  }
  localStorage.removeItem(READ_ONLY_MODE_KEY);
}

const READ_ONLY_ALLOWED_WRITES = [
  /^\/auth\/login$/,
  /^\/asset-search\/search$/,
  /^\/asset-search\/business-data\/search$/,
  /^\/data-development\/processing\/jobs\/preview$/,
  /^\/data-development\/processing\/jobs\/\d+\/preview$/,
  /^\/reporting\/datasets\/preview$/,
  /^\/reporting\/dashboards\/preview-chart$/,
  /^\/reporting\/runtime\/dashboards\/\d+\/preview-chart$/,
  /^\/auth\/logout$/,
];

export function isReadOnlyAllowedRequest(method: string, path: string) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    return true;
  }

  const normalizedPath = String(path || "").split("?")[0].replace(/^\/api\/v1/, "");
  return READ_ONLY_ALLOWED_WRITES.some((pattern) => pattern.test(normalizedPath));
}
