import { SYSTEM_THEME_FALLBACK } from "./theme-template.presets";
import { ensureThemeTemplate } from "./theme-template.registry";
import type {
  DashboardThemeSettings,
  ResolvedThemeTokens,
  ThemeTemplateRecord,
  WidgetThemeState,
} from "./theme-template.types";

function mergeObject<T extends Record<string, unknown>>(base: T, extra?: Record<string, unknown> | null): T {
  if (!extra) return { ...base };
  return { ...base, ...extra } as T;
}

function normalizePalette(values: unknown, fallback: string[] = []) {
  const normalized = Array.isArray(values)
    ? values
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
    : [];
  return normalized.length ? normalized : fallback;
}

function normalizeChartFamilyKey(chartFamily?: string | null) {
  const value = String(chartFamily || "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("wordcloud") || value.includes("word cloud") || value.includes("词云")) return "wordCloud";
  if (value.includes("horizontal") || value.includes("条形") || value.includes("横向")) return "horizontalBar";
  if (value.includes("pie") || value.includes("环形") || value.includes("饼") || value.includes("玫瑰")) return "pie";
  if (value.includes("area") || value.includes("面积")) return "area";
  if (value.includes("line") || value.includes("折线")) return "line";
  if (value.includes("radar") || value.includes("雷达")) return "radar";
  if (value.includes("heat") || value.includes("热力")) return "heatmap";
  if (value.includes("map") || value.includes("地图")) return "map";
  if (value.includes("combo") || value.includes("组合")) return "combo";
  if (value.includes("scatter") || value.includes("bubble") || value.includes("散点") || value.includes("气泡")) return "scatter";
  if (value.includes("bar") || value.includes("column") || value.includes("柱") || value === "比较分析") return "bar";
  if (value.includes("treemap") || value.includes("树图")) return "treemap";
  if (value.includes("sankey") || value.includes("桑基")) return "sankey";
  if (value.includes("gauge") || value.includes("仪表")) return "gauge";
  if (value.includes("funnel") || value.includes("漏斗")) return "funnel";
  return chartFamily ? String(chartFamily) : null;
}

function getVariantKey(widgetType?: string | null, chartFamily?: string | null) {
  if (widgetType === "kpi") return "kpi";
  if (widgetType === "table") return "table";
  if (widgetType === "tabs") return "tabs";
  const normalizedFamily = normalizeChartFamilyKey(chartFamily);
  if (widgetType === "chart" && normalizedFamily) return normalizedFamily;
  return normalizedFamily || "chart";
}

function resolveTemplateVariant(template: ThemeTemplateRecord | null | undefined, variantKey: string) {
  const chartVariants = (template?.chartVariants || {}) as Record<string, Record<string, unknown>>;
  if (variantKey !== "sankey" && variantKey !== "gauge" && variantKey !== "funnel" && variantKey !== "wordCloud" && variantKey !== "combo" && variantKey !== "scatter") {
    return (chartVariants[variantKey] || {}) as Record<string, unknown>;
  }
  const sankey = (chartVariants.sankey || {}) as Record<string, unknown>;
  const gauge = (chartVariants.gauge || {}) as Record<string, unknown>;
  const funnel = (chartVariants.funnel || {}) as Record<string, unknown>;
  const wordCloud = (chartVariants.wordCloud || {}) as Record<string, unknown>;
  const combo = (chartVariants.combo || {}) as Record<string, unknown>;
  const scatter = (chartVariants.scatter || {}) as Record<string, unknown>;
  const bar = (chartVariants.bar || {}) as Record<string, unknown>;
  const line = (chartVariants.line || {}) as Record<string, unknown>;
  const horizontalBar = (chartVariants.horizontalBar || {}) as Record<string, unknown>;
  const pie = (chartVariants.pie || {}) as Record<string, unknown>;
  const chartCommon = (template?.chartCommon || {}) as Record<string, unknown>;
  const chrome = (template?.chrome || {}) as Record<string, unknown>;
  const semantic = (template?.semantic || {}) as Record<string, unknown>;
  const fallbackPalette = normalizePalette(
    horizontalBar.palette,
    normalizePalette(chartCommon.palette, [
      String(semantic.primary || "").trim(),
      String(semantic.secondary || "").trim(),
      "#f4b95d",
      "#8f7cff",
      "#f28f8f",
    ].filter(Boolean))
  );
  if (variantKey === "funnel") {
    return {
      ...funnel,
      palette: normalizePalette(funnel.palette, fallbackPalette),
      labelColor: funnel.labelColor ?? horizontalBar.axisLabelColor ?? chartCommon.labelColor ?? chrome.titleColor ?? "#344054",
      valueColor: funnel.valueColor ?? pie.valueColor ?? semantic.textPrimary ?? chrome.titleColor ?? "#101828",
      guideLineColor: funnel.guideLineColor ?? pie.guideLineColor ?? chartCommon.guideLineColor ?? chrome.borderColor ?? "#98a2b3",
      blockBorderColor: funnel.blockBorderColor ?? pie.sliceBorderColor ?? chrome.backgroundColor ?? "#ffffff",
      blockBorderWidth: funnel.blockBorderWidth ?? 1,
      itemGap: funnel.itemGap ?? 2,
      sortOrder: funnel.sortOrder ?? "descending",
    } as Record<string, unknown>;
  }
  if (variantKey === "wordCloud") {
    return {
      ...wordCloud,
      palette: normalizePalette(wordCloud.palette, fallbackPalette),
      shape: wordCloud.shape ?? "circle",
      gridSize: wordCloud.gridSize ?? 10,
      rotationStep: wordCloud.rotationStep ?? 45,
      minFontSize: wordCloud.minFontSize ?? 12,
      maxFontSize: wordCloud.maxFontSize ?? 40,
      fontWeight: wordCloud.fontWeight ?? 700,
      textShadowColor: wordCloud.textShadowColor ?? chartCommon.emphasisShadowColor ?? semantic.primary ?? "rgba(15,23,42,0.14)",
      textShadowBlur: wordCloud.textShadowBlur ?? 10,
    } as Record<string, unknown>;
  }
  if (variantKey === "scatter") {
    return {
      ...scatter,
      palette: normalizePalette(scatter.palette, normalizePalette(line.palette, fallbackPalette)),
      labelColor: scatter.labelColor ?? line.axisLabelColor ?? chartCommon.labelColor ?? chrome.titleColor ?? "#344054",
      legendColor: scatter.legendColor ?? chartCommon.legendColor ?? chrome.titleColor ?? "#344054",
      axisColor: scatter.axisColor ?? line.axisColor ?? semantic.lineStrong ?? chrome.borderColor ?? "#98a2b3",
      axisLabelColor: scatter.axisLabelColor ?? line.axisLabelColor ?? chartCommon.labelColor ?? chrome.titleColor ?? "#344054",
      splitLineColor: scatter.splitLineColor ?? line.splitLineColor ?? semantic.lineSubtle ?? chrome.borderColor ?? "#e5e7eb",
      symbolSize: scatter.symbolSize ?? 16,
      pointBorderColor: scatter.pointBorderColor ?? line.pointBorderColor ?? chrome.backgroundColor ?? "#ffffff",
      pointBorderWidth: scatter.pointBorderWidth ?? 1,
      pointOpacity: scatter.pointOpacity ?? 0.82,
      labelPosition: scatter.labelPosition ?? line.labelPosition ?? "top",
    } as Record<string, unknown>;
  }
  if (variantKey === "combo") {
    const barPalette = normalizePalette(bar.palette, fallbackPalette);
    const linePalette = normalizePalette(line.palette, fallbackPalette);
    const comboPalette = normalizePalette(combo.palette, [
      barPalette[0] || fallbackPalette[0],
      linePalette[1] || linePalette[0] || fallbackPalette[1],
      linePalette[2] || fallbackPalette[2],
      linePalette[3] || fallbackPalette[3],
    ].filter(Boolean));
    return {
      ...combo,
      palette: comboPalette,
      labelColor: combo.labelColor ?? bar.labelColor ?? chartCommon.labelColor ?? chrome.titleColor ?? "#344054",
      legendColor: combo.legendColor ?? bar.legendColor ?? chartCommon.legendColor ?? chrome.titleColor ?? "#344054",
      axisColor: combo.axisColor ?? line.axisColor ?? bar.axisColor ?? semantic.lineStrong ?? chrome.borderColor ?? "#98a2b3",
      axisLabelColor: combo.axisLabelColor ?? line.axisLabelColor ?? bar.axisLabelColor ?? chartCommon.labelColor ?? chrome.titleColor ?? "#344054",
      splitLineColor: combo.splitLineColor ?? line.splitLineColor ?? bar.splitLineColor ?? semantic.lineSubtle ?? chrome.borderColor ?? "#e5e7eb",
      barBorderRadius: combo.barBorderRadius ?? bar.barBorderRadius ?? 8,
      lineWidth: combo.lineWidth ?? line.lineWidth ?? 3,
      lineSmooth: combo.lineSmooth ?? line.lineSmooth ?? true,
      showSymbol: combo.showSymbol ?? line.showSymbol ?? true,
      symbolSize: combo.symbolSize ?? line.symbolSize ?? 6,
      labelPosition: combo.labelPosition ?? line.labelPosition ?? "top",
      pointBorderColor: combo.pointBorderColor ?? line.pointBorderColor ?? chrome.backgroundColor ?? "#ffffff",
      areaOpacity: combo.areaOpacity ?? line.areaOpacity ?? 0.18,
      maxPointColor: combo.maxPointColor ?? semantic.warning ?? semantic.danger ?? comboPalette[1] ?? "#f59e0b",
      minPointColor: combo.minPointColor ?? semantic.success ?? semantic.info ?? comboPalette[2] ?? "#12b76a",
    } as Record<string, unknown>;
  }
  if (variantKey === "gauge") {
    return {
      ...gauge,
      palette: normalizePalette(gauge.palette, fallbackPalette),
      pointerColor: gauge.pointerColor ?? semantic.primary ?? fallbackPalette[0] ?? "#1677ff",
      detailColor: gauge.detailColor ?? pie.centerValueColor ?? semantic.textPrimary ?? chrome.titleColor ?? "#101828",
      titleColor: gauge.titleColor ?? pie.centerTitleColor ?? semantic.textSecondary ?? chartCommon.legendColor ?? "#667085",
      axisLabelColor: gauge.axisLabelColor ?? horizontalBar.axisLabelColor ?? chartCommon.labelColor ?? chrome.titleColor ?? "#344054",
      splitLineColor: gauge.splitLineColor ?? horizontalBar.axisColor ?? semantic.lineStrong ?? chrome.borderColor ?? "#98a2b3",
      startAngle: gauge.startAngle ?? 210,
      endAngle: gauge.endAngle ?? -30,
      radius: gauge.radius ?? "90%",
      progressWidth: gauge.progressWidth ?? 18,
      axisLineWidth: gauge.axisLineWidth ?? gauge.progressWidth ?? 18,
      pointerLength: gauge.pointerLength ?? "58%",
      detailFontSize: gauge.detailFontSize ?? 24,
      detailFontWeight: gauge.detailFontWeight ?? 700,
      titleFontSize: gauge.titleFontSize ?? 14,
    } as Record<string, unknown>;
  }
  return {
    ...sankey,
    palette: normalizePalette(sankey.palette, fallbackPalette),
    labelColor: sankey.labelColor ?? horizontalBar.axisLabelColor ?? horizontalBar.labelColor ?? chartCommon.labelColor ?? chrome.titleColor ?? "#344054",
    nodeBorderColor: sankey.nodeBorderColor ?? pie.sliceBorderColor ?? chrome.backgroundColor ?? "#ffffff",
    nodeBorderWidth: sankey.nodeBorderWidth ?? 1,
    nodeBorderRadius: sankey.nodeBorderRadius ?? horizontalBar.barBorderRadius ?? 4,
    linkOpacity: sankey.linkOpacity ?? 0.28,
    linkCurveness: sankey.linkCurveness ?? 0.5,
  } as Record<string, unknown>;
}

export function buildDefaultDashboardThemeSettings(input?: Partial<DashboardThemeSettings> | null): DashboardThemeSettings {
  return {
    defaultInheritTheme: input?.defaultInheritTheme !== false,
    inheritCanvasBackground: input?.inheritCanvasBackground !== false,
    allowWidgetThemeOverride: input?.allowWidgetThemeOverride !== false,
  };
}

export function resolveThemeTemplate(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId?: number | null,
  widgetTheme?: WidgetThemeState | null,
  widgetType?: string | null,
  chartFamily?: string | null
): ResolvedThemeTokens {
  const dashboardTemplate = ensureThemeTemplate(themeTemplates, dashboardThemeTemplateId);
  const widgetTemplateId = widgetTheme?.inheritDashboardTheme === false
    ? (widgetTheme?.widgetThemeTemplateId || null)
    : (widgetTheme?.widgetThemeTemplateId || dashboardThemeTemplateId || null);
  const widgetTemplate = widgetTemplateId ? ensureThemeTemplate(themeTemplates, widgetTemplateId) : dashboardTemplate || SYSTEM_THEME_FALLBACK;
  const variantKey = getVariantKey(widgetType, chartFamily);
  const baseTemplate = widgetTheme?.inheritDashboardTheme === false ? widgetTemplate : dashboardTemplate;
  const activeTemplate = widgetTheme?.inheritDashboardTheme === false ? widgetTemplate : (widgetTemplateId && widgetTheme?.widgetThemeTemplateId ? widgetTemplate : dashboardTemplate);
  const overrides = widgetTheme?.widgetThemeOverrides || {};
  const overrideChrome = (overrides.chrome || {}) as Record<string, unknown>;
  const overrideCanvas = (overrides.canvas || {}) as Record<string, unknown>;
  const overrideSemantic = (overrides.semantic || {}) as Record<string, unknown>;
  const overrideChartCommon = (overrides.chartCommon || {}) as Record<string, unknown>;
  const overrideVariant = ((overrides.chartVariants || {}) as Record<string, Record<string, unknown>>)[variantKey] || {};

  return {
    templateId: activeTemplate?.id || baseTemplate?.id || SYSTEM_THEME_FALLBACK.id,
    templateName: activeTemplate?.themeName || baseTemplate?.themeName || SYSTEM_THEME_FALLBACK.themeName,
    canvas: mergeObject(
      mergeObject(SYSTEM_THEME_FALLBACK.canvas || {}, baseTemplate?.canvas as Record<string, unknown>),
      overrideCanvas
    ),
    chrome: mergeObject(
      mergeObject(SYSTEM_THEME_FALLBACK.chrome || {}, activeTemplate?.chrome as Record<string, unknown>),
      overrideChrome
    ),
    semantic: mergeObject(
      mergeObject(SYSTEM_THEME_FALLBACK.semantic || {}, activeTemplate?.semantic as Record<string, unknown>),
      overrideSemantic
    ),
    chartCommon: mergeObject(
      mergeObject(SYSTEM_THEME_FALLBACK.chartCommon || {}, activeTemplate?.chartCommon as Record<string, unknown>),
      overrideChartCommon
    ),
    chartVariant: mergeObject(
      mergeObject(
        resolveTemplateVariant(SYSTEM_THEME_FALLBACK, variantKey),
        resolveTemplateVariant(activeTemplate, variantKey)
      ),
      overrideVariant
    ),
  };
}
