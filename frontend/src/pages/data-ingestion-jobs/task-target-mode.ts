export type TargetTableMode = "existing" | "create";

type TaskWithTargetConfig = {
  targetConfig?: {
    targetTableMode?: unknown;
    [key: string]: unknown;
  } | null;
};

export function inferTargetTableMode(task: TaskWithTargetConfig): TargetTableMode {
  return task.targetConfig?.targetTableMode === "create" ? "create" : "existing";
}
