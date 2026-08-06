type AnyRecord = Record<string, any>;

const PAYLOAD_KEYS = [
  "left",
  "top",
  "right",
  "bottom",
  "gridSize",
  "sizeRange",
  "rotationRange",
  "rotationStep",
  "maskImage",
  "keepAspect",
  "shape",
  "shrinkToFit",
  "drawOutOfBound",
] as const;

function normalizeWordCloudData(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    if (Array.isArray(item)) return item;
    if (!item || typeof item !== "object") return item;
    const record = item as AnyRecord;
    if (Array.isArray(record.value)) return record;
    const { name, value, textStyle, ...rest } = record;
    return {
      ...rest,
      value: [name ?? "", value ?? 0],
      ...(textStyle && typeof textStyle === "object" ? { itemStyle: { ...(rest.itemStyle || {}), ...textStyle } } : {}),
    };
  });
}

function normalizeSeries(series: unknown) {
  if (!series || typeof series !== "object") return series;
  const record = series as AnyRecord;
  if (record.type !== "wordCloud") return record;
  const itemPayload: AnyRecord = {};
  const next: AnyRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (key === "type" || key === "data") return;
    if ((PAYLOAD_KEYS as readonly string[]).includes(key)) itemPayload[key] = value;
    else next[key] = value;
  });
  return {
    ...next,
    type: "custom",
    renderItem: "wordCloud",
    itemPayload,
    data: normalizeWordCloudData(record.data),
  };
}

export function normalizeWordCloudOption(option: AnyRecord): AnyRecord {
  if (!option || typeof option !== "object" || !Array.isArray(option.series)) return option;
  return {
    ...option,
    series: option.series.map(normalizeSeries),
  };
}
