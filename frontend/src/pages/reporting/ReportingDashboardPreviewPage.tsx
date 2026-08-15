import { AppstoreOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Spin, Statistic, Table, Tabs, Typography, message } from "antd";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import chinaGeoJson from "../../constants/china.geo.json";
import { fetchReportingDashboardRuntime, fetchReportingThemeTemplates, previewReportingDashboardChart, previewReportingRuntimeDashboardChart } from "../../services/reporting";
import { useAuth } from "../../app/providers/AuthProvider";
import type { ReportingDashboardRecord, ReportingDashboardWidgetRecord } from "../../types/api";
import * as echarts from "echarts";
import { installEchartsWordCloud, normalizeWordCloudOption } from "./charts/echarts-word-cloud";
import {
  buildDefaultKpiConfig,
  buildDefaultChartStyleConfig,
  buildDefaultTableConfig,
  buildDefaultTabsConfig,
  buildChromeBackgroundFromStyle,
  normalizeChromeConfig,
  normalizeChartStyleConfig,
  normalizeMapStyleConfig,
  normalizeKpiAnalysisConfig,
  normalizeKpiStyleConfig,
  stripLegacyKpiThemeDefaults,
  normalizeTableStyleConfig,
  normalizeTabsStyleConfig,
  renderWidgetPreview,
  transformPreviewForWidget,
} from "./ReportingDashboardEditorPage";
import { backfillMissingComboThemeFields, backfillMissingGaugeThemeFields, backfillMissingMapThemeFields, backfillMissingWordCloudThemeFields, resolveWidgetVisualTheme } from "./theme/theme-runtime";
import type { ThemeTemplateRecord } from "./theme/theme-template.types";

installEchartsWordCloud();

type RuntimeWidgetDraft = {
  key: string;
  widgetName: string;
  widgetType: string;
  inheritDashboardTheme: boolean;
  widgetThemeTemplateId?: number | null;
  widgetThemeOverrides?: Record<string, unknown>;
  chartAssetId?: number | null;
  chartFamily?: string | null;
  variantName?: string | null;
  accentColor?: string | null;
  palettePreset?: string | null;
  chrome?: Record<string, any>;
  chartStyle?: Record<string, any>;
  mapStyle?: Record<string, any>;
  chartAnalysis?: Record<string, any>;
  kpi?: Record<string, any>;
  kpiStyle?: Record<string, any>;
  kpiAnalysis?: Record<string, any>;
  table?: Record<string, any>;
  tableStyle?: Record<string, any>;
  tabs?: Record<string, any>;
  tabsStyle?: Record<string, any>;
  richText?: Record<string, any>;
  richTextStyle?: Record<string, any>;
  image?: Record<string, any>;
  imageStyle?: Record<string, any>;
  bindingMode?: "dataset" | "sql";
  datasetId?: number | null;
  sourceId?: number | null;
  sourceTable?: string | null;
  sourceSql?: string | null;
  fieldMap?: Record<string, string>;
  fields?: Array<{ columnName: string; label?: string; dataType?: string }>;
  preview?: any;
  containerParentKey?: string | null;
  containerTabKey?: string | null;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

const RUNTIME_CANVAS_WIDTH = 1600;

function getRuntimeCanvasRatioValue(ratioPreset?: unknown) {
  const value = String(ratioPreset || "16:9");
  if (value === "4:3") return 4 / 3;
  if (value === "1:1") return 1;
  if (value === "21:9") return 21 / 9;
  return 16 / 9;
}

function buildDefaultChrome(titleText?: string) {
  return {
    themeKey: null,
    titleText: titleText || "",
    showTitle: false,
    titleAlign: "left",
    titleColor: "#101828",
    titleFontSize: 18,
    titleFontWeight: 700,
    paddingPreset: "comfortable",
    backgroundColor: "#ffffff",
    backgroundImage: "",
    borderColor: "#eef2f7",
    borderWidth: 1,
    borderRadius: 16,
    shadowPreset: "none",
  };
}

function mapRuntimeWidget(widget: ReportingDashboardWidgetRecord): RuntimeWidgetDraft {
  const props = (widget.props || {}) as Record<string, any>;
  return {
    key: widget.widgetKey,
    widgetName: widget.widgetName,
    widgetType: widget.widgetType || "chart",
    inheritDashboardTheme: props.inheritDashboardTheme !== false,
    widgetThemeTemplateId: props.widgetThemeTemplateId ? Number(props.widgetThemeTemplateId) : null,
    widgetThemeOverrides: typeof props.widgetThemeOverrides === "object" && props.widgetThemeOverrides ? props.widgetThemeOverrides : {},
    chartAssetId: widget.chartAssetId ? Number(widget.chartAssetId) : null,
    chartFamily: props.chartFamily ? String(props.chartFamily) : null,
    variantName: props.variantName ? String(props.variantName) : null,
    accentColor: props.accentColor ? String(props.accentColor) : null,
    palettePreset: props.palettePreset ? String(props.palettePreset) : null,
    chrome: normalizeChromeConfig(props.chrome, widget.widgetName),
    chartStyle: normalizeChartStyleConfig(props.chartStyle, props.chrome, props.accentColor ? String(props.accentColor) : null, props.palettePreset ? String(props.palettePreset) : null) || buildDefaultChartStyleConfig(),
    mapStyle: normalizeMapStyleConfig(props.mapStyle, props.chrome),
    chartAnalysis: props.chartAnalysis || {},
    kpi: typeof props.kpi === "object" && props.kpi ? props.kpi : buildDefaultKpiConfig(),
    kpiStyle: stripLegacyKpiThemeDefaults(normalizeKpiStyleConfig(props.kpiStyle, props.chrome, props.kpi)),
    kpiAnalysis: normalizeKpiAnalysisConfig(props.kpiAnalysis, props.kpi),
    table: typeof props.table === "object" && props.table ? props.table : buildDefaultTableConfig(),
    tableStyle: normalizeTableStyleConfig(props.tableStyle, props.table),
    tabs: typeof props.tabs === "object" && props.tabs ? props.tabs : buildDefaultTabsConfig(),
    tabsStyle: normalizeTabsStyleConfig(props.tabsStyle),
    richText: typeof props.richText === "object" && props.richText ? props.richText : { content: "" },
    richTextStyle: typeof props.richTextStyle === "object" && props.richTextStyle ? props.richTextStyle : {},
    image: typeof props.image === "object" && props.image ? props.image : { imageUrl: "" },
    imageStyle: typeof props.imageStyle === "object" && props.imageStyle ? props.imageStyle : {},
    bindingMode: widget.datasetId ? "dataset" : "sql",
    datasetId: widget.datasetId ? Number(widget.datasetId) : null,
    sourceId: props.sourceId ? Number(props.sourceId) : null,
    sourceTable: props.sourceTable ? String(props.sourceTable) : null,
    sourceSql: props.sourceSql ? String(props.sourceSql) : null,
    fieldMap: typeof props.fieldMap === "object" && props.fieldMap ? props.fieldMap as Record<string, string> : {},
    fields: [],
    preview: null,
    containerParentKey: props.containerParentKey ? String(props.containerParentKey) : null,
    containerTabKey: props.containerTabKey ? String(props.containerTabKey) : null,
    position: {
      x: Number(widget.position?.x || 0),
      y: Number(widget.position?.y || 0),
      w: Number(widget.position?.w || 520),
      h: Number(widget.position?.h || 320),
    },
  };
}

function toRuntimeWidgetRecord(draft: RuntimeWidgetDraft): ReportingDashboardWidgetRecord & { __runtimePreview?: any } {
  return {
    widgetKey: draft.key,
    widgetName: draft.widgetName,
    widgetType: draft.widgetType as ReportingDashboardWidgetRecord["widgetType"],
    datasetId: draft.datasetId ?? null,
    chartAssetId: draft.chartAssetId ?? null,
    position: draft.position,
    props: {
      inheritDashboardTheme: draft.inheritDashboardTheme !== false,
      widgetThemeTemplateId: draft.widgetThemeTemplateId || null,
      widgetThemeOverrides: draft.widgetThemeOverrides || {},
      chartFamily: draft.chartFamily,
      variantName: draft.variantName,
      accentColor: draft.accentColor,
      palettePreset: draft.palettePreset,
      chrome: draft.chrome || {},
      chartStyle: draft.chartStyle || {},
      mapStyle: draft.mapStyle || {},
      chartAnalysis: draft.chartAnalysis || {},
      kpi: draft.kpi || {},
      kpiStyle: draft.kpiStyle || {},
      kpiAnalysis: draft.kpiAnalysis || {},
      table: draft.table || {},
      tableStyle: draft.tableStyle || {},
      tabs: draft.tabs || {},
      tabsStyle: draft.tabsStyle || {},
      richText: draft.richText || {},
      richTextStyle: draft.richTextStyle || {},
      image: draft.image || {},
      imageStyle: draft.imageStyle || {},
      bindingMode: draft.bindingMode,
      sourceId: draft.sourceId,
      sourceTable: draft.sourceTable,
      sourceSql: draft.sourceSql,
      fieldMap: draft.fieldMap || {},
      containerParentKey: draft.containerParentKey,
      containerTabKey: draft.containerTabKey,
    },
    queryParams: {},
    __runtimePreview: draft.preview || null,
  };
}

function renderRuntimeDraftWidget(widget: RuntimeWidgetDraft, allWidgets: RuntimeWidgetDraft[]) {
  const draftWidgets = allWidgets as any[];
  const currentWidget = widget as any;
  return renderWidgetPreview(currentWidget, draftWidgets);
}

let chinaMapRegistered = false;
function ensureChinaMapRegistered() {
  if (chinaMapRegistered) return;
  echarts.registerMap("china", chinaGeoJson as never);
  chinaMapRegistered = true;
}

function resolveContainerShadow(shadowPreset?: string) {
  if (shadowPreset === "medium") return "0 12px 32px rgba(15,23,42,0.16)";
  if (shadowPreset === "soft") return "0 8px 24px rgba(15,23,42,0.10)";
  return "none";
}

function resolveChartPadding(preset?: string) {
  if (preset === "compact") return { left: 4, right: 4, top: 8, bottom: 4 };
  if (preset === "spacious") return { left: 40, right: 40, top: 52, bottom: 40 };
  return { left: 18, right: 18, top: 24, bottom: 18 };
}

function resolveChromeBackground(chrome?: Record<string, any> | null) {
  return buildChromeBackgroundFromStyle((chrome || {}) as any);
}

function renderKpiValueNode(value: string | number | null | undefined, previewKpi: any, kpiStyle: Record<string, any>, scale = 1) {
  const mainColor = kpiStyle.valueColor || "#1677ff";
  const mainFontSize = Math.max(20, Math.round(Number(kpiStyle.valueFontSize || (previewKpi.mode === "flipper" ? 42 : previewKpi.mode === "progress" ? 28 : 34)) * scale));
  const mainFontWeight = Number(kpiStyle.valueFontWeight || 700);
  const prefix = previewKpi.valuePrefix || "";
  const suffix = previewKpi.valueSuffix || "";
  const prefixColor = kpiStyle.valuePrefixColor || mainColor;
  const prefixFontSize = Math.max(12, Math.round(Number(kpiStyle.valuePrefixFontSize || Math.max(12, mainFontSize - 14)) * Math.max(0.9, scale)));
  const suffixColor = kpiStyle.valueSuffixColor || mainColor;
  const suffixFontSize = Math.max(12, Math.round(Number(kpiStyle.valueSuffixFontSize || Math.max(12, mainFontSize - 14)) * Math.max(0.9, scale)));

  return (
    <Statistic
      value={value ?? 0}
      precision={Number(previewKpi.decimals || 0)}
      valueStyle={{
        fontSize: mainFontSize,
        fontWeight: mainFontWeight,
        color: mainColor,
        letterSpacing: previewKpi.mode === "flipper" ? 2 : 0,
      }}
      prefix={prefix ? (
        <span style={{ color: prefixColor, fontSize: prefixFontSize, fontWeight: mainFontWeight, marginRight: 4 }}>
          {prefix}
        </span>
      ) : undefined}
      suffix={suffix ? (
        <span style={{ color: suffixColor, fontSize: suffixFontSize, fontWeight: mainFontWeight, marginLeft: 4 }}>
          {suffix}
        </span>
      ) : undefined}
    />
  );
}

function resolveDividerDecoration(style?: string, color?: string | null, width?: number | null, axis: "horizontal" | "vertical" = "horizontal") {
  const dividerColor = color || "#e5e7eb";
  const dividerWidth = Math.max(1, Number(width || 1));
  if (style === "soft-band" || style === "glow-band") {
    const gradient = axis === "horizontal"
      ? `linear-gradient(90deg, transparent 0%, ${dividerColor} 50%, transparent 100%)`
      : `linear-gradient(180deg, transparent 0%, ${dividerColor} 50%, transparent 100%)`;
    return {
      border: "none",
      background: gradient,
      boxShadow: style === "glow-band" ? `0 0 10px ${dividerColor}` : "none",
    };
  }
  return axis === "horizontal"
    ? { borderBottom: `${dividerWidth}px ${style || "solid"} ${dividerColor}` }
    : { borderRight: `${dividerWidth}px ${style || "solid"} ${dividerColor}` };
}

function renderKpiDividerNode(style?: string, color?: string | null, width?: number | null, axis: "horizontal" | "vertical" = "horizontal") {
  const dividerColor = color || "#e5e7eb";
  const dividerWidth = Math.max(1, Number(width || 1));
  if (style === "icon-center") {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        {axis === "horizontal" ? (
          <div style={{ width: "100%", height: dividerWidth, background: `linear-gradient(90deg, transparent 0%, ${dividerColor} 35%, ${dividerColor} 65%, transparent 100%)`, position: "relative" }}>
            <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: 999, background: dividerColor, boxShadow: `0 0 0 4px rgba(255,255,255,0.9)` }} />
          </div>
        ) : (
          <div style={{ height: "100%", width: dividerWidth, background: `linear-gradient(180deg, transparent 0%, ${dividerColor} 35%, ${dividerColor} 65%, transparent 100%)`, position: "relative" }}>
            <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: 999, background: dividerColor, boxShadow: `0 0 0 4px rgba(255,255,255,0.9)` }} />
          </div>
        )}
      </div>
    );
  }
  if (style === "short-axis") {
    return axis === "horizontal"
      ? <div style={{ position: "absolute", left: "18%", right: "18%", bottom: 0, height: dividerWidth, borderBottom: `${dividerWidth}px solid ${dividerColor}` }} />
      : <div style={{ position: "absolute", top: "18%", bottom: "18%", right: 0, width: dividerWidth, borderRight: `${dividerWidth}px solid ${dividerColor}` }} />;
  }
  if (style === "corner-badge") {
    return axis === "horizontal"
      ? <span style={{ position: "absolute", right: 10, bottom: 0, width: 26, height: 8, borderRadius: "8px 8px 0 0", background: dividerColor }} />
      : <span style={{ position: "absolute", right: 0, bottom: 10, width: 8, height: 26, borderRadius: "8px 0 0 8px", background: dividerColor }} />;
  }
  return <div style={{ position: "absolute", inset: 0, ...resolveDividerDecoration(style, color, width, axis) }} />;
}

function renderCenteredKpiDividerNode(style?: string, color?: string | null, width?: number | null, axis: "horizontal" | "vertical" = "horizontal") {
  const dividerWidth = Math.max(1, Number(width || 1));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {axis === "horizontal" ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: dividerWidth, transform: "translateY(-50%)" }}>
          {renderKpiDividerNode(style, color, width, axis)}
        </div>
      ) : (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: dividerWidth, transform: "translateX(-50%)" }}>
          {renderKpiDividerNode(style, color, width, axis)}
        </div>
      )}
    </div>
  );
}

function renderRuntimeWidget(widget: ReportingDashboardWidgetRecord, preview: any, allWidgets: ReportingDashboardWidgetRecord[]) {
  const props = (widget.props || {}) as Record<string, any>;
  const chrome = (props.chrome || {}) as Record<string, any>;
  const contentHeight = Number((widget.position as any)?.h || 320) - (chrome.showTitle === false ? 24 : 62);

  if (widget.widgetType === "kpi" && preview?.kpi) {
    const kpiStyle = props.kpiStyle || {};
    const resolvedPadding = resolveChartPadding(chrome.paddingPreset);
    const dataItems = Array.isArray(preview.kpi.items) && preview.kpi.items.length > 0 ? preview.kpi.items : [preview.kpi];
    const itemsPerRow = Math.max(1, Number(kpiStyle.itemsPerRow || 2));
    const itemsPerColumn = Math.max(1, Number(kpiStyle.itemsPerColumn || 3));
    const contentMode = kpiStyle.multiValueLayout || "verticalList";
    const isHorizontal = preview.kpi.layout === "horizontal";
    const gridColumns = isHorizontal ? Math.min(itemsPerRow, dataItems.length) : Math.ceil(dataItems.length / itemsPerColumn);
    const gridRows = isHorizontal ? Math.ceil(dataItems.length / itemsPerRow) : Math.min(itemsPerColumn, dataItems.length);
    const isSingleItem = dataItems.length === 1;
    const itemSizeScale = isSingleItem ? 1 : (kpiStyle.itemSize === "small" ? 0.72 : kpiStyle.itemSize === "large" ? 0.96 : 0.84);
    const gridGap = isSingleItem ? 0 : 16;
    const dividerWidth = Math.max(1, Number(kpiStyle.dividerWidth || 1));
    const verticalDividerOffset = gridGap / 2 + dividerWidth / 2;
    const cellHeight = Math.max(120, contentHeight / Math.max(1, gridRows));
    const heightScale = Math.max(0.92, Math.min(1.45, cellHeight / 180));
    const cardPaddingY = Math.max(14, Math.round(18 * heightScale));
    const cardPaddingX = Math.max(12, Math.round(12 * Math.min(1.3, heightScale)));
    const contentGap = Math.max(10, Math.round(12 * heightScale));
    const rowGap = Math.max(12, Math.round(14 * heightScale));
    const labelFontSize = Math.max(14, Math.round(Number(preview.kpi.metricLabelFontSize || 16) * Math.min(1.22, heightScale)));
    const trendFontSize = Math.max(13, Math.round(Number(preview.kpi.compareLabelFontSize || 16) * Math.min(1.18, heightScale)));
    const contentOrientation = kpiStyle.contentOrientation || "vertical";
    const renderKpiItem = (item: Record<string, unknown>, index: number) => {
      const valueNode = kpiStyle.showValue === false ? null : (
        renderKpiValueNode(item.primaryValue as string | number | null | undefined, preview.kpi, kpiStyle, heightScale)
      );

      const labelNode = preview.kpi.showMetricLabel !== false ? (
        <Typography.Text
          style={{
            color: preview.kpi.metricLabelColor || "#667085",
            fontSize: labelFontSize,
            fontWeight: Number(preview.kpi.metricLabelFontWeight || 600),
            textAlign: kpiStyle.itemAlign || chrome.titleAlign || "left",
          }}
        >
          {String(item.label || widget.widgetName)}
        </Typography.Text>
      ) : null;

      const trendNode = preview.kpi.showTrend !== false && item.trendPercent !== null ? (
        <Typography.Text
          style={{
            color: kpiStyle.trendColorMode === "fixed"
              ? (preview.kpi.compareLabelColor || "#52c41a")
              : (Number(item.trendPercent) >= 0 ? "#52c41a" : "#ff4d4f"),
            fontSize: trendFontSize,
            fontWeight: Number(preview.kpi.compareLabelFontWeight || 600),
          }}
        >
          {preview.kpi.compareLabel || "同比"} {Number(item.trendPercent) >= 0 ? "+" : ""}{String(item.trendPercent)}%
        </Typography.Text>
      ) : null;

      if (preview.kpi.mode === "progress") {
        return (
          <div
            key={`${widget.widgetKey}_runtime_kpi_${index}`}
            style={{
              display: "flex",
            flexDirection: contentOrientation === "horizontal" ? "row" : "column",
              alignItems: contentMode === "horizontalList" ? "center" : "stretch",
              justifyContent: "center",
              gap: rowGap,
              width: "100%",
            }}
          >
            {labelNode}
            <div style={{ display: "flex", flexDirection: "column", gap: contentGap, flex: 1 }}>
              {valueNode}
              <div style={{ width: "100%", height: 10, borderRadius: 999, background: String(kpiStyle.progressTrackColor || kpiStyle.itemBorderColor || "#e5edf7"), overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, Number(item.primaryValue || 0)))}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: String(kpiStyle.progressFillColor || kpiStyle.valueColor || "#1677ff"),
                  }}
                />
              </div>
              {trendNode}
            </div>
          </div>
        );
      }

      if (preview.kpi.mode === "flipper") {
        const flipperDigits = (
          <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: `${Math.max(32, Number(kpiStyle.flipperDigitWidth || 56))}px`, justifyContent: "center", gap: Number(kpiStyle.flipperGap || 6) }}>
            {String(item.formattedValue ?? item.primaryValue ?? "0").split("").map((char: string, charIndex: number) => (
              <div
                key={`${widget.widgetKey}_runtime_flip_${index}_${charIndex}`}
                style={{
                  height: Math.max(32, Number(kpiStyle.flipperDigitHeight || 52)),
                  borderRadius: Number(kpiStyle.flipperDigitRadius || 10),
                  background: kpiStyle.flipperBackground || `linear-gradient(180deg, ${kpiStyle.valueColor || "#0f172a"} 0%, rgba(15,23,42,0.92) 100%)`,
                  color: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 700,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(15,23,42,0.18)",
                }}
              >
                {char}
              </div>
            ))}
          </div>
        );
        return (
          <div
            key={`${widget.widgetKey}_runtime_kpi_${index}`}
            style={{
              display: "flex",
              flexDirection: contentMode === "horizontalList" ? "row" : "column",
              alignItems: contentMode === "horizontalList" ? "center" : "stretch",
              justifyContent: "center",
              gap: contentGap,
              minWidth: 180,
            }}
          >
            {labelNode}
            {flipperDigits}
            {trendNode}
          </div>
        );
      }

      return (
        <div
          key={`${widget.widgetKey}_runtime_kpi_${index}`}
          style={{
            display: "flex",
            flexDirection: contentOrientation === "horizontal" ? "row" : "column",
            alignItems: contentOrientation === "horizontal" ? "center" : (contentMode === "horizontalList" ? "center" : "stretch"),
            justifyContent: "center",
            gap: contentGap,
            flex: 1,
          }}
        >
          {contentOrientation === "horizontal" ? (
            <div style={{ minWidth: 72, display: "flex", alignItems: "center", justifyContent: "flex-start", height: "100%" }}>
              {labelNode}
            </div>
          ) : labelNode}
          <div style={{ display: "flex", flexDirection: "column", gap: contentGap, flex: 1, minWidth: 0 }}>
            {valueNode}
            {trendNode}
          </div>
        </div>
      );
    };

    return (
      <div
        style={{
          height: contentHeight,
          paddingTop: resolvedPadding.top,
          paddingRight: resolvedPadding.right,
          paddingBottom: resolvedPadding.bottom,
          paddingLeft: resolvedPadding.left,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            width: "100%",
            height: "100%",
            gridTemplateColumns: `repeat(${Math.max(1, gridColumns)}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${Math.max(1, gridRows)}, minmax(0, 1fr))`,
            placeItems: "stretch",
            alignContent: "center",
            justifyContent: "center",
            gap: gridGap,
          }}
        >
          {dataItems.map((item: Record<string, unknown>, index: number) => (
            <div
              key={`${widget.widgetKey}_runtime_kpi_wrap_${index}`}
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!isHorizontal && contentMode === "verticalList" && kpiStyle.showDivider !== false && index < dataItems.length - Math.max(1, gridColumns) ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: Math.max(1, Number(kpiStyle.dividerWidth || 1)),
                  }}
                >
                  {renderCenteredKpiDividerNode(kpiStyle.dividerStyle, kpiStyle.dividerColor, kpiStyle.dividerWidth, "horizontal")}
                </div>
              ) : null}
              {isHorizontal && kpiStyle.showDivider !== false && ((index + 1) % Math.max(1, gridColumns) !== 0) && index !== dataItems.length - 1 ? (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    right: -gridGap,
                    width: Math.max(1, gridGap),
                  }}
                >
                  {renderCenteredKpiDividerNode(kpiStyle.dividerStyle, kpiStyle.dividerColor, kpiStyle.dividerWidth, "vertical")}
                </div>
              ) : null}
              <div
                style={{
                  width: `${itemSizeScale * 100}%`,
                  height: `${itemSizeScale * 100}%`,
                  alignSelf: "center",
                  justifySelf: "center",
                  position: "relative",
                  background: String(kpiStyle.itemBackgroundColor || "#ffffff"),
                  border: `${Number(kpiStyle.itemBorderWidth || 0)}px solid ${kpiStyle.itemBorderColor || "#e5e7eb"}`,
                  borderRadius: Number(kpiStyle.itemBorderRadius || 12),
                  transition: kpiStyle.hoverElevated === false ? undefined : "transform 180ms ease, box-shadow 180ms ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: Math.max(10, Math.min(cardPaddingY, Math.floor(cellHeight * 0.16))),
                  paddingBottom: contentMode === "verticalList" && kpiStyle.showDivider !== false && index < dataItems.length - Math.max(1, gridColumns)
                    ? Math.max(12, Math.min(cardPaddingY, Math.floor(cellHeight * 0.16)))
                    : Math.max(10, Math.min(cardPaddingY, Math.floor(cellHeight * 0.16))),
                  paddingLeft: contentMode === "grid" ? cardPaddingX : 0,
                  paddingRight: contentMode === "grid" ? cardPaddingX : 0,
                  textAlign: kpiStyle.itemAlign || "left",
                  boxShadow: Number(kpiStyle.itemBorderWidth || 0) > 0 ? "0 4px 10px rgba(15,23,42,0.04)" : "none",
                }}
                className={kpiStyle.hoverElevated === false ? undefined : "reporting-kpi-item-card"}
              >
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: kpiStyle.itemAlign === "center" ? "center" : kpiStyle.itemAlign === "right" ? "flex-end" : "flex-start", height: "100%", width: "100%" }}>
                  {renderKpiItem(item, index)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (widget.widgetType === "table" && preview?.table) {
    return (
      <div style={{ height: contentHeight, padding: 8, background: resolveChromeBackground(chrome) }}>
        <Table
          size="small"
          dataSource={preview.table.rows || []}
          columns={(preview.table.columns || []).map((column: Record<string, any>) => ({
            ...column,
            onHeaderCell: () => ({
              style: {
                background: String(props.tableStyle?.headerBackground || "#f5f7fb"),
                color: String(props.tableStyle?.headerTextColor || "#101828"),
                borderColor: String(props.tableStyle?.rowBorderColor || "#eef2f7"),
              },
            }),
            onCell: (_record: unknown, index?: number) => ({
              style: {
                background: props.tableStyle?.striped !== false && typeof index === "number" && index % 2 === 1
                  ? String(props.tableStyle?.rowAlternateBackground || "#fafcff")
                  : String(props.tableStyle?.rowBackground || "#ffffff"),
                borderColor: String(props.tableStyle?.rowBorderColor || "#eef2f7"),
              },
            }),
          }))}
          pagination={false}
          rowKey={(_, index) => `${widget.widgetKey}_${index}`}
          scroll={{ x: "max-content", y: contentHeight - 24 }}
        />
      </div>
    );
  }

  if (widget.widgetType === "tabs" && preview?.tabs) {
    const items = (props.tabs?.items || []).map((item: any) => {
      const child = allWidgets.find((entry) => entry.widgetKey === item.childWidgetKey);
      const isActive = item.key === (preview.tabs.defaultActiveKey || props.tabs?.defaultActiveKey || props.tabs?.items?.[0]?.key);
      return {
        key: item.key,
        label: (
          <span
            style={{
              color: isActive ? String(props.tabsStyle?.activeTextColor || "#1677ff") : String(props.tabsStyle?.inactiveTextColor || "#667085"),
              background: isActive ? String(props.tabsStyle?.activeBackground || "transparent") : "transparent",
              boxShadow: isActive ? `0 0 0 1px ${String(props.tabsStyle?.indicatorColor || "rgba(22,119,255,0.28)")} inset` : "none",
              borderRadius: 999,
              padding: "2px 10px",
            }}
          >
            {item.title}
          </span>
        ),
        children: child ? <div style={{ height: contentHeight - 48 }}>{renderRuntimeWidget(child, (child as any).__runtimePreview, allWidgets)}</div> : <Empty description="空窗口" />,
      };
    });
    return (
      <div style={{ height: contentHeight, padding: 8, background: resolveChromeBackground(chrome) }}>
        <Tabs
          defaultActiveKey={preview.tabs.defaultActiveKey || undefined}
          tabBarStyle={{
            marginBottom: 8,
            background: String(props.tabsStyle?.tabBarBackgroundColor || "#f8fafc"),
            borderRadius: 10,
            padding: "4px 8px",
          }}
          items={items}
        />
      </div>
    );
  }

  if (widget.widgetType === "richText") {
    return <div style={{ height: contentHeight, padding: 16, background: resolveChromeBackground(chrome), whiteSpace: "pre-wrap" }}>{props.richText?.content || ""}</div>;
  }

  if (widget.widgetType === "image") {
    return props.image?.imageUrl
      ? <div style={{ height: contentHeight, padding: 12, background: resolveChromeBackground(chrome) }}><img src={props.image.imageUrl} alt={widget.widgetName} style={{ width: "100%", height: "100%", objectFit: props.imageStyle?.objectFit || "contain", borderRadius: Number(props.imageStyle?.borderRadius || 10) }} /></div>
      : <Empty description="暂无图片" />;
  }

  if (preview?.option) {
    const option = normalizeWordCloudOption({ ...(preview.option || {}) } as Record<string, any>);
    delete option.title;
    return (
      <div
        style={{
          height: contentHeight,
          background: resolveChromeBackground(chrome),
        }}
      >
        <ReactECharts option={option} style={{ height: "100%" }} notMerge lazyUpdate />
      </div>
    );
  }
  return <Empty description="暂无预览内容" />;
}

export function ReportingDashboardPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<ReportingDashboardRecord | null>(null);
  const [runtimeWidgets, setRuntimeWidgets] = useState<RuntimeWidgetDraft[]>([]);
  const [themeTemplates, setThemeTemplates] = useState<ThemeTemplateRecord[]>([]);
  const [canvasScale, setCanvasScale] = useState(1);

  const shareToken = searchParams.get("shareToken") || undefined;
  const runtimeToken = searchParams.get("runtimeToken") || undefined;
  const accessToken = token || runtimeToken;

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      try {
        const [response, themeResponse] = await Promise.all([
          fetchReportingDashboardRuntime(Number(id), shareToken, accessToken || undefined),
          fetchReportingThemeTemplates(accessToken || token || "", shareToken, Number(id)),
        ]);
        const dashboard = response.data;
        const nextThemeTemplates = (themeResponse.data || []) as ThemeTemplateRecord[];
        setThemeTemplates(nextThemeTemplates);
        const previewWidgets = await Promise.all((dashboard.widgets || []).map(async (widget) => {
          const props = (widget.props || {}) as Record<string, any>;
          const runtimeDraft = backfillMissingWordCloudThemeFields(
            nextThemeTemplates,
            dashboard.themeTemplateId ? Number(dashboard.themeTemplateId) : null,
            backfillMissingGaugeThemeFields(
              nextThemeTemplates,
              dashboard.themeTemplateId ? Number(dashboard.themeTemplateId) : null,
              backfillMissingComboThemeFields(
                nextThemeTemplates,
                dashboard.themeTemplateId ? Number(dashboard.themeTemplateId) : null,
                backfillMissingMapThemeFields(
                  nextThemeTemplates,
                  dashboard.themeTemplateId ? Number(dashboard.themeTemplateId) : null,
                  mapRuntimeWidget(widget),
                  props.chartStyle || {}
                ),
                props.chartStyle || {}
              ),
              props.chartStyle || {}
            ),
            props.chartStyle || {}
          );
          if (!["chart", "kpi", "table", "tabs"].includes(widget.widgetType)) {
            return { ...widget, __runtimePreview: null, __runtimeDraft: runtimeDraft };
          }
          if (!accessToken && !shareToken) {
            return { ...widget, __runtimePreview: null, __runtimeDraft: runtimeDraft };
          }
          const previewPayload = {
            widgetKey: widget.widgetKey,
            widgetType: widget.widgetType,
            chartAssetId: widget.chartAssetId,
            datasetId: widget.datasetId || undefined,
            sourceId: props.sourceId || undefined,
            datasetType: props.sourceSql ? "sql" : "table",
            sourceTable: props.sourceTable || undefined,
            sourceSql: props.sourceSql || undefined,
            fieldMap: props.fieldMap || {},
            chrome: runtimeDraft.chrome || {},
            chartStyle: runtimeDraft.chartStyle || {},
            mapStyle: runtimeDraft.mapStyle || {},
            chartAnalysis: runtimeDraft.chartAnalysis || {},
            kpi: runtimeDraft.kpi || {},
            kpiStyle: runtimeDraft.kpiStyle || {},
            kpiAnalysis: runtimeDraft.kpiAnalysis || {},
            table: runtimeDraft.table || {},
            tableStyle: runtimeDraft.tableStyle || {},
            tabs: runtimeDraft.tabs?.items || [],
            tabsStyle: runtimeDraft.tabsStyle || {},
          };
          const previewRes = shareToken
            ? await previewReportingRuntimeDashboardChart(Number(id), shareToken, previewPayload, accessToken || undefined)
            : await previewReportingDashboardChart(accessToken || "", previewPayload);
          return { ...widget, __runtimePreview: previewRes.data, __runtimeDraft: runtimeDraft };
        }));
        const nextRecord = { ...dashboard, widgets: previewWidgets as any };
        setRecord(nextRecord);
        setRuntimeWidgets(
          (nextRecord.widgets || []).map((item: any) => {
            const draft = item.__runtimeDraft || mapRuntimeWidget(item);
            const transformedPreview = item.__runtimePreview
              ? transformPreviewForWidget(draft as any, item.__runtimePreview)
              : null;
            return {
              ...draft,
              preview: transformedPreview,
            };
          })
        );
      } catch (error: any) {
        message.error(error.message || "加载报表预览失败");
      } finally {
        setLoading(false);
      }
    }
    if (!shareToken && !accessToken) {
      return;
    }
    void loadData();
  }, [accessToken, id, shareToken]);

  const canvasMetrics = useMemo(() => {
    const ratio = getRuntimeCanvasRatioValue(record?.canvasConfig?.ratioPreset);
    return {
      width: RUNTIME_CANVAS_WIDTH,
      height: Math.max(900, Math.round(RUNTIME_CANVAS_WIDTH / ratio)),
    };
  }, [record?.canvasConfig?.ratioPreset]);

  useEffect(() => {
    function syncCanvasScale() {
      const viewport = canvasViewportRef.current;
      if (!viewport) return;
      const availableWidth = Math.max(320, viewport.clientWidth);
      setCanvasScale(availableWidth / canvasMetrics.width);
    }

    syncCanvasScale();
    const viewport = canvasViewportRef.current;
    const resizeObserver = typeof ResizeObserver !== "undefined" && viewport
      ? new ResizeObserver(syncCanvasScale)
      : null;
    resizeObserver?.observe(viewport as Element);
    window.addEventListener("resize", syncCanvasScale);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncCanvasScale);
    };
  }, [canvasMetrics.width, record?.id]);

  const rootWidgets = useMemo(
    () => runtimeWidgets.filter((item) => !item.containerParentKey),
    [runtimeWidgets]
  );
  const resolvedDashboardTheme = useMemo(
    () => resolveWidgetVisualTheme(themeTemplates, record?.themeTemplateId || null, { widgetType: "chart", chartFamily: null }),
    [record?.themeTemplateId, themeTemplates]
  );
  const canvasBackgroundStyle = useMemo(() => {
    const backgroundType = String(record?.canvasConfig?.backgroundType || "");
    if (backgroundType === "image" && record?.canvasConfig?.backgroundImage) {
      return `url(${record.canvasConfig.backgroundImage}) center/cover no-repeat`;
    }
    if (backgroundType === "gradient" && record?.canvasConfig?.backgroundGradient) {
      return String(record.canvasConfig.backgroundGradient);
    }
    if (backgroundType === "solid" && record?.canvasConfig?.backgroundColor) {
      return String(record.canvasConfig.backgroundColor);
    }
    if (record?.canvasConfig?.backgroundImage) {
      return `url(${record.canvasConfig.backgroundImage}) center/cover no-repeat`;
    }
    return String(resolvedDashboardTheme.canvas.backgroundGradient || resolvedDashboardTheme.canvas.backgroundColor || "linear-gradient(180deg, #f7f9fc 0%, #eef3fa 100%)");
  }, [record?.canvasConfig, resolvedDashboardTheme.canvas.backgroundColor, resolvedDashboardTheme.canvas.backgroundGradient]);

  if (loading) {
    return <Spin fullscreen tip="正在加载报表预览..." />;
  }

  if (!shareToken && !accessToken) {
    return <Spin fullscreen tip="正在同步登录态..." />;
  }

  if (!record) {
    return <Empty description="未找到报表" />;
  }

  return (
    <div style={{ minHeight: "100vh", background: canvasBackgroundStyle, padding: "24px 0" }}>
      <div style={{ position: "relative", margin: "0 24px 8px" }}>
        <div style={{ width: "100%" }}>
          <Typography.Title
            level={2}
            style={{
              margin: 0,
              textAlign: String(record.canvasConfig?.dashboardTitleAlign || "center") as "left" | "center" | "right",
              color: String(record.canvasConfig?.dashboardTitleColor || resolvedDashboardTheme.canvas.dashboardTitleColor || resolvedDashboardTheme.chrome.titleColor || "#101828"),
              fontSize: Number(record.canvasConfig?.dashboardTitleFontSize || 25),
              fontWeight: Number(record.canvasConfig?.dashboardTitleFontWeight || 700),
            }}
          >
            {record.dashboardName}
          </Typography.Title>
        </div>
        <Button
          icon={<AppstoreOutlined />}
          onClick={() => navigate("/dashboard/reporting/workbench")}
          style={{ position: "absolute", right: 0, top: 0 }}
        >
          返回清单
        </Button>
      </div>
      <div
        className="reporting-runtime-canvas-viewport"
        ref={canvasViewportRef}
        style={{
          position: "relative",
          width: "100%",
          minHeight: canvasMetrics.height * canvasScale,
          overflow: "hidden",
        }}
      >
        <div
          className="reporting-runtime-canvas"
          style={{
            position: "relative",
            width: canvasMetrics.width,
            minHeight: canvasMetrics.height,
            transform: `scale(${canvasScale})`,
            transformOrigin: "top left",
          }}
        >
        {rootWidgets.map((widget) => (
          (() => {
            const chrome = widget.chrome || {};
            return (
          <div
            key={widget.key}
            style={{
              position: "absolute",
              left: Number(widget.position?.x || 0),
              top: Number(widget.position?.y || 0),
              width: Number(widget.position?.w || 520),
              height: Number(widget.position?.h || 320),
            }}
          >
            <Card
              size="small"
              title={chrome.showTitle === false ? null : (chrome.titleText || widget.widgetName)}
              style={{
                width: "100%",
                height: "100%",
                borderColor: String(chrome.borderColor || "#eef2f7"),
                borderWidth: Number(chrome.borderWidth ?? 1),
                borderRadius: Number(chrome.borderRadius ?? 16),
                boxShadow: resolveContainerShadow(String(chrome.shadowPreset || "none")),
                background: buildChromeBackgroundFromStyle({
                  ...chrome,
                } as any),
              }}
              headStyle={{
                textAlign: chrome.titleAlign || "left",
                color: String(chrome.titleColor || "#101828"),
                fontSize: Number(chrome.titleFontSize || 18),
                fontWeight: Number(chrome.titleFontWeight || 700),
              }}
            >
              {renderRuntimeDraftWidget(widget, runtimeWidgets)}
            </Card>
          </div>
            );
          })()
        ))}
        </div>
      </div>
    </div>
  );
}
