export type WorkflowScheduleType = "manual" | "interval" | "daily" | "weekly" | "monthly" | "custom";
export type WorkflowIntervalUnit = "second" | "minute" | "hour";

export type WorkflowScheduleValues = {
  scheduleType: WorkflowScheduleType;
  intervalValue?: number;
  intervalUnit?: WorkflowIntervalUnit;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  cronExpr?: string;
};

export const workflowWeekDayOptions = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];

export const workflowIntervalUnitOptions = [
  { value: "second", label: "秒" },
  { value: "minute", label: "分钟" },
  { value: "hour", label: "小时" },
];

function toTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function parseRunTime(runTime?: string) {
  const [hourText, minuteText] = String(runTime || "").split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 2,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0,
  };
}

function buildRunTime(hour: string, minute: string) {
  return `${toTwoDigits(Number(hour))}:${toTwoDigits(Number(minute))}`;
}

export function getWorkflowIntervalMax(unit?: WorkflowIntervalUnit) {
  return unit === "hour" ? 23 : 59;
}

export function parseCronToWorkflowSchedule(cronExpr?: string | null): Partial<WorkflowScheduleValues> {
  const text = String(cronExpr || "").trim();
  if (!text) return { scheduleType: "manual" };

  const fields = text.split(/\s+/);
  if (fields.length === 6) {
    const [second, minute, hour, dayOfMonth, month, dayOfWeek] = fields;
    const secondInterval = second.match(/^\*\/(\d{1,2})$/);
    if (secondInterval && minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return { scheduleType: "interval", intervalValue: Number(secondInterval[1]), intervalUnit: "second" };
    }
    if (second !== "0") return { scheduleType: "custom", cronExpr: text };
    fields.shift();
  }

  if (fields.length !== 5) return { scheduleType: "custom", cronExpr: text };

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const minuteInterval = minute.match(/^\*\/(\d{1,2})$/);
    if (minuteInterval && hour === "*") {
      return { scheduleType: "interval", intervalValue: Number(minuteInterval[1]), intervalUnit: "minute" };
    }
    const hourInterval = hour.match(/^\*\/(\d{1,2})$/);
    if (hourInterval && minute === "0") {
      return { scheduleType: "interval", intervalValue: Number(hourInterval[1]), intervalUnit: "hour" };
    }
  }

  const minuteNumber = Number(minute);
  const hourNumber = Number(hour);
  const isMinute = Number.isInteger(minuteNumber) && minuteNumber >= 0 && minuteNumber <= 59;
  const isHour = Number.isInteger(hourNumber) && hourNumber >= 0 && hourNumber <= 23;

  if (isMinute && isHour && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return { scheduleType: "daily", runTime: buildRunTime(hour, minute) };
  }

  if (isMinute && isHour && dayOfMonth === "*" && month === "*" && /^[0-7](,[0-7])*$/.test(dayOfWeek)) {
    const weekDays = dayOfWeek
      .split(",")
      .map(Number)
      .map((item) => (item === 7 ? 0 : item))
      .filter((item, index, array) => item >= 0 && item <= 6 && array.indexOf(item) === index)
      .sort((left, right) => left - right);
    if (weekDays.length) return { scheduleType: "weekly", runTime: buildRunTime(hour, minute), weekDays };
  }

  const monthDay = Number(dayOfMonth);
  if (isMinute && isHour && Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 31 && month === "*" && dayOfWeek === "*") {
    return { scheduleType: "monthly", runTime: buildRunTime(hour, minute), monthDay };
  }

  return { scheduleType: "custom", cronExpr: text };
}

export function buildCronFromWorkflowSchedule(values: WorkflowScheduleValues) {
  switch (values.scheduleType) {
    case "manual":
      return null;
    case "interval": {
      const unit = values.intervalUnit || "minute";
      const interval = Math.min(getWorkflowIntervalMax(unit), Math.max(1, Number(values.intervalValue || 5)));
      if (unit === "second") return `*/${interval} * * * * *`;
      if (unit === "hour") return `0 */${interval} * * *`;
      return `*/${interval} * * * *`;
    }
    case "daily": {
      const { hour, minute } = parseRunTime(values.runTime);
      return `${minute} ${hour} * * *`;
    }
    case "weekly": {
      const weekDays = Array.from(new Set((values.weekDays || []).map(Number)))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
        .sort((left, right) => left - right);
      if (!weekDays.length) return null;
      const { hour, minute } = parseRunTime(values.runTime);
      return `${minute} ${hour} * * ${weekDays.join(",")}`;
    }
    case "monthly": {
      const { hour, minute } = parseRunTime(values.runTime);
      return `${minute} ${hour} ${Math.min(31, Math.max(1, Number(values.monthDay || 1)))} * *`;
    }
    case "custom":
      return String(values.cronExpr || "").trim() || null;
    default:
      return null;
  }
}

export function describeWorkflowSchedule(cronExpr?: string | null) {
  const parsed = parseCronToWorkflowSchedule(cronExpr);
  if (parsed.scheduleType === "manual") return "手动触发";
  if (parsed.scheduleType === "interval") {
    const unit = workflowIntervalUnitOptions.find((item) => item.value === parsed.intervalUnit)?.label || "分钟";
    return `每 ${parsed.intervalValue || 1} ${unit}`;
  }
  if (parsed.scheduleType === "daily") return `每天 ${parsed.runTime}`;
  if (parsed.scheduleType === "weekly") {
    const days = (parsed.weekDays || [])
      .map((day) => workflowWeekDayOptions.find((item) => item.value === day)?.label)
      .filter(Boolean)
      .join("、");
    return `${days} ${parsed.runTime}`;
  }
  if (parsed.scheduleType === "monthly") return `每月 ${parsed.monthDay} 日 ${parsed.runTime}`;
  return cronExpr || "手动触发";
}
