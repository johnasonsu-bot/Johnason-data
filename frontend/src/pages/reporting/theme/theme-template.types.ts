export type ThemeStatus = "draft" | "active" | "inactive";

export type ThemeTemplateCanvas = {
  backgroundType?: "solid" | "gradient" | "image" | string;
  backgroundColor?: string | null;
  backgroundGradient?: string | null;
  backgroundImage?: string | null;
  overlayColor?: string | null;
  overlayOpacity?: number | null;
  dashboardTitleColor?: string | null;
};

export type ThemeTemplateChrome = {
  backgroundType?: "solid" | "gradient" | "image" | string;
  backgroundColor?: string | null;
  backgroundGradient?: string | null;
  borderColor?: string | null;
  borderWidth?: number | null;
  borderRadius?: number | null;
  shadowPreset?: "none" | "soft" | "medium" | string;
  titleColor?: string | null;
  subtitleColor?: string | null;
  paddingPreset?: "compact" | "comfortable" | "spacious" | string;
  backgroundImage?: string | null;
};

export type ThemeTemplateSemantic = {
  primary?: string | null;
  secondary?: string | null;
  success?: string | null;
  warning?: string | null;
  danger?: string | null;
  info?: string | null;
  textPrimary?: string | null;
  textSecondary?: string | null;
  textTertiary?: string | null;
  lineSubtle?: string | null;
  lineStrong?: string | null;
};

export type ThemeTemplateChartCommon = {
  palette?: string[];
  labelColor?: string | null;
  labelFontSize?: number | null;
  legendColor?: string | null;
  legendInactiveColor?: string | null;
  guideLineColor?: string | null;
  tooltipBackground?: string | null;
  tooltipTextColor?: string | null;
  emphasisShadowColor?: string | null;
};

export type ThemeVariantPie = {
  palette?: string[];
  centerTitleColor?: string | null;
  centerValueColor?: string | null;
  centerUnitColor?: string | null;
  centerMetaColor?: string | null;
  labelColor?: string | null;
  valueColor?: string | null;
  guideLineColor?: string | null;
  sliceBorderColor?: string | null;
  shadowColor?: string | null;
  defaultInnerRadius?: number | null;
  defaultOuterRadius?: number | null;
  defaultLabelMode?: "outside" | "inside" | "center" | "hidden" | string;
};

export type ThemeVariantBar = {
  palette?: string[];
  labelColor?: string | null;
  legendColor?: string | null;
  axisColor?: string | null;
  axisLabelColor?: string | null;
  splitLineColor?: string | null;
  barBorderRadius?: number | null;
};

export type ThemeVariantHorizontalBar = {
  palette?: string[];
  labelColor?: string | null;
  legendColor?: string | null;
  axisColor?: string | null;
  axisLabelColor?: string | null;
  splitLineColor?: string | null;
  barBorderRadius?: number | null;
  colorCount?: 1 | 3 | 5 | number | null;
};

export type ThemeVariantLine = {
  palette?: string[];
  lineWidth?: number | null;
  lineSmooth?: boolean;
  showSymbol?: boolean | null;
  symbolSize?: number | null;
  labelPosition?: "top" | "bottom" | "left" | "right" | "inside" | string | null;
  pointBorderColor?: string | null;
  areaOpacity?: number | null;
  axisColor?: string | null;
  axisLabelColor?: string | null;
  splitLineColor?: string | null;
};

export type ThemeVariantCombo = {
  palette?: string[];
  labelColor?: string | null;
  legendColor?: string | null;
  axisColor?: string | null;
  axisLabelColor?: string | null;
  splitLineColor?: string | null;
  barBorderRadius?: number | null;
  lineWidth?: number | null;
  lineSmooth?: boolean | null;
  showSymbol?: boolean | null;
  symbolSize?: number | null;
  labelPosition?: "top" | "bottom" | "left" | "right" | "inside" | string | null;
  pointBorderColor?: string | null;
  areaOpacity?: number | null;
  maxPointColor?: string | null;
  minPointColor?: string | null;
};

export type ThemeVariantScatter = {
  palette?: string[];
  labelColor?: string | null;
  legendColor?: string | null;
  axisColor?: string | null;
  axisLabelColor?: string | null;
  splitLineColor?: string | null;
  symbolSize?: number | null;
  pointBorderColor?: string | null;
  pointBorderWidth?: number | null;
  pointOpacity?: number | null;
  labelPosition?: "top" | "bottom" | "left" | "right" | "inside" | string | null;
};

export type ThemeVariantRadar = {
  palette?: string[];
  gridLineColor?: string | null;
  indicatorTextColor?: string | null;
  areaOpacity?: number | null;
  pointColor?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export type ThemeVariantMap = {
  regionPalette?: string[];
  regionBorderColor?: string | null;
  labelColor?: string | null;
  visualMapTextColor?: string | null;
};

export type ThemeVariantSankey = {
  palette?: string[];
  labelColor?: string | null;
  nodeBorderColor?: string | null;
  nodeBorderWidth?: number | null;
  nodeBorderRadius?: number | null;
  linkOpacity?: number | null;
  linkCurveness?: number | null;
};

export type ThemeVariantGauge = {
  palette?: string[];
  pointerColor?: string | null;
  detailColor?: string | null;
  titleColor?: string | null;
  axisLabelColor?: string | null;
  splitLineColor?: string | null;
  startAngle?: number | null;
  endAngle?: number | null;
  radius?: string | number | null;
  progressWidth?: number | null;
  axisLineWidth?: number | null;
  pointerLength?: string | number | null;
  detailFontSize?: number | null;
  detailFontWeight?: number | null;
  titleFontSize?: number | null;
};

export type ThemeVariantFunnel = {
  palette?: string[];
  labelColor?: string | null;
  valueColor?: string | null;
  guideLineColor?: string | null;
  blockBorderColor?: string | null;
  blockBorderWidth?: number | null;
  itemGap?: number | null;
  sortOrder?: "descending" | "ascending" | "none" | string | null;
};

export type ThemeVariantWordCloud = {
  palette?: string[];
  shape?: string | null;
  gridSize?: number | null;
  rotationStep?: number | null;
  minFontSize?: number | null;
  maxFontSize?: number | null;
  fontWeight?: number | null;
  textShadowColor?: string | null;
  textShadowBlur?: number | null;
};

export type ThemeVariantKpi = {
  valueColor?: string | null;
  labelColor?: string | null;
  compareColor?: string | null;
  dividerColor?: string | null;
  itemBackgroundColor?: string | null;
  flipperBackground?: string | null;
  flipperBackgroundType?: "solid" | "gradient" | "image" | string;
  flipperBackgroundColor?: string | null;
  flipperBackgroundGradient?: string | null;
  flipperBackgroundImage?: string | null;
  progressTrackColor?: string | null;
  progressFillColor?: string | null;
};

export type ThemeVariantTable = {
  headerBackground?: string | null;
  headerTextColor?: string | null;
  rowBackground?: string | null;
  rowAlternateBackground?: string | null;
  rowBorderColor?: string | null;
};

export type ThemeVariantTabs = {
  tabBarBackground?: string | null;
  activeTextColor?: string | null;
  inactiveTextColor?: string | null;
  activeBackground?: string | null;
  indicatorColor?: string | null;
};

export type ThemeTemplateChartVariants = {
  pie?: ThemeVariantPie;
  bar?: ThemeVariantBar;
  horizontalBar?: ThemeVariantHorizontalBar;
  line?: ThemeVariantLine;
  area?: ThemeVariantLine;
  radar?: ThemeVariantRadar;
  scatter?: ThemeVariantScatter;
  combo?: ThemeVariantCombo;
  map?: ThemeVariantMap;
  treemap?: Record<string, unknown>;
  sankey?: ThemeVariantSankey;
  gauge?: ThemeVariantGauge;
  funnel?: ThemeVariantFunnel;
  wordCloud?: ThemeVariantWordCloud;
  kpi?: ThemeVariantKpi;
  table?: ThemeVariantTable;
  tabs?: ThemeVariantTabs;
  [key: string]: unknown;
};

export type ThemeTemplateRecord = {
  id: number;
  themeName: string;
  themeCode: string;
  category: string;
  description?: string | null;
  isBuiltin: boolean;
  status: ThemeStatus | string;
  previewImage?: string | null;
  createdBy?: string;
  canvas?: ThemeTemplateCanvas;
  chrome?: ThemeTemplateChrome;
  semantic?: ThemeTemplateSemantic;
  chartCommon?: ThemeTemplateChartCommon;
  chartVariants?: ThemeTemplateChartVariants;
  createdAt?: string;
  updatedAt?: string;
};

export type DashboardThemeSettings = {
  defaultInheritTheme: boolean;
  inheritCanvasBackground: boolean;
  allowWidgetThemeOverride: boolean;
};

export type WidgetThemeState = {
  inheritDashboardTheme: boolean;
  widgetThemeTemplateId?: number | null;
  widgetThemeOverrides?: Record<string, unknown>;
};

export type ResolvedThemeTokens = {
  templateId: number | null;
  templateName: string;
  canvas: ThemeTemplateCanvas;
  chrome: ThemeTemplateChrome;
  semantic: ThemeTemplateSemantic;
  chartCommon: ThemeTemplateChartCommon;
  chartVariant: Record<string, unknown>;
};
