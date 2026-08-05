export type ServiceUsageTaskParameter = {
  key?: string;
  value?: string;
};

export type ServiceUsageTask = {
  key: string;
  taskName: string;
  serviceId?: number;
  appId?: number;
  path: string;
  method: "GET" | "POST";
  appToken?: string;
  paramsList: ServiceUsageTaskParameter[];
  callsPerMinuteMin: number;
  callsPerMinuteMax: number;
  updatedAt: string;
};

export type ServiceUsageHistoryItem = {
  key: string;
  calledAt: string;
  taskKey?: string;
  taskName: string;
  method: "GET" | "POST";
  path: string;
  status: "成功" | "失败";
  latencyMs?: number;
  message: string;
  requestParams?: Record<string, unknown>;
  responseData?: unknown;
  errorDetail?: string;
};

const STORAGE_KEY = "medata.service-usage.tasks";
const HISTORY_STORAGE_KEY = "medata.service-usage.history";
const RUNNING_TASKS_STORAGE_KEY = "medata.service-usage.running-tasks";

function getDefaultTask(): ServiceUsageTask {
  return {
    key: "task-default",
    taskName: "默认调用任务",
    method: "GET",
    path: "",
    appToken: "",
    paramsList: [{ key: "", value: "" }],
    callsPerMinuteMin: 1,
    callsPerMinuteMax: 1,
    updatedAt: new Date().toISOString(),
  };
}

export function loadServiceUsageTasks(): ServiceUsageTask[] {
  if (typeof window === "undefined") return [getDefaultTask()];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [getDefaultTask()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [getDefaultTask()];
    return parsed.map((item) => {
      const minCalls = Math.max(1, Number(item.callsPerMinuteMin ?? item.callsPerMinute ?? 1));
      const maxCalls = Math.max(minCalls, Number(item.callsPerMinuteMax ?? item.callsPerMinute ?? minCalls));
      return {
        key: String(item.key || `task-${Date.now()}`),
        taskName: String(item.taskName || "未命名任务"),
        serviceId: item.serviceId ? Number(item.serviceId) : undefined,
        appId: item.appId ? Number(item.appId) : undefined,
        path: String(item.path || ""),
        method: item.method === "POST" ? "POST" : "GET",
        appToken: String(item.appToken || ""),
        paramsList: Array.isArray(item.paramsList) && item.paramsList.length ? item.paramsList : [{ key: "", value: "" }],
        callsPerMinuteMin: minCalls,
        callsPerMinuteMax: maxCalls,
        updatedAt: String(item.updatedAt || new Date().toISOString()),
      };
    });
  } catch {
    return [getDefaultTask()];
  }
}

export function saveServiceUsageTasks(tasks: ServiceUsageTask[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function createServiceUsageTask(): ServiceUsageTask {
  return {
    ...getDefaultTask(),
    key: `task-${Date.now()}`,
    taskName: "新建调用任务",
    updatedAt: new Date().toISOString(),
  };
}

export function loadServiceUsageHistory(): ServiceUsageHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      key: String(item.key || `${Date.now()}-${Math.random()}`),
      calledAt: String(item.calledAt || new Date().toISOString()),
      taskKey: item.taskKey ? String(item.taskKey) : undefined,
      taskName: String(item.taskName || "未命名任务"),
      method: item.method === "POST" ? "POST" : "GET",
      path: String(item.path || ""),
      status: item.status === "失败" ? "失败" : "成功",
      latencyMs: item.latencyMs !== undefined ? Number(item.latencyMs) : undefined,
      message: String(item.message || ""),
      requestParams: item.requestParams && typeof item.requestParams === "object" ? item.requestParams : {},
      responseData: item.responseData,
      errorDetail: item.errorDetail ? String(item.errorDetail) : undefined,
    }));
  } catch {
    return [];
  }
}

export function saveServiceUsageHistory(history: ServiceUsageHistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

export function loadRunningServiceUsageTaskKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RUNNING_TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveRunningServiceUsageTaskKeys(taskKeys: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RUNNING_TASKS_STORAGE_KEY, JSON.stringify(taskKeys));
}
