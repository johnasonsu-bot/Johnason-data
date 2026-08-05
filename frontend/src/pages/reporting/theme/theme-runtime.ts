import { resolveThemeTemplate } from "./theme-template.resolver";
import type { ThemeTemplateRecord } from "./theme-template.types";

type WidgetThemeInput = {
  widgetType?: string | null;
  chartFamily?: string | null;
  inheritDashboardTheme?: boolean;
  widgetThemeTemplateId?: number | null;
  widgetThemeOverrides?: Record<string, unknown> | null;
  chrome?: Record<string, unknown> | null;
  chartStyle?: Record<string, unknown> | null;
};

export function resolveWidgetVisualTheme(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: WidgetThemeInput
) {
  return resolveThemeTemplate(
    themeTemplates,
    dashboardThemeTemplateId,
    {
      inheritDashboardTheme: widget.inheritDashboardTheme !== false,
      widgetThemeTemplateId: widget.widgetThemeTemplateId || null,
      widgetThemeOverrides: widget.widgetThemeOverrides || {},
    },
    widget.widgetType,
    widget.chartFamily
  );
}

type ThemedWidgetShape = WidgetThemeInput & {
  accentColor?: string | null;
  chrome?: Record<string, unknown> | null;
  chartStyle?: Record<string, unknown> | null;
  kpiStyle?: Record<string, unknown> | null;
  tableStyle?: Record<string, unknown> | null;
  tabsStyle?: Record<string, unknown> | null;
};

const DEFAULT_COMBO_PALETTE = ["#4e7cff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"];
const DEFAULT_SCATTER_PALETTE = ["#4e7cff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"];

function normalizeThemeChartFamily(chartFamily?: string | null) {
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

function pickThemeValue<T>(themeValue: T | null | undefined, currentValue: T | null | undefined, fallback?: T) {
  return themeValue ?? currentValue ?? fallback;
}

function deriveKpiFlipperBackground(
  variant: Record<string, unknown>,
  resolvedTheme: ReturnType<typeof resolveThemeTemplate>,
  kpiStyle: Record<string, unknown>,
  followsDashboardTheme: boolean,
) {
  if (typeof variant.flipperBackground === "string" && variant.flipperBackground.trim()) {
    return variant.flipperBackground;
  }
  if (!followsDashboardTheme && typeof kpiStyle.flipperBackground === "string" && kpiStyle.flipperBackground.trim()) {
    return kpiStyle.flipperBackground;
  }
  const primary = String(variant.valueColor || resolvedTheme.semantic.primary || "#1677ff");
  const itemBackground = String(variant.itemBackgroundColor || resolvedTheme.chrome.backgroundColor || "#ffffff");
  return `linear-gradient(180deg, ${primary} 0%, ${itemBackground} 100%)`;
}

function normalizeHorizontalBarColorCount(value: unknown): 1 | 3 | 5 | null {
  const numeric = Number(value);
  if (numeric === 1 || numeric === 3 || numeric === 5) return numeric;
  return null;
}

export function applyResolvedThemeToWidget<T extends ThemedWidgetShape>(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: T
): T {
  const resolvedTheme = resolveWidgetVisualTheme(themeTemplates, dashboardThemeTemplateId, widget);
  const inheritsDashboardTheme = widget.inheritDashboardTheme !== false;
  const nextWidgetThemeTemplateId = inheritsDashboardTheme ? null : widget.widgetThemeTemplateId || null;
  const chrome = widget.chrome || {};
  const chartStyle = widget.chartStyle || {};
  const kpiStyle = widget.kpiStyle || {};
  const tabsStyle = widget.tabsStyle || {};
  const variant = resolvedTheme.chartVariant || {};
  const common = resolvedTheme.chartCommon || {};
  const normalizedChartFamily = normalizeThemeChartFamily(widget.chartFamily);
  const isBarFamily = normalizedChartFamily === "bar";
  const isHorizontalBarFamily = normalizedChartFamily === "horizontalBar";
  const isComboFamily = normalizedChartFamily === "combo";
  const isScatterFamily = normalizedChartFamily === "scatter";
  const isSankeyFamily = normalizedChartFamily === "sankey";
  const isGaugeFamily = normalizedChartFamily === "gauge";
  const isFunnelFamily = normalizedChartFamily === "funnel";
  const variantPalette = Array.isArray(variant.palette) ? variant.palette as string[] : undefined;
  const mapVariantPalette = Array.isArray((variant as Record<string, unknown>).regionPalette)
    ? ((variant as Record<string, unknown>).regionPalette as string[])
    : undefined;
  const commonPalette = Array.isArray(common.palette) ? common.palette as string[] : undefined;
  const resolvedPalette = variantPalette?.length ? variantPalette : commonPalette;
  const currentAccentColor = (chartStyle as Record<string, unknown>).accentColor || widget.accentColor;
  const resolvedAccentColor = String(variantPalette?.[0] || resolvedTheme.semantic.primary || currentAccentColor || "#1677ff");

  return {
    ...widget,
    inheritDashboardTheme: inheritsDashboardTheme,
    widgetThemeTemplateId: nextWidgetThemeTemplateId,
    accentColor: resolvedAccentColor,
    chrome: {
      ...chrome,
      backgroundType: pickThemeValue(resolvedTheme.chrome.backgroundType, chrome.backgroundType, "solid"),
      backgroundColor: pickThemeValue(resolvedTheme.chrome.backgroundColor, chrome.backgroundColor, "#ffffff"),
      backgroundGradient: pickThemeValue(resolvedTheme.chrome.backgroundGradient, chrome.backgroundGradient, null),
      backgroundImage: pickThemeValue(resolvedTheme.chrome.backgroundImage, chrome.backgroundImage, null),
      borderColor: pickThemeValue(resolvedTheme.chrome.borderColor, chrome.borderColor, "#eef2f7"),
      borderWidth: pickThemeValue(resolvedTheme.chrome.borderWidth, chrome.borderWidth, 1),
      borderRadius: pickThemeValue(resolvedTheme.chrome.borderRadius, chrome.borderRadius, 16),
      shadowPreset: pickThemeValue(resolvedTheme.chrome.shadowPreset, chrome.shadowPreset, "none"),
      titleColor: pickThemeValue(resolvedTheme.chrome.titleColor, chrome.titleColor, "#101828"),
    },
    chartStyle: {
      ...chartStyle,
      palette: resolvedPalette ?? (chartStyle as Record<string, unknown>).palette,
      accentColor: resolvedAccentColor,
      dataLabelColor: (((isBarFamily || isHorizontalBarFamily || isComboFamily || isScatterFamily || isSankeyFamily || isFunnelFamily) ? variant.labelColor : common.labelColor) ?? chartStyle.dataLabelColor ?? "#ffffff"),
      legendTextColor: (variant.legendColor ?? common.legendColor) ?? (chartStyle as Record<string, unknown>).legendTextColor ?? "#344054",
      axisColor: variant.axisColor ?? (chartStyle as Record<string, unknown>).axisColor ?? "#98a2b3",
      axisLabelColor: variant.axisLabelColor ?? (chartStyle as Record<string, unknown>).axisLabelColor ?? "#344054",
      splitLineColor: variant.splitLineColor ?? (chartStyle as Record<string, unknown>).splitLineColor ?? "#e5e7eb",
      lineWidth: variant.lineWidth ?? (chartStyle as Record<string, unknown>).lineWidth,
      lineSmooth: variant.lineSmooth ?? (chartStyle as Record<string, unknown>).lineSmooth,
      lineShowSymbol: variant.showSymbol ?? (chartStyle as Record<string, unknown>).lineShowSymbol,
      lineSymbolSize: variant.symbolSize ?? (chartStyle as Record<string, unknown>).lineSymbolSize,
      lineLabelPosition: variant.labelPosition ?? (chartStyle as Record<string, unknown>).lineLabelPosition,
      areaOpacity: variant.areaOpacity ?? (chartStyle as Record<string, unknown>).areaOpacity,
      lineAreaOpacity: variant.areaOpacity ?? (chartStyle as Record<string, unknown>).lineAreaOpacity,
      pointBorderColor: variant.pointBorderColor ?? (chartStyle as Record<string, unknown>).pointBorderColor,
      scatterSymbolSize: variant.symbolSize ?? (chartStyle as Record<string, unknown>).scatterSymbolSize ?? 16,
      scatterPointBorderColor: variant.pointBorderColor ?? (chartStyle as Record<string, unknown>).scatterPointBorderColor ?? "#ffffff",
      scatterPointBorderWidth: (variant as Record<string, unknown>).pointBorderWidth ?? (chartStyle as Record<string, unknown>).scatterPointBorderWidth ?? 1,
      scatterPointOpacity: (variant as Record<string, unknown>).pointOpacity ?? (chartStyle as Record<string, unknown>).scatterPointOpacity ?? 0.82,
      scatterLabelPosition: variant.labelPosition ?? (chartStyle as Record<string, unknown>).scatterLabelPosition ?? "top",
      barPrimaryColor: variantPalette?.[0] ?? commonPalette?.[0] ?? resolvedTheme.semantic.primary ?? (chartStyle as Record<string, unknown>).barPrimaryColor ?? "#1677ff",
      barSecondaryColor: variantPalette?.[1] ?? commonPalette?.[1] ?? resolvedTheme.semantic.secondary ?? (chartStyle as Record<string, unknown>).barSecondaryColor ?? "#55c6a9",
      horizontalBarPalette: (variantPalette?.length ? variantPalette : ((chartStyle as Record<string, unknown>).horizontalBarPalette as string[] | undefined)) ?? undefined,
      horizontalBarColorCount: normalizeHorizontalBarColorCount(variant.colorCount) ?? normalizeHorizontalBarColorCount((chartStyle as Record<string, unknown>).horizontalBarColorCount),
      barBorderRadius: variant.barBorderRadius ?? (chartStyle as Record<string, unknown>).barBorderRadius ?? 8,
      sankeyNodeBorderColor: variant.nodeBorderColor ?? (chartStyle as Record<string, unknown>).sankeyNodeBorderColor ?? "#ffffff",
      sankeyNodeBorderWidth: variant.nodeBorderWidth ?? (chartStyle as Record<string, unknown>).sankeyNodeBorderWidth ?? 1,
      sankeyNodeBorderRadius: variant.nodeBorderRadius ?? (chartStyle as Record<string, unknown>).sankeyNodeBorderRadius ?? 4,
      sankeyLinkOpacity: variant.linkOpacity ?? (chartStyle as Record<string, unknown>).sankeyLinkOpacity ?? 0.28,
      sankeyLinkCurveness: variant.linkCurveness ?? (chartStyle as Record<string, unknown>).sankeyLinkCurveness ?? 0.5,
      gaugePointerColor: variant.pointerColor ?? (chartStyle as Record<string, unknown>).gaugePointerColor ?? resolvedAccentColor,
      gaugeDetailColor: variant.detailColor ?? (chartStyle as Record<string, unknown>).gaugeDetailColor ?? "#101828",
      gaugeTitleColor: variant.titleColor ?? (chartStyle as Record<string, unknown>).gaugeTitleColor ?? "#667085",
      gaugeAxisLabelColor: variant.axisLabelColor ?? (chartStyle as Record<string, unknown>).gaugeAxisLabelColor ?? "#344054",
      gaugeSplitLineColor: variant.splitLineColor ?? (chartStyle as Record<string, unknown>).gaugeSplitLineColor ?? "#98a2b3",
      gaugeStartAngle: variant.startAngle ?? (chartStyle as Record<string, unknown>).gaugeStartAngle ?? 210,
      gaugeEndAngle: variant.endAngle ?? (chartStyle as Record<string, unknown>).gaugeEndAngle ?? -30,
      gaugeRadius: variant.radius ?? (chartStyle as Record<string, unknown>).gaugeRadius ?? "90%",
      gaugeProgressWidth: variant.progressWidth ?? (chartStyle as Record<string, unknown>).gaugeProgressWidth ?? 18,
      gaugeAxisLineWidth: variant.axisLineWidth ?? (chartStyle as Record<string, unknown>).gaugeAxisLineWidth ?? 18,
      gaugePointerLength: variant.pointerLength ?? (chartStyle as Record<string, unknown>).gaugePointerLength ?? "58%",
      gaugeDetailFontSize: variant.detailFontSize ?? (chartStyle as Record<string, unknown>).gaugeDetailFontSize ?? 24,
      gaugeDetailFontWeight: variant.detailFontWeight ?? (chartStyle as Record<string, unknown>).gaugeDetailFontWeight ?? 700,
      gaugeTitleFontSize: variant.titleFontSize ?? (chartStyle as Record<string, unknown>).gaugeTitleFontSize ?? 14,
      funnelValueColor: variant.valueColor ?? (chartStyle as Record<string, unknown>).funnelValueColor ?? "#101828",
      funnelLabelLineColor: (variant.guideLineColor ?? common.guideLineColor) ?? (chartStyle as Record<string, unknown>).funnelLabelLineColor ?? "#98a2b3",
      funnelBlockBorderColor: variant.blockBorderColor ?? (chartStyle as Record<string, unknown>).funnelBlockBorderColor ?? "#ffffff",
      funnelBlockBorderWidth: variant.blockBorderWidth ?? (chartStyle as Record<string, unknown>).funnelBlockBorderWidth ?? 1,
      funnelItemGap: variant.itemGap ?? (chartStyle as Record<string, unknown>).funnelItemGap ?? 2,
      funnelSortOrder: variant.sortOrder ?? (chartStyle as Record<string, unknown>).funnelSortOrder ?? "descending",
      wordCloudShape: (variant.shape ?? (chartStyle as Record<string, unknown>).wordCloudShape ?? "circle") as string,
      wordCloudGridSize: variant.gridSize ?? (chartStyle as Record<string, unknown>).wordCloudGridSize ?? 10,
      wordCloudRotationStep: variant.rotationStep ?? (chartStyle as Record<string, unknown>).wordCloudRotationStep ?? 45,
      wordCloudMinFontSize: variant.minFontSize ?? (chartStyle as Record<string, unknown>).wordCloudMinFontSize ?? 12,
      wordCloudMaxFontSize: variant.maxFontSize ?? (chartStyle as Record<string, unknown>).wordCloudMaxFontSize ?? 40,
      wordCloudFontWeight: variant.fontWeight ?? (chartStyle as Record<string, unknown>).wordCloudFontWeight ?? 700,
      wordCloudTextShadowColor: variant.textShadowColor ?? (chartStyle as Record<string, unknown>).wordCloudTextShadowColor ?? common.emphasisShadowColor ?? "rgba(15,23,42,0.14)",
      wordCloudTextShadowBlur: variant.textShadowBlur ?? (chartStyle as Record<string, unknown>).wordCloudTextShadowBlur ?? 10,
      radarGridLineColor: variant.gridLineColor ?? (chartStyle as Record<string, unknown>).radarGridLineColor,
      radarIndicatorTextColor: variant.indicatorTextColor ?? (chartStyle as Record<string, unknown>).radarIndicatorTextColor,
      radarPointColor: variant.pointColor ?? (chartStyle as Record<string, unknown>).radarPointColor,
      radarPrimaryColor: variant.primaryColor ?? variantPalette?.[0] ?? (chartStyle as Record<string, unknown>).radarPrimaryColor,
      radarSecondaryColor: variant.secondaryColor ?? variantPalette?.[1] ?? (chartStyle as Record<string, unknown>).radarSecondaryColor,
      mapRegionPalette: (mapVariantPalette?.length ? mapVariantPalette : commonPalette) ?? (chartStyle as Record<string, unknown>).mapRegionPalette,
      mapRegionBorderColor: variant.regionBorderColor ?? (chartStyle as Record<string, unknown>).mapRegionBorderColor,
      mapLabelColor: variant.labelColor ?? (chartStyle as Record<string, unknown>).mapLabelColor,
      mapVisualMapTextColor: variant.visualMapTextColor ?? (chartStyle as Record<string, unknown>).mapVisualMapTextColor,
      extremaMaxColor: (variant as Record<string, unknown>).maxPointColor ?? (chartStyle as Record<string, unknown>).extremaMaxColor ?? "#f59e0b",
      extremaMinColor: (variant as Record<string, unknown>).minPointColor ?? (chartStyle as Record<string, unknown>).extremaMinColor ?? "#12b76a",
      pieCenterTitleColor: variant.centerTitleColor ?? chartStyle.pieCenterTitleColor ?? "#667085",
      pieCenterValueColor: variant.centerValueColor ?? chartStyle.pieCenterValueColor ?? "#101828",
      pieCenterUnitColor: variant.centerUnitColor ?? chartStyle.pieCenterUnitColor ?? "#101828",
      pieCenterMetaColor: variant.centerMetaColor ?? chartStyle.pieCenterMetaColor ?? "#98a2b3",
      pieLabelColor: (variant.labelColor ?? common.labelColor) ?? chartStyle.pieLabelColor ?? "#344054",
      pieValueColor: (variant.valueColor ?? common.labelColor) ?? chartStyle.pieValueColor ?? "#101828",
      pieLabelLineColor: (variant.guideLineColor ?? common.guideLineColor) ?? chartStyle.pieLabelLineColor ?? "#98a2b3",
      pieBorderColor: variant.sliceBorderColor ?? chartStyle.pieBorderColor ?? "#ffffff",
      pieShadowColor: (variant.shadowColor ?? common.emphasisShadowColor) ?? chartStyle.pieShadowColor ?? "rgba(15,23,42,0.14)",
      pieInnerRadius: variant.defaultInnerRadius ?? chartStyle.pieInnerRadius,
      pieOuterRadius: variant.defaultOuterRadius ?? chartStyle.pieOuterRadius,
      pieLabelMode: variant.defaultLabelMode ?? chartStyle.pieLabelMode,
      ...(isGaugeFamily ? {
        dataLabelColor: (chartStyle as Record<string, unknown>).gaugeAxisLabelColor ?? variant.axisLabelColor ?? common.labelColor ?? "#344054",
      } : {}),
    },
    kpiStyle: {
      ...kpiStyle,
      valueColor: variant.valueColor ?? kpiStyle.valueColor,
      valuePrefixColor: (variant.valueColor ?? kpiStyle.valueColor) ?? kpiStyle.valuePrefixColor,
      valueSuffixColor: (variant.valueColor ?? kpiStyle.valueColor) ?? kpiStyle.valueSuffixColor,
      metricLabelColor: variant.labelColor ?? kpiStyle.metricLabelColor,
      compareLabelColor: variant.compareColor ?? kpiStyle.compareLabelColor,
      dividerColor: variant.dividerColor ?? kpiStyle.dividerColor,
      itemBackgroundColor: variant.itemBackgroundColor ?? kpiStyle.itemBackgroundColor,
      itemBorderColor: resolvedTheme.chrome.borderColor ?? kpiStyle.itemBorderColor,
      flipperBackgroundType: variant.flipperBackgroundType ?? kpiStyle.flipperBackgroundType,
      flipperBackgroundColor: variant.flipperBackgroundColor ?? kpiStyle.flipperBackgroundColor,
      flipperBackgroundGradient: variant.flipperBackgroundGradient ?? kpiStyle.flipperBackgroundGradient,
      flipperBackgroundImage: variant.flipperBackgroundImage ?? kpiStyle.flipperBackgroundImage,
      flipperBackground: variant.flipperBackground ?? deriveKpiFlipperBackground(variant, resolvedTheme, kpiStyle, inheritsDashboardTheme),
      progressTrackColor: variant.progressTrackColor ?? kpiStyle.progressTrackColor,
      progressFillColor: variant.progressFillColor ?? kpiStyle.progressFillColor ?? variant.valueColor,
    },
    tableStyle: {
      ...(widget.tableStyle || {}),
      headerBackground: variant.headerBackground ?? (widget.tableStyle as Record<string, unknown> | undefined)?.headerBackground,
      headerTextColor: variant.headerTextColor ?? (widget.tableStyle as Record<string, unknown> | undefined)?.headerTextColor,
      rowBackground: variant.rowBackground ?? (widget.tableStyle as Record<string, unknown> | undefined)?.rowBackground,
      rowAlternateBackground: variant.rowAlternateBackground ?? (widget.tableStyle as Record<string, unknown> | undefined)?.rowAlternateBackground,
      rowBorderColor: variant.rowBorderColor ?? (widget.tableStyle as Record<string, unknown> | undefined)?.rowBorderColor,
    },
    tabsStyle: {
      ...tabsStyle,
      tabBarBackgroundColor: variant.tabBarBackground ?? tabsStyle.tabBarBackgroundColor,
      activeTextColor: variant.activeTextColor ?? tabsStyle.activeTextColor,
      inactiveTextColor: variant.inactiveTextColor ?? tabsStyle.inactiveTextColor,
      activeBackground: variant.activeBackground ?? tabsStyle.activeBackground,
      indicatorColor: variant.indicatorColor ?? tabsStyle.indicatorColor,
    },
  };
}

function hasConfiguredThemeColor(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasConfiguredThemeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasConfiguredThemePalette(value: unknown) {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length > 0);
}

function matchesThemePalette(value: unknown, expected: string[]) {
  if (!Array.isArray(value)) return false;
  const actual = value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(Boolean);
  const target = expected.map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!actual.length || actual.length !== target.length) return false;
  return actual.every((item, index) => item === target[index]);
}

function hasConfiguredThemeNumber(value: unknown) {
  return Number.isFinite(Number(value));
}

export function backfillMissingMapThemeFields<T extends ThemedWidgetShape>(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: T,
  sourceChartStyle?: Record<string, unknown> | null,
): T {
  if (widget.widgetType !== "chart") {
    return widget;
  }
  if (normalizeThemeChartFamily(widget.chartFamily) !== "map") {
    return widget;
  }
  const source = sourceChartStyle && typeof sourceChartStyle === "object" ? sourceChartStyle : {};
  const needsPalette = !hasConfiguredThemePalette((source as Record<string, unknown>).mapRegionPalette);
  const needsBorderColor = !hasConfiguredThemeColor((source as Record<string, unknown>).mapRegionBorderColor);
  const needsLabelColor = !hasConfiguredThemeColor((source as Record<string, unknown>).mapLabelColor);
  const needsVisualMapTextColor = !hasConfiguredThemeColor((source as Record<string, unknown>).mapVisualMapTextColor);
  if (!needsPalette && !needsBorderColor && !needsLabelColor && !needsVisualMapTextColor) {
    return widget;
  }
  const themedWidget = applyResolvedThemeToWidget(themeTemplates, dashboardThemeTemplateId, widget);
  const themedChartStyle = (themedWidget.chartStyle || {}) as Record<string, unknown>;
  return {
    ...widget,
    chartStyle: {
      ...(widget.chartStyle || {}),
      ...(needsPalette ? { mapRegionPalette: themedChartStyle.mapRegionPalette } : {}),
      ...(needsBorderColor ? { mapRegionBorderColor: themedChartStyle.mapRegionBorderColor } : {}),
      ...(needsLabelColor ? { mapLabelColor: themedChartStyle.mapLabelColor } : {}),
      ...(needsVisualMapTextColor ? { mapVisualMapTextColor: themedChartStyle.mapVisualMapTextColor } : {}),
    },
  };
}

export function backfillMissingFunnelThemeFields<T extends ThemedWidgetShape>(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: T,
  sourceChartStyle?: Record<string, unknown> | null,
): T {
  if (widget.widgetType !== "chart") {
    return widget;
  }
  if (normalizeThemeChartFamily(widget.chartFamily) !== "funnel") {
    return widget;
  }
  const source = sourceChartStyle && typeof sourceChartStyle === "object" ? sourceChartStyle : {};
  const needsPalette = !hasConfiguredThemePalette((source as Record<string, unknown>).palette);
  const needsLabelColor = !hasConfiguredThemeColor((source as Record<string, unknown>).dataLabelColor);
  const needsValueColor = !hasConfiguredThemeColor((source as Record<string, unknown>).funnelValueColor);
  const needsGuideLineColor = !hasConfiguredThemeColor((source as Record<string, unknown>).funnelLabelLineColor);
  const needsBorderColor = !hasConfiguredThemeColor((source as Record<string, unknown>).funnelBlockBorderColor);
  const needsBorderWidth = !hasConfiguredThemeNumber((source as Record<string, unknown>).funnelBlockBorderWidth);
  const needsItemGap = !hasConfiguredThemeNumber((source as Record<string, unknown>).funnelItemGap);
  const needsSortOrder = !hasConfiguredThemeColor((source as Record<string, unknown>).funnelSortOrder);
  if (!needsPalette && !needsLabelColor && !needsValueColor && !needsGuideLineColor && !needsBorderColor && !needsBorderWidth && !needsItemGap && !needsSortOrder) {
    return widget;
  }
  const themedWidget = applyResolvedThemeToWidget(themeTemplates, dashboardThemeTemplateId, widget);
  const themedChartStyle = (themedWidget.chartStyle || {}) as Record<string, unknown>;
  return {
    ...widget,
    chartStyle: {
      ...(widget.chartStyle || {}),
      ...(needsPalette ? { palette: themedChartStyle.palette } : {}),
      ...(needsLabelColor ? { dataLabelColor: themedChartStyle.dataLabelColor } : {}),
      ...(needsValueColor ? { funnelValueColor: themedChartStyle.funnelValueColor } : {}),
      ...(needsGuideLineColor ? { funnelLabelLineColor: themedChartStyle.funnelLabelLineColor } : {}),
      ...(needsBorderColor ? { funnelBlockBorderColor: themedChartStyle.funnelBlockBorderColor } : {}),
      ...(needsBorderWidth ? { funnelBlockBorderWidth: themedChartStyle.funnelBlockBorderWidth } : {}),
      ...(needsItemGap ? { funnelItemGap: themedChartStyle.funnelItemGap } : {}),
      ...(needsSortOrder ? { funnelSortOrder: themedChartStyle.funnelSortOrder } : {}),
    },
  };
}

export function backfillMissingGaugeThemeFields<T extends ThemedWidgetShape>(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: T,
  sourceChartStyle?: Record<string, unknown> | null,
): T {
  if (widget.widgetType !== "chart") {
    return widget;
  }
  if (normalizeThemeChartFamily(widget.chartFamily) !== "gauge") {
    return widget;
  }
  const source = sourceChartStyle && typeof sourceChartStyle === "object" ? sourceChartStyle : {};
  const needsPalette = !hasConfiguredThemePalette((source as Record<string, unknown>).palette);
  const needsPointerColor = !hasConfiguredThemeColor((source as Record<string, unknown>).gaugePointerColor);
  const needsDetailColor = !hasConfiguredThemeColor((source as Record<string, unknown>).gaugeDetailColor);
  const needsTitleColor = !hasConfiguredThemeColor((source as Record<string, unknown>).gaugeTitleColor);
  const needsAxisLabelColor = !hasConfiguredThemeColor((source as Record<string, unknown>).gaugeAxisLabelColor);
  const needsSplitLineColor = !hasConfiguredThemeColor((source as Record<string, unknown>).gaugeSplitLineColor);
  const needsStartAngle = !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeStartAngle);
  const needsEndAngle = !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeEndAngle);
  const needsRadius = !hasConfiguredThemeText((source as Record<string, unknown>).gaugeRadius) && !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeRadius);
  const needsProgressWidth = !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeProgressWidth);
  const needsAxisLineWidth = !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeAxisLineWidth);
  const needsPointerLength = !hasConfiguredThemeText((source as Record<string, unknown>).gaugePointerLength) && !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugePointerLength);
  const needsDetailFontSize = !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeDetailFontSize);
  const needsDetailFontWeight = !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeDetailFontWeight);
  const needsTitleFontSize = !hasConfiguredThemeNumber((source as Record<string, unknown>).gaugeTitleFontSize);
  if (
    !needsPalette
    && !needsPointerColor
    && !needsDetailColor
    && !needsTitleColor
    && !needsAxisLabelColor
    && !needsSplitLineColor
    && !needsStartAngle
    && !needsEndAngle
    && !needsRadius
    && !needsProgressWidth
    && !needsAxisLineWidth
    && !needsPointerLength
    && !needsDetailFontSize
    && !needsDetailFontWeight
    && !needsTitleFontSize
  ) {
    return widget;
  }
  const themedWidget = applyResolvedThemeToWidget(themeTemplates, dashboardThemeTemplateId, widget);
  const themedChartStyle = (themedWidget.chartStyle || {}) as Record<string, unknown>;
  return {
    ...widget,
    chartStyle: {
      ...(widget.chartStyle || {}),
      ...(needsPalette ? { palette: themedChartStyle.palette } : {}),
      ...(needsPointerColor ? { gaugePointerColor: themedChartStyle.gaugePointerColor } : {}),
      ...(needsDetailColor ? { gaugeDetailColor: themedChartStyle.gaugeDetailColor } : {}),
      ...(needsTitleColor ? { gaugeTitleColor: themedChartStyle.gaugeTitleColor } : {}),
      ...(needsAxisLabelColor ? { gaugeAxisLabelColor: themedChartStyle.gaugeAxisLabelColor } : {}),
      ...(needsSplitLineColor ? { gaugeSplitLineColor: themedChartStyle.gaugeSplitLineColor } : {}),
      ...(needsStartAngle ? { gaugeStartAngle: themedChartStyle.gaugeStartAngle } : {}),
      ...(needsEndAngle ? { gaugeEndAngle: themedChartStyle.gaugeEndAngle } : {}),
      ...(needsRadius ? { gaugeRadius: themedChartStyle.gaugeRadius } : {}),
      ...(needsProgressWidth ? { gaugeProgressWidth: themedChartStyle.gaugeProgressWidth } : {}),
      ...(needsAxisLineWidth ? { gaugeAxisLineWidth: themedChartStyle.gaugeAxisLineWidth } : {}),
      ...(needsPointerLength ? { gaugePointerLength: themedChartStyle.gaugePointerLength } : {}),
      ...(needsDetailFontSize ? { gaugeDetailFontSize: themedChartStyle.gaugeDetailFontSize } : {}),
      ...(needsDetailFontWeight ? { gaugeDetailFontWeight: themedChartStyle.gaugeDetailFontWeight } : {}),
      ...(needsTitleFontSize ? { gaugeTitleFontSize: themedChartStyle.gaugeTitleFontSize } : {}),
    },
  };
}

export function backfillMissingComboThemeFields<T extends ThemedWidgetShape>(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: T,
  sourceChartStyle?: Record<string, unknown> | null,
): T {
  if (widget.widgetType !== "chart") {
    return widget;
  }
  if (normalizeThemeChartFamily(widget.chartFamily) !== "combo") {
    return widget;
  }
  const source = sourceChartStyle && typeof sourceChartStyle === "object" ? sourceChartStyle : {};
  const needsPalette = !hasConfiguredThemePalette((source as Record<string, unknown>).palette)
    || matchesThemePalette((source as Record<string, unknown>).palette, DEFAULT_COMBO_PALETTE);
  const needsLabelColor = !hasConfiguredThemeColor((source as Record<string, unknown>).dataLabelColor)
    || String((source as Record<string, unknown>).dataLabelColor || "").trim() === "#24476b";
  const needsLegendColor = !hasConfiguredThemeColor((source as Record<string, unknown>).legendTextColor)
    || String((source as Record<string, unknown>).legendTextColor || "").trim() === "#344054";
  const needsAxisColor = !hasConfiguredThemeColor((source as Record<string, unknown>).axisColor);
  const needsAxisLabelColor = !hasConfiguredThemeColor((source as Record<string, unknown>).axisLabelColor)
    || String((source as Record<string, unknown>).axisLabelColor || "").trim() === "#667085";
  const needsSplitLineColor = !hasConfiguredThemeColor((source as Record<string, unknown>).splitLineColor);
  const needsBarRadius = !hasConfiguredThemeNumber((source as Record<string, unknown>).barBorderRadius);
  const needsLineWidth = !hasConfiguredThemeNumber((source as Record<string, unknown>).lineWidth);
  const needsLineSmooth = typeof (source as Record<string, unknown>).lineSmooth !== "boolean";
  const needsShowSymbol = typeof (source as Record<string, unknown>).lineShowSymbol !== "boolean";
  const needsSymbolSize = !hasConfiguredThemeNumber((source as Record<string, unknown>).lineSymbolSize);
  const needsLabelPosition = !hasConfiguredThemeText((source as Record<string, unknown>).lineLabelPosition);
  const needsAreaOpacity = !hasConfiguredThemeNumber((source as Record<string, unknown>).lineAreaOpacity);
  const needsPointBorderColor = !hasConfiguredThemeColor((source as Record<string, unknown>).pointBorderColor);
  const needsMaxPointColor = !hasConfiguredThemeColor((source as Record<string, unknown>).extremaMaxColor);
  const needsMinPointColor = !hasConfiguredThemeColor((source as Record<string, unknown>).extremaMinColor);
  if (
    !needsPalette
    && !needsLabelColor
    && !needsLegendColor
    && !needsAxisColor
    && !needsAxisLabelColor
    && !needsSplitLineColor
    && !needsBarRadius
    && !needsLineWidth
    && !needsLineSmooth
    && !needsShowSymbol
    && !needsSymbolSize
    && !needsLabelPosition
    && !needsAreaOpacity
    && !needsPointBorderColor
    && !needsMaxPointColor
    && !needsMinPointColor
  ) {
    return widget;
  }
  const themedWidget = applyResolvedThemeToWidget(themeTemplates, dashboardThemeTemplateId, widget);
  const themedChartStyle = (themedWidget.chartStyle || {}) as Record<string, unknown>;
  return {
    ...widget,
    chartStyle: {
      ...(widget.chartStyle || {}),
      ...(needsPalette ? { palette: themedChartStyle.palette } : {}),
      ...(needsLabelColor ? { dataLabelColor: themedChartStyle.dataLabelColor } : {}),
      ...(needsLegendColor ? { legendTextColor: themedChartStyle.legendTextColor } : {}),
      ...(needsAxisColor ? { axisColor: themedChartStyle.axisColor } : {}),
      ...(needsAxisLabelColor ? { axisLabelColor: themedChartStyle.axisLabelColor } : {}),
      ...(needsSplitLineColor ? { splitLineColor: themedChartStyle.splitLineColor } : {}),
      ...(needsBarRadius ? { barBorderRadius: themedChartStyle.barBorderRadius } : {}),
      ...(needsLineWidth ? { lineWidth: themedChartStyle.lineWidth } : {}),
      ...(needsLineSmooth ? { lineSmooth: themedChartStyle.lineSmooth } : {}),
      ...(needsShowSymbol ? { lineShowSymbol: themedChartStyle.lineShowSymbol } : {}),
      ...(needsSymbolSize ? { lineSymbolSize: themedChartStyle.lineSymbolSize } : {}),
      ...(needsLabelPosition ? { lineLabelPosition: themedChartStyle.lineLabelPosition } : {}),
      ...(needsAreaOpacity ? { lineAreaOpacity: themedChartStyle.lineAreaOpacity } : {}),
      ...(needsPointBorderColor ? { pointBorderColor: themedChartStyle.pointBorderColor } : {}),
      ...(needsMaxPointColor ? { extremaMaxColor: themedChartStyle.extremaMaxColor } : {}),
      ...(needsMinPointColor ? { extremaMinColor: themedChartStyle.extremaMinColor } : {}),
    },
  };
}

export function backfillMissingScatterThemeFields<T extends ThemedWidgetShape>(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: T,
  sourceChartStyle?: Record<string, unknown> | null,
): T {
  if (widget.widgetType !== "chart") {
    return widget;
  }
  if (normalizeThemeChartFamily(widget.chartFamily) !== "scatter") {
    return widget;
  }
  const source = sourceChartStyle && typeof sourceChartStyle === "object" ? sourceChartStyle : {};
  const needsPalette = !hasConfiguredThemePalette((source as Record<string, unknown>).palette)
    || matchesThemePalette((source as Record<string, unknown>).palette, DEFAULT_SCATTER_PALETTE);
  const needsLabelColor = !hasConfiguredThemeColor((source as Record<string, unknown>).dataLabelColor);
  const needsLegendColor = !hasConfiguredThemeColor((source as Record<string, unknown>).legendTextColor);
  const needsAxisColor = !hasConfiguredThemeColor((source as Record<string, unknown>).axisColor);
  const needsAxisLabelColor = !hasConfiguredThemeColor((source as Record<string, unknown>).axisLabelColor);
  const needsSplitLineColor = !hasConfiguredThemeColor((source as Record<string, unknown>).splitLineColor);
  const needsSymbolSize = !hasConfiguredThemeNumber((source as Record<string, unknown>).scatterSymbolSize);
  const needsPointBorderColor = !hasConfiguredThemeColor((source as Record<string, unknown>).scatterPointBorderColor);
  const needsPointBorderWidth = !hasConfiguredThemeNumber((source as Record<string, unknown>).scatterPointBorderWidth);
  const needsPointOpacity = !hasConfiguredThemeNumber((source as Record<string, unknown>).scatterPointOpacity);
  const needsLabelPosition = !hasConfiguredThemeText((source as Record<string, unknown>).scatterLabelPosition);
  if (
    !needsPalette
    && !needsLabelColor
    && !needsLegendColor
    && !needsAxisColor
    && !needsAxisLabelColor
    && !needsSplitLineColor
    && !needsSymbolSize
    && !needsPointBorderColor
    && !needsPointBorderWidth
    && !needsPointOpacity
    && !needsLabelPosition
  ) {
    return widget;
  }
  const themedWidget = applyResolvedThemeToWidget(themeTemplates, dashboardThemeTemplateId, widget);
  const themedChartStyle = (themedWidget.chartStyle || {}) as Record<string, unknown>;
  return {
    ...widget,
    chartStyle: {
      ...(widget.chartStyle || {}),
      ...(needsPalette ? { palette: themedChartStyle.palette } : {}),
      ...(needsLabelColor ? { dataLabelColor: themedChartStyle.dataLabelColor } : {}),
      ...(needsLegendColor ? { legendTextColor: themedChartStyle.legendTextColor } : {}),
      ...(needsAxisColor ? { axisColor: themedChartStyle.axisColor } : {}),
      ...(needsAxisLabelColor ? { axisLabelColor: themedChartStyle.axisLabelColor } : {}),
      ...(needsSplitLineColor ? { splitLineColor: themedChartStyle.splitLineColor } : {}),
      ...(needsSymbolSize ? { scatterSymbolSize: themedChartStyle.scatterSymbolSize } : {}),
      ...(needsPointBorderColor ? { scatterPointBorderColor: themedChartStyle.scatterPointBorderColor } : {}),
      ...(needsPointBorderWidth ? { scatterPointBorderWidth: themedChartStyle.scatterPointBorderWidth } : {}),
      ...(needsPointOpacity ? { scatterPointOpacity: themedChartStyle.scatterPointOpacity } : {}),
      ...(needsLabelPosition ? { scatterLabelPosition: themedChartStyle.scatterLabelPosition } : {}),
    },
  };
}

export function backfillMissingWordCloudThemeFields<T extends ThemedWidgetShape>(
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null | undefined,
  widget: T,
  sourceChartStyle?: Record<string, unknown> | null,
): T {
  if (widget.widgetType !== "chart") {
    return widget;
  }
  if (normalizeThemeChartFamily(widget.chartFamily) !== "wordCloud") {
    return widget;
  }
  const source = sourceChartStyle && typeof sourceChartStyle === "object" ? sourceChartStyle : {};
  const needsPalette = !hasConfiguredThemePalette((source as Record<string, unknown>).palette);
  const needsShape = !hasConfiguredThemeColor((source as Record<string, unknown>).wordCloudShape);
  const needsGridSize = !hasConfiguredThemeNumber((source as Record<string, unknown>).wordCloudGridSize);
  const needsRotationStep = !hasConfiguredThemeNumber((source as Record<string, unknown>).wordCloudRotationStep);
  const needsMinFontSize = !hasConfiguredThemeNumber((source as Record<string, unknown>).wordCloudMinFontSize);
  const needsMaxFontSize = !hasConfiguredThemeNumber((source as Record<string, unknown>).wordCloudMaxFontSize);
  const needsFontWeight = !hasConfiguredThemeNumber((source as Record<string, unknown>).wordCloudFontWeight);
  const needsShadowColor = !hasConfiguredThemeColor((source as Record<string, unknown>).wordCloudTextShadowColor);
  const needsShadowBlur = !hasConfiguredThemeNumber((source as Record<string, unknown>).wordCloudTextShadowBlur);
  if (!needsPalette && !needsShape && !needsGridSize && !needsRotationStep && !needsMinFontSize && !needsMaxFontSize && !needsFontWeight && !needsShadowColor && !needsShadowBlur) {
    return widget;
  }
  const themedWidget = applyResolvedThemeToWidget(themeTemplates, dashboardThemeTemplateId, widget);
  const themedChartStyle = (themedWidget.chartStyle || {}) as Record<string, unknown>;
  return {
    ...widget,
    chartStyle: {
      ...(widget.chartStyle || {}),
      ...(needsPalette ? { palette: themedChartStyle.palette } : {}),
      ...(needsShape ? { wordCloudShape: themedChartStyle.wordCloudShape } : {}),
      ...(needsGridSize ? { wordCloudGridSize: themedChartStyle.wordCloudGridSize } : {}),
      ...(needsRotationStep ? { wordCloudRotationStep: themedChartStyle.wordCloudRotationStep } : {}),
      ...(needsMinFontSize ? { wordCloudMinFontSize: themedChartStyle.wordCloudMinFontSize } : {}),
      ...(needsMaxFontSize ? { wordCloudMaxFontSize: themedChartStyle.wordCloudMaxFontSize } : {}),
      ...(needsFontWeight ? { wordCloudFontWeight: themedChartStyle.wordCloudFontWeight } : {}),
      ...(needsShadowColor ? { wordCloudTextShadowColor: themedChartStyle.wordCloudTextShadowColor } : {}),
      ...(needsShadowBlur ? { wordCloudTextShadowBlur: themedChartStyle.wordCloudTextShadowBlur } : {}),
    },
  };
}
