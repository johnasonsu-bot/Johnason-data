const SELECTED_PROJECT_ID_KEY = "medata_selected_project_id";
const APPLY_DEFAULT_PROJECT_ON_LOGIN_KEY = "medata_apply_default_project_on_login";

export function getSelectedProjectId() {
  const raw = localStorage.getItem(SELECTED_PROJECT_ID_KEY);
  const projectId = Number(raw || 0);
  return Number.isFinite(projectId) && projectId > 0 ? projectId : null;
}

export function setSelectedProjectId(projectId: number | null) {
  if (projectId) {
    localStorage.setItem(SELECTED_PROJECT_ID_KEY, String(projectId));
  } else {
    localStorage.removeItem(SELECTED_PROJECT_ID_KEY);
  }
}

export function markApplyDefaultProjectOnLogin() {
  sessionStorage.setItem(APPLY_DEFAULT_PROJECT_ON_LOGIN_KEY, "1");
}

export function consumeApplyDefaultProjectOnLogin() {
  const shouldApply = sessionStorage.getItem(APPLY_DEFAULT_PROJECT_ON_LOGIN_KEY) === "1";
  if (shouldApply) {
    sessionStorage.removeItem(APPLY_DEFAULT_PROJECT_ON_LOGIN_KEY);
  }
  return shouldApply;
}

export function clearApplyDefaultProjectOnLogin() {
  sessionStorage.removeItem(APPLY_DEFAULT_PROJECT_ON_LOGIN_KEY);
}

export function getSelectedProjectHeaders(): Record<string, string> {
  const projectId = getSelectedProjectId();
  return projectId ? { "X-Project-Id": String(projectId) } : {};
}

export { SELECTED_PROJECT_ID_KEY, APPLY_DEFAULT_PROJECT_ON_LOGIN_KEY };
