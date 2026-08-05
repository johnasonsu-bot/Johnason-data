import { message } from "antd";
import { useEffect, useRef } from "react";
import { invokeRuntimeDataService } from "../../services/dataServices";
import {
  loadRunningServiceUsageTaskKeys,
  loadServiceUsageHistory,
  loadServiceUsageTasks,
  saveRunningServiceUsageTaskKeys,
  saveServiceUsageHistory,
  type ServiceUsageHistoryItem,
  type ServiceUsageTask,
} from "./serviceUsageTasks";

function buildParamsObject(paramsList?: Array<{ key?: string; value?: string }>) {
  return (paramsList || []).reduce<Record<string, unknown>>((acc, item) => {
    const key = String(item.key || "").trim();
    if (!key) return acc;
    acc[key] = item.value ?? "";
    return acc;
  }, {});
}

function resolveCallsPerMinute(task: Pick<ServiceUsageTask, "callsPerMinuteMin" | "callsPerMinuteMax">) {
  const min = Math.max(1, Number(task.callsPerMinuteMin || 1));
  const max = Math.max(min, Number(task.callsPerMinuteMax || min));
  if (min === max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function appendHistory(item: Omit<ServiceUsageHistoryItem, "key">) {
  const current = loadServiceUsageHistory();
  const nextHistory = [
    { ...item, key: `${Date.now()}-${Math.random()}` },
    ...current,
  ].slice(0, 30);
  saveServiceUsageHistory(nextHistory);
}

export function ServiceUsageLoopRunner() {
  const timerMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    function stopTask(taskKey: string) {
      const timerId = timerMapRef.current.get(taskKey);
      if (timerId) {
        window.clearTimeout(timerId);
        timerMapRef.current.delete(taskKey);
      }
      const nextKeys = loadRunningServiceUsageTaskKeys().filter((item) => item !== taskKey);
      saveRunningServiceUsageTaskKeys(nextKeys);
    }

    function scheduleTask(task: ServiceUsageTask) {
      if (timerMapRef.current.has(task.key)) return;

      const run = async () => {
        if (!timerMapRef.current.has(task.key)) return;
        const requestParams = buildParamsObject(task.paramsList);
        const startedAt = Date.now();
        try {
          const response = await invokeRuntimeDataService({
            path: task.path,
            method: task.method,
            appToken: task.appToken,
            params: requestParams,
          });
          appendHistory({
            calledAt: new Date().toISOString(),
            taskKey: task.key,
            taskName: task.taskName,
            method: task.method,
            path: task.path,
            status: "成功",
            latencyMs: Date.now() - startedAt,
            message: response?.message || "调用成功",
            requestParams,
            responseData: response,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "调用失败";
          appendHistory({
            calledAt: new Date().toISOString(),
            taskKey: task.key,
            taskName: task.taskName,
            method: task.method,
            path: task.path,
            status: "失败",
            latencyMs: Date.now() - startedAt,
            message: errorMessage,
            requestParams,
            errorDetail: errorMessage,
          });
          message.error(errorMessage);
        } finally {
          if (!timerMapRef.current.has(task.key)) return;
          const callsPerMinute = resolveCallsPerMinute(task);
          const intervalMs = Math.max(1000, Math.floor(60000 / callsPerMinute));
          const nextTimerId = window.setTimeout(run, intervalMs);
          timerMapRef.current.set(task.key, nextTimerId);
        }
      };

      const timerId = window.setTimeout(run, 0);
      timerMapRef.current.set(task.key, timerId);
    }

    function syncRunningTasks() {
      const tasks = loadServiceUsageTasks();
      const runningKeys = loadRunningServiceUsageTaskKeys();
      const activeKeySet = new Set(runningKeys);

      timerMapRef.current.forEach((timerId, taskKey) => {
        if (!activeKeySet.has(taskKey) || !tasks.some((task) => task.key === taskKey)) {
          window.clearTimeout(timerId);
          timerMapRef.current.delete(taskKey);
        }
      });

      runningKeys.forEach((taskKey) => {
        const task = tasks.find((item) => item.key === taskKey);
        if (!task) {
          stopTask(taskKey);
          return;
        }
        scheduleTask(task);
      });
    }

    syncRunningTasks();
    const syncTimer = window.setInterval(syncRunningTasks, 1000);
    const handleStorage = () => syncRunningTasks();
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener("storage", handleStorage);
      timerMapRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timerMapRef.current.clear();
    };
  }, []);

  return null;
}
