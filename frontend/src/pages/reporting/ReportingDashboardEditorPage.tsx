import {
  AreaChartOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  DashboardOutlined,
  DotChartOutlined,
  FunnelPlotOutlined,
  PieChartOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SaveOutlined,
  LineChartOutlined,
  RollbackOutlined,
  SettingOutlined,
  AppstoreOutlined,
  EyeOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Radio,
  Select,
  Slider,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Tabs,
  Typography,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { installEchartsWordCloud, normalizeWordCloudOption } from "./charts/echarts-word-cloud";
import chinaGeoJson from "../../constants/china.geo.json";

installEchartsWordCloud();
import { useAuth } from "../../app/providers/AuthProvider";
import { PageToolbar } from "../../components/ui/PageToolbar";
import {
  allocateReportingAiChartFieldMap,
  createReportingDashboard,
  fetchReportingChartAssets,
  fetchReportingDataSourceSampleRows,
  fetchReportingDashboard,
  fetchReportingDataSourceTables,
  fetchReportingDataSources,
  fetchReportingDatasets,
  fetchReportingThemeTemplates,
  planReportingAiChartSql,
  previewReportingDashboardChart,
  recommendReportingAiChart,
  reviseReportingAiChartSql,
  runReportingAiChartQuery,
  suggestReportingAiChartAnalysis,
  updateReportingDashboard,
} from "../../services/reporting";
import type {
  DataSourceTable,
  ReportingAiAnalysisSuggestion,
  ReportingAiChartRecommendation,
  ReportingAiQueryResponse,
  ReportingAiSqlPlanResponse,
  ReportingChartAssetRecord,
  ReportingDashboardPreview,
  ReportingDataSourceRecord,
  ReportingDatasetRecord,
  ReportingThemeTemplateRecord,
} from "../../types/api";
import { applyResolvedThemeToWidget, backfillMissingComboThemeFields, backfillMissingFunnelThemeFields, backfillMissingGaugeThemeFields, backfillMissingMapThemeFields, backfillMissingScatterThemeFields, backfillMissingWordCloudThemeFields } from "./theme/theme-runtime";
import { buildDefaultDashboardThemeSettings, resolveThemeTemplate } from "./theme/theme-template.resolver";
import type {
  DashboardThemeSettings,
  ThemeTemplateRecord,
  ThemeTemplateCanvas,
} from "./theme/theme-template.types";

type WidgetBindingMode = "dataset" | "sql";
type WidgetType = "chart" | "kpi" | "table" | "tabs" | "richText" | "image";

type WidgetChromeConfig = {
  themeKey?: string | null;
  titleText?: string | null;
  showTitle?: boolean;
  titleAlign?: "left" | "center" | "right";
  titleColor?: string | null;
  titleFontSize?: number | null;
  titleFontWeight?: number | null;
  paddingPreset?: "compact" | "comfortable" | "spacious";
  backgroundType?: "solid" | "gradient" | "image" | string;
  backgroundColor?: string | null;
  backgroundGradient?: string | null;
  backgroundGradientDirection?: string | null;
  backgroundImage?: string | null;
  borderColor?: string | null;
  borderWidth?: number | null;
  borderRadius?: number | null;
  shadowPreset?: "none" | "soft" | "medium";
};

type WidgetChartStyleConfig = {
  palette?: string[] | null;
  palettePreset?: string | null;
  accentColor?: string | null;
  barSeriesLayout?: "single" | "grouped" | "stacked" | "overlap";
  legendPrimaryName?: string | null;
  legendSecondaryName?: string | null;
  barPrimaryColor?: string | null;
  barSecondaryColor?: string | null;
  horizontalBarPalette?: string[] | null;
  horizontalBarColorCount?: 1 | 3 | 5 | null;
  horizontalBarSortOrder?: "desc-top" | "desc-bottom" | "none";
  sankeyNodeWidth?: number | null;
  sankeyNodeGap?: number | null;
  sankeyNodeBorderColor?: string | null;
  sankeyNodeBorderWidth?: number | null;
  sankeyNodeBorderRadius?: number | null;
  sankeyLinkOpacity?: number | null;
  sankeyLinkCurveness?: number | null;
  gaugePointerColor?: string | null;
  gaugeDetailColor?: string | null;
  gaugeTitleColor?: string | null;
  gaugeMetricName?: string | null;
  gaugeAxisLabelColor?: string | null;
  gaugeSplitLineColor?: string | null;
  gaugeStartAngle?: number | null;
  gaugeEndAngle?: number | null;
  gaugeRadius?: string | number | null;
  gaugeProgressWidth?: number | null;
  gaugeAxisLineWidth?: number | null;
  gaugePointerLength?: string | number | null;
  gaugeDetailFontSize?: number | null;
  gaugeDetailFontWeight?: number | null;
  gaugeTitleFontSize?: number | null;
  funnelValueColor?: string | null;
  funnelLabelLineColor?: string | null;
  funnelBlockBorderColor?: string | null;
  funnelBlockBorderWidth?: number | null;
  funnelItemGap?: number | null;
  funnelSortOrder?: "descending" | "ascending" | "none";
  funnelLabelPosition?: "inside" | "outside";
  funnelShowName?: boolean;
  funnelShowValue?: boolean;
  wordCloudShape?: "circle" | "cardioid" | "diamond" | "triangle-forward" | "triangle" | "pentagon" | "star" | string | null;
  wordCloudGridSize?: number | null;
  wordCloudRotationStep?: number | null;
  wordCloudMinFontSize?: number | null;
  wordCloudMaxFontSize?: number | null;
  wordCloudFontWeight?: number | null;
  wordCloudTextShadowColor?: string | null;
  wordCloudTextShadowBlur?: number | null;
  scatterSymbolSize?: number | null;
  scatterPointBorderColor?: string | null;
  scatterPointBorderWidth?: number | null;
  scatterPointOpacity?: number | null;
  scatterLabelPosition?: "top" | "bottom" | "left" | "right" | "inside";
  barGap?: string | null;
  barCategoryGap?: string | null;
  barSeriesOverlap?: number | null;
  barCategoryGapPercent?: number | null;
  barBorderRadius?: number | null;
  barValuePosition?: "inside" | "top";
  lineWidth?: number | null;
  lineSmooth?: boolean;
  lineShowSymbol?: boolean;
  lineSymbolSize?: number | null;
  lineAreaOpacity?: number | null;
  lineLabelPosition?: "top" | "bottom" | "left" | "right" | "inside";
  radarCenterX?: string | null;
  radarCenterY?: string | null;
  radarRadius?: string | number | null;
  radarShape?: "polygon" | "circle";
  radarSplitNumber?: number | null;
  radarShowSplitArea?: boolean;
  radarAreaOpacity?: number | null;
  radarLayout?: "single" | "dual";
  radarPrimaryColor?: string | null;
  radarSecondaryColor?: string | null;
  mapRegionPalette?: string[] | null;
  mapRegionBorderColor?: string | null;
  mapLabelColor?: string | null;
  mapVisualMapTextColor?: string | null;
  extremaMaxColor?: string | null;
  extremaMinColor?: string | null;
  showXAxis?: boolean;
  showYAxis?: boolean;
  xAxisUnitLabel?: string | null;
  yAxisUnitLabel?: string | null;
  axisLabelColor?: string | null;
  axisLabelFontSize?: number | null;
  axisLabelFontWeight?: number | null;
  legendTextColor?: string | null;
  legendFontSize?: number | null;
  legendFontWeight?: number | null;
  legendPosition?: "top" | "right" | "bottom" | "left";
  showLegend?: boolean;
  showAxis?: boolean;
  showLabels?: boolean;
  showGridLines?: boolean;
  dataLabelColor?: string | null;
  dataLabelFontSize?: number | null;
  dataLabelFontWeight?: number | null;
  pieVariant?: "classic-pie" | "classic-donut" | "rose" | "half-donut" | "nested";
  pieTheme?: "business" | "minimal" | "dark-screen" | "glass" | "neon-contrast" | "warm-metal" | "morandi";
  pieInnerRadius?: number | null;
  pieOuterRadius?: number | null;
  pieStartAngle?: number | null;
  pieSweepAngle?: number | null;
  pieMinAngle?: number | null;
  pieRoseMode?: "off" | "radius" | "area";
  pieLabelMode?: "outside" | "inside" | "center" | "hidden";
  pieShowCategory?: boolean;
  pieShowPercent?: boolean;
  pieShowValue?: boolean;
  pieValueFormat?: "number" | "percent";
  pieLabelColor?: string | null;
  pieValueColor?: string | null;
  pieLabelFontSize?: number | null;
  pieValueFontSize?: number | null;
  pieLabelFontWeight?: number | null;
  pieValueFontWeight?: number | null;
  pieLabelLineShow?: boolean;
  pieLabelLineColor?: string | null;
  pieLabelLineWidth?: number | null;
  pieLabelLineLength?: number | null;
  pieLabelLineLength2?: number | null;
  pieShowCenter?: boolean;
  pieCenterTitle?: string | null;
  pieCenterValue?: string | null;
  pieCenterUnit?: string | null;
  pieCenterSubtitle?: string | null;
  pieCenterTitleColor?: string | null;
  pieCenterValueColor?: string | null;
  pieCenterUnitColor?: string | null;
  pieCenterMetaColor?: string | null;
  pieCenterTitleFontSize?: number | null;
  pieCenterValueFontSize?: number | null;
  pieCenterUnitFontSize?: number | null;
  pieCenterMetaFontSize?: number | null;
  pieSliceGap?: number | null;
  pieBorderRadius?: number | null;
  pieBorderWidth?: number | null;
  pieBorderColor?: string | null;
  pieSortOrder?: "desc" | "asc" | "none";
  pieMaxSlices?: number | null;
  pieMergeOthers?: boolean;
  pieOthersName?: string | null;
  pieLegendPosition?: "top" | "right" | "bottom" | "left";
  pieLegendShowValue?: boolean;
  pieLegendShowPercent?: boolean;
  pieHoverScale?: boolean;
  pieSelectedOffset?: number | null;
  pieShadowBlur?: number | null;
  pieShadowColor?: string | null;
};

type WidgetMapStyleConfig = {
  provinceCode?: string | null;
  center?: [number, number] | null;
  zoom?: number | null;
};

type WidgetChartAnalysisConfig = {
  showExtrema?: boolean;
};

type WidgetKpiConfig = {
  mode?: "number" | "flipper" | "progress";
  layout?: "vertical" | "horizontal";
  valuePrefix?: string | null;
  valueSuffix?: string | null;
  decimals?: number | null;
  compareLabel?: string | null;
  primaryValue?: string | number | null;
  compareValue?: string | number | null;
  formattedValue?: string | null;
  trendPercent?: number | null;
  label?: string | null;
};

type WidgetKpiStyleConfig = {
  themeKey?: string | null;
  themeMode?: "all" | "number" | "flipper" | "progress";
  itemSize?: "small" | "medium" | "large";
  multiValueLayout?: "verticalList" | "horizontalList" | "grid";
  contentOrientation?: "vertical" | "horizontal";
  itemsPerRow?: number | null;
  itemsPerColumn?: number | null;
  itemMinWidth?: number | null;
  showDivider?: boolean;
  dividerStyle?: "solid" | "dashed" | "dotted" | "double" | "soft-band" | "glow-band" | "icon-center" | "short-axis" | "corner-badge";
  dividerWidth?: number | null;
  dividerColor?: string | null;
  itemGap?: number | null;
  itemAlign?: "left" | "center" | "right";
  itemBackgroundColor?: string | null;
  itemBorderColor?: string | null;
  itemBorderWidth?: number | null;
  itemBorderRadius?: number | null;
  flipperBackground?: string | null;
  flipperBackgroundType?: "solid" | "gradient" | "image" | string;
  flipperBackgroundColor?: string | null;
  flipperBackgroundGradient?: string | null;
  flipperBackgroundDirection?: string | null;
  flipperBackgroundImage?: string | null;
  flipperRefreshSeconds?: number | null;
  flipperGap?: number | null;
  flipperDigitWidth?: number | null;
  flipperDigitHeight?: number | null;
  flipperDigitRadius?: number | null;
  progressTrackColor?: string | null;
  progressFillColor?: string | null;
  hoverElevated?: boolean;
  trendColorMode?: "auto" | "fixed";
  showValue?: boolean;
  valueColor?: string | null;
  valueFontSize?: number | null;
  valueFontWeight?: number | null;
  valuePrefixColor?: string | null;
  valuePrefixFontSize?: number | null;
  valueSuffixColor?: string | null;
  valueSuffixFontSize?: number | null;
  showMetricLabel?: boolean;
  metricLabelColor?: string | null;
  metricLabelFontSize?: number | null;
  metricLabelFontWeight?: number | null;
  compareLabelColor?: string | null;
  compareLabelFontSize?: number | null;
  compareLabelFontWeight?: number | null;
};

type KpiThemeCategory = "light" | "dark" | "blue" | "green" | "warm" | "purple";

type WidgetKpiAnalysisConfig = {
  showTrend?: boolean;
};

type WidgetTableConfig = {
  pageSize?: number | null;
};

type WidgetTableStyleConfig = {
  compact?: boolean;
  striped?: boolean;
  showIndex?: boolean;
  headerBackground?: string | null;
  headerTextColor?: string | null;
  rowBackground?: string | null;
  rowAlternateBackground?: string | null;
  rowBorderColor?: string | null;
};

type WidgetTabsItemConfig = {
  key: string;
  title: string;
  childWidgetKey?: string | null;
};

type WidgetTabsConfig = {
  defaultActiveKey?: string | null;
  items: WidgetTabsItemConfig[];
};

type WidgetTabsStyleConfig = {
  tabBarBackgroundColor?: string | null;
  activeTextColor?: string | null;
  inactiveTextColor?: string | null;
  activeBackground?: string | null;
  indicatorColor?: string | null;
};

type WidgetRichTextConfig = {
  content?: string | null;
};

type WidgetRichTextStyleConfig = {
  fontSize?: number | null;
  fontWeight?: number | null;
  color?: string | null;
  align?: "left" | "center" | "right";
};

type WidgetImageConfig = {
  imageUrl?: string | null;
};

type WidgetImageStyleConfig = {
  objectFit?: "contain" | "cover" | "fill";
  borderRadius?: number | null;
};

type WidgetKpiPreviewModel = NonNullable<ReportingDashboardPreview["kpi"]>;

export type CanvasWidgetDraft = {
  key: string;
  widgetName: string;
  widgetType: WidgetType;
  inheritDashboardTheme: boolean;
  widgetThemeTemplateId?: number | null;
  widgetThemeOverrides?: Record<string, unknown>;
  chartAssetId?: number | null;
  chartFamily?: string | null;
  variantName?: string | null;
  accentColor?: string | null;
  palettePreset?: string | null;
  chrome?: WidgetChromeConfig;
  chartStyle?: WidgetChartStyleConfig;
  mapStyle?: WidgetMapStyleConfig;
  chartAnalysis?: WidgetChartAnalysisConfig;
  kpi?: WidgetKpiConfig;
  kpiStyle?: WidgetKpiStyleConfig;
  kpiAnalysis?: WidgetKpiAnalysisConfig;
  table?: WidgetTableConfig;
  tableStyle?: WidgetTableStyleConfig;
  tabs?: WidgetTabsConfig;
  tabsStyle?: WidgetTabsStyleConfig;
  richText?: WidgetRichTextConfig;
  richTextStyle?: WidgetRichTextStyleConfig;
  image?: WidgetImageConfig;
  imageStyle?: WidgetImageStyleConfig;
  bindingMode: WidgetBindingMode;
  datasetId?: number | null;
  sourceId?: number | null;
  sourceTable?: string | null;
  sourceSql?: string | null;
  fieldMap?: Record<string, string>;
  fields?: Array<{ columnName: string; label?: string; dataType?: string }>;
  preview?: ReportingDashboardPreview | null;
  containerParentKey?: string | null;
  containerTabKey?: string | null;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

type ChartLayoutBox = {
  width: number;
  height: number;
};

function resolveWidgetChartLayoutBox(widget: CanvasWidgetDraft, contentHeight?: number): ChartLayoutBox {
  const width = Math.max(160, Number(widget.position?.w || 0) || 160);
  const fallbackHeight = Number(widget.position?.h || 0) || 0;
  const titleOffset = widget.chrome?.showTitle === false ? 24 : 62;
  const height = typeof contentHeight === "number" && Number.isFinite(contentHeight)
    ? contentHeight
    : Math.max(120, fallbackHeight > 0 ? fallbackHeight - titleOffset : 120);
  return {
    width,
    height: Math.max(120, height),
  };
}

type DragState = {
  key: string;
  mode:
    | "move"
    | "resize-right"
    | "resize-bottom"
    | "resize-corner-se"
    | "resize-corner-sw"
    | "resize-corner-ne"
    | "resize-corner-nw";
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialW: number;
  initialH: number;
};

type LibraryDragPayload =
  | { kind: "component"; componentType: ComponentLibraryKey }
  | { kind: "asset"; assetId: number };

type WidgetDragPayload = {
  kind: "widget";
  widgetKey: string;
};

type ActiveDragPayload =
  | { kind: "library"; payload: LibraryDragPayload }
  | { kind: "widget"; widgetKey: string };

type AiChartAssistantState = {
  sourceId?: number | null;
  activeTab: "analysis" | "sql";
  prompt: string;
  analysisDirection: string;
  analysisSuggestions: ReportingAiAnalysisSuggestion[];
  selectedAnalysisSuggestionKey: string | null;
  analysisSuggestionPage: number;
  selectedTables: string[];
  previewTableName?: string | null;
  tablePreviewRows: Array<Record<string, unknown>>;
  tablePreviewColumns: Array<{ key: string; title: string; dataIndex: string }>;
  sourceSql: string;
  plan: ReportingAiSqlPlanResponse | null;
  query: ReportingAiQueryResponse | null;
  lastQueryError?: string | null;
  recommendations: ReportingAiChartRecommendation[];
  selectedRecommendationKey: string | null;
  preview: ReportingDashboardPreview | null;
  tables: DataSourceTable[];
  editedFieldMap: Record<string, string>;
  revisionInstruction: string;
  autoPreview: boolean;
};

type PanelDragState = {
  startX: number;
  startY: number;
  initialRight: number;
  initialTop: number;
};

type CanvasBackgroundFormType = "solid" | "gradient" | "image";

type PrimaryChartFamilyKey =
  | "wordCloud"
  | "bar"
  | "horizontalBar"
  | "line"
  | "area"
  | "pie"
  | "radar"
  | "combo"
  | "scatterBubble"
  | "heatmap"
  | "map"
  | "treemap"
  | "sankey"
  | "gauge"
  | "funnel";

type ComponentLibraryKey = "kpi" | "table" | "tabs" | "richText" | "image";

const LIBRARY_PANEL_WIDTH = 340;
const CONFIG_PANEL_WIDTH = 460;
const PANEL_GAP = 12;
const AI_ANALYSIS_SUGGESTION_PAGE_SIZE = 2;
const DEFAULT_GRID_LAYOUT_GAP = 10;
const MIN_GRID_LAYOUT_GAP = 4;
const MAX_GRID_LAYOUT_GAP = 80;
const SNAP_GRID = DEFAULT_GRID_LAYOUT_GAP;
const GRID_LAYOUT_SNAP = DEFAULT_GRID_LAYOUT_GAP;
const FREE_LAYOUT_SNAP = 1;
const AUTO_PREVIEW_DEBOUNCE_MS = 700;
const CANVAS_EDGE_LEFT = 304;
const DEFAULT_WIDGET_GAP = 20;
const COLLISION_INTRUSION_RATIO = 0.2;
const COLLISION_AXIS_INTRUSION_RATIO = 0.35;
const GRID_BACKGROUND = [
  "linear-gradient(rgba(22,119,255,0.12) 1px, transparent 1px)",
  "linear-gradient(90deg, rgba(22,119,255,0.12) 1px, transparent 1px)",
].join(", ");
const KPI_ITEM_PADDING_Y = 18;
const KPI_ITEM_PADDING_X = 12;
const DEFAULT_MIN_WIDGET_WIDTH = 280;
const DEFAULT_MIN_WIDGET_HEIGHT = 120;

const THEME_CHROME_KEYS: Array<keyof WidgetChromeConfig> = [
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "shadowPreset",
  "titleColor",
];

const THEME_KPI_STYLE_KEYS: Array<keyof WidgetKpiStyleConfig> = [
  "itemBackgroundColor",
  "itemBorderColor",
  "itemBorderWidth",
  "itemBorderRadius",
  "dividerColor",
  "dividerStyle",
  "flipperBackground",
  "flipperDigitRadius",
  "valueColor",
  "valuePrefixColor",
  "valueSuffixColor",
  "metricLabelColor",
  "compareLabelColor",
  "hoverElevated",
  "trendColorMode",
];

const KPI_THEME_TEMPLATES: Array<{
  key: string;
  label: string;
  category: KpiThemeCategory;
  chrome: Partial<WidgetChromeConfig>;
  kpiStyle: Partial<WidgetKpiStyleConfig>;
  modePresets?: Partial<Record<NonNullable<WidgetKpiConfig["mode"]>, Partial<WidgetKpiStyleConfig>>>;
}> = [
  {
    key: "clean-card",
    label: "留白经典",
    category: "light",
    chrome: {
      backgroundColor: "#ffffff",
      borderColor: "#dce6f5",
      borderWidth: 1,
      borderRadius: 16,
      shadowPreset: "none",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "clean-card",
      itemSize: "medium",
      multiValueLayout: "verticalList",
      itemsPerRow: 1,
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "#e5e7eb",
      itemGap: 16,
      itemAlign: "left",
      itemBackgroundColor: "#ffffff",
      itemBorderColor: "#e5e7eb",
      itemBorderWidth: 0,
      itemBorderRadius: 12,
    },
  },
  {
    key: "soft-panel",
    label: "柔光卡片",
    category: "light",
    chrome: {
      backgroundColor: "#f8fbff",
      borderColor: "#c7d7f2",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "soft-panel",
      itemSize: "medium",
      multiValueLayout: "grid",
      itemsPerRow: 3,
      showDivider: false,
      itemGap: 16,
      itemAlign: "center",
      itemBackgroundColor: "#ffffff",
      itemBorderColor: "#dbe5f3",
      itemBorderWidth: 1,
      itemBorderRadius: 14,
      hoverElevated: true,
    },
  },
  {
    key: "highlight-frame",
    label: "亮边框",
    category: "blue",
    chrome: {
      backgroundColor: "#ffffff",
      borderColor: "#6ea8ff",
      borderWidth: 2,
      borderRadius: 18,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "highlight-frame",
      itemSize: "medium",
      showDivider: false,
      itemGap: 16,
      itemBackgroundColor: "#ffffff",
      itemBorderColor: "#bfdbfe",
      itemBorderWidth: 1,
      itemBorderRadius: 16,
      valueColor: "#2563eb",
      valuePrefixColor: "#1d4ed8",
      valueSuffixColor: "#1d4ed8",
      compareLabelColor: "#2563eb",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #12305f 0%, #1d4ed8 100%)",
        flipperDigitWidth: 56,
        flipperDigitHeight: 52,
        flipperDigitRadius: 10,
        flipperGap: 6,
      },
    },
  },
  {
    key: "mist-card",
    label: "柔光卡片",
    category: "light",
    chrome: {
      backgroundColor: "#f4f7fb",
      borderColor: "#d7e2f2",
      borderWidth: 1,
      borderRadius: 18,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "mist-card",
      itemSize: "small",
      multiValueLayout: "grid",
      itemsPerRow: 3,
      itemGap: 18,
      itemAlign: "center",
      itemBackgroundColor: "#f8fafc",
      itemBorderColor: "#cbd5e1",
      itemBorderWidth: 0,
      itemBorderRadius: 12,
      valueColor: "#2563eb",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
      },
    },
  },
  {
    key: "midnight-panel",
    label: "深海面板",
    category: "dark",
    chrome: {
      backgroundColor: "#0b1220",
      borderColor: "#243247",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "medium",
      paddingPreset: "comfortable",
      titleColor: "#e5eefc",
    },
    kpiStyle: {
      themeKey: "midnight-panel",
      showDivider: false,
      itemGap: 20,
      itemBackgroundColor: "#111c2f",
      itemBorderColor: "#26354b",
      itemBorderWidth: 1,
      itemBorderRadius: 18,
      valueColor: "#f8fbff",
      valuePrefixColor: "#cfe3ff",
      valueSuffixColor: "#cfe3ff",
      metricLabelColor: "#94a8c6",
      compareLabelColor: "#5eead4",
      trendColorMode: "fixed",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #111c2f 0%, #1f3048 100%)",
      },
      progress: {
        itemBackgroundColor: "#111c2f",
        itemBorderColor: "#26354b",
        itemBorderWidth: 1,
        itemBorderRadius: 16,
        valueColor: "#f8fbff",
        metricLabelColor: "#94a8c6",
        compareLabelColor: "#5eead4",
        trendColorMode: "fixed",
      },
    },
  },
  {
    key: "obsidian-glow",
    label: "石墨光泽",
    category: "dark",
    chrome: {
      backgroundColor: "#0a0f1a",
      borderColor: "#2c3b52",
      borderWidth: 1,
      borderRadius: 22,
      shadowPreset: "medium",
      paddingPreset: "spacious",
      titleColor: "#eef4ff",
    },
    kpiStyle: {
      themeKey: "obsidian-glow",
      showDivider: false,
      itemGap: 18,
      itemBackgroundColor: "linear-gradient(180deg, rgba(18,28,45,0.96) 0%, rgba(10,15,26,0.98) 100%)",
      itemBorderColor: "#32445f",
      itemBorderWidth: 1,
      itemBorderRadius: 18,
      valueColor: "#f5f9ff",
      valuePrefixColor: "#dbeafe",
      valueSuffixColor: "#dbeafe",
      metricLabelColor: "#98a9c2",
      compareLabelColor: "#7dd3fc",
      trendColorMode: "fixed",
      hoverElevated: true,
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #162133 0%, #0c1320 100%)",
      },
      progress: {
        trendColorMode: "fixed",
      },
    },
  },
  {
    key: "aurora-night",
    label: "冷辉夜色",
    category: "dark",
    chrome: {
      backgroundColor: "#07131b",
      borderColor: "#1d3d48",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "medium",
      paddingPreset: "comfortable",
      titleColor: "#e7fbff",
    },
    kpiStyle: {
      themeKey: "aurora-night",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "rgba(84, 214, 214, 0.18)",
      itemGap: 18,
      itemBackgroundColor: "#0d1f28",
      itemBorderColor: "#1f4f5a",
      itemBorderWidth: 1,
      itemBorderRadius: 18,
      valueColor: "#7df9ff",
      valuePrefixColor: "#b6fbff",
      valueSuffixColor: "#b6fbff",
      metricLabelColor: "#9cc9d0",
      compareLabelColor: "#67e8f9",
      trendColorMode: "fixed",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #12303a 0%, #07131b 100%)",
      },
    },
  },
  {
    key: "warm-paper",
    label: "暖米经营",
    category: "warm",
    chrome: {
      backgroundColor: "#fff7ed",
      borderColor: "#e7cba3",
      borderWidth: 1,
      borderRadius: 16,
      shadowPreset: "none",
      paddingPreset: "comfortable",
      titleColor: "#654321",
    },
    kpiStyle: {
      themeKey: "warm-paper",
      itemSize: "medium",
      multiValueLayout: "horizontalList",
      itemsPerRow: 4,
      itemAlign: "center",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "#e5c69a",
      itemGap: 16,
      itemBackgroundColor: "#fff0d9",
      itemBorderColor: "#e7cba3",
      itemBorderWidth: 0,
      itemBorderRadius: 14,
      valueColor: "#9a4f12",
      valuePrefixColor: "#9a4f12",
      valueSuffixColor: "#9a4f12",
      metricLabelColor: "#765334",
      compareLabelColor: "#b8651b",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #78350f 0%, #451a03 100%)",
        flipperDigitWidth: 62,
        flipperDigitHeight: 54,
        flipperDigitRadius: 12,
      },
      progress: {
        compareLabelColor: "#b8651b",
        trendColorMode: "fixed",
      },
    },
  },
  {
    key: "emerald-card",
    label: "青绿经营",
    category: "green",
    chrome: {
      backgroundColor: "#f3fbf8",
      borderColor: "#7fd1b9",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "emerald-card",
      itemSize: "small",
      multiValueLayout: "grid",
      itemsPerRow: 3,
      itemGap: 16,
      itemAlign: "center",
      itemBackgroundColor: "#effcf6",
      itemBorderColor: "#6ee7b7",
      itemBorderWidth: 1,
      itemBorderRadius: 14,
      valueColor: "#059669",
      valuePrefixColor: "#047857",
      valueSuffixColor: "#047857",
      compareLabelColor: "#059669",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #14532d 0%, #052e16 100%)",
        flipperDigitWidth: 60,
        flipperDigitHeight: 56,
      },
      progress: {
        trendColorMode: "fixed",
      },
    },
  },
  {
    key: "forest-report",
    label: "松石分析",
    category: "green",
    chrome: {
      backgroundColor: "#eff8f2",
      borderColor: "#72b68b",
      borderWidth: 1,
      borderRadius: 18,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "forest-report",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "#c9e4d2",
      itemGap: 16,
      itemBackgroundColor: "#f8fcf9",
      itemBorderColor: "#b7d9c1",
      itemBorderWidth: 1,
      itemBorderRadius: 14,
      valueColor: "#166534",
      valuePrefixColor: "#14532d",
      valueSuffixColor: "#14532d",
      metricLabelColor: "#486b57",
      compareLabelColor: "#15803d",
      trendColorMode: "fixed",
    },
  },
  {
    key: "coral-panel",
    label: "暖米经营",
    category: "warm",
    chrome: {
      backgroundColor: "#fff8f5",
      borderColor: "#e7c7b8",
      borderWidth: 1,
      borderRadius: 18,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
      titleColor: "#7b5b49",
    },
    kpiStyle: {
      themeKey: "coral-panel",
      itemSize: "small",
      multiValueLayout: "grid",
      itemsPerRow: 3,
      itemGap: 18,
      itemAlign: "left",
      itemBackgroundColor: "#fffdfb",
      itemBorderColor: "#edd6cc",
      itemBorderWidth: 1,
      itemBorderRadius: 16,
      valueColor: "#9a5b37",
      valuePrefixColor: "#b07a56",
      valueSuffixColor: "#b07a56",
      metricLabelColor: "#8f6a52",
      compareLabelColor: "#a06741",
      trendColorMode: "fixed",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #8a6242 0%, #5f432d 100%)",
        flipperDigitWidth: 62,
        flipperDigitHeight: 54,
      },
    },
  },
  {
    key: "slate-card",
    label: "石板分栏",
    category: "light",
    chrome: {
      backgroundColor: "#f8fafc",
      borderColor: "#94a3b8",
      borderWidth: 2,
      borderRadius: 14,
      shadowPreset: "none",
      paddingPreset: "compact",
    },
    kpiStyle: {
      themeKey: "slate-card",
      itemSize: "large",
      multiValueLayout: "verticalList",
      itemsPerRow: 1,
      showDivider: true,
      dividerStyle: "dashed",
      dividerColor: "#94a3b8",
      itemGap: 16,
      itemAlign: "left",
      itemBackgroundColor: "#f8fafc",
      itemBorderColor: "#cbd5e1",
      itemBorderWidth: 0,
      itemBorderRadius: 0,
    },
  },
  {
    key: "neon-frame",
    label: "冷青描边",
    category: "blue",
    chrome: {
      backgroundColor: "#08111f",
      borderColor: "#2fe3ff",
      borderWidth: 2,
      borderRadius: 18,
      shadowPreset: "medium",
      paddingPreset: "spacious",
      titleColor: "#d8fbff",
    },
    kpiStyle: {
      themeKey: "neon-frame",
      itemSize: "small",
      multiValueLayout: "grid",
      itemsPerRow: 3,
      itemGap: 18,
      itemAlign: "center",
      itemBackgroundColor: "#eef8ff",
      itemBorderColor: "#7dd3fc",
      itemBorderWidth: 0,
      itemBorderRadius: 14,
      valueColor: "#0ea5e9",
      valuePrefixColor: "#67e8f9",
      valueSuffixColor: "#67e8f9",
      compareLabelColor: "#2dd4bf",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #082f49 0%, #0f172a 100%)",
      },
      progress: {
        trendColorMode: "fixed",
      },
    },
  },
  {
    key: "glass-minimal",
    label: "透白极简",
    category: "blue",
    chrome: {
      backgroundColor: "#fbfdff",
      borderColor: "#dbe9ff",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "soft",
      paddingPreset: "spacious",
    },
    kpiStyle: {
      themeKey: "glass-minimal",
      itemSize: "medium",
      itemGap: 20,
      itemBackgroundColor: "rgba(255,255,255,0.72)",
      itemBorderColor: "#edf4ff",
      itemBorderWidth: 1,
      itemBorderRadius: 20,
      hoverElevated: true,
      valueColor: "#2563eb",
      valuePrefixColor: "#3b82f6",
      valueSuffixColor: "#3b82f6",
      compareLabelColor: "#2563eb",
    },
  },
  {
    key: "violet-glow",
    label: "冷紫分析",
    category: "purple",
    chrome: {
      backgroundColor: "#f7f4ff",
      borderColor: "#b7a2ff",
      borderWidth: 2,
      borderRadius: 18,
      shadowPreset: "medium",
      paddingPreset: "spacious",
      titleColor: "#4c1d95",
    },
    kpiStyle: {
      themeKey: "violet-glow",
      itemSize: "medium",
      multiValueLayout: "grid",
      itemsPerRow: 2,
      itemGap: 20,
      itemAlign: "center",
      itemBackgroundColor: "#f1ebff",
      itemBorderColor: "#c4b5fd",
      itemBorderWidth: 1,
      itemBorderRadius: 16,
      dividerColor: "#d8ccff",
      valueColor: "#6d28d9",
      valuePrefixColor: "#6d28d9",
      valueSuffixColor: "#6d28d9",
      metricLabelColor: "#6b5a91",
      compareLabelColor: "#8b5cf6",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #6d28d9 0%, #2e1065 100%)",
      },
      progress: {
        trendColorMode: "fixed",
      },
    },
  },
  {
    key: "plum-night",
    label: "深紫夜色",
    category: "purple",
    chrome: {
      backgroundColor: "#171222",
      borderColor: "#4c3c68",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "medium",
      paddingPreset: "comfortable",
      titleColor: "#f3ebff",
    },
    kpiStyle: {
      themeKey: "plum-night",
      showDivider: false,
      itemGap: 18,
      itemBackgroundColor: "#20192d",
      itemBorderColor: "#574071",
      itemBorderWidth: 1,
      itemBorderRadius: 18,
      valueColor: "#f5edff",
      valuePrefixColor: "#ddd6fe",
      valueSuffixColor: "#ddd6fe",
      metricLabelColor: "#c7badb",
      compareLabelColor: "#c084fc",
      trendColorMode: "fixed",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #312e81 0%, #1b1431 100%)",
      },
    },
  },
  {
    key: "number-banner",
    label: "留白经典",
    category: "light",
    chrome: {
      backgroundColor: "#ffffff",
      borderColor: "#dbe5f3",
      borderWidth: 1,
      borderRadius: 16,
      shadowPreset: "none",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "number-banner",
      itemSize: "large",
      multiValueLayout: "horizontalList",
      itemsPerRow: 4,
      itemAlign: "center",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "#dbe5f3",
      itemBackgroundColor: "#ffffff",
      itemBorderWidth: 0,
      hoverElevated: false,
      valueColor: "#1d4ed8",
      valuePrefixColor: "#1d4ed8",
      valueSuffixColor: "#1d4ed8",
    },
  },
  {
    key: "progress-focus",
    label: "留白进度",
    category: "light",
    chrome: {
      backgroundColor: "#ffffff",
      borderColor: "#dbe5f3",
      borderWidth: 1,
      borderRadius: 16,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
    },
    kpiStyle: {
      themeKey: "progress-focus",
      itemSize: "medium",
      multiValueLayout: "verticalList",
      itemBackgroundColor: "#f8fafc",
      itemBorderColor: "#dbe5f3",
      itemBorderWidth: 1,
      itemBorderRadius: 16,
      valueColor: "#2563eb",
      valuePrefixColor: "#2563eb",
      valueSuffixColor: "#2563eb",
      compareLabelColor: "#2563eb",
    },
    modePresets: {
      progress: {
        trendColorMode: "fixed",
      },
    },
  },
  {
    key: "executive-ink",
    label: "墨金层次",
    category: "dark",
    chrome: {
      backgroundColor: "#121212",
      borderColor: "#3d3426",
      borderWidth: 1,
      borderRadius: 22,
      shadowPreset: "medium",
      paddingPreset: "spacious",
      titleColor: "#f4e7bf",
    },
    kpiStyle: {
      themeKey: "executive-ink",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "rgba(214, 180, 86, 0.22)",
      itemGap: 18,
      itemBackgroundColor: "#181818",
      itemBorderColor: "#4a3f2f",
      itemBorderWidth: 1,
      itemBorderRadius: 18,
      valueColor: "#f3d37a",
      valuePrefixColor: "#f6e0a6",
      valueSuffixColor: "#f6e0a6",
      metricLabelColor: "#b8aa84",
      compareLabelColor: "#e9c46a",
      trendColorMode: "fixed",
    },
    modePresets: {
      flipper: {
        flipperBackground: "linear-gradient(180deg, #2b2115 0%, #15110d 100%)",
      },
    },
  },
  {
    key: "boardroom-silver",
    label: "银灰专业",
    category: "light",
    chrome: {
      backgroundColor: "#f7f8fa",
      borderColor: "#cfd5dd",
      borderWidth: 1,
      borderRadius: 18,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
      titleColor: "#344054",
    },
    kpiStyle: {
      themeKey: "boardroom-silver",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "#d7dde5",
      itemGap: 16,
      itemBackgroundColor: "#ffffff",
      itemBorderColor: "#dde3ea",
      itemBorderWidth: 1,
      itemBorderRadius: 14,
      valueColor: "#111827",
      valuePrefixColor: "#4b5563",
      valueSuffixColor: "#4b5563",
      metricLabelColor: "#667085",
      compareLabelColor: "#475467",
      trendColorMode: "fixed",
      hoverElevated: false,
    },
  },
  {
    key: "capital-blueprint",
    label: "深蓝图层",
    category: "blue",
    chrome: {
      backgroundColor: "#edf4ff",
      borderColor: "#9fbbe4",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
      titleColor: "#173b68",
    },
    kpiStyle: {
      themeKey: "capital-blueprint",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "#b8cdf0",
      itemGap: 18,
      itemBackgroundColor: "#f4f8ff",
      itemBorderColor: "#c7d9f4",
      itemBorderWidth: 1,
      itemBorderRadius: 16,
      valueColor: "#1d4f91",
      valuePrefixColor: "#365f96",
      valueSuffixColor: "#365f96",
      metricLabelColor: "#587497",
      compareLabelColor: "#2f68b2",
      trendColorMode: "fixed",
    },
  },
  {
    key: "private-banking",
    label: "米棕汇报",
    category: "warm",
    chrome: {
      backgroundColor: "#fbf8f2",
      borderColor: "#d7c8ae",
      borderWidth: 1,
      borderRadius: 20,
      shadowPreset: "soft",
      paddingPreset: "comfortable",
      titleColor: "#5b4630",
    },
    kpiStyle: {
      themeKey: "private-banking",
      showDivider: true,
      dividerStyle: "solid",
      dividerColor: "#e6dccb",
      itemGap: 16,
      itemBackgroundColor: "#fffdf9",
      itemBorderColor: "#e8decd",
      itemBorderWidth: 1,
      itemBorderRadius: 16,
      valueColor: "#7b5a34",
      valuePrefixColor: "#9a7750",
      valueSuffixColor: "#9a7750",
      metricLabelColor: "#8c745a",
      compareLabelColor: "#a06b2c",
      trendColorMode: "fixed",
    },
  },
];

const KPI_THEME_CATEGORY_LABELS: Record<KpiThemeCategory, string> = {
  light: "中性色",
  dark: "深色系",
  blue: "蓝青系",
  green: "青绿系",
  warm: "暖米系",
  purple: "冷紫系",
};

const PRIMARY_CHART_FAMILIES: Array<{ key: PrimaryChartFamilyKey; label: string }> = [
  { key: "wordCloud", label: "词云图" },
  { key: "bar", label: "柱形图" },
  { key: "horizontalBar", label: "条形图" },
  { key: "line", label: "折线图" },
  { key: "area", label: "面积图" },
  { key: "pie", label: "饼图" },
  { key: "radar", label: "雷达图" },
  { key: "combo", label: "组合图" },
  { key: "scatterBubble", label: "散点气泡图" },
  { key: "heatmap", label: "热力图" },
  { key: "map", label: "中国地图" },
  { key: "treemap", label: "树图" },
  { key: "sankey", label: "桑基图" },
  { key: "gauge", label: "仪表盘" },
  { key: "funnel", label: "漏斗图" },
];

const COMPONENT_LIBRARY: Array<{ key: ComponentLibraryKey; label: string; description: string }> = [
  { key: "kpi", label: "指标看板", description: "数字卡、翻牌器、进度 KPI" },
  { key: "table", label: "子表", description: "明细表、排行榜、交叉信息" },
  { key: "tabs", label: "窗口切换", description: "在一块区域切换指标页签" },
  { key: "richText", label: "富文本", description: "标题、说明、HTML 文本内容" },
  { key: "image", label: "图片", description: "上传图片、封面、装饰图层" },
];

const CANVAS_RATIO_OPTIONS = [
  { value: "16:9", label: "宽屏 16:9", ratio: 16 / 9 },
  { value: "4:3", label: "标准 4:3", ratio: 4 / 3 },
  { value: "1:1", label: "方形 1:1", ratio: 1 },
  { value: "21:9", label: "超宽 21:9", ratio: 21 / 9 },
  { value: "9:16", label: "竖屏 9:16", ratio: 9 / 16 },
];

function buildDefaultWidgetPosition(index: number) {
  return {
    x: 80 + (index % 3) * 560,
    y: 80 + Math.floor(index / 3) * 360,
    w: 520,
    h: 320,
  };
}

function getAssetIcon(asset: ReportingChartAssetRecord) {
  const code = asset.chartCode;
  if (code.includes("gauge")) return <AppstoreOutlined />;
  if (code.includes("map") || code.includes("china")) return <AppstoreOutlined />;
  if (code.includes("wordcloud") || code.includes("word_cloud") || code.includes("word-cloud")) return <BgColorsOutlined />;
  if (code.includes("line")) return <LineChartOutlined />;
  if (code.includes("area")) return <AreaChartOutlined />;
  if (code.includes("pie") || code.includes("rose")) return <PieChartOutlined />;
  if (code.includes("scatter")) return <DotChartOutlined />;
  if (code.includes("radar")) return <RadarChartOutlined />;
  if (code.includes("funnel")) return <FunnelPlotOutlined />;
  return <BarChartOutlined />;
}

function getPrimaryFamilyIcon(family: PrimaryChartFamilyKey) {
  if (family === "wordCloud") return <BgColorsOutlined />;
  if (family === "line") return <LineChartOutlined />;
  if (family === "area") return <AreaChartOutlined />;
  if (family === "pie") return <PieChartOutlined />;
  if (family === "scatterBubble") return <DotChartOutlined />;
  if (family === "radar") return <RadarChartOutlined />;
  if (family === "funnel") return <FunnelPlotOutlined />;
  if (family === "gauge") return <DashboardOutlined />;
  if (family === "heatmap") return <BgColorsOutlined />;
  if (family === "map") return <AppstoreOutlined />;
  return <BarChartOutlined />;
}

function getPrimaryChartFamily(asset?: ReportingChartAssetRecord | null): PrimaryChartFamilyKey | null {
  if (!asset) return null;
  const code = String(asset.chartCode || "").toLowerCase();
  const family = String(asset.chartFamily || asset.config?.chartFamily || "").toLowerCase();
  const variantName = String(asset.variantName || asset.chartName || "").toLowerCase();

  if (code.includes("wordcloud") || code.includes("word_cloud") || code.includes("word-cloud") || family.includes("wordcloud") || family.includes("word cloud") || family.includes("词云") || variantName.includes("词云")) return "wordCloud";
  if (code.includes("combo") || family.includes("combo") || family.includes("组合") || variantName.includes("组合")) return "combo";
  if (code.includes("sankey") || family.includes("sankey") || family.includes("桑基") || variantName.includes("桑基")) return "sankey";
  if (code.includes("treemap") || code.includes("tree") || family.includes("treemap") || family.includes("树图") || variantName.includes("树图")) return "treemap";
  if (code.includes("map") || code.includes("china") || family.includes("map") || family.includes("地图") || variantName.includes("地图")) return "map";
  if (code.includes("heat") || family.includes("heat") || variantName.includes("热力")) return "heatmap";
  if (code.includes("gauge") || family.includes("gauge") || variantName.includes("仪表")) return "gauge";
  if (code.includes("funnel") || family.includes("funnel") || variantName.includes("漏斗")) return "funnel";
  if (code.includes("radar") || family.includes("radar") || variantName.includes("雷达")) return "radar";
  if (code.includes("scatter") || code.includes("bubble") || family.includes("scatter") || family.includes("bubble") || variantName.includes("散点") || variantName.includes("气泡")) return "scatterBubble";
  if (code.includes("area") || family.includes("area") || variantName.includes("面积")) return "area";
  if (code.includes("horizontal") || family.includes("horizontal") || family.includes("条形") || variantName.includes("横向") || variantName.includes("条形")) return "horizontalBar";
  if (code.includes("pie") || code.includes("rose") || family.includes("pie") || variantName.includes("饼") || variantName.includes("环形") || variantName.includes("玫瑰")) return "pie";
  if (code.includes("line") || family.includes("line") || variantName.includes("折线")) return "line";
  if (code.includes("bar") || code.includes("column") || family.includes("bar") || family.includes("column") || family.includes("柱") || family === "比较分析" || variantName.includes("柱")) return "bar";
  return null;
}

function getNormalizedChartFamilyValue(asset?: ReportingChartAssetRecord | null) {
  const family = getPrimaryChartFamily(asset);
  return family || (asset?.chartFamily ? String(asset.chartFamily) : null);
}

function getPrimaryChartFamilyFromValue(value?: string | null): PrimaryChartFamilyKey | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const assetLike = {
    id: 0,
    chartName: normalized,
    chartCode: normalized,
    chartType: "echarts",
    category: normalized,
    chartFamily: normalized,
    renderMode: "dataset",
    tags: [],
    ownerName: "system",
    status: "active",
    isBuiltin: false,
    createdAt: "",
    updatedAt: "",
  } as ReportingChartAssetRecord;
  return getPrimaryChartFamily(assetLike);
}

function getPrimaryChartFamilyLabel(family?: PrimaryChartFamilyKey | null) {
  return PRIMARY_CHART_FAMILIES.find((item) => item.key === family)?.label || "未分类";
}

function getChartAssetDisplayName(asset?: ReportingChartAssetRecord | null) {
  if (!asset) return "";
  const variant = String(asset.variantName || asset.config?.variantName || "").trim();
  return variant || asset.chartName;
}

function getPieVariantDisplayName(variant?: WidgetChartStyleConfig["pieVariant"] | null) {
  return PIE_VARIANT_LIBRARY.find((item) => item.key === variant)?.label || "环形图";
}

function getAssetMappingFields(asset?: ReportingChartAssetRecord | null) {
  const rawFields = asset?.mappingSchema && typeof asset.mappingSchema === "object" ? (asset.mappingSchema as { fields?: unknown }).fields : [];
  return Array.isArray(rawFields) ? rawFields as Array<{ key: string; label?: string; required?: boolean; acceptRoles?: string[] }> : [];
}

function remapFieldMapForAsset(
  currentFieldMap: Record<string, string> | undefined,
  asset?: ReportingChartAssetRecord | null,
  fields: Array<{ columnName: string; label?: string; dataType?: string }> = []
) {
  const nextFieldMap: Record<string, string> = {};
  const assetFields = getAssetMappingFields(asset);
  const isGeoField = (field?: { columnName?: string; label?: string } | null) => {
    const raw = `${field?.columnName || ""} ${field?.label || ""}`.trim();
    if (!raw) return false;
    const normalized = raw.toLowerCase();
    return /(adcode|province(?:_?(name|code))?|city(?:_?(name|code))?|region(?:_?(name|code))?|district(?:_?(name|code))?|county(?:_?(name|code))?)/i.test(normalized)
      || /行政区划|行政区|地区|区域|省份|城市|地市|区县|县区|省代码|省编码|市代码|市编码/.test(raw);
  };
  const getFieldRole = (field?: { role?: string; dataType?: string } | null) => {
    if (isGeoField(field as ({ columnName?: string; label?: string } | null))) return "dimension";
    const role = String(field?.role || "").toLowerCase();
    const dataType = String(field?.dataType || "").toLowerCase();
    if (role) return role;
    if (/(int|decimal|numeric|number|double|float|real|money|bigint|smallint|tinyint)/i.test(dataType)) return "metric";
    if (/(date|time|timestamp|year)/i.test(dataType)) return "time";
    return "dimension";
  };
  const fieldMap = new Map(fields.map((item) => [item.columnName, item as typeof item & { role?: string }]));
  const hasField = (fieldName: string | undefined) => Boolean(fieldName && fieldMap.has(fieldName));
  const isAccepted = (fieldName: string | undefined, acceptedRoles?: string[]) => {
    if (!fieldName) return false;
    if (!acceptedRoles?.length) return true;
    const field = fieldMap.get(fieldName);
    if (!field) return false;
    const role = getFieldRole(field);
    return acceptedRoles.some((item) => {
      const accepted = String(item || "").toLowerCase();
      if (accepted === role) return true;
      if (accepted === "value" && role === "metric") return true;
      if (accepted === "category" && role === "dimension") return true;
      return false;
    });
  };
  const dimensionField = fields.find((item) => {
    const role = getFieldRole(item as typeof item & { role?: string });
    return item.columnName === "year" || role === "dimension" || role === "category" || role === "time";
  })?.columnName || fields[0]?.columnName;
  const metricFields = fields
    .filter((item) => {
      const role = getFieldRole(item as typeof item & { role?: string });
      return item.columnName !== dimensionField && (role === "metric" || role === "value");
    })
    .map((item) => item.columnName);
  for (const field of assetFields) {
    const currentFieldValue = currentFieldMap?.[field.key];
    if (currentFieldValue && hasField(currentFieldValue)) {
      nextFieldMap[field.key] = currentFieldValue;
      continue;
    }
    if (field.key === "xField" || field.key === "barField" || field.key === "lineField" || field.key === "valueField") {
      nextFieldMap[field.key] = metricFields.shift() || fields.find((item) => isAccepted(item.columnName, field.acceptRoles))?.columnName || fields[1]?.columnName || "";
      continue;
    }
    if (field.key === "valueField2") {
      nextFieldMap[field.key] = metricFields.shift() || "";
      continue;
    }
    if (field.key === "mapField") {
      nextFieldMap[field.key] = fields.find((item) => isGeoField(item) && isAccepted(item.columnName, field.acceptRoles))?.columnName
        || (dimensionField && isAccepted(dimensionField, field.acceptRoles) ? dimensionField : null)
        || fields.find((item) => isAccepted(item.columnName, field.acceptRoles))?.columnName
        || "";
      continue;
    }
    if (field.key === "yField" || field.key === "nameField" || field.key === "labelField") {
      nextFieldMap[field.key] = (dimensionField && isAccepted(dimensionField, field.acceptRoles) ? dimensionField : null)
        || fields.find((item) => isAccepted(item.columnName, field.acceptRoles))?.columnName
        || "";
      continue;
    }
  }
  return nextFieldMap;
}

function snapToGrid(value: number, gap = SNAP_GRID) {
  return Math.round(value / gap) * gap;
}

function snapDownToGrid(value: number, gap = SNAP_GRID) {
  return Math.floor(value / gap) * gap;
}

function snapUpToGrid(value: number, gap = SNAP_GRID) {
  return Math.ceil(value / gap) * gap;
}

function normalizeGridLayoutGap(value?: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_GRID_LAYOUT_GAP;
  return Math.min(MAX_GRID_LAYOUT_GAP, Math.max(MIN_GRID_LAYOUT_GAP, Math.round(numeric)));
}

function getLayoutSnap(layoutMode?: unknown, gridLayoutGap: unknown = DEFAULT_GRID_LAYOUT_GAP) {
  return String(layoutMode || "free") === "grid" ? normalizeGridLayoutGap(gridLayoutGap) : FREE_LAYOUT_SNAP;
}

function isOverlapping(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getOverlapMetrics(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  const overlapWidth = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const overlapHeight = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const overlapArea = overlapWidth * overlapHeight;
  const minArea = Math.max(1, Math.min(a.w * a.h, b.w * b.h));
  return {
    overlapWidth,
    overlapHeight,
    overlapArea,
    intrusionRatio: overlapArea / minArea,
    widthRatio: overlapWidth / Math.max(1, Math.min(a.w, b.w)),
    heightRatio: overlapHeight / Math.max(1, Math.min(a.h, b.h)),
  };
}

function resolveWidgetPlacement(
  key: string,
  nextPosition: { x: number; y: number; w: number; h: number },
  widgets: CanvasWidgetDraft[],
  minGap = DEFAULT_WIDGET_GAP,
  snap = SNAP_GRID,
  canvasWidth?: number,
  canvasHeight?: number
) {
  let candidate = resolveFreeMovePosition(nextPosition, snap, canvasWidth, canvasHeight);
  const others = widgets.filter((item) => item.key !== key).map((item) => ({
    x: item.position.x - minGap,
    y: item.position.y - minGap,
    w: item.position.w + minGap * 2,
    h: item.position.h + minGap * 2,
  }));
  let guard = 0;
  while (others.some((item) => isOverlapping(candidate, item)) && guard < 120) {
    candidate = resolveFreeMovePosition(
      { ...candidate, y: candidate.y + snap },
      snap,
      canvasWidth,
      canvasHeight
    );
    guard += 1;
  }
  return candidate;
}

function resolveWidgetSpacing(
  key: string,
  nextPosition: { x: number; y: number; w: number; h: number },
  widgets: CanvasWidgetDraft[],
  minGap = DEFAULT_WIDGET_GAP,
  snap = SNAP_GRID,
  canvasWidth?: number,
  canvasHeight?: number
) {
  let candidate = resolveFreeMovePosition(nextPosition, snap, canvasWidth, canvasHeight);
  const others = widgets.filter((item) => item.key !== key && !item.containerParentKey && item.widgetType !== "tabs");
  let guard = 0;

  while (guard < 120) {
    const conflict = others.find((item) => isOverlapping(
      {
        x: candidate.x - minGap,
        y: candidate.y - minGap,
        w: candidate.w + minGap * 2,
        h: candidate.h + minGap * 2,
      },
      item.position
    ));

    if (!conflict) {
      return candidate;
    }

    const horizontalOverlap = Math.max(
      0,
      Math.min(candidate.x + candidate.w, conflict.position.x + conflict.position.w)
      - Math.max(candidate.x, conflict.position.x)
    );
    const horizontalOverlapRatio = horizontalOverlap / Math.max(1, Math.min(candidate.w, conflict.position.w));
    const preferVerticalStack = horizontalOverlapRatio >= 0.35;
    const moveDown = snapUpToGrid(conflict.position.y + conflict.position.h + minGap, snap);
    const canMoveDown = moveDown >= 0 && !others.some((item) => item.key !== conflict.key && isOverlapping(
      {
        x: candidate.x - minGap,
        y: moveDown - minGap,
        w: candidate.w + minGap * 2,
        h: candidate.h + minGap * 2,
      },
      item.position
    ));

    if (preferVerticalStack && canMoveDown) {
      candidate = resolveFreeMovePosition(
        {
          ...candidate,
          y: moveDown,
        },
        snap,
        canvasWidth,
        canvasHeight
      );
      guard += 1;
      continue;
    }

    const moveLeft = snapDownToGrid(conflict.position.x - candidate.w - minGap, snap);
    const moveRight = snapUpToGrid(conflict.position.x + conflict.position.w + minGap, snap);
    const canMoveLeft = moveLeft >= 0 && !others.some((item) => item.key !== conflict.key && isOverlapping(
      {
        x: moveLeft - minGap,
        y: candidate.y - minGap,
        w: candidate.w + minGap * 2,
        h: candidate.h + minGap * 2,
      },
      item.position
    ));
    const canMoveRight = !others.some((item) => item.key !== conflict.key && isOverlapping(
      {
        x: moveRight - minGap,
        y: candidate.y - minGap,
        w: candidate.w + minGap * 2,
        h: candidate.h + minGap * 2,
      },
      item.position
    ));

    if (canMoveLeft || canMoveRight) {
      const preferLeft = Math.abs(candidate.x - moveLeft) <= Math.abs(candidate.x - moveRight);
      candidate = resolveFreeMovePosition(
        {
          ...candidate,
          x: canMoveLeft && (preferLeft || !canMoveRight) ? moveLeft : moveRight,
        },
        snap,
        canvasWidth,
        canvasHeight
      );
    } else {
      candidate = resolveFreeMovePosition(
        {
          ...candidate,
          y: snapUpToGrid(conflict.position.y + conflict.position.h + minGap, snap),
        },
        snap,
        canvasWidth,
        canvasHeight
      );
    }

    guard += 1;
  }

  return candidate;
}

function shiftWidgetDown(
  targetKey: string,
  widgets: CanvasWidgetDraft[],
  blocker: { x: number; y: number; w: number; h: number },
  minGap = DEFAULT_WIDGET_GAP,
  snap = SNAP_GRID,
  visited = new Set<string>(),
  canvasWidth?: number,
  canvasHeight?: number
) {
  if (visited.has(targetKey)) return widgets;
  visited.add(targetKey);
  const target = widgets.find((item) => item.key === targetKey);
  if (!target) return widgets;
  const nextY = snapUpToGrid(Math.max(target.position.y, blocker.y + blocker.h + minGap), snap);
  const nextPosition = resolveWidgetSpacing(
    targetKey,
    {
      ...target.position,
      y: nextY,
    },
    widgets,
    minGap,
    snap,
    canvasWidth,
    canvasHeight
  );
  let nextWidgets = widgets.map((item) => item.key === targetKey ? {
    ...item,
    position: nextPosition,
  } : item);
  const moved = nextWidgets.find((item) => item.key === targetKey);
  if (!moved) return nextWidgets;
  const overlapped = nextWidgets.filter((item) => item.key !== targetKey && !item.containerParentKey && item.widgetType !== "tabs" && isOverlapping(
    {
      x: moved.position.x - minGap,
      y: moved.position.y - minGap,
      w: moved.position.w + minGap * 2,
      h: moved.position.h + minGap * 2,
    },
    item.position
  ));
  for (const item of overlapped) {
    nextWidgets = shiftWidgetDown(item.key, nextWidgets, moved.position, minGap, snap, visited, canvasWidth, canvasHeight);
  }
  return nextWidgets;
}

function applyWidgetCollisionLayout(
  movingKey: string,
  nextPosition: { x: number; y: number; w: number; h: number },
  widgets: CanvasWidgetDraft[],
  minGap = DEFAULT_WIDGET_GAP,
  snap = SNAP_GRID,
  canvasWidth?: number,
  canvasHeight?: number
) {
  let nextWidgets = widgets.map((item) => item.key === movingKey ? {
    ...item,
    position: resolveFreeMovePosition(nextPosition, snap, canvasWidth, canvasHeight),
  } : item);
  const moving = nextWidgets.find((item) => item.key === movingKey);
  if (!moving) return nextWidgets;
  const collisions = nextWidgets.filter((item) => {
    if (item.key === movingKey || item.containerParentKey || item.widgetType === "tabs") return false;
    const expandedMoving = {
      x: moving.position.x - minGap,
      y: moving.position.y - minGap,
      w: moving.position.w + minGap * 2,
      h: moving.position.h + minGap * 2,
    };
    if (!isOverlapping(expandedMoving, item.position)) return false;
    const metrics = getOverlapMetrics(expandedMoving, item.position);
    const axisIntrusion = Math.max(metrics.widthRatio, metrics.heightRatio);
    return metrics.intrusionRatio >= COLLISION_INTRUSION_RATIO && axisIntrusion >= COLLISION_AXIS_INTRUSION_RATIO;
  });
  for (const item of collisions) {
    nextWidgets = shiftWidgetDown(item.key, nextWidgets, moving.position, minGap, snap, undefined, canvasWidth, canvasHeight);
  }
  return nextWidgets;
}

function resolveFreeMovePosition(
  nextPosition: { x: number; y: number; w: number; h: number },
  snap = SNAP_GRID,
  canvasWidth?: number,
  canvasHeight?: number
) {
  const minWidth = snap > FREE_LAYOUT_SNAP ? snapUpToGrid(DEFAULT_MIN_WIDGET_WIDTH, snap) : DEFAULT_MIN_WIDGET_WIDTH;
  const minHeight = snap > FREE_LAYOUT_SNAP ? snapUpToGrid(DEFAULT_MIN_WIDGET_HEIGHT, snap) : DEFAULT_MIN_WIDGET_HEIGHT;
  const width = Math.max(minWidth, snapToGrid(nextPosition.w, snap));
  const height = Math.max(minHeight, snapToGrid(nextPosition.h, snap));
  const boundedWidth = canvasWidth ? Math.min(width, Math.max(minWidth, snapDownToGrid(canvasWidth, snap) || canvasWidth)) : width;
  const boundedHeight = canvasHeight ? Math.min(height, Math.max(minHeight, snapDownToGrid(canvasHeight, snap) || canvasHeight)) : height;
  const rawMaxX = canvasWidth ? Math.max(0, canvasWidth - boundedWidth) : Number.POSITIVE_INFINITY;
  const rawMaxY = canvasHeight ? Math.max(0, canvasHeight - boundedHeight) : Number.POSITIVE_INFINITY;
  const maxX = Number.isFinite(rawMaxX) ? snapDownToGrid(rawMaxX, snap) : rawMaxX;
  const maxY = Number.isFinite(rawMaxY) ? snapDownToGrid(rawMaxY, snap) : rawMaxY;
  return {
    x: Math.min(maxX, Math.max(0, snapToGrid(nextPosition.x, snap))),
    y: Math.min(maxY, Math.max(0, snapToGrid(nextPosition.y, snap))),
    w: boundedWidth,
    h: boundedHeight,
  };
}

function getFieldOptions(widget?: CanvasWidgetDraft | null, datasets: ReportingDatasetRecord[] = []) {
  const dataset = widget?.datasetId ? datasets.find((item) => item.id === widget.datasetId) : null;
  const fields = widget?.fields || widget?.preview?.fields || dataset?.fields || [];
  return fields.map((field) => ({
    label: field.label ? `${field.columnName} (${field.label})` : field.columnName,
    value: field.columnName,
  }));
}

const PALETTE_OPTIONS = [
  { value: "ocean", label: "海洋蓝" },
  { value: "business", label: "商务蓝" },
  { value: "neon", label: "霓虹" },
  { value: "gold", label: "金属金" },
  { value: "fresh", label: "清新绿" },
  { value: "sunset", label: "日落橙" },
  { value: "rainbow", label: "彩虹" },
  { value: "rose", label: "玫瑰" },
  { value: "aqua", label: "海玻璃" },
  { value: "pastel", label: "莫兰迪" },
];

const PIE_VARIANT_OPTIONS = [
  { value: "classic-pie", label: "标准饼图" },
  { value: "classic-donut", label: "环形图" },
  { value: "rose", label: "南丁格尔玫瑰图" },
  { value: "half-donut", label: "半环图" },
  { value: "nested", label: "多层环形图" },
] as const;

const PIE_THEME_OPTIONS = [
  { value: "business", label: "商务简报" },
  { value: "minimal", label: "浅色极简" },
  { value: "dark-screen", label: "深色大屏" },
  { value: "glass", label: "玻璃质感" },
  { value: "neon-contrast", label: "高对比霓虹" },
  { value: "warm-metal", label: "暖色金属" },
  { value: "morandi", label: "柔和莫兰迪" },
] as const;

const PIE_VARIANT_LIBRARY = [
  {
    key: "classic-pie",
    label: "标准饼图",
    description: "适用于单层占比分析，强调构成关系，适合类别较少的业务场景。",
    tags: ["单层占比", "构成分析", "标准"],
  },
  {
    key: "classic-donut",
    label: "环形图",
    description: "保留中心信息位，适合总量、占比说明与经营概览类卡片。",
    tags: ["中心信息", "总量展示", "看板"],
  },
  {
    key: "rose",
    label: "南丁格尔玫瑰图",
    description: "强化类目差异与排序感，适合突出重点分类和业务层级。",
    tags: ["差异强化", "排序感", "重点分类"],
  },
  {
    key: "half-donut",
    label: "半环图",
    description: "适合达成率、进度表达和单指标概览，常用于经营驾驶舱。",
    tags: ["达成率", "进度表达", "驾驶舱"],
  },
  {
    key: "nested",
    label: "多层环形图",
    description: "适合双层层级占比展示，用于主类目与子类目的结构联动分析。",
    tags: ["双层结构", "层级占比", "联动分析"],
  },
] as const;

const PIE_TEMPLATE_VISUAL_MAP: Record<string, {
  accent: string;
  palette?: string[];
  backgroundColor?: string;
  borderColor?: string;
  titleColor?: string;
  shadowPreset?: WidgetChromeConfig["shadowPreset"];
}> = {
  "clean-card": {
    accent: "#4e7cff",
    palette: ["#4e7cff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"],
    backgroundColor: "#ffffff",
    borderColor: "#dce6f5",
    titleColor: "#101828",
    shadowPreset: "none",
  },
  "soft-panel": {
    accent: "#5b8ff9",
    palette: ["#5b8ff9", "#61d9a5", "#f6bd16", "#7262fd", "#78d3f8"],
    backgroundColor: "#f8fbff",
    borderColor: "#c7d7f2",
    titleColor: "#25324b",
    shadowPreset: "soft",
  },
  "mist-card": {
    accent: "#6b8df7",
    palette: ["#6b8df7", "#8bcfbe", "#e5b97a", "#9b8cf2", "#d6a5b5"],
    backgroundColor: "#f4f7fb",
    borderColor: "#d7e2f2",
    titleColor: "#334155",
    shadowPreset: "soft",
  },
  "slate-card": {
    accent: "#64748b",
    palette: ["#64748b", "#7aa37a", "#d1a66a", "#8b7fb0", "#d18a8a"],
  },
  "boardroom-silver": {
    accent: "#5f6b85",
    palette: ["#5f6b85", "#7db6a3", "#e0b368", "#9382c9", "#cf9393"],
  },
  "highlight-frame": {
    accent: "#255fa8",
    palette: ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff", "#e8f1ff"],
    backgroundColor: "#ffffff",
    borderColor: "#7faef5",
    titleColor: "#1d3e6f",
    shadowPreset: "soft",
  },
  "glass-minimal": {
    accent: "#2f7cf6",
    palette: ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"],
    backgroundColor: "#f7fbff",
    borderColor: "#d6e7fb",
    titleColor: "#24476b",
    shadowPreset: "soft",
  },
  "capital-blueprint": {
    accent: "#1d4f91",
    palette: ["#1d4f91", "#2f68b2", "#4f8cff", "#5fc8df", "#8fb7ff"],
    backgroundColor: "#edf4ff",
    borderColor: "#9fbbe4",
    titleColor: "#173b68",
    shadowPreset: "soft",
  },
  "neon-frame": {
    accent: "#53ddff",
    palette: ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff", "#c6ecff"],
    backgroundColor: "#081521",
    borderColor: "#35d0ff",
    titleColor: "#dcf7ff",
    shadowPreset: "medium",
  },
  "midnight-panel": {
    accent: "#7aa2ff",
    palette: ["#7aa2ff", "#4dd6c0", "#f5c46b", "#a58cff", "#f28c9d"],
    backgroundColor: "#101826",
    borderColor: "#243a63",
    titleColor: "#edf3ff",
    shadowPreset: "medium",
  },
  "obsidian-glow": {
    accent: "#6fb7ff",
    palette: ["#6fb7ff", "#53d7ff", "#77d8aa", "#efc978", "#b89bff"],
    backgroundColor: "#0f1722",
    borderColor: "#32507d",
    titleColor: "#eef5ff",
    shadowPreset: "medium",
  },
  "aurora-night": {
    accent: "#5bc8ff",
    palette: ["#5bc8ff", "#68d7b2", "#f3c46d", "#8ea8ff", "#c9a7ff"],
    backgroundColor: "#0b1d24",
    borderColor: "#236274",
    titleColor: "#e6fbff",
    shadowPreset: "medium",
  },
  "executive-ink": {
    accent: "#d6b36a",
    palette: ["#d6b36a", "#b88a44", "#f1d089", "#8e6a37", "#f5e6bb"],
    backgroundColor: "#1b1714",
    borderColor: "#6a5438",
    titleColor: "#f3dfb2",
    shadowPreset: "medium",
  },
  "emerald-card": {
    accent: "#059669",
    palette: ["#059669", "#38bdf8", "#f59e0b", "#8b5cf6", "#ef6c8f"],
    backgroundColor: "#f3fbf8",
    borderColor: "#7fd1b9",
    titleColor: "#155e4a",
    shadowPreset: "soft",
  },
  "forest-report": {
    accent: "#2f855a",
    palette: ["#2f855a", "#5b8ff9", "#d69e2e", "#8b7cf6", "#d17b88"],
    backgroundColor: "#eff8f2",
    borderColor: "#72b68b",
    titleColor: "#2c5a3f",
    shadowPreset: "soft",
  },
  "warm-paper": {
    accent: "#9a4f12",
    palette: ["#9a4f12", "#c77522", "#e3a24a", "#8d6b35", "#c8583a"],
    backgroundColor: "#fff7ed",
    borderColor: "#e7cba3",
    titleColor: "#654321",
    shadowPreset: "none",
  },
  "coral-panel": {
    accent: "#d47457",
    palette: ["#d47457", "#5f8df8", "#8cbf7a", "#a78bfa", "#e3ae4d"],
    backgroundColor: "#fff8f5",
    borderColor: "#e7c7b8",
    titleColor: "#7b5b49",
    shadowPreset: "soft",
  },
  "private-banking": {
    accent: "#b5893b",
    palette: ["#b5893b", "#688ecf", "#93b89d", "#cfb36b", "#b59ad6"],
    backgroundColor: "#fdfaf4",
    borderColor: "#e6dccb",
    titleColor: "#6f5630",
    shadowPreset: "soft",
  },
  "violet-glow": {
    accent: "#6d28d9",
    palette: ["#6d28d9", "#8b5cf6", "#22d3ee", "#f472b6", "#a78bfa"],
    backgroundColor: "#f7f4ff",
    borderColor: "#b7a2ff",
    titleColor: "#4c1d95",
    shadowPreset: "medium",
  },
  "plum-night": {
    accent: "#b094ff",
    palette: ["#b094ff", "#6fd0ff", "#f3c96c", "#6bd4a5", "#f497b3"],
    backgroundColor: "#1a1626",
    borderColor: "#58407d",
    titleColor: "#f3edff",
    shadowPreset: "medium",
  },
};

const CHINA_PROVINCE_OPTIONS = [
  { value: "", label: "全国" },
  { value: "110000", label: "北京市" },
  { value: "120000", label: "天津市" },
  { value: "130000", label: "河北省" },
  { value: "140000", label: "山西省" },
  { value: "150000", label: "内蒙古自治区" },
  { value: "210000", label: "辽宁省" },
  { value: "220000", label: "吉林省" },
  { value: "230000", label: "黑龙江省" },
  { value: "310000", label: "上海市" },
  { value: "320000", label: "江苏省" },
  { value: "330000", label: "浙江省" },
  { value: "340000", label: "安徽省" },
  { value: "350000", label: "福建省" },
  { value: "360000", label: "江西省" },
  { value: "370000", label: "山东省" },
  { value: "410000", label: "河南省" },
  { value: "420000", label: "湖北省" },
  { value: "430000", label: "湖南省" },
  { value: "440000", label: "广东省" },
  { value: "450000", label: "广西壮族自治区" },
  { value: "460000", label: "海南省" },
  { value: "500000", label: "重庆市" },
  { value: "510000", label: "四川省" },
  { value: "520000", label: "贵州省" },
  { value: "530000", label: "云南省" },
  { value: "540000", label: "西藏自治区" },
  { value: "610000", label: "陕西省" },
  { value: "620000", label: "甘肃省" },
  { value: "630000", label: "青海省" },
  { value: "640000", label: "宁夏回族自治区" },
  { value: "650000", label: "新疆维吾尔自治区" },
];

function buildDefaultChrome(titleText?: string): WidgetChromeConfig {
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

export function buildDefaultChartStyleConfig(): WidgetChartStyleConfig {
  return {
    palette: ["#4e7cff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"],
    palettePreset: "ocean",
    accentColor: "#1677ff",
    barSeriesLayout: "single",
    legendPrimaryName: "图例一",
    legendSecondaryName: "图例二",
    barPrimaryColor: "#4e7cff",
    barSecondaryColor: "#55c6a9",
    horizontalBarPalette: ["#4e7cff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"],
    horizontalBarColorCount: 1,
    horizontalBarSortOrder: "none",
    sankeyNodeWidth: 16,
    sankeyNodeGap: 18,
    sankeyNodeBorderColor: "#ffffff",
    sankeyNodeBorderWidth: 1,
    sankeyNodeBorderRadius: 4,
    sankeyLinkOpacity: 0.28,
    sankeyLinkCurveness: 0.5,
    gaugePointerColor: "#1677ff",
    gaugeDetailColor: "#101828",
    gaugeTitleColor: "#667085",
    gaugeMetricName: "指标",
    gaugeAxisLabelColor: "#344054",
    gaugeSplitLineColor: "#98a2b3",
    gaugeStartAngle: 210,
    gaugeEndAngle: -30,
    gaugeRadius: "90%",
    gaugeProgressWidth: 18,
    gaugeAxisLineWidth: 18,
    gaugePointerLength: "58%",
    gaugeDetailFontSize: 24,
    gaugeDetailFontWeight: 700,
    gaugeTitleFontSize: 14,
    funnelValueColor: "#101828",
    funnelLabelLineColor: "#98a2b3",
    funnelBlockBorderColor: "#ffffff",
    funnelBlockBorderWidth: 1,
    funnelItemGap: 2,
    funnelSortOrder: "descending",
    funnelLabelPosition: "outside",
    funnelShowName: true,
    funnelShowValue: true,
    wordCloudShape: "circle",
    wordCloudGridSize: 10,
    wordCloudRotationStep: 45,
    wordCloudMinFontSize: 12,
    wordCloudMaxFontSize: 40,
    wordCloudFontWeight: 700,
    wordCloudTextShadowColor: "rgba(15,23,42,0.14)",
    wordCloudTextShadowBlur: 10,
    scatterSymbolSize: 16,
    scatterPointBorderColor: "#ffffff",
    scatterPointBorderWidth: 1,
    scatterPointOpacity: 0.82,
    scatterLabelPosition: "top",
    barGap: "30%",
    barCategoryGap: "29%",
    barSeriesOverlap: 0,
    barCategoryGapPercent: 36,
    barValuePosition: "top",
    lineWidth: 3,
    lineSmooth: true,
    lineShowSymbol: true,
    lineSymbolSize: 6,
    lineAreaOpacity: 0.18,
    lineLabelPosition: "top",
    radarCenterX: "50%",
    radarCenterY: "52%",
    radarRadius: "70%",
    radarShape: "polygon",
    radarSplitNumber: 5,
    radarShowSplitArea: true,
    radarAreaOpacity: 0.22,
    radarLayout: "single",
    radarPrimaryColor: "#1677ff",
    radarSecondaryColor: "#4f8cff",
    mapRegionPalette: ["#eef5ff", "#d5e6ff", "#9cc3ff", "#4f8cff", "#1677ff"],
    mapRegionBorderColor: "#8fb1d6",
    mapLabelColor: "#344054",
    mapVisualMapTextColor: "#344054",
    extremaMaxColor: "#f59e0b",
    extremaMinColor: "#12b76a",
    showLegend: true,
    showAxis: true,
    showXAxis: true,
    showYAxis: true,
    showGridLines: false,
    xAxisUnitLabel: "",
    yAxisUnitLabel: "",
    axisLabelColor: "#667085",
    axisLabelFontSize: 12,
    axisLabelFontWeight: 400,
    showLabels: true,
    legendPosition: "bottom",
    dataLabelColor: "#24476b",
    dataLabelFontSize: 14,
    dataLabelFontWeight: 500,
    legendTextColor: "#344054",
    legendFontSize: 14,
    legendFontWeight: 500,
    pieVariant: "classic-pie",
    pieTheme: "business",
    pieInnerRadius: 0,
    pieOuterRadius: 82,
    pieStartAngle: 90,
    pieSweepAngle: 360,
    pieMinAngle: 2,
    pieRoseMode: "off",
    pieLabelMode: "outside",
    pieShowCategory: true,
    pieShowPercent: true,
    pieShowValue: false,
    pieValueFormat: "number",
    pieLabelColor: "#344054",
    pieValueColor: "#101828",
    pieLabelFontSize: 14,
    pieValueFontSize: 14,
    pieLabelFontWeight: 500,
    pieValueFontWeight: 700,
    pieLabelLineShow: true,
    pieLabelLineColor: "#98a2b3",
    pieLabelLineWidth: 1,
    pieLabelLineLength: 18,
    pieLabelLineLength2: 12,
    pieShowCenter: false,
    pieCenterTitle: "总量",
    pieCenterValue: "",
    pieCenterUnit: "",
    pieCenterSubtitle: "",
    pieCenterTitleColor: "#667085",
    pieCenterValueColor: "#101828",
    pieCenterUnitColor: "#101828",
    pieCenterMetaColor: "#98a2b3",
    pieCenterTitleFontSize: 14,
    pieCenterValueFontSize: 28,
    pieCenterUnitFontSize: 18,
    pieCenterMetaFontSize: 12,
    pieSliceGap: 0,
    pieBorderRadius: 0,
    pieBorderWidth: 1,
    pieBorderColor: "#ffffff",
    pieSortOrder: "desc",
    pieMaxSlices: 7,
    pieMergeOthers: false,
    pieOthersName: "其他",
    pieLegendPosition: "bottom",
    pieLegendShowValue: false,
    pieLegendShowPercent: false,
    pieHoverScale: false,
    pieSelectedOffset: 0,
    pieShadowBlur: 0,
    pieShadowColor: "rgba(15,23,42,0.16)",
  };
}

function buildDefaultMapStyleConfig(): WidgetMapStyleConfig {
  return {
    provinceCode: null,
    center: null,
    zoom: null,
  };
}

function buildDefaultChartAnalysisConfig(): WidgetChartAnalysisConfig {
  return {
    showExtrema: false,
  };
}

export function buildDefaultKpiConfig(): WidgetKpiConfig {
  return {
    mode: "number",
    layout: "horizontal",
    valuePrefix: "",
    valueSuffix: "",
    decimals: 0,
    compareLabel: "同比",
  };
}

function buildDefaultKpiStyleConfig(): WidgetKpiStyleConfig {
  return {
    itemSize: "medium",
    multiValueLayout: "horizontalList",
    contentOrientation: "vertical",
    themeMode: "all",
    itemsPerRow: 5,
    itemsPerColumn: 3,
    itemMinWidth: 180,
    showDivider: true,
    dividerStyle: "solid",
    dividerWidth: 1,
    dividerColor: "#e5e7eb",
    itemGap: 16,
    itemAlign: "center",
    itemBackgroundColor: "#ffffff",
    itemBorderColor: "#e5e7eb",
    itemBorderWidth: 0,
    itemBorderRadius: 12,
    flipperBackground: null,
    flipperRefreshSeconds: 5,
    flipperGap: 4,
    flipperDigitWidth: 50,
    flipperDigitHeight: 60,
    flipperDigitRadius: 10,
    progressTrackColor: "#edf4ff",
    progressFillColor: "#1677ff",
    hoverElevated: true,
    trendColorMode: "auto",
    showValue: true,
    valueColor: "#1677ff",
    valueFontSize: 25,
    valueFontWeight: 700,
    valuePrefixColor: "#1677ff",
    valuePrefixFontSize: 20,
    valueSuffixColor: "#1677ff",
    valueSuffixFontSize: 15,
    showMetricLabel: true,
    metricLabelColor: "#667085",
    metricLabelFontSize: 18,
    metricLabelFontWeight: 600,
    compareLabelColor: "#52c41a",
    compareLabelFontSize: 16,
    compareLabelFontWeight: 600,
  };
}

function buildDefaultKpiAnalysisConfig(): WidgetKpiAnalysisConfig {
  return {
    showTrend: true,
  };
}

export function buildDefaultTableConfig(): WidgetTableConfig {
  return {
    pageSize: 10,
  };
}

function buildDefaultTableStyleConfig(): WidgetTableStyleConfig {
  return {
    compact: false,
    striped: true,
    showIndex: true,
    headerBackground: "#f5f7fb",
    headerTextColor: "#101828",
    rowBackground: "#ffffff",
    rowAlternateBackground: "#fafcff",
    rowBorderColor: "#eef2f7",
  };
}

export function buildDefaultTabsConfig(): WidgetTabsConfig {
  return {
    defaultActiveKey: "tab_1",
    items: [
      { key: "tab_1", title: "窗口一", childWidgetKey: null },
      { key: "tab_2", title: "窗口二", childWidgetKey: null },
    ],
  };
}

function buildDefaultTabsStyleConfig(): WidgetTabsStyleConfig {
  return {
    tabBarBackgroundColor: "#f8fafc",
    activeTextColor: "#1677ff",
    inactiveTextColor: "#667085",
    activeBackground: "#ffffff",
    indicatorColor: "#1677ff",
  };
}

function buildDefaultRichTextConfig(): WidgetRichTextConfig {
  return {
    content: "请输入说明文字",
  };
}

function buildDefaultRichTextStyleConfig(): WidgetRichTextStyleConfig {
  return {
    fontSize: 18,
    fontWeight: 500,
    color: "#1f2329",
    align: "left",
  };
}

function buildDefaultImageConfig(): WidgetImageConfig {
  return {
    imageUrl: "",
  };
}

function buildDefaultImageStyleConfig(): WidgetImageStyleConfig {
  return {
    objectFit: "contain",
    borderRadius: 10,
  };
}

function resolveDefaultChartAsset(chartAssets: ReportingChartAssetRecord[]) {
  return chartAssets.find((item) => item.status !== "inactive") || null;
}

export function normalizeChromeConfig(chrome: unknown, titleText?: string): WidgetChromeConfig {
  const source = typeof chrome === "object" && chrome ? chrome as Record<string, unknown> : {};
  const base = buildDefaultChrome(titleText);
  return {
    ...base,
    ...source,
    themeKey: typeof source.themeKey === "string" ? source.themeKey : base.themeKey,
    titleText: typeof source.titleText === "string" ? source.titleText : base.titleText,
    backgroundImage: typeof source.backgroundImage === "string" ? source.backgroundImage : base.backgroundImage,
    paddingPreset: (source.paddingPreset as WidgetChromeConfig["paddingPreset"]) || base.paddingPreset,
  };
}

function applyKpiThemeTemplate(
  themeKey?: string | null,
  titleText?: string,
  mode?: WidgetKpiConfig["mode"],
  currentKpiStyle?: WidgetKpiStyleConfig | null,
  currentChrome?: WidgetChromeConfig | null
) {
  const base = buildDefaultChrome(titleText);
  const baseKpiStyle = buildDefaultKpiStyleConfig();
  const theme = KPI_THEME_TEMPLATES.find((item) => item.key === themeKey);
  if (!theme) {
    return {
      chrome: base,
      kpiStyle: baseKpiStyle,
    };
  }
  const modePreset = mode ? theme.modePresets?.[mode] || {} : {};
  const nextChrome = {
    ...base,
    themeKey: theme.key,
    titleText: titleText || base.titleText,
  } as WidgetChromeConfig;
  const nextKpiStyle = {
    ...baseKpiStyle,
    themeKey: theme.key,
  } as WidgetKpiStyleConfig;

  for (const key of THEME_CHROME_KEYS) {
    if (theme.chrome[key] !== undefined) {
      (nextChrome as Record<string, unknown>)[key] = theme.chrome[key];
    }
  }

  if (currentChrome) {
    nextChrome.showTitle = currentChrome.showTitle ?? nextChrome.showTitle;
    nextChrome.titleText = currentChrome.titleText || nextChrome.titleText;
    nextChrome.titleAlign = currentChrome.titleAlign || nextChrome.titleAlign;
    nextChrome.titleFontSize = currentChrome.titleFontSize ?? nextChrome.titleFontSize;
    nextChrome.titleFontWeight = currentChrome.titleFontWeight ?? nextChrome.titleFontWeight;
    nextChrome.backgroundImage = currentChrome.backgroundImage || nextChrome.backgroundImage;
  }

  for (const key of THEME_KPI_STYLE_KEYS) {
    if (theme.kpiStyle[key] !== undefined) {
      (nextKpiStyle as Record<string, unknown>)[key] = theme.kpiStyle[key];
    }
    if ((modePreset as Record<string, unknown>)[key] !== undefined) {
      (nextKpiStyle as Record<string, unknown>)[key] = (modePreset as Record<string, unknown>)[key];
    }
  }

  nextKpiStyle.valuePrefixColor = nextKpiStyle.valuePrefixColor || nextKpiStyle.valueColor || baseKpiStyle.valuePrefixColor;
  nextKpiStyle.valueSuffixColor = nextKpiStyle.valueSuffixColor || nextKpiStyle.valueColor || baseKpiStyle.valueSuffixColor;
  nextKpiStyle.compareLabelColor = nextKpiStyle.compareLabelColor || nextKpiStyle.valueColor || baseKpiStyle.compareLabelColor;
  nextKpiStyle.dividerColor = nextKpiStyle.dividerColor
    || nextKpiStyle.itemBorderColor
    || nextChrome.borderColor
    || baseKpiStyle.dividerColor;
  nextChrome.titleColor = nextChrome.titleColor || nextKpiStyle.metricLabelColor || nextKpiStyle.valueColor || base.titleColor;

  if (currentKpiStyle) {
    nextKpiStyle.itemSize = currentKpiStyle.itemSize || nextKpiStyle.itemSize;
    nextKpiStyle.multiValueLayout = currentKpiStyle.multiValueLayout || nextKpiStyle.multiValueLayout;
    nextKpiStyle.itemsPerRow = currentKpiStyle.itemsPerRow ?? nextKpiStyle.itemsPerRow;
    nextKpiStyle.itemsPerColumn = currentKpiStyle.itemsPerColumn ?? nextKpiStyle.itemsPerColumn;
    nextKpiStyle.itemAlign = currentKpiStyle.itemAlign || nextKpiStyle.itemAlign;
    nextKpiStyle.showDivider = currentKpiStyle.showDivider ?? nextKpiStyle.showDivider;
    nextKpiStyle.dividerStyle = currentKpiStyle.dividerStyle || nextKpiStyle.dividerStyle;
  }

  return {
    chrome: nextChrome,
    kpiStyle: nextKpiStyle,
  };
}

export function stripLegacyKpiThemeDefaults(style?: WidgetKpiStyleConfig | null) {
  if (!style) return undefined;
  const next = { ...style };
  const legacyDefaults = buildDefaultKpiStyleConfig();
  if (next.valueColor === legacyDefaults.valueColor) delete next.valueColor;
  if (next.valuePrefixColor === legacyDefaults.valuePrefixColor) delete next.valuePrefixColor;
  if (next.valueSuffixColor === legacyDefaults.valueSuffixColor) delete next.valueSuffixColor;
  if (next.metricLabelColor === legacyDefaults.metricLabelColor) delete next.metricLabelColor;
  if (next.compareLabelColor === legacyDefaults.compareLabelColor) delete next.compareLabelColor;
  if (next.dividerColor === legacyDefaults.dividerColor) delete next.dividerColor;
  if (next.itemBackgroundColor === legacyDefaults.itemBackgroundColor) delete next.itemBackgroundColor;
  if (next.itemBorderColor === legacyDefaults.itemBorderColor) delete next.itemBorderColor;
  if (next.flipperBackground === legacyDefaults.flipperBackground || next.flipperBackground === "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)") {
    delete next.flipperBackground;
  }
  return next as WidgetKpiStyleConfig;
}

function buildKpiThemeOptions() {
  return Object.entries(KPI_THEME_CATEGORY_LABELS).map(([category, label]) => ({
    label,
    options: KPI_THEME_TEMPLATES
      .filter((item) => item.category === category)
      .map((item) => ({ value: item.key, label: item.label })),
  })).filter((group) => group.options.length > 0);
}

function readLocalImageAsDataUrl(file?: File | null) {
  return new Promise<string>((resolve, reject) => {
    if (!file) {
      reject(new Error("未选择文件"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function parseGradientDirection(direction?: string | null) {
  const rawDirection = String(direction || "to bottom").trim();
  return rawDirection === "180deg" ? "to bottom"
    : rawDirection === "0deg" ? "to top"
      : rawDirection === "90deg" ? "to right"
        : rawDirection === "270deg" ? "to left"
          : rawDirection === "135deg" ? "to bottom right"
            : rawDirection === "45deg" ? "to top right"
              : rawDirection;
}

const DEFAULT_DASHBOARD_TITLE_ALIGN = "center";
const DEFAULT_DASHBOARD_TITLE_COLOR = "#101828";
const DEFAULT_DASHBOARD_TITLE_FONT_SIZE = 25;
const DEFAULT_DASHBOARD_TITLE_FONT_WEIGHT = 700;

function extractCanvasBackgroundFormValues(
  canvas?: ThemeTemplateCanvas | null,
  defaults?: { titleColor?: string | null }
) {
  const gradientText = String(canvas?.backgroundGradient || "");
  const gradientMatch = gradientText.match(/linear-gradient\(([^,]+),\s*([^ ]+)\s+0%,\s*([^ ]+)\s+100%\)/i);
  const canvasValues = canvas as Record<string, unknown> | undefined;
  return {
    canvasBackgroundType: (canvas?.backgroundImage ? "image" : canvas?.backgroundGradient ? "gradient" : "solid") as CanvasBackgroundFormType,
    canvasBackgroundColor: String(canvas?.backgroundColor || "#f7f9fc"),
    canvasGradientStart: gradientMatch?.[2]?.trim() || "#f7f9fc",
    canvasGradientEnd: gradientMatch?.[3]?.trim() || "#eef3fa",
    canvasGradientDirection: parseGradientDirection(gradientMatch?.[1]?.trim() || "to bottom"),
    canvasBackgroundImage: String(canvas?.backgroundImage || ""),
    dashboardTitleAlign: String(canvasValues?.dashboardTitleAlign || DEFAULT_DASHBOARD_TITLE_ALIGN),
    dashboardTitleColor: String(canvasValues?.dashboardTitleColor || defaults?.titleColor || DEFAULT_DASHBOARD_TITLE_COLOR),
    dashboardTitleFontSize: Number(canvasValues?.dashboardTitleFontSize || DEFAULT_DASHBOARD_TITLE_FONT_SIZE),
    dashboardTitleFontWeight: Number(canvasValues?.dashboardTitleFontWeight || DEFAULT_DASHBOARD_TITLE_FONT_WEIGHT),
  };
}

function buildCanvasConfigFromForm(values: Record<string, unknown>) {
  const backgroundType = String(values.canvasBackgroundType || "solid") as CanvasBackgroundFormType;
  const backgroundColor = backgroundType === "solid" ? String(values.canvasBackgroundColor || "#f7f9fc") : null;
  const backgroundGradient = backgroundType === "gradient"
    ? `linear-gradient(${String(values.canvasGradientDirection || "to bottom")}, ${String(values.canvasGradientStart || "#f7f9fc")} 0%, ${String(values.canvasGradientEnd || "#eef3fa")} 100%)`
    : null;
  const backgroundImage = backgroundType === "image" ? String(values.canvasBackgroundImage || "") : "";
  return {
    backgroundType,
    backgroundColor,
    backgroundGradient,
    backgroundImage: backgroundImage || null,
    dashboardTitleAlign: String(values.dashboardTitleAlign || DEFAULT_DASHBOARD_TITLE_ALIGN),
    dashboardTitleColor: String(values.dashboardTitleColor || DEFAULT_DASHBOARD_TITLE_COLOR),
    dashboardTitleFontSize: Number(values.dashboardTitleFontSize || DEFAULT_DASHBOARD_TITLE_FONT_SIZE),
    dashboardTitleFontWeight: Number(values.dashboardTitleFontWeight || DEFAULT_DASHBOARD_TITLE_FONT_WEIGHT),
  };
}

function resolveCanvasBackgroundStyle(canvas?: ThemeTemplateCanvas | null) {
  if (!canvas) {
    return "linear-gradient(180deg, #fafcff 0%, #f5f7fb 100%)";
  }
  if (canvas.backgroundType === "image" && canvas.backgroundImage) {
    return `url(${canvas.backgroundImage}) center/cover no-repeat`;
  }
  if (canvas.backgroundType === "gradient" && canvas.backgroundGradient) {
    return String(canvas.backgroundGradient);
  }
  return String(canvas.backgroundColor || canvas.backgroundGradient || canvas.backgroundImage || "linear-gradient(180deg, #fafcff 0%, #f5f7fb 100%)");
}

function buildFlipperBackgroundFromStyle(style?: WidgetKpiStyleConfig | null) {
  if (!style) {
    return "linear-gradient(180deg, #1677ff 0%, #ffffff 100%)";
  }
  if (style.flipperBackgroundType === "image" && style.flipperBackgroundImage) {
    return `url(${style.flipperBackgroundImage}) center/cover no-repeat`;
  }
  if (style.flipperBackgroundType === "solid" && style.flipperBackgroundColor) {
    return String(style.flipperBackgroundColor);
  }
  if (style.flipperBackgroundType === "gradient") {
    return `linear-gradient(${style.flipperBackgroundDirection || "to bottom"}, ${style.flipperBackgroundColor || "#1677ff"} 0%, ${style.flipperBackgroundGradient || "#ffffff"} 100%)`;
  }
  return String(style.flipperBackground || "linear-gradient(180deg, #1677ff 0%, #ffffff 100%)");
}

export function buildChromeBackgroundFromStyle(chrome?: WidgetChromeConfig | null) {
  if (!chrome) {
    return "#ffffff";
  }
  if (chrome.backgroundType === "image" && chrome.backgroundImage) {
    return `url(${chrome.backgroundImage}) center/cover no-repeat`;
  }
  if (chrome.backgroundType === "gradient" && chrome.backgroundGradient) {
    return String(chrome.backgroundGradient);
  }
  return String(chrome.backgroundColor || "#ffffff");
}

function materializeWidgetFromTemplate(
  widget: CanvasWidgetDraft,
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null,
) {
  return applyResolvedThemeToWidget(themeTemplates, dashboardThemeTemplateId, {
    ...widget,
    widgetThemeOverrides: {},
  });
}

function applyTemplateSelectionToWidget(
  widget: CanvasWidgetDraft,
  themeTemplates: ThemeTemplateRecord[],
  dashboardThemeTemplateId: number | null,
  selection: "__dashboard__" | number | null,
) {
  const inheritDashboardTheme = selection === "__dashboard__";
  const nextWidget = {
    ...widget,
    inheritDashboardTheme,
    widgetThemeTemplateId: inheritDashboardTheme ? null : (selection ? Number(selection) : null),
  } as CanvasWidgetDraft;
  return materializeWidgetFromTemplate(nextWidget, themeTemplates, dashboardThemeTemplateId);
}

function readNumericId(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function buildChromeStyleFromForm(chrome?: WidgetChromeConfig | null) {
  const source = chrome || {};
  const backgroundType = source.backgroundType || (source.backgroundImage ? "image" : source.backgroundGradient ? "gradient" : "solid");
  const gradientText = String(source.backgroundGradient || "");
  const gradientMatch = gradientText.match(/linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+0%,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+100%\)/i);
  const gradientDirection = source.backgroundGradientDirection
    || parseGradientDirection(gradientMatch?.[1]?.trim() || "to bottom");
  const gradientStart = source.backgroundColor || gradientMatch?.[2]?.trim() || "#ffffff";
  const gradientEnd = gradientMatch?.[3]?.trim() || "#f5f7fb";
  return {
    ...source,
    backgroundType,
    backgroundImage: backgroundType === "image" ? (source.backgroundImage || null) : "",
    backgroundGradient: backgroundType === "gradient"
      ? `linear-gradient(${gradientDirection || "to bottom"}, ${gradientStart} 0%, ${gradientEnd} 100%)`
      : null,
    backgroundColor: backgroundType === "solid" ? (source.backgroundColor || "#ffffff") : gradientStart,
    backgroundGradientDirection: gradientDirection,
  } as WidgetChromeConfig;
}

function extractChromeFormValues(chrome?: WidgetChromeConfig | null) {
  const source = chrome || {};
  const gradientText = String(source.backgroundGradient || "");
  const gradientMatch = gradientText.match(/linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+0%,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+100%\)/i);
  const backgroundType = source.backgroundType || (source.backgroundImage ? "image" : source.backgroundGradient ? "gradient" : "solid");
  return {
    ...source,
    backgroundType,
    backgroundColor: String(source.backgroundColor || gradientMatch?.[2]?.trim() || "#ffffff"),
    backgroundGradientEnd: String(gradientMatch?.[3]?.trim() || "#f5f7fb"),
    backgroundGradientDirection: source.backgroundGradientDirection || parseGradientDirection(gradientMatch?.[1]?.trim() || "to bottom"),
    backgroundImage: String(source.backgroundImage || ""),
  };
}

function extractFlipperStyleFormValues(style?: WidgetKpiStyleConfig | null) {
  const source = style || {};
  const background = buildFlipperBackgroundFromStyle(source);
  const gradientParts = background.startsWith("linear-gradient(")
    ? (() => {
      const match = background.match(/linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+0%,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+100%\)/i);
      if (!match) return null;
      const rawDirection = match[1].trim();
      const direction = rawDirection === "180deg" ? "to bottom"
        : rawDirection === "0deg" ? "to top"
          : rawDirection === "90deg" ? "to right"
            : rawDirection === "270deg" ? "to left"
              : rawDirection === "135deg" ? "to bottom right"
                : rawDirection === "45deg" ? "to top right"
                  : rawDirection;
      return { start: match[2].trim(), end: match[3].trim(), direction };
    })()
    : null;
  return {
    flipperBackgroundType: source.flipperBackgroundType || (background.startsWith("url(") ? "image" : gradientParts ? "gradient" : "solid"),
    flipperBackgroundColor: source.flipperBackgroundColor || (gradientParts?.start || (!background.startsWith("url(") ? background : "#1677ff")),
    flipperBackgroundGradient: source.flipperBackgroundGradient || gradientParts?.end || "#ffffff",
    flipperBackgroundImage: source.flipperBackgroundImage || (background.startsWith("url(") ? background.replace(/^url\((.*)\)\s.*$/i, "$1") : ""),
    flipperBackgroundDirection: source.flipperBackgroundDirection || gradientParts?.direction || "to bottom",
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function toPercentString(value: unknown, fallback: number, min = -100, max = 500) {
  return `${clampNumber(value, min, max, fallback)}%`;
}

function mapCategoryGapSliderToPercent(value: unknown) {
  const sliderValue = clampNumber(value, 0, 200, 36);
  if (sliderValue <= 100) {
    return Math.round((sliderValue / 100) * 80);
  }
  return Math.round(80 + ((sliderValue - 100) / 100) * 80);
}

function mapCategoryGapSliderToBarWidth(value: unknown) {
  const sliderValue = clampNumber(value, 0, 200, 36);
  if (sliderValue <= 100) {
    return `${Math.round(52 - (sliderValue / 100) * 28)}%`;
  }
  return `${Math.round(24 - ((sliderValue - 100) / 100) * 12)}%`;
}

function getHorizontalBarPalette(style: WidgetChartStyleConfig) {
  const configured = Array.isArray(style.horizontalBarPalette)
    ? style.horizontalBarPalette.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const inferredCount = configured.length >= 5 ? 5 : configured.length >= 3 ? 3 : 1;
  const explicitCount = [1, 3, 5].includes(Number(style.horizontalBarColorCount)) ? Number(style.horizontalBarColorCount) : null;
  const colorCount = explicitCount || inferredCount;
  const fallback = [
    style.barPrimaryColor || "#4e7cff",
    style.barSecondaryColor || "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
  const merged = fallback.map((color, index) => configured[index] || color);
  return merged.slice(0, colorCount);
}

function getMapRegionPalette(style: WidgetChartStyleConfig) {
  const configured = Array.isArray(style.mapRegionPalette)
    ? style.mapRegionPalette.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const fallback = ["#eef5ff", "#d5e6ff", "#9cc3ff", "#4f8cff", style.accentColor || "#1677ff"];
  return fallback.map((color, index) => configured[index] || color);
}

function applyHorizontalBarSort(option: Record<string, any>, sortOrder?: string | null) {
  if (!sortOrder || sortOrder === "none") return option;
  const seriesList = Array.isArray(option.series) ? option.series : [];
  const categoryAxis = option.yAxis && !Array.isArray(option.yAxis) ? option.yAxis : Array.isArray(option.yAxis) ? option.yAxis[0] : null;
  if (!categoryAxis || categoryAxis.type !== "category" || !Array.isArray(categoryAxis.data) || !seriesList.length) return option;
  const firstBar = seriesList.find((item: Record<string, any>) => item?.type === "bar");
  if (!firstBar || !Array.isArray(firstBar.data) || firstBar.data.length !== categoryAxis.data.length) return option;
  const pairs = categoryAxis.data.map((label: unknown, index: number) => ({
    label,
    index,
    value: Number(firstBar.data[index] ?? 0),
  }));
  pairs.sort((a: { value: number }, b: { value: number }) => sortOrder === "desc-top" ? b.value - a.value : a.value - b.value);
  const order = pairs.map((item: { index: number }) => item.index);
  const remapSeries = seriesList.map((item: Record<string, any>) => (
    Array.isArray(item.data)
      ? { ...item, data: order.map((idx: number) => item.data[idx]) }
      : item
  ));
  const remapAxis = {
    ...categoryAxis,
    inverse: true,
    data: order.map((idx: number) => categoryAxis.data[idx]),
  };
  return {
    ...option,
    series: remapSeries,
    yAxis: Array.isArray(option.yAxis)
      ? [remapAxis, ...option.yAxis.slice(1)]
      : remapAxis,
  };
}

function getSankeyPalette(style: WidgetChartStyleConfig) {
  const configured = Array.isArray(style.palette)
    ? style.palette.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    style.accentColor || style.barPrimaryColor || "#4e7cff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function buildSankeyNodeMeta(series: Record<string, any>) {
  const outgoing = new Set<string>();
  const incoming = new Set<string>();
  const links = Array.isArray(series.links) ? series.links : [];
  links.forEach((link: Record<string, any>) => {
    if (link?.source != null) outgoing.add(String(link.source));
    if (link?.target != null) incoming.add(String(link.target));
  });
  return { outgoing, incoming };
}

function resolveSankeyLabelPlacement(name: string, meta: { outgoing: Set<string>; incoming: Set<string> }) {
  const hasOutgoing = meta.outgoing.has(name);
  const hasIncoming = meta.incoming.has(name);
  if (!hasOutgoing && hasIncoming) {
    return { position: "left", align: "right" } as const;
  }
  return { position: "right", align: "left" } as const;
}

function applyClientSankeyStyle(
  option: Record<string, unknown>,
  chrome: WidgetChromeConfig | undefined,
  resolvedStyle: WidgetChartStyleConfig,
) {
  const nextOption = { ...(option || {}) } as Record<string, any>;
  const paddingPresetMap = {
    compact: { left: 4, right: 4, top: 4, bottom: 4 },
    comfortable: { left: 12, right: 12, top: 8, bottom: 8 },
    spacious: { left: 20, right: 20, top: 16, bottom: 16 },
  } as const;
  const resolvedPadding = paddingPresetMap[(chrome?.paddingPreset || "comfortable") as keyof typeof paddingPresetMap]
    || paddingPresetMap.comfortable;
  const palette = getSankeyPalette(resolvedStyle);
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  nextOption.series = nextOption.series.map((item: Record<string, any>) => {
    if (item?.type !== "sankey") {
      return item;
    }
    const meta = buildSankeyNodeMeta(item);
    const data = Array.isArray(item.data)
      ? item.data.map((node: any, index: number) => {
        const baseNode = node && typeof node === "object" && !Array.isArray(node)
          ? { ...node }
          : { name: String(node || "") };
        const name = String(baseNode.name || "");
        const placement = resolveSankeyLabelPlacement(name, meta);
        return {
          ...baseNode,
          itemStyle: {
            ...(baseNode.itemStyle || {}),
            color: palette[index % palette.length] || resolvedStyle.accentColor || baseNode.itemStyle?.color || "#1677ff",
            borderColor: resolvedStyle.sankeyNodeBorderColor || baseNode.itemStyle?.borderColor || "#ffffff",
            borderWidth: Number(resolvedStyle.sankeyNodeBorderWidth ?? baseNode.itemStyle?.borderWidth ?? 1),
            borderRadius: Number(resolvedStyle.sankeyNodeBorderRadius ?? baseNode.itemStyle?.borderRadius ?? 4),
          },
          label: {
            ...(baseNode.label || {}),
            show: resolvedStyle.showLabels !== false,
            position: baseNode.label?.position || placement.position,
            align: baseNode.label?.align || placement.align,
            verticalAlign: baseNode.label?.verticalAlign || "middle",
            distance: baseNode.label?.distance ?? 8,
            color: resolvedStyle.dataLabelColor || baseNode.label?.color || "#344054",
            fontSize: Number(resolvedStyle.dataLabelFontSize || baseNode.label?.fontSize || 14),
            fontWeight: Number(resolvedStyle.dataLabelFontWeight || baseNode.label?.fontWeight || 500),
          },
        };
      })
      : item.data;
    return {
      ...item,
      left: item.left ?? resolvedPadding.left,
      right: item.right ?? resolvedPadding.right,
      top: item.top ?? resolvedPadding.top,
      bottom: item.bottom ?? resolvedPadding.bottom,
      nodeAlign: item.nodeAlign || "justify",
      draggable: item.draggable ?? false,
      nodeWidth: Number(resolvedStyle.sankeyNodeWidth ?? item.nodeWidth ?? 16),
      nodeGap: Number(resolvedStyle.sankeyNodeGap ?? item.nodeGap ?? 18),
      emphasis: {
        focus: "adjacency",
        ...(item.emphasis || {}),
      },
      labelLayout: {
        hideOverlap: false,
        ...(item.labelLayout || {}),
      },
      lineStyle: {
        color: "gradient",
        ...(item.lineStyle || {}),
        opacity: Number(resolvedStyle.sankeyLinkOpacity ?? item.lineStyle?.opacity ?? 0.28),
        curveness: Number(resolvedStyle.sankeyLinkCurveness ?? item.lineStyle?.curveness ?? 0.5),
      },
      data,
    };
  });
  if (nextOption.legend) {
    nextOption.legend = { ...(nextOption.legend || {}), show: false };
  }
  return nextOption;
}

function getFunnelPalette(resolvedStyle: WidgetChartStyleConfig) {
  const configured = Array.isArray(resolvedStyle.palette)
    ? resolvedStyle.palette.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    resolvedStyle.accentColor || "#1677ff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function formatFunnelLabelValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

const CHROME_PADDING_PRESET_MAP = {
  compact: { left: 8, right: 8, top: 8, bottom: 8 },
  comfortable: { left: 18, right: 18, top: 16, bottom: 16 },
  spacious: { left: 28, right: 28, top: 24, bottom: 24 },
} as const;

function resolveChartLayoutMetrics(layoutBox?: ChartLayoutBox) {
  const width = Math.max(240, Number(layoutBox?.width || 0) || 240);
  const height = Math.max(160, Number(layoutBox?.height || 0) || 160);
  return {
    width,
    height,
    shortSide: Math.min(width, height),
    aspectRatio: width / Math.max(height, 1),
  };
}

function resolveResponsiveInset(
  dimension: number,
  ratio: number,
  min: number,
  max: number,
  fallback: number,
) {
  if (!Number.isFinite(dimension) || dimension <= 0) {
    return fallback;
  }
  return clampNumber(Math.round(dimension * ratio), min, max, fallback);
}

function resolveChartGridPadding(preset?: string | null, layoutBox?: ChartLayoutBox) {
  if (!layoutBox) {
    const fallbackMap = {
      compact: { left: 4, right: 4, top: 8, bottom: 4 },
      comfortable: { left: 18, right: 18, top: 24, bottom: 18 },
      spacious: { left: 40, right: 40, top: 52, bottom: 40 },
    } as const;
    return fallbackMap[(preset || "comfortable") as keyof typeof fallbackMap] || fallbackMap.comfortable;
  }
  const metrics = resolveChartLayoutMetrics(layoutBox);
  if (preset === "compact") {
    return {
      left: resolveResponsiveInset(metrics.width, 0.008, 2, 8, 4),
      right: resolveResponsiveInset(metrics.width, 0.008, 2, 8, 4),
      top: resolveResponsiveInset(metrics.height, 0.015, 4, 10, 8),
      bottom: resolveResponsiveInset(metrics.height, 0.015, 4, 10, 4),
    };
  }
  if (preset === "spacious") {
    return {
      left: resolveResponsiveInset(metrics.width, 0.035, 14, 40, 28),
      right: resolveResponsiveInset(metrics.width, 0.035, 14, 40, 28),
      top: resolveResponsiveInset(metrics.height, 0.05, 12, 52, 24),
      bottom: resolveResponsiveInset(metrics.height, 0.045, 12, 40, 24),
    };
  }
  return {
    left: resolveResponsiveInset(metrics.width, 0.02, 8, 18, 18),
    right: resolveResponsiveInset(metrics.width, 0.02, 8, 18, 18),
    top: resolveResponsiveInset(metrics.height, 0.03, 8, 24, 16),
    bottom: resolveResponsiveInset(metrics.height, 0.028, 8, 20, 16),
  };
}

function resolveChromePadding(preset?: string | null, layoutBox?: ChartLayoutBox) {
  if (!layoutBox) {
    return CHROME_PADDING_PRESET_MAP[(preset || "comfortable") as keyof typeof CHROME_PADDING_PRESET_MAP]
      || CHROME_PADDING_PRESET_MAP.comfortable;
  }
  const metrics = resolveChartLayoutMetrics(layoutBox);
  if (preset === "compact") {
    return {
      left: resolveResponsiveInset(metrics.width, 0.012, 4, 10, 8),
      right: resolveResponsiveInset(metrics.width, 0.012, 4, 10, 8),
      top: resolveResponsiveInset(metrics.height, 0.016, 4, 10, 8),
      bottom: resolveResponsiveInset(metrics.height, 0.016, 4, 10, 8),
    };
  }
  if (preset === "spacious") {
    return {
      left: resolveResponsiveInset(metrics.width, 0.028, 12, 28, 28),
      right: resolveResponsiveInset(metrics.width, 0.028, 12, 28, 28),
      top: resolveResponsiveInset(metrics.height, 0.04, 10, 24, 24),
      bottom: resolveResponsiveInset(metrics.height, 0.04, 10, 24, 24),
    };
  }
  return {
    left: resolveResponsiveInset(metrics.width, 0.018, 6, 18, 18),
    right: resolveResponsiveInset(metrics.width, 0.018, 6, 18, 18),
    top: resolveResponsiveInset(metrics.height, 0.026, 6, 16, 16),
    bottom: resolveResponsiveInset(metrics.height, 0.026, 6, 16, 16),
  };
}

function resolveLegendReserve(
  layoutBox: ChartLayoutBox | undefined,
  fontSize: number,
  direction: "horizontal" | "vertical",
) {
  const metrics = resolveChartLayoutMetrics(layoutBox);
  if (direction === "vertical") {
    return clampNumber(Math.round(fontSize * 2.4 + metrics.width * 0.025), 28, Math.max(44, Math.round(metrics.width * 0.16)), 42);
  }
  return clampNumber(Math.round(fontSize + metrics.height * 0.045), 16, Math.max(24, Math.round(metrics.height * 0.16)), 24);
}

function isNearDefaultChinaMapCenter(center: [number, number] | null | undefined) {
  if (!center) return true;
  return Math.abs(center[0] - 105) <= 4 && Math.abs(center[1] - 36) <= 4;
}

function shouldUseAutoMapViewport(mapStyle?: WidgetMapStyleConfig) {
  const center = normalizeMapCenterValue(mapStyle?.center);
  const zoom = normalizeMapZoomValue(mapStyle?.zoom);
  return (!zoom || Math.abs(zoom - 1) <= 0.08) && isNearDefaultChinaMapCenter(center);
}

function resolveAutoMapViewport(layoutBox?: ChartLayoutBox, hasVisualMap = false) {
  const metrics = resolveChartLayoutMetrics(layoutBox);
  const size = clampNumber(Math.round(86 + Math.min(16, Math.max(0, metrics.aspectRatio - 1) * 6)), 84, 102, 90);
  return {
    layoutCenter: [
      hasVisualMap ? (metrics.aspectRatio >= 1.8 ? "56%" : "54%") : "50%",
      metrics.aspectRatio >= 1.7 ? "54%" : "52%",
    ] as [string, string],
    layoutSize: `${size}%`,
  };
}

function resolveBarLabelPosition(isHorizontalBarChart: boolean, valuePosition?: string | null) {
  if (isHorizontalBarChart) {
    return valuePosition === "inside" ? "insideRight" : "right";
  }
  return valuePosition === "inside" ? "insideTop" : "top";
}

function applyClientFunnelStyle(
  option: Record<string, unknown>,
  chrome: WidgetChromeConfig | undefined,
  resolvedStyle: WidgetChartStyleConfig,
) {
  const nextOption = { ...(option || {}) } as Record<string, any>;
  const resolvedPadding = resolveChromePadding(chrome?.paddingPreset);
  const palette = getFunnelPalette(resolvedStyle);
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  nextOption.color = palette;
  nextOption.series = nextOption.series.map((item: Record<string, any>) => {
    if (item?.type !== "funnel") {
      return item;
    }
    const labelFontSize = Number(resolvedStyle.dataLabelFontSize || item.label?.fontSize || 14);
    const labelFontWeight = Number(resolvedStyle.dataLabelFontWeight || item.label?.fontWeight || 500);
    const labelColor = resolvedStyle.dataLabelColor || item.label?.color || "#344054";
    const valueColor = resolvedStyle.funnelValueColor || labelColor;
    const guideLineColor = resolvedStyle.funnelLabelLineColor || item.labelLine?.lineStyle?.color || "#98a2b3";
    const borderColor = resolvedStyle.funnelBlockBorderColor || item.itemStyle?.borderColor || "#ffffff";
    const borderWidth = Number(resolvedStyle.funnelBlockBorderWidth ?? item.itemStyle?.borderWidth ?? 1);
    const gap = Number(resolvedStyle.funnelItemGap ?? item.gap ?? 2);
    const sortOrder = resolvedStyle.funnelSortOrder || item.sort || "descending";
    const labelPosition = resolvedStyle.funnelLabelPosition === "inside" ? "inside" : "right";
    const showName = resolvedStyle.funnelShowName !== false;
    const showValue = resolvedStyle.funnelShowValue !== false;
    const showLabel = resolvedStyle.showLabels !== false && (showName || showValue);
    const data = Array.isArray(item.data)
      ? item.data.map((entry: any, index: number) => {
        const baseEntry = entry && typeof entry === "object" && !Array.isArray(entry)
          ? { ...entry }
          : { value: entry };
        return {
          ...baseEntry,
          itemStyle: {
            ...(baseEntry.itemStyle || {}),
            color: palette[index % palette.length] || resolvedStyle.accentColor || baseEntry.itemStyle?.color || "#1677ff",
            borderColor,
            borderWidth,
          },
        };
      })
      : item.data;
    return {
      ...item,
      left: item.left ?? resolvedPadding.left,
      right: item.right ?? resolvedPadding.right,
      top: item.top ?? resolvedPadding.top,
      bottom: item.bottom ?? resolvedPadding.bottom,
      sort: ["ascending", "descending", "none"].includes(String(sortOrder)) ? sortOrder : "descending",
      gap,
      itemStyle: {
        ...(item.itemStyle || {}),
        borderColor,
        borderWidth,
      },
      label: {
        ...(item.label || {}),
        show: showLabel,
        position: labelPosition,
        align: labelPosition === "inside" ? "center" : item.label?.align,
        verticalAlign: labelPosition === "inside" ? "middle" : item.label?.verticalAlign,
        color: labelColor,
        fontSize: labelFontSize,
        fontWeight: labelFontWeight,
        formatter: (params: { name?: string; value?: unknown }) => {
          const name = params?.name ? String(params.name) : "";
          const value = formatFunnelLabelValue(params?.value);
          if (showName && showValue) {
            if (name && value) return `{name|${name}}\n{value|${value}}`;
            if (name) return `{name|${name}}`;
            return value ? `{value|${value}}` : "";
          }
          if (showName) return name ? `{name|${name}}` : "";
          if (showValue) return value ? `{value|${value}}` : "";
          return "";
        },
        rich: {
          ...((item.label || {}).rich || {}),
          name: {
            color: labelColor,
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            lineHeight: labelFontSize + 4,
          },
          value: {
            color: valueColor,
            fontSize: Math.max(labelFontSize, labelFontSize + 1),
            fontWeight: 700,
            lineHeight: labelFontSize + 6,
          },
        },
      },
      labelLine: {
        ...(item.labelLine || {}),
        show: showLabel && labelPosition !== "inside",
        lineStyle: {
          ...((item.labelLine || {}).lineStyle || {}),
          color: guideLineColor,
        },
      },
      data,
    };
  });
  if (nextOption.legend) {
    delete nextOption.legend;
  }
  return nextOption;
}

function getWordCloudPalette(resolvedStyle: WidgetChartStyleConfig) {
  const configured = Array.isArray(resolvedStyle.palette)
    ? resolvedStyle.palette.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    resolvedStyle.accentColor || "#1677ff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function resolveWordCloudRotationRange(step: number) {
  return step <= 0 ? [0, 0] : [-90, 90];
}

function applyClientWordCloudStyle(
  option: Record<string, unknown>,
  chrome: WidgetChromeConfig | undefined,
  resolvedStyle: WidgetChartStyleConfig,
) {
  const nextOption = { ...(option || {}) } as Record<string, any>;
  const palette = getWordCloudPalette(resolvedStyle);
  const resolvedPadding = resolveChromePadding(chrome?.paddingPreset);
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  nextOption.color = palette;
  nextOption.series = nextOption.series.map((item: Record<string, any>) => {
    if (item?.type !== "wordCloud") {
      return item;
    }
    const shadowColor = resolvedStyle.wordCloudTextShadowColor || item.textStyle?.shadowColor || "rgba(15,23,42,0.14)";
    const shadowBlur = Number(resolvedStyle.wordCloudTextShadowBlur ?? item.textStyle?.shadowBlur ?? 10);
    const fontWeight = Number(resolvedStyle.wordCloudFontWeight ?? item.textStyle?.fontWeight ?? 700);
    const minFontSize = Number(resolvedStyle.wordCloudMinFontSize ?? item.sizeRange?.[0] ?? 12);
    const maxFontSize = Number(resolvedStyle.wordCloudMaxFontSize ?? item.sizeRange?.[1] ?? 40);
    const rotationStep = Number(resolvedStyle.wordCloudRotationStep ?? item.rotationStep ?? 45);
    const data = Array.isArray(item.data)
      ? item.data.map((entry: any, index: number) => {
        const baseEntry = entry && typeof entry === "object" && !Array.isArray(entry)
          ? { ...entry }
          : { name: String(entry || ""), value: 0 };
        return {
          ...baseEntry,
          textStyle: {
            ...(baseEntry.textStyle || {}),
            color: palette[index % palette.length] || resolvedStyle.accentColor || "#1677ff",
            fontWeight,
            shadowColor,
            shadowBlur,
          },
        };
      })
      : item.data;
    return {
      ...item,
      shape: resolvedStyle.wordCloudShape || item.shape || "circle",
      left: resolvedPadding.left,
      right: resolvedPadding.right,
      top: resolvedPadding.top,
      bottom: resolvedPadding.bottom,
      width: undefined,
      height: undefined,
      gridSize: Number(resolvedStyle.wordCloudGridSize ?? item.gridSize ?? 10),
      rotationStep,
      rotationRange: resolveWordCloudRotationRange(rotationStep),
      sizeRange: [
        Math.max(8, Math.min(minFontSize, maxFontSize)),
        Math.max(minFontSize, maxFontSize),
      ],
      drawOutOfBound: item.drawOutOfBound ?? false,
      textStyle: {
        ...(item.textStyle || {}),
        fontFamily: item.textStyle?.fontFamily || "sans-serif",
        fontWeight,
        shadowColor,
        shadowBlur,
      },
      emphasis: {
        ...(item.emphasis || {}),
        focus: item.emphasis?.focus || "self",
        textStyle: {
          ...(item.emphasis?.textStyle || {}),
          shadowColor,
          shadowBlur: Math.max(shadowBlur, shadowBlur + 4),
        },
      },
      data,
    };
  });
  if (nextOption.legend) {
    delete nextOption.legend;
  }
  return nextOption;
}

function mapLegacyCategoryGapToSlider(value: unknown) {
  const gapPercent = clampNumber(value, 0, 160, 36);
  if (gapPercent <= 80) {
    return Math.round((gapPercent / 80) * 100);
  }
  return Math.round(100 + ((gapPercent - 80) / 80) * 100);
}

export function normalizeChartStyleConfig(style: unknown, legacyChrome: unknown, accentColor?: string | null, palettePreset?: string | null): WidgetChartStyleConfig {
  const source = typeof style === "object" && style ? style as Record<string, unknown> : {};
  const legacy = typeof legacyChrome === "object" && legacyChrome ? legacyChrome as Record<string, unknown> : {};
  const base = buildDefaultChartStyleConfig();
  return {
    ...base,
    ...source,
    palettePreset: typeof source.palettePreset === "string" ? source.palettePreset : (palettePreset || base.palettePreset),
    accentColor: typeof source.accentColor === "string" ? source.accentColor : (accentColor || base.accentColor),
    showLegend: typeof source.showLegend === "boolean" ? source.showLegend : (typeof legacy.showLegend === "boolean" ? legacy.showLegend : base.showLegend),
    showAxis: typeof source.showAxis === "boolean" ? source.showAxis : (typeof legacy.showAxis === "boolean" ? legacy.showAxis : base.showAxis),
    showLabels: typeof source.showLabels === "boolean" ? source.showLabels : (typeof legacy.showLabels === "boolean" ? legacy.showLabels : base.showLabels),
    dataLabelColor: typeof source.dataLabelColor === "string" ? source.dataLabelColor : (typeof legacy.dataLabelColor === "string" ? legacy.dataLabelColor : base.dataLabelColor),
    dataLabelFontSize: Number(source.dataLabelFontSize ?? legacy.dataLabelFontSize ?? base.dataLabelFontSize),
    dataLabelFontWeight: Number(source.dataLabelFontWeight ?? legacy.dataLabelFontWeight ?? base.dataLabelFontWeight),
    legendPosition: (source.legendPosition as WidgetChartStyleConfig["legendPosition"]) || base.legendPosition,
    legendPrimaryName: typeof source.legendPrimaryName === "string" ? source.legendPrimaryName : base.legendPrimaryName,
    legendSecondaryName: typeof source.legendSecondaryName === "string" ? source.legendSecondaryName : base.legendSecondaryName,
    horizontalBarPalette: Array.isArray(source.horizontalBarPalette)
      ? source.horizontalBarPalette.map((item, index) => (typeof item === "string" && item.trim().length > 0 ? item : (base.horizontalBarPalette?.[index] || "")))
      : base.horizontalBarPalette,
    horizontalBarColorCount: [1, 3, 5].includes(Number(source.horizontalBarColorCount))
      ? Number(source.horizontalBarColorCount) as 1 | 3 | 5
      : ((Array.isArray(source.horizontalBarPalette) && source.horizontalBarPalette.filter((item) => typeof item === "string" && item.trim().length > 0).length >= 5)
        ? 5
        : ((Array.isArray(source.horizontalBarPalette) && source.horizontalBarPalette.filter((item) => typeof item === "string" && item.trim().length > 0).length >= 3)
          ? 3
          : (base.horizontalBarColorCount || 1))),
    horizontalBarSortOrder: (source.horizontalBarSortOrder as WidgetChartStyleConfig["horizontalBarSortOrder"]) || base.horizontalBarSortOrder,
    sankeyNodeWidth: Number(source.sankeyNodeWidth ?? base.sankeyNodeWidth),
    sankeyNodeGap: Number(source.sankeyNodeGap ?? base.sankeyNodeGap),
    sankeyNodeBorderColor: typeof source.sankeyNodeBorderColor === "string" ? source.sankeyNodeBorderColor : base.sankeyNodeBorderColor,
    sankeyNodeBorderWidth: Number(source.sankeyNodeBorderWidth ?? base.sankeyNodeBorderWidth),
    sankeyNodeBorderRadius: Number(source.sankeyNodeBorderRadius ?? base.sankeyNodeBorderRadius),
    sankeyLinkOpacity: Number(source.sankeyLinkOpacity ?? base.sankeyLinkOpacity),
    sankeyLinkCurveness: Number(source.sankeyLinkCurveness ?? base.sankeyLinkCurveness),
    gaugePointerColor: typeof source.gaugePointerColor === "string" ? source.gaugePointerColor : base.gaugePointerColor,
    gaugeDetailColor: typeof source.gaugeDetailColor === "string" ? source.gaugeDetailColor : base.gaugeDetailColor,
    gaugeTitleColor: typeof source.gaugeTitleColor === "string" ? source.gaugeTitleColor : base.gaugeTitleColor,
    gaugeMetricName: typeof source.gaugeMetricName === "string" || source.gaugeMetricName === null ? source.gaugeMetricName : base.gaugeMetricName,
    gaugeAxisLabelColor: typeof source.gaugeAxisLabelColor === "string" ? source.gaugeAxisLabelColor : base.gaugeAxisLabelColor,
    gaugeSplitLineColor: typeof source.gaugeSplitLineColor === "string" ? source.gaugeSplitLineColor : base.gaugeSplitLineColor,
    gaugeStartAngle: Number(source.gaugeStartAngle ?? base.gaugeStartAngle),
    gaugeEndAngle: Number(source.gaugeEndAngle ?? base.gaugeEndAngle),
    gaugeRadius: typeof source.gaugeRadius === "string" || typeof source.gaugeRadius === "number" ? source.gaugeRadius : base.gaugeRadius,
    gaugeProgressWidth: Number(source.gaugeProgressWidth ?? base.gaugeProgressWidth),
    gaugeAxisLineWidth: Number(source.gaugeAxisLineWidth ?? base.gaugeAxisLineWidth),
    gaugePointerLength: typeof source.gaugePointerLength === "string" || typeof source.gaugePointerLength === "number" ? source.gaugePointerLength : base.gaugePointerLength,
    gaugeDetailFontSize: Number(source.gaugeDetailFontSize ?? base.gaugeDetailFontSize),
    gaugeDetailFontWeight: Number(source.gaugeDetailFontWeight ?? base.gaugeDetailFontWeight),
    gaugeTitleFontSize: Number(source.gaugeTitleFontSize ?? base.gaugeTitleFontSize),
    funnelValueColor: typeof source.funnelValueColor === "string" ? source.funnelValueColor : base.funnelValueColor,
    funnelLabelLineColor: typeof source.funnelLabelLineColor === "string" ? source.funnelLabelLineColor : base.funnelLabelLineColor,
    funnelBlockBorderColor: typeof source.funnelBlockBorderColor === "string" ? source.funnelBlockBorderColor : base.funnelBlockBorderColor,
    funnelBlockBorderWidth: Number(source.funnelBlockBorderWidth ?? base.funnelBlockBorderWidth),
    funnelItemGap: Number(source.funnelItemGap ?? base.funnelItemGap),
    funnelSortOrder: (source.funnelSortOrder as WidgetChartStyleConfig["funnelSortOrder"]) || base.funnelSortOrder,
    funnelLabelPosition: (source.funnelLabelPosition as WidgetChartStyleConfig["funnelLabelPosition"]) || base.funnelLabelPosition,
    funnelShowName: typeof source.funnelShowName === "boolean" ? source.funnelShowName : base.funnelShowName,
    funnelShowValue: typeof source.funnelShowValue === "boolean" ? source.funnelShowValue : base.funnelShowValue,
    wordCloudShape: typeof source.wordCloudShape === "string" ? source.wordCloudShape : base.wordCloudShape,
    wordCloudGridSize: Number(source.wordCloudGridSize ?? base.wordCloudGridSize),
    wordCloudRotationStep: Number(source.wordCloudRotationStep ?? base.wordCloudRotationStep),
    wordCloudMinFontSize: Number(source.wordCloudMinFontSize ?? base.wordCloudMinFontSize),
    wordCloudMaxFontSize: Number(source.wordCloudMaxFontSize ?? base.wordCloudMaxFontSize),
    wordCloudFontWeight: Number(source.wordCloudFontWeight ?? base.wordCloudFontWeight),
    wordCloudTextShadowColor: typeof source.wordCloudTextShadowColor === "string" ? source.wordCloudTextShadowColor : base.wordCloudTextShadowColor,
    wordCloudTextShadowBlur: Number(source.wordCloudTextShadowBlur ?? base.wordCloudTextShadowBlur),
    scatterSymbolSize: Number(source.scatterSymbolSize ?? base.scatterSymbolSize),
    scatterPointBorderColor: typeof source.scatterPointBorderColor === "string" ? source.scatterPointBorderColor : base.scatterPointBorderColor,
    scatterPointBorderWidth: Number(source.scatterPointBorderWidth ?? base.scatterPointBorderWidth),
    scatterPointOpacity: Number(source.scatterPointOpacity ?? base.scatterPointOpacity),
    scatterLabelPosition: (source.scatterLabelPosition as WidgetChartStyleConfig["scatterLabelPosition"]) || base.scatterLabelPosition,
    lineWidth: Number(source.lineWidth ?? base.lineWidth),
    lineSmooth: typeof source.lineSmooth === "boolean" ? source.lineSmooth : base.lineSmooth,
    lineShowSymbol: typeof source.lineShowSymbol === "boolean" ? source.lineShowSymbol : base.lineShowSymbol,
    lineSymbolSize: Number(source.lineSymbolSize ?? base.lineSymbolSize),
    lineAreaOpacity: Number(source.lineAreaOpacity ?? base.lineAreaOpacity),
    lineLabelPosition: (source.lineLabelPosition as WidgetChartStyleConfig["lineLabelPosition"]) || base.lineLabelPosition,
    radarCenterX: typeof source.radarCenterX === "string" ? source.radarCenterX : base.radarCenterX,
    radarCenterY: typeof source.radarCenterY === "string" ? source.radarCenterY : base.radarCenterY,
    radarRadius: typeof source.radarRadius === "string" || typeof source.radarRadius === "number" ? source.radarRadius : base.radarRadius,
    radarShape: (source.radarShape as WidgetChartStyleConfig["radarShape"]) || base.radarShape,
    radarSplitNumber: Number(source.radarSplitNumber ?? base.radarSplitNumber),
    radarShowSplitArea: typeof source.radarShowSplitArea === "boolean" ? source.radarShowSplitArea : base.radarShowSplitArea,
    radarAreaOpacity: Number(source.radarAreaOpacity ?? base.radarAreaOpacity),
    radarLayout: (source.radarLayout as WidgetChartStyleConfig["radarLayout"]) || base.radarLayout,
    radarPrimaryColor: typeof source.radarPrimaryColor === "string" ? source.radarPrimaryColor : base.radarPrimaryColor,
    radarSecondaryColor: typeof source.radarSecondaryColor === "string" ? source.radarSecondaryColor : base.radarSecondaryColor,
    mapRegionPalette: Array.isArray(source.mapRegionPalette)
      ? source.mapRegionPalette.map((item, index) => (typeof item === "string" && item.trim().length > 0 ? item : (base.mapRegionPalette?.[index] || "")))
      : base.mapRegionPalette,
    mapRegionBorderColor: typeof source.mapRegionBorderColor === "string" ? source.mapRegionBorderColor : base.mapRegionBorderColor,
    mapLabelColor: typeof source.mapLabelColor === "string" ? source.mapLabelColor : base.mapLabelColor,
    mapVisualMapTextColor: typeof source.mapVisualMapTextColor === "string" ? source.mapVisualMapTextColor : base.mapVisualMapTextColor,
    extremaMaxColor: typeof source.extremaMaxColor === "string" ? source.extremaMaxColor : base.extremaMaxColor,
    extremaMinColor: typeof source.extremaMinColor === "string" ? source.extremaMinColor : base.extremaMinColor,
    barSeriesOverlap: clampNumber(source.barSeriesOverlap, -100, 100, clampNumber(source.barGap, -100, 500, 0)),
    barCategoryGapPercent: clampNumber(
      source.barCategoryGapPercent,
      0,
      200,
      mapLegacyCategoryGapToSlider(source.barCategoryGap)
    ),
    barGap: toPercentString(source.barSeriesOverlap ?? source.barGap, 0, -100, 100),
    barCategoryGap: `${mapCategoryGapSliderToPercent(source.barCategoryGapPercent ?? mapLegacyCategoryGapToSlider(source.barCategoryGap))}%`,
    pieVariant: (source.pieVariant as WidgetChartStyleConfig["pieVariant"]) || inferLegacyPieVariant(source, base.pieVariant),
    pieTheme: (source.pieTheme as WidgetChartStyleConfig["pieTheme"]) || base.pieTheme,
    pieInnerRadius: Number(source.pieInnerRadius ?? base.pieInnerRadius),
    pieOuterRadius: Number(source.pieOuterRadius ?? base.pieOuterRadius),
    pieStartAngle: Number(source.pieStartAngle ?? base.pieStartAngle),
    pieSweepAngle: Number(source.pieSweepAngle ?? base.pieSweepAngle),
    pieMinAngle: Number(source.pieMinAngle ?? base.pieMinAngle),
    pieRoseMode: (source.pieRoseMode as WidgetChartStyleConfig["pieRoseMode"]) || base.pieRoseMode,
    pieLabelMode: (source.pieLabelMode as WidgetChartStyleConfig["pieLabelMode"]) || base.pieLabelMode,
    pieShowCategory: typeof source.pieShowCategory === "boolean" ? source.pieShowCategory : base.pieShowCategory,
    pieShowPercent: typeof source.pieShowPercent === "boolean" ? source.pieShowPercent : base.pieShowPercent,
    pieShowValue: typeof source.pieShowValue === "boolean" ? source.pieShowValue : base.pieShowValue,
    pieValueFormat: (source.pieValueFormat as WidgetChartStyleConfig["pieValueFormat"]) || base.pieValueFormat,
    pieLabelColor: typeof source.pieLabelColor === "string" ? source.pieLabelColor : base.pieLabelColor,
    pieValueColor: typeof source.pieValueColor === "string" ? source.pieValueColor : base.pieValueColor,
    pieLabelFontSize: Number(source.pieLabelFontSize ?? base.pieLabelFontSize),
    pieValueFontSize: Number(source.pieValueFontSize ?? base.pieValueFontSize),
    pieLabelFontWeight: Number(source.pieLabelFontWeight ?? base.pieLabelFontWeight),
    pieValueFontWeight: Number(source.pieValueFontWeight ?? base.pieValueFontWeight),
    pieLabelLineShow: typeof source.pieLabelLineShow === "boolean" ? source.pieLabelLineShow : base.pieLabelLineShow,
    pieLabelLineColor: typeof source.pieLabelLineColor === "string" ? source.pieLabelLineColor : base.pieLabelLineColor,
    pieLabelLineWidth: Number(source.pieLabelLineWidth ?? base.pieLabelLineWidth),
    pieLabelLineLength: Number(source.pieLabelLineLength ?? base.pieLabelLineLength),
    pieLabelLineLength2: Number(source.pieLabelLineLength2 ?? base.pieLabelLineLength2),
    pieShowCenter: typeof source.pieShowCenter === "boolean" ? source.pieShowCenter : base.pieShowCenter,
    pieCenterTitle: typeof source.pieCenterTitle === "string" ? source.pieCenterTitle : base.pieCenterTitle,
    pieCenterValue: typeof source.pieCenterValue === "string" ? source.pieCenterValue : base.pieCenterValue,
    pieCenterUnit: typeof source.pieCenterUnit === "string" ? source.pieCenterUnit : base.pieCenterUnit,
    pieCenterSubtitle: typeof source.pieCenterSubtitle === "string" ? source.pieCenterSubtitle : base.pieCenterSubtitle,
    pieCenterTitleColor: typeof source.pieCenterTitleColor === "string" ? source.pieCenterTitleColor : base.pieCenterTitleColor,
    pieCenterValueColor: typeof source.pieCenterValueColor === "string" ? source.pieCenterValueColor : base.pieCenterValueColor,
    pieCenterUnitColor: typeof source.pieCenterUnitColor === "string" ? source.pieCenterUnitColor : base.pieCenterUnitColor,
    pieCenterMetaColor: typeof source.pieCenterMetaColor === "string" ? source.pieCenterMetaColor : base.pieCenterMetaColor,
    pieCenterTitleFontSize: Number(source.pieCenterTitleFontSize ?? base.pieCenterTitleFontSize),
    pieCenterValueFontSize: Number(source.pieCenterValueFontSize ?? base.pieCenterValueFontSize),
    pieCenterUnitFontSize: Number(source.pieCenterUnitFontSize ?? base.pieCenterUnitFontSize),
    pieCenterMetaFontSize: Number(source.pieCenterMetaFontSize ?? base.pieCenterMetaFontSize),
    pieSliceGap: Number(source.pieSliceGap ?? base.pieSliceGap),
    pieBorderRadius: Number(source.pieBorderRadius ?? base.pieBorderRadius),
    pieBorderWidth: Number(source.pieBorderWidth ?? base.pieBorderWidth),
    pieBorderColor: typeof source.pieBorderColor === "string" ? source.pieBorderColor : base.pieBorderColor,
    pieSortOrder: (source.pieSortOrder as WidgetChartStyleConfig["pieSortOrder"]) || base.pieSortOrder,
    pieMaxSlices: Number(source.pieMaxSlices ?? base.pieMaxSlices),
    pieMergeOthers: typeof source.pieMergeOthers === "boolean" ? source.pieMergeOthers : base.pieMergeOthers,
    pieOthersName: typeof source.pieOthersName === "string" ? source.pieOthersName : base.pieOthersName,
    pieLegendPosition: (source.pieLegendPosition as WidgetChartStyleConfig["pieLegendPosition"]) || base.pieLegendPosition,
    pieLegendShowValue: typeof source.pieLegendShowValue === "boolean" ? source.pieLegendShowValue : base.pieLegendShowValue,
    pieLegendShowPercent: typeof source.pieLegendShowPercent === "boolean" ? source.pieLegendShowPercent : base.pieLegendShowPercent,
    pieHoverScale: typeof source.pieHoverScale === "boolean" ? source.pieHoverScale : base.pieHoverScale,
    pieSelectedOffset: Number(source.pieSelectedOffset ?? base.pieSelectedOffset),
    pieShadowBlur: Number(source.pieShadowBlur ?? base.pieShadowBlur),
    pieShadowColor: typeof source.pieShadowColor === "string" ? source.pieShadowColor : base.pieShadowColor,
  };
}

function normalizeMapCenterValue(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function normalizeMapZoomValue(value: unknown): number | null {
  const zoom = Number(value);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : null;
}

export function normalizeMapStyleConfig(style: unknown, legacyChrome: unknown): WidgetMapStyleConfig {
  const source = typeof style === "object" && style ? style as Record<string, unknown> : {};
  const legacy = typeof legacyChrome === "object" && legacyChrome ? legacyChrome as Record<string, unknown> : {};
  const base = buildDefaultMapStyleConfig();
  return {
    ...base,
    ...source,
    provinceCode: typeof source.provinceCode === "string"
      ? source.provinceCode
      : (typeof legacy.provinceCode === "string" ? legacy.provinceCode : base.provinceCode),
    center: normalizeMapCenterValue(source.center) || normalizeMapCenterValue(legacy.center) || base.center,
    zoom: normalizeMapZoomValue(source.zoom ?? legacy.zoom) ?? base.zoom,
  };
}

function normalizeChartAnalysisConfig(config: unknown, legacyChrome: unknown): WidgetChartAnalysisConfig {
  const source = typeof config === "object" && config ? config as Record<string, unknown> : {};
  const legacy = typeof legacyChrome === "object" && legacyChrome ? legacyChrome as Record<string, unknown> : {};
  const base = buildDefaultChartAnalysisConfig();
  return {
    ...base,
    ...source,
    showExtrema: typeof source.showExtrema === "boolean" ? source.showExtrema : (typeof legacy.showExtrema === "boolean" ? legacy.showExtrema : base.showExtrema),
  };
}

export function normalizeKpiStyleConfig(style: unknown, legacyChrome: unknown, legacyKpi: unknown): WidgetKpiStyleConfig {
  const source = typeof style === "object" && style ? style as Record<string, unknown> : {};
  const legacyChromeSource = typeof legacyChrome === "object" && legacyChrome ? legacyChrome as Record<string, unknown> : {};
  const legacyKpiSource = typeof legacyKpi === "object" && legacyKpi ? legacyKpi as Record<string, unknown> : {};
  const base = buildDefaultKpiStyleConfig();
  return {
    ...base,
    ...source,
    themeKey: typeof source.themeKey === "string" ? source.themeKey : base.themeKey,
    themeMode: (source.themeMode as WidgetKpiStyleConfig["themeMode"]) || base.themeMode,
    itemSize: (source.itemSize as WidgetKpiStyleConfig["itemSize"]) || base.itemSize,
    multiValueLayout: (source.multiValueLayout as WidgetKpiStyleConfig["multiValueLayout"]) || base.multiValueLayout,
    contentOrientation: (source.contentOrientation as WidgetKpiStyleConfig["contentOrientation"]) || base.contentOrientation,
    itemsPerRow: Math.max(1, Number(source.itemsPerRow ?? base.itemsPerRow)),
    itemsPerColumn: Math.max(1, Number(source.itemsPerColumn ?? base.itemsPerColumn)),
    itemMinWidth: Math.max(120, Number(source.itemMinWidth ?? base.itemMinWidth)),
    showDivider: typeof source.showDivider === "boolean" ? source.showDivider : base.showDivider,
    dividerStyle: (source.dividerStyle as WidgetKpiStyleConfig["dividerStyle"]) || base.dividerStyle,
    dividerWidth: Math.max(1, Number(source.dividerWidth ?? base.dividerWidth)),
    dividerColor: typeof source.dividerColor === "string" ? source.dividerColor : base.dividerColor,
    itemGap: Math.max(8, Number(source.itemGap ?? base.itemGap)),
    itemAlign: (source.itemAlign as WidgetKpiStyleConfig["itemAlign"]) || base.itemAlign,
    itemBackgroundColor: typeof source.itemBackgroundColor === "string" ? source.itemBackgroundColor : base.itemBackgroundColor,
    itemBorderColor: typeof source.itemBorderColor === "string" ? source.itemBorderColor : base.itemBorderColor,
    itemBorderWidth: Math.max(0, Number(source.itemBorderWidth ?? base.itemBorderWidth)),
    itemBorderRadius: Math.max(0, Number(source.itemBorderRadius ?? base.itemBorderRadius)),
    flipperBackground: typeof source.flipperBackground === "string" ? source.flipperBackground : base.flipperBackground,
    flipperRefreshSeconds: Math.max(0.2, Number(
      source.flipperRefreshSeconds
      ?? (source.flipperRefreshMs != null ? Number(source.flipperRefreshMs) / 1000 : undefined)
      ?? base.flipperRefreshSeconds
      ?? 1.2
    )),
    flipperGap: Math.max(2, Number(source.flipperGap ?? base.flipperGap)),
    flipperDigitWidth: Math.max(32, Number(source.flipperDigitWidth ?? base.flipperDigitWidth)),
    flipperDigitHeight: Math.max(32, Number(source.flipperDigitHeight ?? base.flipperDigitHeight)),
    flipperDigitRadius: Math.max(0, Number(source.flipperDigitRadius ?? base.flipperDigitRadius)),
    hoverElevated: typeof source.hoverElevated === "boolean" ? source.hoverElevated : base.hoverElevated,
    trendColorMode: (source.trendColorMode as WidgetKpiStyleConfig["trendColorMode"]) || base.trendColorMode,
    showValue: typeof source.showValue === "boolean" ? source.showValue : (typeof legacyChromeSource.showValue === "boolean" ? legacyChromeSource.showValue : base.showValue),
    valueColor: typeof source.valueColor === "string" ? source.valueColor : (typeof legacyChromeSource.valueColor === "string" ? legacyChromeSource.valueColor : base.valueColor),
    valueFontSize: Number(source.valueFontSize ?? legacyChromeSource.valueFontSize ?? base.valueFontSize),
    valueFontWeight: Number(source.valueFontWeight ?? legacyChromeSource.valueFontWeight ?? base.valueFontWeight),
    valuePrefixColor: typeof source.valuePrefixColor === "string" ? source.valuePrefixColor : (typeof legacyChromeSource.valuePrefixColor === "string" ? legacyChromeSource.valuePrefixColor : (typeof source.valueColor === "string" ? source.valueColor : (typeof legacyChromeSource.valueColor === "string" ? legacyChromeSource.valueColor : base.valuePrefixColor))),
    valuePrefixFontSize: Number(source.valuePrefixFontSize ?? legacyChromeSource.valuePrefixFontSize ?? Math.max(12, Number(source.valueFontSize ?? legacyChromeSource.valueFontSize ?? base.valueFontSize) - 14)),
    valueSuffixColor: typeof source.valueSuffixColor === "string" ? source.valueSuffixColor : (typeof legacyChromeSource.valueSuffixColor === "string" ? legacyChromeSource.valueSuffixColor : (typeof source.valueColor === "string" ? source.valueColor : (typeof legacyChromeSource.valueColor === "string" ? legacyChromeSource.valueColor : base.valueSuffixColor))),
    valueSuffixFontSize: Number(source.valueSuffixFontSize ?? legacyChromeSource.valueSuffixFontSize ?? Math.max(12, Number(source.valueFontSize ?? legacyChromeSource.valueFontSize ?? base.valueFontSize) - 14)),
    showMetricLabel: typeof source.showMetricLabel === "boolean" ? source.showMetricLabel : (typeof legacyKpiSource.showMetricLabel === "boolean" ? legacyKpiSource.showMetricLabel : base.showMetricLabel),
    metricLabelColor: typeof source.metricLabelColor === "string" ? source.metricLabelColor : (typeof legacyKpiSource.metricLabelColor === "string" ? legacyKpiSource.metricLabelColor : base.metricLabelColor),
    metricLabelFontSize: Number(source.metricLabelFontSize ?? legacyKpiSource.metricLabelFontSize ?? base.metricLabelFontSize),
    metricLabelFontWeight: Number(source.metricLabelFontWeight ?? legacyKpiSource.metricLabelFontWeight ?? base.metricLabelFontWeight),
    compareLabelColor: typeof source.compareLabelColor === "string" ? source.compareLabelColor : (typeof legacyKpiSource.compareLabelColor === "string" ? legacyKpiSource.compareLabelColor : base.compareLabelColor),
    compareLabelFontSize: Number(source.compareLabelFontSize ?? legacyKpiSource.compareLabelFontSize ?? base.compareLabelFontSize),
    compareLabelFontWeight: Number(source.compareLabelFontWeight ?? legacyKpiSource.compareLabelFontWeight ?? base.compareLabelFontWeight),
  };
}

export function normalizeKpiAnalysisConfig(config: unknown, legacyKpi: unknown): WidgetKpiAnalysisConfig {
  const source = typeof config === "object" && config ? config as Record<string, unknown> : {};
  const legacy = typeof legacyKpi === "object" && legacyKpi ? legacyKpi as Record<string, unknown> : {};
  const base = buildDefaultKpiAnalysisConfig();
  return {
    ...base,
    ...source,
    showTrend: typeof source.showTrend === "boolean" ? source.showTrend : (typeof legacy.showTrend === "boolean" ? legacy.showTrend : base.showTrend),
  };
}

export function normalizeTableStyleConfig(style: unknown, legacyTable: unknown): WidgetTableStyleConfig {
  const source = typeof style === "object" && style ? style as Record<string, unknown> : {};
  const legacy = typeof legacyTable === "object" && legacyTable ? legacyTable as Record<string, unknown> : {};
  const base = buildDefaultTableStyleConfig();
  return {
    ...base,
    ...source,
    compact: typeof source.compact === "boolean" ? source.compact : (typeof legacy.compact === "boolean" ? legacy.compact : base.compact),
    striped: typeof source.striped === "boolean" ? source.striped : (typeof legacy.striped === "boolean" ? legacy.striped : base.striped),
    showIndex: typeof source.showIndex === "boolean" ? source.showIndex : (typeof legacy.showIndex === "boolean" ? legacy.showIndex : base.showIndex),
  };
}

export function normalizeTabsStyleConfig(style: unknown): WidgetTabsStyleConfig {
  const source = typeof style === "object" && style ? style as Record<string, unknown> : {};
  return {
    ...buildDefaultTabsStyleConfig(),
    ...source,
  };
}

function normalizeRichTextStyleConfig(style: unknown, legacyRichText: unknown): WidgetRichTextStyleConfig {
  const source = typeof style === "object" && style ? style as Record<string, unknown> : {};
  const legacy = typeof legacyRichText === "object" && legacyRichText ? legacyRichText as Record<string, unknown> : {};
  const base = buildDefaultRichTextStyleConfig();
  return {
    ...base,
    ...source,
    fontSize: Number(source.fontSize ?? legacy.fontSize ?? base.fontSize),
    fontWeight: Number(source.fontWeight ?? legacy.fontWeight ?? base.fontWeight),
    color: typeof source.color === "string" ? source.color : (typeof legacy.color === "string" ? legacy.color : base.color),
    align: (source.align as WidgetRichTextStyleConfig["align"]) || (legacy.align as WidgetRichTextStyleConfig["align"]) || base.align,
  };
}

function normalizeImageStyleConfig(style: unknown, legacyImage: unknown): WidgetImageStyleConfig {
  const source = typeof style === "object" && style ? style as Record<string, unknown> : {};
  const legacy = typeof legacyImage === "object" && legacyImage ? legacyImage as Record<string, unknown> : {};
  const base = buildDefaultImageStyleConfig();
  return {
    ...base,
    ...source,
    objectFit: (source.objectFit as WidgetImageStyleConfig["objectFit"]) || (legacy.objectFit as WidgetImageStyleConfig["objectFit"]) || base.objectFit,
    borderRadius: Number(source.borderRadius ?? legacy.borderRadius ?? base.borderRadius),
  };
}

function isPreviewBackedWidget(widgetType?: WidgetType | string | null) {
  return widgetType === "chart" || widgetType === "kpi" || widgetType === "table" || widgetType === "tabs";
}

let chinaMapRegistered = false;
const chinaProvinceMapRegistry = new Set<string>();
const CHINA_REGION_GEOJSON_BASE_URL = "https://geo.datav.aliyun.com/areas_v3/bound";
const chinaRegionGeoJsonCache = new Map<string, Promise<any | null>>();
const chinaRegionAdcodeNameCache = new Map<string, Map<string, string>>();
const chinaProvinceAdcodeNameMap = new Map<string, string>(
  Array.isArray((chinaGeoJson as any).features)
    ? (chinaGeoJson as any).features.map((feature: any) => [
      String(feature?.properties?.adcode || ""),
      String(feature?.properties?.name || ""),
    ])
    : []
);
const chinaProvinceNameAdcodeMap = new Map<string, string>();

function normalizeChinaRegionName(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, "");
}

for (const [adcode, name] of chinaProvinceAdcodeNameMap.entries()) {
  const normalizedName = normalizeChinaRegionName(name);
  if (normalizedName) {
    chinaProvinceNameAdcodeMap.set(normalizedName, adcode);
  }
}

function ensureChinaMapRegistered() {
  if (chinaMapRegistered) return;
  echarts.registerMap("china", chinaGeoJson as never);
  chinaMapRegistered = true;
}

function getChinaProvinceGeoJson(provinceCode?: string | null) {
  const adcode = Number(provinceCode || 0);
  if (!adcode || !Array.isArray((chinaGeoJson as any).features)) {
    return null;
  }
  const matchedFeature = (chinaGeoJson as any).features.find(
    (feature: any) => Number(feature?.properties?.adcode || 0) === adcode
  );
  if (!matchedFeature) {
    return null;
  }
  return {
    type: "FeatureCollection",
    features: [matchedFeature],
  };
}

function ensureChinaRegionMapRegistered(provinceCode?: string | null) {
  ensureChinaMapRegistered();
  const mapName = String(provinceCode || "").trim();
  if (!mapName) {
    return "china";
  }
  if (chinaProvinceMapRegistry.has(mapName)) {
    return mapName;
  }
  const provinceGeoJson = getChinaProvinceGeoJson(mapName);
  if (!provinceGeoJson) {
    return "china";
  }
  echarts.registerMap(mapName, provinceGeoJson as never);
  chinaProvinceMapRegistry.add(mapName);
  return mapName;
}

function normalizeChinaAdcode(value?: string | number | null) {
  const digits = String(value ?? "").trim().replace(/\D/g, "");
  return digits.length === 6 ? digits : "";
}

function normalizeChinaMapRegionAdcode(value?: string | number | null) {
  const rawValue = value == null ? "" : String(value).trim();
  const strictCode = normalizeChinaAdcode(rawValue);
  if (strictCode) return strictCode;
  const digits = rawValue.replace(/\D/g, "");
  if (digits.length === 2) return `${digits}0000`;
  if (digits.length === 4) return `${digits}00`;
  if (digits.length === 5) return `${digits}0`;
  const normalizedName = normalizeChinaRegionName(rawValue);
  return normalizedName ? (chinaProvinceNameAdcodeMap.get(normalizedName) || "") : "";
}

function isProvinceLevelAdcode(adcode?: string | null) {
  const code = normalizeChinaAdcode(adcode);
  return Boolean(code && code.endsWith("0000"));
}

function isCityLevelAdcode(adcode?: string | null) {
  const code = normalizeChinaAdcode(adcode);
  return Boolean(code && code.endsWith("00") && !code.endsWith("0000"));
}

function isDistrictLevelAdcode(adcode?: string | null) {
  const code = normalizeChinaAdcode(adcode);
  return Boolean(code && !code.endsWith("00"));
}

function toProvinceLevelAdcode(adcode?: string | null) {
  const code = normalizeChinaAdcode(adcode);
  return code ? `${code.slice(0, 2)}0000` : "";
}

function toCityLevelAdcode(adcode?: string | null) {
  const code = normalizeChinaAdcode(adcode);
  if (!code) return "";
  if (isProvinceLevelAdcode(code)) return "";
  return `${code.slice(0, 4)}00`;
}

function normalizeChinaFeatureCollection(input: any) {
  const features = Array.isArray(input?.features)
    ? input.features.map((feature: any) => ({
      ...feature,
      properties: {
        ...(feature?.properties || {}),
        adcode: normalizeChinaAdcode(feature?.properties?.adcode) || String(feature?.properties?.adcode || ""),
        parent: feature?.properties?.parent
          ? {
            ...feature.properties.parent,
            adcode: normalizeChinaAdcode(feature.properties.parent.adcode) || String(feature.properties.parent.adcode || ""),
          }
          : feature?.properties?.parent,
      },
    }))
    : [];
  return {
    ...(input || {}),
    type: "FeatureCollection",
    features,
  };
}

function buildChinaAdcodeNameMap(geoJson: any) {
  return new Map<string, string>(
    Array.isArray(geoJson?.features)
      ? geoJson.features
        .map((feature: any) => [
          normalizeChinaAdcode(feature?.properties?.adcode) || String(feature?.properties?.adcode || ""),
          String(feature?.properties?.name || ""),
        ] as const)
        .filter((entry: readonly [string, string]) => Boolean(entry[0] && entry[1]))
      : []
  );
}

async function fetchChinaRegionGeoJson(adcode?: string | null) {
  const normalizedAdcode = normalizeChinaAdcode(adcode);
  if (!normalizedAdcode) {
    return null;
  }
  const cacheKey = `${normalizedAdcode}_full`;
  if (!chinaRegionGeoJsonCache.has(cacheKey)) {
    chinaRegionGeoJsonCache.set(
      cacheKey,
      fetch(`${CHINA_REGION_GEOJSON_BASE_URL}/${cacheKey}.json`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load geojson for ${normalizedAdcode}`);
          }
          return response.json();
        })
        .then((payload) => normalizeChinaFeatureCollection(payload))
        .catch(() => null)
    );
  }
  return chinaRegionGeoJsonCache.get(cacheKey) || null;
}

async function ensureChinaDynamicMapRegistered(
  provinceCode?: string | null,
  rawAdcodes: string[] = []
) {
  ensureChinaMapRegistered();
  const normalizedProvinceCode = normalizeChinaAdcode(provinceCode);
  if (!normalizedProvinceCode) {
    return {
      mapName: "china",
      scopeMode: "province" as const,
      adcodeNameMap: chinaProvinceAdcodeNameMap,
    };
  }

  const provincePrefix = normalizedProvinceCode.slice(0, 2);
  const normalizedCodes = rawAdcodes
    .map((item) => normalizeChinaAdcode(item))
    .filter((item) => item && item.startsWith(provincePrefix));
  const districtCodes = normalizedCodes.filter((item) => isDistrictLevelAdcode(item));
  const hasOnlyDistrictCodes = districtCodes.length > 0 && districtCodes.length === normalizedCodes.length;

  if (hasOnlyDistrictCodes) {
    const cityCodes = Array.from(new Set(districtCodes.map((item) => toCityLevelAdcode(item)).filter(Boolean))).sort();
    const mapName = `${normalizedProvinceCode}__district__${cityCodes.join("_")}`;
    if (!chinaProvinceMapRegistry.has(mapName)) {
      const geoJsonList = await Promise.all(cityCodes.map((item) => fetchChinaRegionGeoJson(item)));
      const features = geoJsonList.flatMap((item) => (Array.isArray(item?.features) ? item.features : []));
      if (features.length > 0) {
        const mergedGeoJson = normalizeChinaFeatureCollection({ type: "FeatureCollection", features });
        echarts.registerMap(mapName, mergedGeoJson as never);
        chinaProvinceMapRegistry.add(mapName);
        chinaRegionAdcodeNameCache.set(mapName, buildChinaAdcodeNameMap(mergedGeoJson));
      }
    }
    if (chinaProvinceMapRegistry.has(mapName)) {
      return {
        mapName,
        scopeMode: "district" as const,
        adcodeNameMap: chinaRegionAdcodeNameCache.get(mapName) || new Map<string, string>(),
      };
    }
  }

  if (normalizedCodes.some((item) => isCityLevelAdcode(item) || isDistrictLevelAdcode(item))) {
    const mapName = `${normalizedProvinceCode}__city`;
    if (!chinaProvinceMapRegistry.has(mapName)) {
      const provinceGeoJson = await fetchChinaRegionGeoJson(normalizedProvinceCode);
      if (provinceGeoJson && Array.isArray(provinceGeoJson.features) && provinceGeoJson.features.length > 0) {
        echarts.registerMap(mapName, provinceGeoJson as never);
        chinaProvinceMapRegistry.add(mapName);
        chinaRegionAdcodeNameCache.set(mapName, buildChinaAdcodeNameMap(provinceGeoJson));
      }
    }
    if (chinaProvinceMapRegistry.has(mapName)) {
      return {
        mapName,
        scopeMode: "city" as const,
        adcodeNameMap: chinaRegionAdcodeNameCache.get(mapName) || new Map<string, string>(),
      };
    }
  }

  const provinceMapName = ensureChinaRegionMapRegistered(normalizedProvinceCode);
  const provinceName = chinaProvinceAdcodeNameMap.get(normalizedProvinceCode) || normalizedProvinceCode;
  return {
    mapName: provinceMapName,
    scopeMode: "singleProvince" as const,
    adcodeNameMap: new Map<string, string>([[normalizedProvinceCode, provinceName]]),
  };
}

function getCanvasRatioValue(preset?: string | null) {
  return CANVAS_RATIO_OPTIONS.find((item) => item.value === preset)?.ratio || 16 / 9;
}

function getWidgetMappingFields(widget?: CanvasWidgetDraft | null, asset?: ReportingChartAssetRecord | null) {
  if (!widget) return [];
  if (widget.widgetType === "chart" && getPrimaryChartFamily(asset) === "bar") {
    return [
      { key: "xField", label: "分类字段" },
      { key: "yField", label: "指标字段一" },
      { key: "yField2", label: "指标字段二（可选）" },
    ];
  }
  if (widget.widgetType === "chart" && getPrimaryChartFamily(asset) === "radar") {
    return [
      { key: "nameField", label: "指标名称字段" },
      { key: "valueField", label: "指标字段一" },
      { key: "valueField2", label: "指标字段二（可选）" },
    ];
  }
  if (widget.widgetType === "kpi") {
    return [
      { key: "valueField", label: "主值字段" },
      { key: "compareField", label: "对比值字段" },
      { key: "labelField", label: "名称字段 / 指标名称" },
    ];
  }
  if (widget.widgetType === "table" || widget.widgetType === "tabs") {
    return [];
  }
  const assetFields = getAssetMappingFields(asset);
  if (widget.widgetType === "chart" && getPrimaryChartFamily(asset) === "horizontalBar") {
    const categoryField = assetFields.find((item) => item.key === "yField");
    const valueField = assetFields.find((item) => item.key === "xField");
    const remainingFields = assetFields.filter((item) => item.key !== "yField" && item.key !== "xField");
    return [categoryField, valueField, ...remainingFields].filter(Boolean) as Array<{ key: string; label?: string; required?: boolean }>;
  }
  return assetFields;
}

function getGaugePalette(resolvedStyle: WidgetChartStyleConfig) {
  const configured = Array.isArray(resolvedStyle.palette)
    ? resolvedStyle.palette.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (configured.length) {
    return configured;
  }
  return [
    resolvedStyle.accentColor || "#1677ff",
    "#55c6a9",
    "#f4b95d",
    "#8f7cff",
    "#f28f8f",
  ];
}

function normalizeGaugeLength(value: string | number | null | undefined, fallback: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

const RADIAL_CHART_PADDING_PRESET_MAP = {
  compact: { percentOffset: 0, pixelOffset: 0 },
  comfortable: { percentOffset: 4, pixelOffset: 12 },
  spacious: { percentOffset: 10, pixelOffset: 28 },
} as const;

function resolveRadialChartPadding(preset?: string | null) {
  return RADIAL_CHART_PADDING_PRESET_MAP[(preset || "comfortable") as keyof typeof RADIAL_CHART_PADDING_PRESET_MAP]
    || RADIAL_CHART_PADDING_PRESET_MAP.comfortable;
}

function applyPaddingToChartDimension(
  value: string | number | null | undefined,
  fallback: string | number,
  padding: { percentOffset: number; pixelOffset: number }
) {
  const base = normalizeGaugeLength(value, fallback);
  if (typeof base === "number" && Number.isFinite(base)) {
    return Math.max(24, base - padding.pixelOffset);
  }
  if (typeof base === "string") {
    const trimmed = base.trim();
    const percentMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (percentMatch) {
      return `${Math.max(20, Number(percentMatch[1]) - padding.percentOffset)}%`;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return Math.max(24, numeric - padding.pixelOffset);
    }
    return trimmed;
  }
  return base;
}

function resolveSeriesBoxLayoutValue(
  value: unknown,
  fallback: number,
  side: "left" | "right" | "top" | "bottom"
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    if (trimmed === side) {
      return fallback;
    }
    return trimmed;
  }
  return fallback;
}

function buildGaugeAxisLineColors(palette: string[]) {
  if (!palette.length) {
    return [[1, "#1677ff"]] as Array<[number, string]>;
  }
  return palette.map((color, index) => [Number(((index + 1) / palette.length).toFixed(4)), color] as [number, string]);
}

function applyClientGaugeStyle(
  option: Record<string, unknown>,
  chrome: WidgetChromeConfig | undefined,
  resolvedStyle: WidgetChartStyleConfig,
) {
  const nextOption = { ...(option || {}) } as Record<string, any>;
  const palette = getGaugePalette(resolvedStyle);
  const radialPadding = resolveRadialChartPadding(chrome?.paddingPreset);
  const configuredMetricName = typeof resolvedStyle.gaugeMetricName === "string" ? resolvedStyle.gaugeMetricName : null;
  if (!Array.isArray(nextOption.series)) {
    return nextOption;
  }
  const pointerColor = resolvedStyle.gaugePointerColor || resolvedStyle.accentColor || palette[0] || "#1677ff";
  const detailColor = resolvedStyle.gaugeDetailColor || "#101828";
  const titleColor = resolvedStyle.gaugeTitleColor || "#667085";
  const axisLabelColor = resolvedStyle.gaugeAxisLabelColor || "#344054";
  const splitLineColor = resolvedStyle.gaugeSplitLineColor || "#98a2b3";
  const progressWidth = Number(resolvedStyle.gaugeProgressWidth ?? 18);
  const axisLineWidth = Number(resolvedStyle.gaugeAxisLineWidth ?? progressWidth);
  nextOption.color = palette;
  nextOption.series = nextOption.series.map((item: Record<string, any>) => {
    if (item?.type !== "gauge") {
      return item;
    }
    return {
      ...item,
      startAngle: Number(resolvedStyle.gaugeStartAngle ?? item.startAngle ?? 210),
      endAngle: Number(resolvedStyle.gaugeEndAngle ?? item.endAngle ?? -30),
      radius: applyPaddingToChartDimension(resolvedStyle.gaugeRadius, item.radius || "90%", radialPadding),
      data: Array.isArray(item.data)
        ? item.data.map((entry: Record<string, any>) => ({
          ...entry,
          name: configuredMetricName ?? entry?.name ?? "指标",
        }))
        : item.data,
      progress: {
        ...(item.progress || {}),
        show: item.progress?.show ?? true,
        roundCap: item.progress?.roundCap ?? true,
        width: progressWidth,
        itemStyle: {
          ...(item.progress?.itemStyle || {}),
          color: pointerColor,
        },
      },
      axisLine: {
        ...(item.axisLine || {}),
        roundCap: item.axisLine?.roundCap ?? true,
        lineStyle: {
          ...((item.axisLine || {}).lineStyle || {}),
          width: axisLineWidth,
          color: buildGaugeAxisLineColors(palette),
        },
      },
      pointer: {
        ...(item.pointer || {}),
        show: item.pointer?.show ?? true,
        length: normalizeGaugeLength(resolvedStyle.gaugePointerLength, item.pointer?.length || "58%"),
        itemStyle: {
          ...(item.pointer?.itemStyle || {}),
          color: pointerColor,
        },
      },
      anchor: {
        ...(item.anchor || {}),
        show: item.anchor?.show ?? true,
        showAbove: item.anchor?.showAbove ?? true,
        size: item.anchor?.size ?? 10,
        itemStyle: {
          ...(item.anchor?.itemStyle || {}),
          color: pointerColor,
        },
      },
      itemStyle: {
        ...(item.itemStyle || {}),
        color: pointerColor,
      },
      axisTick: {
        ...(item.axisTick || {}),
        lineStyle: {
          ...((item.axisTick || {}).lineStyle || {}),
          color: splitLineColor,
        },
      },
      splitLine: {
        ...(item.splitLine || {}),
        lineStyle: {
          ...((item.splitLine || {}).lineStyle || {}),
          color: splitLineColor,
        },
      },
      axisLabel: {
        ...(item.axisLabel || {}),
        color: axisLabelColor,
      },
      title: {
        ...(item.title || {}),
        show: item.title?.show ?? true,
        color: titleColor,
        fontSize: Number(resolvedStyle.gaugeTitleFontSize ?? item.title?.fontSize ?? 14),
      },
      detail: {
        ...(item.detail || {}),
        show: item.detail?.show ?? true,
        color: detailColor,
        fontSize: Number(resolvedStyle.gaugeDetailFontSize ?? item.detail?.fontSize ?? 24),
        fontWeight: Number(resolvedStyle.gaugeDetailFontWeight ?? item.detail?.fontWeight ?? 700),
      },
    };
  });
  if (nextOption.legend) {
    nextOption.legend = { ...(nextOption.legend || {}), show: false };
  }
  return nextOption;
}

function chromePaddingToPiePadding(preset?: string | null) {
  if (preset === "compact") {
    return { radiusOffset: 0, centerXOffset: 0, centerYOffset: 0 };
  }
  if (preset === "spacious") {
    return { radiusOffset: 10, centerXOffset: 0, centerYOffset: -2 };
  }
  return { radiusOffset: 5, centerXOffset: 0, centerYOffset: -1 };
}

function applyClientChartStyle(
  option: Record<string, unknown> | undefined,
  chrome?: WidgetChromeConfig,
  chartStyle?: WidgetChartStyleConfig,
  mapStyle?: WidgetMapStyleConfig,
  chartAnalysis?: WidgetChartAnalysisConfig,
  layoutBox?: ChartLayoutBox,
) {
  const nextOption = { ...(option || {}) } as Record<string, any>;
  delete nextOption.title;
  const resolvedStyle = {
    ...(chartStyle || buildDefaultChartStyleConfig()),
  } as WidgetChartStyleConfig;
  const isSankeyChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "sankey");
  if (isSankeyChart) {
    return applyClientSankeyStyle(nextOption, chrome, resolvedStyle);
  }
  const isFunnelChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "funnel");
  if (isFunnelChart) {
    return applyClientFunnelStyle(nextOption, chrome, resolvedStyle);
  }
  const isWordCloudChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "wordCloud");
  if (isWordCloudChart) {
    return applyClientWordCloudStyle(nextOption, chrome, resolvedStyle);
  }
  const isGaugeChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "gauge");
  if (isGaugeChart) {
    return applyClientGaugeStyle(nextOption, chrome, resolvedStyle);
  }
  const isHorizontalBarChart = Array.isArray(nextOption.series)
    && nextOption.series.some((item: Record<string, any>) => item?.type === "bar")
    && ((Array.isArray(nextOption.yAxis) ? nextOption.yAxis[0] : nextOption.yAxis)?.type === "category");
  const isLineChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "line");
  const isScatterChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "scatter");
  const isRadarChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "radar");
  const isMapChart = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "map");
  const lineSeriesCount = Array.isArray(nextOption.series) ? nextOption.series.filter((item: Record<string, any>) => item?.type === "line").length : 0;
  const layoutMetrics = resolveChartLayoutMetrics(layoutBox);
  const resolvedPadding = resolveChartGridPadding(chrome?.paddingPreset, layoutBox);
  const resolvedChromePadding = resolveChromePadding(chrome?.paddingPreset, layoutBox);
  const radialPadding = resolveRadialChartPadding(chrome?.paddingPreset);
  const axisLineColor = (resolvedStyle as Record<string, unknown>).axisColor;
  const axisLabelColor = (resolvedStyle as Record<string, unknown>).axisLabelColor;
  const axisLabelFontSize = Number((resolvedStyle as Record<string, unknown>).axisLabelFontSize || 12);
  const axisLabelFontWeight = Number((resolvedStyle as Record<string, unknown>).axisLabelFontWeight || 400);
  const xAxisUnitLabelResolved = String((resolvedStyle as Record<string, unknown>).xAxisUnitLabel || "").trim();
  const yAxisUnitLabelResolved = String((resolvedStyle as Record<string, unknown>).yAxisUnitLabel || "").trim();
  const splitLineColor = (resolvedStyle as Record<string, unknown>).splitLineColor;
  const legendFontSize = Number(resolvedStyle.legendFontSize || ((nextOption.legend || {}).textStyle || {}).fontSize || 14);
  const barAxisExtraLeft = 0;
  const barAxisExtraBottom = 0;
  const barAxisUnitExtraLeft = yAxisUnitLabelResolved
    ? clampNumber(Math.round(axisLabelFontSize + layoutMetrics.height * 0.04), 12, Math.max(18, Math.round(layoutMetrics.width * 0.08)), 18)
    : 0;
  const barAxisUnitExtraBottom = xAxisUnitLabelResolved
    ? clampNumber(Math.round(axisLabelFontSize + layoutMetrics.height * 0.05), 12, Math.max(20, Math.round(layoutMetrics.height * 0.16)), 20)
    : 0;
  const barAxisUnitExtraRight = xAxisUnitLabelResolved
    ? clampNumber(Math.round(axisLabelFontSize * 0.5), 0, 12, 8)
    : 0;
  const barAxisUnitExtraTop = yAxisUnitLabelResolved
    ? clampNumber(Math.round(axisLabelFontSize * 0.4), 0, 10, 6)
    : 0;
  const legendPosition = resolvedStyle.legendPosition || "bottom";
  const showLegend = resolvedStyle.showLegend !== false;
  const legendExtraBottom = showLegend && legendPosition === "bottom"
    ? resolveLegendReserve(layoutBox, legendFontSize + (isLineChart || isScatterChart || isRadarChart ? 2 : 0), "horizontal")
    : 0;
  const legendExtraTop = showLegend && legendPosition === "top"
    ? resolveLegendReserve(layoutBox, legendFontSize + (isLineChart || isScatterChart || isRadarChart ? 2 : 0), "horizontal")
    : 0;
  const barLegendExtraLeft = showLegend && legendPosition === "left"
    ? resolveLegendReserve(layoutBox, legendFontSize, "vertical")
    : 0;
  const barLegendExtraRight = showLegend && legendPosition === "right"
    ? resolveLegendReserve(layoutBox, legendFontSize, "vertical")
    : 0;
  nextOption.__paddingPreset = chrome?.paddingPreset || "comfortable";
  nextOption.grid = {
    ...(nextOption.grid || {}),
    left: resolvedPadding.left + barAxisExtraLeft + barAxisUnitExtraLeft + barLegendExtraLeft,
    right: resolvedPadding.right + barAxisUnitExtraRight + barLegendExtraRight,
    top: resolvedPadding.top + barAxisUnitExtraTop + legendExtraTop,
    bottom: resolvedPadding.bottom + barAxisUnitExtraBottom + Math.max(barAxisExtraBottom, legendExtraBottom),
    containLabel: true,
  };
  if (resolvedStyle.showLegend === false && nextOption.legend) {
    delete nextOption.legend;
  }
  if (resolvedStyle.showAxis === false) {
    if (nextOption.xAxis) {
      nextOption.xAxis = Array.isArray(nextOption.xAxis)
        ? nextOption.xAxis.map((item: Record<string, unknown>) => ({ ...item, show: false }))
        : { ...nextOption.xAxis, show: false };
    }
    if (nextOption.yAxis) {
      nextOption.yAxis = Array.isArray(nextOption.yAxis)
        ? nextOption.yAxis.map((item: Record<string, unknown>) => ({ ...item, show: false }))
        : { ...nextOption.yAxis, show: false };
    }
  }
  if (typeof resolvedStyle.showXAxis === "boolean" && nextOption.xAxis) {
    const applyAxisVisibility = (axis: Record<string, any>) => ({
      ...axis,
      show: resolvedStyle.showXAxis,
      axisLine: {
        ...(axis.axisLine || {}),
        show: resolvedStyle.showXAxis,
      },
      axisTick: {
        ...(axis.axisTick || {}),
        show: resolvedStyle.showXAxis,
      },
      axisLabel: {
        ...(axis.axisLabel || {}),
        show: resolvedStyle.showXAxis,
      },
    });
    nextOption.xAxis = Array.isArray(nextOption.xAxis)
      ? nextOption.xAxis.map(applyAxisVisibility)
      : applyAxisVisibility(nextOption.xAxis);
  }
  if (typeof resolvedStyle.showYAxis === "boolean" && nextOption.yAxis) {
    const applyAxisVisibility = (axis: Record<string, any>) => ({
      ...axis,
      show: resolvedStyle.showYAxis,
      axisLine: {
        ...(axis.axisLine || {}),
        show: resolvedStyle.showYAxis,
      },
      axisTick: {
        ...(axis.axisTick || {}),
        show: resolvedStyle.showYAxis,
      },
      axisLabel: {
        ...(axis.axisLabel || {}),
        show: resolvedStyle.showYAxis,
      },
    });
    nextOption.yAxis = Array.isArray(nextOption.yAxis)
      ? nextOption.yAxis.map(applyAxisVisibility)
      : applyAxisVisibility(nextOption.yAxis);
  }
  if (nextOption.xAxis) {
    const applyAxis = (axis: Record<string, any>) => ({
      ...axis,
      name: xAxisUnitLabelResolved || axis.name,
      nameTextStyle: {
        ...((axis.nameTextStyle || {})),
        color: axisLabelColor || (axis.nameTextStyle || {}).color,
        fontSize: axisLabelFontSize || (axis.nameTextStyle || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.nameTextStyle || {}).fontWeight,
      },
      axisLine: {
        ...(axis.axisLine || {}),
        lineStyle: {
          ...((axis.axisLine || {}).lineStyle || {}),
          color: axisLineColor || (axis.axisLine || {}).lineStyle?.color,
        },
      },
      axisLabel: {
        ...(axis.axisLabel || {}),
        color: axisLabelColor || (axis.axisLabel || {}).color,
        fontSize: axisLabelFontSize || (axis.axisLabel || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.axisLabel || {}).fontWeight,
      },
      splitLine: {
        ...(axis.splitLine || {}),
        show: Boolean((resolvedStyle as Record<string, unknown>).showGridLines),
        lineStyle: {
          ...((axis.splitLine || {}).lineStyle || {}),
          color: splitLineColor || (axis.splitLine || {}).lineStyle?.color,
        },
      },
    });
    nextOption.xAxis = Array.isArray(nextOption.xAxis) ? nextOption.xAxis.map(applyAxis) : applyAxis(nextOption.xAxis);
  }
  if (nextOption.yAxis) {
    const applyAxis = (axis: Record<string, any>) => ({
      ...axis,
      name: yAxisUnitLabelResolved || axis.name,
      nameTextStyle: {
        ...((axis.nameTextStyle || {})),
        color: axisLabelColor || (axis.nameTextStyle || {}).color,
        fontSize: axisLabelFontSize || (axis.nameTextStyle || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.nameTextStyle || {}).fontWeight,
      },
      axisLine: {
        ...(axis.axisLine || {}),
        lineStyle: {
          ...((axis.axisLine || {}).lineStyle || {}),
          color: axisLineColor || (axis.axisLine || {}).lineStyle?.color,
        },
      },
      axisLabel: {
        ...(axis.axisLabel || {}),
        color: axisLabelColor || (axis.axisLabel || {}).color,
        fontSize: axisLabelFontSize || (axis.axisLabel || {}).fontSize,
        fontWeight: axisLabelFontWeight || (axis.axisLabel || {}).fontWeight,
      },
      splitLine: {
        ...(axis.splitLine || {}),
        show: Boolean((resolvedStyle as Record<string, unknown>).showGridLines),
        lineStyle: {
          ...((axis.splitLine || {}).lineStyle || {}),
          color: splitLineColor || (axis.splitLine || {}).lineStyle?.color,
        },
      },
    });
    nextOption.yAxis = Array.isArray(nextOption.yAxis) ? nextOption.yAxis.map(applyAxis) : applyAxis(nextOption.yAxis);
  }
  const isBarSeries = Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item?.type === "bar");
  const isComboChart = isBarSeries && isLineChart && !isHorizontalBarChart;
  if (Array.isArray(nextOption.series)) {
    const scatterPalette = Array.isArray(resolvedStyle.palette) && resolvedStyle.palette.length
      ? resolvedStyle.palette
      : [resolvedStyle.accentColor || "#4e7cff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"].filter(Boolean);
    const scatterLabelPosition = (resolvedStyle as Record<string, unknown>).scatterLabelPosition || "top";
    const scatterBorderColor = (resolvedStyle as Record<string, unknown>).scatterPointBorderColor
      || (resolvedStyle as Record<string, unknown>).pointBorderColor
      || chrome?.backgroundColor
      || "#ffffff";
    const scatterBorderWidth = Number((resolvedStyle as Record<string, unknown>).scatterPointBorderWidth ?? 1);
    const scatterOpacity = Math.max(0, Math.min(1, Number((resolvedStyle as Record<string, unknown>).scatterPointOpacity ?? 0.82)));
    const scatterSymbolSize = Number((resolvedStyle as Record<string, unknown>).scatterSymbolSize ?? 16);
    if (isBarSeries) {
      nextOption.series = nextOption.series.filter((item: Record<string, any>) => item?.type !== "pictorialBar");
    }
    if (isBarSeries) {
      const barPalette = isHorizontalBarChart
        ? getHorizontalBarPalette(resolvedStyle)
        : (Array.isArray(resolvedStyle.palette) && resolvedStyle.palette.length
          ? resolvedStyle.palette
          : [resolvedStyle.barPrimaryColor || resolvedStyle.accentColor || "#4e7cff", resolvedStyle.barSecondaryColor || "#55c6a9"]);
      const comboPalette = isComboChart
        ? [
          resolvedStyle.barPrimaryColor || barPalette[0] || resolvedStyle.accentColor || "#4e7cff",
          resolvedStyle.barSecondaryColor || barPalette[1] || "#f4b95d",
        ]
        : barPalette;
      const legendAlias = [resolvedStyle.legendPrimaryName || "图例一", resolvedStyle.legendSecondaryName || "图例二"];
      const overlapWidth = toPercentString(resolvedStyle.barSeriesOverlap, 0, -100, 100);
      const categoryGap = `${mapCategoryGapSliderToPercent(resolvedStyle.barCategoryGapPercent)}%`;
      const barWidth = mapCategoryGapSliderToBarWidth(resolvedStyle.barCategoryGapPercent);
      const horizontalBarLabelPosition = resolveBarLabelPosition(true, resolvedStyle.barValuePosition);
      const horizontalBarLabelColor = resolvedStyle.dataLabelColor || "#344054";
      const horizontalBarLabelFontSize = Number(resolvedStyle.dataLabelFontSize || 14);
      const horizontalBarLabelFontWeight = Number(resolvedStyle.dataLabelFontWeight || 500);
      nextOption.series = nextOption.series.map((item: Record<string, any>, index: number) => ({
        ...item,
        name: item.type === "bar"
          ? (isHorizontalBarChart
            ? (item.name || `系列${index + 1}`)
            : (isComboChart
              ? (((resolvedStyle.legendPrimaryName || "").trim() && resolvedStyle.legendPrimaryName !== "图例一") ? resolvedStyle.legendPrimaryName : (item.name || `指标${index + 1}`))
              : (legendAlias[index] || item.name || `指标${index + 1}`)))
          : item.name,
        stack: item.type === "bar" && !isHorizontalBarChart && !isComboChart && resolvedStyle.barSeriesLayout === "stacked" ? "total" : undefined,
        barGap: item.type === "bar" && !isHorizontalBarChart ? overlapWidth : item.barGap,
        barCategoryGap: item.type === "bar" && !isHorizontalBarChart ? categoryGap : item.barCategoryGap,
        barWidth: item.type === "bar" && !isHorizontalBarChart ? barWidth : item.barWidth,
        z: item.type === "bar" ? (10 - index) : item.z,
        data: item.type === "bar" && isHorizontalBarChart && Array.isArray(item.data)
          ? item.data.map((entry: any, dataIndex: number) => {
            const paletteColor = barPalette[dataIndex % Math.max(1, Number(resolvedStyle.horizontalBarColorCount || 1))];
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
              return {
                ...entry,
                itemStyle: {
                  ...(entry.itemStyle || {}),
                  color: paletteColor,
                  borderRadius: Number((resolvedStyle as Record<string, unknown>).barBorderRadius ?? entry.itemStyle?.borderRadius ?? 0),
                },
                label: {
                  ...(entry.label || {}),
                  show: resolvedStyle.showLabels !== false,
                  position: horizontalBarLabelPosition,
                  color: horizontalBarLabelColor,
                  fontSize: horizontalBarLabelFontSize,
                  fontWeight: horizontalBarLabelFontWeight,
                },
              };
            }
            return {
              value: entry,
              itemStyle: {
                color: paletteColor,
                borderRadius: Number((resolvedStyle as Record<string, unknown>).barBorderRadius ?? 0),
              },
              label: {
                show: resolvedStyle.showLabels !== false,
                position: horizontalBarLabelPosition,
                color: horizontalBarLabelColor,
                fontSize: horizontalBarLabelFontSize,
                fontWeight: horizontalBarLabelFontWeight,
              },
            };
          })
          : item.data,
        itemStyle: item.type === "bar" ? {
          ...(item.itemStyle || {}),
          color: isHorizontalBarChart ? item.itemStyle?.color : ((isComboChart ? comboPalette[0] : barPalette[index % barPalette.length]) || item.itemStyle?.color),
          borderRadius: Number((resolvedStyle as Record<string, unknown>).barBorderRadius ?? item.itemStyle?.borderRadius ?? 0),
        } : item.itemStyle,
      }));
      if (isHorizontalBarChart) {
        nextOption.color = undefined;
        Object.assign(nextOption, applyHorizontalBarSort(nextOption, resolvedStyle.horizontalBarSortOrder));
      } else {
        nextOption.color = isComboChart ? comboPalette : barPalette;
      }
    }
    nextOption.series = nextOption.series.map((item: Record<string, any>) => ({
      ...item,
      name: item.type === "line"
        ? (isComboChart
          ? (((resolvedStyle.legendSecondaryName || "").trim() && resolvedStyle.legendSecondaryName !== "图例二") ? resolvedStyle.legendSecondaryName : (item.name || "图例二"))
          : (item.name || (lineSeriesCount <= 1 ? (resolvedStyle.legendPrimaryName || "图例一") : undefined) || `图例${Math.max(1, (Array.isArray(nextOption.series) ? nextOption.series.filter((entry: Record<string, any>) => entry?.type === "line").indexOf(item) + 1 : 1))}`))
        : item.type === "scatter"
          ? ((((resolvedStyle.legendPrimaryName || "").trim() && resolvedStyle.legendPrimaryName !== "图例一")
            ? resolvedStyle.legendPrimaryName
            : (item.name || "散点")))
        : item.name,
      data: item.type === "scatter" && Array.isArray(item.data)
        ? item.data.map((entry: any, dataIndex: number) => {
          const paletteColor = scatterPalette[dataIndex % Math.max(1, scatterPalette.length)] || resolvedStyle.accentColor || "#4e7cff";
          const entryLabel = {
            ...((entry && typeof entry === "object" && !Array.isArray(entry) ? entry.label : {}) || {}),
            show: resolvedStyle.showLabels !== false,
            position: scatterLabelPosition,
            color: resolvedStyle.dataLabelColor || "#344054",
            fontSize: Number(resolvedStyle.dataLabelFontSize || 14),
            fontWeight: Number(resolvedStyle.dataLabelFontWeight || 500),
          };
          const entryItemStyle = {
            ...((entry && typeof entry === "object" && !Array.isArray(entry) ? entry.itemStyle : {}) || {}),
            color: paletteColor,
            opacity: scatterOpacity,
            borderColor: scatterBorderColor,
            borderWidth: scatterBorderWidth,
          };
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            return {
              ...entry,
              symbolSize: Number(entry.symbolSize ?? scatterSymbolSize),
              itemStyle: entryItemStyle,
              label: entryLabel,
            };
          }
          return {
            value: entry,
            symbolSize: scatterSymbolSize,
            itemStyle: entryItemStyle,
            label: entryLabel,
          };
        })
        : item.data,
      showSymbol: item.type === "line"
        ? Boolean((resolvedStyle as Record<string, unknown>).lineShowSymbol ?? item.showSymbol ?? true)
        : item.showSymbol,
      lineStyle: item.type === "line" ? {
        ...(item.lineStyle || {}),
        width: Number((resolvedStyle as Record<string, unknown>).lineWidth || item.lineStyle?.width || 3),
        color: isComboChart
          ? (resolvedStyle.barSecondaryColor || (Array.isArray(nextOption.color) && nextOption.color.length > 1 ? nextOption.color[1] : item.lineStyle?.color) || "#f4b95d")
          : item.lineStyle?.color,
      } : item.lineStyle,
      smooth: item.type === "line" ? Boolean((resolvedStyle as Record<string, unknown>).lineSmooth ?? item.smooth) : item.smooth,
      symbolSize: item.type === "line"
        ? Number((resolvedStyle as Record<string, unknown>).lineSymbolSize || item.symbolSize || 6)
        : item.type === "scatter"
          ? scatterSymbolSize
        : item.symbolSize,
      areaStyle: item.type === "line" && item.areaStyle ? {
        ...(item.areaStyle || {}),
        opacity: Number((resolvedStyle as Record<string, unknown>).lineAreaOpacity ?? (resolvedStyle as Record<string, unknown>).areaOpacity ?? item.areaStyle?.opacity ?? 0.18),
        color: isComboChart
          ? (resolvedStyle.barSecondaryColor || (Array.isArray(nextOption.color) && nextOption.color.length > 1 ? nextOption.color[1] : item.areaStyle?.color) || "#f4b95d")
          : item.areaStyle?.color,
      } : item.areaStyle,
      itemStyle: item.type === "bar" ? {
        ...(item.itemStyle || {}),
      } : item.type === "line" ? {
        ...(item.itemStyle || {}),
        color: isComboChart
          ? (resolvedStyle.barSecondaryColor || (Array.isArray(nextOption.color) && nextOption.color.length > 1 ? nextOption.color[1] : undefined) || item.itemStyle?.color || "#f4b95d")
          : (Array.isArray(nextOption.color) && nextOption.color.length
            ? nextOption.color[0]
            : (item.itemStyle?.color || (resolvedStyle as Record<string, unknown>).accentColor || "#1677ff")),
        borderColor: (resolvedStyle as Record<string, unknown>).pointBorderColor || item.itemStyle?.borderColor,
        borderWidth: Number(item.itemStyle?.borderWidth ?? (((resolvedStyle as Record<string, unknown>).lineShowSymbol ?? item.showSymbol ?? true) ? 2 : 0)),
      } : item.type === "scatter" ? {
        ...(item.itemStyle || {}),
        color: item.itemStyle?.color || scatterPalette[0] || resolvedStyle.accentColor || "#4e7cff",
        opacity: scatterOpacity,
        borderColor: scatterBorderColor,
        borderWidth: scatterBorderWidth,
      } : item.type === "radar" ? {
        ...(item.itemStyle || {}),
        color: (resolvedStyle as Record<string, unknown>).radarPointColor || item.itemStyle?.color,
        borderColor: (resolvedStyle as Record<string, unknown>).radarPointColor || item.itemStyle?.borderColor,
      } : item.itemStyle,
      label: {
        ...(item.label || {}),
        show: item.type === "map"
          ? resolvedStyle.showLabels !== false
          : item.type === "pie" || item.type === "funnel" || item.type === "radar"
            ? resolvedStyle.showLabels !== false
            : Boolean(resolvedStyle.showLabels),
        position: item.type === "bar"
          ? resolveBarLabelPosition(isHorizontalBarChart, resolvedStyle.barValuePosition)
          : item.type === "line"
            ? ((resolvedStyle as Record<string, unknown>).lineLabelPosition || item.label?.position || "top")
          : item.type === "scatter"
            ? (scatterLabelPosition || item.label?.position || "top")
          : item.label?.position,
        color: resolvedStyle.dataLabelColor || "#ffffff",
        fontSize: Number(resolvedStyle.dataLabelFontSize || 14),
        fontWeight: Number(resolvedStyle.dataLabelFontWeight || 500),
        formatter: item.type === "map"
          ? ((params: { name?: string; value?: number | string }) => {
            if ((resolvedStyle as Record<string, unknown>).showDataLabels) return params.value ?? "";
            if (resolvedStyle.showLabels !== false) return params.name || "";
            return "";
          })
        : undefined,
      },
    }));
    if (isComboChart && Array.isArray(resolvedStyle.palette) && resolvedStyle.palette.length) {
      nextOption.color = [
        resolvedStyle.barPrimaryColor || resolvedStyle.palette[0] || resolvedStyle.accentColor || "#4e7cff",
        resolvedStyle.barSecondaryColor || resolvedStyle.palette[1] || resolvedStyle.palette[0] || "#f4b95d",
      ];
    } else if (isScatterChart && scatterPalette.length) {
      nextOption.color = scatterPalette;
    } else if ((isLineChart || isRadarChart) && Array.isArray(resolvedStyle.palette) && resolvedStyle.palette.length) {
      nextOption.color = resolvedStyle.palette;
    }
  }
  if (Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item.type === "pie")) {
    return applyPieThemeAndVariant(nextOption, resolvedStyle);
  }
  const barLegendSeries = Array.isArray(nextOption.series)
    ? nextOption.series.filter((item: Record<string, any>) => item?.type !== "pictorialBar")
    : [];
  const chartLegendSeries = Array.isArray(nextOption.series)
    ? nextOption.series.filter((item: Record<string, any>) => ["bar", "line", "scatter", "radar"].includes(String(item?.type || "")))
    : [];
  const getSeriesLegendName = (item: Record<string, any>, index: number) => {
    if (item.type === "bar") return item.name || `指标${index + 1}`;
    if (item.type === "line") return item.name || (index === 0 ? (resolvedStyle.legendPrimaryName || "图例一") : (resolvedStyle.legendSecondaryName || `图例${index + 1}`));
    if (item.type === "scatter") return item.name || resolvedStyle.legendPrimaryName || "散点";
    if (item.type === "radar") {
      const radarNames = [];
      if ((resolvedStyle.legendPrimaryName || "").trim()) radarNames.push(String(resolvedStyle.legendPrimaryName).trim());
      if ((resolvedStyle.legendSecondaryName || "").trim()) radarNames.push(String(resolvedStyle.legendSecondaryName).trim());
      if (radarNames.length > 0) return radarNames;
      const dataNames = Array.isArray(item.data)
        ? item.data.map((entry: Record<string, any>, dataIndex: number) => entry?.name || `指标${dataIndex + 1}`).filter(Boolean)
        : [];
      return dataNames.length ? dataNames : (item.name || `指标${index + 1}`);
    }
    return item.name || `指标${index + 1}`;
  };
  if (isBarSeries && !nextOption.legend && resolvedStyle.showLegend !== false) {
      const legendPosition = resolvedStyle.legendPosition || "bottom";
      nextOption.legend = {
        data: barLegendSeries.map((item: Record<string, any>, index: number) => item.name || `指标${index + 1}`),
        top: legendPosition === "top" ? 4 : undefined,
        bottom: legendPosition === "bottom" ? 4 : undefined,
        left: legendPosition === "left" ? 8 : legendPosition === "right" ? undefined : "center",
        right: legendPosition === "right" ? 8 : undefined,
        orient: legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal",
      };
    }
  if ((isLineChart || isScatterChart || isRadarChart) && !nextOption.legend && resolvedStyle.showLegend !== false) {
    const legendPosition = resolvedStyle.legendPosition || "bottom";
    nextOption.legend = {
      data: chartLegendSeries.flatMap(getSeriesLegendName),
      top: legendPosition === "top" ? 4 : undefined,
      bottom: legendPosition === "bottom" ? 4 : undefined,
      left: legendPosition === "left" ? 8 : legendPosition === "right" ? undefined : "center",
      right: legendPosition === "right" ? 8 : undefined,
      orient: legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal",
    };
  }
  if (nextOption.legend) {
    const legendPosition = resolvedStyle.legendPosition || "bottom";
    const legendData = isBarSeries
      ? barLegendSeries.map((item: Record<string, any>, index: number) => item.name || `指标${index + 1}`)
      : (isLineChart || isScatterChart || isRadarChart)
        ? chartLegendSeries.flatMap(getSeriesLegendName)
      : (Array.isArray((nextOption.legend || {}).data) && (nextOption.legend || {}).data.length
        ? (nextOption.legend || {}).data
        : (nextOption.legend || {}).data);
    nextOption.legend = {
      ...(nextOption.legend || {}),
      show: resolvedStyle.showLegend !== false,
      data: legendData,
      top: legendPosition === "top" ? 4 : undefined,
      bottom: legendPosition === "bottom" ? 4 : undefined,
      left: legendPosition === "left" ? 8 : legendPosition === "right" ? undefined : "center",
      right: legendPosition === "right" ? 8 : undefined,
      orient: legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal",
      textStyle: {
        ...((nextOption.legend || {}).textStyle || {}),
        color: resolvedStyle.legendTextColor || ((nextOption.legend || {}).textStyle || {}).color,
        fontSize: Number(resolvedStyle.legendFontSize || ((nextOption.legend || {}).textStyle || {}).fontSize || 14),
        fontWeight: Number(resolvedStyle.legendFontWeight || ((nextOption.legend || {}).textStyle || {}).fontWeight || 500),
      },
    };
  }
  if (Array.isArray(nextOption.series) && nextOption.series.some((item: Record<string, any>) => item.type === "map")) {
    const resolvedMapName = ensureChinaRegionMapRegistered(mapStyle?.provinceCode);
    const useAutoViewport = shouldUseAutoMapViewport(mapStyle);
    const mapViewport = resolveAutoMapViewport(layoutBox, Boolean(nextOption.visualMap));
    nextOption.series = nextOption.series.map((item: Record<string, any>) => (
      item.type === "map"
        ? {
          ...item,
          map: item.map || resolvedMapName,
          roam: true,
          center: useAutoViewport ? undefined : (Array.isArray(mapStyle?.center) ? mapStyle.center : item.center),
          zoom: useAutoViewport ? undefined : (typeof mapStyle?.zoom === "number" ? mapStyle.zoom : item.zoom),
          layoutCenter: mapViewport.layoutCenter,
          layoutSize: mapViewport.layoutSize,
        }
        : item
    ));
  }
  if (nextOption.radar) {
    nextOption.radar = {
      ...(nextOption.radar || {}),
      center: [
        String((resolvedStyle as Record<string, unknown>).radarCenterX || (nextOption.radar || {}).center?.[0] || "50%"),
        String((resolvedStyle as Record<string, unknown>).radarCenterY || (nextOption.radar || {}).center?.[1] || "52%"),
      ],
      radius: applyPaddingToChartDimension(
        (resolvedStyle as Record<string, unknown>).radarRadius as string | number | null | undefined,
        (nextOption.radar || {}).radius || "70%",
        radialPadding
      ),
      shape: (resolvedStyle as Record<string, unknown>).radarShape || (nextOption.radar || {}).shape || "polygon",
      splitNumber: Number((resolvedStyle as Record<string, unknown>).radarSplitNumber || (nextOption.radar || {}).splitNumber || 5),
      axisName: {
        ...((nextOption.radar || {}).axisName || {}),
        color: (resolvedStyle as Record<string, unknown>).radarIndicatorTextColor || ((nextOption.radar || {}).axisName || {}).color,
      },
      splitArea: {
        ...((nextOption.radar || {}).splitArea || {}),
        show: (resolvedStyle as Record<string, unknown>).radarShowSplitArea !== false,
        areaStyle: {
          ...(((nextOption.radar || {}).splitArea || {}).areaStyle || {}),
          opacity: Number((resolvedStyle as Record<string, unknown>).radarAreaOpacity ?? (((nextOption.radar || {}).splitArea || {}).areaStyle || {}).opacity ?? 0.22),
        },
      },
      splitLine: {
        ...((nextOption.radar || {}).splitLine || {}),
        lineStyle: {
          ...(((nextOption.radar || {}).splitLine || {}).lineStyle || {}),
          color: (resolvedStyle as Record<string, unknown>).radarGridLineColor || (((nextOption.radar || {}).splitLine || {}).lineStyle || {}).color,
        },
      },
    };
  }
  if (Array.isArray(nextOption.series)) {
    nextOption.series = nextOption.series.map((item: Record<string, any>) => (
      item.type === "radar"
        ? {
          ...item,
          data: Array.isArray(item.data)
            ? item.data.map((entry: Record<string, any>, index: number) => ({
              ...entry,
              itemStyle: {
                ...(entry?.itemStyle || {}),
                color: index === 0
                  ? ((resolvedStyle as Record<string, unknown>).radarPrimaryColor || (resolvedStyle as Record<string, unknown>).radarPointColor || entry?.itemStyle?.color)
                  : ((resolvedStyle as Record<string, unknown>).radarSecondaryColor || entry?.itemStyle?.color),
                borderColor: index === 0
                  ? ((resolvedStyle as Record<string, unknown>).radarPrimaryColor || (resolvedStyle as Record<string, unknown>).radarPointColor || entry?.itemStyle?.borderColor)
                  : ((resolvedStyle as Record<string, unknown>).radarSecondaryColor || entry?.itemStyle?.borderColor),
              },
              areaStyle: {
                ...(entry?.areaStyle || {}),
                color: index === 0
                  ? ((resolvedStyle as Record<string, unknown>).radarPrimaryColor || entry?.areaStyle?.color)
                  : ((resolvedStyle as Record<string, unknown>).radarSecondaryColor || entry?.areaStyle?.color),
                opacity: Number((resolvedStyle as Record<string, unknown>).radarAreaOpacity ?? entry?.areaStyle?.opacity ?? 0.22),
              },
            }))
            : item.data,
        }
        : item.type === "map"
        ? {
          ...item,
          left: resolveSeriesBoxLayoutValue(item.left, resolvedChromePadding.left, "left"),
          right: resolveSeriesBoxLayoutValue(item.right, resolvedChromePadding.right, "right"),
          top: resolveSeriesBoxLayoutValue(item.top, resolvedChromePadding.top, "top"),
          bottom: resolveSeriesBoxLayoutValue(item.bottom, resolvedChromePadding.bottom, "bottom"),
          itemStyle: {
            ...(item.itemStyle || {}),
            borderColor: (resolvedStyle as Record<string, unknown>).mapRegionBorderColor || item.itemStyle?.borderColor,
          },
          label: {
            ...(item.label || {}),
            color: (resolvedStyle as Record<string, unknown>).mapLabelColor || item.label?.color,
          },
        }
        : item.type === "treemap"
        ? {
          ...item,
          left: resolveSeriesBoxLayoutValue(item.left, resolvedChromePadding.left, "left"),
          right: resolveSeriesBoxLayoutValue(item.right, resolvedChromePadding.right, "right"),
          top: resolveSeriesBoxLayoutValue(item.top, resolvedChromePadding.top, "top"),
          bottom: resolveSeriesBoxLayoutValue(item.bottom, resolvedChromePadding.bottom, "bottom"),
        }
        : item
    ));
  }
  if (nextOption.visualMap || isMapChart) {
    const mapRegionPalette = getMapRegionPalette(resolvedStyle);
    const visualMapTop = (nextOption.visualMap || {}).top;
    const visualMapBottom = (nextOption.visualMap || {}).bottom;
    const useBottomAlias = typeof visualMapTop === "string" && visualMapTop.trim() === "bottom" && visualMapBottom == null;
    nextOption.visualMap = {
      ...(nextOption.visualMap || {}),
      left: resolveSeriesBoxLayoutValue((nextOption.visualMap || {}).left, resolvedChromePadding.left, "left"),
      right: resolveSeriesBoxLayoutValue((nextOption.visualMap || {}).right, resolvedChromePadding.right, "right"),
      top: useBottomAlias
        ? undefined
        : resolveSeriesBoxLayoutValue(visualMapTop, resolvedChromePadding.top, "top"),
      bottom: useBottomAlias
        ? resolvedChromePadding.bottom
        : resolveSeriesBoxLayoutValue(visualMapBottom, resolvedChromePadding.bottom, "bottom"),
      inRange: {
        ...(((nextOption.visualMap || {}).inRange) || {}),
        color: mapRegionPalette,
      },
      textStyle: {
        ...((nextOption.visualMap || {}).textStyle || {}),
        color: (resolvedStyle as Record<string, unknown>).mapVisualMapTextColor || ((nextOption.visualMap || {}).textStyle || {}).color,
      },
    };
  }
  if (chartAnalysis?.showExtrema && Array.isArray(nextOption.series) && nextOption.series[0]) {
    nextOption.series = nextOption.series.map((item: Record<string, any>) => ({
      ...item,
      markPoint: {
        ...(item.markPoint || {}),
        symbolSize: (item.markPoint || {}).symbolSize || 42,
        label: {
          ...((item.markPoint || {}).label || {}),
          show: true,
          color: resolvedStyle.dataLabelColor || "#ffffff",
          fontSize: Number(resolvedStyle.dataLabelFontSize || 14),
          fontWeight: Number(resolvedStyle.dataLabelFontWeight || 500),
          formatter: (params: { name?: string; value?: number | string }) => `${params.name || ""}\n${params.value ?? ""}`.trim(),
        },
        data: [
          {
            type: "max",
            name: "最大值",
            itemStyle: {
              color: resolvedStyle.extremaMaxColor || "#f59e0b",
              borderColor: resolvedStyle.extremaMaxColor || "#f59e0b",
            },
            label: {
              color: resolvedStyle.extremaMaxColor || resolvedStyle.dataLabelColor || "#f59e0b",
            },
          },
          {
            type: "min",
            name: "最小值",
            itemStyle: {
              color: resolvedStyle.extremaMinColor || "#12b76a",
              borderColor: resolvedStyle.extremaMinColor || "#12b76a",
            },
            label: {
              color: resolvedStyle.extremaMinColor || resolvedStyle.dataLabelColor || "#12b76a",
            },
          },
        ],
      },
    }));
  } else if (Array.isArray(nextOption.series)) {
    nextOption.series = nextOption.series.map((item: Record<string, any>) => ({
      ...item,
      markPoint: undefined,
    }));
  }
  return nextOption;
}

function buildClientKpiPreview(widget: CanvasWidgetDraft, rawPreview: ReportingDashboardPreview): ReportingDashboardPreview {
  const rows = rawPreview.sampleRows || [];
  const fieldMap = rawPreview.fieldMap || widget.fieldMap || {};
  const valueField = fieldMap.valueField || fieldMap.yField || "value";
  const compareField = fieldMap.compareField || "compare_value";
  const labelField = fieldMap.labelField || fieldMap.nameField || "label";
  const items = rows.map((row) => {
    const primaryValue = (row[valueField] ?? 0) as string | number | null;
    const hasCompareField = Boolean(fieldMap.compareField);
    const compareValue = hasCompareField ? (row[compareField] ?? null) as string | number | null : null;
    const trendPercent = hasCompareField && compareValue !== null && Number(compareValue) !== 0
      ? Number((((Number(primaryValue || 0) - Number(compareValue || 0)) / Number(compareValue)) * 100).toFixed(2))
      : null;
    return {
      primaryValue,
      compareValue,
      trendPercent,
      label: String(row[labelField] || widget.chrome?.titleText || widget.widgetName),
      formattedValue: primaryValue === null || primaryValue === undefined ? null : String(primaryValue),
    };
  });
  const firstItem = items[0] || {
    primaryValue: 0,
    compareValue: null,
    trendPercent: null,
    label: widget.chrome?.titleText || widget.widgetName,
    formattedValue: "0",
  };
  return {
    ...rawPreview,
    widgetType: "kpi",
    chartAsset: rawPreview.chartAsset || null,
    chrome: widget.chrome,
    kpiStyle: widget.kpiStyle,
    kpiAnalysis: widget.kpiAnalysis,
    kpi: {
      mode: widget.kpi?.mode || "number",
      layout: widget.kpi?.layout || "vertical",
      items,
      primaryValue: firstItem.primaryValue,
      compareValue: firstItem.compareValue,
      trendPercent: firstItem.trendPercent,
      label: firstItem.label,
      valuePrefix: widget.kpi?.valuePrefix || "",
      valueSuffix: widget.kpi?.valueSuffix || "",
      decimals: Number(widget.kpi?.decimals || 0),
      showTrend: widget.kpiAnalysis?.showTrend !== false,
      showMetricLabel: widget.kpiStyle?.showMetricLabel !== false,
      metricLabelColor: String(widget.kpiStyle?.metricLabelColor || "#667085"),
      metricLabelFontSize: Number(widget.kpiStyle?.metricLabelFontSize || 16),
      metricLabelFontWeight: Number(widget.kpiStyle?.metricLabelFontWeight || 600),
      compareLabel: widget.kpi?.compareLabel || "同比",
      compareLabelColor: String(widget.kpiStyle?.compareLabelColor || "#52c41a"),
      compareLabelFontSize: Number(widget.kpiStyle?.compareLabelFontSize || 16),
      compareLabelFontWeight: Number(widget.kpiStyle?.compareLabelFontWeight || 600),
    },
  };
}

function resolveKpiViewModel(widget: CanvasWidgetDraft) {
  if (widget.preview?.kpi) return widget.preview.kpi;
  if (widget.kpi?.primaryValue !== undefined) {
    return {
      ...(widget.kpi as WidgetKpiPreviewModel),
      showTrend: widget.kpiAnalysis?.showTrend !== false,
      showMetricLabel: widget.kpiStyle?.showMetricLabel !== false,
      metricLabelColor: String(widget.kpiStyle?.metricLabelColor || "#667085"),
      metricLabelFontSize: Number(widget.kpiStyle?.metricLabelFontSize || 16),
      metricLabelFontWeight: Number(widget.kpiStyle?.metricLabelFontWeight || 600),
      compareLabelColor: String(widget.kpiStyle?.compareLabelColor || "#52c41a"),
      compareLabelFontSize: Number(widget.kpiStyle?.compareLabelFontSize || 16),
      compareLabelFontWeight: Number(widget.kpiStyle?.compareLabelFontWeight || 600),
    } as WidgetKpiPreviewModel;
  }
  const rows = widget.preview?.sampleRows || [];
  const fieldMap = widget.preview?.fieldMap || widget.fieldMap || {};
  const valueField = fieldMap.valueField || fieldMap.yField || "value";
  const compareField = fieldMap.compareField || "compare_value";
  const labelField = fieldMap.labelField || fieldMap.nameField || "label";
  const items = rows.map((row) => {
    const primaryValue = (row[valueField] ?? 0) as string | number | null;
    const hasCompareField = Boolean(fieldMap.compareField);
    const compareValue = hasCompareField ? (row[compareField] ?? null) as string | number | null : null;
    const trendPercent = hasCompareField && compareValue !== null && Number(compareValue) !== 0
      ? Number((((Number(primaryValue || 0) - Number(compareValue || 0)) / Number(compareValue)) * 100).toFixed(2))
      : null;
    return {
      primaryValue,
      compareValue,
      trendPercent,
      label: String(row[labelField] || widget.chrome?.titleText || widget.widgetName),
      formattedValue: primaryValue === null || primaryValue === undefined ? null : String(primaryValue),
    };
  });
  const firstItem = items[0] || {
    primaryValue: 0,
    compareValue: null,
    trendPercent: null,
    label: widget.chrome?.titleText || widget.widgetName,
    formattedValue: "0",
  };
  return {
    mode: widget.kpi?.mode || "number",
    layout: widget.kpi?.layout || "vertical",
    items,
    primaryValue: firstItem.primaryValue,
    compareValue: firstItem.compareValue,
    trendPercent: firstItem.trendPercent,
    label: firstItem.label,
    valuePrefix: widget.kpi?.valuePrefix || "",
    valueSuffix: widget.kpi?.valueSuffix || "",
    decimals: Number(widget.kpi?.decimals || 0),
    showTrend: widget.kpiAnalysis?.showTrend !== false,
    showMetricLabel: widget.kpiStyle?.showMetricLabel !== false,
    metricLabelColor: String(widget.kpiStyle?.metricLabelColor || "#667085"),
    metricLabelFontSize: Number(widget.kpiStyle?.metricLabelFontSize || 16),
    metricLabelFontWeight: Number(widget.kpiStyle?.metricLabelFontWeight || 600),
    compareLabel: widget.kpi?.compareLabel || "同比",
    compareLabelColor: String(widget.kpiStyle?.compareLabelColor || "#52c41a"),
    compareLabelFontSize: Number(widget.kpiStyle?.compareLabelFontSize || 16),
    compareLabelFontWeight: Number(widget.kpiStyle?.compareLabelFontWeight || 600),
  } as WidgetKpiPreviewModel;
}

function buildClientTablePreview(widget: CanvasWidgetDraft, rawPreview: ReportingDashboardPreview): ReportingDashboardPreview {
  const fields = rawPreview.fields || [];
  return {
    ...rawPreview,
    widgetType: "table",
    chartAsset: rawPreview.chartAsset || null,
    chrome: widget.chrome,
    tableStyle: widget.tableStyle,
    table: {
      columns: fields.map((field) => ({
        key: field.columnName,
        title: field.label || field.columnName,
        dataIndex: field.columnName,
      })),
      rows: rawPreview.sampleRows || [],
      pageSize: Number(widget.table?.pageSize || 10),
      showIndex: widget.tableStyle?.showIndex !== false,
      compact: Boolean(widget.tableStyle?.compact),
      striped: widget.tableStyle?.striped !== false,
    },
  };
}

function buildClientTabsPreview(widget: CanvasWidgetDraft, rawPreview: ReportingDashboardPreview): ReportingDashboardPreview {
  return {
    ...rawPreview,
    widgetType: "tabs",
    chartAsset: rawPreview.chartAsset || null,
    chrome: widget.chrome,
    tabsStyle: widget.tabsStyle,
    tabs: {
      defaultActiveKey: widget.tabs?.defaultActiveKey || widget.tabs?.items?.[0]?.key || null,
      items: (widget.tabs?.items || buildDefaultTabsConfig().items).map((item) => ({
        key: item.key,
        title: item.title,
        widgetType: "container",
        childWidgetKey: item.childWidgetKey || null,
      })),
    },
  };
}

function extractMapPreviewRows(widget: CanvasWidgetDraft, rawPreview: ReportingDashboardPreview) {
  const fieldMap = rawPreview.fieldMap || widget.fieldMap || {};
  const mapField = fieldMap.mapField || fieldMap.labelField || fieldMap.nameField || "adcode";
  const valueField = fieldMap.valueField || fieldMap.yField || "value";
  const seriesData = Array.isArray((rawPreview.option as any)?.series)
    ? (rawPreview.option as any).series.flatMap((item: any) => Array.isArray(item?.data) ? item.data : [])
    : [];
  if (seriesData.length > 0) {
    return seriesData.map((item: any) => ({
      adcode: normalizeChinaMapRegionAdcode(item?.adcode ?? item?.name),
      value: Number(item?.value ?? 0),
    }));
  }
  const rows = rawPreview.sampleRows || [];
  return rows.map((row) => {
    const rawMapValue = row?.[mapField] ?? row?.adcode ?? row?.name ?? null;
    return {
      adcode: normalizeChinaMapRegionAdcode(rawMapValue as string | number | null),
      value: Number(row?.[valueField] ?? 0),
    };
  });
}

function buildChinaMapSeriesData(
  rows: Array<{ adcode: string; value: number }>,
  scopeMode: "province" | "city" | "district" | "singleProvince",
  adcodeNameMap: Map<string, string>,
  provinceCode?: string | null
) {
  const normalizedProvinceCode = normalizeChinaAdcode(provinceCode);
  const provincePrefix = normalizedProvinceCode ? normalizedProvinceCode.slice(0, 2) : "";
  const aggregated = new Map<string, number>();
  rows.forEach((item) => {
    if (!item.adcode || !Number.isFinite(item.value)) {
      return;
    }
    if (provincePrefix && !item.adcode.startsWith(provincePrefix) && scopeMode !== "province") {
      return;
    }
    let targetCode = "";
    if (scopeMode === "province") {
      targetCode = toProvinceLevelAdcode(item.adcode);
    } else if (scopeMode === "city") {
      targetCode = isProvinceLevelAdcode(item.adcode) ? "" : toCityLevelAdcode(item.adcode);
    } else if (scopeMode === "district") {
      targetCode = isDistrictLevelAdcode(item.adcode) ? item.adcode : "";
    } else {
      targetCode = toProvinceLevelAdcode(item.adcode);
    }
    if (!targetCode) {
      return;
    }
    aggregated.set(targetCode, Number((aggregated.get(targetCode) || 0) + item.value));
  });
  return Array.from(aggregated.entries())
    .map(([adcode, value]) => ({
      adcode,
      name: adcodeNameMap.get(adcode) || adcode,
      value,
    }))
    .filter((item) => item.name);
}

async function buildClientMapPreviewOption(
  widget: CanvasWidgetDraft,
  rawPreview: ReportingDashboardPreview,
  layoutBox: ChartLayoutBox = resolveWidgetChartLayoutBox(widget),
) {
  const previewRows = extractMapPreviewRows(widget, rawPreview);
  const preparedMap = await ensureChinaDynamicMapRegistered(
    widget.mapStyle?.provinceCode,
    previewRows.map((item: { adcode: string }) => item.adcode).filter(Boolean)
  );
  const data = buildChinaMapSeriesData(
    previewRows,
    preparedMap.scopeMode,
    preparedMap.adcodeNameMap,
    widget.mapStyle?.provinceCode
  );
  const values = data.map((item) => Number(item.value || 0)).filter((item) => Number.isFinite(item));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 100;
  const baseSeries = Array.isArray((rawPreview.option as any)?.series) && (rawPreview.option as any).series.length > 0
    ? (rawPreview.option as any).series
    : [{ type: "map", map: "china", data: [] }];
  return applyClientChartStyle(
    {
      ...(rawPreview.option || {}),
      visualMap: {
        ...(((rawPreview.option as any) || {}).visualMap || {}),
        min,
        max: max <= min ? min + 1 : max,
        calculable: true,
      },
      series: baseSeries.map((item: Record<string, any>) => (
        item?.type === "map"
          ? {
            ...item,
            map: preparedMap.mapName,
            data,
          }
          : item
      )),
    },
    widget.chrome,
    widget.chartStyle,
    widget.mapStyle,
    widget.chartAnalysis,
    layoutBox,
  );
}

function buildPiePreviewData(widget: CanvasWidgetDraft, rawPreview: ReportingDashboardPreview) {
  const fieldMap = rawPreview.fieldMap || widget.fieldMap || {};
  const labelField = fieldMap.labelField || fieldMap.nameField || "label";
  const valueField = fieldMap.valueField || fieldMap.yField || "value";
  const seriesData = Array.isArray((rawPreview.option as any)?.series)
    ? (rawPreview.option as any).series.flatMap((item: any) => Array.isArray(item?.data) ? item.data : [])
    : [];
  if (seriesData.length > 0) {
    return seriesData.map((item: any) => ({
      name: String(item?.name ?? ""),
      value: Number(item?.value ?? 0),
    }));
  }
  const rows = rawPreview.sampleRows || [];
  return rows
    .map((row) => ({
      name: String(row?.[labelField] ?? row?.name ?? ""),
      value: Number(row?.[valueField] ?? row?.value ?? 0),
    }))
    .filter((item) => item.name || Number.isFinite(item.value));
}

function buildClientPiePreviewOption(
  widget: CanvasWidgetDraft,
  rawPreview: ReportingDashboardPreview,
  layoutBox: ChartLayoutBox = resolveWidgetChartLayoutBox(widget),
) {
  const data = buildPiePreviewData(widget, rawPreview);
  return applyClientChartStyle(
    {
      tooltip: { trigger: "item" },
      legend: {
        show: true,
        bottom: 0,
        left: "center",
        textStyle: {},
      },
      series: [
        {
          type: "pie",
          data,
          label: { show: true },
          labelLine: { show: true },
        },
      ],
    },
    widget.chrome,
    widget.chartStyle,
    widget.mapStyle,
    widget.chartAnalysis,
    layoutBox,
  );
}

function ChartWidgetPreview({
  widget,
  contentHeight,
  onWidgetChange,
}: {
  widget: CanvasWidgetDraft;
  contentHeight: number;
  onWidgetChange?: (patch: Partial<CanvasWidgetDraft>) => void;
}) {
  const isPieChart = widget.chartFamily === "pie" || widget.preview?.chartAsset?.chartFamily === "pie";
  const isMapChart = widget.chartFamily === "map" || widget.preview?.chartAsset?.chartCode?.includes("china");
  const chartRef = useRef<any>(null);
  const mapSyncTimerRef = useRef<number | null>(null);
  const layoutBox = useMemo(() => resolveWidgetChartLayoutBox(widget, contentHeight), [widget, contentHeight]);
  const [preparedOption, setPreparedOption] = useState<Record<string, any> | null>(() => {
    if (!widget.preview?.option) return null;
    if (isMapChart) return null;
    return isPieChart
      ? buildClientPiePreviewOption(widget, widget.preview, layoutBox)
      : applyClientChartStyle(
        widget.preview.option,
        widget.chrome,
        widget.chartStyle,
        widget.mapStyle,
        widget.chartAnalysis,
        layoutBox,
      );
  });

  useEffect(() => {
    let cancelled = false;
    const prepareOption = async () => {
      if (!widget.preview?.option) {
        if (!cancelled) setPreparedOption(null);
        return;
      }
      if (isMapChart) {
        const nextOption = await buildClientMapPreviewOption(widget, widget.preview, layoutBox);
        if (!cancelled) setPreparedOption(nextOption);
        return;
      }
      const nextOption = isPieChart
        ? buildClientPiePreviewOption(widget, widget.preview, layoutBox)
        : applyClientChartStyle(
          widget.preview.option,
          widget.chrome,
          widget.chartStyle,
          widget.mapStyle,
          widget.chartAnalysis,
          layoutBox,
        );
      if (!cancelled) {
        setPreparedOption(normalizeWordCloudOption(nextOption));
      }
    };
    void prepareOption();
    return () => {
      cancelled = true;
    };
  }, [widget, isMapChart, isPieChart, layoutBox]);

  useEffect(() => () => {
    if (mapSyncTimerRef.current) {
      window.clearTimeout(mapSyncTimerRef.current);
      mapSyncTimerRef.current = null;
    }
  }, []);

  const mapEvents = useMemo(() => {
    if (!isMapChart || !onWidgetChange) return undefined;
    return {
      georoam: () => {
        if (mapSyncTimerRef.current) {
          window.clearTimeout(mapSyncTimerRef.current);
        }
        mapSyncTimerRef.current = window.setTimeout(() => {
          const instance = chartRef.current?.getEchartsInstance?.();
          if (!instance) return;
          const option = instance.getOption?.();
          const series = Array.isArray(option?.series)
            ? option.series.find((item: Record<string, any>) => item?.type === "map")
            : null;
          const center = normalizeMapCenterValue(series?.center);
          const zoom = normalizeMapZoomValue(series?.zoom);
          const currentCenter = normalizeMapCenterValue(widget.mapStyle?.center);
          const currentZoom = normalizeMapZoomValue(widget.mapStyle?.zoom);
          const centerChanged = JSON.stringify(center || null) !== JSON.stringify(currentCenter || null);
          const zoomChanged = zoom !== currentZoom;
          if (!centerChanged && !zoomChanged) return;
          onWidgetChange({
            mapStyle: {
              ...(widget.mapStyle || buildDefaultMapStyleConfig()),
              center,
              zoom,
            },
          });
        }, 160);
      },
    };
  }, [isMapChart, onWidgetChange, widget.mapStyle]);

  return (
    <div
      className={isMapChart ? "reporting-widget__map-roam-surface" : undefined}
      style={{
        height: contentHeight,
        background: buildChromeBackgroundFromStyle(widget.chrome || null),
        cursor: isMapChart ? "grab" : undefined,
      }}
    >
      {preparedOption ? (
        <ReactECharts ref={chartRef} option={preparedOption} style={{ height: "100%" }} notMerge lazyUpdate onEvents={mapEvents} />
      ) : (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin size="small" />
        </div>
      )}
    </div>
  );
}

export function transformPreviewForWidget(widget: CanvasWidgetDraft, rawPreview: ReportingDashboardPreview) {
  const layoutBox = resolveWidgetChartLayoutBox(widget);
  if (widget.widgetType === "kpi") return buildClientKpiPreview(widget, rawPreview);
  if (widget.widgetType === "table") return buildClientTablePreview(widget, rawPreview);
  if (widget.widgetType === "tabs") return buildClientTabsPreview(widget, rawPreview);
  if ((widget.chartFamily || (rawPreview.chartAsset as any)?.chartFamily) === "pie") {
    return {
      ...rawPreview,
      widgetType: "chart",
      chrome: widget.chrome,
      chartStyle: widget.chartStyle,
      mapStyle: widget.mapStyle,
      chartAnalysis: widget.chartAnalysis,
      option: buildClientPiePreviewOption(widget, rawPreview, layoutBox),
    };
  }
  return {
    ...rawPreview,
    widgetType: "chart",
    chrome: widget.chrome,
    chartStyle: widget.chartStyle,
    mapStyle: widget.mapStyle,
    chartAnalysis: widget.chartAnalysis,
    option: applyClientChartStyle(
      rawPreview.option,
      widget.chrome,
      widget.chartStyle,
      widget.mapStyle,
      widget.chartAnalysis,
      layoutBox,
    ),
  };
}

export function renderWidgetPreview(
  widget: CanvasWidgetDraft,
  allWidgets: CanvasWidgetDraft[] = [],
  onSelectWidget?: (widget: CanvasWidgetDraft) => void,
  highlightedTabKey?: string | null,
  onWidgetChange?: (patch: Partial<CanvasWidgetDraft>) => void
) {
  const contentHeight = widget.position.h - (widget.chrome?.showTitle === false ? 24 : 62);
  if (widget.widgetType === "richText") {
    return (
      <div
        style={{
          height: contentHeight,
          padding: 16,
          overflow: "auto",
          color: widget.richTextStyle?.color || "#1f2329",
          fontSize: Number(widget.richTextStyle?.fontSize || 18),
          fontWeight: Number(widget.richTextStyle?.fontWeight || 500),
          textAlign: widget.richTextStyle?.align || "left",
          background: buildChromeBackgroundFromStyle(widget.chrome || null),
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {widget.richText?.content || "请输入说明文字"}
      </div>
    );
  }

  if (widget.widgetType === "image") {
    return (
      <div
        style={{
          height: contentHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
          background: buildChromeBackgroundFromStyle(widget.chrome || null),
        }}
      >
        {widget.image?.imageUrl ? (
          <img
            src={widget.image.imageUrl}
            alt={widget.widgetName}
            style={{
              width: "100%",
              height: "100%",
              objectFit: widget.imageStyle?.objectFit || "contain",
              borderRadius: Number(widget.imageStyle?.borderRadius || 10),
            }}
          />
        ) : (
          <Empty description="上传图片后在画布中展示" />
        )}
      </div>
    );
  }

  if (widget.widgetType === "kpi" && widget.preview) {
    const kpi = resolveKpiViewModel(widget);
    const chromePaddingMap = {
      compact: { left: 4, right: 4, top: 8, bottom: 4 },
      comfortable: { left: 18, right: 18, top: 24, bottom: 18 },
      spacious: { left: 40, right: 40, top: 52, bottom: 40 },
    } as const;
    const resolvedPadding = chromePaddingMap[(widget.chrome?.paddingPreset || "comfortable") as keyof typeof chromePaddingMap] || chromePaddingMap.comfortable;
    const dataItems = Array.isArray(kpi.items) && kpi.items.length > 0 ? kpi.items : [kpi];
    const itemsPerRow = Math.max(1, Number(widget.kpiStyle?.itemsPerRow || 2));
    const itemsPerColumn = Math.max(1, Number(widget.kpiStyle?.itemsPerColumn || 3));
    const contentMode = widget.kpiStyle?.multiValueLayout || "verticalList";
    const isHorizontal = kpi.layout === "horizontal";
    const gridColumns = isHorizontal ? Math.min(itemsPerRow, dataItems.length) : Math.ceil(dataItems.length / itemsPerColumn);
    const gridRows = isHorizontal ? Math.ceil(dataItems.length / itemsPerRow) : Math.min(itemsPerColumn, dataItems.length);
    const isSingleItem = dataItems.length === 1;
    const itemSizeScale = isSingleItem ? 1 : (widget.kpiStyle?.itemSize === "small" ? 0.72 : widget.kpiStyle?.itemSize === "large" ? 0.96 : 0.84);
    const gridGap = isSingleItem ? 0 : 16;
    const dividerWidth = Math.max(1, Number(widget.kpiStyle?.dividerWidth || 1));
    const verticalDividerOffset = gridGap / 2 + dividerWidth / 2;
    const contentWidth = Math.max(240, widget.position.w - resolvedPadding.left - resolvedPadding.right);
    const cellWidth = Math.max(120, (contentWidth - Math.max(0, gridColumns - 1) * gridGap) / Math.max(1, gridColumns));
    const cellHeight = Math.max(120, contentHeight / Math.max(1, gridRows));
    const heightScale = Math.max(0.92, Math.min(1.45, cellHeight / 180));
    const cardPaddingY = Math.max(14, Math.round(KPI_ITEM_PADDING_Y * heightScale));
    const cardPaddingX = Math.max(12, Math.round(KPI_ITEM_PADDING_X * Math.min(1.3, heightScale)));
    const contentGap = Math.max(10, Math.round(12 * heightScale));
    const rowGap = Math.max(12, Math.round(14 * heightScale));
    const labelFontSize = Math.max(14, Math.round(Number(kpi.metricLabelFontSize || 16) * Math.min(1.22, heightScale)));
    const trendFontSize = Math.max(13, Math.round(Number(kpi.compareLabelFontSize || 16) * Math.min(1.18, heightScale)));
    const contentOrientation = widget.kpiStyle?.contentOrientation || "vertical";
    const valueFontSize = Math.max(20, Math.round(Number(widget.kpiStyle?.valueFontSize || (kpi.mode === "flipper" ? 42 : kpi.mode === "progress" ? 28 : 34)) * heightScale));
    const estimatedLongestValueLength = Math.max(
      4,
      ...dataItems.map((item) => String(item.formattedValue ?? item.primaryValue ?? "0").length + String(kpi.valuePrefix || "").length + String(kpi.valueSuffix || "").length)
    );
    const estimatedLongestLabelLength = Math.max(
      2,
      ...dataItems.map((item) => String(item.label || widget.widgetName || "").length)
    );
    const estimatedTrendLength = Math.max(
      4,
      ...dataItems.map((item) => `${kpi.compareLabel || "同比"} ${Number(item.trendPercent || 0) >= 0 ? "+" : ""}${item.trendPercent ?? 0}%`.length)
    );
    const estimatedValueWidth = estimatedLongestValueLength * valueFontSize * 0.62;
    const estimatedLabelWidth = estimatedLongestLabelLength * labelFontSize * 0.62;
    const estimatedTrendWidth = estimatedTrendLength * trendFontSize * 0.58;
    const minCardWidth = Math.max(120, Math.ceil(Math.max(estimatedValueWidth, estimatedLabelWidth, estimatedTrendWidth) + cardPaddingX * 2));
    const minCardHeight = Math.max(88, Math.ceil(labelFontSize + valueFontSize + trendFontSize + contentGap * 2 + cardPaddingY * 2));
    const adaptiveItemScale = Math.max(itemSizeScale, Math.min(1, Math.max(minCardWidth / cellWidth, minCardHeight / cellHeight)));
    const renderKpiItem = (item: any, index: number) => {
      const valueNode = (
        widget.kpiStyle?.showValue === false ? null : (
          renderKpiValueNode(item.primaryValue, kpi, widget.kpiStyle, widget.accentColor, heightScale)
        )
      );
      const labelNode = kpi.showMetricLabel !== false ? (
        <Typography.Text
          style={{
            color: kpi.metricLabelColor || "#667085",
            fontSize: labelFontSize,
            fontWeight: Number(kpi.metricLabelFontWeight || 600),
            textAlign: widget.kpiStyle?.itemAlign || widget.chrome?.titleAlign || "left",
            whiteSpace: "nowrap",
          }}
        >
          {item.label || widget.widgetName}
        </Typography.Text>
      ) : null;
      const trendNode = kpi.showTrend !== false && item.trendPercent !== null ? (
        <Typography.Text
          style={{
            color: (kpi.compareLabelColor && String(kpi.compareLabelColor).trim())
              ? String(kpi.compareLabelColor)
              : (widget.kpiStyle?.trendColorMode === "fixed"
                ? "#52c41a"
                : (Number(item.trendPercent) >= 0 ? "#52c41a" : "#ff4d4f")),
            fontSize: trendFontSize,
            fontWeight: Number(kpi.compareLabelFontWeight || 600),
            whiteSpace: "nowrap",
          }}
        >
          {kpi.compareLabel || "同比"} {Number(item.trendPercent) >= 0 ? "+" : ""}{item.trendPercent}%
        </Typography.Text>
      ) : null;

      if (kpi.mode === "progress") {
        return (
        <div
          key={`${widget.key}_kpi_${index}`}
          style={{
            display: "flex",
            flexDirection: contentMode === "horizontalList" ? "row" : "column",
            alignItems: contentMode === "horizontalList" ? "center" : "stretch",
            justifyContent: "center",
            gap: rowGap,
            width: "100%",
          }}
        >
            {labelNode}
            <div style={{ display: "flex", flexDirection: "column", gap: contentGap, flex: 1 }}>
              {valueNode}
              <div style={{ width: "100%", height: 10, borderRadius: 999, background: String(widget.kpiStyle?.progressTrackColor || widget.kpiStyle?.itemBorderColor || "#e5edf7"), overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, Number(item.primaryValue || 0)))}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: String(widget.kpiStyle?.progressFillColor || widget.kpiStyle?.valueColor || widget.accentColor || "#1677ff"),
                  }}
                />
              </div>
              {trendNode}
            </div>
          </div>
        );
      }

      if (kpi.mode === "flipper") {
        const flipperDigits = (
          <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: `${Math.max(32, Number(widget.kpiStyle?.flipperDigitWidth || 56))}px`, justifyContent: "center", gap: Number(widget.kpiStyle?.flipperGap || 6) }}>
            {String(item.formattedValue ?? item.primaryValue ?? "0").split("").map((char: string, charIndex: number) => (
              <FlipperDigit
                key={`${widget.key}_flip_${index}_${charIndex}`}
                char={char}
                width={Math.max(32, Number(widget.kpiStyle?.flipperDigitWidth || 56))}
                height={Math.max(32, Number(widget.kpiStyle?.flipperDigitHeight || 52))}
                radius={Number(widget.kpiStyle?.flipperDigitRadius || 10)}
                refreshSeconds={Math.max(0.2, Number(widget.kpiStyle?.flipperRefreshSeconds || 1.2))}
                background={String(widget.kpiStyle?.flipperBackground || `linear-gradient(180deg, ${String(widget.kpiStyle?.valueColor || "#0f172a")} 0%, rgba(15,23,42,0.92) 100%)`)}
                fontSize={Math.max(20, Math.round(Number(widget.kpiStyle?.valueFontSize || 28) * Math.min(1.1, heightScale)))}
                color={String(widget.kpiStyle?.valueColor || "#f8fafc")}
              />
            ))}
          </div>
        );
        return (
        <div
          key={`${widget.key}_kpi_${index}`}
          style={{
            display: "flex",
            flexDirection: contentOrientation === "horizontal" ? "row" : "column",
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
          key={`${widget.key}_kpi_${index}`}
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
          background: buildChromeBackgroundFromStyle(widget.chrome || null),
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
          {dataItems.map((item, index) => (
            <div
              key={`${widget.key}_kpi_wrap_${index}`}
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!isHorizontal && contentMode === "verticalList" && widget.kpiStyle?.showDivider !== false && index < dataItems.length - Math.max(1, gridColumns) ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: Math.max(1, Number(widget.kpiStyle?.dividerWidth || 1)),
                  }}
                >
                  {renderCenteredKpiDividerNode(widget.kpiStyle?.dividerStyle, widget.kpiStyle?.dividerColor, widget.kpiStyle?.dividerWidth, "horizontal")}
                </div>
              ) : null}
              {isHorizontal && widget.kpiStyle?.showDivider !== false && ((index + 1) % Math.max(1, gridColumns) !== 0) && index !== dataItems.length - 1 ? (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    right: -gridGap,
                    width: Math.max(1, gridGap),
                  }}
                >
                  {renderCenteredKpiDividerNode(widget.kpiStyle?.dividerStyle, widget.kpiStyle?.dividerColor, widget.kpiStyle?.dividerWidth, "vertical")}
                </div>
              ) : null}
              <div
                style={{
                  width: `${adaptiveItemScale * 100}%`,
                  height: `${adaptiveItemScale * 100}%`,
                  minWidth: minCardWidth,
                  minHeight: minCardHeight,
                  alignSelf: "center",
                  justifySelf: "center",
                  position: "relative",
                  background: String(widget.kpiStyle?.itemBackgroundColor || "#ffffff"),
                  border: `${Number(widget.kpiStyle?.itemBorderWidth || 0)}px solid ${widget.kpiStyle?.itemBorderColor || "#e5e7eb"}`,
                  borderRadius: Number(widget.kpiStyle?.itemBorderRadius || 12),
                  transition: widget.kpiStyle?.hoverElevated === false ? undefined : "transform 180ms ease, box-shadow 180ms ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: Math.max(10, Math.min(cardPaddingY, Math.floor(cellHeight * 0.16))),
                  paddingBottom: contentMode === "verticalList" && widget.kpiStyle?.showDivider !== false && index < dataItems.length - Math.max(1, gridColumns)
                    ? Math.max(12, Math.min(cardPaddingY, Math.floor(cellHeight * 0.16)))
                    : Math.max(10, Math.min(cardPaddingY, Math.floor(cellHeight * 0.16))),
                  paddingLeft: contentMode === "grid" ? cardPaddingX : 0,
                  paddingRight: contentMode === "grid" ? cardPaddingX : 0,
                  textAlign: widget.kpiStyle?.itemAlign || "left",
                  boxShadow: Number(widget.kpiStyle?.itemBorderWidth || 0) > 0 ? "0 4px 10px rgba(15,23,42,0.04)" : "none",
                }}
                className={widget.kpiStyle?.hoverElevated === false ? undefined : "reporting-kpi-item-card"}
              >
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: widget.kpiStyle?.itemAlign === "center" ? "center" : widget.kpiStyle?.itemAlign === "right" ? "flex-end" : "flex-start", height: "100%", width: "100%" }}>
                  {renderKpiItem(item, index)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (widget.widgetType === "table" && widget.preview?.table) {
    return (
      <div style={{ height: contentHeight, padding: 8, background: buildChromeBackgroundFromStyle(widget.chrome || null) }}>
        <Table
          size={widget.tableStyle?.compact ? "small" : "middle"}
          dataSource={widget.preview.table.rows}
          columns={widget.preview.table.columns.map((column) => ({
            title: column.title,
            dataIndex: column.dataIndex,
            key: column.key,
            onHeaderCell: () => ({
              style: {
                background: String(widget.tableStyle?.headerBackground || "#f5f7fb"),
                color: String(widget.tableStyle?.headerTextColor || "#101828"),
                borderColor: String(widget.tableStyle?.rowBorderColor || "#eef2f7"),
              },
            }),
            onCell: (_record: unknown, index?: number) => ({
              style: {
                background: widget.tableStyle?.striped !== false && typeof index === "number" && index % 2 === 1
                  ? String(widget.tableStyle?.rowAlternateBackground || "#fafcff")
                  : String(widget.tableStyle?.rowBackground || "#ffffff"),
                borderColor: String(widget.tableStyle?.rowBorderColor || "#eef2f7"),
              },
            }),
          }))}
          pagination={{ pageSize: Number(widget.table?.pageSize || 10), showSizeChanger: false }}
          rowKey={(_, index) => `${widget.key}_table_${index}`}
          scroll={{ x: "max-content", y: contentHeight - 68 }}
        />
      </div>
    );
  }

  if (widget.widgetType === "tabs") {
    const containerItems = widget.tabs?.items || buildDefaultTabsConfig().items;
    const tabsActiveKey = widget.preview?.tabs?.defaultActiveKey || widget.tabs?.defaultActiveKey || containerItems[0]?.key || undefined;
    return (
      <div style={{ height: contentHeight, padding: 8, background: buildChromeBackgroundFromStyle(widget.chrome || null) }}>
        <Tabs
          key={`${widget.key}_${tabsActiveKey}_${containerItems.length}`}
          size="small"
          defaultActiveKey={tabsActiveKey}
          tabBarStyle={{
            marginBottom: 8,
            background: String(widget.tabsStyle?.tabBarBackgroundColor || "#f8fafc"),
            borderRadius: 10,
            padding: "4px 8px",
          }}
          items={containerItems.map((item) => ({
            key: item.key,
            label: (
              <span
                style={{
                  color: highlightedTabKey === item.key ? String(widget.tabsStyle?.activeTextColor || "#1677ff") : String(widget.tabsStyle?.inactiveTextColor || "#667085"),
                  background: highlightedTabKey === item.key ? String(widget.tabsStyle?.activeBackground || "rgba(22,119,255,0.14)") : "transparent",
                  boxShadow: highlightedTabKey === item.key ? `0 0 0 1px ${String(widget.tabsStyle?.indicatorColor || "rgba(22,119,255,0.28)")} inset` : "none",
                  borderRadius: 999,
                  padding: "2px 10px",
                  transition: "background 180ms ease, box-shadow 180ms ease",
                }}
              >
                {item.title}
              </span>
            ),
            children: (() => {
              const childWidget = allWidgets.find((child: CanvasWidgetDraft) => child.key === item.childWidgetKey);
              if (!childWidget) {
                return null;
              }
              return (
                <div
                  style={{ height: contentHeight - 48, paddingTop: 4 }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectWidget?.(childWidget);
                  }}
                >
                  {renderWidgetPreview({
                    ...childWidget,
                    position: {
                      ...childWidget.position,
                      h: contentHeight - 12,
                    },
                  }, allWidgets, onSelectWidget, highlightedTabKey, onWidgetChange)}
                </div>
              );
            })(),
          }))}
        />
      </div>
    );
  }

  if (widget.preview?.option) {
    return <ChartWidgetPreview widget={widget} contentHeight={contentHeight} onWidgetChange={onWidgetChange} />;
  }

  return (
    <div style={{ height: contentHeight, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3" }}>
      点击部件后从右侧配置抽屉绑定数据并预览
    </div>
  );
}

function renderConfigGrid(children: React.ReactNode) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>{children}</div>;
}

function renderReadonlyThemeValue(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div
        style={{
          minHeight: 40,
          padding: "8px 12px",
          borderRadius: 12,
          border: "1px solid #d6deea",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function applyPieVariantPreset(current: WidgetChartStyleConfig, variant?: WidgetChartStyleConfig["pieVariant"]) {
  const base = applyPieVariantDefaults({
    ...buildDefaultChartStyleConfig(),
    ...current,
    pieVariant: variant || current.pieVariant || "classic-donut",
  });
  return {
    ...current,
    ...base,
    pieVariant: base.pieVariant,
  };
}

function supportsPieCenterContent(variant?: WidgetChartStyleConfig["pieVariant"] | null) {
  return variant === "classic-donut" || variant === "half-donut" || variant === "nested";
}

function isPieVariantFullCircle(variant?: WidgetChartStyleConfig["pieVariant"] | null) {
  return variant === "classic-pie" || variant === "classic-donut" || variant === "rose" || variant === "nested";
}

function buildPieStructureFromAsset(asset: ReportingChartAssetRecord, current?: WidgetChartStyleConfig | null): WidgetChartStyleConfig {
  const variantName = String(asset.variantName || asset.chartName || "");
  const hasSavedVariant = Boolean(current?.pieVariant);
  const legacyVariant = hasSavedVariant
    ? (current?.pieVariant || "classic-donut")
    : inferLegacyPieVariant({ variantName, chartVariant: asset.config?.chartVariant }, "classic-donut");
  const seeded = {
    ...(current || buildDefaultChartStyleConfig()),
    pieVariant: legacyVariant,
  };
  return hasSavedVariant
    ? applyPieVariantConstraints(seeded)
    : applyPieVariantPreset(seeded, legacyVariant);
}

function inferLegacyPieVariant(source: Record<string, unknown>, fallback?: WidgetChartStyleConfig["pieVariant"]) {
  const variantName = String(source.variantName || source.chartVariant || "").toLowerCase();
  if (variantName.includes("半环")) return "half-donut";
  if (variantName.includes("玫瑰") || variantName.includes("rose")) return "rose";
  if (variantName.includes("多环") || variantName.includes("嵌套")) return "nested";
  if (variantName.includes("玻璃")) return "classic-donut";
  if (variantName.includes("分离")) return "classic-donut";
  if (variantName.includes("立体")) return "classic-donut";
  return fallback || "classic-donut";
}

function getPieThemePreset(style: WidgetChartStyleConfig) {
  const fallbackAccent = style.accentColor || "#1677ff";
  const palettePreset = String(style.palettePreset || "");
  const kpiTheme = KPI_THEME_TEMPLATES.find((item) => item.key === palettePreset);
  const kpiCategory = kpiTheme?.category;
  const themeMap: Record<string, {
    palette: string[];
    labelColor: string;
    valueColor: string;
    lineColor: string;
    borderColor: string;
    shadowColor: string;
    centerTitleColor: string;
    centerValueColor: string;
    centerMetaColor: string;
  }> = {
    business: {
      palette: ["#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd", "#cfe2ff"],
      labelColor: "#344054",
      valueColor: "#0f172a",
      lineColor: "#98a2b3",
      borderColor: "#ffffff",
      shadowColor: "rgba(15,23,42,0.14)",
      centerTitleColor: "#667085",
      centerValueColor: "#101828",
      centerMetaColor: "#98a2b3",
    },
    minimal: {
      palette: ["#475467", "#98a2b3", "#cbd5e1", "#e2e8f0", "#f1f5f9"],
      labelColor: "#334155",
      valueColor: "#0f172a",
      lineColor: "#cbd5e1",
      borderColor: "#ffffff",
      shadowColor: "rgba(15,23,42,0.08)",
      centerTitleColor: "#64748b",
      centerValueColor: "#0f172a",
      centerMetaColor: "#94a3b8",
    },
    "dark-screen": {
      palette: ["#38bdf8", "#22c55e", "#f59e0b", "#f97316", "#a78bfa"],
      labelColor: "#e2e8f0",
      valueColor: "#f8fafc",
      lineColor: "#64748b",
      borderColor: "#0f172a",
      shadowColor: "rgba(15,23,42,0.45)",
      centerTitleColor: "#cbd5e1",
      centerValueColor: "#f8fafc",
      centerMetaColor: "#94a3b8",
    },
    glass: {
      palette: ["#5eead4", "#38bdf8", "#818cf8", "#c084fc", "#f9a8d4"],
      labelColor: "#e0f2fe",
      valueColor: "#ffffff",
      lineColor: "rgba(224,242,254,0.7)",
      borderColor: "rgba(255,255,255,0.55)",
      shadowColor: "rgba(8,47,73,0.28)",
      centerTitleColor: "#dbeafe",
      centerValueColor: "#ffffff",
      centerMetaColor: "#bfdbfe",
    },
    "neon-contrast": {
      palette: ["#14f1ff", "#267dff", "#7c5cff", "#ff4fd8", "#ffe066"],
      labelColor: "#e0fbff",
      valueColor: "#ffffff",
      lineColor: "#67e8f9",
      borderColor: "#0b1020",
      shadowColor: "rgba(20,241,255,0.35)",
      centerTitleColor: "#a5f3fc",
      centerValueColor: "#ffffff",
      centerMetaColor: "#67e8f9",
    },
    "warm-metal": {
      palette: ["#b7791f", "#d4a14d", "#e8c27d", "#8c6239", "#f3dfb2"],
      labelColor: "#6b4f2d",
      valueColor: "#5b3b16",
      lineColor: "#bfa27a",
      borderColor: "#fff8ee",
      shadowColor: "rgba(120,72,24,0.18)",
      centerTitleColor: "#8c6a44",
      centerValueColor: "#5b3b16",
      centerMetaColor: "#a98962",
    },
    morandi: {
      palette: ["#7c8da6", "#a3b18a", "#d4a5a5", "#c8b6a6", "#bfc8d6"],
      labelColor: "#5b6472",
      valueColor: "#2f3542",
      lineColor: "#c8d0da",
      borderColor: "#f8fafc",
      shadowColor: "rgba(100,116,139,0.12)",
      centerTitleColor: "#6b7280",
      centerValueColor: "#374151",
      centerMetaColor: "#9ca3af",
    },
  } as const;
  let preset = themeMap.business;
  if (kpiCategory === "light") preset = themeMap.minimal;
  if (kpiCategory === "dark") preset = themeMap["dark-screen"];
  if (kpiCategory === "blue") preset = themeMap.business;
  if (kpiCategory === "green") preset = themeMap.morandi;
  if (kpiCategory === "warm") preset = themeMap["warm-metal"];
  if (kpiCategory === "purple") preset = themeMap["neon-contrast"];
  if (palettePreset === "glass-minimal") preset = themeMap.glass;
  if (palettePreset === "neon-frame") preset = themeMap["neon-contrast"];
  if (palettePreset === "capital-blueprint") preset = themeMap.business;
  if (palettePreset === "boardroom-silver") preset = themeMap.minimal;
  if (palettePreset === "executive-ink" || palettePreset === "private-banking") preset = themeMap["warm-metal"];
  if (palettePreset === "violet-glow" || palettePreset === "plum-night") preset = themeMap["neon-contrast"];
  const visualPreset = PIE_TEMPLATE_VISUAL_MAP[palettePreset];
  const accent = visualPreset?.accent || fallbackAccent;
  if (visualPreset?.backgroundColor && (palettePreset === "midnight-panel" || palettePreset === "obsidian-glow" || palettePreset === "aurora-night" || palettePreset === "executive-ink" || palettePreset === "plum-night")) {
    preset = {
      ...preset,
      labelColor: palettePreset === "executive-ink" ? "#f3e7c5" : "#e7eefb",
      lineColor: palettePreset === "executive-ink" ? "rgba(214,181,110,0.55)" : "rgba(176,194,224,0.58)",
      centerTitleColor: palettePreset === "executive-ink" ? "#e9d6a2" : "#d7e4ff",
      centerValueColor: palettePreset === "executive-ink" ? "#fff3d6" : "#f8fbff",
      centerMetaColor: palettePreset === "executive-ink" ? "#bba57a" : "#9fb3d6",
      borderColor: palettePreset === "executive-ink" ? "#4e3f2b" : "#243a63",
    };
  }
  return {
    ...preset,
    palette: visualPreset?.palette || preset.palette.map((color, index) => index === 0 ? accent || color : color),
  };
}

function formatPieNumericValue(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "0";
}

function buildPieLabelFormatter(style: WidgetChartStyleConfig) {
  return (params: { name?: string; value?: number; percent?: number }) => {
    const lines: string[] = [];
    if (style.pieShowCategory !== false && params.name) lines.push(String(params.name));
    if (style.pieShowValue) {
      const valueText = style.pieValueFormat === "percent"
        ? `${Number(params.percent || 0).toFixed(1)}%`
        : formatPieNumericValue(Number(params.value || 0));
      lines.push(valueText);
    }
    if (style.pieShowPercent !== false) {
      lines.push(`${Number(params.percent || 0).toFixed(1)}%`);
    }
    return lines.join("\n");
  };
}

function applyPieDataTransform(series: Record<string, any>, style: WidgetChartStyleConfig) {
  const data = Array.isArray(series.data) ? [...series.data] : [];
  const normalized = data.map((item) => ({
    ...item,
    name: String(item?.name ?? ""),
    value: Number(item?.value ?? 0),
  }));
  if (style.pieSortOrder === "desc") {
    normalized.sort((a, b) => b.value - a.value);
  } else if (style.pieSortOrder === "asc") {
    normalized.sort((a, b) => a.value - b.value);
  }
  const maxSlices = Math.max(1, Number(style.pieMaxSlices || 7));
  if (style.pieMergeOthers && normalized.length > maxSlices) {
    const head = normalized.slice(0, maxSlices - 1);
    const tail = normalized.slice(maxSlices - 1);
    const othersValue = tail.reduce((sum, item) => sum + Number(item.value || 0), 0);
    head.push({ name: style.pieOthersName || "其他", value: othersValue });
    return head;
  }
  return normalized.slice(0, maxSlices);
}

function applyPieVariantDefaults(style: WidgetChartStyleConfig): WidgetChartStyleConfig {
  const variant = style.pieVariant || "classic-donut";
  const next = { ...style };
  if (variant === "classic-pie") {
    next.pieInnerRadius = 0;
    next.pieOuterRadius = 82;
    next.pieSweepAngle = 360;
    next.pieRoseMode = "off";
    next.pieShowCenter = false;
    next.pieLabelMode = "outside";
    next.pieSliceGap = 0;
    next.pieBorderRadius = 0;
    next.pieSelectedOffset = 0;
    next.pieHoverScale = false;
  } else if (variant === "classic-donut") {
    next.pieInnerRadius = 52;
    next.pieOuterRadius = 82;
    next.pieSweepAngle = 360;
    next.pieRoseMode = "off";
    next.pieShowCenter = true;
    next.pieLabelMode = "outside";
    next.pieSliceGap = 0;
    next.pieBorderRadius = 0;
    next.pieSelectedOffset = 0;
    next.pieHoverScale = false;
  } else if (variant === "rose") {
    next.pieInnerRadius = 18;
    next.pieOuterRadius = 84;
    next.pieSweepAngle = 360;
    next.pieRoseMode = "area";
    next.pieShowCenter = false;
    next.pieLabelMode = "outside";
    next.pieLabelLineShow = true;
    next.pieSortOrder = "desc";
    next.pieSliceGap = 0;
    next.pieBorderRadius = 0;
    next.pieSelectedOffset = 0;
    next.pieHoverScale = false;
  } else if (variant === "half-donut") {
    next.pieInnerRadius = 56;
    next.pieOuterRadius = 82;
    next.pieStartAngle = 180;
    next.pieSweepAngle = 180;
    next.pieRoseMode = "off";
    next.pieShowCenter = true;
    next.pieLabelMode = "center";
    next.pieSliceGap = 0;
    next.pieBorderRadius = 0;
    next.pieSelectedOffset = 0;
    next.pieHoverScale = false;
  } else if (variant === "nested") {
    next.pieInnerRadius = 28;
    next.pieOuterRadius = 78;
    next.pieSweepAngle = 360;
    next.pieRoseMode = "off";
    next.pieShowCenter = true;
    next.pieLabelMode = "outside";
    next.pieSliceGap = 0;
    next.pieBorderRadius = 0;
    next.pieSelectedOffset = 0;
    next.pieHoverScale = false;
  }
  return next;
}

function applyPieVariantConstraints(style: WidgetChartStyleConfig): WidgetChartStyleConfig {
  const next = { ...style };
  const variant = next.pieVariant || "classic-donut";
  if (variant === "classic-pie") {
    next.pieInnerRadius = 0;
    next.pieShowCenter = false;
    next.pieLabelMode = next.pieLabelMode === "center" ? "outside" : next.pieLabelMode;
  } else if (variant === "classic-donut") {
    next.pieInnerRadius = Number(next.pieInnerRadius ?? 52);
    next.pieShowCenter = next.pieShowCenter ?? true;
  }
  if (variant === "half-donut") {
    next.pieStartAngle = Number(next.pieStartAngle ?? 180);
    next.pieSweepAngle = Number(next.pieSweepAngle ?? 180);
  }
  return next;
}

function applyPieThemeAndVariant(option: Record<string, any>, chartStyle: WidgetChartStyleConfig) {
  if (!Array.isArray(option.series)) return option;
  const pieSeriesIndex = option.series.findIndex((item: Record<string, any>) => item?.type === "pie");
  if (pieSeriesIndex < 0) return option;

  const style = applyPieVariantConstraints({
    ...buildDefaultChartStyleConfig(),
    ...chartStyle,
  });
  const paddingPreset = chromePaddingToPiePadding((option as Record<string, any>).__paddingPreset || "comfortable");
  const themePreset = getPieThemePreset(style);
  const nextOption = { ...option };
  const baseSeries = { ...(nextOption.series[pieSeriesIndex] || {}) };
  const data = applyPieDataTransform(baseSeries, style);
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const centerValue = style.pieCenterValue || formatPieNumericValue(total);
  const innerRadius = Math.max(0, Number(style.pieInnerRadius || 0));
  const outerRadius = Math.max(innerRadius + 4, Math.max(20, Number(style.pieOuterRadius || 82) - paddingPreset.radiusOffset));
  const startAngle = Number(style.pieStartAngle || 90);
  const sweepAngle = Math.max(1, Math.min(360, Number(style.pieSweepAngle || 360)));
  const endAngle = startAngle - sweepAngle;
  const labelFormatter = buildPieLabelFormatter(style);
  const centerX = style.pieVariant === "half-donut" ? "50%" : `${50 + paddingPreset.centerXOffset}%`;
  const centerY = style.pieVariant === "half-donut"
    ? `${72 - paddingPreset.centerYOffset * 0.4}%`
    : `${50 + paddingPreset.centerYOffset}%`;

  const mainSeries = {
    ...baseSeries,
    type: "pie",
    data,
    colorBy: "data",
    roseType: style.pieRoseMode && style.pieRoseMode !== "off" ? style.pieRoseMode : false,
    radius: [`${innerRadius}%`, `${outerRadius}%`],
    center: [centerX, centerY],
    startAngle,
    endAngle,
    minAngle: Number(style.pieMinAngle || 2),
    selectedMode: style.pieHoverScale === false ? false : "single",
    selectedOffset: Number(style.pieSelectedOffset || 10),
    avoidLabelOverlap: true,
    itemStyle: {
      ...(baseSeries.itemStyle || {}),
      borderRadius: Number(style.pieBorderRadius || 0),
      borderWidth: Number(style.pieBorderWidth || 0),
      borderColor: style.pieBorderColor || themePreset.borderColor,
      shadowBlur: Number(style.pieShadowBlur || 0),
      shadowColor: style.pieShadowColor || themePreset.shadowColor,
    },
    label: {
      ...(baseSeries.label || {}),
      show: style.pieLabelMode !== "hidden",
      position: style.pieLabelMode === "inside" ? "inside" : style.pieLabelMode === "center" ? "center" : "outside",
      color: style.pieLabelColor || themePreset.labelColor,
      fontSize: Number(style.pieLabelFontSize || 14),
      fontWeight: Number(style.pieLabelFontWeight || 500),
      formatter: style.pieLabelMode === "hidden" ? "" : labelFormatter,
      overflow: "truncate",
    },
    labelLine: {
      ...(baseSeries.labelLine || {}),
      show: style.pieLabelMode === "outside" && style.pieLabelLineShow !== false,
      lineStyle: {
        ...((baseSeries.labelLine || {}).lineStyle || {}),
        color: style.pieLabelLineColor || themePreset.lineColor,
        width: Number(style.pieLabelLineWidth || 1),
      },
      length: Number(style.pieLabelLineLength || 18),
      length2: Number(style.pieLabelLineLength2 || 12),
      smooth: true,
    },
    emphasis: {
      ...(baseSeries.emphasis || {}),
      scale: style.pieHoverScale !== false,
      scaleSize: style.pieHoverScale === false ? 0 : 8,
      label: {
        ...((baseSeries.emphasis || {}).label || {}),
        color: style.pieValueColor || style.pieLabelColor || themePreset.valueColor,
        fontSize: Number(style.pieValueFontSize || style.pieLabelFontSize || 14),
        fontWeight: Number(style.pieValueFontWeight || 700),
      },
    },
  };

  const seriesList = [mainSeries];

  if (style.pieVariant === "nested") {
    const outerData = data;
    const totalValue = total || 1;
    const innerData = data.slice(0, Math.min(4, data.length)).map((item) => ({
      name: item.name,
      value: Number(((item.value / totalValue) * 100).toFixed(2)),
    }));
    seriesList.push({
      ...mainSeries,
      radius: [`${Math.max(10, innerRadius - 18)}%`, `${Math.max(18, innerRadius - 4)}%`],
      data: innerData,
      label: { ...mainSeries.label, show: false },
      labelLine: { ...mainSeries.labelLine, show: false },
      z: 3,
    });
  }

  nextOption.color = Array.isArray(style.palette) && style.palette.length ? style.palette : themePreset.palette;
  nextOption.series = seriesList;
  nextOption.legend = {
    ...(nextOption.legend || {}),
    show: chartStyle.showLegend !== false,
    top: style.pieLegendPosition === "top" ? 8 + paddingPreset.radiusOffset : style.pieLegendPosition === "bottom" ? undefined : "center",
    bottom: style.pieLegendPosition === "bottom" ? Math.max(0, paddingPreset.radiusOffset - 2) : undefined,
    left: style.pieLegendPosition === "left" ? 8 + paddingPreset.radiusOffset : style.pieLegendPosition === "right" ? undefined : "center",
    right: style.pieLegendPosition === "right" ? 8 + paddingPreset.radiusOffset : undefined,
    orient: style.pieLegendPosition === "left" || style.pieLegendPosition === "right" ? "vertical" : "horizontal",
    textStyle: {
      ...((nextOption.legend || {}).textStyle || {}),
      color: style.pieLabelColor || themePreset.labelColor,
    },
    formatter: (name: string) => {
      const current = data.find((item) => item.name === name);
      if (!current) return name;
      const parts = [name];
      if (style.pieLegendShowValue) parts.push(formatPieNumericValue(Number(current.value || 0)));
      if (style.pieLegendShowPercent) parts.push(`${total ? ((Number(current.value || 0) / total) * 100).toFixed(1) : "0.0"}%`);
      return parts.join("  ");
    },
  };

  if (style.pieShowCenter) {
    const centerGraphicY = style.pieVariant === "half-donut"
      ? `${58 - paddingPreset.centerYOffset * 0.4}%`
      : `${50 + paddingPreset.centerYOffset}%`;
    const titleText = style.pieCenterTitle || "总量";
    const valueText = `${centerValue}`;
    const unitText = String(style.pieCenterUnit || "").trim();
    const subtitleText = String(style.pieCenterSubtitle || "").trim();
    const titleFontSize = Number(style.pieCenterTitleFontSize || 14);
    const valueFontSize = Number(style.pieCenterValueFontSize || 28);
    const unitFontSize = Number(style.pieCenterUnitFontSize || 18);
    const metaFontSize = Number(style.pieCenterMetaFontSize || 12);
    const rows: Array<{
      text: string;
      fontSize: number;
      fontWeight: number;
      fill: string;
      marginTop?: number;
    }> = [
      {
        text: titleText,
        fontSize: titleFontSize,
        fontWeight: 500,
        fill: style.pieCenterTitleColor || themePreset.centerTitleColor,
      },
      {
        text: valueText,
        fontSize: valueFontSize,
        fontWeight: 700,
        fill: style.pieCenterValueColor || themePreset.centerValueColor,
        marginTop: 8,
      },
    ];
    if (unitText) {
      rows.push({
        text: unitText,
        fontSize: unitFontSize,
        fontWeight: 600,
        fill: style.pieCenterUnitColor || style.pieCenterValueColor || themePreset.centerValueColor,
        marginTop: 4,
      });
    }
    if (subtitleText) {
      rows.push({
        text: subtitleText,
        fontSize: metaFontSize,
        fontWeight: 400,
        fill: style.pieCenterMetaColor || themePreset.centerMetaColor,
        marginTop: 8,
      });
    }
    const totalHeight = rows.reduce((sum, row, index) => sum + row.fontSize + (index === 0 ? 0 : Number(row.marginTop || 0)), 0);
    let currentTop = -Math.round(totalHeight / 2);
    nextOption.graphic = [
      {
        type: "group",
        left: "center",
        top: centerGraphicY,
        bounding: "raw",
        children: rows.map((row, index) => {
          if (index > 0) currentTop += Number(rows[index - 1].fontSize) + Number(row.marginTop || 0);
          const child = {
            type: "text",
            x: 0,
            top: currentTop,
            style: {
              text: row.text,
              fill: row.fill,
              fontSize: row.fontSize,
              fontWeight: row.fontWeight,
              textAlign: "center",
              textVerticalAlign: "top",
            },
          };
          return child;
        }),
      },
    ];
  } else {
    nextOption.graphic = [];
  }

  return nextOption;
}

function renderKpiValueNode(
  value: string | number | null | undefined,
  kpi: Pick<WidgetKpiConfig, "valuePrefix" | "valueSuffix" | "decimals"> & { mode?: string | null },
  kpiStyle: WidgetKpiStyleConfig | undefined,
  accentColor?: string | null,
  scale = 1
) {
  const mainColor = kpiStyle?.valueColor || accentColor || "#1677ff";
  const mainFontSize = Math.max(20, Math.round(Number(kpiStyle?.valueFontSize || (kpi.mode === "flipper" ? 42 : kpi.mode === "progress" ? 28 : 34)) * scale));
  const mainFontWeight = Number(kpiStyle?.valueFontWeight || 700);
  const prefix = kpi.valuePrefix || "";
  const suffix = kpi.valueSuffix || "";
  const prefixColor = kpiStyle?.valuePrefixColor || mainColor;
  const prefixFontSize = Math.max(12, Math.round(Number(kpiStyle?.valuePrefixFontSize || Math.max(12, mainFontSize - 14)) * Math.max(0.9, scale)));
  const suffixColor = kpiStyle?.valueSuffixColor || mainColor;
  const suffixFontSize = Math.max(12, Math.round(Number(kpiStyle?.valueSuffixFontSize || Math.max(12, mainFontSize - 14)) * Math.max(0.9, scale)));

  return (
    <Statistic
      value={value ?? 0}
      precision={Number(kpi.decimals || 0)}
      valueStyle={{
        fontSize: mainFontSize,
        fontWeight: mainFontWeight,
        color: mainColor,
        letterSpacing: kpi.mode === "flipper" ? 2 : 0,
        whiteSpace: "nowrap",
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

function FlipperDigit({
  char,
  width,
  height,
  radius,
  background,
  refreshSeconds,
  fontSize,
  color,
}: {
  char: string;
  width: number;
  height: number;
  radius: number;
  background: string;
  refreshSeconds: number;
  fontSize: number;
  color: string;
}) {
  const digitList = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const targetIndex = /^\d$/.test(char) ? Number(char) : 0;
  const [offset, setOffset] = useState(targetIndex);
  const [transitionMs, setTransitionMs] = useState(0);

  useEffect(() => {
    setOffset(targetIndex);
  }, [targetIndex]);

  useEffect(() => {
    const durationMs = Math.max(400, refreshSeconds * 1000);
    const timer = window.setInterval(() => {
      const delayMs = Math.floor(Math.random() * 360);
      const extraRounds = 10 + Math.floor(Math.random() * 12);
      window.setTimeout(() => {
        setTransitionMs(Math.max(420, Math.min(1400, durationMs * 0.65)));
        setOffset(targetIndex + extraRounds * digitList.length);
        window.setTimeout(() => {
          setTransitionMs(0);
          setOffset(targetIndex);
        }, Math.max(420, Math.min(1400, durationMs * 0.65)) + 40);
      }, delayMs);
    }, durationMs);
    return () => window.clearInterval(timer);
  }, [refreshSeconds, targetIndex]);

  return (
    <div
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        borderRadius: radius,
        background,
        color: "#f8fafc",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(15,23,42,0.18)",
        width,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(-${offset * height}px)`,
          transition: transitionMs ? `transform ${transitionMs}ms cubic-bezier(0.22, 0.7, 0.18, 1)` : "none",
        }}
      >
        {Array.from({ length: digitList.length * 24 }, (_, rowIndex) => {
          const value = digitList[rowIndex % digitList.length];
          return (
          <div
            key={`${value}_${rowIndex}`}
            style={{
              height,
              width,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                borderRadius: radius,
                background,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(15,23,42,0.18)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: "50%",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 100%)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: "50%",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.18) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 4,
                  right: 4,
                  top: "50%",
                  height: 1,
                  transform: "translateY(-0.5px)",
                  background: "rgba(0,0,0,0.18)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.08)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize,
                  fontWeight: 700,
                  color,
                  textAlign: "center",
                }}
              >
                {value}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
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

function renderKpiStyleSections(
  selectedWidget: CanvasWidgetDraft,
  updateSelectedWidget: (patch: Partial<CanvasWidgetDraft>) => void,
  applyTemplateSelection: (selection: "__dashboard__" | number | null) => void,
  configForm: any,
  themeTemplateOptions: Array<{ label: string; options: Array<{ value: number; label: string }> }>,
  dashboardThemeTemplateId: number | null,
  dashboardThemeTemplateName?: string | null,
) {
  const mode = selectedWidget.kpi?.mode || "number";
  const followsDashboardTheme = selectedWidget.inheritDashboardTheme !== false;
  const showDivider = selectedWidget.kpiStyle?.showDivider !== false;
  const showValue = selectedWidget.kpiStyle?.showValue !== false;
  const showMetricLabel = selectedWidget.kpiStyle?.showMetricLabel !== false;
  const showTrend = selectedWidget.kpiAnalysis?.showTrend !== false;

  return [
    {
      key: "kpiStructure",
      label: "结构设置",
      children: renderConfigGrid(
        <>
          <Form.Item name={["kpi", "layout"]} label="排版方向">
            <Select options={[{ value: "vertical", label: "上下排版" }, { value: "horizontal", label: "左右排版" }]} />
          </Form.Item>
          <Form.Item name={["kpi", "mode"]} label="展示模式">
            <Select options={[{ value: "number", label: "数字卡" }, { value: "flipper", label: "翻牌器" }, { value: "progress", label: "进度指标" }]} />
          </Form.Item>
          {selectedWidget.kpi?.layout === "horizontal" ? (
            <Form.Item name={["kpiStyle", "itemsPerRow"]} label="每行展示个数">
              <Input type="number" min={1} max={6} />
            </Form.Item>
          ) : (
            <Form.Item name={["kpiStyle", "itemsPerColumn"]} label="每列展示个数">
              <Input type="number" min={1} max={6} />
            </Form.Item>
          )}
          <Form.Item name={["kpiStyle", "itemAlign"]} label="内容对齐">
            <Select options={[{ value: "left", label: "左对齐" }, { value: "center", label: "居中" }, { value: "right", label: "右对齐" }]} />
          </Form.Item>
        </>
      ),
    },
    {
      key: "kpiTheme",
      label: "主题设置",
      children: renderConfigGrid(
        <>
          <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
            <Select
              value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
              options={[
                { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                ...themeTemplateOptions,
              ]}
              onChange={(value) => {
                applyTemplateSelection(value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null));
              }}
            />
          </Form.Item>
          {followsDashboardTheme ? (
            <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
              当前组件已基于基础信息里的主题模板初始化。后续修改仅作用于当前组件。
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: "kpiContent",
      label: "信息内容",
      children: renderConfigGrid(
        <>
          <Form.Item name={["kpiStyle", "showValue"]} label="显示主值" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name={["kpi", "decimals"]} label="小数位">
            <Input type="number" />
          </Form.Item>
          <Form.Item name={["kpi", "valuePrefix"]} label="数值前缀">
            <Input placeholder="￥ / +" />
          </Form.Item>
          <Form.Item name={["kpi", "valueSuffix"]} label="数值后缀">
            <Input placeholder="% / 万 / 人" />
          </Form.Item>
          <Form.Item name={["kpiStyle", "contentOrientation"]} label="数字与名称布局">
            <Select options={[{ value: "vertical", label: "上下布局" }, { value: "horizontal", label: "左右布局" }]} />
          </Form.Item>
          {showValue ? (
            <>
              <Form.Item name={["kpiStyle", "valueColor"]} label="数值颜色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "valueFontSize"]} label="数值字号">
                <Input type="number" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "valuePrefixColor"]} label="前缀颜色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "valuePrefixFontSize"]} label="前缀字号">
                <Input type="number" min={12} />
              </Form.Item>
              <Form.Item name={["kpiStyle", "valueSuffixColor"]} label="后缀颜色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "valueSuffixFontSize"]} label="后缀字号">
                <Input type="number" min={12} />
              </Form.Item>
              <Form.Item name={["kpiStyle", "valueFontWeight"]} label="数值字重">
                <Input type="number" />
              </Form.Item>
            </>
          ) : null}
          <Form.Item name={["kpiStyle", "showMetricLabel"]} label="显示字段名称" valuePropName="checked">
            <Switch />
          </Form.Item>
          {showMetricLabel ? (
            <>
              <Form.Item name={["kpiStyle", "metricLabelColor"]} label="名称颜色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "metricLabelFontSize"]} label="名称字号">
                <Input type="number" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "metricLabelFontWeight"]} label="名称字重">
                <Input type="number" />
              </Form.Item>
            </>
          ) : null}
        </>
      ),
    },
    {
      key: "kpiItemCard",
      label: "子项卡片",
      children: renderConfigGrid(
        <>
          <Form.Item name={["kpiStyle", "itemSize"]} label="规格">
            <Select options={[{ value: "small", label: "小" }, { value: "medium", label: "中" }, { value: "large", label: "大" }]} />
          </Form.Item>
          <Form.Item name={["kpiStyle", "itemBackgroundColor"]} label="项背景色">
            <Input type="color" />
          </Form.Item>
          <Form.Item name={["kpiStyle", "itemBorderColor"]} label="项边框色">
            <Input type="color" />
          </Form.Item>
          <Form.Item name={["kpiStyle", "itemBorderWidth"]} label="项边框粗细">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name={["kpiStyle", "itemBorderRadius"]} label="项圆角">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name={["kpiStyle", "hoverElevated"]} label="Hover 浮起" valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      ),
    },
    {
      key: "kpiDivider",
      label: "分割线",
      children: renderConfigGrid(
        <>
          <Form.Item name={["kpiStyle", "showDivider"]} label="显示分割线" valuePropName="checked">
            <Switch />
          </Form.Item>
          {showDivider ? (
            <>
              <Form.Item name={["kpiStyle", "dividerStyle"]} label="分割方式">
                <Select options={[
                  { value: "solid", label: "实线" },
                  { value: "dashed", label: "虚线" },
                  { value: "dotted", label: "点线" },
                  { value: "double", label: "双线" },
                  { value: "soft-band", label: "柔和色带" },
                  { value: "glow-band", label: "发光色带" },
                  { value: "icon-center", label: "中间带图标" },
                  { value: "short-axis", label: "短中轴" },
                  { value: "corner-badge", label: "角标式分隔" },
                ]} />
              </Form.Item>
              <Form.Item name={["kpiStyle", "dividerWidth"]} label="分割粗细">
                <Input type="number" min={1} max={8} />
              </Form.Item>
              <Form.Item name={["kpiStyle", "dividerColor"]} label="分割线颜色">
                <Input type="color" />
              </Form.Item>
            </>
          ) : null}
        </>
      ),
    },
    {
      key: "kpiTrend",
      label: "趋势",
      children: renderConfigGrid(
        <>
          <Form.Item name={["kpiAnalysis", "showTrend"]} label="显示趋势" valuePropName="checked">
            <Switch />
          </Form.Item>
          {showTrend ? (
            <>
              <Form.Item name={["kpi", "compareLabel"]} label="对比文案">
                <Input placeholder="如：同比 / 较昨日 / 较上周" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "trendColorMode"]} label="趋势颜色模式">
                <Select options={[{ value: "auto", label: "自动正负色" }, { value: "fixed", label: "固定配置色" }]} />
              </Form.Item>
              <Form.Item name={["kpiStyle", "compareLabelColor"]} label="对比颜色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "compareLabelFontSize"]} label="对比字号">
                <Input type="number" />
              </Form.Item>
              <Form.Item name={["kpiStyle", "compareLabelFontWeight"]} label="对比字重">
                <Input type="number" />
              </Form.Item>
            </>
          ) : null}
        </>
      ),
    },
    ...(mode === "flipper" ? [{
      key: "kpiFlipper",
      label: "翻牌器专属",
      children: renderConfigGrid(
        <>
          <Form.Item name={["kpiStyle", "flipperBackgroundType"]} label="翻牌背景类型" style={{ gridColumn: "1 / -1" }}>
            <Select options={[{ value: "solid", label: "纯色" }, { value: "gradient", label: "渐变" }, { value: "image", label: "图片" }]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const flipperType = configForm.getFieldValue(["kpiStyle", "flipperBackgroundType"]) || "gradient";
              if (flipperType === "solid") {
                return (
                  <Form.Item name={["kpiStyle", "flipperBackgroundColor"]} label="翻牌纯色">
                    <Input type="color" />
                  </Form.Item>
                );
              }
              if (flipperType === "image") {
                return (
                  <>
                    <Form.Item name={["kpiStyle", "flipperBackgroundImage"]} label="翻牌背景图片" style={{ gridColumn: "1 / span 2" }}>
                      <Input />
                    </Form.Item>
                    <Form.Item label="上传翻牌背景图">
                      <Upload
                        showUploadList={false}
                        accept="image/*"
                        beforeUpload={async (file) => {
                          try {
                            const imageUrl = await readLocalImageAsDataUrl(file);
                            configForm.setFieldValue(["kpiStyle", "flipperBackgroundType"], "image");
                            configForm.setFieldValue(["kpiStyle", "flipperBackgroundImage"], imageUrl);
                            updateSelectedWidget({
                              kpiStyle: {
                                ...(selectedWidget.kpiStyle || buildDefaultKpiStyleConfig()),
                                flipperBackgroundType: "image",
                                flipperBackgroundImage: imageUrl,
                                flipperBackground: `url(${imageUrl}) center/cover no-repeat`,
                              },
                            });
                            message.success("翻牌背景图已载入");
                          } catch (error: any) {
                            message.error(error.message || "翻牌背景图读取失败");
                          }
                          return false;
                        }}
                      >
                        <Button>上传图片</Button>
                      </Upload>
                    </Form.Item>
                  </>
                );
              }
              return (
                <>
                  <Form.Item name={["kpiStyle", "flipperBackgroundColor"]} label="翻牌渐变起始色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["kpiStyle", "flipperBackgroundGradient"]} label="翻牌渐变结束色">
                    <Input type="color" />
                  </Form.Item>
                  <Card size="small" title="翻牌渐变方向" styles={{ body: { padding: 12 } }} style={{ gridColumn: "1 / -1" }}>
                    <Form.Item name={["kpiStyle", "flipperBackgroundDirection"]} noStyle>
                      <Input type="hidden" />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate>
                      {() => (
                        <Space wrap>
                          {[
                            { value: "to bottom", label: "自上而下", icon: "↓" },
                            { value: "to top", label: "自下而上", icon: "↑" },
                            { value: "to right", label: "自左向右", icon: "→" },
                            { value: "to left", label: "自右向左", icon: "←" },
                            { value: "to bottom right", label: "左上到右下", icon: "↘" },
                            { value: "to top right", label: "左下到右上", icon: "↗" },
                          ].map((item) => {
                            const active = configForm.getFieldValue(["kpiStyle", "flipperBackgroundDirection"]) === item.value;
                            return (
                              <button
                                key={`flipper_dir_${item.value}`}
                                type="button"
                                onClick={() => {
                                  configForm.setFieldValue(["kpiStyle", "flipperBackgroundDirection"], item.value);
                                  const nextKpiStyle = {
                                    ...(selectedWidget.kpiStyle || buildDefaultKpiStyleConfig()),
                                    ...(configForm.getFieldValue(["kpiStyle"]) || {}),
                                    flipperBackgroundDirection: item.value,
                                  } as WidgetKpiStyleConfig;
                                  nextKpiStyle.flipperBackground = buildFlipperBackgroundFromStyle(nextKpiStyle);
                                  updateSelectedWidget({ kpiStyle: nextKpiStyle });
                                }}
                                style={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: 12,
                                  border: active ? "2px solid #1677ff" : "1px solid #d6deea",
                                  background: "#fff",
                                  color: active ? "#1677ff" : "#344054",
                                  cursor: "pointer",
                                  fontSize: 22,
                                }}
                                title={item.label}
                              >
                                {item.icon}
                              </button>
                            );
                          })}
                        </Space>
                      )}
                    </Form.Item>
                  </Card>
                </>
              );
            }}
          </Form.Item>
          <Form.Item name={["kpiStyle", "flipperRefreshSeconds"]} label="翻牌刷新时间(秒)">
            <Input type="number" min={0.2} step={0.1} />
          </Form.Item>
          <Form.Item name={["kpiStyle", "flipperGap"]} label="字块间距">
            <Input type="number" min={2} />
          </Form.Item>
          <Form.Item name={["kpiStyle", "flipperDigitWidth"]} label="字块宽度">
            <Input type="number" min={32} />
          </Form.Item>
          <Form.Item name={["kpiStyle", "flipperDigitHeight"]} label="字块高度">
            <Input type="number" min={32} />
          </Form.Item>
          <Form.Item name={["kpiStyle", "flipperDigitRadius"]} label="字块圆角">
            <Input type="number" min={0} />
          </Form.Item>
        </>
      ),
    }] : []),
  ];
}

export function ReportingDashboardEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const dashboardId = params.id ? Number(params.id) : null;
  const isEditMode = Number.isFinite(dashboardId) && dashboardId !== null;

  const [basicForm] = Form.useForm();
  const [configForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [basicInfoOpen, setBasicInfoOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"data" | "style" | "analysis">("data");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [stylePickerMode, setStylePickerMode] = useState<"add" | "replace">("add");
  const [stylePickerFamily, setStylePickerFamily] = useState<PrimaryChartFamilyKey | null>(null);
  const [chartAssets, setChartAssets] = useState<ReportingChartAssetRecord[]>([]);
  const [themeTemplates, setThemeTemplates] = useState<ThemeTemplateRecord[]>([]);
  const [datasets, setDatasets] = useState<ReportingDatasetRecord[]>([]);
  const [dataSources, setDataSources] = useState<ReportingDataSourceRecord[]>([]);
  const [sourceTables, setSourceTables] = useState<Array<{ tableName: string }>>([]);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiTablePreviewOpen, setAiTablePreviewOpen] = useState(false);
  const [aiAssistantLoading, setAiAssistantLoading] = useState<"tables" | "tablePreview" | "analysis" | "plan" | "query" | "recommend" | "preview" | "insert" | "chartSwitch" | null>(null);
  const [aiAssistantState, setAiAssistantState] = useState<AiChartAssistantState>({
    sourceId: null,
    activeTab: "analysis",
    prompt: "",
    analysisDirection: "",
    analysisSuggestions: [],
    selectedAnalysisSuggestionKey: null,
    analysisSuggestionPage: 1,
    selectedTables: [],
    previewTableName: null,
    tablePreviewRows: [],
    tablePreviewColumns: [],
    sourceSql: "",
    plan: null,
    query: null,
    lastQueryError: null,
    recommendations: [],
    selectedRecommendationKey: null,
    preview: null,
    tables: [],
    editedFieldMap: {},
    revisionInstruction: "",
    autoPreview: true,
  });
  const [widgets, setWidgets] = useState<CanvasWidgetDraft[]>([]);
  const [selectedWidgetKey, setSelectedWidgetKey] = useState<string | null>(null);
  const [dashboardThemeTemplateId, setDashboardThemeTemplateId] = useState<number | null>(null);
  const [dashboardThemeSettings, setDashboardThemeSettings] = useState<DashboardThemeSettings>(buildDefaultDashboardThemeSettings());
  const [canvasConfig, setCanvasConfig] = useState<ThemeTemplateCanvas>(() => buildCanvasConfigFromForm({}));
  const [themeCategoryFilter, setThemeCategoryFilter] = useState<string>("all");

  useEffect(() => {
    const styleId = "reporting-flipper-keyframes";
    if (document.getElementById(styleId)) {
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes reporting-flipper-flip {
        0% { transform: rotateX(0deg); opacity: 1; }
        45% { transform: rotateX(90deg); opacity: 0.55; }
        55% { transform: rotateX(-90deg); opacity: 0.55; }
        100% { transform: rotateX(0deg); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }, []);
  const [canvasRatioPreset, setCanvasRatioPreset] = useState<string>("16:9");
  const [layoutMode, setLayoutMode] = useState<"free" | "grid">("free");
  const [widgetMinGap, setWidgetMinGap] = useState<number>(DEFAULT_WIDGET_GAP);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [expandedCanvasHeight, setExpandedCanvasHeight] = useState<number | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasLeftOffset, setCanvasLeftOffset] = useState(CANVAS_EDGE_LEFT);
  const [canvasTopOffset, setCanvasTopOffset] = useState(196);
  const [pendingDragPayload, setPendingDragPayload] = useState<LibraryDragPayload | null>(null);
  const [activeDragPayload, setActiveDragPayload] = useState<ActiveDragPayload | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [configPanelRight, setConfigPanelRight] = useState(0);
  const [configPanelTop, setConfigPanelTop] = useState<number | null>(null);
  const [panelDragState, setPanelDragState] = useState<PanelDragState | null>(null);
  const [highlightedTabKey, setHighlightedTabKey] = useState<string | null>(null);
  const dragImpactLayoutRef = useRef<CanvasWidgetDraft[] | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const autoPreviewTimerRef = useRef<number | null>(null);
  const widgetsRef = useRef<CanvasWidgetDraft[]>([]);
  const chartAssetsRef = useRef<ReportingChartAssetRecord[]>([]);
  const themeTemplatesRef = useRef<ThemeTemplateRecord[]>([]);
  const dashboardThemeTemplateIdRef = useRef<number | null>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const canvasScaleRef = useRef(1);
  const canvasLeftOffsetRef = useRef(CANVAS_EDGE_LEFT);
  const canvasTopOffsetRef = useRef(196);
  const libraryDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const highlightTabTimerRef = useRef<number | null>(null);

  const canvasBaseMetrics = useMemo(() => {
    const ratio = getCanvasRatioValue(canvasRatioPreset);
    const width = 1600;
    return {
      width,
      height: Math.max(900, Math.round(width / ratio)),
    };
  }, [canvasRatioPreset]);
  const canvasMetrics = useMemo(() => ({
    width: canvasBaseMetrics.width,
    height: Math.max(canvasBaseMetrics.height, expandedCanvasHeight || 0),
  }), [canvasBaseMetrics.height, canvasBaseMetrics.width, expandedCanvasHeight]);
  const isGridLayoutMode = layoutMode === "grid";

  const dragPreviewPosition = useMemo(() => {
    if (!dragState || dragState.mode !== "move") return null;
    const pointer = pointerPositionRef.current;
    if (!pointer) return null;
    const safeCanvasScale = canvasScaleRef.current > 0 ? canvasScaleRef.current : 1;
    const deltaX = (pointer.x - dragState.startX) / safeCanvasScale;
    const deltaY = (pointer.y - dragState.startY) / safeCanvasScale;
    const snap = getLayoutSnap(basicForm.getFieldValue("layoutMode"));
    return resolveFreeMovePosition({
      x: dragState.initialX + deltaX,
      y: dragState.initialY + deltaY,
      w: dragState.initialW,
      h: dragState.initialH,
    }, snap, canvasMetrics.width, canvasMetrics.height);
  }, [basicForm, canvasMetrics.height, canvasMetrics.width, dragState, pointerPosition]);

  const dragCollisionKeys = useMemo(() => {
    if (!dragState || dragState.mode !== "move" || !dragPreviewPosition) return new Set<string>();
    const movingWidget = widgets.find((item) => item.key === dragState.key);
    if (!movingWidget) return new Set<string>();
    const expandedMoving = {
      x: dragPreviewPosition.x - widgetMinGap,
      y: dragPreviewPosition.y - widgetMinGap,
      w: dragPreviewPosition.w + widgetMinGap * 2,
      h: dragPreviewPosition.h + widgetMinGap * 2,
    };
    return new Set(
      widgets
        .filter((item) => item.key !== dragState.key && !item.containerParentKey && item.widgetType !== "tabs")
        .filter((item) => {
          if (!isOverlapping(expandedMoving, item.position)) return false;
          const metrics = getOverlapMetrics(expandedMoving, item.position);
          const axisIntrusion = Math.max(metrics.widthRatio, metrics.heightRatio);
          return metrics.intrusionRatio >= COLLISION_INTRUSION_RATIO && axisIntrusion >= COLLISION_AXIS_INTRUSION_RATIO;
        })
        .map((item) => item.key)
    );
  }, [dragPreviewPosition, dragState, widgetMinGap, widgets]);

  const dragImpactLayout = useMemo(() => {
    if (!dragState || dragState.mode !== "move" || !dragPreviewPosition) return null;
    const snap = getLayoutSnap(basicForm.getFieldValue("layoutMode"));
    return applyWidgetCollisionLayout(
      dragState.key,
      dragPreviewPosition,
      widgets,
      widgetMinGap,
      snap,
      canvasMetrics.width,
      canvasMetrics.height
    );
  }, [basicForm, canvasMetrics.height, canvasMetrics.width, dragPreviewPosition, dragState, widgetMinGap, widgets]);

  useEffect(() => {
    dragImpactLayoutRef.current = dragImpactLayout;
  }, [dragImpactLayout]);

  const renderedWidgets = dragImpactLayout || widgets;

  function getCurrentDashboardThemeTemplateId() {
    return readNumericId(basicForm.getFieldValue("themeTemplateId")) ?? dashboardThemeTemplateIdRef.current;
  }

  const selectedWidget = useMemo(
    () => widgets.find((item) => item.key === selectedWidgetKey) || null,
    [selectedWidgetKey, widgets]
  );

  const selectedWidgetAsset = useMemo(
    () => chartAssets.find((item) => item.id === selectedWidget?.chartAssetId) || null,
    [chartAssets, selectedWidget?.chartAssetId]
  );

  const libraryFamilies = useMemo(
    () => PRIMARY_CHART_FAMILIES
      .map((item) => ({
        ...item,
        assets: chartAssets.filter((asset) => asset.status !== "inactive" && getPrimaryChartFamily(asset) === item.key),
      }))
      .filter((item) => item.assets.length > 0),
    [chartAssets]
  );

  const selectedAiRecommendation = useMemo(() => {
    if (!aiAssistantState.selectedRecommendationKey) return null;
    return aiAssistantState.recommendations.find((item, index) =>
      `${item.widgetType}:${item.chartFamily}:${item.chartAssetId || ""}:${index}` === aiAssistantState.selectedRecommendationKey
    ) || null;
  }, [aiAssistantState.recommendations, aiAssistantState.selectedRecommendationKey]);

  const selectedAiAsset = useMemo(() => {
    if (!selectedAiRecommendation || selectedAiRecommendation.widgetType !== "chart") return null;
    return resolveAiRecommendationAsset(selectedAiRecommendation);
  }, [chartAssets, selectedAiRecommendation]);

  const selectedAiPreviewBundle = useMemo(() => {
    if (!selectedAiRecommendation || !aiAssistantState.query) return null;
    return buildAiPreviewPayload(selectedAiRecommendation, aiAssistantState.query, {
      fieldMap: aiAssistantState.editedFieldMap,
    });
  }, [
    aiAssistantState.editedFieldMap,
    aiAssistantState.query,
    selectedAiRecommendation,
  ]);

  const selectedAiMappingFields = useMemo(() => {
    if (!selectedAiRecommendation) return [];
    if (selectedAiRecommendation.widgetType === "kpi") {
      return [
        { key: "valueField", label: "主值字段", required: true },
        { key: "compareField", label: "对比值字段", required: false },
        { key: "labelField", label: "名称字段", required: false },
      ];
    }
    if (selectedAiRecommendation.widgetType === "table") return [];
    const assetFields = getAssetMappingFields(selectedAiAsset);
    if (selectedAiRecommendation.widgetType === "chart" && getPrimaryChartFamily(selectedAiAsset) === "horizontalBar") {
      const categoryField = assetFields.find((item) => item.key === "yField");
      const valueField = assetFields.find((item) => item.key === "xField");
      const remainingFields = assetFields.filter((item) => item.key !== "yField" && item.key !== "xField");
      return [categoryField, valueField, ...remainingFields].filter(Boolean) as typeof assetFields;
    }
    return assetFields;
  }, [selectedAiAsset, selectedAiRecommendation]);

  const selectedAiFieldOptions = useMemo(
    () => (aiAssistantState.query?.fields || []).map((field) => ({
      value: field.columnName,
      label: `${field.label || field.columnName}${field.role ? ` / ${field.role}` : ""}${field.dataType ? ` / ${field.dataType}` : ""}`,
    })),
    [aiAssistantState.query?.fields]
  );

  const selectedAiEffectiveFieldMap = useMemo(
    () => ({
      ...(selectedAiRecommendation?.fieldMap || {}),
      ...(aiAssistantState.editedFieldMap || {}),
    }),
    [aiAssistantState.editedFieldMap, selectedAiRecommendation]
  );

  const selectedAiFieldMapValidation = useMemo(() => {
    const available = new Set((aiAssistantState.query?.fields || []).map((field) => field.columnName));
    const missing = selectedAiMappingFields
      .filter((field) => field.required !== false && !selectedAiEffectiveFieldMap[field.key])
      .map((field) => field.label || field.key);
    const unknown = Object.entries(selectedAiEffectiveFieldMap)
      .filter(([, value]) => value && !available.has(value))
      .map(([key, value]) => `${key}=${value}`);
    const messages = [
      ...missing.map((item) => `缺少必填映射：${item}`),
      ...unknown.map((item) => `字段不存在：${item}`),
    ];
    return {
      valid: messages.length === 0,
      messages,
    };
  }, [aiAssistantState.query?.fields, selectedAiEffectiveFieldMap, selectedAiMappingFields]);

  const selectedAnalysisSuggestion = useMemo(() => {
    if (!aiAssistantState.selectedAnalysisSuggestionKey) return null;
    return aiAssistantState.analysisSuggestions.find((item, index) =>
      `${item.id || item.title}:${index}` === aiAssistantState.selectedAnalysisSuggestionKey
    ) || null;
  }, [aiAssistantState.analysisSuggestions, aiAssistantState.selectedAnalysisSuggestionKey]);

  const pagedAnalysisSuggestions = useMemo(() => {
    const page = Math.max(1, aiAssistantState.analysisSuggestionPage || 1);
    const start = (page - 1) * AI_ANALYSIS_SUGGESTION_PAGE_SIZE;
    return aiAssistantState.analysisSuggestions.slice(start, start + AI_ANALYSIS_SUGGESTION_PAGE_SIZE);
  }, [aiAssistantState.analysisSuggestionPage, aiAssistantState.analysisSuggestions]);

  function applyDashboardThemeTemplateChange(nextTemplateId: number | null, options?: { syncFormField?: boolean }) {
    const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
    setDashboardThemeTemplateId(nextTemplateId);
    dashboardThemeTemplateIdRef.current = nextTemplateId;
    if (options?.syncFormField) {
      basicForm.setFieldValue("themeTemplateId", nextTemplateId);
    }
    const nextResolved = resolveThemeTemplate(activeThemeTemplates, nextTemplateId, null, "chart", null);
    const nextWidgets = widgetsRef.current.map((item) => {
      if (item.inheritDashboardTheme === false) return item;
      return materializeWidgetFromTemplate(
        {
          ...item,
          widgetThemeTemplateId: null,
          widgetThemeOverrides: {},
        },
        activeThemeTemplates,
        nextTemplateId
      );
    });
    widgetsRef.current = nextWidgets;
    setWidgets(nextWidgets);
    const nextSelectedWidget = nextWidgets.find((item) => item.key === selectedWidgetKey) || null;
    if (nextSelectedWidget) {
      syncConfigForm(nextSelectedWidget);
    }
    if (dashboardThemeSettings.inheritCanvasBackground !== false) {
      const nextCanvasValues = extractCanvasBackgroundFormValues(nextResolved.canvas, {
        titleColor: String(nextResolved.canvas.dashboardTitleColor || nextResolved.chrome.titleColor || DEFAULT_DASHBOARD_TITLE_COLOR),
      });
      basicForm.setFieldsValue(nextCanvasValues);
      setCanvasConfig(buildCanvasConfigFromForm(nextCanvasValues));
    }
  }

  const stylePickerAssets = useMemo(
    () => chartAssets.filter((asset) => asset.status !== "inactive" && getPrimaryChartFamily(asset) === stylePickerFamily),
    [chartAssets, stylePickerFamily]
  );

  const pieVariantLibrary = useMemo(
    () => PIE_VARIANT_LIBRARY.map((item) => ({
      ...item,
      current: selectedWidget?.chartStyle?.pieVariant === item.key,
    })),
    [selectedWidget?.chartStyle?.pieVariant]
  );

  const datasetOptions = useMemo(
    () => datasets.filter((item) => item.status !== "inactive").map((item) => ({
      label: item.datasetName,
      value: item.id,
    })),
    [datasets]
  );

  const dataSourceOptions = useMemo(
    () => dataSources.filter((item) => item.status === "active").map((item) => ({
      label: `${item.sourceName} (${item.sourceType})`,
      value: item.id,
    })),
    [dataSources]
  );

  const aiChartFamilyOptions = useMemo(
    () => [
      { label: "指标看板", value: "kpi" },
      ...libraryFamilies.map((family) => ({ label: family.label, value: family.key })),
    ],
    [libraryFamilies]
  );

  useEffect(() => {
    function syncCanvasViewport() {
      const viewport = canvasViewportRef.current;
      if (!viewport) return;
      const availableWidth = Math.max(320, viewport.clientWidth - 32);
      const rect = viewport.getBoundingClientRect();
      const availableHeight = Math.max(520, window.innerHeight - rect.top - 24);
      const widthScale = availableWidth / canvasBaseMetrics.width;
      const heightScale = availableHeight / canvasBaseMetrics.height;
      const nextScale = Math.min(1, widthScale, heightScale);
      setCanvasScale(nextScale);
      const nextExpandedHeight = Math.max(canvasBaseMetrics.height, Math.ceil(availableHeight / Math.max(nextScale, 0.01)));
      setExpandedCanvasHeight(nextExpandedHeight);
      const scaledCanvasWidth = canvasBaseMetrics.width * nextScale;
      const centeredLeft = rect.left + Math.max(0, (viewport.clientWidth - scaledCanvasWidth) / 2);
      setCanvasLeftOffset(Math.round(centeredLeft));
      setCanvasTopOffset(Math.round(rect.top + 8));
    }
    syncCanvasViewport();
    window.addEventListener("resize", syncCanvasViewport);
    return () => window.removeEventListener("resize", syncCanvasViewport);
  }, [canvasBaseMetrics.height, canvasBaseMetrics.width, libraryOpen]);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    chartAssetsRef.current = chartAssets;
  }, [chartAssets]);

  useEffect(() => {
    themeTemplatesRef.current = themeTemplates;
  }, [themeTemplates]);

  useEffect(() => {
    dashboardThemeTemplateIdRef.current = dashboardThemeTemplateId;
  }, [dashboardThemeTemplateId]);

  useEffect(() => {
    pointerPositionRef.current = pointerPosition;
  }, [pointerPosition]);

  useEffect(() => {
    return () => {
      if (highlightTabTimerRef.current) {
        window.clearTimeout(highlightTabTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    canvasScaleRef.current = canvasScale;
  }, [canvasScale]);

  useEffect(() => {
    canvasLeftOffsetRef.current = canvasLeftOffset;
  }, [canvasLeftOffset]);

  useEffect(() => {
    canvasTopOffsetRef.current = canvasTopOffset;
  }, [canvasTopOffset]);

  function clearPendingDrag() {
    setPendingDragPayload(null);
  }

  async function loadBaseData() {
    if (!token) return;
    setLoading(true);
    try {
      const [chartRes, datasetRes, sourceRes, themeRes] = await Promise.all([
        fetchReportingChartAssets(token),
        fetchReportingDatasets(token),
        fetchReportingDataSources(token),
        fetchReportingThemeTemplates(token),
      ]);
    setChartAssets(chartRes.data || []);
    setDatasets(datasetRes.data || []);
    setDataSources(sourceRes.data || []);
    setThemeTemplates((themeRes.data || []) as ReportingThemeTemplateRecord[]);
    chartAssetsRef.current = chartRes.data || [];
    themeTemplatesRef.current = (themeRes.data || []) as ReportingThemeTemplateRecord[];

    if (dashboardId) {
        const response = await fetchReportingDashboard(token, dashboardId);
        const record = response.data;
        const nextThemeSettings = buildDefaultDashboardThemeSettings(record.themeSettings as Partial<DashboardThemeSettings> | undefined);
        const nextThemeTemplateId = record.themeTemplateId ? Number(record.themeTemplateId) : null;
        const resolvedDashboardTheme = resolveThemeTemplate(
          (themeRes.data || []) as ReportingThemeTemplateRecord[],
          nextThemeTemplateId,
          null,
          "chart",
          null
        );
        basicForm.setFieldsValue({
          dashboardName: record.dashboardName,
          layoutMode: record.layoutMode,
          canvasRatioPreset: String(record.canvasConfig?.ratioPreset || "16:9"),
          widgetMinGap: Number(record.canvasConfig?.widgetMinGap || DEFAULT_WIDGET_GAP),
          themeTemplateId: nextThemeTemplateId,
          ...extractCanvasBackgroundFormValues(record.canvasConfig as ThemeTemplateCanvas | undefined, {
            titleColor: String(resolvedDashboardTheme.canvas.dashboardTitleColor || resolvedDashboardTheme.chrome.titleColor || DEFAULT_DASHBOARD_TITLE_COLOR),
          }),
          ownerName: record.ownerName,
          status: record.status,
          description: record.description || "",
        });
        setDashboardThemeTemplateId(nextThemeTemplateId);
        dashboardThemeTemplateIdRef.current = nextThemeTemplateId;
        setDashboardThemeSettings(nextThemeSettings);
        setLayoutMode(record.layoutMode === "grid" ? "grid" : "free");
        setCanvasConfig(
          record.canvasConfig?.backgroundType || record.canvasConfig?.backgroundColor || record.canvasConfig?.backgroundGradient || record.canvasConfig?.backgroundImage
            ? buildCanvasConfigFromForm(extractCanvasBackgroundFormValues(record.canvasConfig as ThemeTemplateCanvas | undefined))
            : (nextThemeSettings.inheritCanvasBackground
              ? {
                backgroundType: (resolvedDashboardTheme.canvas.backgroundType || (resolvedDashboardTheme.canvas.backgroundImage ? "image" : resolvedDashboardTheme.canvas.backgroundGradient ? "gradient" : "solid")) as CanvasBackgroundFormType,
                backgroundColor: resolvedDashboardTheme.canvas.backgroundColor || null,
                backgroundGradient: resolvedDashboardTheme.canvas.backgroundGradient || null,
                backgroundImage: resolvedDashboardTheme.canvas.backgroundImage || null,
              }
              : buildCanvasConfigFromForm({}))
        );
        setCanvasRatioPreset(String(record.canvasConfig?.ratioPreset || "16:9"));
        setWidgetMinGap(Number(record.canvasConfig?.widgetMinGap || DEFAULT_WIDGET_GAP));
        const loadedWidgets: CanvasWidgetDraft[] = (record.widgets || []).map((item, index) => {
          const asset = chartRes.data?.find((entry) => entry.id === (item.chartAssetId ? Number(item.chartAssetId) : null)) || null;
          const itemChartStyleSource = typeof item.props?.chartStyle === "object" && item.props?.chartStyle
            ? item.props.chartStyle as Record<string, unknown>
            : {};
          const baseChartStyle = normalizeChartStyleConfig(
            item.props?.chartStyle,
            item.props?.chrome,
            item.props?.accentColor ? String(item.props.accentColor) : null,
            item.props?.palettePreset ? String(item.props.palettePreset) : null
          );
          const resolvedChartStyle = baseChartStyle;
          const resolvedChrome = normalizeChromeConfig(item.props?.chrome, item.widgetName);
          const widget: CanvasWidgetDraft = {
            key: item.widgetKey,
            widgetName: item.widgetName,
            widgetType: (item.widgetType as WidgetType) || "chart",
            inheritDashboardTheme: item.props?.inheritDashboardTheme !== false,
            widgetThemeTemplateId: item.props?.widgetThemeTemplateId ? Number(item.props.widgetThemeTemplateId) : null,
            widgetThemeOverrides: {},
            chartAssetId: item.chartAssetId ? Number(item.chartAssetId) : null,
            chartFamily: getNormalizedChartFamilyValue(asset) || (item.props?.chartFamily ? String(item.props.chartFamily) : null),
            variantName: item.props?.variantName ? String(item.props.variantName) : null,
            accentColor: resolvedChartStyle.accentColor || (item.props?.accentColor ? String(item.props.accentColor) : null),
            palettePreset: item.props?.palettePreset ? String(item.props.palettePreset) : null,
            chrome: resolvedChrome,
            chartStyle: resolvedChartStyle,
            mapStyle: normalizeMapStyleConfig(item.props?.mapStyle, item.props?.chrome),
            chartAnalysis: normalizeChartAnalysisConfig(item.props?.chartAnalysis, item.props?.chrome),
            kpi: typeof item.props?.kpi === "object" && item.props?.kpi ? item.props.kpi as WidgetKpiConfig : buildDefaultKpiConfig(),
            kpiStyle: stripLegacyKpiThemeDefaults(normalizeKpiStyleConfig(item.props?.kpiStyle, item.props?.chrome, item.props?.kpi)),
            kpiAnalysis: normalizeKpiAnalysisConfig(item.props?.kpiAnalysis, item.props?.kpi),
            table: typeof item.props?.table === "object" && item.props?.table ? item.props.table as WidgetTableConfig : buildDefaultTableConfig(),
            tableStyle: normalizeTableStyleConfig(item.props?.tableStyle, item.props?.table),
            tabs: typeof item.props?.tabs === "object" && item.props?.tabs ? item.props.tabs as WidgetTabsConfig : buildDefaultTabsConfig(),
            tabsStyle: normalizeTabsStyleConfig(item.props?.tabsStyle),
            richText: typeof item.props?.richText === "object" && item.props?.richText ? item.props.richText as WidgetRichTextConfig : buildDefaultRichTextConfig(),
            richTextStyle: normalizeRichTextStyleConfig(item.props?.richTextStyle, item.props?.richText),
            image: typeof item.props?.image === "object" && item.props?.image ? item.props.image as WidgetImageConfig : buildDefaultImageConfig(),
            imageStyle: normalizeImageStyleConfig(item.props?.imageStyle, item.props?.image),
            bindingMode: item.datasetId ? "dataset" : "sql",
            datasetId: item.datasetId ? Number(item.datasetId) : null,
            sourceId: item.props?.sourceId ? Number(item.props.sourceId) : null,
            sourceTable: item.props?.sourceTable ? String(item.props.sourceTable) : null,
            sourceSql: item.props?.sourceSql ? String(item.props.sourceSql) : null,
            fieldMap: typeof item.props?.fieldMap === "object" && item.props?.fieldMap ? item.props.fieldMap as Record<string, string> : {},
            fields: [],
            preview: null,
            containerParentKey: item.props?.containerParentKey ? String(item.props.containerParentKey) : null,
            containerTabKey: item.props?.containerTabKey ? String(item.props.containerTabKey) : null,
            position: {
              x: Number(item.position?.x ?? buildDefaultWidgetPosition(index).x),
              y: Number(item.position?.y ?? buildDefaultWidgetPosition(index).y),
              w: Number(item.position?.w ?? buildDefaultWidgetPosition(index).w),
              h: Number(item.position?.h ?? buildDefaultWidgetPosition(index).h),
            },
          };
          return backfillMissingWordCloudThemeFields(
            (themeRes.data || []) as ReportingThemeTemplateRecord[],
            nextThemeTemplateId,
            backfillMissingScatterThemeFields(
              (themeRes.data || []) as ReportingThemeTemplateRecord[],
              nextThemeTemplateId,
              backfillMissingGaugeThemeFields(
                (themeRes.data || []) as ReportingThemeTemplateRecord[],
                nextThemeTemplateId,
                backfillMissingFunnelThemeFields(
                  (themeRes.data || []) as ReportingThemeTemplateRecord[],
                  nextThemeTemplateId,
                  backfillMissingComboThemeFields(
                    (themeRes.data || []) as ReportingThemeTemplateRecord[],
                    nextThemeTemplateId,
                    backfillMissingMapThemeFields(
                      (themeRes.data || []) as ReportingThemeTemplateRecord[],
                      nextThemeTemplateId,
                      widget,
                      itemChartStyleSource
                    ),
                    itemChartStyleSource
                  ),
                  itemChartStyleSource
                ),
                itemChartStyleSource
              ),
              itemChartStyleSource
            ),
            itemChartStyleSource
          );
        });
        setWidgets(loadedWidgets);
      } else {
        const firstTheme = (themeRes.data?.[0] || null) as ReportingThemeTemplateRecord | null;
        const nextThemeTemplateId = firstTheme?.id ? Number(firstTheme.id) : null;
        const nextTheme = resolveThemeTemplate((themeRes.data || []) as ReportingThemeTemplateRecord[], firstTheme?.id || null, null, "chart", null);
        basicForm.setFieldsValue({
          dashboardName: "",
          layoutMode: "free",
          canvasRatioPreset: "16:9",
          widgetMinGap: DEFAULT_WIDGET_GAP,
          themeTemplateId: nextThemeTemplateId,
          ...extractCanvasBackgroundFormValues(nextTheme.canvas, {
            titleColor: String(nextTheme.canvas.dashboardTitleColor || nextTheme.chrome.titleColor || DEFAULT_DASHBOARD_TITLE_COLOR),
          }),
          ownerName: "报表分析师",
          status: "draft",
          description: "",
        });
        setDashboardThemeTemplateId(nextThemeTemplateId);
        dashboardThemeTemplateIdRef.current = nextThemeTemplateId;
        setDashboardThemeSettings(buildDefaultDashboardThemeSettings());
        setLayoutMode("free");
        setWidgets([]);
        setCanvasConfig({
          backgroundType: (nextTheme.canvas.backgroundType || (nextTheme.canvas.backgroundImage ? "image" : nextTheme.canvas.backgroundGradient ? "gradient" : "solid")) as CanvasBackgroundFormType,
          backgroundColor: nextTheme.canvas.backgroundColor || null,
          backgroundGradient: nextTheme.canvas.backgroundGradient || null,
          backgroundImage: nextTheme.canvas.backgroundImage || null,
        });
        setCanvasRatioPreset("16:9");
        setWidgetMinGap(DEFAULT_WIDGET_GAP);
        setBasicInfoOpen(true);
      }
    } catch (error: any) {
      message.error(`加载仪表盘编辑页失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, [dashboardId, token]);

  useEffect(() => {
    if (!token || !chartAssets.length || !widgets.length) return;
    const pendingWidgets = widgets.filter((widget) => {
      if (!isPreviewBackedWidget(widget.widgetType)) return false;
      if (widget.preview) return false;
      if (widget.bindingMode === "dataset") {
        return Boolean(widget.datasetId);
      }
      return Boolean(widget.sourceId && (widget.sourceTable || widget.sourceSql));
    });
    if (!pendingWidgets.length) return;
    pendingWidgets.forEach((widget) => {
      void handlePreviewWidget(widget, true);
    });
  }, [chartAssets, token, widgets]);

  useEffect(() => {
    async function loadTables() {
      if (!token || !selectedWidget?.sourceId || selectedWidget.bindingMode !== "sql") return;
      try {
        const response = await fetchReportingDataSourceTables(token, selectedWidget.sourceId);
        setSourceTables(response.data || []);
      } catch {
        setSourceTables([]);
      }
    }
    void loadTables();
  }, [selectedWidget?.bindingMode, selectedWidget?.sourceId, token]);

  useEffect(() => {
    async function loadAiAssistantTables() {
      if (!token || !aiAssistantOpen || !aiAssistantState.sourceId) {
        return;
      }
      setAiAssistantLoading((current) => current || "tables");
      try {
        const response = await fetchReportingDataSourceTables(token, aiAssistantState.sourceId);
        setAiAssistantState((current) => ({
          ...current,
          tables: response.data || [],
          previewTableName: current.previewTableName || null,
        }));
      } catch {
        setAiAssistantState((current) => ({
          ...current,
          tables: [],
          previewTableName: current.previewTableName || null,
        }));
      } finally {
        setAiAssistantLoading((current) => current === "tables" ? null : current);
      }
    }
    void loadAiAssistantTables();
  }, [aiAssistantOpen, aiAssistantState.sourceId, token]);

  useEffect(() => {
    async function loadAiAssistantTablePreview() {
      if (!token || !aiAssistantOpen || !aiAssistantState.sourceId || !aiAssistantState.previewTableName) {
        return;
      }
      setAiAssistantLoading((current) => current || "tablePreview");
      try {
        const response = await fetchReportingDataSourceSampleRows(
          token,
          Number(aiAssistantState.sourceId),
          aiAssistantState.previewTableName,
          100
        );
        const rows = response.data || [];
        const columnKeys = Array.from(rows.reduce((set, row) => {
          Object.keys(row || {}).forEach((key) => set.add(key));
          return set;
        }, new Set<string>()));
        setAiAssistantState((current) => ({
          ...current,
          tablePreviewRows: rows,
          tablePreviewColumns: columnKeys.map((key) => ({
            key,
            title: key,
            dataIndex: key,
          })),
        }));
      } catch {
        setAiAssistantState((current) => ({
          ...current,
          tablePreviewRows: [],
          tablePreviewColumns: [],
        }));
      } finally {
        setAiAssistantLoading((current) => current === "tablePreview" ? null : current);
      }
    }
    void loadAiAssistantTablePreview();
  }, [aiAssistantOpen, aiAssistantState.previewTableName, aiAssistantState.sourceId, token]);

  useEffect(() => {
    if (!dragState) return undefined;
    const activeDrag = dragState;
    const safeCanvasScale = canvasScale > 0 ? canvasScale : 1;
    function handleMove(event: MouseEvent) {
      setPointerPosition({ x: event.clientX, y: event.clientY });
      const deltaX = (event.clientX - activeDrag.startX) / safeCanvasScale;
      const deltaY = (event.clientY - activeDrag.startY) / safeCanvasScale;
      setWidgets((current) => {
        if (activeDrag.mode === "move") {
          return current.map((item) => item.key === activeDrag.key ? {
            ...item,
            position: resolveFreeMovePosition({
              x: activeDrag.initialX + deltaX,
              y: activeDrag.initialY + deltaY,
              w: item.position.w,
              h: item.position.h,
            }, getLayoutSnap(basicForm.getFieldValue("layoutMode")), canvasMetrics.width, canvasMetrics.height),
          } : item);
        }
        return current.map((item) => {
          if (item.key !== activeDrag.key) return item;
          let nextDraftPosition = { ...item.position };
          if (activeDrag.mode === "resize-right") {
            nextDraftPosition = {
              ...nextDraftPosition,
              w: activeDrag.initialW + deltaX,
            };
          } else if (activeDrag.mode === "resize-bottom") {
            nextDraftPosition = {
              ...nextDraftPosition,
              h: activeDrag.initialH + deltaY,
            };
          } else if (activeDrag.mode === "resize-corner-se") {
            nextDraftPosition = {
              ...nextDraftPosition,
              w: activeDrag.initialW + deltaX,
              h: activeDrag.initialH + deltaY,
            };
          } else if (activeDrag.mode === "resize-corner-sw") {
            nextDraftPosition = {
              ...nextDraftPosition,
              x: activeDrag.initialX + deltaX,
              w: activeDrag.initialW - deltaX,
              h: activeDrag.initialH + deltaY,
            };
          } else if (activeDrag.mode === "resize-corner-ne") {
            nextDraftPosition = {
              ...nextDraftPosition,
              y: activeDrag.initialY + deltaY,
              w: activeDrag.initialW + deltaX,
              h: activeDrag.initialH - deltaY,
            };
          } else if (activeDrag.mode === "resize-corner-nw") {
            nextDraftPosition = {
              ...nextDraftPosition,
              x: activeDrag.initialX + deltaX,
              y: activeDrag.initialY + deltaY,
              w: activeDrag.initialW - deltaX,
              h: activeDrag.initialH - deltaY,
            };
          }
          const nextPosition = resolveWidgetPlacement(
            item.key,
            nextDraftPosition,
            current,
            widgetMinGap,
            getLayoutSnap(basicForm.getFieldValue("layoutMode")),
            canvasMetrics.width,
            canvasMetrics.height
          );
          return {
            ...item,
            position: nextPosition,
          };
        });
      });
    }
    function handleUp() {
      const latestPointerPosition = pointerPositionRef.current;
      const latestWidgets = widgetsRef.current;
      const latestCanvasScale = canvasScaleRef.current > 0 ? canvasScaleRef.current : 1;
      const latestCanvasLeftOffset = canvasLeftOffsetRef.current;
      const latestCanvasTopOffset = canvasTopOffsetRef.current;
      const latestSnap = getLayoutSnap(basicForm.getFieldValue("layoutMode"));
      if (activeDrag.mode === "move" && latestPointerPosition) {
        const tabsTarget = latestWidgets.find((item) => {
          if (item.widgetType !== "tabs" || item.key === activeDrag.key) return false;
          const left = latestCanvasLeftOffset + (item.position.x + 24) * latestCanvasScale;
          const right = latestCanvasLeftOffset + (item.position.x + item.position.w - 24) * latestCanvasScale;
          const top = latestCanvasTopOffset + (item.position.y + 48) * latestCanvasScale;
          const bottom = latestCanvasTopOffset + (item.position.y + item.position.h - 24) * latestCanvasScale;
          const withinX = latestPointerPosition.x >= left && latestPointerPosition.x <= right;
          const withinY = latestPointerPosition.y >= top && latestPointerPosition.y <= bottom;
          return withinX && withinY;
        });
        if (tabsTarget) {
          const draggedWidget = latestWidgets.find((item) => item.key === activeDrag.key);
          if (draggedWidget && ["chart", "kpi", "table"].includes(draggedWidget.widgetType)) {
            const nextTabs = tabsTarget.tabs || buildDefaultTabsConfig();
            const nextItems = [
              ...nextTabs.items,
              {
                key: `tab_${Date.now()}`,
                title: draggedWidget.widgetName,
                childWidgetKey: draggedWidget.key,
              },
            ];
            setWidgets((current) => current.map((item) => {
              if (item.key === tabsTarget.key) {
                return {
                  ...item,
                  tabs: {
                    ...nextTabs,
                    items: nextItems,
                    defaultActiveKey: nextItems[nextItems.length - 1]?.key || nextTabs.defaultActiveKey,
                  },
                  preview: item.preview?.tabs ? {
                    ...(item.preview || {}),
                    tabs: {
                      ...(item.preview.tabs || {}),
                      defaultActiveKey: nextItems[nextItems.length - 1]?.key || nextTabs.defaultActiveKey,
                    },
                  } : null,
                };
              }
              if (item.key === draggedWidget.key) {
                return {
                  ...item,
                  containerParentKey: tabsTarget.key,
                  containerTabKey: nextItems[nextItems.length - 1]?.key || null,
                  preview: item.preview,
                };
              }
              return item;
            }));
            const nextActiveTabKey = nextItems[nextItems.length - 1]?.key || null;
            setHighlightedTabKey(nextActiveTabKey);
            if (highlightTabTimerRef.current) {
              window.clearTimeout(highlightTabTimerRef.current);
            }
            highlightTabTimerRef.current = window.setTimeout(() => {
              setHighlightedTabKey(null);
            }, 1800);
            setSelectedWidgetKey(draggedWidget.key);
            setConfigOpen(true);
          }
        }
        if (!tabsTarget) {
          setWidgets((current) => {
            const previewLayout = dragImpactLayoutRef.current;
            const baseLayout = previewLayout || current;
            const moving = baseLayout.find((item) => item.key === activeDrag.key);
            if (!moving) return current;
            const settledPosition = resolveWidgetSpacing(
              activeDrag.key,
              moving.position,
              baseLayout,
              widgetMinGap,
              latestSnap,
              canvasMetrics.width,
              canvasMetrics.height
            );
            return baseLayout.map((item) => item.key === activeDrag.key ? {
              ...item,
              position: settledPosition,
            } : item);
          });
        }
      }
      setDragState(null);
      setActiveDragPayload(null);
      setPointerPosition(null);
      clearPendingDrag();
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [basicForm, dragState, widgetMinGap]);

  useEffect(() => {
    if (!panelDragState) return undefined;
    const activePanelDrag = panelDragState;
    function handleMove(event: MouseEvent) {
      const deltaX = event.clientX - activePanelDrag.startX;
      const deltaY = event.clientY - activePanelDrag.startY;
      setConfigPanelRight(Math.max(0, activePanelDrag.initialRight - deltaX));
      setConfigPanelTop(Math.max(12, activePanelDrag.initialTop + deltaY));
    }
    function handleUp() {
      setPanelDragState(null);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [panelDragState]);

  useEffect(() => {
    if (!selectedWidget) return;
    if (selectedWidget.bindingMode === "dataset" && selectedWidget.datasetId) {
      const dataset = datasets.find((item) => item.id === selectedWidget.datasetId);
      if (dataset?.fields?.length) {
        updateSelectedWidget({ fields: dataset.fields as Array<{ columnName: string; label?: string; dataType?: string }> });
      }
    }
  }, [datasets, selectedWidget?.bindingMode, selectedWidget?.datasetId]);

  useEffect(() => {
    return () => {
      if (autoPreviewTimerRef.current) {
        window.clearTimeout(autoPreviewTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedWidgetKey) {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        const isEditing = tagName === "input" || tagName === "textarea" || target?.isContentEditable;
        if (isEditing) return;
        event.preventDefault();
        removeWidget(selectedWidgetKey);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWidgetKey]);

  useEffect(() => {
    if (!activeDragPayload || activeDragPayload.kind !== "library") return undefined;
    const libraryPayload = activeDragPayload.payload;
    function handleMove(event: MouseEvent) {
      setPointerPosition({ x: event.clientX, y: event.clientY });
    }
    function handleUp(event: MouseEvent) {
      const dragStart = libraryDragStartRef.current;
      const movedEnough = dragStart
        ? Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) >= 10
        : false;
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const withinCanvas = event.clientX >= rect.left
          && event.clientX <= rect.right
          && event.clientY >= rect.top
          && event.clientY <= rect.bottom;
        if (withinCanvas && movedEnough) {
          const scale = Math.max(canvasScale, 0.01);
          const nextPosition = {
            ...buildDefaultWidgetPosition(widgets.length),
            x: Math.max(0, Math.round((event.clientX - rect.left) / scale - 260)),
            y: Math.max(0, Math.round((event.clientY - rect.top) / scale - 140)),
          };
          if (libraryPayload) {
            createWidgetFromLibraryPayload(libraryPayload, nextPosition);
          }
        }
      }
      setActiveDragPayload(null);
      setPointerPosition(null);
      libraryDragStartRef.current = null;
      clearPendingDrag();
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    activeDragPayload,
    aiAssistantState.preview,
    aiAssistantState.prompt,
    aiAssistantState.query,
    canvasScale,
    selectedAiEffectiveFieldMap,
    selectedAiFieldMapValidation.valid,
    selectedAiRecommendation,
    token,
    widgets.length,
  ]);

  function syncConfigForm(widget: CanvasWidgetDraft) {
    const displayChartStyle = {
      ...(widget.chartStyle || buildDefaultChartStyleConfig()),
    };
    const displayKpiStyleBase = {
      ...(widget.kpiStyle || buildDefaultKpiStyleConfig()),
    } as WidgetKpiStyleConfig;
    const displayKpiStyle = {
      ...displayKpiStyleBase,
      ...extractFlipperStyleFormValues(displayKpiStyleBase),
    };
    const displayChrome = extractChromeFormValues(widget.chrome || buildDefaultChrome(widget.widgetName));
    configForm.setFieldsValue({
      widgetName: widget.widgetName,
      widgetType: widget.widgetType,
      inheritDashboardTheme: widget.inheritDashboardTheme !== false,
      widgetThemeTemplateId: widget.widgetThemeTemplateId || null,
      variantName: widget.variantName,
      accentColor: widget.accentColor,
      palettePreset: widget.palettePreset,
      chrome: displayChrome,
      chartStyle: displayChartStyle,
      mapStyle: {
        ...(widget.mapStyle || buildDefaultMapStyleConfig()),
      },
      chartAnalysis: {
        ...(widget.chartAnalysis || buildDefaultChartAnalysisConfig()),
      },
      kpi: {
        ...(widget.kpi || buildDefaultKpiConfig()),
      },
      kpiStyle: displayKpiStyle,
      kpiAnalysis: {
        ...(widget.kpiAnalysis || buildDefaultKpiAnalysisConfig()),
      },
      table: {
        ...(widget.table || buildDefaultTableConfig()),
      },
      tableStyle: {
        ...(widget.tableStyle || buildDefaultTableStyleConfig()),
      },
      tabs: {
        ...(widget.tabs || buildDefaultTabsConfig()),
      },
      tabsStyle: {
        ...(widget.tabsStyle || buildDefaultTabsStyleConfig()),
      },
      richText: {
        ...(widget.richText || buildDefaultRichTextConfig()),
      },
      richTextStyle: {
        ...(widget.richTextStyle || buildDefaultRichTextStyleConfig()),
      },
      image: {
        ...(widget.image || buildDefaultImageConfig()),
      },
      imageStyle: {
        ...(widget.imageStyle || buildDefaultImageStyleConfig()),
      },
      bindingMode: widget.bindingMode,
      datasetId: widget.datasetId,
      sourceId: widget.sourceId,
      sourceTable: widget.sourceTable,
      sourceSql: widget.sourceSql,
      fieldMap: widget.fieldMap || {},
    });
  }

  function openStylePicker(family: PrimaryChartFamilyKey, mode: "add" | "replace") {
    setStylePickerFamily(family);
    setStylePickerMode(mode);
    setStylePickerOpen(true);
  }

  function addAssetToCanvas(asset: ReportingChartAssetRecord) {
    createAssetWidget(asset, buildDefaultWidgetPosition(widgets.length));
  }

  function createAssetWidget(asset: ReportingChartAssetRecord, nextPosition: { x: number; y: number; w: number; h: number }) {
    const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
    const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
    const nextKey = `widget_${Date.now()}_${widgets.length}`;
    const snap = getLayoutSnap(basicForm.getFieldValue("layoutMode"));
    const initialPosition = resolveWidgetPlacement(
      nextKey,
      nextPosition,
      widgets,
      widgetMinGap,
      snap,
      canvasMetrics.width,
      canvasMetrics.height
    );
    const isPieFamily = getPrimaryChartFamily(asset) === "pie";
    const nextChartStyle = isPieFamily ? buildPieStructureFromAsset(asset) : buildDefaultChartStyleConfig();
    const nextChrome = buildDefaultChrome(asset.variantName || asset.chartName);
    const widget: CanvasWidgetDraft = {
      key: nextKey,
      widgetName: `${asset.chartName}_${widgets.length + 1}`,
      widgetType: "chart",
      inheritDashboardTheme: true,
      widgetThemeTemplateId: null,
      widgetThemeOverrides: {},
      chartAssetId: asset.id,
      chartFamily: getNormalizedChartFamilyValue(asset),
      variantName: asset.variantName || asset.chartName,
      accentColor: nextChartStyle.accentColor || String(asset.config?.accentColor || ""),
      palettePreset: isPieFamily ? null : (nextChartStyle.palettePreset || String(asset.config?.palettePreset || "")),
      chrome: nextChrome,
      chartStyle: nextChartStyle,
      mapStyle: buildDefaultMapStyleConfig(),
      chartAnalysis: buildDefaultChartAnalysisConfig(),
      kpi: buildDefaultKpiConfig(),
      kpiStyle: stripLegacyKpiThemeDefaults(buildDefaultKpiStyleConfig()),
      kpiAnalysis: buildDefaultKpiAnalysisConfig(),
      table: buildDefaultTableConfig(),
      tableStyle: buildDefaultTableStyleConfig(),
      tabs: buildDefaultTabsConfig(),
      tabsStyle: buildDefaultTabsStyleConfig(),
      richText: buildDefaultRichTextConfig(),
      richTextStyle: buildDefaultRichTextStyleConfig(),
      image: buildDefaultImageConfig(),
      imageStyle: buildDefaultImageStyleConfig(),
      bindingMode: "dataset",
      datasetId: datasets[0]?.id || null,
      sourceId: null,
      sourceTable: null,
      sourceSql: null,
      fieldMap: {},
      fields: [],
      preview: null,
      position: initialPosition,
    };
    const themedWidget = materializeWidgetFromTemplate(widget, activeThemeTemplates, activeDashboardThemeTemplateId);
    setWidgets((current) => [...current, themedWidget]);
    setSelectedWidgetKey(nextKey);
    syncConfigForm(themedWidget);
    setConfigOpen(true);
    setStylePickerOpen(false);
  }

  function addComponentWidget(type: ComponentLibraryKey) {
    createComponentWidget(type, buildDefaultWidgetPosition(widgets.length));
  }

  function createComponentWidget(type: ComponentLibraryKey, nextPosition: { x: number; y: number; w: number; h: number }) {
    const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
    const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
    const nextKey = `widget_${Date.now()}_${widgets.length}`;
    const snap = getLayoutSnap(basicForm.getFieldValue("layoutMode"));
    const boundedInitialPosition = resolveWidgetPlacement(nextKey, nextPosition, widgets, widgetMinGap, snap, canvasMetrics.width, canvasMetrics.height);
    const baseName = type === "kpi" ? "指标看板" : type === "table" ? "子表" : type === "tabs" ? "窗口切换" : type === "richText" ? "富文本" : "图片";
    const widget: CanvasWidgetDraft = {
      key: nextKey,
      widgetName: `${baseName}_${widgets.length + 1}`,
      widgetType: type,
      inheritDashboardTheme: true,
      widgetThemeTemplateId: null,
      widgetThemeOverrides: {},
      chartAssetId: null,
      chartFamily: null,
      variantName: null,
      accentColor: buildDefaultChartStyleConfig().accentColor || "#1677ff",
      palettePreset: "highlight-frame",
      chrome: buildDefaultChrome(baseName),
      chartStyle: buildDefaultChartStyleConfig(),
      mapStyle: buildDefaultMapStyleConfig(),
      chartAnalysis: buildDefaultChartAnalysisConfig(),
      kpi: buildDefaultKpiConfig(),
      kpiStyle: stripLegacyKpiThemeDefaults(buildDefaultKpiStyleConfig()),
      kpiAnalysis: buildDefaultKpiAnalysisConfig(),
      table: buildDefaultTableConfig(),
      tableStyle: buildDefaultTableStyleConfig(),
      tabs: buildDefaultTabsConfig(),
      tabsStyle: buildDefaultTabsStyleConfig(),
      richText: buildDefaultRichTextConfig(),
      richTextStyle: buildDefaultRichTextStyleConfig(),
      image: buildDefaultImageConfig(),
      imageStyle: buildDefaultImageStyleConfig(),
      bindingMode: "dataset",
      datasetId: datasets[0]?.id || null,
      sourceId: null,
      sourceTable: null,
      sourceSql: null,
      fieldMap: {},
      fields: [],
      preview: null,
      position: {
        ...boundedInitialPosition,
        h: type === "table" ? 420 : 280,
      },
    };
    const themedWidget = materializeWidgetFromTemplate(widget, activeThemeTemplates, activeDashboardThemeTemplateId);
    setWidgets((current) => [...current, themedWidget]);
    setSelectedWidgetKey(nextKey);
    syncConfigForm(themedWidget);
    setConfigOpen(true);
  }

  function createWidgetFromLibraryPayload(payload: LibraryDragPayload, nextPosition: { x: number; y: number; w: number; h: number }) {
    if (payload.kind === "component") {
      createComponentWidget(payload.componentType, nextPosition);
      return;
    }
    const activeChartAssets = chartAssetsRef.current.length ? chartAssetsRef.current : chartAssets;
    const asset = activeChartAssets.find((item) => item.id === payload.assetId);
    if (!asset) {
      message.error("未找到要拖入的图表风格");
      return;
    }
    createAssetWidget(asset, nextPosition);
  }

  function resolveAiRecommendationAsset(recommendation?: ReportingAiChartRecommendation | null) {
    if (!recommendation || recommendation.widgetType !== "chart") return null;
    const family = getPrimaryChartFamilyFromValue(recommendation.chartFamily);
    if (recommendation.chartAssetId) {
      const exact = chartAssetsRef.current.find((item) => item.id === Number(recommendation.chartAssetId))
        || chartAssets.find((item) => item.id === Number(recommendation.chartAssetId));
      if (exact && (!family || getPrimaryChartFamily(exact) === family)) return exact;
    }
    return libraryFamilies.find((item) => item.key === family)?.assets?.[0]
      || (chartAssetsRef.current.length ? chartAssetsRef.current : chartAssets)
        .find((asset) => asset.status !== "inactive" && getPrimaryChartFamily(asset) === family)
      || null;
  }

  function createAiWidgetFromRecommendation(
    recommendation: ReportingAiChartRecommendation,
    query: ReportingAiQueryResponse,
    preview: ReportingDashboardPreview | null,
    nextPosition: { x: number; y: number; w: number; h: number }
  ) {
    const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
    const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
    const asset = resolveAiRecommendationAsset(recommendation);
    const widgetType = recommendation.widgetType === "kpi" ? "kpi" : recommendation.widgetType === "table" ? "table" : "chart";
    if (widgetType === "chart" && !asset) {
      message.error("未找到匹配的图表资产");
      return;
    }
    const nextKey = `widget_${Date.now()}_${widgets.length}`;
    const snap = getLayoutSnap(basicForm.getFieldValue("layoutMode"));
    const initialPosition = resolveWidgetPlacement(
      nextKey,
      nextPosition,
      widgets,
      widgetMinGap,
      snap,
      canvasMetrics.width,
      canvasMetrics.height
    );
    const chartFamily = asset ? getNormalizedChartFamilyValue(asset) : null;
    const isPieFamily = asset ? getPrimaryChartFamily(asset) === "pie" : false;
    const baseTitle = recommendation.title || asset?.chartName || (widgetType === "kpi" ? "AI 指标卡" : widgetType === "table" ? "AI 明细表" : "AI 图表");
    const widget: CanvasWidgetDraft = {
      key: nextKey,
      widgetName: `${baseTitle}_${widgets.length + 1}`,
      widgetType: widgetType as WidgetType,
      inheritDashboardTheme: true,
      widgetThemeTemplateId: null,
      widgetThemeOverrides: {},
      chartAssetId: asset?.id || null,
      chartFamily,
      variantName: asset?.variantName || asset?.chartName || recommendation.chartFamily || null,
      accentColor: buildDefaultChartStyleConfig().accentColor || String(asset?.config?.accentColor || ""),
      palettePreset: isPieFamily ? null : (buildDefaultChartStyleConfig().palettePreset || String(asset?.config?.palettePreset || "")),
      chrome: buildDefaultChrome(baseTitle),
      chartStyle: isPieFamily && asset ? buildPieStructureFromAsset(asset) : buildDefaultChartStyleConfig(),
      mapStyle: buildDefaultMapStyleConfig(),
      chartAnalysis: buildDefaultChartAnalysisConfig(),
      kpi: buildDefaultKpiConfig(),
      kpiStyle: stripLegacyKpiThemeDefaults(buildDefaultKpiStyleConfig()),
      kpiAnalysis: buildDefaultKpiAnalysisConfig(),
      table: buildDefaultTableConfig(),
      tableStyle: buildDefaultTableStyleConfig(),
      tabs: buildDefaultTabsConfig(),
      tabsStyle: buildDefaultTabsStyleConfig(),
      richText: buildDefaultRichTextConfig(),
      richTextStyle: buildDefaultRichTextStyleConfig(),
      image: buildDefaultImageConfig(),
      imageStyle: buildDefaultImageStyleConfig(),
      bindingMode: "sql",
      datasetId: null,
      sourceId: query.sourceId,
      sourceTable: null,
      sourceSql: query.sourceSql,
      fieldMap: selectedAiEffectiveFieldMap,
      fields: query.fields || [],
      preview: null,
      position: {
        ...initialPosition,
        h: widgetType === "table" ? Math.max(initialPosition.h, 420) : initialPosition.h,
      },
    };
    const themedWidget = materializeWidgetFromTemplate(widget, activeThemeTemplates, activeDashboardThemeTemplateId);
    const themedWidgetWithPreview = preview
      ? { ...themedWidget, preview: transformPreviewForWidget(themedWidget, preview) }
      : themedWidget;
    setWidgets((current) => [...current, themedWidgetWithPreview]);
    setSelectedWidgetKey(nextKey);
    syncConfigForm(themedWidgetWithPreview);
    setConfigOpen(true);
    setAiAssistantOpen(false);
    message.success("AI 图表已添加到画布");
  }

  function replaceSelectedWidgetAsset(asset: ReportingChartAssetRecord) {
    if (!selectedWidget) return;
    const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
    const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
    const isPieFamily = getPrimaryChartFamily(asset) === "pie";
    const nextFieldMap = remapFieldMapForAsset(selectedWidget.fieldMap, asset, selectedWidget.fields || []);
    const nextChartStyle = isPieFamily
      ? buildPieStructureFromAsset(asset, selectedWidget.chartStyle || buildDefaultChartStyleConfig())
      : (selectedWidget.chartStyle || buildDefaultChartStyleConfig());
    const nextWidget = materializeWidgetFromTemplate({
      ...selectedWidget,
      widgetType: "chart" as WidgetType,
      chartAssetId: asset.id,
      chartFamily: getNormalizedChartFamilyValue(asset),
      variantName: asset.variantName || asset.chartName,
      accentColor: selectedWidget.accentColor || nextChartStyle.accentColor || String(asset.config?.accentColor || ""),
      palettePreset: selectedWidget.palettePreset || nextChartStyle.palettePreset || String(asset.config?.palettePreset || ""),
      chartStyle: nextChartStyle,
      fieldMap: nextFieldMap,
      chrome: selectedWidget.chrome || buildDefaultChrome(selectedWidget.widgetName),
    }, activeThemeTemplates, activeDashboardThemeTemplateId);
    updateSelectedWidget(nextWidget);
    syncConfigForm(nextWidget);
    setStylePickerOpen(false);
  }

  function resetAiAssistant(overrides: Partial<AiChartAssistantState> = {}) {
    setAiAssistantState({
      sourceId: dataSources.find((item) => item.status === "active")?.id || null,
      activeTab: "analysis",
      prompt: "",
      analysisDirection: "",
      analysisSuggestions: [],
      selectedAnalysisSuggestionKey: null,
      analysisSuggestionPage: 1,
      selectedTables: [],
      previewTableName: null,
      tablePreviewRows: [],
      tablePreviewColumns: [],
      sourceSql: "",
      plan: null,
      query: null,
      lastQueryError: null,
      recommendations: [],
      selectedRecommendationKey: null,
      preview: null,
      tables: [],
      editedFieldMap: {},
      revisionInstruction: "",
      autoPreview: true,
      ...overrides,
    });
  }

  function openAiAssistant() {
    resetAiAssistant({
      sourceId: aiAssistantState.sourceId || dataSources.find((item) => item.status === "active")?.id || null,
      activeTab: aiAssistantState.activeTab || "analysis",
      prompt: aiAssistantState.prompt,
      analysisDirection: aiAssistantState.analysisDirection,
      analysisSuggestions: aiAssistantState.analysisSuggestions,
      selectedAnalysisSuggestionKey: aiAssistantState.selectedAnalysisSuggestionKey,
      analysisSuggestionPage: aiAssistantState.analysisSuggestionPage,
      selectedTables: aiAssistantState.selectedTables,
      sourceSql: aiAssistantState.sourceSql,
      plan: aiAssistantState.plan,
      query: aiAssistantState.query,
      lastQueryError: aiAssistantState.lastQueryError,
      recommendations: aiAssistantState.recommendations,
      selectedRecommendationKey: aiAssistantState.selectedRecommendationKey,
      preview: aiAssistantState.preview,
      tables: aiAssistantState.tables,
      editedFieldMap: aiAssistantState.editedFieldMap,
      revisionInstruction: aiAssistantState.revisionInstruction,
      autoPreview: aiAssistantState.autoPreview,
    });
    setAiAssistantOpen(true);
  }

  async function handleAiGenerateSql() {
    if (!token) return;
    const sourceId = Number(aiAssistantState.sourceId || 0);
    if (!sourceId) {
      message.error("请先选择数据源");
      return;
    }
    if (!aiAssistantState.prompt.trim()) {
      message.error("请输入报表开发需求");
      return;
    }
    setAiAssistantLoading("plan");
    try {
      const response = await planReportingAiChartSql(token, {
        sourceId,
        prompt: aiAssistantState.prompt,
        selectedTables: aiAssistantState.selectedTables,
        currentSql: aiAssistantState.sourceSql || undefined,
      });
      setAiAssistantState((current) => ({
        ...current,
        plan: response.data,
        sourceSql: response.data.generatedSql || current.sourceSql,
        query: null,
        lastQueryError: null,
        recommendations: [],
        selectedRecommendationKey: null,
        preview: null,
        editedFieldMap: {},
      }));
      if (response.data.validation?.valid) {
        message.success(response.data.autoCorrection?.applied ? "SQL 已自动纠错并通过校验" : "SQL 已生成并通过校验");
      } else {
        message.warning("SQL 已生成，请先审核校验提示");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成 SQL 失败");
    } finally {
      setAiAssistantLoading(null);
    }
  }

  async function handleAiGenerateAnalysisSuggestions() {
    if (!token) return;
    const sourceId = Number(aiAssistantState.sourceId || 0);
    if (!sourceId) {
      message.error("请先选择数据源");
      return;
    }
    setAiAssistantLoading("analysis");
    try {
      const response = await suggestReportingAiChartAnalysis(token, {
        sourceId,
        analysisDirection: aiAssistantState.analysisDirection || aiAssistantState.prompt,
        selectedTables: aiAssistantState.selectedTables,
      });
      const suggestions = response.data.suggestions || [];
      const firstKey = suggestions[0] ? `${suggestions[0].id || suggestions[0].title}:0` : null;
      setAiAssistantState((current) => ({
        ...current,
        analysisSuggestions: suggestions,
        selectedAnalysisSuggestionKey: firstKey,
        analysisSuggestionPage: 1,
        plan: null,
        query: null,
        lastQueryError: null,
        recommendations: [],
        selectedRecommendationKey: null,
        preview: null,
        editedFieldMap: {},
      }));
      if (response.data.warning) {
        message.warning(response.data.warning);
      } else {
        message.success("分析内容已完善");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "完善分析内容失败");
    } finally {
      setAiAssistantLoading(null);
    }
  }

  function handleSelectAnalysisSuggestion(itemKey: string) {
    setAiAssistantState((current) => ({
      ...current,
      selectedAnalysisSuggestionKey: itemKey,
    }));
  }

  function handleApplyAnalysisSuggestion(item: ReportingAiAnalysisSuggestion, itemKey: string, options: { switchTab?: boolean } = {}) {
    setAiAssistantState((current) => ({
      ...current,
      selectedAnalysisSuggestionKey: itemKey,
      prompt: item.analysisPrompt || current.prompt,
      activeTab: options.switchTab === false ? current.activeTab : "sql",
      plan: null,
      query: null,
      lastQueryError: null,
      recommendations: [],
      selectedRecommendationKey: null,
      preview: null,
      editedFieldMap: {},
    }));
  }

  async function handleAiReviseSql() {
    if (!token) return;
    const sourceId = Number(aiAssistantState.sourceId || 0);
    if (!sourceId) {
      message.error("请先选择数据源");
      return;
    }
    if (!aiAssistantState.sourceSql.trim()) {
      message.error("请先生成或填写 SQL");
      return;
    }
    if (!aiAssistantState.revisionInstruction.trim()) {
      message.error("请输入 SQL 修改要求");
      return;
    }
    setAiAssistantLoading("plan");
    try {
      const response = await reviseReportingAiChartSql(token, {
        sourceId,
        prompt: aiAssistantState.prompt,
        selectedTables: aiAssistantState.selectedTables,
        currentSql: aiAssistantState.sourceSql,
        revisionInstruction: aiAssistantState.revisionInstruction,
        lastQueryProfile: aiAssistantState.query?.profile || null,
        lastError: aiAssistantState.lastQueryError || null,
      });
      setAiAssistantState((current) => ({
        ...current,
        plan: response.data,
        sourceSql: response.data.generatedSql || current.sourceSql,
        query: null,
        lastQueryError: null,
        recommendations: [],
        selectedRecommendationKey: null,
        preview: null,
        editedFieldMap: {},
      }));
      if (response.data.validation?.valid) {
        message.success(response.data.autoCorrection?.applied ? "SQL 已自动纠错并通过校验" : "SQL 已修改并通过校验");
      } else {
        message.warning("SQL 已修改，请先审核校验提示");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "修改 SQL 失败");
    } finally {
      setAiAssistantLoading(null);
    }
  }

  async function handleAiRunQuery() {
    if (!token) return;
    const sourceId = Number(aiAssistantState.sourceId || 0);
    if (!sourceId) {
      message.error("请先选择数据源");
      return;
    }
    if (!aiAssistantState.sourceSql.trim()) {
      message.error("请先生成或填写 SQL");
      return;
    }
    setAiAssistantLoading("query");
    try {
      const response = await runReportingAiChartQuery(token, {
        sourceId,
        sourceSql: aiAssistantState.sourceSql,
        limit: 100,
      });
      setAiAssistantState((current) => ({
        ...current,
        sourceSql: response.data.sourceSql,
        query: response.data,
        lastQueryError: null,
        recommendations: [],
        selectedRecommendationKey: null,
        preview: null,
        editedFieldMap: {},
      }));
      message.success(response.data.autoCorrection?.applied ? "SQL 已自动纠错并返回样例结果" : "查询已执行，已返回样例结果");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "执行查询失败";
      setAiAssistantState((current) => ({ ...current, lastQueryError: errorMessage }));
      message.error(errorMessage);
    } finally {
      setAiAssistantLoading(null);
    }
  }

  async function applyAiFieldMapForAsset(
    asset: ReportingChartAssetRecord,
    options: {
      recommendation?: ReportingAiChartRecommendation | null;
      preserveCurrent?: boolean;
      family?: PrimaryChartFamilyKey | null;
    } = {}
  ) {
    if (!token || !aiAssistantState.query) {
      return remapFieldMapForAsset(
        options.preserveCurrent ? aiAssistantState.editedFieldMap : (options.recommendation?.fieldMap || {}),
        asset,
        aiAssistantState.query?.fields || []
      );
    }
    const fallbackFieldMap = remapFieldMapForAsset(
      options.preserveCurrent ? aiAssistantState.editedFieldMap : (options.recommendation?.fieldMap || {}),
      asset,
      aiAssistantState.query.fields || []
    );
    try {
      const response = await allocateReportingAiChartFieldMap(token, {
        prompt: aiAssistantState.prompt,
        sourceId: aiAssistantState.query.sourceId,
        sourceSql: aiAssistantState.query.sourceSql,
        chartAssetId: asset.id,
        chartFamily: options.family || getPrimaryChartFamily(asset) || options.recommendation?.chartFamily || null,
        fields: aiAssistantState.query.fields,
        sampleRows: aiAssistantState.query.sampleRows,
        rowCount: aiAssistantState.query.rowCount,
        profile: aiAssistantState.query.profile,
        currentFieldMap: fallbackFieldMap,
      });
      if (response.data.warning) {
        message.warning(response.data.warning);
      }
      return response.data.fieldMap || fallbackFieldMap;
    } catch (error) {
      message.warning(error instanceof Error ? error.message : "AI 字段映射失败，已使用默认映射");
      return fallbackFieldMap;
    }
  }

  function buildAiRecommendationForAsset(asset: ReportingChartAssetRecord, current: AiChartAssistantState) {
    const base = selectedAiRecommendation;
    const family = getPrimaryChartFamily(asset) || getPrimaryChartFamilyFromValue(asset.chartFamily) || "bar";
    const assetDisplayName = family === "pie"
      ? getPieVariantDisplayName(buildPieStructureFromAsset(asset).pieVariant)
      : getChartAssetDisplayName(asset);
    const familyLabel = getPrimaryChartFamilyLabel(family);
    return {
      ...(base || {
        widgetType: "chart",
        title: "AI 图表预览",
        reason: "用户自选图表类型",
        score: 0.8,
      }),
      widgetType: "chart",
      chartFamily: family,
      chartAssetId: asset.id,
      chartName: assetDisplayName,
      title: base?.title ? `${base.title} - ${familyLabel}` : assetDisplayName || familyLabel,
      reason: `用户切换为${familyLabel}，基于当前查询结果重新映射字段。`,
      fieldMap: remapFieldMapForAsset(current.editedFieldMap, asset, current.query?.fields || []),
    } as ReportingAiChartRecommendation;
  }

  async function handleAiChartFamilyChange(family: PrimaryChartFamilyKey | "kpi") {
    const hideSwitchingMessage = message.loading("正在分析指标特征，并重新匹配图表字段...", 0);
    setAiAssistantLoading("chartSwitch");
    if (family === "kpi") {
      const recommendation: ReportingAiChartRecommendation = {
        widgetType: "kpi",
        chartFamily: "kpi",
        chartAssetId: null,
        title: "指标看板",
        chartName: "指标看板",
        reason: "适合展示核心总量、同比、环比等单指标概览。",
        score: 0.8,
        fieldMap: {},
      };
      const firstMetric = aiAssistantState.query?.fields?.find((field) => ["metric", "value"].includes(String(field.role || "").toLowerCase()))?.columnName
        || aiAssistantState.query?.fields?.[0]?.columnName
        || "";
      const itemKey = "kpi:kpi::0";
      setAiAssistantState((state) => ({
        ...state,
        selectedRecommendationKey: itemKey,
        recommendations: [
          { ...recommendation, fieldMap: { valueField: firstMetric } },
          ...state.recommendations.filter((item) => item.widgetType !== "kpi"),
        ],
        editedFieldMap: { valueField: firstMetric },
        preview: null,
      }));
      hideSwitchingMessage();
      setAiAssistantLoading(null);
      return;
    }
    try {
      const recommendation = aiAssistantState.recommendations.find((item) => item.widgetType === "chart" && getPrimaryChartFamilyFromValue(item.chartFamily) === family)
        || null;
      if (recommendation) {
        await handleAiRecommendationSelect(recommendation, `${recommendation.widgetType}:${recommendation.chartFamily}:${recommendation.chartAssetId || ""}:${aiAssistantState.recommendations.indexOf(recommendation)}`);
        return;
      }
      const activeChartAssets = chartAssetsRef.current.length ? chartAssetsRef.current : chartAssets;
      const asset = libraryFamilies.find((item) => item.key === family)?.assets?.[0]
        || activeChartAssets.find((item) => item.status !== "inactive" && getPrimaryChartFamily(item) === family)
        || null;
      if (!asset) {
        message.warning(`当前图表库没有可用的${getPrimaryChartFamilyLabel(family)}资产`);
        return;
      }
      const nextRecommendation = buildAiRecommendationForAsset(asset, aiAssistantState);
      const itemKey = `${nextRecommendation.widgetType}:${nextRecommendation.chartFamily}:${nextRecommendation.chartAssetId || ""}:${aiAssistantState.recommendations.length}`;
      const nextFieldMap = await applyAiFieldMapForAsset(asset, {
        recommendation: nextRecommendation,
        preserveCurrent: false,
        family,
      });
      setAiAssistantState((state) => ({
        ...state,
        recommendations: [...state.recommendations, { ...nextRecommendation, fieldMap: nextFieldMap }],
        selectedRecommendationKey: itemKey,
        editedFieldMap: nextFieldMap,
        preview: null,
      }));
    } finally {
      hideSwitchingMessage();
      setAiAssistantLoading(null);
    }
  }

  function buildAiPreviewPayload(
    recommendation: ReportingAiChartRecommendation,
    query: ReportingAiQueryResponse,
    options: { assetId?: number | null; fieldMap?: Record<string, string> } = {}
  ) {
    const asset = options.assetId
      ? chartAssetsRef.current.find((item) => item.id === Number(options.assetId)) || chartAssets.find((item) => item.id === Number(options.assetId)) || null
      : resolveAiRecommendationAsset(recommendation);
    const widgetType = recommendation.widgetType === "kpi" ? "kpi" : recommendation.widgetType === "table" ? "table" : "chart";
    const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
    const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
    const effectiveFieldMap = {
      ...(recommendation.fieldMap || {}),
      ...(options.fieldMap || {}),
    };
    const previewWidget = materializeWidgetFromTemplate({
      key: "ai_preview",
      widgetName: recommendation.title || "AI 图表预览",
      widgetType: widgetType as WidgetType,
      inheritDashboardTheme: true,
      widgetThemeTemplateId: null,
      widgetThemeOverrides: {},
      chartAssetId: asset?.id || null,
      chartFamily: asset ? getNormalizedChartFamilyValue(asset) : recommendation.chartFamily,
      variantName: asset?.variantName || asset?.chartName || recommendation.chartFamily,
      accentColor: buildDefaultChartStyleConfig().accentColor,
      palettePreset: buildDefaultChartStyleConfig().palettePreset,
      chrome: buildDefaultChrome(recommendation.title),
      chartStyle: asset && getPrimaryChartFamily(asset) === "pie" ? buildPieStructureFromAsset(asset) : buildDefaultChartStyleConfig(),
      mapStyle: buildDefaultMapStyleConfig(),
      chartAnalysis: buildDefaultChartAnalysisConfig(),
      kpi: buildDefaultKpiConfig(),
      kpiStyle: stripLegacyKpiThemeDefaults(buildDefaultKpiStyleConfig()),
      kpiAnalysis: buildDefaultKpiAnalysisConfig(),
      table: buildDefaultTableConfig(),
      tableStyle: buildDefaultTableStyleConfig(),
      tabs: buildDefaultTabsConfig(),
      tabsStyle: buildDefaultTabsStyleConfig(),
      richText: buildDefaultRichTextConfig(),
      richTextStyle: buildDefaultRichTextStyleConfig(),
      image: buildDefaultImageConfig(),
      imageStyle: buildDefaultImageStyleConfig(),
      bindingMode: "sql",
      datasetId: null,
      sourceId: query.sourceId,
      sourceTable: null,
      sourceSql: query.sourceSql,
      fieldMap: effectiveFieldMap,
      fields: query.fields || [],
      preview: null,
      position: { x: 0, y: 0, w: 560, h: widgetType === "table" ? 360 : 320 },
    }, activeThemeTemplates, activeDashboardThemeTemplateId);
    return {
      previewWidget,
      payload: {
        chartAssetId: asset?.id || undefined,
        widgetType,
        chartFamily: previewWidget.chartFamily || undefined,
        variantName: previewWidget.variantName || undefined,
        accentColor: previewWidget.accentColor || undefined,
        palettePreset: previewWidget.palettePreset || undefined,
        chrome: previewWidget.chrome,
        chartStyle: previewWidget.chartStyle,
        mapStyle: previewWidget.mapStyle,
        chartAnalysis: previewWidget.chartAnalysis,
        kpiStyle: previewWidget.kpiStyle,
        tableStyle: previewWidget.tableStyle,
        sourceId: query.sourceId,
        datasetType: "sql",
        sourceSql: query.sourceSql,
        fieldMap: effectiveFieldMap,
      },
    };
  }

  async function handleAiRecommendCharts() {
    if (!token || !aiAssistantState.query) {
      message.error("请先执行查询");
      return;
    }
    setAiAssistantLoading("recommend");
    try {
      const response = await recommendReportingAiChart(token, {
        prompt: aiAssistantState.prompt,
        sourceId: aiAssistantState.query.sourceId,
        sourceSql: aiAssistantState.query.sourceSql,
        fields: aiAssistantState.query.fields,
        sampleRows: aiAssistantState.query.sampleRows,
        rowCount: aiAssistantState.query.rowCount,
        profile: aiAssistantState.query.profile,
      });
      const recommendations = response.data.recommendations || [];
      const firstKey = recommendations[0] ? `${recommendations[0].widgetType}:${recommendations[0].chartFamily}:${recommendations[0].chartAssetId || ""}:0` : null;
      setAiAssistantState((current) => ({
        ...current,
        recommendations,
        selectedRecommendationKey: firstKey,
        editedFieldMap: recommendations[0]?.fieldMap || {},
        preview: null,
      }));
      if (response.data.warning) {
        message.warning(response.data.warning);
      } else {
        message.success("图表推荐已生成");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "推荐图表失败");
    } finally {
      setAiAssistantLoading(null);
    }
  }

  async function handleAiPreviewRecommendation(
    recommendation = selectedAiRecommendation,
    options: { assetId?: number | null; fieldMap?: Record<string, string> } = {}
  ) {
    if (!token || !recommendation || !aiAssistantState.query) return;
    setAiAssistantLoading("preview");
    try {
      const { payload } = buildAiPreviewPayload(recommendation, aiAssistantState.query, {
        fieldMap: options.fieldMap ?? aiAssistantState.editedFieldMap,
      });
      if (payload.widgetType === "chart" && !payload.chartAssetId) {
        message.error("未找到匹配的图表资产");
        return;
      }
      const response = await previewReportingDashboardChart(token, payload);
      setAiAssistantState((current) => ({
        ...current,
        preview: response.data,
      }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "预览图表失败");
    } finally {
      setAiAssistantLoading(null);
    }
  }

  async function handleAiInsertWidget() {
    if (!selectedAiFieldMapValidation.valid) {
      message.error(selectedAiFieldMapValidation.messages[0] || "请先完善字段映射");
      return;
    }
    if (!selectedAiRecommendation || !aiAssistantState.query) {
      message.error("请先选择图表推荐");
      return;
    }
    setAiAssistantLoading("insert");
    try {
      let preview = aiAssistantState.preview;
      if (!preview && token) {
        const { payload } = buildAiPreviewPayload(selectedAiRecommendation, aiAssistantState.query, {
          fieldMap: aiAssistantState.editedFieldMap,
        });
        if (payload.widgetType === "chart" && !payload.chartAssetId) {
          message.error("未找到匹配的图表资产");
          return;
        }
        const response = await previewReportingDashboardChart(token, payload);
        preview = response.data;
        setAiAssistantState((current) => ({ ...current, preview }));
      }
      createAiWidgetFromRecommendation(
        selectedAiRecommendation,
        aiAssistantState.query,
        preview,
        buildDefaultWidgetPosition(widgets.length)
      );
    } finally {
      setAiAssistantLoading(null);
    }
  }

  async function handleAiRecommendationSelect(item: ReportingAiChartRecommendation, itemKey: string) {
    const asset = resolveAiRecommendationAsset(item);
    const nextFieldMap = asset && item.widgetType === "chart"
      ? await applyAiFieldMapForAsset(asset, { recommendation: item, preserveCurrent: false })
      : (item.fieldMap || {});
    setAiAssistantState((current) => ({
      ...current,
      selectedRecommendationKey: itemKey,
      editedFieldMap: nextFieldMap,
      preview: null,
    }));
  }

  function handleAiFieldMapChange(key: string, value?: string) {
    setAiAssistantState((current) => {
      const nextFieldMap = { ...(current.editedFieldMap || {}) };
      if (value) {
        nextFieldMap[key] = value;
      } else {
        delete nextFieldMap[key];
      }
      return {
        ...current,
        editedFieldMap: nextFieldMap,
        preview: null,
      };
    });
  }

  useEffect(() => {
    if (!aiAssistantOpen || !aiAssistantState.autoPreview) return;
    if (!selectedAiRecommendation || !aiAssistantState.query) return;
    if (aiAssistantLoading === "preview") return;
    if (aiAssistantState.preview) return;
    if (!selectedAiFieldMapValidation.valid) return;
    const timer = window.setTimeout(() => {
      void handleAiPreviewRecommendation(selectedAiRecommendation);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    aiAssistantOpen,
    aiAssistantState.autoPreview,
    aiAssistantState.preview,
    aiAssistantState.query,
    aiAssistantLoading,
    JSON.stringify(aiAssistantState.editedFieldMap || {}),
    selectedAiFieldMapValidation.valid,
    selectedAiRecommendation,
  ]);

function applyPieVariantToSelectedWidget(variant: WidgetChartStyleConfig["pieVariant"]) {
  if (!selectedWidget) return;
  const nextChartStyle = applyPieVariantConstraints(
    applyPieVariantPreset(
      selectedWidget.chartStyle || buildDefaultChartStyleConfig(),
      variant
    )
  );
  const nextWidget = {
    ...selectedWidget,
    chartStyle: nextChartStyle,
      variantName: PIE_VARIANT_LIBRARY.find((item) => item.key === variant)?.label || selectedWidget.variantName,
    };
    updateSelectedWidget(nextWidget);
    syncConfigForm(nextWidget);
    window.setTimeout(() => {
      void handlePreviewWidget(nextWidget, true);
    }, 0);
    setStylePickerOpen(false);
  }

  function updateSelectedWidget(patch: Partial<CanvasWidgetDraft>) {
    if (!selectedWidgetKey) return;
    setWidgets((current) => current.map((item) => item.key === selectedWidgetKey ? { ...item, ...patch } : item));
  }

  function buildWidgetPreviewRequestSignature(widget?: CanvasWidgetDraft | null) {
    if (!widget) return "";
    return JSON.stringify({
      key: widget.key,
      widgetType: widget.widgetType,
      chartAssetId: widget.chartAssetId || null,
      chartFamily: widget.chartFamily || null,
      variantName: widget.variantName || null,
      bindingMode: widget.bindingMode,
      datasetId: widget.datasetId || null,
      sourceId: widget.sourceId || null,
      sourceTable: widget.sourceTable || null,
      sourceSql: widget.sourceSql || null,
      fieldMap: widget.fieldMap || {},
      chrome: widget.chrome || {},
      chartStyle: widget.chartStyle || {},
      mapStyle: widget.mapStyle || {},
      chartAnalysis: widget.chartAnalysis || {},
      kpi: widget.kpi || {},
      kpiStyle: widget.kpiStyle || {},
      kpiAnalysis: widget.kpiAnalysis || {},
      table: widget.table || {},
      tableStyle: widget.tableStyle || {},
      tabs: widget.tabs || {},
      tabsStyle: widget.tabsStyle || {},
    });
  }

  function shouldInstantPreviewFlipperChange(changedValues: Record<string, unknown>) {
    const kpiStyle = changedValues.kpiStyle as Record<string, unknown> | undefined;
    if (!kpiStyle) return false;
    return [
      "flipperBackgroundType",
      "flipperBackgroundColor",
      "flipperBackgroundGradient",
      "flipperBackgroundDirection",
      "flipperBackgroundImage",
      "flipperRefreshSeconds",
      "flipperGap",
      "flipperDigitWidth",
      "flipperDigitHeight",
      "flipperDigitRadius",
      "valueColor",
      "valueFontSize",
      "valueFontWeight",
      "valuePrefixColor",
      "valuePrefixFontSize",
      "valueSuffixColor",
      "valueSuffixFontSize",
    ].some((key) => key in kpiStyle);
  }

  function shouldInstantPreviewKpiDataChange(changedValues: Record<string, unknown>) {
    const kpi = changedValues.kpi as Record<string, unknown> | undefined;
    if (!kpi) return false;
    return ["mode", "layout", "valuePrefix", "valueSuffix", "decimals", "compareLabel"].some((key) => key in kpi);
  }

  function shouldInstantPreviewPieChange(changedValues: Record<string, unknown>) {
    const chartStyle = changedValues.chartStyle as Record<string, unknown> | undefined;
    if (!chartStyle) return false;
    return [
      "pieVariant",
      "pieInnerRadius",
      "pieOuterRadius",
      "pieStartAngle",
      "pieSweepAngle",
      "pieRoseMode",
      "pieShowCenter",
      "pieCenterTitle",
      "pieCenterValue",
      "pieCenterUnit",
      "pieCenterSubtitle",
      "pieCenterTitleColor",
      "pieCenterValueColor",
      "pieCenterUnitColor",
      "pieCenterMetaColor",
      "pieLabelMode",
      "pieLabelColor",
      "pieValueColor",
      "pieLabelLineShow",
      "pieLabelLineColor",
      "pieLabelLineWidth",
      "pieLabelLineLength",
      "pieLabelLineLength2",
      "pieBorderColor",
      "pieBorderWidth",
      "pieLegendPosition",
      "pieLegendShowValue",
      "pieLegendShowPercent",
      "pieShowCategory",
      "pieShowValue",
      "pieShowPercent",
      "pieValueFormat",
      "pieSortOrder",
      "pieMaxSlices",
      "pieMergeOthers",
      "pieOthersName",
    ].some((key) => key in chartStyle);
  }

  function shouldInstantPreviewBarChange(changedValues: Record<string, unknown>) {
    const chartStyle = changedValues.chartStyle as Record<string, unknown> | undefined;
    if (!chartStyle) return false;
    return [
      "barSeriesLayout",
      "legendPrimaryName",
      "legendSecondaryName",
      "barPrimaryColor",
      "barSecondaryColor",
      "horizontalBarPalette",
      "horizontalBarColorCount",
      "horizontalBarSortOrder",
      "sankeyNodeWidth",
      "sankeyNodeGap",
      "sankeyNodeBorderColor",
      "sankeyNodeBorderWidth",
      "sankeyNodeBorderRadius",
      "sankeyLinkOpacity",
      "sankeyLinkCurveness",
      "gaugePointerColor",
      "gaugeDetailColor",
      "gaugeTitleColor",
      "gaugeMetricName",
      "gaugeAxisLabelColor",
      "gaugeSplitLineColor",
      "gaugeStartAngle",
      "gaugeEndAngle",
      "gaugeRadius",
      "gaugeProgressWidth",
      "gaugeAxisLineWidth",
      "gaugePointerLength",
      "gaugeDetailFontSize",
      "gaugeDetailFontWeight",
      "gaugeTitleFontSize",
      "funnelValueColor",
      "funnelLabelLineColor",
      "funnelBlockBorderColor",
      "funnelBlockBorderWidth",
      "funnelItemGap",
      "funnelSortOrder",
      "funnelLabelPosition",
      "funnelShowName",
      "funnelShowValue",
      "wordCloudShape",
      "wordCloudGridSize",
      "wordCloudRotationStep",
      "wordCloudMinFontSize",
      "wordCloudMaxFontSize",
      "wordCloudFontWeight",
      "wordCloudTextShadowColor",
      "wordCloudTextShadowBlur",
      "scatterSymbolSize",
      "scatterPointBorderColor",
      "scatterPointBorderWidth",
      "scatterPointOpacity",
      "scatterLabelPosition",
      "barGap",
      "barCategoryGap",
      "barSeriesOverlap",
      "barCategoryGapPercent",
      "barBorderRadius",
      "barValuePosition",
      "lineWidth",
      "lineSmooth",
      "lineShowSymbol",
      "lineSymbolSize",
      "lineAreaOpacity",
      "lineLabelPosition",
      "radarCenterX",
      "radarCenterY",
      "radarRadius",
      "radarShape",
      "radarSplitNumber",
      "radarShowSplitArea",
      "radarAreaOpacity",
      "radarLayout",
      "radarPrimaryColor",
      "radarSecondaryColor",
      "radarPointColor",
      "showLegend",
      "legendPosition",
      "legendTextColor",
      "legendFontSize",
      "legendFontWeight",
      "showAxis",
      "showXAxis",
      "showYAxis",
      "showGridLines",
      "xAxisUnitLabel",
      "yAxisUnitLabel",
      "axisLabelColor",
      "axisLabelFontSize",
      "axisLabelFontWeight",
      "dataLabelColor",
      "dataLabelFontSize",
      "dataLabelFontWeight",
    ].some((key) => key in chartStyle);
  }

  function removeWidget(key: string) {
    setWidgets((current) => current.filter((item) => item.key !== key));
    if (selectedWidgetKey === key) {
      setSelectedWidgetKey(null);
      setConfigOpen(false);
    }
  }

  async function handlePreviewWidget(widget?: CanvasWidgetDraft | null, silent = false) {
    if (!token || !widget) return;
    if (!isPreviewBackedWidget(widget.widgetType)) return;
    const requestSignature = buildWidgetPreviewRequestSignature(widget);
    try {
      setPreviewLoading(true);
      const defaultChartAsset = resolveDefaultChartAsset(chartAssets);
      const payload = {
        chartAssetId: widget.chartAssetId || (widget.widgetType === "tabs" ? defaultChartAsset?.id : undefined),
        widgetType: widget.widgetType,
        chartFamily: widget.chartFamily || undefined,
        variantName: widget.variantName || undefined,
        accentColor: widget.accentColor || undefined,
        palettePreset: widget.palettePreset || undefined,
        chrome: widget.chrome,
        chartStyle: widget.chartStyle,
        mapStyle: widget.mapStyle,
        chartAnalysis: widget.chartAnalysis,
        kpiMode: widget.kpi?.mode,
        valuePrefix: widget.kpi?.valuePrefix,
        valueSuffix: widget.kpi?.valueSuffix,
        decimals: widget.kpi?.decimals,
        showTrend: widget.kpiAnalysis?.showTrend,
        kpiStyle: widget.kpiStyle,
        pageSize: widget.table?.pageSize,
        tableStyle: widget.tableStyle,
        tabs: widget.tabs?.items,
        tabsStyle: widget.tabsStyle,
        datasetId: widget.bindingMode === "dataset" ? widget.datasetId : undefined,
        sourceId: widget.bindingMode === "sql" ? widget.sourceId : undefined,
        datasetType: widget.bindingMode === "sql" ? (widget.sourceSql ? "sql" : "table") : undefined,
        sourceTable: widget.bindingMode === "sql" ? widget.sourceTable : undefined,
        sourceSql: widget.bindingMode === "sql" ? widget.sourceSql : undefined,
        fieldMap: widget.fieldMap || {},
      };
      const response = await previewReportingDashboardChart(token, payload);
      const nextPreview = transformPreviewForWidget(widget, response.data);
      setWidgets((current) => current.map((item) => {
        if (item.key !== widget.key) return item;
        if (buildWidgetPreviewRequestSignature(item) !== requestSignature) {
          return item;
        }
        return {
          ...item,
          preview: nextPreview,
          fields: nextPreview.fields || [],
          fieldMap: nextPreview.fieldMap || item.fieldMap,
          kpi: nextPreview.kpi ? { ...(item.kpi || {}), ...(nextPreview.kpi as WidgetKpiConfig) } : item.kpi,
          table: nextPreview.table ? { ...(item.table || {}), ...(nextPreview.table as WidgetTableConfig) } : item.table,
          tabs: nextPreview.tabs ? { ...(item.tabs || buildDefaultTabsConfig()), ...(nextPreview.tabs as WidgetTabsConfig) } : item.tabs,
          chartStyle: item.chartStyle || buildDefaultChartStyleConfig(),
          mapStyle: item.mapStyle || buildDefaultMapStyleConfig(),
          chartAnalysis: item.chartAnalysis || buildDefaultChartAnalysisConfig(),
          kpiStyle: item.kpiStyle || buildDefaultKpiStyleConfig(),
          kpiAnalysis: item.kpiAnalysis || buildDefaultKpiAnalysisConfig(),
          tableStyle: item.tableStyle || buildDefaultTableStyleConfig(),
          tabsStyle: item.tabsStyle || buildDefaultTabsStyleConfig(),
        };
      }));
      if (!silent) {
        message.success("图表预览已更新");
      }
    } catch (error: any) {
      if (!silent) {
        message.error(`图表预览失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePreviewSelectedWidget() {
    await handlePreviewWidget(selectedWidget, false);
  }

  function scheduleAutoPreview() {
    if (!selectedWidget) return;
    if (!isPreviewBackedWidget(selectedWidget.widgetType)) return;
    const widget = selectedWidget;
    if (widget.bindingMode === "dataset") {
      if (!widget.datasetId) return;
    } else {
      if (!widget.sourceId) return;
      if (!widget.sourceSql && !widget.sourceTable) return;
    }
    if (autoPreviewTimerRef.current) {
      window.clearTimeout(autoPreviewTimerRef.current);
    }
    autoPreviewTimerRef.current = window.setTimeout(() => {
      void handlePreviewWidget(widget, true);
    }, AUTO_PREVIEW_DEBOUNCE_MS);
  }

  useEffect(() => {
    if (!configOpen || !selectedWidget) return;
    scheduleAutoPreview();
  }, [
    configOpen,
    selectedWidget?.key,
    selectedWidget?.widgetType,
    selectedWidget?.chartAssetId,
    selectedWidget?.variantName,
    selectedWidget?.palettePreset,
    selectedWidget?.accentColor,
    selectedWidget?.bindingMode,
    selectedWidget?.datasetId,
    selectedWidget?.sourceId,
    selectedWidget?.sourceTable,
    selectedWidget?.sourceSql,
    JSON.stringify(selectedWidget?.fieldMap || {}),
    JSON.stringify(selectedWidget?.chrome || {}),
    JSON.stringify(selectedWidget?.chartStyle || {}),
    JSON.stringify(selectedWidget?.mapStyle || {}),
    JSON.stringify(selectedWidget?.chartAnalysis || {}),
    JSON.stringify(selectedWidget?.kpi || {}),
    JSON.stringify(selectedWidget?.kpiStyle || {}),
    JSON.stringify(selectedWidget?.kpiAnalysis || {}),
    JSON.stringify(selectedWidget?.table || {}),
    JSON.stringify(selectedWidget?.tableStyle || {}),
    JSON.stringify(selectedWidget?.tabs || {}),
    JSON.stringify(selectedWidget?.tabsStyle || {}),
  ]);

  async function handleSaveDashboard() {
    if (!token) return;
    if (!widgets.length) {
      message.error("请至少添加一个图表到画布");
      return;
    }
    try {
      await basicForm.validateFields();
      const values = basicForm.getFieldsValue(true);
      const dashboardName = values.dashboardName || basicForm.getFieldValue("dashboardName");
      if (!dashboardName || String(dashboardName).trim().length < 2) {
        setBasicInfoOpen(true);
        message.error("请先在“基本信息配置”里填写至少 2 个字的名称");
        return;
      }
      const payload = {
        dashboardName,
        layoutMode: values.layoutMode,
        themeTemplateId: getCurrentDashboardThemeTemplateId(),
        themeSettings: dashboardThemeSettings,
        ownerName: values.ownerName,
        status: values.status,
        description: values.description,
        canvasConfig: {
          ...buildCanvasConfigFromForm(values),
          columns: 24,
          editorMode: values.layoutMode === "grid" ? "grid-layout" : "free-layout",
          ratioPreset: values.canvasRatioPreset || canvasRatioPreset || "16:9",
          widgetMinGap: Number(values.widgetMinGap || widgetMinGap || DEFAULT_WIDGET_GAP),
        },
        widgets: widgets.map((widget) => ({
          widgetKey: widget.key,
          widgetName: widget.widgetName,
          widgetType: widget.widgetType,
          datasetId: widget.bindingMode === "dataset" ? widget.datasetId : null,
          chartAssetId: widget.chartAssetId,
          position: widget.position,
          props: {
            title: widget.widgetName,
            inheritDashboardTheme: widget.inheritDashboardTheme !== false,
            widgetThemeTemplateId: widget.widgetThemeTemplateId || null,
            widgetThemeOverrides: widget.widgetThemeOverrides || {},
            fieldMap: widget.fieldMap || widget.preview?.fieldMap || {},
            chartFamily: widget.chartFamily || undefined,
            variantName: widget.variantName || undefined,
            accentColor: widget.accentColor || undefined,
            palettePreset: widget.palettePreset || undefined,
            chrome: widget.chrome || {},
            chartStyle: widget.chartStyle || {},
            mapStyle: widget.mapStyle || {},
            chartAnalysis: widget.chartAnalysis || {},
            kpi: widget.kpi || {},
            kpiStyle: widget.kpiStyle || {},
            kpiAnalysis: widget.kpiAnalysis || {},
            table: widget.table || {},
            tableStyle: widget.tableStyle || {},
            tabs: widget.tabs || {},
            tabsStyle: widget.tabsStyle || {},
            richTextStyle: widget.richTextStyle || {},
            richText: widget.richText || {},
            bindingMode: widget.bindingMode,
            containerParentKey: widget.containerParentKey || null,
            containerTabKey: widget.containerTabKey || null,
            sourceId: widget.bindingMode === "sql" ? widget.sourceId : null,
            sourceTable: widget.bindingMode === "sql" ? widget.sourceTable : null,
            sourceSql: widget.bindingMode === "sql" ? widget.sourceSql : null,
            image: widget.image || {},
            imageStyle: widget.imageStyle || {},
          },
          queryParams: {},
        })),
      };
      setSaving(true);
      if (dashboardId) {
        await updateReportingDashboard(token, dashboardId, payload);
        message.success("仪表盘已更新");
      } else {
        const response = await createReportingDashboard(token, payload);
        message.success("仪表盘已创建");
        navigate(`/dashboard/reporting/workbench/${response.data.id}/edit`, { replace: true });
      }
    } catch (error: any) {
      if (!error?.errorFields) {
        const dashboardNameError = error?.details?.fieldErrors?.dashboardName?.[0];
        if (dashboardNameError) {
          setBasicInfoOpen(true);
          message.error(dashboardNameError);
          return;
        }
        const detailText = error?.details ? ` ${JSON.stringify(error.details)}` : "";
        message.error(`保存失败: ${error.message || "未知错误"}${detailText}`);
        console.error("reporting dashboard save failed", error);
      }
    } finally {
      setSaving(false);
    }
  }

  const previewColumns: ColumnsType<Record<string, unknown>> = useMemo(() => {
    const fieldOptions = getFieldOptions(selectedWidget, datasets);
    return fieldOptions.map((field) => ({
      title: field.label,
      dataIndex: field.value,
      key: field.value,
      width: 160,
      render: (value: unknown) => value === null || value === undefined || value === "" ? "-" : String(value),
    }));
  }, [datasets, selectedWidget]);

  const themeTemplateCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(themeTemplates.map((item) => item.category).filter(Boolean)));
    return [{ value: "all", label: "全部模板" }, ...categories.map((item) => ({ value: item, label: item }))];
  }, [themeTemplates]);

  const groupedThemeTemplateOptions = useMemo(() => {
    const filteredTemplates = themeCategoryFilter === "all"
      ? themeTemplates
      : themeTemplates.filter((item) => item.category === themeCategoryFilter);
    const groups = Array.from(new Set(filteredTemplates.map((item) => item.category).filter(Boolean)));
    return groups.map((category) => ({
      label: category,
      options: filteredTemplates
        .filter((item) => item.category === category)
        .map((item) => ({
          value: item.id,
          label: item.themeName,
        })),
    }));
  }, [themeCategoryFilter, themeTemplates]);
  const dashboardThemeTemplateName = useMemo(
    () => themeTemplates.find((item) => item.id === dashboardThemeTemplateId)?.themeName || null,
    [dashboardThemeTemplateId, themeTemplates]
  );
  const followsDashboardTheme = selectedWidget?.inheritDashboardTheme !== false;

  const configPanelItems = useMemo(() => {
    if (!selectedWidget) return [];

    const items: Array<{ key: string; label: string; children: React.ReactNode }> = [];
    const titleStyleItem = {
      key: "title",
      label: "标题设置",
      children: renderConfigGrid(
        followsDashboardTheme ? (
          <>
            <Form.Item name={["chrome", "showTitle"]} label="显示图表名称" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name={["chrome", "titleText"]} label="标题文字">
              <Input placeholder="支持自定义标题" />
            </Form.Item>
            <Form.Item name={["chrome", "titleAlign"]} label="标题对齐">
              <Select options={[{ value: "left", label: "左对齐" }, { value: "center", label: "居中" }, { value: "right", label: "右对齐" }]} />
            </Form.Item>
            <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>标题颜色与容器主题跟随基础设置，仅支持修改标题文案与对齐。</div>
          </>
        ) : (
          <>
            <Form.Item name={["chrome", "showTitle"]} label="显示图表名称" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name={["chrome", "titleText"]} label="标题文字">
              <Input placeholder="支持自定义标题" />
            </Form.Item>
            <Form.Item name={["chrome", "titleAlign"]} label="标题对齐">
              <Select options={[{ value: "left", label: "左对齐" }, { value: "center", label: "居中" }, { value: "right", label: "右对齐" }]} />
            </Form.Item>
            <Form.Item name={["chrome", "titleColor"]} label="标题颜色">
              <Input type="color" />
            </Form.Item>
            <Form.Item name={["chrome", "titleFontSize"]} label="标题字号">
              <Input type="number" />
            </Form.Item>
            <Form.Item name={["chrome", "titleFontWeight"]} label="标题字重">
              <Input type="number" />
            </Form.Item>
          </>
        )
      ),
    };
    const containerStyleItem = {
      key: "container",
      label: "容器配置",
      children: renderConfigGrid(
        <>
          <Form.Item name={["chrome", "backgroundType"]} label="背景类型" style={{ gridColumn: "1 / -1" }}>
            <Select options={[{ value: "solid", label: "纯色" }, { value: "gradient", label: "渐变" }, { value: "image", label: "图片" }]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const chromeType = configForm.getFieldValue(["chrome", "backgroundType"]) || "solid";
              if (chromeType === "solid") {
                return (
                  <Form.Item name={["chrome", "backgroundColor"]} label="容器纯色">
                    <Input type="color" />
                  </Form.Item>
                );
              }
              if (chromeType === "image") {
                return (
                  <Form.Item label="背景图" style={{ gridColumn: "1 / -1" }}>
                    <Space direction="vertical" size={12} style={{ display: "flex" }}>
                      <Form.Item name={["chrome", "backgroundImage"]} noStyle>
                        <Input placeholder="支持粘贴 URL，或通过下方上传本地图片" />
                      </Form.Item>
                      <Upload
                        showUploadList={false}
                        accept="image/*"
                        beforeUpload={async (file) => {
                          try {
                            const imageUrl = await readLocalImageAsDataUrl(file);
                            const nextChrome = {
                              ...(selectedWidget.chrome || buildDefaultChrome(selectedWidget.widgetName)),
                              backgroundType: "image",
                              backgroundImage: imageUrl,
                            };
                            updateSelectedWidget({ chrome: nextChrome });
                            configForm.setFieldValue(["chrome"], nextChrome);
                            message.success("容器背景图已载入");
                          } catch (error: any) {
                            message.error(error.message || "背景图读取失败");
                          }
                          return false;
                        }}
                      >
                        <Button>上传容器背景图</Button>
                      </Upload>
                    </Space>
                  </Form.Item>
                );
              }
              return (
                <>
                  <Form.Item name={["chrome", "backgroundColor"]} label="渐变起始色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chrome", "backgroundGradientEnd"]} label="渐变结束色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chrome", "backgroundGradientDirection"]} label="渐变方向" style={{ gridColumn: "1 / -1" }}>
                    <Select options={[
                      { value: "to bottom", label: "自上而下" },
                      { value: "to top", label: "自下而上" },
                      { value: "to right", label: "自左向右" },
                      { value: "to left", label: "自右向左" },
                      { value: "to bottom right", label: "左上到右下" },
                      { value: "to top right", label: "左下到右上" },
                    ]} />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
          <Form.Item name={["chrome", "borderColor"]} label="边框颜色">
            <Input type="color" />
          </Form.Item>
          <Form.Item name={["chrome", "borderWidth"]} label="边框粗细">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name={["chrome", "borderRadius"]} label="圆角">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name={["chrome", "shadowPreset"]} label="容器阴影">
            <Select options={[
              { value: "none", label: "无阴影" },
              { value: "soft", label: "柔和" },
              { value: "medium", label: "中等" },
            ]} />
          </Form.Item>
          <Form.Item name={["chrome", "paddingPreset"]} label="图内边距" style={{ gridColumn: "1 / -1" }}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: "compact", label: "一级 紧贴" },
                { value: "comfortable", label: "二级 适中" },
                { value: "spacious", label: "三级 留白大" },
              ]}
            />
          </Form.Item>
          {followsDashboardTheme ? (
            <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>
              容器配置默认已从主题模板初始化，当前支持继续自定义纯色、渐变或图片背景。
            </div>
          ) : null}
        </>
      ),
    };

    if (configTab === "style") {
      if (selectedWidget.widgetType === "chart") {
        if (getPrimaryChartFamily(selectedWidgetAsset) === "pie") {
          items.push({
            key: "pieStructure",
            label: "结构设置",
            children: renderConfigGrid(
              <>
                <Form.Item label="饼图类型" style={{ gridColumn: "1 / -1" }}>
                  <Button
                    block
                    onClick={() => openStylePicker("pie", "replace")}
                  >
                    {PIE_VARIANT_LIBRARY.find((item) => item.key === selectedWidget.chartStyle?.pieVariant)?.label || "选择饼图类型"}
                  </Button>
                </Form.Item>
                <div style={{ gridColumn: "1 / -1", marginTop: -4, marginBottom: 4, color: "#667085", fontSize: 12 }}>
                  先确定饼图类型，再设置角度范围和半径结构。
                </div>
                {selectedWidget.chartStyle?.pieVariant !== "classic-pie" ? (
                  <Form.Item name={["chartStyle", "pieInnerRadius"]} label="内半径 %">
                    <Input type="number" min={0} max={90} />
                  </Form.Item>
                ) : <div />}
                <Form.Item name={["chartStyle", "pieOuterRadius"]} label="外半径 %">
                  <Input type="number" min={10} max={95} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieStartAngle"]} label="起始角度">
                  <Input type="number" min={0} max={360} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieSweepAngle"]} label="扇形角度">
                  <Input type="number" min={1} max={360} />
                </Form.Item>
                {selectedWidget.chartStyle?.pieVariant === "rose" ? (
                  <Form.Item name={["chartStyle", "pieRoseMode"]} label="玫瑰模式">
                    <Select options={[{ value: "radius", label: "按半径" }, { value: "area", label: "按面积" }]} />
                  </Form.Item>
                ) : <div />}
              </>
            ),
          });

          items.push(titleStyleItem);

          items.push({
            key: "pieTheme",
            label: "主题设置",
            children: renderConfigGrid(
              <>
                <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                  <Select
                    value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                    options={[
                      { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                      ...groupedThemeTemplateOptions,
                    ]}
                    onChange={(value) => {
                      const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                      const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                      const nextWidget = applyTemplateSelectionToWidget(
                        selectedWidget,
                        activeThemeTemplates,
                        activeDashboardThemeTemplateId,
                        value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                      );
                      updateSelectedWidget(nextWidget);
                      syncConfigForm(nextWidget);
                    }}
                  />
                </Form.Item>
                {followsDashboardTheme ? (
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    当前组件已基于基础信息里的主题模板初始化。后续修改仅作用于当前组件。
                  </div>
                ) : null}
                <Form.Item name={["chartStyle", "accentColor"]} label="主色">
                  <Input type="color" />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieBorderColor"]} label="描边颜色">
                  <Input type="color" />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieBorderWidth"]} label="描边粗细">
                  <Input type="number" min={0} max={12} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieShadowBlur"]} label="投影强度">
                  <Input type="number" min={0} max={40} />
                </Form.Item>
              </>
            ),
          });

          items.push({
            key: "pieContent",
            label: "内容设置",
            children: renderConfigGrid(
              <>
                <Form.Item name={["chartStyle", "pieShowCategory"]} label="显示分类名" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieShowValue"]} label="显示数值" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieShowPercent"]} label="显示百分比" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieValueFormat"]} label="数值格式">
                  <Select options={[{ value: "number", label: "原值" }, { value: "percent", label: "占比" }]} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieSortOrder"]} label="排序方式">
                  <Select options={[{ value: "desc", label: "按值降序" }, { value: "asc", label: "按值升序" }, { value: "none", label: "按原始顺序" }]} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieMaxSlices"]} label="最多类目">
                  <Input type="number" min={1} max={20} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieMergeOthers"]} label="合并其他" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieOthersName"]} label="其他名称">
                  <Input />
                </Form.Item>
                {supportsPieCenterContent(selectedWidget.chartStyle?.pieVariant) ? (
                  <>
                    <Form.Item name={["chartStyle", "pieShowCenter"]} label="显示中心内容" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    {selectedWidget.chartStyle?.pieShowCenter !== false ? (
                      <>
                        <Form.Item name={["chartStyle", "pieCenterTitle"]} label="中心标题">
                          <Input />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterValue"]} label="中心数值">
                          <Input placeholder="留空则自动汇总" />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterUnit"]} label="单位">
                          <Input />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterSubtitle"]} label="副文案" style={{ gridColumn: "1 / -1" }}>
                          <Input />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterTitleColor"]} label="标题颜色">
                          <Input type="color" />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterTitleFontSize"]} label="标题字号">
                          <Input type="number" min={10} max={28} />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterValueColor"]} label="数值颜色">
                          <Input type="color" />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterValueFontSize"]} label="数值字号">
                          <Input type="number" min={14} max={48} />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterUnitColor"]} label="单位颜色">
                          <Input type="color" />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterUnitFontSize"]} label="单位字号">
                          <Input type="number" min={10} max={32} />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterMetaColor"]} label="副文案颜色">
                          <Input type="color" />
                        </Form.Item>
                        <Form.Item name={["chartStyle", "pieCenterMetaFontSize"]} label="副文案字号">
                          <Input type="number" min={10} max={24} />
                        </Form.Item>
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            ),
          });

          items.push({
            key: "pieLabel",
            label: "标签设置",
            children: renderConfigGrid(
              <>
                <Form.Item name={["chartStyle", "pieLabelMode"]} label="标签位置">
                  <Select options={[{ value: "outside", label: "外部" }, { value: "inside", label: "内部" }, { value: "center", label: "中心" }, { value: "hidden", label: "隐藏" }]} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLabelColor"]} label="标签颜色">
                  <Input type="color" />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieValueColor"]} label="数值颜色">
                  <Input type="color" />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLabelFontSize"]} label="标签字号">
                  <Input type="number" min={10} max={32} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieValueFontSize"]} label="数值字号">
                  <Input type="number" min={10} max={40} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLabelLineShow"]} label="显示引导线" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLabelLineColor"]} label="引导线颜色">
                  <Input type="color" />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLabelLineWidth"]} label="引导线粗细">
                  <Input type="number" min={1} max={6} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLabelLineLength"]} label="引导线长度">
                  <Input type="number" min={0} max={40} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLabelLineLength2"]} label="引导线尾长">
                  <Input type="number" min={0} max={40} />
                </Form.Item>
              </>
            ),
          });

          items.push({
            key: "pieLegend",
            label: "图例设置",
            children: renderConfigGrid(
              <>
                <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLegendPosition"]} label="图例位置">
                  <Select options={[{ value: "top", label: "顶部" }, { value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }]} />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLegendShowValue"]} label="图例显示数值" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={["chartStyle", "pieLegendShowPercent"]} label="图例显示百分比" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            ),
          });

          items.push(containerStyleItem);
        } else {
          const family = getPrimaryChartFamily(selectedWidgetAsset);
          if (family === "bar") {
            items.push({
              key: "barStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "barSeriesLayout"]} label="柱形布局" style={{ gridColumn: "1 / -1" }}>
                    <Radio.Group
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { value: "single", label: "普通柱状图" },
                        { value: "grouped", label: "分组柱状图" },
                        { value: "stacked", label: "堆叠柱状图" },
                      ]}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -6, color: "#667085", fontSize: 12 }}>
                    风格负责外观，结构设置负责普通/分组/堆叠，以及系列重叠和分类间距。
                  </div>
                  <Form.Item
                    name={["chartStyle", "barCategoryGapPercent"]}
                    label="分类间距"
                    tooltip="对应 WPS / Excel 的分类间距能力，数值越大，同一分类下柱子与相邻分类的距离越大。"
                  >
                    <Slider min={0} max={200} step={1} tooltip={{ formatter: (value) => `${value ?? 0}` }} />
                  </Form.Item>
                  <Form.Item
                    name={["chartStyle", "barSeriesOverlap"]}
                    label="系列重叠"
                    tooltip="拖拽调节系列之间的重叠程度，负值更分开，正值更重叠。"
                  >
                    <Slider min={-100} max={100} step={1} tooltip={{ formatter: (value) => `${value ?? 0}%` }} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barBorderRadius"]} label="柱子圆角">
                    <Input type="number" min={0} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barPrimaryColor"]} label="指标一颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barSecondaryColor"]} label="指标二颜色">
                    <Input type="color" />
                  </Form.Item>
                </>
              ),
            });

            items.push(titleStyleItem);
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    风格颜色默认从主题模板初始化，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });

            items.push({
              key: "barLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barValuePosition"]} label="数值位置">
                    <Select options={[{ value: "inside", label: "柱内" }, { value: "top", label: "柱顶" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });

            items.push({
              key: "barLegend",
              label: "图例设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPrimaryName"]} label="图例一名称">
                    <Input placeholder="图例一" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendSecondaryName"]} label="图例二名称">
                    <Input placeholder="图例二" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPosition"]} label="图例位置">
                    <Select options={[{ value: "top", label: "顶部" }, { value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendTextColor"]} label="图例颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontSize"]} label="图例字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontWeight"]} label="图例字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });

            items.push({
              key: "barAxis",
              label: "坐标轴设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showXAxis"]} label="显示横坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showYAxis"]} label="显示纵坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showGridLines"]} label="显示网格线" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "xAxisUnitLabel"]} label="横轴单位名称">
                    <Input placeholder="如：年份、月份、地区" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "yAxisUnitLabel"]} label="纵轴单位名称">
                    <Input placeholder="如：人、万元、件" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelColor"]} label="坐标值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontSize"]} label="坐标值字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontWeight"]} label="坐标值字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "horizontalBar") {
            items.push({
              key: "horizontalBarStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>
                    条形图独立支持多色循环和排序，不使用柱形图的普通/分组/堆叠布局概念。
                  </div>
                  <Form.Item name={["chartStyle", "horizontalBarSortOrder"]} label="排序方式" style={{ gridColumn: "1 / -1" }}>
                    <Select options={[
                      { value: "none", label: "按原始顺序" },
                      { value: "desc-top", label: "最大值在最上面" },
                      { value: "desc-bottom", label: "最大值在最下面" },
                    ]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barBorderRadius"]} label="条形圆角">
                    <Input type="number" min={0} max={32} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "horizontalBarColors",
              label: "颜色设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "horizontalBarColorCount"]} label="颜色组数" style={{ gridColumn: "1 / -1" }}>
                    <Radio.Group
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { value: 1, label: "单色" },
                        { value: 3, label: "三色循环" },
                        { value: 5, label: "五色循环" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "horizontalBarPalette", 0]} label="颜色一">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const colorCount = Number(configForm.getFieldValue(["chartStyle", "horizontalBarColorCount"]) || 1);
                      return colorCount >= 3 ? (
                        <>
                          <Form.Item name={["chartStyle", "horizontalBarPalette", 1]} label="颜色二">
                            <Input type="color" />
                          </Form.Item>
                          <Form.Item name={["chartStyle", "horizontalBarPalette", 2]} label="颜色三">
                            <Input type="color" />
                          </Form.Item>
                          {colorCount >= 5 ? (
                            <>
                              <Form.Item name={["chartStyle", "horizontalBarPalette", 3]} label="颜色四">
                                <Input type="color" />
                              </Form.Item>
                              <Form.Item name={["chartStyle", "horizontalBarPalette", 4]} label="颜色五">
                                <Input type="color" />
                              </Form.Item>
                            </>
                          ) : null}
                        </>
                      ) : <div />;
                    }}
                  </Form.Item>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    风格颜色默认从主题模板初始化，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "horizontalBarLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barValuePosition"]} label="数值位置">
                    <Select options={[{ value: "inside", label: "条内" }, { value: "top", label: "条尾外侧" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "horizontalBarLegend",
              label: "图例设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPrimaryName"]} label="图例名称">
                    <Input placeholder="系列1" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPosition"]} label="图例位置">
                    <Select options={[{ value: "top", label: "顶部" }, { value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendTextColor"]} label="图例颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontSize"]} label="图例字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontWeight"]} label="图例字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "horizontalBarAxis",
              label: "坐标轴设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showXAxis"]} label="显示横坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showYAxis"]} label="显示纵坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showGridLines"]} label="显示网格线" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "xAxisUnitLabel"]} label="横轴单位名称">
                    <Input placeholder="如：人、万元、件" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "yAxisUnitLabel"]} label="纵轴单位名称">
                    <Input placeholder="如：地区、品类、项目" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelColor"]} label="坐标值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontSize"]} label="坐标值字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontWeight"]} label="坐标值字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "gauge") {
            items.push({
              key: "gaugeTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    模板会初始化仪表盘色带、指针、刻度和数值样式，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "gaugeStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>
                    仪表盘适合单指标进度和达成率展示，结构参数会直接影响弧线、指针和读数布局。
                  </div>
                  <Form.Item name={["chartStyle", "gaugeStartAngle"]} label="起始角度">
                    <Input type="number" min={-360} max={360} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeEndAngle"]} label="结束角度">
                    <Input type="number" min={-360} max={360} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeRadius"]} label="仪表半径">
                    <Input placeholder="90% / 120" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugePointerLength"]} label="指针长度">
                    <Input placeholder="58% / 72" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeProgressWidth"]} label="进度环宽度">
                    <Input type="number" min={4} max={40} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeAxisLineWidth"]} label="底环宽度">
                    <Input type="number" min={4} max={40} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "gaugeColors",
              label: "颜色设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "palette", 0]} label="色带一">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 1]} label="色带二">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 2]} label="色带三">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 3]} label="色带四">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 4]} label="色带五">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugePointerColor"]} label="指针颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeDetailColor"]} label="数值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeTitleColor"]} label="标题颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeAxisLabelColor"]} label="刻度文字颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeSplitLineColor"]} label="刻度线颜色">
                    <Input type="color" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "gaugeText",
              label: "文本设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "gaugeMetricName"]} label="指标名称">
                    <Input placeholder="例如：达成率" maxLength={24} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeTitleFontSize"]} label="标题字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeDetailFontSize"]} label="数值字号">
                    <Input type="number" min={12} max={48} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "gaugeDetailFontWeight"]} label="数值字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "sankey") {
            items.push({
              key: "sankeyStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>
                    桑基图使用多节点流向结构，主题模板负责初始化节点颜色、标签和连线风格，当前面板只覆盖当前组件。
                  </div>
                  <Form.Item name={["chartStyle", "sankeyNodeWidth"]} label="节点宽度">
                    <Input type="number" min={6} max={48} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "sankeyNodeGap"]} label="节点间距">
                    <Input type="number" min={4} max={48} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "sankeyLinkCurveness"]} label="连线弯曲度">
                    <Input type="number" min={0} max={1} step={0.05} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "sankeyColors",
              label: "颜色设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "palette", 0]} label="节点色一">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 1]} label="节点色二">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 2]} label="节点色三">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 3]} label="节点色四">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 4]} label="节点色五">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "sankeyNodeBorderColor"]} label="节点描边色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "sankeyNodeBorderWidth"]} label="节点描边宽度">
                    <Input type="number" min={0} max={8} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "sankeyNodeBorderRadius"]} label="节点圆角">
                    <Input type="number" min={0} max={16} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "sankeyLinkOpacity"]} label="连线透明度">
                    <Input type="number" min={0} max={1} step={0.05} />
                  </Form.Item>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    模板会初始化桑基图颜色和连线风格，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "sankeyLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "wordCloud") {
            items.push({
              key: "wordCloudStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>
                    词云图主题负责初始化色板、外形、字号区间和阴影风格，当前面板只覆盖当前组件。
                  </div>
                  <Form.Item name={["chartStyle", "wordCloudShape"]} label="词云外形" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      options={[
                        { value: "circle", label: "圆形" },
                        { value: "cardioid", label: "心形" },
                        { value: "diamond", label: "菱形" },
                        { value: "triangle-forward", label: "正向三角" },
                        { value: "triangle", label: "三角形" },
                        { value: "pentagon", label: "五边形" },
                        { value: "star", label: "星形" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "wordCloudGridSize"]} label="排布密度">
                    <Input type="number" min={4} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "wordCloudRotationStep"]} label="旋转步长">
                    <Input type="number" min={0} max={180} step={15} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "wordCloudColors",
              label: "颜色设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "palette", 0]} label="词色一">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 1]} label="词色二">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 2]} label="词色三">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 3]} label="词色四">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 4]} label="词色五">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "wordCloudTextShadowColor"]} label="文字阴影色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "wordCloudTextShadowBlur"]} label="文字阴影模糊">
                    <Input type="number" min={0} max={40} />
                  </Form.Item>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    模板会初始化词云图颜色和排布风格，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "wordCloudLabel",
              label: "文字设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "wordCloudMinFontSize"]} label="最小字号">
                    <Input type="number" min={8} max={80} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "wordCloudMaxFontSize"]} label="最大字号">
                    <Input type="number" min={8} max={120} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "wordCloudFontWeight"]} label="文字字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "funnel") {
            items.push({
              key: "funnelStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>
                    漏斗图主题负责初始化阶段色板、标签和描边风格，当前面板的调整只作用于当前组件。
                  </div>
                  <Form.Item name={["chartStyle", "funnelSortOrder"]} label="排序方式" style={{ gridColumn: "1 / -1" }}>
                    <Radio.Group
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { value: "descending", label: "从大到小" },
                        { value: "ascending", label: "从小到大" },
                        { value: "none", label: "保持原序" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelItemGap"]} label="区块间距">
                    <Input type="number" min={0} max={24} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelBlockBorderWidth"]} label="描边宽度">
                    <Input type="number" min={0} max={8} step={0.5} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "funnelColors",
              label: "颜色设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "palette", 0]} label="阶段色一">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 1]} label="阶段色二">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 2]} label="阶段色三">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 3]} label="阶段色四">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "palette", 4]} label="阶段色五">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="名称颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelValueColor"]} label="数值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelLabelLineColor"]} label="引导线颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelBlockBorderColor"]} label="描边颜色">
                    <Input type="color" />
                  </Form.Item>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    模板会初始化漏斗图阶段色带、标签和描边风格，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "funnelLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelLabelPosition"]} label="标签位置">
                    <Select options={[{ value: "outside", label: "图外" }, { value: "inside", label: "图内" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelShowName"]} label="显示名称" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "funnelShowValue"]} label="显示数值" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "line") {
            items.push({
              key: "lineStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "lineSmooth"]} label="平滑曲线" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineShowSymbol"]} label="显示节点" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineWidth"]} label="线条粗细">
                    <Input type="number" min={1} max={12} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineSymbolSize"]} label="节点大小">
                    <Input type="number" min={0} max={24} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineAreaOpacity"]} label="面积透明度">
                    <Input type="number" min={0} max={1} step={0.05} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineLabelPosition"]} label="标签位置">
                    <Select options={[
                      { value: "top", label: "顶部" },
                      { value: "bottom", label: "底部" },
                      { value: "left", label: "左侧" },
                      { value: "right", label: "右侧" },
                      { value: "inside", label: "内部" },
                    ]} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    风格颜色默认从主题模板初始化，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "lineLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "lineLegend",
              label: "图例设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPrimaryName"]} label="图例一名称">
                    <Input placeholder="图例一" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendSecondaryName"]} label="图例二名称">
                    <Input placeholder="图例二" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPosition"]} label="图例位置">
                    <Select options={[{ value: "top", label: "顶部" }, { value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendTextColor"]} label="图例颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontSize"]} label="图例字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontWeight"]} label="图例字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "lineAxis",
              label: "坐标轴设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showAxis"]} label="显示坐标轴" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showXAxis"]} label="显示横坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showYAxis"]} label="显示纵坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showGridLines"]} label="显示网格线" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "xAxisUnitLabel"]} label="横轴单位名称">
                    <Input placeholder="如：年份、月份、地区" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "yAxisUnitLabel"]} label="纵轴单位名称">
                    <Input placeholder="如：人、万元、件" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelColor"]} label="坐标值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontSize"]} label="坐标值字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontWeight"]} label="坐标值字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "combo") {
            items.push({
              key: "comboStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <div style={{ gridColumn: "1 / -1", color: "#667085", fontSize: 12 }}>
                    组合图沿用柱图和折线的核心能力，适合数量与趋势、体量与占比同屏展示。
                  </div>
                  <Form.Item name={["chartStyle", "barBorderRadius"]} label="柱体圆角">
                    <Input type="number" min={0} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineWidth"]} label="线条粗细">
                    <Input type="number" min={1} max={12} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineSmooth"]} label="平滑曲线" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineShowSymbol"]} label="显示节点" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineSymbolSize"]} label="节点大小">
                    <Input type="number" min={0} max={24} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineAreaOpacity"]} label="面积透明度">
                    <Input type="number" min={0} max={1} step={0.05} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barPrimaryColor"]} label="柱系列颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barSecondaryColor"]} label="线系列颜色">
                    <Input type="color" />
                  </Form.Item>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    模板会初始化柱线配色、极值标注色和坐标轴样式，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "comboLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "barValuePosition"]} label="柱值位置">
                    <Select options={[{ value: "inside", label: "柱内" }, { value: "top", label: "柱顶" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "lineLabelPosition"]} label="线值位置">
                    <Select options={[
                      { value: "top", label: "顶部" },
                      { value: "bottom", label: "底部" },
                      { value: "left", label: "左侧" },
                      { value: "right", label: "右侧" },
                      { value: "inside", label: "内部" },
                    ]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "comboLegend",
              label: "图例设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPrimaryName"]} label="柱系列名称">
                    <Input placeholder="例如：交易额" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendSecondaryName"]} label="线系列名称">
                    <Input placeholder="例如：转化率" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPosition"]} label="图例位置">
                    <Select options={[{ value: "top", label: "顶部" }, { value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendTextColor"]} label="图例颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontSize"]} label="图例字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontWeight"]} label="图例字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "comboAxis",
              label: "坐标轴设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showAxis"]} label="显示坐标轴" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showXAxis"]} label="显示横坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showYAxis"]} label="显示纵坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showGridLines"]} label="显示网格线" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "xAxisUnitLabel"]} label="横轴单位名称">
                    <Input placeholder="如：月份、地区、渠道" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "yAxisUnitLabel"]} label="纵轴单位名称">
                    <Input placeholder="如：万元、件、百分比" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelColor"]} label="坐标值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontSize"]} label="坐标值字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontWeight"]} label="坐标值字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "scatterBubble") {
            items.push({
              key: "scatterStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "scatterSymbolSize"]} label="气泡大小">
                    <Input type="number" min={4} max={48} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "scatterPointOpacity"]} label="气泡透明度">
                    <Input type="number" min={0} max={1} step={0.05} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "scatterPointBorderWidth"]} label="描边宽度">
                    <Input type="number" min={0} max={8} step={0.5} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "scatterPointBorderColor"]} label="描边颜色">
                    <Input type="color" />
                  </Form.Item>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    模板会初始化散点颜色、坐标轴和描边风格，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "scatterLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "scatterLabelPosition"]} label="标签位置">
                    <Select options={[
                      { value: "top", label: "顶部" },
                      { value: "bottom", label: "底部" },
                      { value: "left", label: "左侧" },
                      { value: "right", label: "右侧" },
                      { value: "inside", label: "内部" },
                    ]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "scatterLegend",
              label: "图例设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPrimaryName"]} label="图例名称">
                    <Input placeholder="例如：客单价 vs 复购率" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPosition"]} label="图例位置">
                    <Select options={[{ value: "top", label: "顶部" }, { value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendTextColor"]} label="图例颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontSize"]} label="图例字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontWeight"]} label="图例字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "scatterAxis",
              label: "坐标轴设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showAxis"]} label="显示坐标轴" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showXAxis"]} label="显示横坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showYAxis"]} label="显示纵坐标" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showGridLines"]} label="显示网格线" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "xAxisUnitLabel"]} label="横轴单位名称">
                    <Input placeholder="如：客单价、转化率、时长" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "yAxisUnitLabel"]} label="纵轴单位名称">
                    <Input placeholder="如：复购率、金额、次数" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelColor"]} label="坐标值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontSize"]} label="坐标值字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "axisLabelFontWeight"]} label="坐标值字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "radar") {
            items.push({
              key: "radarStructure",
              label: "结构设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "radarLayout"]} label="雷达图布局" style={{ gridColumn: "1 / -1" }}>
                    <Radio.Group
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { value: "single", label: "单维度" },
                        { value: "dual", label: "双维度" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarShape"]} label="雷达形状">
                    <Select options={[{ value: "polygon", label: "多边形" }, { value: "circle", label: "圆形" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarRadius"]} label="雷达半径">
                    <Input placeholder="如：70% / 180" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarCenterX"]} label="中心横坐标">
                    <Input placeholder="如：50%" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarCenterY"]} label="中心纵坐标">
                    <Input placeholder="如：52%" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarSplitNumber"]} label="分割层数">
                    <Input type="number" min={2} max={10} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarShowSplitArea"]} label="显示分割区域" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "radarColors",
              label: "颜色设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "radarGridLineColor"]} label="网格线颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarIndicatorTextColor"]} label="指标文字颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarPointColor"]} label="节点颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarPrimaryColor"]} label="指标一颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarSecondaryColor"]} label="指标二颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "radarAreaOpacity"]} label="填充透明度">
                    <Input type="number" min={0} max={1} step={0.05} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    风格颜色默认从主题模板初始化，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push({
              key: "radarLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "radarLegend",
              label: "图例设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPrimaryName"]} label="图例一名称">
                    <Input placeholder="图例一" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendSecondaryName"]} label="图例二名称">
                    <Input placeholder="图例二" maxLength={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendPosition"]} label="图例位置">
                    <Select options={[{ value: "top", label: "顶部" }, { value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }]} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendTextColor"]} label="图例颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontSize"]} label="图例字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "legendFontWeight"]} label="图例字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else if (family === "map") {
            items.push({
              key: "mapTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="主题模板" style={{ gridColumn: "1 / -1" }}>
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    模板会初始化地图渐进色带、边界和视觉映射文字，后续修改仅作用于当前组件。
                  </div>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push({
              key: "mapColors",
              label: "颜色设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "mapRegionPalette", 0]} label="低值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "mapRegionPalette", 1]} label="次低颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "mapRegionPalette", 2]} label="中值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "mapRegionPalette", 3]} label="次高颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "mapRegionPalette", 4]} label="高值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "mapRegionBorderColor"]} label="区域边界颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "mapLabelColor"]} label="区域文字颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "mapVisualMapTextColor"]} label="视觉映射文字">
                    <Input type="color" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "mapLabel",
              label: "标签设置",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示区域名" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" min={10} max={32} />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" min={300} max={900} step={100} />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "mapRange",
              label: "地图范围",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["mapStyle", "provinceCode"]} label="下钻范围" style={{ gridColumn: "1 / -1" }}>
                    <Select options={CHINA_PROVINCE_OPTIONS} allowClear placeholder="全国 / 指定省份" />
                  </Form.Item>
                  <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                    在地图上拖拽是漫游，移动组件请从标题区或组件边框拖动。
                  </div>
                </>
              ),
            });
            items.push(containerStyleItem);
          } else {
            items.push({
              key: "chartTheme",
              label: "主题设置",
              children: renderConfigGrid(
                <>
                  <Form.Item label="风格操作">
                    <Button
                      block
                      onClick={() => {
                        if (!family) {
                          message.warning("当前图表暂未识别到可切换的风格分类");
                          return;
                        }
                        openStylePicker(family, "replace");
                      }}
                    >
                      {`切换：${selectedWidget.variantName || selectedWidgetAsset?.chartName || "选择具体风格"}`}
                    </Button>
                  </Form.Item>
                  <Form.Item label="主题模板">
                    <Select
                      value={followsDashboardTheme ? "__dashboard__" : (selectedWidget.widgetThemeTemplateId || undefined)}
                      options={[
                        { value: "__dashboard__", label: `跟随基础设置${dashboardThemeTemplateName ? `（${dashboardThemeTemplateName}）` : ""}` },
                        ...groupedThemeTemplateOptions,
                      ]}
                      onChange={(value) => {
                        const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
                        const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
                        const nextWidget = applyTemplateSelectionToWidget(
                          selectedWidget,
                          activeThemeTemplates,
                          activeDashboardThemeTemplateId,
                          value === "__dashboard__" ? "__dashboard__" : (value ? Number(value) : null)
                        );
                        updateSelectedWidget(nextWidget);
                        syncConfigForm(nextWidget);
                      }}
                    />
                  </Form.Item>
                  {followsDashboardTheme ? (
                    <div style={{ gridColumn: "1 / -1", marginTop: -8, color: "#667085", fontSize: 12 }}>
                      当前组件已基于基础信息里的主题模板初始化。后续修改仅作用于当前组件。
                    </div>
                  ) : null}
                  <Form.Item name={["chartStyle", "accentColor"]} label="主色调整">
                    <Input type="color" />
                  </Form.Item>
                </>
              ),
            });
            items.push({
              key: "chartStyle",
              label: "图表样式",
              children: renderConfigGrid(
                <>
                  <Form.Item name={["chartStyle", "showLegend"]} label="显示图例" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showAxis"]} label="显示坐标轴" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "showLabels"]} label="显示标签" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelColor"]} label="标签颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontSize"]} label="标签字号">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "dataLabelFontWeight"]} label="标签字重">
                    <Input type="number" />
                  </Form.Item>
                </>
              ),
            });
            items.push(titleStyleItem);
            items.push(containerStyleItem);
          }
        }

      }

      if (selectedWidget.widgetType === "kpi") {
        const kpiStyleItems = renderKpiStyleSections(
          selectedWidget,
          updateSelectedWidget,
          (selection) => {
            const activeThemeTemplates = themeTemplatesRef.current.length ? themeTemplatesRef.current : themeTemplates;
            const activeDashboardThemeTemplateId = getCurrentDashboardThemeTemplateId();
            const nextWidget = applyTemplateSelectionToWidget(
              selectedWidget,
              activeThemeTemplates,
              activeDashboardThemeTemplateId,
              selection
            );
            updateSelectedWidget(nextWidget);
            syncConfigForm(nextWidget);
          },
          configForm,
          groupedThemeTemplateOptions,
          getCurrentDashboardThemeTemplateId(),
          dashboardThemeTemplateName
        );
        if (kpiStyleItems.length > 0) {
          items.push(kpiStyleItems[1]);
          items.push(titleStyleItem);
          items.push(kpiStyleItems[0]);
          items.push(...kpiStyleItems.slice(2));
        }
        items.push(containerStyleItem);
      }

      if (selectedWidget.widgetType === "table") {
        items.push({
          key: "tableStyle",
          label: "子表样式",
          children: renderConfigGrid(
            <>
              <Form.Item name={["tableStyle", "showIndex"]} label="显示序号" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name={["tableStyle", "compact"]} label="紧凑表格" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name={["tableStyle", "striped"]} label="斑马纹" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name={["tableStyle", "headerBackground"]} label="表头背景">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tableStyle", "headerTextColor"]} label="表头文字">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tableStyle", "rowBackground"]} label="行背景">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tableStyle", "rowAlternateBackground"]} label="隔行背景">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tableStyle", "rowBorderColor"]} label="行边框">
                <Input type="color" />
              </Form.Item>
            </>
          ),
        });
      }

      if (selectedWidget.widgetType === "tabs") {
        items.push({
          key: "tabsStyle",
          label: "页签样式",
          children: renderConfigGrid(
            <>
              <Form.Item name={["tabsStyle", "tabBarBackgroundColor"]} label="页签栏背景">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tabsStyle", "activeTextColor"]} label="激活文字色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tabsStyle", "inactiveTextColor"]} label="未激活文字色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tabsStyle", "activeBackground"]} label="激活背景">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["tabsStyle", "indicatorColor"]} label="指示器颜色">
                <Input type="color" />
              </Form.Item>
            </>
          ),
        });
      }

      if (selectedWidget.widgetType === "richText") {
        items.push({
          key: "richTextStyle",
          label: "富文本样式",
          children: renderConfigGrid(
            <>
              <Form.Item name={["richTextStyle", "fontSize"]} label="字号">
                <Input type="number" />
              </Form.Item>
              <Form.Item name={["richTextStyle", "fontWeight"]} label="字重">
                <Input type="number" />
              </Form.Item>
              <Form.Item name={["richTextStyle", "color"]} label="文字颜色">
                <Input type="color" />
              </Form.Item>
              <Form.Item name={["richTextStyle", "align"]} label="对齐方式">
                <Select options={[{ value: "left", label: "左对齐" }, { value: "center", label: "居中" }, { value: "right", label: "右对齐" }]} />
              </Form.Item>
            </>
          ),
        });
      }

      if (selectedWidget.widgetType === "image") {
        items.push({
          key: "imageStyle",
          label: "图片样式",
          children: renderConfigGrid(
            <>
              <Form.Item name={["imageStyle", "objectFit"]} label="填充方式">
                <Select options={[{ value: "contain", label: "完整显示" }, { value: "cover", label: "裁切铺满" }, { value: "fill", label: "拉伸填满" }]} />
              </Form.Item>
              <Form.Item name={["imageStyle", "borderRadius"]} label="图片圆角">
                <Input type="number" min={0} />
              </Form.Item>
            </>
          ),
        });
      }
    }

    if (configTab === "data") {
      items.push({
        key: "binding",
        label: "数据绑定",
        children: (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item name="bindingMode" label="绑定方式" rules={[{ required: true, message: "请选择绑定方式" }]} style={{ gridColumn: "1 / -1", marginBottom: 8 }}>
              <Radio.Group options={[{ value: "dataset", label: "选择数据集" }, { value: "sql", label: "数据源 + SQL" }]} />
            </Form.Item>

            {selectedWidget.bindingMode === "dataset" ? (
              <Form.Item name="datasetId" label="数据集" rules={[{ required: true, message: "请选择数据集" }]} style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
                <Select options={datasetOptions} showSearch optionFilterProp="label" />
              </Form.Item>
            ) : (
              <>
                <Form.Item name="sourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]} style={{ marginBottom: 0 }}>
                  <Select options={dataSourceOptions} showSearch optionFilterProp="label" />
                </Form.Item>
                <Form.Item name="sourceTable" label="表名称" style={{ marginBottom: 0 }}>
                  <Select allowClear options={sourceTables.map((item) => ({ label: item.tableName, value: item.tableName }))} />
                </Form.Item>
                <Form.Item name="sourceSql" label="自定义查询 SQL" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
                  <Input.TextArea rows={5} placeholder="不填写 SQL 则预览整张表；填写 SQL 则预览 SQL 结果字段" />
                </Form.Item>
              </>
            )}
          </div>
        ),
      });

      items.push({
        key: "mapping",
        label: "字段映射",
        children: (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {(getWidgetMappingFields(selectedWidget, chartAssets.find((item) => item.id === selectedWidget.chartAssetId)) || []).map((fieldConfig) => (
              <div key={fieldConfig.key}>
                <Typography.Text type="secondary" style={{ display: "block", marginBottom: 6 }}>
                  {fieldConfig.label || fieldConfig.key}
                </Typography.Text>
                <Select
                  allowClear
                  value={selectedWidget.fieldMap?.[fieldConfig.key] || undefined}
                  placeholder="字段名称会根据数据集或 SQL 结果自动预加载"
                  options={getFieldOptions(selectedWidget, datasets)}
                  onChange={(value) => updateSelectedWidget({
                    fieldMap: {
                      ...(selectedWidget.fieldMap || {}),
                      [fieldConfig.key]: value || "",
                    },
                    preview: null,
                  })}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
            ))}
          </div>
        ),
      });

      if (selectedWidget.widgetType === "table") {
        items.push({
          key: "table",
          label: "子表配置",
          children: renderConfigGrid(
            <>
              <Form.Item name={["table", "pageSize"]} label="每页行数">
                <Input type="number" />
              </Form.Item>
            </>
          ),
        });
      }

      if (selectedWidget.widgetType === "tabs") {
        items.push({
          key: "tabs",
          label: "窗口切换配置",
          children: (
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              {(selectedWidget.tabs?.items || []).map((tab, index) => (
                <Card key={tab.key} size="small" title={`窗口 ${index + 1}`}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <Form.Item label="窗口标题" style={{ marginBottom: 0 }}>
                      <Input
                        value={tab.title}
                        onChange={(event) => updateSelectedWidget({
                          tabs: {
                            ...(selectedWidget.tabs || buildDefaultTabsConfig()),
                            items: (selectedWidget.tabs?.items || []).map((item) => item.key === tab.key ? { ...item, title: event.target.value } : item),
                          },
                        })}
                      />
                    </Form.Item>
                    <Form.Item label="窗口类型" style={{ marginBottom: 0 }}>
                      <Input value={widgets.find((item) => item.key === tab.childWidgetKey)?.widgetName || "空窗口"} disabled />
                    </Form.Item>
                    <Form.Item label="窗口操作" style={{ marginBottom: 0 }}>
                      <Space>
                        <Button
                          onClick={() => {
                            const childWidgetKey = tab.childWidgetKey;
                            setWidgets((current) => current.map((item) => {
                              if (item.key === selectedWidget.key) {
                                return {
                                  ...item,
                                  tabs: {
                                    ...(selectedWidget.tabs || buildDefaultTabsConfig()),
                                    items: (selectedWidget.tabs?.items || []).filter((entry) => entry.key !== tab.key),
                                    defaultActiveKey: (selectedWidget.tabs?.items || []).find((entry) => entry.key !== tab.key)?.key || null,
                                  },
                                };
                              }
                              if (item.key === childWidgetKey) {
                                const snap = getLayoutSnap(basicForm.getFieldValue("layoutMode"));
                                return {
                                  ...item,
                                  containerParentKey: null,
                                  containerTabKey: null,
                                  position: resolveWidgetPlacement(item.key, buildDefaultWidgetPosition(current.length), current, widgetMinGap, snap, canvasMetrics.width, canvasMetrics.height),
                                };
                              }
                              return item;
                            }));
                          }}
                        >
                          拖出
                        </Button>
                        <Button
                          danger
                          onClick={() => {
                            const childWidgetKey = tab.childWidgetKey;
                            setWidgets((current) => current.filter((item) => item.key !== childWidgetKey).map((item) => item.key === selectedWidget.key ? {
                              ...item,
                              tabs: {
                                ...(selectedWidget.tabs || buildDefaultTabsConfig()),
                                items: (selectedWidget.tabs?.items || []).filter((entry) => entry.key !== tab.key),
                                defaultActiveKey: (selectedWidget.tabs?.items || []).find((entry) => entry.key !== tab.key)?.key || null,
                              },
                            } : item));
                          }}
                        >
                          删除页签
                        </Button>
                      </Space>
                    </Form.Item>
                  </div>
                </Card>
              ))}
              <Button
                onClick={() => updateSelectedWidget({
                  tabs: {
                    ...(selectedWidget.tabs || buildDefaultTabsConfig()),
                    items: [
                      ...((selectedWidget.tabs?.items || [])),
                      {
                        key: `tab_${Date.now()}`,
                        title: `窗口${(selectedWidget.tabs?.items?.length || 0) + 1}`,
                        childWidgetKey: null,
                      },
                    ],
                  },
                })}
              >
                新增窗口
              </Button>
            </Space>
          ),
        });
      }

      if (selectedWidget.widgetType === "richText") {
        items.push({
          key: "richText",
          label: "富文本配置",
          children: renderConfigGrid(
            <>
              <Form.Item name={["richText", "content"]} label="文本内容" style={{ gridColumn: "1 / -1" }}>
                <Input.TextArea rows={6} />
              </Form.Item>
            </>
          ),
        });
      }

      if (selectedWidget.widgetType === "image") {
        items.push({
          key: "image",
          label: "图片配置",
          children: (
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Form.Item name={["image", "imageUrl"]} label="图片地址" style={{ marginBottom: 0 }}>
                <Input placeholder="支持粘贴 URL 或通过下方上传载入" />
              </Form.Item>
              <Upload
                showUploadList={false}
                accept="image/*"
                beforeUpload={async (file) => {
                  try {
                    const imageUrl = await readLocalImageAsDataUrl(file);
                    updateSelectedWidget({
                      image: {
                        ...(selectedWidget.image || buildDefaultImageConfig()),
                        imageUrl,
                      },
                    });
                    configForm.setFieldValue(["image", "imageUrl"], imageUrl);
                    message.success("图片已载入");
                  } catch (error: any) {
                    message.error(error.message || "图片读取失败");
                  }
                  return false;
                }}
              >
                <Button>上传图片</Button>
              </Upload>
            </Space>
          ),
        });
      }
    }

    if (configTab === "analysis") {
      if (selectedWidget.widgetType === "chart") {
        const analysisFamily = getPrimaryChartFamily(selectedWidgetAsset);
        items.push({
          key: "chartAnalysis",
          label: "图表分析",
          children: renderConfigGrid(
            <>
              <Form.Item name={["chartAnalysis", "showExtrema"]} label="显示极值" valuePropName="checked">
                <Switch />
              </Form.Item>
              {analysisFamily === "combo" ? (
                <>
                  <Form.Item name={["chartStyle", "extremaMaxColor"]} label="最大值颜色">
                    <Input type="color" />
                  </Form.Item>
                  <Form.Item name={["chartStyle", "extremaMinColor"]} label="最小值颜色">
                    <Input type="color" />
                  </Form.Item>
                </>
              ) : null}
            </>
          ),
        });
      }

      if (selectedWidget.widgetType === "kpi") {
        items.push({
          key: "kpiAnalysis",
          label: "KPI 分析",
          children: renderConfigGrid(
            <Form.Item name={["kpiAnalysis", "showTrend"]} label="显示趋势" valuePropName="checked">
              <Switch />
            </Form.Item>
          ),
        });
      }
    }

    return items;
  }, [
    chartAssets,
    configTab,
    dataSourceOptions,
    datasetOptions,
    datasets,
    selectedWidget,
    selectedWidgetAsset,
    sourceTables,
  ]);

  return (
    <div className="app-page">
      <div className="app-page-body">
        <PageToolbar
          left={(
            <Space>
              <Button icon={<RollbackOutlined />} onClick={() => navigate("/dashboard/reporting/workbench")}>返回清单</Button>
              <Button icon={<ReloadOutlined />} onClick={() => void loadBaseData()} loading={loading}>刷新</Button>
              <Button icon={<BarChartOutlined />} onClick={() => setLibraryOpen((current) => !current)}>
                {libraryOpen ? "关闭指标库" : "打开指标库"}
              </Button>
              <Button icon={<RobotOutlined />} onClick={openAiAssistant}>AI 生成图表</Button>
              <Button icon={<SettingOutlined />} onClick={() => setBasicInfoOpen(true)}>基本信息配置</Button>
              <Button
                icon={<EyeOutlined />}
                disabled={!dashboardId}
                onClick={() => {
                  if (!dashboardId) return;
                  const runtimeToken = token ? `?runtimeToken=${encodeURIComponent(token)}` : "";
                  window.open(`/reporting/runtime/${dashboardId}${runtimeToken}`, "_blank", "noopener,noreferrer");
                }}
              >
                报表预览
              </Button>
              <Select
                value={dashboardThemeTemplateId ?? undefined}
                style={{ width: 260 }}
                options={groupedThemeTemplateOptions}
                placeholder="当前主题模板"
                showSearch
                optionFilterProp="label"
                onChange={(value) => applyDashboardThemeTemplateChange(readNumericId(value), { syncFormField: true })}
              />
            </Space>
          )}
          right={(
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => void handleSaveDashboard()} loading={saving}>保存</Button>
            </Space>
          )}
        />

        <div style={{ display: "block" }}>
          <Card
            size="small"
            styles={{ body: { paddingTop: 12 } }}
            style={{ minHeight: "calc(100vh - 176px)" }}
          >
            <div
              ref={canvasViewportRef}
              style={{
                position: "relative",
                minHeight: Math.max(canvasMetrics.height * canvasScale, 720),
                overflow: "auto",
              }}
            >
                <div
                  style={{
                    width: canvasMetrics.width * canvasScale,
                    height: canvasMetrics.height * canvasScale,
                  }}
                >
                <div
                  ref={canvasRef}
                  onClick={(event) => {
                    if (event.target !== event.currentTarget) return;
                    setSelectedWidgetKey(null);
                    setConfigOpen(false);
                    setLibraryOpen(false);
                  }}
                  style={{
                    position: "relative",
                    width: canvasMetrics.width,
                    minHeight: canvasMetrics.height,
                    transformOrigin: "top left",
                    transform: `scale(${canvasScale})`,
                    borderRadius: 18,
                    border: "1px dashed #d0d8e8",
                    background: resolveCanvasBackgroundStyle(canvasConfig),
                    overflow: "hidden",
                  }}
                >
              {isGridLayoutMode ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: GRID_BACKGROUND,
                    backgroundSize: `${GRID_LAYOUT_SNAP}px ${GRID_LAYOUT_SNAP}px`,
                    pointerEvents: "none",
                  }}
                />
              ) : null}
              {libraryOpen ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: LIBRARY_PANEL_WIDTH,
                    zIndex: 10,
                    background: "rgba(247,249,252,0.96)",
                    border: "1px solid #dce6f5",
                    borderRadius: 18,
                    boxShadow: "0 12px 32px rgba(15,23,42,0.10)",
                    overflow: "hidden",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #e6ebf2", background: "rgba(255,255,255,0.82)" }}>
                    <Space>
                      <AppstoreOutlined style={{ color: "#1677ff" }} />
                      <Typography.Text strong>指标库</Typography.Text>
                    </Space>
                    <Button type="text" size="small" onClick={() => setLibraryOpen(false)}>关闭</Button>
                  </div>
                  <div style={{ height: "calc(100% - 54px)", overflow: "auto", padding: 12 }}>
                    <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                      图表与组件统一从这里拖入画布。
                    </Typography.Text>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                      {COMPONENT_LIBRARY.map((item) => (
                        <div
                          key={item.key}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            const payload: LibraryDragPayload = { kind: "component", componentType: item.key };
                            setPendingDragPayload(payload);
                            setActiveDragPayload({ kind: "library", payload });
                            setPointerPosition({ x: event.clientX, y: event.clientY });
                            libraryDragStartRef.current = { x: event.clientX, y: event.clientY };
                          }}
                          style={{
                            border: "1px solid #d6deea",
                            borderRadius: 16,
                            padding: "14px 12px",
                            background: "#fff",
                            cursor: "grab",
                            textAlign: "left",
                            minHeight: 104,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
                          }}
                        >
                          <span style={{ width: 34, height: 34, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#eef5ff", color: "#1677ff", fontSize: 16 }}>
                            {item.key === "kpi" ? <DashboardOutlined /> : item.key === "table" ? <AppstoreOutlined /> : <BarChartOutlined />}
                          </span>
                          <div>
                            <Typography.Text strong style={{ display: "block" }}>{item.label}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Typography.Text>
                          </div>
                        </div>
                      ))}
                      {libraryFamilies.map((family) => (
                        <button
                          key={family.key}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            const firstAsset = chartAssets.find((asset) => asset.status !== "inactive" && getPrimaryChartFamily(asset) === family.key);
                            if (!firstAsset) return;
                            const payload: LibraryDragPayload = { kind: "asset", assetId: firstAsset.id };
                            setPendingDragPayload(payload);
                            setActiveDragPayload({ kind: "library", payload });
                            setPointerPosition({ x: event.clientX, y: event.clientY });
                            libraryDragStartRef.current = { x: event.clientX, y: event.clientY };
                          }}
                          style={{
                            border: "1px solid #d6deea",
                            borderRadius: 16,
                            padding: "14px 12px",
                            background: "#fff",
                            cursor: "grab",
                            textAlign: "left",
                            minHeight: 104,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
                          }}
                        >
                          <span style={{ width: 34, height: 34, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#eef5ff", color: "#1677ff", fontSize: 16 }}>
                            {getPrimaryFamilyIcon(family.key)}
                          </span>
                          <div>
                            <Typography.Text strong style={{ display: "block" }}>{family.label}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {family.assets.length} 种风格
                            </Typography.Text>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {configOpen && selectedWidget ? createPortal(
                <div
                  style={{
                    position: "fixed",
                    right: 0,
                    top: configPanelTop ?? canvasTopOffset,
                    width: CONFIG_PANEL_WIDTH,
                    height: `calc(100vh - ${(configPanelTop ?? canvasTopOffset)}px)`,
                    zIndex: 10,
                    background: "rgba(255,255,255,0.96)",
                    border: "1px solid #dce6f5",
                    borderRadius: "18px 0 0 18px",
                    boxShadow: "0 12px 32px rgba(15,23,42,0.10)",
                    overflow: "hidden",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setPanelDragState({
                        startX: event.clientX,
                        startY: event.clientY,
                        initialRight: 0,
                        initialTop: configPanelTop ?? canvasTopOffset,
                      });
                    }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #e6ebf2", background: "rgba(255,255,255,0.82)", cursor: "move" }}
                  >
                    <Space>
                      <SettingOutlined style={{ color: "#1677ff" }} />
                      <Typography.Text strong>图表配置</Typography.Text>
                    </Space>
                    <Button type="text" size="small" onClick={() => setConfigOpen(false)}>收起</Button>
                  </div>
                  <Tabs
                    activeKey={configTab}
                    onChange={(key) => setConfigTab(key as "data" | "style" | "analysis")}
                    items={[
                      { key: "data", label: "数据" },
                      { key: "style", label: "样式" },
                      { key: "analysis", label: "分析" },
                    ]}
                    style={{ padding: "0 16px", borderBottom: "1px solid #e6ebf2" }}
                  />
                  <div style={{ height: "calc(100% - 54px)", overflow: "auto", padding: 16 }}>
                    <Space direction="vertical" size={16} style={{ display: "flex" }}>
                      <Form
                        form={configForm}
                        layout="vertical"
                        initialValues={{
                          widgetName: selectedWidget.widgetName,
                          variantName: selectedWidget.variantName,
                          accentColor: selectedWidget.accentColor,
                          palettePreset: selectedWidget.palettePreset,
                          bindingMode: selectedWidget.bindingMode,
                          datasetId: selectedWidget.datasetId,
                          sourceId: selectedWidget.sourceId,
                          sourceTable: selectedWidget.sourceTable,
                          sourceSql: selectedWidget.sourceSql,
                        }}
                        onValuesChange={(changedValues) => {
                          if ("widgetName" in changedValues) updateSelectedWidget({ widgetName: changedValues.widgetName });
                          if ("widgetType" in changedValues) updateSelectedWidget({ widgetType: changedValues.widgetType, preview: null });
                          if ("bindingMode" in changedValues) updateSelectedWidget({ bindingMode: changedValues.bindingMode, datasetId: changedValues.bindingMode === "dataset" ? datasets[0]?.id || null : null, sourceId: null, sourceTable: null, sourceSql: null, preview: null, fields: [], fieldMap: {} });
                          if ("datasetId" in changedValues) updateSelectedWidget({ datasetId: changedValues.datasetId, preview: null, fields: [], fieldMap: {} });
                          if ("sourceId" in changedValues) updateSelectedWidget({ sourceId: changedValues.sourceId, sourceTable: null, sourceSql: "", preview: null, fields: [], fieldMap: {} });
                          if ("sourceTable" in changedValues) updateSelectedWidget({ sourceTable: changedValues.sourceTable, preview: null, fields: [], fieldMap: {} });
                          if ("sourceSql" in changedValues) updateSelectedWidget({ sourceSql: changedValues.sourceSql, preview: null, fields: [], fieldMap: {} });
                          if ("accentColor" in changedValues) updateSelectedWidget({ accentColor: changedValues.accentColor });
                          if ("palettePreset" in changedValues) updateSelectedWidget({ palettePreset: changedValues.palettePreset });
                          if ("chrome" in changedValues) {
                            const nextChrome = buildChromeStyleFromForm({ ...(selectedWidget.chrome || buildDefaultChrome(selectedWidget.widgetName)), ...(changedValues.chrome || {}) });
                            updateSelectedWidget({ chrome: nextChrome });
                          }
                          if ("kpi" in changedValues && "mode" in (changedValues.kpi || {})) {
                            const currentThemeKey = selectedWidget.chrome?.themeKey;
                            if (currentThemeKey) {
                              const nextTheme = applyKpiThemeTemplate(
                                String(currentThemeKey),
                                selectedWidget.chrome?.titleText || selectedWidget.widgetName,
                                changedValues.kpi?.mode,
                                selectedWidget.kpiStyle,
                                selectedWidget.chrome
                              );
                              updateSelectedWidget({
                                kpi: { ...(selectedWidget.kpi || buildDefaultKpiConfig()), ...(changedValues.kpi || {}) },
                                chrome: nextTheme.chrome,
                                kpiStyle: { ...(selectedWidget.kpiStyle || buildDefaultKpiStyleConfig()), ...nextTheme.kpiStyle },
                              });
                              configForm.setFieldValue(["chrome"], nextTheme.chrome);
                              configForm.setFieldValue(["kpiStyle"], { ...(selectedWidget.kpiStyle || buildDefaultKpiStyleConfig()), ...nextTheme.kpiStyle });
                              return;
                            }
                          }
                          if ("chartStyle" in changedValues && changedValues.chartStyle?.pieVariant) {
                            const nextChartStyle = applyPieVariantConstraints(
                              applyPieVariantPreset(
                                {
                                  ...(selectedWidget.chartStyle || buildDefaultChartStyleConfig()),
                                  ...(changedValues.chartStyle || {}),
                                },
                                changedValues.chartStyle.pieVariant as WidgetChartStyleConfig["pieVariant"]
                              )
                            );
                            const nextWidget = { ...selectedWidget, chartStyle: nextChartStyle } as CanvasWidgetDraft;
                            updateSelectedWidget({ chartStyle: nextChartStyle });
                            configForm.setFieldValue(["chartStyle"], nextChartStyle);
                            window.setTimeout(() => {
                              void handlePreviewWidget(nextWidget, true);
                            }, 0);
                            return;
                          }
                          if ("chartStyle" in changedValues) {
                            const fullChartStyle = configForm.getFieldValue(["chartStyle"]) || {};
                            const nextChartStyle = applyPieVariantConstraints({
                              ...(selectedWidget.chartStyle || buildDefaultChartStyleConfig()),
                              ...fullChartStyle,
                            });
                            const nextWidget = { ...selectedWidget, chartStyle: nextChartStyle } as CanvasWidgetDraft;
                            updateSelectedWidget({ chartStyle: nextChartStyle });
                            if (shouldInstantPreviewPieChange(changedValues)) {
                              window.setTimeout(() => {
                                void handlePreviewWidget(nextWidget, true);
                              }, 0);
                            }
                            if (shouldInstantPreviewBarChange(changedValues)) {
                              window.setTimeout(() => {
                                void handlePreviewWidget(nextWidget, true);
                              }, 0);
                            }
                          }
                          if ("mapStyle" in changedValues) updateSelectedWidget({ mapStyle: { ...(selectedWidget.mapStyle || buildDefaultMapStyleConfig()), ...(changedValues.mapStyle || {}) } });
                          if ("chartAnalysis" in changedValues) updateSelectedWidget({ chartAnalysis: { ...(selectedWidget.chartAnalysis || buildDefaultChartAnalysisConfig()), ...(changedValues.chartAnalysis || {}) } });
                          if ("kpi" in changedValues) {
                            const nextKpi = { ...(selectedWidget.kpi || buildDefaultKpiConfig()), ...(changedValues.kpi || {}) };
                            const nextWidget = { ...selectedWidget, kpi: nextKpi } as CanvasWidgetDraft;
                            updateSelectedWidget({ kpi: nextKpi });
                            if (shouldInstantPreviewKpiDataChange(changedValues)) {
                              window.setTimeout(() => {
                                void handlePreviewWidget(nextWidget, true);
                              }, 0);
                            }
                          }
                          if ("kpiStyle" in changedValues) {
                            const nextKpiStyle = { ...(selectedWidget.kpiStyle || buildDefaultKpiStyleConfig()), ...(changedValues.kpiStyle || {}) } as WidgetKpiStyleConfig;
                            nextKpiStyle.flipperBackground = buildFlipperBackgroundFromStyle(nextKpiStyle);
                            const nextWidget = { ...selectedWidget, kpiStyle: nextKpiStyle } as CanvasWidgetDraft;
                            updateSelectedWidget({ kpiStyle: nextKpiStyle });
                            if (shouldInstantPreviewFlipperChange(changedValues)) {
                              window.setTimeout(() => {
                                void handlePreviewWidget(nextWidget, true);
                              }, 0);
                            }
                          }
                          if ("kpiAnalysis" in changedValues) updateSelectedWidget({ kpiAnalysis: { ...(selectedWidget.kpiAnalysis || buildDefaultKpiAnalysisConfig()), ...(changedValues.kpiAnalysis || {}) } });
                          if ("table" in changedValues) updateSelectedWidget({ table: { ...(selectedWidget.table || buildDefaultTableConfig()), ...(changedValues.table || {}) } });
                          if ("tableStyle" in changedValues) updateSelectedWidget({ tableStyle: { ...(selectedWidget.tableStyle || buildDefaultTableStyleConfig()), ...(changedValues.tableStyle || {}) } });
                          if ("tabsStyle" in changedValues) updateSelectedWidget({ tabsStyle: { ...(selectedWidget.tabsStyle || buildDefaultTabsStyleConfig()), ...(changedValues.tabsStyle || {}) } });
                          if ("richText" in changedValues) updateSelectedWidget({ richText: { ...(selectedWidget.richText || buildDefaultRichTextConfig()), ...(changedValues.richText || {}) } });
                          if ("richTextStyle" in changedValues) updateSelectedWidget({ richTextStyle: { ...(selectedWidget.richTextStyle || buildDefaultRichTextStyleConfig()), ...(changedValues.richTextStyle || {}) } });
                          if ("image" in changedValues) updateSelectedWidget({ image: { ...(selectedWidget.image || buildDefaultImageConfig()), ...(changedValues.image || {}) } });
                          if ("imageStyle" in changedValues) updateSelectedWidget({ imageStyle: { ...(selectedWidget.imageStyle || buildDefaultImageStyleConfig()), ...(changedValues.imageStyle || {}) } });
                        }}
                      >
                        <Collapse
                          defaultActiveKey={configTab === "data" ? ["binding", "mapping"] : configTab === "style" ? ["theme", "basic", "title", "background", "value", "chart", "padding"] : ["analysis"]}
                          items={configPanelItems}
                        />
                      </Form>

                      <Space>
                        <Button type="primary" loading={previewLoading} onClick={() => void handlePreviewSelectedWidget()}>预览图表</Button>
                      </Space>

                      {selectedWidget.preview?.sampleRows ? (
                        <Card size="small" title="数据预览">
                          <Table
                            size="small"
                            rowKey={(_, index) => `${selectedWidget.key}_${index}`}
                            dataSource={selectedWidget.preview.sampleRows}
                            columns={previewColumns}
                            pagination={false}
                            scroll={{ x: "max-content", y: 240 }}
                            locale={{ emptyText: "当前没有可预览的数据" }}
                          />
                        </Card>
                      ) : null}
                    </Space>
                  </div>
                </div>,
                document.body
              ) : (
                <div
                  style={{
                    position: "fixed",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 26,
                    height: 128,
                    zIndex: 10,
                    borderRadius: "14px 0 0 14px",
                    background: "#ffffff",
                    border: "1px solid #dce6f5",
                    borderRight: "none",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    cursor: selectedWidget ? "pointer" : "not-allowed",
                    color: selectedWidget ? "#1677ff" : "#aab6cc",
                  }}
                  onClick={() => {
                    if (!selectedWidget) return;
                    syncConfigForm(selectedWidget);
                    setConfigOpen(true);
                  }}
                >
                  <SettingOutlined />
                  <span style={{ writingMode: "vertical-rl", fontSize: 12 }}>配置</span>
                </div>
              )}

              {!widgets.length ? (
                <div style={{ minHeight: 980, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Empty description="从左侧指标库选择一级分类，再在弹窗中挑选具体风格加入画布" />
                </div>
              ) : (
                <>
                  {dragState?.mode === "move" && dragPreviewPosition ? (
                    <div
                      style={{
                        position: "absolute",
                        left: dragPreviewPosition.x - widgetMinGap,
                        top: dragPreviewPosition.y - widgetMinGap,
                        width: dragPreviewPosition.w + widgetMinGap * 2,
                        height: dragPreviewPosition.h + widgetMinGap * 2,
                        border: "1px dashed rgba(22,119,255,0.42)",
                        background: "rgba(22,119,255,0.06)",
                        borderRadius: 18,
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    />
                  ) : null}
                  {renderedWidgets.filter((widget) => !widget.containerParentKey).map((widget) => {
                const resolvedBorderRadius = Number(widget.chrome?.borderRadius ?? 16);
                const resolvedBorderColor = String(widget.chrome?.borderColor || "#eef2f7");
                const resolvedBackground = buildChromeBackgroundFromStyle(widget.chrome || null);
                const resolvedShadowPreset = String(widget.chrome?.shadowPreset || "none");
                const resolvedTitleColor = String(widget.chrome?.titleColor || "#101828");
                return (
                <div
                  key={widget.key}
                  data-widget-key={widget.key}
                  data-widget-type={widget.widgetType}
                  onClick={() => {
                    setSelectedWidgetKey(widget.key);
                    syncConfigForm(widget);
                    setConfigOpen(true);
                  }}
                  style={{
                    position: "absolute",
                    left: widget.position.x,
                    top: widget.position.y,
                    width: widget.position.w,
                    height: widget.position.h,
                    transition: dragState?.mode === "move" ? "left 180ms ease, top 180ms ease, width 180ms ease, height 180ms ease" : "width 180ms ease, height 180ms ease",
                  }}
                >
                  <Card
                    size="small"
                    hoverable
                    onMouseDown={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest(".reporting-widget__resize-right")) {
                        setDragState({
                          key: widget.key,
                          mode: "resize-right",
                          startX: event.clientX,
                          startY: event.clientY,
                          initialX: widget.position.x,
                          initialY: widget.position.y,
                          initialW: widget.position.w,
                          initialH: widget.position.h,
                        });
                        return;
                      }
                      if (target.closest(".reporting-widget__resize-bottom")) {
                        setDragState({
                          key: widget.key,
                          mode: "resize-bottom",
                          startX: event.clientX,
                          startY: event.clientY,
                          initialX: widget.position.x,
                          initialY: widget.position.y,
                          initialW: widget.position.w,
                          initialH: widget.position.h,
                        });
                        return;
                      }
                      if (target.closest(".reporting-widget__resize-corner-se")) {
                        setDragState({
                          key: widget.key,
                          mode: "resize-corner-se",
                          startX: event.clientX,
                          startY: event.clientY,
                          initialX: widget.position.x,
                          initialY: widget.position.y,
                          initialW: widget.position.w,
                          initialH: widget.position.h,
                        });
                        return;
                      }
                      if (target.closest(".reporting-widget__resize-corner-sw")) {
                        setDragState({
                          key: widget.key,
                          mode: "resize-corner-sw",
                          startX: event.clientX,
                          startY: event.clientY,
                          initialX: widget.position.x,
                          initialY: widget.position.y,
                          initialW: widget.position.w,
                          initialH: widget.position.h,
                        });
                        return;
                      }
                      if (target.closest(".reporting-widget__resize-corner-ne")) {
                        setDragState({
                          key: widget.key,
                          mode: "resize-corner-ne",
                          startX: event.clientX,
                          startY: event.clientY,
                          initialX: widget.position.x,
                          initialY: widget.position.y,
                          initialW: widget.position.w,
                          initialH: widget.position.h,
                        });
                        return;
                      }
                      if (target.closest(".reporting-widget__resize-corner-nw")) {
                        setDragState({
                          key: widget.key,
                          mode: "resize-corner-nw",
                          startX: event.clientX,
                          startY: event.clientY,
                          initialX: widget.position.x,
                          initialY: widget.position.y,
                          initialW: widget.position.w,
                          initialH: widget.position.h,
                        });
                        return;
                      }
                      if (target.closest(".reporting-widget__map-roam-surface")) {
                        return;
                      }
                      setDragState({
                        key: widget.key,
                        mode: "move",
                        startX: event.clientX,
                        startY: event.clientY,
                        initialX: widget.position.x,
                        initialY: widget.position.y,
                        initialW: widget.position.w,
                        initialH: widget.position.h,
                      });
                      setActiveDragPayload({ kind: "widget", widgetKey: widget.key });
                      setPointerPosition({ x: event.clientX, y: event.clientY });
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      cursor: dragState?.key === widget.key && dragState.mode === "move" ? "grabbing" : "move",
                      borderColor: resolvedBorderColor,
                      borderWidth: Number(widget.chrome?.borderWidth ?? 1),
                      borderRadius: resolvedBorderRadius,
                      boxShadow: resolvedShadowPreset === "medium"
                        ? "0 12px 32px rgba(15,23,42,0.16)"
                        : resolvedShadowPreset === "soft"
                          ? "0 8px 24px rgba(15,23,42,0.10)"
                          : "none",
                      overflow: "hidden",
                      background: resolvedBackground,
                    }}
                    title={widget.chrome?.showTitle === false ? null : (
                      <div
                        style={{
                          width: "100%",
                          textAlign: widget.chrome?.titleAlign || "left",
                          color: resolvedTitleColor,
                          fontSize: Number(widget.chrome?.titleFontSize || 18),
                          fontWeight: Number(widget.chrome?.titleFontWeight || 700),
                        }}
                      >
                        {widget.chrome?.titleText || widget.widgetName}
                      </div>
                    )}
                    extra={null}
                  >
                    {selectedWidgetKey === widget.key ? (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          border: "1px solid rgba(22,119,255,0.45)",
                          borderRadius: resolvedBorderRadius,
                          boxShadow: "inset 0 0 0 1px rgba(22,119,255,0.12)",
                          pointerEvents: "none",
                          zIndex: 2,
                        }}
                      />
                    ) : null}
                    {dragCollisionKeys.has(widget.key) ? (
                      <div
                        style={{
                          position: "absolute",
                          inset: 6,
                          border: "1px dashed rgba(22,119,255,0.5)",
                          background: "rgba(22,119,255,0.08)",
                          borderRadius: Math.max(8, resolvedBorderRadius - 6),
                          pointerEvents: "none",
                          zIndex: 2,
                        }}
                      />
                    ) : null}
                    {renderWidgetPreview(widget, renderedWidgets, (nextWidget) => {
                      setSelectedWidgetKey(nextWidget.key);
                      syncConfigForm(nextWidget);
                      setConfigOpen(true);
                    }, highlightedTabKey, updateSelectedWidget)}
                    {widget.widgetType === "tabs" ? (
                      <div
                        style={{
                          position: "absolute",
                          left: 24,
                          right: 24,
                          top: 48,
                          bottom: 24,
                          border: activeDragPayload?.kind === "widget" ? "1px dashed rgba(22,119,255,0.28)" : "1px dashed rgba(148,163,184,0.18)",
                          borderRadius: 12,
                          pointerEvents: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#98a2b3",
                          fontSize: 12,
                          background: activeDragPayload?.kind === "widget" ? "rgba(22,119,255,0.04)" : "transparent",
                        }}
                      >
                      </div>
                    ) : null}
                    <div className="reporting-widget__resize-right" style={{ position: "absolute", right: 0, top: 12, bottom: 12, width: 10, cursor: "ew-resize" }} />
                    <div className="reporting-widget__resize-bottom" style={{ position: "absolute", left: 12, right: 12, bottom: 0, height: 10, cursor: "ns-resize" }} />
                    <div className="reporting-widget__resize-corner-se" style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, cursor: "nwse-resize", background: "transparent" }} />
                    <div className="reporting-widget__resize-corner-sw" style={{ position: "absolute", left: -2, bottom: -2, width: 18, height: 18, cursor: "nesw-resize", background: "transparent" }} />
                    <div className="reporting-widget__resize-corner-ne" style={{ position: "absolute", right: -2, top: -2, width: 18, height: 18, cursor: "nesw-resize", background: "transparent" }} />
                    <div className="reporting-widget__resize-corner-nw" style={{ position: "absolute", left: -2, top: -2, width: 18, height: 18, cursor: "nwse-resize", background: "transparent" }} />
                  </Card>
                </div>
                  );
                  })}
                </>
              )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={stylePickerOpen}
        title={stylePickerFamily === "pie"
          ? (stylePickerMode === "add" ? "选择饼图结构风格" : "切换饼图结构风格")
          : (stylePickerMode === "add" ? `选择${getPrimaryChartFamilyLabel(stylePickerFamily)}风格` : `切换${getPrimaryChartFamilyLabel(stylePickerFamily)}风格`)}
        onCancel={() => setStylePickerOpen(false)}
        footer={null}
        destroyOnHidden
        width={920}
      >
        {stylePickerFamily === "pie" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {pieVariantLibrary.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => applyPieVariantToSelectedWidget(item.key as WidgetChartStyleConfig["pieVariant"])}
                style={{
                  border: item.current ? "1px solid #1677ff" : "1px solid #d6deea",
                  borderRadius: 16,
                  padding: 14,
                  background: item.current ? "#f0f7ff" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  minHeight: 156,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 14,
                  boxShadow: item.current ? "0 0 0 2px rgba(22,119,255,0.10) inset" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#eef5ff", color: "#1677ff", fontSize: 16 }}>
                    <PieChartOutlined />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text strong style={{ display: "block" }}>
                      {item.label}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      结构风格
                    </Typography.Text>
                  </div>
                </div>
                <div>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginBottom: 8, fontSize: 12, minHeight: 40 }}
                    ellipsis={{ rows: 2 }}
                  >
                    {item.description}
                  </Typography.Paragraph>
                  <Space size={[6, 6]} wrap>
                    {item.tags.map((tag) => (
                      <Tag key={`${item.key}_${tag}`}>{tag}</Tag>
                    ))}
                  </Space>
                </div>
              </button>
            ))}
          </div>
        ) : stylePickerAssets.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {stylePickerAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  if (stylePickerMode === "replace") {
                    replaceSelectedWidgetAsset(asset);
                    return;
                  }
                  addAssetToCanvas(asset);
                }}
                style={{
                  border: "1px solid #d6deea",
                  borderRadius: 16,
                  padding: 14,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  minHeight: 156,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#eef5ff", color: "#1677ff", fontSize: 16 }}>
                    {getAssetIcon(asset)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text strong style={{ display: "block" }}>
                      {asset.variantName || asset.chartName}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {asset.isBuiltin ? "内置风格" : "自定义风格"}
                    </Typography.Text>
                  </div>
                </div>
                <div>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginBottom: 8, fontSize: 12, minHeight: 40 }}
                    ellipsis={{ rows: 2 }}
                  >
                    {asset.description || "该图表风格可直接用于报表开发画布。"}
                  </Typography.Paragraph>
                  <Space size={[6, 6]} wrap>
                    {(asset.tags || []).slice(0, 3).map((tag) => (
                      <Tag key={`${asset.id}_${tag}`}>{tag}</Tag>
                    ))}
                  </Space>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty description="当前分类下还没有可选风格" />
        )}
      </Modal>

      <Modal
        open={basicInfoOpen}
        title="基本信息配置"
        onCancel={() => setBasicInfoOpen(false)}
        onOk={() => setBasicInfoOpen(false)}
        destroyOnHidden
        width={860}
      >
        <Form
          form={basicForm}
          layout="vertical"
          initialValues={{
            layoutMode: "free",
            ownerName: "报表分析师",
            status: "draft",
          }}
          onValuesChange={(changedValues) => {
            if ("layoutMode" in changedValues) {
              setLayoutMode(changedValues.layoutMode === "grid" ? "grid" : "free");
            }
            if (changedValues.layoutMode === "grid") {
              setWidgets((current) => current.map((item) => ({
                ...item,
                position: resolveFreeMovePosition(item.position, GRID_LAYOUT_SNAP, canvasMetrics.width, canvasMetrics.height),
              })));
            }
            if ("widgetMinGap" in changedValues) {
              setWidgetMinGap(Number(changedValues.widgetMinGap || DEFAULT_WIDGET_GAP));
            }
            if ("themeTemplateId" in changedValues) {
              const nextTemplateId = readNumericId(changedValues.themeTemplateId);
              applyDashboardThemeTemplateChange(nextTemplateId);
            }
            if ("canvasBackgroundType" in changedValues || "canvasBackgroundColor" in changedValues || "canvasGradientStart" in changedValues || "canvasGradientEnd" in changedValues || "canvasGradientDirection" in changedValues || "canvasBackgroundImage" in changedValues) {
              const values = basicForm.getFieldsValue();
              setCanvasConfig(buildCanvasConfigFromForm(values));
            }
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item name="dashboardName" label="名称" rules={[{ required: true, message: "请输入名称" }]}><Input /></Form.Item>
            <Form.Item name="layoutMode" label="布局模式" rules={[{ required: true, message: "请选择布局模式" }]}><Radio.Group options={[{ value: "free", label: "自由排版" }, { value: "grid", label: "标准网格" }]} /></Form.Item>
            <Form.Item name="canvasRatioPreset" label="画布比例" rules={[{ required: true, message: "请选择画布比例" }]}>
              <Select options={CANVAS_RATIO_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setCanvasRatioPreset(String(value || "16:9"))} />
            </Form.Item>
            <Form.Item name="widgetMinGap" label="图表最小间隙">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item label="模板类型">
              <Select
                value={themeCategoryFilter}
                options={themeTemplateCategoryOptions}
                onChange={(value) => setThemeCategoryFilter(String(value || "all"))}
              />
            </Form.Item>
            <Form.Item name="themeTemplateId" label="主题模板">
              <Select
                allowClear
                options={groupedThemeTemplateOptions}
                placeholder="选择报表默认主题"
              />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}><Select options={[{ value: "draft", label: "草稿" }, { value: "published", label: "发布" }, { value: "inactive", label: "停用" }]} /></Form.Item>
            <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}><Input /></Form.Item>
            <Form.Item name="description" label="描述"><Input /></Form.Item>
          </div>
          <Card size="small" title="画布背景">
            <Form.Item noStyle shouldUpdate>
              {() => {
                const backgroundType = basicForm.getFieldValue("canvasBackgroundType") || "solid";
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                    <Form.Item name="canvasBackgroundType" label="背景类型" initialValue="solid" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
                      <Select options={[{ value: "solid", label: "纯色" }, { value: "gradient", label: "渐变" }, { value: "image", label: "图片" }]} />
                    </Form.Item>
                    {backgroundType === "solid" ? (
                      <>
                        <Form.Item name="canvasBackgroundColor" label="纯色值" style={{ marginBottom: 0 }}>
                          <Input type="color" style={{ width: "100%", height: 40, padding: 4 }} />
                        </Form.Item>
                        <div style={{ gridColumn: "span 2", display: "flex", alignItems: "end" }}>
                          <div style={{ width: "100%", height: 40, borderRadius: 12, border: "1px solid #d6deea", background: String(basicForm.getFieldValue("canvasBackgroundColor") || "#f7f9fc") }} />
                        </div>
                      </>
                    ) : null}
                    {backgroundType === "gradient" ? (
                      <>
                        <Form.Item name="canvasGradientStart" label="起始色" style={{ marginBottom: 0 }}>
                          <Input type="color" style={{ width: "100%", height: 40, padding: 4 }} />
                        </Form.Item>
                        <Form.Item name="canvasGradientEnd" label="结束色" style={{ marginBottom: 0 }}>
                          <Input type="color" style={{ width: "100%", height: 40, padding: 4 }} />
                        </Form.Item>
                        <Form.Item name="canvasGradientDirection" label="方向" style={{ marginBottom: 0 }}>
                          <Select options={[
                            { value: "to bottom", label: "向下" },
                            { value: "to top", label: "向上" },
                            { value: "to right", label: "向右" },
                            { value: "to left", label: "向左" },
                            { value: "to bottom right", label: "右下" },
                            { value: "to top right", label: "右上" },
                          ]} />
                        </Form.Item>
                        <div style={{ gridColumn: "1 / -1", height: 56, borderRadius: 14, border: "1px solid #d6deea", background: `linear-gradient(${String(basicForm.getFieldValue("canvasGradientDirection") || "to bottom")}, ${String(basicForm.getFieldValue("canvasGradientStart") || "#f7f9fc")} 0%, ${String(basicForm.getFieldValue("canvasGradientEnd") || "#eef3fa")} 100%)` }} />
                      </>
                    ) : null}
                    {backgroundType === "image" ? (
                      <>
                        <Form.Item name="canvasBackgroundImage" label="图片地址 / DataURL" style={{ gridColumn: "1 / span 2", marginBottom: 0 }}>
                          <Input placeholder="上传后会自动写入" />
                        </Form.Item>
                        <Form.Item label="上传背景图" style={{ marginBottom: 0 }}>
                          <Upload
                            showUploadList={false}
                            accept="image/*"
                            beforeUpload={async (file) => {
                              try {
                                const imageUrl = await readLocalImageAsDataUrl(file);
                                basicForm.setFieldValue("canvasBackgroundType", "image");
                                basicForm.setFieldValue("canvasBackgroundImage", imageUrl);
                                setCanvasConfig(buildCanvasConfigFromForm({
                                  ...basicForm.getFieldsValue(),
                                  canvasBackgroundType: "image",
                                  canvasBackgroundImage: imageUrl,
                                }));
                                message.success("画布背景图已载入");
                              } catch (error: any) {
                                message.error(error.message || "画布背景图读取失败");
                              }
                              return false;
                            }}
                          >
                            <Button icon={<BgColorsOutlined />}>上传背景图</Button>
                          </Upload>
                        </Form.Item>
                        <div style={{ gridColumn: "1 / -1", height: 120, borderRadius: 14, border: "1px solid #d6deea", background: basicForm.getFieldValue("canvasBackgroundImage") ? `url(${String(basicForm.getFieldValue("canvasBackgroundImage"))}) center/cover no-repeat` : "linear-gradient(180deg, #f7f9fc 0%, #eef3fa 100%)" }} />
                      </>
                    ) : null}
                    <Form.Item name="dashboardTitleAlign" label="名称对齐" style={{ marginBottom: 0 }}>
                      <Select options={[{ value: "left", label: "左对齐" }, { value: "center", label: "居中" }, { value: "right", label: "右对齐" }]} />
                    </Form.Item>
                    <Form.Item name="dashboardTitleFontSize" label="名称字号" style={{ marginBottom: 0 }}>
                      <Input type="number" min={24} max={96} />
                    </Form.Item>
                    <Form.Item name="dashboardTitleFontWeight" label="名称字重" style={{ marginBottom: 0 }}>
                      <Select options={[{ value: 500, label: "中等" }, { value: 600, label: "偏粗" }, { value: 700, label: "加粗" }, { value: 800, label: "极粗" }]} />
                    </Form.Item>
                    <Form.Item name="dashboardTitleColor" label="名称颜色" style={{ marginBottom: 0 }}>
                      <Input type="color" style={{ width: "100%", height: 40, padding: 4 }} />
                    </Form.Item>
                  </div>
                );
              }}
            </Form.Item>
          </Card>
        </Form>
      </Modal>

      <Modal
        open={aiAssistantOpen}
        title="AI 生成图表"
        onCancel={() => setAiAssistantOpen(false)}
        footer={null}
        width={1120}
        destroyOnHidden
      >
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: 16, alignItems: "start" }}>
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Card size="small" title="数据范围">
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                <Select
                  value={aiAssistantState.sourceId || undefined}
                  placeholder="选择要分析的数据源"
                  options={dataSourceOptions}
                  showSearch
                  optionFilterProp="label"
                  onChange={(value) => {
                    setAiAssistantState((current) => ({
                      ...current,
                      sourceId: Number(value),
                      analysisSuggestions: [],
                      selectedAnalysisSuggestionKey: null,
                      analysisSuggestionPage: 1,
                      selectedTables: [],
                      previewTableName: null,
                      tablePreviewRows: [],
                      tablePreviewColumns: [],
                      sourceSql: "",
                      plan: null,
                      query: null,
                      lastQueryError: null,
                      recommendations: [],
                      selectedRecommendationKey: null,
                      preview: null,
                      tables: [],
                      editedFieldMap: {},
                    }));
                  }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px auto", gap: 8, alignItems: "start" }}>
                  <Select
                    mode="multiple"
                    value={aiAssistantState.selectedTables}
                    placeholder="可选：限定候选表"
                    loading={aiAssistantLoading === "tables"}
                    options={aiAssistantState.tables.map((item) => ({
                      value: item.tableName,
                      label: item.tableComment ? `${item.tableName}（${item.tableComment}）` : item.tableName,
                    }))}
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                    maxTagTextLength={18}
                    onChange={(values) => {
                      if (values.length > 5) {
                        message.warning("最多只能选择 5 张表");
                        return;
                      }
                      setAiAssistantState((current) => ({
                        ...current,
                        selectedTables: values,
                        analysisSuggestions: [],
                        selectedAnalysisSuggestionKey: null,
                        analysisSuggestionPage: 1,
                        previewTableName: values.includes(String(current.previewTableName || "")) ? current.previewTableName : null,
                      }));
                    }}
                  />
                  <Select
                    value={aiAssistantState.previewTableName || undefined}
                    placeholder="预览某张表"
                    loading={aiAssistantLoading === "tables" || aiAssistantLoading === "tablePreview"}
                    options={(aiAssistantState.selectedTables.length
                      ? aiAssistantState.selectedTables
                      : aiAssistantState.tables.map((item) => item.tableName)
                    ).map((tableName) => ({
                      value: tableName,
                      label: tableName,
                    }))}
                    onChange={(value) => setAiAssistantState((current) => ({
                      ...current,
                      previewTableName: String(value),
                    }))}
                  />
                  <Button
                    disabled={!aiAssistantState.previewTableName}
                    loading={aiAssistantLoading === "tablePreview"}
                    onClick={() => setAiTablePreviewOpen(true)}
                  >
                    预览数据
                  </Button>
                </div>
                {aiAssistantState.plan?.metadata?.tableSamples?.length ? (
                  <Space size={6} wrap>
                    <Tag color="blue">已读取随机样例</Tag>
                    {aiAssistantState.plan.metadata.tableSamples.map((item) => (
                      <Tag key={item.tableName} color={item.loadError ? "orange" : "default"}>
                        {item.tableName}: {item.loadError ? "读取失败" : `${item.rowCount} 行`}
                      </Tag>
                    ))}
                  </Space>
                ) : null}
              </Space>
            </Card>

            <Tabs
              activeKey={aiAssistantState.activeTab}
              onChange={(activeTab) => setAiAssistantState((current) => ({
                ...current,
                activeTab: activeTab === "analysis" ? "analysis" : "sql",
              }))}
              items={[
                {
                  key: "analysis",
                  label: "分析建议",
                  children: (
                    <Space direction="vertical" size={12} style={{ display: "flex" }}>
                      <Input.TextArea
                        rows={3}
                        value={aiAssistantState.analysisDirection}
                        placeholder="可选：输入业务分析方向，例如运营效率、区域分布、客户增长、风险预警"
                        onChange={(event) => setAiAssistantState((current) => ({
                          ...current,
                          analysisDirection: event.target.value,
                        }))}
                      />
                      <Space wrap>
                        <Button type="primary" icon={<RobotOutlined />} loading={aiAssistantLoading === "analysis"} onClick={() => void handleAiGenerateAnalysisSuggestions()}>
                          完善分析内容
                        </Button>
                        <Button
                          disabled={!selectedAnalysisSuggestion}
                          onClick={() => {
                            if (!selectedAnalysisSuggestion || !aiAssistantState.selectedAnalysisSuggestionKey) return;
                            handleApplyAnalysisSuggestion(selectedAnalysisSuggestion, aiAssistantState.selectedAnalysisSuggestionKey);
                          }}
                        >
                          同步到生成 SQL
                        </Button>
                      </Space>
                      {aiAssistantState.analysisSuggestions.length ? (
                        <Space direction="vertical" size={10} style={{ display: "flex" }}>
                          {pagedAnalysisSuggestions.map((item, pageIndex) => {
                            const absoluteIndex = (Math.max(1, aiAssistantState.analysisSuggestionPage || 1) - 1) * AI_ANALYSIS_SUGGESTION_PAGE_SIZE + pageIndex;
                            const itemKey = `${item.id || item.title}:${absoluteIndex}`;
                            const selected = itemKey === aiAssistantState.selectedAnalysisSuggestionKey;
                            return (
                              <div
                                key={itemKey}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleSelectAnalysisSuggestion(itemKey)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    handleSelectAnalysisSuggestion(itemKey);
                                  }
                                }}
                                style={{
                                  border: `1px solid ${selected ? "#1677ff" : "#d6deea"}`,
                                  borderRadius: 8,
                                  padding: 12,
                                  background: selected ? "#eef5ff" : "#fff",
                                  cursor: "pointer",
                                }}
                              >
                                <Space direction="vertical" size={6} style={{ display: "flex" }}>
                                  <Space style={{ justifyContent: "space-between", width: "100%" }}>
                                    <Typography.Text strong>{item.title}</Typography.Text>
                                    {item.chartHint ? <Tag color={selected ? "blue" : "default"}>{item.chartHint}</Tag> : null}
                                  </Space>
                                  {item.businessScenario ? (
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.businessScenario}</Typography.Text>
                                  ) : null}
                                  <Typography.Paragraph style={{ marginBottom: 0 }}>{item.analysisPrompt}</Typography.Paragraph>
                                  <Space size={6} wrap>
                                    {(item.dimensions || []).slice(0, 3).map((dimension) => <Tag key={`d_${dimension}`}>维度：{dimension}</Tag>)}
                                    {(item.metrics || []).slice(0, 3).map((metric) => <Tag key={`m_${metric}`} color="green">指标：{metric}</Tag>)}
                                  </Space>
                                  {item.reason ? (
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.reason}</Typography.Text>
                                  ) : null}
                                  <Button size="small" type={selected ? "primary" : "default"} onClick={(event) => {
                                    event.stopPropagation();
                                    handleApplyAnalysisSuggestion(item, itemKey);
                                  }}>
                                    同步到生成 SQL
                                  </Button>
                                </Space>
                              </div>
                            );
                          })}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              共 {aiAssistantState.analysisSuggestions.length} 条建议，每页 {AI_ANALYSIS_SUGGESTION_PAGE_SIZE} 条
                            </Typography.Text>
                            <Pagination
                              size="small"
                              current={aiAssistantState.analysisSuggestionPage}
                              pageSize={AI_ANALYSIS_SUGGESTION_PAGE_SIZE}
                              total={aiAssistantState.analysisSuggestions.length}
                              showSizeChanger={false}
                              onChange={(page) => setAiAssistantState((current) => ({
                                ...current,
                                analysisSuggestionPage: page,
                              }))}
                            />
                          </div>
                        </Space>
                      ) : (
                        <Empty description="选择数据范围后完善分析内容" />
                      )}
                    </Space>
                  ),
                },
                {
                  key: "sql",
                  label: "生成 SQL",
                  children: (
                    <Space direction="vertical" size={12} style={{ display: "flex" }}>
                      <Input.TextArea
                        rows={4}
                        value={aiAssistantState.prompt}
                        placeholder="例如：按地区统计订单表的数据量，按数量倒序取前 10 个地区"
                        onChange={(event) => setAiAssistantState((current) => ({
                          ...current,
                          prompt: event.target.value,
                          selectedAnalysisSuggestionKey: null,
                          plan: null,
                          query: null,
                          lastQueryError: null,
                          recommendations: [],
                          selectedRecommendationKey: null,
                          preview: null,
                          editedFieldMap: {},
                        }))}
                      />
                      <Space wrap>
                        <Button type="primary" icon={<RobotOutlined />} loading={aiAssistantLoading === "plan"} onClick={() => void handleAiGenerateSql()}>
                          生成 SQL
                        </Button>
                        <Button onClick={() => resetAiAssistant({ sourceId: aiAssistantState.sourceId || null, activeTab: "analysis" })}>清空</Button>
                      </Space>
                      {aiAssistantState.plan?.validation?.messages?.length ? (
                        <Alert
                          type={aiAssistantState.plan.validation.valid ? "success" : "warning"}
                          showIcon
                          message={aiAssistantState.plan.summary || "SQL 校验结果"}
                          description={aiAssistantState.plan.validation.messages.join("；")}
                        />
                      ) : null}
                      <Input.TextArea
                        rows={9}
                        value={aiAssistantState.sourceSql}
                        spellCheck={false}
                        placeholder="AI 生成的 SQL 会出现在这里，执行前可以审核并修改"
                        onChange={(event) => setAiAssistantState((current) => ({
                          ...current,
                          sourceSql: event.target.value,
                          query: null,
                          lastQueryError: null,
                          recommendations: [],
                          selectedRecommendationKey: null,
                          preview: null,
                          editedFieldMap: {},
                        }))}
                      />
                      <Input.TextArea
                        rows={3}
                        value={aiAssistantState.revisionInstruction}
                        placeholder="例如：改为按月份统计、只看近一年、增加地区过滤"
                        onChange={(event) => setAiAssistantState((current) => ({ ...current, revisionInstruction: event.target.value }))}
                      />
                      <Space wrap>
                        <Button
                          type="default"
                          disabled={!aiAssistantState.sourceSql.trim() || !aiAssistantState.revisionInstruction.trim()}
                          loading={aiAssistantLoading === "plan"}
                          onClick={() => void handleAiReviseSql()}
                        >
                          AI 修改 SQL
                        </Button>
                        <Button
                          disabled={!aiAssistantState.sourceSql.trim()}
                          loading={aiAssistantLoading === "query"}
                          onClick={() => void handleAiRunQuery()}
                        >
                          执行查询
                        </Button>
                        <Button disabled={!aiAssistantState.query} loading={aiAssistantLoading === "recommend"} onClick={() => void handleAiRecommendCharts()}>
                          推荐图表
                        </Button>
                        {aiAssistantState.query?.governance ? (
                          <Tag color={aiAssistantState.query.governance.explainValid ? "green" : "orange"}>
                            EXPLAIN {aiAssistantState.query.governance.explainValid ? "通过" : "待确认"} / LIMIT {aiAssistantState.query.governance.limit || 100}
                          </Tag>
                        ) : null}
                      </Space>
                      {aiAssistantState.lastQueryError ? (
                        <Alert type="error" showIcon message="上次执行失败" description={aiAssistantState.lastQueryError} />
                      ) : null}
                      {aiAssistantState.query ? (
                        <Table
                          size="small"
                          rowKey={(_, index) => `ai_row_${index}`}
                          dataSource={aiAssistantState.query.sampleRows}
                          columns={aiAssistantState.query.fields.map((field) => ({
                            title: field.label || field.columnName,
                            dataIndex: field.columnName,
                            key: field.columnName,
                            width: 140,
                            render: (value: unknown) => value === null || value === undefined || value === "" ? "-" : String(value),
                          }))}
                          scroll={{ x: "max-content", y: 220 }}
                          pagination={false}
                        />
                      ) : null}
                    </Space>
                  ),
                },
              ]}
            />
          </Space>

          <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Card size="small" title="图表推荐">
                {aiAssistantState.recommendations.length ? (
                  <Space direction="vertical" size={10} style={{ display: "flex" }}>
                    {aiAssistantState.recommendations.map((item, index) => {
                      const itemKey = `${item.widgetType}:${item.chartFamily}:${item.chartAssetId || ""}:${index}`;
                      const selected = itemKey === aiAssistantState.selectedRecommendationKey;
                      return (
                        <button
                          key={itemKey}
                          type="button"
                          onClick={() => handleAiRecommendationSelect(item, itemKey)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: `1px solid ${selected ? "#1677ff" : "#d6deea"}`,
                            borderRadius: 8,
                            padding: 12,
                            background: selected ? "#eef5ff" : "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          <Space direction="vertical" size={4} style={{ display: "flex" }}>
                            <Space style={{ justifyContent: "space-between", width: "100%" }}>
                              <Typography.Text strong>{item.title || item.chartName}</Typography.Text>
                              <Space size={4}>
                                {item.fieldMapValidation && !item.fieldMapValidation.valid ? <Tag color="orange">映射待校正</Tag> : null}
                                <Tag color={selected ? "blue" : "default"}>
                                  {item.widgetType === "chart"
                                    ? getPrimaryChartFamilyLabel(getPrimaryChartFamilyFromValue(item.chartFamily))
                                    : item.widgetType}
                                </Tag>
                              </Space>
                            </Space>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.reason}</Typography.Text>
                          </Space>
                        </button>
                      );
                    })}
                  </Space>
                ) : (
                  <Empty description="执行查询后生成图表推荐" />
                )}
              </Card>

              <Card
                size="small"
                title="效果预览"
                extra={(
                  <Space>
                    <Switch
                      size="small"
                      checked={aiAssistantState.autoPreview}
                      onChange={(checked) => setAiAssistantState((current) => ({ ...current, autoPreview: checked }))}
                      checkedChildren="自动"
                      unCheckedChildren="手动"
                    />
                    <Button disabled={!selectedAiRecommendation} loading={aiAssistantLoading === "preview"} onClick={() => void handleAiPreviewRecommendation()}>
                      刷新预览
                    </Button>
                    <Button type="primary" disabled={!selectedAiRecommendation || !aiAssistantState.query || !selectedAiFieldMapValidation.valid} loading={aiAssistantLoading === "insert"} onClick={() => void handleAiInsertWidget()}>
                      添加到画布
                    </Button>
                  </Space>
                )}
              >
                {selectedAiRecommendation ? (
                  <Space direction="vertical" size={10} style={{ display: "flex", marginBottom: 12 }}>
                    <Select
                      value={selectedAiRecommendation.widgetType === "kpi" ? "kpi" : (getPrimaryChartFamilyFromValue(selectedAiRecommendation.chartFamily) || undefined)}
                      options={aiChartFamilyOptions}
                      placeholder="图表类型"
                      style={{ width: 180 }}
                      popupMatchSelectWidth={220}
                      listHeight={320}
                      loading={aiAssistantLoading === "chartSwitch"}
                      disabled={aiAssistantLoading === "chartSwitch"}
                      onChange={(value) => handleAiChartFamilyChange(value as PrimaryChartFamilyKey | "kpi")}
                    />
                    {selectedAiMappingFields.length ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                        {selectedAiMappingFields.map((field) => (
                          <div key={field.key}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {field.label || field.key}{field.required !== false ? " *" : ""}
                            </Typography.Text>
                            <Select
                              allowClear={field.required === false}
                              size="small"
                              value={selectedAiEffectiveFieldMap[field.key] || undefined}
                              options={selectedAiFieldOptions}
                              placeholder="选择字段"
                              onChange={(value) => handleAiFieldMapChange(field.key, value)}
                              style={{ width: "100%", marginTop: 4 }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!selectedAiFieldMapValidation.valid ? (
                      <Alert type="warning" showIcon message={selectedAiFieldMapValidation.messages.join("；")} />
                    ) : null}
                  </Space>
                ) : null}
                <div style={{ height: 320, border: "1px solid #e6ebf2", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  {aiAssistantLoading === "chartSwitch" ? (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                      <Space direction="vertical" align="center" size={10}>
                        <Spin />
                        <Typography.Text strong>正在分析指标特征</Typography.Text>
                        <Typography.Text type="secondary" style={{ textAlign: "center" }}>
                          正在根据当前查询字段重新匹配维度、指标和图表映射
                        </Typography.Text>
                      </Space>
                    </div>
                  ) : selectedAiRecommendation && aiAssistantState.query && aiAssistantState.preview ? (
                    selectedAiPreviewBundle ? renderWidgetPreview({
                      ...selectedAiPreviewBundle.previewWidget,
                      preview: transformPreviewForWidget(selectedAiPreviewBundle.previewWidget, aiAssistantState.preview),
                    }) : null
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Empty description="选择推荐后刷新预览" />
                    </div>
                  )}
                </div>
              </Card>
          </Space>
        </div>
      </Modal>

      <Modal
        open={aiTablePreviewOpen}
        title="表数据预览"
        onCancel={() => setAiTablePreviewOpen(false)}
        footer={null}
        width={960}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Typography.Text type="secondary">
            {aiAssistantState.previewTableName ? `${aiAssistantState.previewTableName} / ${aiAssistantState.tablePreviewRows.length} 行` : "请选择一张表"}
          </Typography.Text>
          <Table
            size="small"
            rowKey={(_, index) => `ai_table_preview_${index}`}
            dataSource={aiAssistantState.tablePreviewRows}
            columns={aiAssistantState.tablePreviewColumns.map((column) => ({
              ...column,
              width: 180,
              render: (value: unknown) => value === null || value === undefined || value === "" ? "-" : String(value),
            }))}
            locale={{ emptyText: aiAssistantLoading === "tablePreview" ? "正在读取数据" : "当前没有可预览数据" }}
            scroll={{ x: "max-content", y: 480 }}
            pagination={false}
          />
        </Space>
      </Modal>

    </div>
  );
}

