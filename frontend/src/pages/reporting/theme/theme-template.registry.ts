import type { ThemeTemplateRecord } from "./theme-template.types";
import { SYSTEM_THEME_FALLBACK } from "./theme-template.presets";

function normalizeThemeTemplateRecord(record: ThemeTemplateRecord | null | undefined) {
  if (!record) return record;
  return {
    ...record,
    canvas: {
      ...(record.canvas || {}),
      dashboardTitleColor: record.canvas?.dashboardTitleColor || record.chrome?.titleColor || SYSTEM_THEME_FALLBACK.canvas?.dashboardTitleColor || "#101828",
    },
  };
}

export function buildThemeTemplateRegistry(records: ThemeTemplateRecord[]) {
  const items = [SYSTEM_THEME_FALLBACK, ...(records || [])].map((item) => normalizeThemeTemplateRecord(item) as ThemeTemplateRecord);
  return new Map(items.map((item) => [Number(item.id), item]));
}

export function findThemeTemplateById(records: ThemeTemplateRecord[], id?: number | null) {
  if (!id) return null;
  return normalizeThemeTemplateRecord(records.find((item) => Number(item.id) === Number(id)) || null);
}

export function ensureThemeTemplate(records: ThemeTemplateRecord[], id?: number | null) {
  return normalizeThemeTemplateRecord(findThemeTemplateById(records, id) || SYSTEM_THEME_FALLBACK) || SYSTEM_THEME_FALLBACK;
}
