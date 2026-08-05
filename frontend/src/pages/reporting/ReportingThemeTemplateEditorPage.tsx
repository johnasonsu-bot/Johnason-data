import { RollbackOutlined, SaveOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Select, Space, Spin, Switch, Tabs, Typography, Upload, message } from "antd";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { createReportingThemeTemplate, fetchReportingThemeTemplates, updateReportingThemeTemplate } from "../../services/reporting";
import type { ReportingThemeTemplateRecord } from "../../types/api";

const CATEGORY_PRESETS: Record<string, { solid: string[]; gradient: Array<{ start: string; end: string; direction: string }>; image: string[] }> = {
  中性色: {
    solid: ["#f7f8fa", "#f8fafc", "#fbfdff", "#f4f7fb"],
    gradient: [
      { start: "#f7f9fc", end: "#eef3fa", direction: "180deg" },
      { start: "#ffffff", end: "#edf2f7", direction: "180deg" },
    ],
    image: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%25' stop-color='%23f7f9fc'/><stop offset='100%25' stop-color='%23eef3fa'/></linearGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>",
    ],
  },
  深色系: {
    solid: ["#08111f", "#121212", "#171222", "#0a0f1a"],
    gradient: [
      { start: "#08111f", end: "#10223f", direction: "180deg" },
      { start: "#171222", end: "#312e81", direction: "180deg" },
    ],
    image: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%2308111f'/><stop offset='100%25' stop-color='%2310223f'/></linearGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>",
    ],
  },
  蓝青系: {
    solid: ["#f5f9ff", "#eef8ff", "#f7fbff", "#dceaff"],
    gradient: [
      { start: "#f5f9ff", end: "#dceaff", direction: "180deg" },
      { start: "#08101d", end: "#10223f", direction: "90deg" },
    ],
    image: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='0'><stop offset='0%25' stop-color='%23f5f9ff'/><stop offset='100%25' stop-color='%23dceaff'/></linearGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>",
    ],
  },
  青绿系: {
    solid: ["#eff8f2", "#effcf6", "#f3fbf8", "#e8f7ef"],
    gradient: [
      { start: "#eff8f2", end: "#d8efe0", direction: "180deg" },
      { start: "#0d1f28", end: "#1f4f5a", direction: "180deg" },
    ],
    image: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%25' stop-color='%23eff8f2'/><stop offset='100%25' stop-color='%23d8efe0'/></linearGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>",
    ],
  },
  暖米系: {
    solid: ["#fbf8f2", "#fff8f5", "#fff9f2", "#fffdf9"],
    gradient: [
      { start: "#fff9f2", end: "#f6ead7", direction: "180deg" },
      { start: "#fbf8f2", end: "#efe3cf", direction: "90deg" },
    ],
    image: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='0'><stop offset='0%25' stop-color='%23fbf8f2'/><stop offset='100%25' stop-color='%23efe3cf'/></linearGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>",
    ],
  },
  冷紫系: {
    solid: ["#f7f5ff", "#f5f3ff", "#171222", "#312e81"],
    gradient: [
      { start: "#f7f5ff", end: "#e4dcff", direction: "180deg" },
      { start: "#171222", end: "#312e81", direction: "180deg" },
    ],
    image: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%23171222'/><stop offset='100%25' stop-color='%23312e81'/></linearGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>",
    ],
  },
};
const GRADIENT_DIRECTION_OPTIONS = [
  { value: "to bottom", label: "自上而下", icon: "↓" },
  { value: "to top", label: "自下而上", icon: "↑" },
  { value: "to right", label: "自左向右", icon: "→" },
  { value: "to left", label: "自右向左", icon: "←" },
  { value: "to bottom right", label: "左上到右下", icon: "↘" },
  { value: "to top right", label: "左下到右上", icon: "↗" },
];

const WORD_CLOUD_SHAPE_OPTIONS = [
  { value: "circle", label: "圆形" },
  { value: "cardioid", label: "心形" },
  { value: "diamond", label: "菱形" },
  { value: "triangle-forward", label: "正向三角" },
  { value: "triangle", label: "三角形" },
  { value: "pentagon", label: "五边形" },
  { value: "star", label: "星形" },
];

function resolveWordCloudPreviewRotationRange(step: number) {
  const normalizedStep = Number.isFinite(step) ? step : 45;
  if (normalizedStep <= 0) {
    return [0, 0] as const;
  }
  const max = normalizedStep >= 90 ? 90 : normalizedStep * 2;
  return [-max, max] as const;
}

function getWordCloudPreviewClipPath(shape: string) {
  if (shape === "cardioid") return "polygon(50% 18%, 62% 6%, 82% 10%, 92% 28%, 88% 48%, 72% 66%, 50% 92%, 28% 66%, 12% 48%, 8% 28%, 18% 10%, 38% 6%)";
  if (shape === "diamond") return "polygon(50% 6%, 92% 50%, 50% 94%, 8% 50%)";
  if (shape === "triangle-forward") return "polygon(10% 10%, 92% 50%, 10% 90%)";
  if (shape === "triangle") return "polygon(50% 6%, 92% 92%, 8% 92%)";
  if (shape === "pentagon") return "polygon(50% 4%, 92% 34%, 78% 92%, 22% 92%, 8% 34%)";
  if (shape === "star") return "polygon(50% 4%, 61% 36%, 96% 36%, 68% 56%, 79% 90%, 50% 70%, 21% 90%, 32% 56%, 4% 36%, 39% 36%)";
  return "circle(48% at 50% 50%)";
}

function clampGaugePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function resolveGaugePreviewLength(value: unknown, fullLength: number, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (text.endsWith("%")) {
    const percent = Number(text.replace("%", ""));
    return Number.isFinite(percent) ? (fullLength * percent) / 100 : fallback;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getGaugePreviewPoint(cx: number, cy: number, radius: number, angle: number) {
  const radian = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + Math.cos(radian) * radius,
    y: cy + Math.sin(radian) * radius,
  };
}

function buildGaugePreviewArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = getGaugePreviewPoint(cx, cy, radius, startAngle);
  const end = getGaugePreviewPoint(cx, cy, radius, endAngle);
  const delta = endAngle - startAngle;
  const largeArcFlag = Math.abs(delta) > 180 ? 1 : 0;
  const sweepFlag = delta >= 0 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArcFlag} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function resolveCanvasBackground(values: Record<string, unknown>) {
  if (values.canvasBackgroundType === "image" && values.canvasBackgroundImage) {
    return {
      backgroundImage: `url(${String(values.canvasBackgroundImage)})`,
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundColor: "transparent",
    };
  }
  if (values.canvasBackgroundType === "gradient") {
    const direction = String(values.canvasGradientDirection || "to bottom");
    const start = String(values.canvasGradientStart || "#f7f9fc");
    const end = String(values.canvasGradientEnd || "#eef3fa");
    const directionMap: Record<string, string> = {
      "to bottom": "to bottom",
      "to top": "to top",
      "to right": "to right",
      "to left": "to left",
      "to bottom right": "to bottom right",
      "to top right": "to top right",
    };
    return {
      backgroundImage: `linear-gradient(${directionMap[direction] || "to bottom"}, ${start} 0%, ${end} 100%)`,
      backgroundColor: start,
    };
  }
  return {
    backgroundImage: "none",
    backgroundColor: String(values.canvasBackgroundColor || "#f7f9fc"),
  };
}

function extractGradientParts(gradientText?: string | null) {
  const text = String(gradientText || "");
  const match = text.match(/linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+0%,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+100%\)/i);
  if (!match) {
    return null;
  }
  const rawDirection = match[1].trim();
  const direction = rawDirection === "180deg" ? "to bottom"
    : rawDirection === "0deg" ? "to top"
      : rawDirection === "90deg" ? "to right"
        : rawDirection === "270deg" ? "to left"
          : rawDirection === "135deg" ? "to bottom right"
            : rawDirection === "45deg" ? "to top right"
              : rawDirection;
  return {
    direction,
    start: match[2].trim(),
    end: match[3].trim(),
  };
}

function buildKpiFlipperBackground(primary?: string, itemBackground?: string, category?: string) {
  const main = String(primary || "#1677ff");
  const card = String(itemBackground || "#ffffff");
  if (category === "深色系") {
    return `linear-gradient(180deg, ${main} 0%, ${card} 100%)`;
  }
  if (category === "暖米系") {
    return `linear-gradient(180deg, ${main} 0%, #5f432d 100%)`;
  }
  if (category === "青绿系") {
    return `linear-gradient(180deg, ${main} 0%, #14532d 100%)`;
  }
  if (category === "冷紫系") {
    return `linear-gradient(180deg, ${main} 0%, #312e81 100%)`;
  }
  return `linear-gradient(180deg, ${main} 0%, ${card} 100%)`;
}

function extractFlipperBackgroundFormValues(background: Record<string, unknown> | null | undefined, primary?: string, itemBackground?: string, category?: string) {
  const fallback = buildKpiFlipperBackground(primary, itemBackground, category);
  const source = background || {};
  const backgroundType = String(source.flipperBackgroundType || "").trim();
  const gradientParts = extractGradientParts(String(source.flipperBackgroundGradient || source.flipperBackground || fallback));
  return {
    kpiFlipperBackgroundType: backgroundType || (source.flipperBackgroundImage ? "image" : source.flipperBackgroundGradient ? "gradient" : source.flipperBackgroundColor ? "solid" : "gradient"),
    kpiFlipperBackgroundColor: String(source.flipperBackgroundColor || primary || "#1677ff"),
    kpiFlipperGradientStart: gradientParts?.start || String(primary || "#1677ff"),
    kpiFlipperGradientEnd: gradientParts?.end || String(itemBackground || "#ffffff"),
    kpiFlipperGradientDirection: gradientParts?.direction || "to bottom",
    kpiFlipperBackgroundImage: String(source.flipperBackgroundImage || ""),
  };
}

function buildFlipperBackgroundPayload(values: Record<string, unknown>) {
  const backgroundType = String(values.kpiFlipperBackgroundType || "gradient");
  const backgroundColor = backgroundType === "solid" ? String(values.kpiFlipperBackgroundColor || "#1677ff") : null;
  const backgroundGradient = backgroundType === "gradient"
    ? `linear-gradient(${values.kpiFlipperGradientDirection || "to bottom"}, ${values.kpiFlipperGradientStart || "#1677ff"} 0%, ${values.kpiFlipperGradientEnd || "#ffffff"} 100%)`
    : null;
  const backgroundImage = backgroundType === "image" ? String(values.kpiFlipperBackgroundImage || "") : "";
  return {
    flipperBackgroundType: backgroundType,
    flipperBackgroundColor: backgroundColor,
    flipperBackgroundGradient: backgroundGradient,
    flipperBackgroundImage: backgroundImage || null,
    flipperBackground: backgroundType === "image"
      ? `url(${backgroundImage}) center/cover no-repeat`
      : (backgroundType === "solid" ? backgroundColor : backgroundGradient),
  };
}

function extractChromeBackgroundFormValues(chrome: Record<string, unknown> | null | undefined) {
  const source = chrome || {};
  const gradientParts = extractGradientParts(String(source.backgroundGradient || ""));
  return {
    chromeBackgroundType: source.backgroundType || (source.backgroundImage ? "image" : source.backgroundGradient ? "gradient" : "solid"),
    chromeBackground: String(source.backgroundColor || "#ffffff"),
    chromeBackgroundColor: String(source.backgroundColor || "#ffffff"),
    chromeGradientStart: gradientParts?.start || "#ffffff",
    chromeGradientEnd: gradientParts?.end || "#f5f7fb",
    chromeGradientDirection: gradientParts?.direction || "to bottom",
    chromeBackgroundImage: String(source.backgroundImage || ""),
  };
}

function buildChromeBackgroundPayload(values: Record<string, unknown>) {
  const backgroundType = String(values.chromeBackgroundType || "solid");
  const backgroundColor = backgroundType === "solid"
    ? String(values.chromeBackgroundColor || values.chromeBackground || "#ffffff")
    : null;
  const backgroundGradient = backgroundType === "gradient"
    ? `linear-gradient(${values.chromeGradientDirection || "to bottom"}, ${values.chromeGradientStart || "#ffffff"} 0%, ${values.chromeGradientEnd || "#f5f7fb"} 100%)`
    : null;
  const backgroundImage = backgroundType === "image" ? String(values.chromeBackgroundImage || "") : "";
  return {
    backgroundType,
    backgroundColor,
    backgroundGradient,
    backgroundImage: backgroundImage || null,
  };
}

function ThemeColorField({
  form,
  name,
  label,
}: {
  form: any;
  name: string;
  label: string;
}) {
  return (
    <Form.Item noStyle shouldUpdate>
      {() => {
        const value = String(form.getFieldValue(name) || "#ffffff");
        const safeValue = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "#ffffff";
        return (
          <Card size="small" title={label} styles={{ body: { padding: 12 } }}>
            <Form.Item name={name} noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Space align="center" size={12}>
              <input
                type="color"
                value={safeValue}
                onChange={(event) => form.setFieldValue(name, event.target.value)}
                style={{
                  width: 48,
                  height: 48,
                  padding: 0,
                  border: "1px solid #d6deea",
                  borderRadius: 12,
                  background: "#fff",
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  border: "1px solid #d6deea",
                  background: safeValue,
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.24)",
                }}
              />
              <Input
                value={value}
                onChange={(event) => form.setFieldValue(name, event.target.value)}
                style={{ width: 132 }}
              />
            </Space>
          </Card>
        );
      }}
    </Form.Item>
  );
}

export function ReportingThemeTemplateEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const templateId = params.id ? Number(params.id) : null;
  const isEditMode = Number.isFinite(templateId) && templateId !== null;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState("canvasBackground");
  const [records, setRecords] = useState<ReportingThemeTemplateRecord[]>([]);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown>>({
    category: "general",
    status: "draft",
    isBuiltin: false,
    canvasBackgroundType: "solid",
    canvasBackgroundColor: "#f7f9fc",
    canvasGradientStart: "#f7f9fc",
    canvasGradientEnd: "#eef3fa",
    canvasGradientDirection: "to bottom",
    canvasBackgroundImage: "",
    dashboardTitleColor: "#101828",
    chromeBackgroundType: "solid",
    chromeBackground: "#ffffff",
    chromeBackgroundColor: "#ffffff",
    chromeGradientStart: "#ffffff",
    chromeGradientEnd: "#f5f7fb",
    chromeGradientDirection: "to bottom",
    chromeBackgroundImage: "",
    chromeBorder: "#dce6f5",
    titleColor: "#101828",
    primary: "#1677ff",
    kpiValueColor: "#1677ff",
    kpiLabelColor: "#667085",
    kpiDividerColor: "#dce6f5",
    kpiItemBackgroundColor: "#ffffff",
    kpiFlipperBackgroundType: "gradient",
    kpiFlipperBackgroundColor: "#1677ff",
    kpiFlipperGradientStart: "#1677ff",
    kpiFlipperGradientEnd: "#ffffff",
    kpiFlipperGradientDirection: "to bottom",
    kpiFlipperBackgroundImage: "",
    kpiCompareColor: "#1677ff",
    pieCenterTitleColor: "#667085",
    pieCenterValueColor: "#101828",
    pieCenterUnitColor: "#101828",
    pieCenterMetaColor: "#98a2b3",
    pieLabelColor: "#344054",
    pieValueColor: "#101828",
    pieGuideLineColor: "#98a2b3",
    pieSliceBorderColor: "#ffffff",
    pieShadowColor: "rgba(15,23,42,0.14)",
    piePalette1: "#1677ff",
    piePalette2: "#4f8cff",
    piePalette3: "#76a8ff",
    piePalette4: "#9cc3ff",
    piePalette5: "#c6dcff",
    pieDefaultInnerRadius: 52,
    pieDefaultOuterRadius: 82,
    pieDefaultLabelMode: "outside",
    barPalette1: "#1677ff",
    barPalette2: "#43c7c6",
    barLabelColor: "#ffffff",
    barLegendColor: "#344054",
    barAxisColor: "#98a2b3",
    barAxisLabelColor: "#344054",
    barSplitLineColor: "#e5e7eb",
    barBorderRadius: 8,
    linePalette1: "#1677ff",
    linePalette2: "#4f8cff",
    linePalette3: "#76a8ff",
    linePalette4: "#9cc3ff",
    lineWidth: 3,
    lineSmooth: true,
    lineShowSymbol: true,
    lineSymbolSize: 6,
    lineAreaOpacity: 0.18,
    lineLabelPosition: "top",
    lineAxisColor: "#98a2b3",
    lineAxisLabelColor: "#344054",
    lineSplitLineColor: "#e5e7eb",
    comboPalette1: "#1677ff",
    comboPalette2: "#f4b95d",
    comboLabelColor: "#344054",
    comboLegendColor: "#344054",
    comboAxisColor: "#98a2b3",
    comboAxisLabelColor: "#344054",
    comboSplitLineColor: "#e5e7eb",
    comboBarBorderRadius: 8,
    comboLineWidth: 3,
    comboLineSmooth: true,
    comboLineShowSymbol: true,
    comboLineSymbolSize: 6,
    comboLineAreaOpacity: 0.18,
    comboLineLabelPosition: "top",
    comboMaxPointColor: "#f59e0b",
    comboMinPointColor: "#12b76a",
    scatterPalette1: "#1677ff",
    scatterPalette2: "#43c7c6",
    scatterPalette3: "#f4b95d",
    scatterPalette4: "#8f7cff",
    scatterPalette5: "#f28f8f",
    scatterLabelColor: "#344054",
    scatterLegendColor: "#344054",
    scatterAxisColor: "#98a2b3",
    scatterAxisLabelColor: "#344054",
    scatterSplitLineColor: "#e5e7eb",
    scatterPointBorderColor: "#ffffff",
    scatterSymbolSize: 16,
    scatterPointBorderWidth: 1,
    scatterPointOpacity: 0.82,
    scatterLabelPosition: "top",
    horizontalBarPalette1: "#1677ff",
    horizontalBarPalette2: "#43c7c6",
    horizontalBarPalette3: "#f4b95d",
    horizontalBarPalette4: "#8f7cff",
    horizontalBarPalette5: "#f28f8f",
    horizontalBarLabelColor: "#ffffff",
    horizontalBarLegendColor: "#344054",
    horizontalBarAxisColor: "#98a2b3",
    horizontalBarAxisLabelColor: "#344054",
    horizontalBarSplitLineColor: "#e5e7eb",
    horizontalBarBorderRadius: 10,
    horizontalBarColorCount: 5,
    sankeyPalette1: "#1677ff",
    sankeyPalette2: "#43c7c6",
    sankeyPalette3: "#f4b95d",
    sankeyPalette4: "#8f7cff",
    sankeyPalette5: "#f28f8f",
    sankeyLabelColor: "#344054",
    sankeyNodeBorderColor: "#ffffff",
    sankeyNodeBorderWidth: 1,
    sankeyNodeBorderRadius: 4,
    sankeyLinkOpacity: 0.28,
    sankeyLinkCurveness: 0.5,
    gaugePalette1: "#1677ff",
    gaugePalette2: "#43c7c6",
    gaugePalette3: "#f4b95d",
    gaugePalette4: "#8f7cff",
    gaugePalette5: "#f28f8f",
    gaugePointerColor: "#1677ff",
    gaugeDetailColor: "#101828",
    gaugeTitleColor: "#667085",
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
    funnelPalette1: "#1677ff",
    funnelPalette2: "#43c7c6",
    funnelPalette3: "#f4b95d",
    funnelPalette4: "#8f7cff",
    funnelPalette5: "#f28f8f",
    funnelLabelColor: "#344054",
    funnelValueColor: "#101828",
    funnelGuideLineColor: "#98a2b3",
    funnelBlockBorderColor: "#ffffff",
    funnelBlockBorderWidth: 1,
    funnelItemGap: 2,
    funnelSortOrder: "descending",
    wordCloudPalette1: "#1677ff",
    wordCloudPalette2: "#43c7c6",
    wordCloudPalette3: "#f4b95d",
    wordCloudPalette4: "#8f7cff",
    wordCloudPalette5: "#f28f8f",
    wordCloudShape: "circle",
    wordCloudGridSize: 10,
    wordCloudRotationStep: 45,
    wordCloudMinFontSize: 12,
    wordCloudMaxFontSize: 40,
    wordCloudFontWeight: 700,
    wordCloudTextShadowColor: "rgba(15,23,42,0.14)",
    wordCloudTextShadowBlur: 10,
    radarPalette1: "#1677ff",
    radarPalette2: "#4f8cff",
    radarPalette3: "#76a8ff",
    radarPalette4: "#9cc3ff",
    radarGridLineColor: "#dbe7f3",
    radarIndicatorTextColor: "#344054",
    radarAreaOpacity: 0.22,
    radarPointColor: "#1677ff",
    mapPalette1: "#eef5ff",
    mapPalette2: "#d5e6ff",
    mapPalette3: "#9cc3ff",
    mapPalette4: "#4f8cff",
    mapPalette5: "#1677ff",
    mapRegionBorderColor: "#8fb1d6",
    mapLabelColor: "#344054",
    mapVisualMapTextColor: "#344054",
    tabsTabBarBackground: "#f5f7fb",
    tabsActiveTextColor: "#1677ff",
    tabsInactiveTextColor: "#667085",
    tabsActiveBackground: "#ffffff",
    tabsIndicatorColor: "#1677ff",
  });

  useEffect(() => {
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        const response = await fetchReportingThemeTemplates(token);
        const list = response.data || [];
        setRecords(list);
        const current = list.find((item) => item.id === templateId) || null;
        if (current) {
          const pieVariant = (current.chartVariants?.pie || {}) as Record<string, unknown>;
          const kpiVariant = (current.chartVariants?.kpi || {}) as Record<string, unknown>;
          const tabsVariant = (current.chartVariants?.tabs || {}) as Record<string, unknown>;
          const barVariant = (current.chartVariants?.bar || {}) as Record<string, unknown>;
          const lineVariant = (current.chartVariants?.line || {}) as Record<string, unknown>;
          const comboVariant = (current.chartVariants?.combo || {}) as Record<string, unknown>;
          const scatterVariant = (current.chartVariants?.scatter || {}) as Record<string, unknown>;
          const horizontalBarVariant = (current.chartVariants?.horizontalBar || {}) as Record<string, unknown>;
          const sankeyVariant = (current.chartVariants?.sankey || {}) as Record<string, unknown>;
          const gaugeVariant = (current.chartVariants?.gauge || {}) as Record<string, unknown>;
          const funnelVariant = (current.chartVariants?.funnel || {}) as Record<string, unknown>;
          const wordCloudVariant = (current.chartVariants?.wordCloud || {}) as Record<string, unknown>;
          const radarVariant = (current.chartVariants?.radar || {}) as Record<string, unknown>;
          const mapVariant = (current.chartVariants?.map || {}) as Record<string, unknown>;
          const nextInitialValues: Record<string, unknown> = {
            themeName: current.themeName,
            themeCode: current.themeCode,
            category: current.category,
            description: current.description || "",
            status: current.status,
            isBuiltin: current.isBuiltin,
            canvasBackgroundType: current.canvas?.backgroundImage ? "image" : current.canvas?.backgroundGradient ? "gradient" : "solid",
            canvasBackgroundColor: String(current.canvas?.backgroundColor || "#f7f9fc"),
            canvasGradientStart: "#f7f9fc",
            canvasGradientEnd: "#eef3fa",
            canvasGradientDirection: "to bottom",
            canvasBackgroundImage: String(current.canvas?.backgroundImage || ""),
            dashboardTitleColor: String(current.canvas?.dashboardTitleColor || current.chrome?.titleColor || "#101828"),
            chromeBackground: String(current.chrome?.backgroundColor || "#ffffff"),
            chromeBorder: String(current.chrome?.borderColor || "#dce6f5"),
            titleColor: String(current.chrome?.titleColor || "#101828"),
            primary: String(current.semantic?.primary || "#1677ff"),
            kpiValueColor: String(kpiVariant.valueColor || current.semantic?.primary || "#1677ff"),
            kpiLabelColor: String(kpiVariant.labelColor || "#667085"),
            kpiDividerColor: String(kpiVariant.dividerColor || current.chrome?.borderColor || "#dce6f5"),
            kpiItemBackgroundColor: String(kpiVariant.itemBackgroundColor || current.chrome?.backgroundColor || "#ffffff"),
            kpiCompareColor: String(kpiVariant.compareColor || current.semantic?.primary || "#1677ff"),
            pieCenterTitleColor: String(pieVariant.centerTitleColor || "#667085"),
            pieCenterValueColor: String(pieVariant.centerValueColor || "#101828"),
            pieCenterUnitColor: String(pieVariant.centerUnitColor || "#101828"),
            pieCenterMetaColor: String(pieVariant.centerMetaColor || "#98a2b3"),
            pieLabelColor: String(pieVariant.labelColor || "#344054"),
            pieValueColor: String(pieVariant.valueColor || "#101828"),
            pieGuideLineColor: String(pieVariant.guideLineColor || "#98a2b3"),
            pieSliceBorderColor: String(pieVariant.sliceBorderColor || "#ffffff"),
            pieShadowColor: String(pieVariant.shadowColor || "rgba(15,23,42,0.14)"),
            piePalette1: String(((pieVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            piePalette2: String(((pieVariant.palette as string[] | undefined) || [])[1] || "#4f8cff"),
            piePalette3: String(((pieVariant.palette as string[] | undefined) || [])[2] || "#76a8ff"),
            piePalette4: String(((pieVariant.palette as string[] | undefined) || [])[3] || "#9cc3ff"),
            piePalette5: String(((pieVariant.palette as string[] | undefined) || [])[4] || "#c6dcff"),
            pieDefaultInnerRadius: Number(pieVariant.defaultInnerRadius || 52),
            pieDefaultOuterRadius: Number(pieVariant.defaultOuterRadius || 82),
            pieDefaultLabelMode: String(pieVariant.defaultLabelMode || "outside"),
            barPalette1: String(((barVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            barPalette2: String(((barVariant.palette as string[] | undefined) || [])[1] || "#43c7c6"),
            barLabelColor: String(barVariant.labelColor || "#ffffff"),
            barLegendColor: String(barVariant.legendColor || "#344054"),
            barAxisColor: String(barVariant.axisColor || "#98a2b3"),
            barAxisLabelColor: String(barVariant.axisLabelColor || "#344054"),
            barSplitLineColor: String(barVariant.splitLineColor || "#e5e7eb"),
            barBorderRadius: Number(barVariant.barBorderRadius || 8),
            linePalette1: String(((lineVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            linePalette2: String(((lineVariant.palette as string[] | undefined) || [])[1] || "#4f8cff"),
            linePalette3: String(((lineVariant.palette as string[] | undefined) || [])[2] || "#76a8ff"),
            linePalette4: String(((lineVariant.palette as string[] | undefined) || [])[3] || "#9cc3ff"),
            lineWidth: Number(lineVariant.lineWidth || 3),
            lineSmooth: lineVariant.lineSmooth !== false,
            lineShowSymbol: lineVariant.showSymbol !== false,
            lineSymbolSize: Number(lineVariant.symbolSize || 6),
            lineAreaOpacity: Number(lineVariant.areaOpacity || 0.18),
            lineLabelPosition: String(lineVariant.labelPosition || "top"),
            lineAxisColor: String(lineVariant.axisColor || "#98a2b3"),
            lineAxisLabelColor: String(lineVariant.axisLabelColor || "#344054"),
            lineSplitLineColor: String(lineVariant.splitLineColor || "#e5e7eb"),
            comboPalette1: String(((comboVariant.palette as string[] | undefined) || [])[0] || ((barVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            comboPalette2: String(((comboVariant.palette as string[] | undefined) || [])[1] || ((lineVariant.palette as string[] | undefined) || [])[1] || "#f4b95d"),
            comboLabelColor: String(comboVariant.labelColor || barVariant.labelColor || current.chrome?.titleColor || "#344054"),
            comboLegendColor: String(comboVariant.legendColor || barVariant.legendColor || "#344054"),
            comboAxisColor: String(comboVariant.axisColor || lineVariant.axisColor || barVariant.axisColor || "#98a2b3"),
            comboAxisLabelColor: String(comboVariant.axisLabelColor || lineVariant.axisLabelColor || barVariant.axisLabelColor || "#344054"),
            comboSplitLineColor: String(comboVariant.splitLineColor || lineVariant.splitLineColor || barVariant.splitLineColor || "#e5e7eb"),
            comboBarBorderRadius: Number(comboVariant.barBorderRadius || barVariant.barBorderRadius || 8),
            comboLineWidth: Number(comboVariant.lineWidth || lineVariant.lineWidth || 3),
            comboLineSmooth: comboVariant.lineSmooth !== false && lineVariant.lineSmooth !== false,
            comboLineShowSymbol: comboVariant.showSymbol !== false && lineVariant.showSymbol !== false,
            comboLineSymbolSize: Number(comboVariant.symbolSize || lineVariant.symbolSize || 6),
            comboLineAreaOpacity: Number(comboVariant.areaOpacity || lineVariant.areaOpacity || 0.18),
            comboLineLabelPosition: String(comboVariant.labelPosition || lineVariant.labelPosition || "top"),
            comboMaxPointColor: String(comboVariant.maxPointColor || current.semantic?.warning || "#f59e0b"),
            comboMinPointColor: String(comboVariant.minPointColor || current.semantic?.success || "#12b76a"),
            scatterPalette1: String(((scatterVariant.palette as string[] | undefined) || [])[0] || ((lineVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            scatterPalette2: String(((scatterVariant.palette as string[] | undefined) || [])[1] || ((lineVariant.palette as string[] | undefined) || [])[1] || "#43c7c6"),
            scatterPalette3: String(((scatterVariant.palette as string[] | undefined) || [])[2] || ((lineVariant.palette as string[] | undefined) || [])[2] || "#f4b95d"),
            scatterPalette4: String(((scatterVariant.palette as string[] | undefined) || [])[3] || ((lineVariant.palette as string[] | undefined) || [])[3] || "#8f7cff"),
            scatterPalette5: String(((scatterVariant.palette as string[] | undefined) || [])[4] || ((lineVariant.palette as string[] | undefined) || [])[4] || "#f28f8f"),
            scatterLabelColor: String(scatterVariant.labelColor || lineVariant.axisLabelColor || current.chrome?.titleColor || "#344054"),
            scatterLegendColor: String(scatterVariant.legendColor || current.chartCommon?.legendColor || current.chrome?.titleColor || "#344054"),
            scatterAxisColor: String(scatterVariant.axisColor || lineVariant.axisColor || "#98a2b3"),
            scatterAxisLabelColor: String(scatterVariant.axisLabelColor || lineVariant.axisLabelColor || "#344054"),
            scatterSplitLineColor: String(scatterVariant.splitLineColor || lineVariant.splitLineColor || "#e5e7eb"),
            scatterPointBorderColor: String(scatterVariant.pointBorderColor || lineVariant.pointBorderColor || current.chrome?.backgroundColor || "#ffffff"),
            scatterSymbolSize: Number(scatterVariant.symbolSize ?? 16),
            scatterPointBorderWidth: Number(scatterVariant.pointBorderWidth ?? 1),
            scatterPointOpacity: Number(scatterVariant.pointOpacity ?? 0.82),
            scatterLabelPosition: String(scatterVariant.labelPosition || lineVariant.labelPosition || "top"),
            horizontalBarPalette1: String(((horizontalBarVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            horizontalBarPalette2: String(((horizontalBarVariant.palette as string[] | undefined) || [])[1] || "#43c7c6"),
            horizontalBarPalette3: String(((horizontalBarVariant.palette as string[] | undefined) || [])[2] || "#f4b95d"),
            horizontalBarPalette4: String(((horizontalBarVariant.palette as string[] | undefined) || [])[3] || "#8f7cff"),
            horizontalBarPalette5: String(((horizontalBarVariant.palette as string[] | undefined) || [])[4] || "#f28f8f"),
            horizontalBarLabelColor: String(horizontalBarVariant.labelColor || "#ffffff"),
            horizontalBarLegendColor: String(horizontalBarVariant.legendColor || "#344054"),
            horizontalBarAxisColor: String(horizontalBarVariant.axisColor || "#98a2b3"),
            horizontalBarAxisLabelColor: String(horizontalBarVariant.axisLabelColor || "#344054"),
            horizontalBarSplitLineColor: String(horizontalBarVariant.splitLineColor || "#e5e7eb"),
            horizontalBarBorderRadius: Number(horizontalBarVariant.barBorderRadius || 10),
            horizontalBarColorCount: Number(horizontalBarVariant.colorCount || (((horizontalBarVariant.palette as string[] | undefined) || []).length >= 5 ? 5 : (((horizontalBarVariant.palette as string[] | undefined) || []).length >= 3 ? 3 : 1))),
            sankeyPalette1: String(((sankeyVariant.palette as string[] | undefined) || [])[0] || ((horizontalBarVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            sankeyPalette2: String(((sankeyVariant.palette as string[] | undefined) || [])[1] || ((horizontalBarVariant.palette as string[] | undefined) || [])[1] || "#43c7c6"),
            sankeyPalette3: String(((sankeyVariant.palette as string[] | undefined) || [])[2] || ((horizontalBarVariant.palette as string[] | undefined) || [])[2] || "#f4b95d"),
            sankeyPalette4: String(((sankeyVariant.palette as string[] | undefined) || [])[3] || ((horizontalBarVariant.palette as string[] | undefined) || [])[3] || "#8f7cff"),
            sankeyPalette5: String(((sankeyVariant.palette as string[] | undefined) || [])[4] || ((horizontalBarVariant.palette as string[] | undefined) || [])[4] || "#f28f8f"),
            sankeyLabelColor: String(sankeyVariant.labelColor || horizontalBarVariant.axisLabelColor || "#344054"),
            sankeyNodeBorderColor: String(sankeyVariant.nodeBorderColor || pieVariant.sliceBorderColor || "#ffffff"),
            sankeyNodeBorderWidth: Number(sankeyVariant.nodeBorderWidth || 1),
            sankeyNodeBorderRadius: Number(sankeyVariant.nodeBorderRadius || 4),
            sankeyLinkOpacity: Number(sankeyVariant.linkOpacity || 0.28),
            sankeyLinkCurveness: Number(sankeyVariant.linkCurveness || 0.5),
            gaugePalette1: String(((gaugeVariant.palette as string[] | undefined) || [])[0] || ((horizontalBarVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            gaugePalette2: String(((gaugeVariant.palette as string[] | undefined) || [])[1] || ((horizontalBarVariant.palette as string[] | undefined) || [])[1] || "#43c7c6"),
            gaugePalette3: String(((gaugeVariant.palette as string[] | undefined) || [])[2] || ((horizontalBarVariant.palette as string[] | undefined) || [])[2] || "#f4b95d"),
            gaugePalette4: String(((gaugeVariant.palette as string[] | undefined) || [])[3] || ((horizontalBarVariant.palette as string[] | undefined) || [])[3] || "#8f7cff"),
            gaugePalette5: String(((gaugeVariant.palette as string[] | undefined) || [])[4] || ((horizontalBarVariant.palette as string[] | undefined) || [])[4] || "#f28f8f"),
            gaugePointerColor: String(gaugeVariant.pointerColor || current.semantic?.primary || "#1677ff"),
            gaugeDetailColor: String(gaugeVariant.detailColor || pieVariant.centerValueColor || "#101828"),
            gaugeTitleColor: String(gaugeVariant.titleColor || pieVariant.centerTitleColor || "#667085"),
            gaugeAxisLabelColor: String(gaugeVariant.axisLabelColor || horizontalBarVariant.axisLabelColor || "#344054"),
            gaugeSplitLineColor: String(gaugeVariant.splitLineColor || horizontalBarVariant.axisColor || "#98a2b3"),
            gaugeStartAngle: Number(gaugeVariant.startAngle || 210),
            gaugeEndAngle: Number(gaugeVariant.endAngle || -30),
            gaugeRadius: String(gaugeVariant.radius || "90%"),
            gaugeProgressWidth: Number(gaugeVariant.progressWidth || 18),
            gaugeAxisLineWidth: Number(gaugeVariant.axisLineWidth || gaugeVariant.progressWidth || 18),
            gaugePointerLength: String(gaugeVariant.pointerLength || "58%"),
            gaugeDetailFontSize: Number(gaugeVariant.detailFontSize || 24),
            gaugeDetailFontWeight: Number(gaugeVariant.detailFontWeight || 700),
            gaugeTitleFontSize: Number(gaugeVariant.titleFontSize || 14),
            funnelPalette1: String(((funnelVariant.palette as string[] | undefined) || [])[0] || ((horizontalBarVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            funnelPalette2: String(((funnelVariant.palette as string[] | undefined) || [])[1] || ((horizontalBarVariant.palette as string[] | undefined) || [])[1] || "#43c7c6"),
            funnelPalette3: String(((funnelVariant.palette as string[] | undefined) || [])[2] || ((horizontalBarVariant.palette as string[] | undefined) || [])[2] || "#f4b95d"),
            funnelPalette4: String(((funnelVariant.palette as string[] | undefined) || [])[3] || ((horizontalBarVariant.palette as string[] | undefined) || [])[3] || "#8f7cff"),
            funnelPalette5: String(((funnelVariant.palette as string[] | undefined) || [])[4] || ((horizontalBarVariant.palette as string[] | undefined) || [])[4] || "#f28f8f"),
            funnelLabelColor: String(funnelVariant.labelColor || current.chrome?.titleColor || "#344054"),
            funnelValueColor: String(funnelVariant.valueColor || pieVariant.valueColor || "#101828"),
            funnelGuideLineColor: String(funnelVariant.guideLineColor || pieVariant.guideLineColor || "#98a2b3"),
            funnelBlockBorderColor: String(funnelVariant.blockBorderColor || pieVariant.sliceBorderColor || "#ffffff"),
            funnelBlockBorderWidth: Number(funnelVariant.blockBorderWidth || 1),
            funnelItemGap: Number(funnelVariant.itemGap || 2),
            funnelSortOrder: String(funnelVariant.sortOrder || "descending"),
            wordCloudPalette1: String(((wordCloudVariant.palette as string[] | undefined) || [])[0] || ((horizontalBarVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            wordCloudPalette2: String(((wordCloudVariant.palette as string[] | undefined) || [])[1] || ((horizontalBarVariant.palette as string[] | undefined) || [])[1] || "#43c7c6"),
            wordCloudPalette3: String(((wordCloudVariant.palette as string[] | undefined) || [])[2] || ((horizontalBarVariant.palette as string[] | undefined) || [])[2] || "#f4b95d"),
            wordCloudPalette4: String(((wordCloudVariant.palette as string[] | undefined) || [])[3] || ((horizontalBarVariant.palette as string[] | undefined) || [])[3] || "#8f7cff"),
            wordCloudPalette5: String(((wordCloudVariant.palette as string[] | undefined) || [])[4] || ((horizontalBarVariant.palette as string[] | undefined) || [])[4] || "#f28f8f"),
            wordCloudShape: String(wordCloudVariant.shape || "circle"),
            wordCloudGridSize: Number(wordCloudVariant.gridSize || 10),
            wordCloudRotationStep: Number(wordCloudVariant.rotationStep || 45),
            wordCloudMinFontSize: Number(wordCloudVariant.minFontSize || 12),
            wordCloudMaxFontSize: Number(wordCloudVariant.maxFontSize || 40),
            wordCloudFontWeight: Number(wordCloudVariant.fontWeight || 700),
            wordCloudTextShadowColor: String(wordCloudVariant.textShadowColor || current.chartCommon?.emphasisShadowColor || "rgba(15,23,42,0.14)"),
            wordCloudTextShadowBlur: Number(wordCloudVariant.textShadowBlur || 10),
            radarPalette1: String(((radarVariant.palette as string[] | undefined) || [])[0] || current.semantic?.primary || "#1677ff"),
            radarPalette2: String(((radarVariant.palette as string[] | undefined) || [])[1] || "#4f8cff"),
            radarPalette3: String(((radarVariant.palette as string[] | undefined) || [])[2] || "#76a8ff"),
            radarPalette4: String(((radarVariant.palette as string[] | undefined) || [])[3] || "#9cc3ff"),
            radarGridLineColor: String(radarVariant.gridLineColor || "#dbe7f3"),
            radarIndicatorTextColor: String(radarVariant.indicatorTextColor || "#344054"),
            radarAreaOpacity: Number(radarVariant.areaOpacity || 0.22),
            radarPointColor: String(radarVariant.pointColor || radarVariant.primaryColor || current.semantic?.primary || "#1677ff"),
            mapPalette1: String(((mapVariant.regionPalette as string[] | undefined) || [])[0] || "#eef5ff"),
            mapPalette2: String(((mapVariant.regionPalette as string[] | undefined) || [])[1] || "#d5e6ff"),
            mapPalette3: String(((mapVariant.regionPalette as string[] | undefined) || [])[2] || "#9cc3ff"),
            mapPalette4: String(((mapVariant.regionPalette as string[] | undefined) || [])[3] || "#4f8cff"),
            mapPalette5: String(((mapVariant.regionPalette as string[] | undefined) || [])[4] || current.semantic?.primary || "#1677ff"),
            mapRegionBorderColor: String(mapVariant.regionBorderColor || "#8fb1d6"),
            mapLabelColor: String(mapVariant.labelColor || "#344054"),
            mapVisualMapTextColor: String(mapVariant.visualMapTextColor || "#344054"),
            tabsTabBarBackground: String(tabsVariant.tabBarBackground || "#f5f7fb"),
            tabsActiveTextColor: String(tabsVariant.activeTextColor || "#1677ff"),
            tabsInactiveTextColor: String(tabsVariant.inactiveTextColor || "#667085"),
            tabsActiveBackground: String(tabsVariant.activeBackground || "#ffffff"),
            tabsIndicatorColor: String(tabsVariant.indicatorColor || "#1677ff"),
          };
          Object.assign(
            nextInitialValues,
            extractFlipperBackgroundFormValues(
              kpiVariant,
              String(kpiVariant.valueColor || current.semantic?.primary || "#1677ff"),
              String(kpiVariant.itemBackgroundColor || current.chrome?.backgroundColor || "#ffffff"),
              current.category
            )
          );
          const gradientParts = extractGradientParts(current.canvas?.backgroundGradient ? String(current.canvas.backgroundGradient) : "");
          if (gradientParts) {
            nextInitialValues.canvasGradientDirection = gradientParts.direction;
            nextInitialValues.canvasGradientStart = gradientParts.start;
            nextInitialValues.canvasGradientEnd = gradientParts.end;
          }
          Object.assign(nextInitialValues, extractChromeBackgroundFormValues(current.chrome as Record<string, unknown> | undefined));
          setFormInitialValues(nextInitialValues);
          form.setFieldsValue(nextInitialValues);
        } else if (!templateId) {
          form.setFieldsValue(formInitialValues);
        }
      } catch (error: any) {
        message.error(`加载主题模板失败: ${error.message || "未知错误"}`);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [form, templateId, token]);

  const currentRecord = useMemo(
    () => records.find((item) => item.id === templateId) || null,
    [records, templateId]
  );
  const isBuiltinTemplate = Boolean(currentRecord?.isBuiltin);

  const previewValues = Form.useWatch([], form) || formInitialValues;

  const previewSource = useMemo(() => {
    const canvasBackground = resolveCanvasBackground(previewValues as Record<string, unknown>);
    const chromeBackgroundPayload = buildChromeBackgroundPayload(previewValues as Record<string, unknown>);
    const chromeBackground = String(chromeBackgroundPayload.backgroundType === "gradient"
      ? chromeBackgroundPayload.backgroundGradient
      : chromeBackgroundPayload.backgroundType === "image"
        ? `url(${chromeBackgroundPayload.backgroundImage}) center/cover no-repeat`
        : (chromeBackgroundPayload.backgroundColor || "#ffffff"));
    const chromeBorder = String(previewValues.chromeBorder || "#dce6f5");
    const titleColor = String(previewValues.titleColor || "#101828");
    const primary = String(previewValues.primary || "#1677ff");
    const kpiValueColor = String(previewValues.kpiValueColor || primary);
    const kpiLabelColor = String(previewValues.kpiLabelColor || "#667085");
    const kpiDividerColor = String(previewValues.kpiDividerColor || chromeBorder);
    const kpiItemBackgroundColor = String(previewValues.kpiItemBackgroundColor || chromeBackground);
    const kpiFlipperPayload = buildFlipperBackgroundPayload(previewValues as Record<string, unknown>);
    const kpiFlipperBackground = String(kpiFlipperPayload.flipperBackground || buildKpiFlipperBackground(
      String(previewValues.kpiValueColor || primary),
      String(previewValues.kpiItemBackgroundColor || chromeBackground),
      String(previewValues.category || "")
    ));
    const kpiCompareColor = String(previewValues.kpiCompareColor || primary);
    const pieCenterTitleColor = String(previewValues.pieCenterTitleColor || "#667085");
    const pieCenterValueColor = String(previewValues.pieCenterValueColor || "#101828");
    const pieCenterUnitColor = String(previewValues.pieCenterUnitColor || "#101828");
    const pieCenterMetaColor = String(previewValues.pieCenterMetaColor || "#98a2b3");
    const pieLabelColor = String(previewValues.pieLabelColor || "#344054");
    const pieValueColor = String(previewValues.pieValueColor || "#101828");
    const pieGuideLineColor = String(previewValues.pieGuideLineColor || "#98a2b3");
    const pieSliceBorderColor = String(previewValues.pieSliceBorderColor || "#ffffff");
    const piePalette = [
      String(previewValues.piePalette1 || primary),
      String(previewValues.piePalette2 || "#4f8cff"),
      String(previewValues.piePalette3 || "#76a8ff"),
      String(previewValues.piePalette4 || "#9cc3ff"),
      String(previewValues.piePalette5 || "#c6dcff"),
    ];
    const barLabelColor = String(previewValues.barLabelColor || "#ffffff");
    const barLegendColor = String(previewValues.barLegendColor || "#344054");
    const linePalette = [
      String(previewValues.linePalette1 || primary),
      String(previewValues.linePalette2 || "#4f8cff"),
      String(previewValues.linePalette3 || "#76a8ff"),
      String(previewValues.linePalette4 || "#9cc3ff"),
    ];
    const lineWidth = Number(previewValues.lineWidth || 3);
    const lineSmooth = previewValues.lineSmooth !== false;
    const lineShowSymbol = previewValues.lineShowSymbol !== false;
    const lineSymbolSize = Number(previewValues.lineSymbolSize || 6);
    const lineAreaOpacity = Number(previewValues.lineAreaOpacity || 0.18);
    const lineLabelPosition = String(previewValues.lineLabelPosition || "top");
    const lineAxisColor = String(previewValues.lineAxisColor || "#98a2b3");
    const lineAxisLabelColor = String(previewValues.lineAxisLabelColor || "#344054");
    const lineSplitLineColor = String(previewValues.lineSplitLineColor || "#e5e7eb");
    const comboPalette = [
      String(previewValues.comboPalette1 || primary),
      String(previewValues.comboPalette2 || "#f4b95d"),
    ];
    const comboLabelColor = String(previewValues.comboLabelColor || "#344054");
    const comboLegendColor = String(previewValues.comboLegendColor || "#344054");
    const comboAxisColor = String(previewValues.comboAxisColor || "#98a2b3");
    const comboAxisLabelColor = String(previewValues.comboAxisLabelColor || "#344054");
    const comboSplitLineColor = String(previewValues.comboSplitLineColor || "#e5e7eb");
    const comboBarBorderRadius = Number(previewValues.comboBarBorderRadius || 8);
    const comboLineWidth = Number(previewValues.comboLineWidth || 3);
    const comboLineSmooth = previewValues.comboLineSmooth !== false;
    const comboLineShowSymbol = previewValues.comboLineShowSymbol !== false;
    const comboLineSymbolSize = Number(previewValues.comboLineSymbolSize || 6);
    const comboLineAreaOpacity = Number(previewValues.comboLineAreaOpacity || 0.18);
    const comboLineLabelPosition = String(previewValues.comboLineLabelPosition || "top");
    const comboMaxPointColor = String(previewValues.comboMaxPointColor || "#f59e0b");
    const comboMinPointColor = String(previewValues.comboMinPointColor || "#12b76a");
    const scatterPalette = [
      String(previewValues.scatterPalette1 || primary),
      String(previewValues.scatterPalette2 || "#43c7c6"),
      String(previewValues.scatterPalette3 || "#f4b95d"),
      String(previewValues.scatterPalette4 || "#8f7cff"),
      String(previewValues.scatterPalette5 || "#f28f8f"),
    ];
    const scatterLabelColor = String(previewValues.scatterLabelColor || "#344054");
    const scatterLegendColor = String(previewValues.scatterLegendColor || "#344054");
    const scatterAxisColor = String(previewValues.scatterAxisColor || "#98a2b3");
    const scatterAxisLabelColor = String(previewValues.scatterAxisLabelColor || "#344054");
    const scatterSplitLineColor = String(previewValues.scatterSplitLineColor || "#e5e7eb");
    const scatterPointBorderColor = String(previewValues.scatterPointBorderColor || "#ffffff");
    const scatterSymbolSize = Number(previewValues.scatterSymbolSize ?? 16);
    const scatterPointBorderWidth = Number(previewValues.scatterPointBorderWidth ?? 1);
    const scatterPointOpacity = Number(previewValues.scatterPointOpacity ?? 0.82);
    const scatterLabelPosition = String(previewValues.scatterLabelPosition || "top");
    const horizontalBarLabelColor = String(previewValues.horizontalBarLabelColor || "#ffffff");
    const horizontalBarLegendColor = String(previewValues.horizontalBarLegendColor || "#344054");
    const horizontalBarColorCount = [1, 3, 5].includes(Number(previewValues.horizontalBarColorCount)) ? Number(previewValues.horizontalBarColorCount) : 5;
    const horizontalBarPalette = [
      String(previewValues.horizontalBarPalette1 || primary),
      String(previewValues.horizontalBarPalette2 || "#43c7c6"),
      String(previewValues.horizontalBarPalette3 || "#f4b95d"),
      String(previewValues.horizontalBarPalette4 || "#8f7cff"),
      String(previewValues.horizontalBarPalette5 || "#f28f8f"),
    ].slice(0, horizontalBarColorCount);
    const sankeyPalette = [
      String(previewValues.sankeyPalette1 || primary),
      String(previewValues.sankeyPalette2 || "#43c7c6"),
      String(previewValues.sankeyPalette3 || "#f4b95d"),
      String(previewValues.sankeyPalette4 || "#8f7cff"),
      String(previewValues.sankeyPalette5 || "#f28f8f"),
    ];
    const sankeyLabelColor = String(previewValues.sankeyLabelColor || "#344054");
    const sankeyNodeBorderColor = String(previewValues.sankeyNodeBorderColor || "#ffffff");
    const sankeyNodeBorderWidth = Number(previewValues.sankeyNodeBorderWidth || 1);
    const sankeyNodeBorderRadius = Number(previewValues.sankeyNodeBorderRadius || 4);
    const sankeyLinkOpacity = Number(previewValues.sankeyLinkOpacity || 0.28);
    const sankeyLinkCurveness = Number(previewValues.sankeyLinkCurveness || 0.5);
    const gaugePalette = [
      String(previewValues.gaugePalette1 || primary),
      String(previewValues.gaugePalette2 || "#43c7c6"),
      String(previewValues.gaugePalette3 || "#f4b95d"),
      String(previewValues.gaugePalette4 || "#8f7cff"),
      String(previewValues.gaugePalette5 || "#f28f8f"),
    ];
    const gaugePointerColor = String(previewValues.gaugePointerColor || primary);
    const gaugeDetailColor = String(previewValues.gaugeDetailColor || "#101828");
    const gaugeTitleColor = String(previewValues.gaugeTitleColor || "#667085");
    const gaugeAxisLabelColor = String(previewValues.gaugeAxisLabelColor || "#344054");
    const gaugeSplitLineColor = String(previewValues.gaugeSplitLineColor || "#98a2b3");
    const gaugeStartAngle = Number(previewValues.gaugeStartAngle || 210);
    const gaugeEndAngle = Number(previewValues.gaugeEndAngle || -30);
    const gaugeCenterX = 160;
    const gaugeCenterY = 124;
    const gaugeRadius = resolveGaugePreviewLength(previewValues.gaugeRadius, 80, 72);
    const gaugeProgressWidth = Number(previewValues.gaugeProgressWidth || 18);
    const gaugeAxisLineWidth = Number(previewValues.gaugeAxisLineWidth || gaugeProgressWidth || 18);
    const gaugePointerLength = resolveGaugePreviewLength(previewValues.gaugePointerLength, gaugeRadius, gaugeRadius * 0.58);
    const gaugeValue = clampGaugePercent(68);
    const gaugeValueAngle = gaugeStartAngle + ((gaugeEndAngle - gaugeStartAngle) * gaugeValue) / 100;
    const gaugeSegmentPaths = gaugePalette.map((color, index) => {
      const segmentStart = gaugeStartAngle + ((gaugeEndAngle - gaugeStartAngle) * index) / gaugePalette.length;
      const segmentEnd = gaugeStartAngle + ((gaugeEndAngle - gaugeStartAngle) * (index + 1)) / gaugePalette.length;
      return {
        color,
        path: buildGaugePreviewArcPath(gaugeCenterX, gaugeCenterY, gaugeRadius, segmentStart, segmentEnd),
      };
    });
    const gaugeProgressPath = buildGaugePreviewArcPath(gaugeCenterX, gaugeCenterY, gaugeRadius, gaugeStartAngle, gaugeValueAngle);
    const gaugePointerTip = getGaugePreviewPoint(gaugeCenterX, gaugeCenterY, gaugePointerLength, gaugeValueAngle);
    const gaugeTickZero = getGaugePreviewPoint(gaugeCenterX, gaugeCenterY, gaugeRadius + 18, gaugeStartAngle);
    const gaugeTickMid = getGaugePreviewPoint(gaugeCenterX, gaugeCenterY, gaugeRadius + 22, gaugeStartAngle + (gaugeEndAngle - gaugeStartAngle) / 2);
    const gaugeTickMax = getGaugePreviewPoint(gaugeCenterX, gaugeCenterY, gaugeRadius + 18, gaugeEndAngle);
    const funnelPalette = [
      String(previewValues.funnelPalette1 || primary),
      String(previewValues.funnelPalette2 || "#43c7c6"),
      String(previewValues.funnelPalette3 || "#f4b95d"),
      String(previewValues.funnelPalette4 || "#8f7cff"),
      String(previewValues.funnelPalette5 || "#f28f8f"),
    ];
    const funnelLabelColor = String(previewValues.funnelLabelColor || "#344054");
    const funnelValueColor = String(previewValues.funnelValueColor || "#101828");
    const funnelGuideLineColor = String(previewValues.funnelGuideLineColor || "#98a2b3");
    const funnelBlockBorderColor = String(previewValues.funnelBlockBorderColor || "#ffffff");
    const funnelBlockBorderWidth = Number(previewValues.funnelBlockBorderWidth || 1);
    const funnelItemGap = Number(previewValues.funnelItemGap || 2);
    const funnelSortOrder = String(previewValues.funnelSortOrder || "descending");
    const wordCloudPalette = [
      String(previewValues.wordCloudPalette1 || primary),
      String(previewValues.wordCloudPalette2 || "#43c7c6"),
      String(previewValues.wordCloudPalette3 || "#f4b95d"),
      String(previewValues.wordCloudPalette4 || "#8f7cff"),
      String(previewValues.wordCloudPalette5 || "#f28f8f"),
    ];
    const wordCloudShape = String(previewValues.wordCloudShape || "circle");
    const wordCloudGridSize = Number(previewValues.wordCloudGridSize || 10);
    const wordCloudRotationStep = Number(previewValues.wordCloudRotationStep || 45);
    const wordCloudMinFontSizeRaw = Number(previewValues.wordCloudMinFontSize || 12);
    const wordCloudMaxFontSizeRaw = Number(previewValues.wordCloudMaxFontSize || 40);
    const wordCloudMinFontSize = Math.min(wordCloudMinFontSizeRaw, wordCloudMaxFontSizeRaw);
    const wordCloudMaxFontSize = Math.max(wordCloudMinFontSizeRaw, wordCloudMaxFontSizeRaw);
    const wordCloudFontWeight = Number(previewValues.wordCloudFontWeight || 700);
    const wordCloudTextShadowColor = String(previewValues.wordCloudTextShadowColor || "rgba(15,23,42,0.14)");
    const wordCloudTextShadowBlur = Number(previewValues.wordCloudTextShadowBlur || 10);
    const wordCloudRotationRange = resolveWordCloudPreviewRotationRange(wordCloudRotationStep);
    const wordCloudClipPath = getWordCloudPreviewClipPath(wordCloudShape);
    const wordCloudPreviewWords = [
      { label: "经营分析", size: wordCloudMaxFontSize, left: "50%", top: "22%", rotate: wordCloudRotationRange[1] > 0 ? -wordCloudRotationRange[1] / 2 : 0, color: wordCloudPalette[0] },
      { label: "渠道转化", size: Math.max(wordCloudMinFontSize, wordCloudMaxFontSize - 10), left: "28%", top: "34%", rotate: wordCloudRotationRange[1] > 0 ? -wordCloudRotationRange[1] / 3 : 0, color: wordCloudPalette[1] },
      { label: "支付成功", size: Math.max(wordCloudMinFontSize, wordCloudMaxFontSize - 14), left: "72%", top: "36%", rotate: 0, color: wordCloudPalette[2] },
      { label: "复购率", size: Math.max(wordCloudMinFontSize, wordCloudMaxFontSize - 18), left: "36%", top: "56%", rotate: wordCloudRotationRange[1] > 0 ? wordCloudRotationRange[1] / 2 : 0, color: wordCloudPalette[3] },
      { label: "留存", size: Math.max(wordCloudMinFontSize, wordCloudMaxFontSize - 24), left: "63%", top: "56%", rotate: wordCloudRotationRange[1] > 0 ? -wordCloudRotationRange[1] / 4 : 0, color: wordCloudPalette[4] },
      { label: "会员", size: Math.max(wordCloudMinFontSize, wordCloudMaxFontSize - 22), left: "22%", top: "72%", rotate: 0, color: wordCloudPalette[0] },
      { label: "高净值", size: Math.max(wordCloudMinFontSize, wordCloudMaxFontSize - 20), left: "50%", top: "72%", rotate: wordCloudRotationRange[1] > 0 ? wordCloudRotationRange[1] / 3 : 0, color: wordCloudPalette[1] },
      { label: "热词", size: Math.max(wordCloudMinFontSize, wordCloudMaxFontSize - 26), left: "76%", top: "72%", rotate: 0, color: wordCloudPalette[2] },
    ];
    const radarPalette = [
      String(previewValues.radarPalette1 || primary),
      String(previewValues.radarPalette2 || "#4f8cff"),
      String(previewValues.radarPalette3 || "#76a8ff"),
      String(previewValues.radarPalette4 || "#9cc3ff"),
    ];
    const radarGridLineColor = String(previewValues.radarGridLineColor || "#dbe7f3");
    const radarIndicatorTextColor = String(previewValues.radarIndicatorTextColor || "#344054");
    const radarAreaOpacity = Number(previewValues.radarAreaOpacity || 0.22);
    const radarPointColor = String(previewValues.radarPointColor || primary);
    const mapPalette = [
      String(previewValues.mapPalette1 || "#eef5ff"),
      String(previewValues.mapPalette2 || "#d5e6ff"),
      String(previewValues.mapPalette3 || "#9cc3ff"),
      String(previewValues.mapPalette4 || "#4f8cff"),
      String(previewValues.mapPalette5 || primary),
    ];
    const mapRegionBorderColor = String(previewValues.mapRegionBorderColor || "#8fb1d6");
    const mapLabelColor = String(previewValues.mapLabelColor || "#344054");
    const mapVisualMapTextColor = String(previewValues.mapVisualMapTextColor || "#344054");
    const tabsTabBarBackground = String(previewValues.tabsTabBarBackground || "#f5f7fb");
    const tabsActiveTextColor = String(previewValues.tabsActiveTextColor || primary);
    const tabsInactiveTextColor = String(previewValues.tabsInactiveTextColor || "#667085");
    const tabsActiveBackground = String(previewValues.tabsActiveBackground || "#ffffff");
    const tabsIndicatorColor = String(previewValues.tabsIndicatorColor || primary);
    const gradientDirection = String(previewValues.canvasGradientDirection || "to bottom");
    const currentCode = activeEditorTab === "kpi"
      ? `const kpiCards = [
  { label: "当日交易额", value: "128.6万", compare: "+12.4%" },
  { label: "新增客户", value: "1,248", compare: "+4.8%" },
  { label: "转化率", value: "38.2%", compare: "-1.2%" },
];

<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  padding: 16,
  backgroundColor: "${canvasBackground.backgroundColor || "transparent"}",
  backgroundImage: "${canvasBackground.backgroundImage || "none"}",
  backgroundPosition: "${canvasBackground.backgroundPosition || "center"}",
  backgroundSize: "${canvasBackground.backgroundSize || "cover"}",
  backgroundRepeat: "${canvasBackground.backgroundRepeat || "no-repeat"}",
  borderRadius: 20,
}}>
  {kpiCards.map((item) => (
    <div key={item.label} style={{
      background: "${kpiItemBackgroundColor}",
      border: "1px solid ${kpiDividerColor}",
      borderRadius: 16,
      padding: 16,
    }}>
      <div style={{ color: "${kpiLabelColor}", marginBottom: 10 }}>{item.label}</div>
      <div style={{ color: "${kpiValueColor}", fontSize: 28, fontWeight: 700 }}>{item.value}</div>
      <div style={{ color: "${kpiCompareColor}", marginTop: 8 }}>{item.compare}</div>
    </div>
  ))}
</div>`
      : activeEditorTab === "pie"
        ? `const pieOption = {
  backgroundColor: "transparent",
  color: ["${primary}", "${pieGuideLineColor}", "${titleColor}"],
  series: [
    {
      type: "pie",
      radius: ["52%", "82%"],
      startAngle: 90,
      data: [
        { value: 42, name: "对公" },
        { value: 26, name: "零售" },
        { value: 32, name: "财富" },
      ],
      itemStyle: {
        borderColor: "${pieSliceBorderColor}",
        shadowColor: "${previewValues.pieShadowColor || "rgba(15,23,42,0.14)"}",
      },
      label: { color: "${pieLabelColor}" },
      labelLine: { lineStyle: { color: "${pieGuideLineColor}" } },
    },
  ],
  graphic: [
    { type: "text", left: "center", top: "40%", style: { text: "总量", fill: "${pieCenterTitleColor}", fontSize: 14 } },
    { type: "text", left: "center", top: "48%", style: { text: "2,486", fill: "${pieCenterValueColor}", fontSize: 28, fontWeight: 700 } },
    { type: "text", left: "center", top: "59%", style: { text: "笔", fill: "${pieCenterUnitColor}", fontSize: 14 } },
    { type: "text", left: "center", top: "67%", style: { text: "近 30 天", fill: "${pieCenterMetaColor}", fontSize: 12 } },
  ],
};`
        : activeEditorTab === "horizontalBar"
          ? `const horizontalBarOption = {
  color: ${JSON.stringify(horizontalBarPalette)},
  xAxis: { type: "value", axisLine: { lineStyle: { color: "${previewValues.horizontalBarAxisColor || "#98a2b3"}" } } },
  yAxis: { type: "category", data: ["华北", "华东", "华南", "西南", "东北"], axisLabel: { color: "${previewValues.horizontalBarAxisLabelColor || "#344054"}" } },
  series: [{
    type: "bar",
    data: [681, 592, 540, 472, 418].map((value, index) => ({
      value,
      itemStyle: { color: ${JSON.stringify(horizontalBarPalette)}[index % ${horizontalBarPalette.length || 1}], borderRadius: ${Number(previewValues.horizontalBarBorderRadius || 10)} }
    })),
    label: { show: true, position: "insideRight", color: "${horizontalBarLabelColor}" }
  }]
};`
        : activeEditorTab === "sankey"
          ? `const sankeyOption = {
  series: [{
    type: "sankey",
    left: 8,
    right: 8,
    top: 0,
    bottom: 0,
    nodeWidth: 16,
    nodeGap: 18,
    nodeAlign: "justify",
    lineStyle: { color: "gradient", opacity: ${sankeyLinkOpacity}, curveness: ${sankeyLinkCurveness} },
    data: ["APP", "小程序", "PC", "访问", "加购", "下单", "支付成功"].map((name, index) => ({
      name,
      itemStyle: {
        color: ${JSON.stringify(sankeyPalette)}[index % ${sankeyPalette.length || 1}],
        borderColor: "${sankeyNodeBorderColor}",
        borderWidth: ${sankeyNodeBorderWidth},
        borderRadius: ${sankeyNodeBorderRadius},
      },
      label: {
        show: true,
        color: "${sankeyLabelColor}",
      },
    })),
    links: [
      { source: "APP", target: "访问", value: 100000 },
      { source: "小程序", target: "访问", value: 80000 },
      { source: "PC", target: "访问", value: 30000 },
      { source: "访问", target: "加购", value: 160000 },
      { source: "加购", target: "下单", value: 64000 },
      { source: "下单", target: "支付成功", value: 48000 },
    ],
  }],
};`
        : activeEditorTab === "gauge"
          ? `const gaugeOption = {
  series: [{
    type: "gauge",
    startAngle: ${gaugeStartAngle},
    endAngle: ${gaugeEndAngle},
    radius: "${previewValues.gaugeRadius || "90%"}",
    progress: {
      show: true,
      roundCap: true,
      width: ${gaugeProgressWidth},
      itemStyle: { color: "${gaugePointerColor}" },
    },
    axisLine: {
      roundCap: true,
      lineStyle: {
        width: ${gaugeAxisLineWidth},
        color: ${JSON.stringify(gaugePalette.map((color, index) => [Number(((index + 1) / gaugePalette.length).toFixed(4)), color]))},
      },
    },
    pointer: {
      length: "${previewValues.gaugePointerLength || "58%"}",
      itemStyle: { color: "${gaugePointerColor}" },
    },
    splitLine: { lineStyle: { color: "${gaugeSplitLineColor}" } },
    axisLabel: { color: "${gaugeAxisLabelColor}" },
    title: { color: "${gaugeTitleColor}", fontSize: ${Number(previewValues.gaugeTitleFontSize || 14)} },
    detail: { color: "${gaugeDetailColor}", fontSize: ${Number(previewValues.gaugeDetailFontSize || 24)}, fontWeight: ${Number(previewValues.gaugeDetailFontWeight || 700)} },
    data: [{ value: 68, name: "达成率" }],
  }],
};`
        : activeEditorTab === "funnel"
          ? `const funnelOption = {
  color: ${JSON.stringify(funnelPalette)},
  series: [{
    type: "funnel",
    sort: "${funnelSortOrder}",
    gap: ${funnelItemGap},
    left: 12,
    right: 24,
    top: 12,
    bottom: 12,
    label: {
      show: true,
      position: "right",
      formatter: "{b}\\n{c}",
      color: "${funnelLabelColor}",
    },
    labelLine: {
      show: true,
      lineStyle: { color: "${funnelGuideLineColor}" },
    },
    itemStyle: {
      borderColor: "${funnelBlockBorderColor}",
      borderWidth: ${funnelBlockBorderWidth},
    },
    data: [
      { name: "访问", value: 100000 },
      { name: "加购", value: 64000 },
      { name: "下单", value: 48000 },
      { name: "支付", value: 32000 },
      { name: "复购", value: 16000 },
    ],
  }],
};`
        : activeEditorTab === "wordCloud"
          ? `const wordCloudOption = {
  series: [{
    type: "wordCloud",
    shape: "${wordCloudShape}",
    gridSize: ${wordCloudGridSize},
    rotationRange: [${wordCloudRotationRange[0]}, ${wordCloudRotationRange[1]}],
    rotationStep: ${wordCloudRotationStep},
    sizeRange: [${wordCloudMinFontSize}, ${wordCloudMaxFontSize}],
    textStyle: {
      fontWeight: ${wordCloudFontWeight},
      textShadowColor: "${wordCloudTextShadowColor}",
      textShadowBlur: ${wordCloudTextShadowBlur},
    },
    data: [
      { name: "经营分析", value: 120 },
      { name: "渠道转化", value: 98 },
      { name: "支付成功", value: 92 },
      { name: "复购率", value: 86 },
      { name: "高净值", value: 74 },
      { name: "会员", value: 68 },
    ].map((item, index) => ({
      ...item,
      textStyle: { color: ${JSON.stringify(wordCloudPalette)}[index % ${wordCloudPalette.length || 1}] },
    })),
  }],
};`
        : activeEditorTab === "line"
          ? `const lineOption = {
  color: ${JSON.stringify(linePalette)},
  xAxis: { type: "category", data: ["1月", "2月", "3月", "4月", "5月", "6月"], axisLine: { lineStyle: { color: "${lineAxisColor}" } }, axisLabel: { color: "${lineAxisLabelColor}" }, splitLine: { lineStyle: { color: "${lineSplitLineColor}" } } },
  yAxis: { type: "value", axisLine: { lineStyle: { color: "${lineAxisColor}" } }, axisLabel: { color: "${lineAxisLabelColor}" }, splitLine: { lineStyle: { color: "${lineSplitLineColor}" } } },
  series: [{
    type: "line",
    smooth: ${lineSmooth ? "true" : "false"},
    showSymbol: ${lineShowSymbol ? "true" : "false"},
    symbolSize: ${lineSymbolSize},
    lineStyle: { width: ${lineWidth} },
    areaStyle: { opacity: ${lineAreaOpacity} },
    data: [120, 160, 148, 210, 230, 268].map((value, index) => ({
      value,
      itemStyle: { color: ${JSON.stringify(linePalette)}[index % ${linePalette.length || 1}] }
    })),
    label: { show: true, position: "${lineLabelPosition}", color: "${lineAxisLabelColor}" }
  }]
};`
        : activeEditorTab === "combo"
          ? `const comboOption = {
  color: ${JSON.stringify(comboPalette)},
  tooltip: { trigger: "axis" },
  legend: { data: ["交易额", "转化率"], textStyle: { color: "${comboLegendColor}" } },
  xAxis: { type: "category", data: ["1月", "2月", "3月", "4月", "5月", "6月"], axisLine: { lineStyle: { color: "${comboAxisColor}" } }, axisLabel: { color: "${comboAxisLabelColor}" } },
  yAxis: [
    { type: "value", axisLine: { lineStyle: { color: "${comboAxisColor}" } }, axisLabel: { color: "${comboAxisLabelColor}" }, splitLine: { lineStyle: { color: "${comboSplitLineColor}" } } },
    { type: "value", axisLine: { lineStyle: { color: "${comboAxisColor}" } }, axisLabel: { color: "${comboAxisLabelColor}" } },
  ],
  series: [
    {
      type: "bar",
      name: "交易额",
      data: [320, 368, 402, 456, 428, 512],
      itemStyle: { color: "${comboPalette[0]}", borderRadius: [${comboBarBorderRadius}, ${comboBarBorderRadius}, 0, 0] },
      label: { show: true, position: "top", color: "${comboLabelColor}" },
      markPoint: { data: [{ type: "max", itemStyle: { color: "${comboMaxPointColor}" } }, { type: "min", itemStyle: { color: "${comboMinPointColor}" } }] },
    },
    {
      type: "line",
      name: "转化率",
      yAxisIndex: 1,
      smooth: ${comboLineSmooth ? "true" : "false"},
      showSymbol: ${comboLineShowSymbol ? "true" : "false"},
      symbolSize: ${comboLineSymbolSize},
      lineStyle: { color: "${comboPalette[1]}", width: ${comboLineWidth} },
      areaStyle: { color: "${comboPalette[1]}", opacity: ${comboLineAreaOpacity} },
      data: [22, 28, 31, 35, 33, 39],
      label: { show: true, position: "${comboLineLabelPosition}", color: "${comboLabelColor}" },
      markPoint: { data: [{ type: "max", itemStyle: { color: "${comboMaxPointColor}" } }, { type: "min", itemStyle: { color: "${comboMinPointColor}" } }] },
    },
  ],
};`
        : activeEditorTab === "scatter"
          ? `const scatterOption = {
  color: ${JSON.stringify(scatterPalette)},
  tooltip: { trigger: "item" },
  legend: { data: ["客单价 vs 复购率"], textStyle: { color: "${scatterLegendColor}" } },
  xAxis: {
    type: "value",
    name: "客单价",
    axisLine: { lineStyle: { color: "${scatterAxisColor}" } },
    axisLabel: { color: "${scatterAxisLabelColor}" },
    splitLine: { lineStyle: { color: "${scatterSplitLineColor}" } },
  },
  yAxis: {
    type: "value",
    name: "复购率",
    axisLine: { lineStyle: { color: "${scatterAxisColor}" } },
    axisLabel: { color: "${scatterAxisLabelColor}" },
    splitLine: { lineStyle: { color: "${scatterSplitLineColor}" } },
  },
  series: [{
    type: "scatter",
    name: "客单价 vs 复购率",
    symbolSize: ${scatterSymbolSize},
    itemStyle: {
      borderColor: "${scatterPointBorderColor}",
      borderWidth: ${scatterPointBorderWidth},
      opacity: ${scatterPointOpacity},
    },
    label: { show: true, position: "${scatterLabelPosition}", color: "${scatterLabelColor}" },
    data: [
      { value: [82, 46], itemStyle: { color: "${scatterPalette[0]}" }, label: { formatter: "私银" } },
      { value: [126, 62], itemStyle: { color: "${scatterPalette[1]}" }, label: { formatter: "财富" } },
      { value: [94, 58], itemStyle: { color: "${scatterPalette[2]}" }, label: { formatter: "零售" } },
      { value: [148, 74], itemStyle: { color: "${scatterPalette[3]}" }, label: { formatter: "会员" } },
      { value: [176, 88], itemStyle: { color: "${scatterPalette[4]}" }, label: { formatter: "高净值" } },
    ],
  }],
};`
        : activeEditorTab === "radar"
          ? `const radarOption = {
  color: ${JSON.stringify(radarPalette)},
  radar: {
    shape: "polygon",
    indicator: [
      { name: "维度一", max: 100 },
      { name: "维度二", max: 100 },
      { name: "维度三", max: 100 },
      { name: "维度四", max: 100 },
      { name: "维度五", max: 100 },
    ],
    axisName: { color: "${radarIndicatorTextColor}" },
    splitLine: { lineStyle: { color: "${radarGridLineColor}" } },
    splitArea: { areaStyle: { opacity: ${radarAreaOpacity} } },
  },
  series: [{
    type: "radar",
    data: [{ value: [80, 72, 84, 76, 90], name: "画像" }],
    itemStyle: { color: "${radarPointColor}", borderColor: "${radarPointColor}" },
    areaStyle: { opacity: ${radarAreaOpacity} },
  }],
};`
        : activeEditorTab === "map"
          ? `const mapOption = {
  visualMap: {
    min: 0,
    max: 100,
    calculable: true,
    inRange: { color: ${JSON.stringify(mapPalette)} },
    textStyle: { color: "${mapVisualMapTextColor}" },
  },
  series: [{
    type: "map",
    map: "china",
    roam: true,
    itemStyle: { borderColor: "${mapRegionBorderColor}" },
    label: { show: true, color: "${mapLabelColor}" },
    data: [
      { name: "广东", value: 92 },
      { name: "浙江", value: 76 },
      { name: "四川", value: 58 },
      { name: "山东", value: 66 },
      { name: "湖北", value: 44 },
    ],
  }],
};`
        : activeEditorTab === "tabs"
          ? `<div style={{
  background: "${tabsTabBarBackground}",
  borderRadius: 18,
  padding: 14,
}}>
  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
    <div style={{
      padding: "8px 14px",
      borderRadius: 999,
      background: "${tabsActiveBackground}",
      color: "${tabsActiveTextColor}",
      boxShadow: "inset 0 -2px 0 ${tabsIndicatorColor}",
    }}>概览</div>
    <div style={{ padding: "8px 14px", borderRadius: 999, color: "${tabsInactiveTextColor}" }}>趋势</div>
    <div style={{ padding: "8px 14px", borderRadius: 999, color: "${tabsInactiveTextColor}" }}>明细</div>
  </div>
  <div style={{
    background: "${chromeBackground}",
    border: "1px solid ${chromeBorder}",
    borderRadius: 16,
    padding: 18,
    minHeight: 220,
  }}>
    <div style={{ color: "${titleColor}", fontWeight: 700, marginBottom: 10 }}>标签页容器预览</div>
  </div>
</div>`
          : `<div style={{
  backgroundColor: "${canvasBackground.backgroundColor || "transparent"}",
  backgroundImage: "${canvasBackground.backgroundImage || "none"}",
  backgroundPosition: "${canvasBackground.backgroundPosition || "center"}",
  backgroundSize: "${canvasBackground.backgroundSize || "cover"}",
  backgroundRepeat: "${canvasBackground.backgroundRepeat || "no-repeat"}",
  border: "1px solid ${chromeBorder}",
  borderRadius: 20,
  padding: 18,
}}>
  <div style={{
    background: "${chromeBackground}",
    border: "1px solid ${chromeBorder}",
    borderRadius: 18,
    minHeight: 240,
    padding: 18,
    color: "${titleColor}",
  }}>
    画布与容器预览
  </div>
</div>`;

    return {
      canvasBackground,
      chromeBackground,
      chromeBorder,
      titleColor,
      primary,
      kpiValueColor,
      kpiLabelColor,
      kpiDividerColor,
      kpiItemBackgroundColor,
      kpiFlipperBackground,
      kpiCompareColor,
      pieCenterTitleColor,
      pieCenterValueColor,
      pieCenterUnitColor,
      pieCenterMetaColor,
      pieLabelColor,
      pieValueColor,
      pieGuideLineColor,
      pieSliceBorderColor,
      piePalette,
      barLabelColor,
      barLegendColor,
      horizontalBarLabelColor,
      horizontalBarLegendColor,
      horizontalBarPalette,
      horizontalBarColorCount,
      sankeyPalette,
      sankeyLabelColor,
      sankeyNodeBorderColor,
      sankeyNodeBorderWidth,
      sankeyNodeBorderRadius,
      sankeyLinkOpacity,
      sankeyLinkCurveness,
      gaugePalette,
      gaugePointerColor,
      gaugeDetailColor,
      gaugeTitleColor,
      gaugeAxisLabelColor,
      gaugeSplitLineColor,
      gaugeStartAngle,
      gaugeEndAngle,
      gaugeRadius,
      gaugeProgressWidth,
      gaugeAxisLineWidth,
      gaugePointerLength,
      gaugeDetailFontSize: Number(previewValues.gaugeDetailFontSize || 24),
      gaugeDetailFontWeight: Number(previewValues.gaugeDetailFontWeight || 700),
      gaugeTitleFontSize: Number(previewValues.gaugeTitleFontSize || 14),
      gaugeValue,
      gaugeSegmentPaths,
      gaugeProgressPath,
      gaugePointerTip,
      gaugeCenterX,
      gaugeCenterY,
      gaugeTickZero,
      gaugeTickMid,
      gaugeTickMax,
      funnelPalette,
      funnelLabelColor,
      funnelValueColor,
      funnelGuideLineColor,
      funnelBlockBorderColor,
      funnelBlockBorderWidth,
      funnelItemGap,
      funnelSortOrder,
      wordCloudPalette,
      wordCloudShape,
      wordCloudGridSize,
      wordCloudRotationStep,
      wordCloudRotationRange,
      wordCloudMinFontSize,
      wordCloudMaxFontSize,
      wordCloudFontWeight,
      wordCloudTextShadowColor,
      wordCloudTextShadowBlur,
      wordCloudClipPath,
      wordCloudPreviewWords,
      linePalette,
      lineWidth,
      lineSmooth,
      lineShowSymbol,
      lineSymbolSize,
      lineAreaOpacity,
      lineLabelPosition,
      lineAxisColor,
      lineAxisLabelColor,
      lineSplitLineColor,
      comboPalette,
      comboLabelColor,
      comboLegendColor,
      comboAxisColor,
      comboAxisLabelColor,
      comboSplitLineColor,
      comboBarBorderRadius,
      comboLineWidth,
      comboLineSmooth,
      comboLineShowSymbol,
      comboLineSymbolSize,
      comboLineAreaOpacity,
      comboLineLabelPosition,
      comboMaxPointColor,
      comboMinPointColor,
      scatterPalette,
      scatterLabelColor,
      scatterLegendColor,
      scatterAxisColor,
      scatterAxisLabelColor,
      scatterSplitLineColor,
      scatterPointBorderColor,
      scatterSymbolSize,
      scatterPointBorderWidth,
      scatterPointOpacity,
      scatterLabelPosition,
      radarPalette,
      radarGridLineColor,
      radarIndicatorTextColor,
      radarAreaOpacity,
      radarPointColor,
      mapPalette,
      mapRegionBorderColor,
      mapLabelColor,
      mapVisualMapTextColor,
      tabsTabBarBackground,
      tabsActiveTextColor,
      tabsInactiveTextColor,
      tabsActiveBackground,
      tabsIndicatorColor,
      gradientDirection,
      code: currentCode,
    };
  }, [previewValues, activeEditorTab, formInitialValues]);

  const backgroundPresets = useMemo(() => {
    const category = String(form.getFieldValue("category") || formInitialValues.category || "中性色");
    return CATEGORY_PRESETS[category] || CATEGORY_PRESETS["中性色"];
  }, [form, formInitialValues.category, previewValues]);

  async function handleSave() {
    if (!token) return;
    if (isBuiltinTemplate) {
      return;
    }
    const values = await form.validateFields();
    const currentChartVariants = (currentRecord?.chartVariants || {}) as Record<string, unknown>;
    const payload = {
      themeName: values.themeName,
      themeCode: values.themeCode,
      category: values.category,
      description: values.description || null,
      status: values.status,
      isBuiltin: Boolean(values.isBuiltin),
      canvas: {
        backgroundType: values.canvasBackgroundType,
        backgroundColor: values.canvasBackgroundType === "solid" ? values.canvasBackgroundColor : null,
        backgroundGradient: values.canvasBackgroundType === "gradient"
          ? `linear-gradient(${values.canvasGradientDirection || "to bottom"}, ${values.canvasGradientStart || "#f7f9fc"} 0%, ${values.canvasGradientEnd || "#eef3fa"} 100%)`
          : null,
        backgroundImage: values.canvasBackgroundType === "image" ? values.canvasBackgroundImage : null,
        dashboardTitleColor: values.dashboardTitleColor,
      },
      chrome: {
        ...buildChromeBackgroundPayload(values),
        backgroundColor: buildChromeBackgroundPayload(values).backgroundColor,
        borderColor: values.chromeBorder,
        titleColor: values.titleColor,
        borderWidth: 1,
        borderRadius: 16,
        shadowPreset: "soft",
        paddingPreset: "comfortable",
      },
      semantic: {
        primary: values.primary,
      },
      chartCommon: {
        palette: [values.primary, "#4f8cff", "#76a8ff", "#9cc3ff"],
        labelColor: values.titleColor,
        legendColor: values.titleColor,
        guideLineColor: values.chromeBorder,
      },
      chartVariants: {
        ...currentChartVariants,
        pie: {
          palette: [
            values.piePalette1,
            values.piePalette2,
            values.piePalette3,
            values.piePalette4,
            values.piePalette5,
          ].filter(Boolean),
          centerTitleColor: values.pieCenterTitleColor,
          centerValueColor: values.pieCenterValueColor,
          centerUnitColor: values.pieCenterUnitColor,
          centerMetaColor: values.pieCenterMetaColor,
          labelColor: values.pieLabelColor,
          valueColor: values.pieValueColor,
          guideLineColor: values.pieGuideLineColor,
          sliceBorderColor: values.pieSliceBorderColor,
          shadowColor: values.pieShadowColor,
          defaultInnerRadius: Number(values.pieDefaultInnerRadius || 52),
          defaultOuterRadius: Number(values.pieDefaultOuterRadius || 82),
          defaultLabelMode: values.pieDefaultLabelMode || "outside",
        },
        bar: {
          palette: [
            values.barPalette1,
            values.barPalette2,
          ].filter(Boolean),
          labelColor: values.barLabelColor,
          legendColor: values.barLegendColor,
          axisColor: values.barAxisColor,
          axisLabelColor: values.barAxisLabelColor,
          splitLineColor: values.barSplitLineColor,
          barBorderRadius: Number(values.barBorderRadius || 8),
        },
        line: {
          palette: [
            values.linePalette1,
            values.linePalette2,
            values.linePalette3,
            values.linePalette4,
          ].filter(Boolean),
          lineWidth: Number(values.lineWidth || 3),
          lineSmooth: Boolean(values.lineSmooth),
          showSymbol: Boolean(values.lineShowSymbol),
          symbolSize: Number(values.lineSymbolSize || 6),
          labelPosition: values.lineLabelPosition || "top",
          pointBorderColor: values.lineShowSymbol === false ? "transparent" : "#ffffff",
          areaOpacity: Number(values.lineAreaOpacity || 0.18),
          axisColor: values.lineAxisColor,
          axisLabelColor: values.lineAxisLabelColor,
          splitLineColor: values.lineSplitLineColor,
        },
        combo: {
          palette: [
            values.comboPalette1,
            values.comboPalette2,
          ].filter(Boolean),
          labelColor: values.comboLabelColor,
          legendColor: values.comboLegendColor,
          axisColor: values.comboAxisColor,
          axisLabelColor: values.comboAxisLabelColor,
          splitLineColor: values.comboSplitLineColor,
          barBorderRadius: Number(values.comboBarBorderRadius || 8),
          lineWidth: Number(values.comboLineWidth || 3),
          lineSmooth: Boolean(values.comboLineSmooth),
          showSymbol: Boolean(values.comboLineShowSymbol),
          symbolSize: Number(values.comboLineSymbolSize || 6),
          labelPosition: values.comboLineLabelPosition || "top",
          pointBorderColor: "#ffffff",
          areaOpacity: Number(values.comboLineAreaOpacity || 0.18),
          maxPointColor: values.comboMaxPointColor,
          minPointColor: values.comboMinPointColor,
        },
        scatter: {
          palette: [
            values.scatterPalette1,
            values.scatterPalette2,
            values.scatterPalette3,
            values.scatterPalette4,
            values.scatterPalette5,
          ].filter(Boolean),
          labelColor: values.scatterLabelColor,
          legendColor: values.scatterLegendColor,
          axisColor: values.scatterAxisColor,
          axisLabelColor: values.scatterAxisLabelColor,
          splitLineColor: values.scatterSplitLineColor,
          symbolSize: Number(values.scatterSymbolSize ?? 16),
          pointBorderColor: values.scatterPointBorderColor,
          pointBorderWidth: Number(values.scatterPointBorderWidth ?? 1),
          pointOpacity: Number(values.scatterPointOpacity ?? 0.82),
          labelPosition: values.scatterLabelPosition || "top",
        },
        horizontalBar: {
          palette: [
            values.horizontalBarPalette1,
            values.horizontalBarPalette2,
            values.horizontalBarPalette3,
            values.horizontalBarPalette4,
            values.horizontalBarPalette5,
          ].filter(Boolean),
          labelColor: values.horizontalBarLabelColor,
          legendColor: values.horizontalBarLegendColor,
          axisColor: values.horizontalBarAxisColor,
          axisLabelColor: values.horizontalBarAxisLabelColor,
          splitLineColor: values.horizontalBarSplitLineColor,
          barBorderRadius: Number(values.horizontalBarBorderRadius || 10),
          colorCount: Number(values.horizontalBarColorCount || 5),
        },
        sankey: {
          palette: [
            values.sankeyPalette1,
            values.sankeyPalette2,
            values.sankeyPalette3,
            values.sankeyPalette4,
            values.sankeyPalette5,
          ].filter(Boolean),
          labelColor: values.sankeyLabelColor,
          nodeBorderColor: values.sankeyNodeBorderColor,
          nodeBorderWidth: Number(values.sankeyNodeBorderWidth || 1),
          nodeBorderRadius: Number(values.sankeyNodeBorderRadius || 4),
          linkOpacity: Number(values.sankeyLinkOpacity || 0.28),
          linkCurveness: Number(values.sankeyLinkCurveness || 0.5),
        },
        gauge: {
          palette: [
            values.gaugePalette1,
            values.gaugePalette2,
            values.gaugePalette3,
            values.gaugePalette4,
            values.gaugePalette5,
          ].filter(Boolean),
          pointerColor: values.gaugePointerColor,
          detailColor: values.gaugeDetailColor,
          titleColor: values.gaugeTitleColor,
          axisLabelColor: values.gaugeAxisLabelColor,
          splitLineColor: values.gaugeSplitLineColor,
          startAngle: Number(values.gaugeStartAngle || 210),
          endAngle: Number(values.gaugeEndAngle || -30),
          radius: values.gaugeRadius || "90%",
          progressWidth: Number(values.gaugeProgressWidth || 18),
          axisLineWidth: Number(values.gaugeAxisLineWidth || values.gaugeProgressWidth || 18),
          pointerLength: values.gaugePointerLength || "58%",
          detailFontSize: Number(values.gaugeDetailFontSize || 24),
          detailFontWeight: Number(values.gaugeDetailFontWeight || 700),
          titleFontSize: Number(values.gaugeTitleFontSize || 14),
        },
        funnel: {
          palette: [
            values.funnelPalette1,
            values.funnelPalette2,
            values.funnelPalette3,
            values.funnelPalette4,
            values.funnelPalette5,
          ].filter(Boolean),
          labelColor: values.funnelLabelColor,
          valueColor: values.funnelValueColor,
          guideLineColor: values.funnelGuideLineColor,
          blockBorderColor: values.funnelBlockBorderColor,
          blockBorderWidth: Number(values.funnelBlockBorderWidth || 1),
          itemGap: Number(values.funnelItemGap || 2),
          sortOrder: values.funnelSortOrder || "descending",
        },
        wordCloud: {
          palette: [
            values.wordCloudPalette1,
            values.wordCloudPalette2,
            values.wordCloudPalette3,
            values.wordCloudPalette4,
            values.wordCloudPalette5,
          ].filter(Boolean),
          shape: values.wordCloudShape || "circle",
          gridSize: Number(values.wordCloudGridSize || 10),
          rotationStep: Number(values.wordCloudRotationStep || 45),
          minFontSize: Number(values.wordCloudMinFontSize || 12),
          maxFontSize: Number(values.wordCloudMaxFontSize || 40),
          fontWeight: Number(values.wordCloudFontWeight || 700),
          textShadowColor: values.wordCloudTextShadowColor || "rgba(15,23,42,0.14)",
          textShadowBlur: Number(values.wordCloudTextShadowBlur || 10),
        },
        radar: {
          palette: [
            values.radarPalette1,
            values.radarPalette2,
            values.radarPalette3,
            values.radarPalette4,
          ].filter(Boolean),
          gridLineColor: values.radarGridLineColor,
          indicatorTextColor: values.radarIndicatorTextColor,
          areaOpacity: Number(values.radarAreaOpacity || 0.22),
          pointColor: values.radarPointColor,
          primaryColor: values.radarPalette1,
          secondaryColor: values.radarPalette2,
        },
        map: {
          regionPalette: [
            values.mapPalette1,
            values.mapPalette2,
            values.mapPalette3,
            values.mapPalette4,
            values.mapPalette5,
          ].filter(Boolean),
          regionBorderColor: values.mapRegionBorderColor,
          labelColor: values.mapLabelColor,
          visualMapTextColor: values.mapVisualMapTextColor,
        },
        kpi: {
          valueColor: values.kpiValueColor,
          labelColor: values.kpiLabelColor,
          compareColor: values.kpiCompareColor,
          dividerColor: values.kpiDividerColor,
          itemBackgroundColor: values.kpiItemBackgroundColor,
          ...buildFlipperBackgroundPayload(values),
          progressFillColor: values.kpiValueColor,
          progressTrackColor: currentRecord?.category === "dark" ? "#3b2e1f" : "#edf4ff",
        },
        tabs: {
          tabBarBackground: values.tabsTabBarBackground,
          activeTextColor: values.tabsActiveTextColor,
          inactiveTextColor: values.tabsInactiveTextColor,
          activeBackground: values.tabsActiveBackground,
          indicatorColor: values.tabsIndicatorColor,
        },
        table: {
          headerBackground: values.chromeBackgroundColor,
          headerTextColor: values.titleColor,
          rowBackground: values.chromeBackgroundColor,
          rowAlternateBackground: "#fafcff",
          rowBorderColor: values.chromeBorder,
        },
      },
    };
    setSaving(true);
    try {
      if (currentRecord) {
        await updateReportingThemeTemplate(token, currentRecord.id, payload);
        message.success("主题模板已更新");
      } else {
        const response = await createReportingThemeTemplate(token, payload);
        message.success("主题模板已创建");
        navigate(`/dashboard/reporting/theme-templates/${response.data.id}/edit`, { replace: true });
      }
    } catch (error: any) {
      message.error(`保存主题模板失败: ${error.message || "未知错误"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <PageToolbar
        left={(
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>{isEditMode ? "编辑主题模板" : "新建主题模板"}</Typography.Title>
            {isBuiltinTemplate ? <Typography.Text type="secondary">内置模板不支持直接编辑，请复制为自定义模板后再修改。</Typography.Text> : null}
          </div>
        )}
        right={(
          <Space>
            <Button icon={<RollbackOutlined />} onClick={() => navigate("/dashboard/reporting/theme-templates")}>返回模板中心</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={isBuiltinTemplate} onClick={() => void handleSave()}>保存模板</Button>
          </Space>
        )}
      />

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" initialValues={formInitialValues} disabled={isBuiltinTemplate}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) 520px", gap: 12, alignItems: "stretch", marginBottom: 4 }}>
            <Card style={{ height: 320 }} styles={{ body: { padding: 8, height: "100%" } }}>
              <Card size="small" title="基础信息" style={{ height: "100%" }} styles={{ body: { paddingTop: 8, paddingBottom: 4, height: "calc(100% - 56px)" } }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <Form.Item name="themeName" label="模板名称" rules={[{ required: true, message: "请输入模板名称" }]}><Input /></Form.Item>
                  <Form.Item name="themeCode" label="模板编码" rules={[{ required: true, message: "请输入模板编码" }]}><Input /></Form.Item>
                  <Form.Item name="category" label="分类"><Input /></Form.Item>
                  <Form.Item name="status" label="状态"><Select options={[{ value: "draft", label: "草稿" }, { value: "active", label: "发布" }, { value: "inactive", label: "停用" }]} /></Form.Item>
                  <Form.Item name="description" label="说明" style={{ gridColumn: "1 / -1", marginBottom: 0 }}><Input.TextArea rows={1} autoSize={false} style={{ minHeight: 42 }} /></Form.Item>
                </div>
              </Card>
            </Card>

            <Card style={{ height: 320 }} styles={{ body: { paddingTop: 8, paddingBottom: 8, height: "100%", overflow: "hidden" } }}>
              <Tabs
                items={[
                  {
                    key: "preview",
                    label: "效果预览",
                    children: activeEditorTab === "kpi" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
                          {[
                            { label: "当日交易额", value: "128.6万", compare: "+12.4%" },
                            { label: "新增客户", value: "1,248", compare: "+4.8%" },
                            { label: "转化率", value: "38.2%", compare: "-1.2%" },
                          ].map((item) => (
                            <div key={item.label} style={{ background: previewSource.kpiItemBackgroundColor, border: `1px solid ${previewSource.kpiDividerColor}`, borderRadius: 16, padding: 14 }}>
                              <div style={{ color: previewSource.kpiLabelColor, marginBottom: 8 }}>{item.label}</div>
                              <div style={{ color: previewSource.kpiValueColor, fontSize: 28, fontWeight: 700 }}>{item.value}</div>
                              <div style={{ color: previewSource.kpiCompareColor, marginTop: 6 }}>{item.compare}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                          {["1286", "1248", "382"].map((value, index) => (
                            <div key={`flipper_${index}`} style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              {value.split("").map((char, charIndex) => (
                                <div
                                  key={`${index}_${charIndex}`}
                                  style={{
                                    width: 36,
                                    height: 44,
                                    borderRadius: 10,
                                    background: previewSource.kpiFlipperBackground,
                                    color: "#f8fafc",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 24,
                                    fontWeight: 700,
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(15,23,42,0.18)",
                                  }}
                                >
                                  {char}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : activeEditorTab === "pie" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <div style={{ width: 150, height: 150, margin: "0 auto", borderRadius: "50%", background: `conic-gradient(${previewSource.piePalette[0]} 0 42%, ${previewSource.piePalette[1]} 42% 68%, ${previewSource.piePalette[2]} 68% 100%)`, position: "relative" }}>
                            <div style={{ position: "absolute", inset: 36, borderRadius: "50%", background: previewSource.chromeBackground, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                              <div style={{ color: previewSource.pieCenterTitleColor, fontSize: 14 }}>总量</div>
                              <div style={{ color: previewSource.pieCenterValueColor, fontSize: 28, fontWeight: 700 }}>2,486</div>
                              <div style={{ color: previewSource.pieCenterUnitColor, fontSize: 14 }}>笔</div>
                              <div style={{ color: previewSource.pieCenterMetaColor, fontSize: 12, marginTop: 6 }}>近 30 天</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, color: previewSource.pieLabelColor, fontSize: 12 }}>
                            <span>对公 42%</span>
                            <span>零售 26%</span>
                            <span>财富 32%</span>
                          </div>
                        </div>
                      </div>
                    ) : activeEditorTab === "bar" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 18, right: 18, bottom: 28, top: 22 }}>
                            <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 28, display: "flex", alignItems: "flex-end", gap: 14 }}>
                              {[54, 86, 68, 102].map((height, index) => (
                                <div key={`bar_preview_${index}`} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6 }}>
                                  <div style={{ flex: 1, height, borderRadius: `${previewValues.barBorderRadius || 8}px ${previewValues.barBorderRadius || 8}px 0 0`, background: String((previewValues as any)[`barPalette${(index % 2) + 1}`] || previewSource.primary), position: "relative" }}>
                                    <span style={{ position: "absolute", left: "50%", top: -24, transform: "translateX(-50%)", color: previewSource.barLabelColor, fontSize: 12, fontWeight: 600 }}>681</span>
                                  </div>
                                  <div style={{ flex: 1, height: Math.max(30, height - 18), borderRadius: `${previewValues.barBorderRadius || 8}px ${previewValues.barBorderRadius || 8}px 0 0`, background: String((previewValues as any)[`barPalette${((index + 1) % 2) + 1}`] || "#43c7c6"), opacity: 0.88 }} />
                                </div>
                              ))}
                            </div>
                            <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, height: 1, background: String(previewValues.barAxisColor || "#98a2b3") }} />
                            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", color: String(previewValues.barAxisLabelColor || "#344054"), fontSize: 12 }}>
                              <span>一季度</span>
                              <span>二季度</span>
                              <span>三季度</span>
                              <span>四季度</span>
                            </div>
                            <div style={{ position: "absolute", left: 0, right: 0, bottom: -2, display: "flex", justifyContent: "center", color: previewSource.barLegendColor, fontSize: 12 }}>
                              <span>图例一</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : activeEditorTab === "horizontalBar" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 16, height: "100%", position: "relative", overflow: "hidden" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 40px", rowGap: 12, columnGap: 10, alignItems: "center", height: "100%" }}>
                            {[
                              { label: "华北", value: 681 },
                              { label: "华东", value: 592 },
                              { label: "华南", value: 540 },
                              { label: "西南", value: 472 },
                              { label: "东北", value: 418 },
                            ].map((item, index) => (
                              <Fragment key={item.label}>
                                <div key={`label-${item.label}`} style={{ color: String(previewValues.horizontalBarAxisLabelColor || "#344054"), fontSize: 12 }}>{item.label}</div>
                                <div key={`bar-${item.label}`} style={{ position: "relative", height: 20, borderRadius: 999, background: "rgba(148,163,184,0.14)", overflow: "hidden" }}>
                                  <div
                                    style={{
                                      width: `${60 + index * 7}%`,
                                      height: "100%",
                                      borderRadius: `${previewValues.horizontalBarBorderRadius || 10}px`,
                                      background: previewSource.horizontalBarPalette[index % Math.max(1, previewSource.horizontalBarPalette.length)],
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "flex-end",
                                      paddingRight: 8,
                                      color: previewSource.horizontalBarLabelColor,
                                      fontSize: 12,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {item.value}
                                  </div>
                                </div>
                                <div key={`value-${item.label}`} style={{ color: previewSource.horizontalBarLegendColor, fontSize: 12, textAlign: "right" }}>{item.value}</div>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : activeEditorTab === "sankey" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 16, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 340 180" width="100%" height="100%" preserveAspectRatio="none">
                            {[
                              { d: "M42,32 C96,32 100,84 150,84", color: previewSource.sankeyPalette[0], width: 22 },
                              { d: "M42,86 C96,86 100,92 150,92", color: previewSource.sankeyPalette[1], width: 18 },
                              { d: "M42,140 C96,140 100,102 150,102", color: previewSource.sankeyPalette[2], width: 10 },
                              { d: "M168,90 C210,90 212,90 232,90", color: previewSource.sankeyPalette[3], width: 26 },
                              { d: "M250,90 C270,90 272,96 286,96", color: previewSource.sankeyPalette[4], width: 16 },
                              { d: "M304,96 C314,96 315,97 320,97", color: previewSource.sankeyPalette[1], width: 10 },
                            ].map((link, index) => (
                              <path
                                key={`sankey_link_${index}`}
                                d={link.d}
                                fill="none"
                                stroke={link.color}
                                strokeOpacity={previewSource.sankeyLinkOpacity}
                                strokeWidth={link.width}
                                strokeLinecap="round"
                              />
                            ))}
                            {[
                              { x: 24, y: 20, w: 18, h: 24, label: "APP", color: previewSource.sankeyPalette[0] },
                              { x: 24, y: 74, w: 18, h: 24, label: "小程序", color: previewSource.sankeyPalette[1] },
                              { x: 24, y: 128, w: 18, h: 24, label: "PC", color: previewSource.sankeyPalette[2] },
                              { x: 150, y: 48, w: 18, h: 72, label: "访问", color: previewSource.sankeyPalette[3] },
                              { x: 232, y: 70, w: 18, h: 40, label: "加购", color: previewSource.sankeyPalette[4] },
                              { x: 286, y: 82, w: 18, h: 28, label: "下单", color: previewSource.sankeyPalette[1] },
                              { x: 320, y: 88, w: 14, h: 18, label: "支付成功", color: previewSource.sankeyPalette[0] },
                            ].map((node) => (
                              <Fragment key={`sankey_node_${node.label}`}>
                                <rect
                                  x={node.x}
                                  y={node.y}
                                  width={node.w}
                                  height={node.h}
                                  rx={previewSource.sankeyNodeBorderRadius}
                                  fill={node.color}
                                  stroke={previewSource.sankeyNodeBorderColor}
                                  strokeWidth={previewSource.sankeyNodeBorderWidth}
                                />
                                <text
                                  x={node.x + node.w + (node.label === "支付成功" ? -8 : 10)}
                                  y={node.y + node.h / 2 + 4}
                                  textAnchor={node.label === "支付成功" ? "end" : "start"}
                                  fill={previewSource.sankeyLabelColor}
                                  fontSize="11"
                                  fontWeight="600"
                                >
                                  {node.label}
                                </text>
                              </Fragment>
                            ))}
                          </svg>
                        </div>
                      </div>
                    ) : activeEditorTab === "gauge" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                            {previewSource.gaugeSegmentPaths.map((segment: { color: string; path: string }, index: number) => (
                              <path
                                key={`gauge_segment_${index}`}
                                d={segment.path}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth={previewSource.gaugeAxisLineWidth}
                                strokeLinecap="round"
                                opacity={0.4 + index * 0.12}
                              />
                            ))}
                            <path
                              d={previewSource.gaugeProgressPath}
                              fill="none"
                              stroke={previewSource.gaugePointerColor}
                              strokeWidth={previewSource.gaugeProgressWidth}
                              strokeLinecap="round"
                            />
                            <line
                              x1={previewSource.gaugeCenterX}
                              y1={previewSource.gaugeCenterY}
                              x2={previewSource.gaugePointerTip.x}
                              y2={previewSource.gaugePointerTip.y}
                              stroke={previewSource.gaugePointerColor}
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                            <circle cx={previewSource.gaugeCenterX} cy={previewSource.gaugeCenterY} r="6" fill={previewSource.gaugePointerColor} />
                            <circle cx={previewSource.gaugeCenterX} cy={previewSource.gaugeCenterY} r="3" fill={previewSource.chromeBackground} />
                            <text x={previewSource.gaugeTickZero.x} y={previewSource.gaugeTickZero.y} textAnchor="middle" fill={previewSource.gaugeAxisLabelColor} fontSize="11">0</text>
                            <text x={previewSource.gaugeTickMid.x} y={previewSource.gaugeTickMid.y} textAnchor="middle" fill={previewSource.gaugeAxisLabelColor} fontSize="11">50</text>
                            <text x={previewSource.gaugeTickMax.x} y={previewSource.gaugeTickMax.y} textAnchor="middle" fill={previewSource.gaugeAxisLabelColor} fontSize="11">100</text>
                            <text x="160" y="96" textAnchor="middle" fill={previewSource.gaugeTitleColor} fontSize={previewSource.gaugeTitleFontSize}>达成率</text>
                            <text x="160" y="126" textAnchor="middle" fill={previewSource.gaugeDetailColor} fontSize={previewSource.gaugeDetailFontSize} fontWeight={previewSource.gaugeDetailFontWeight}>{previewSource.gaugeValue}%</text>
                            <path d={buildGaugePreviewArcPath(160, 124, previewSource.gaugeRadius + 8, previewSource.gaugeStartAngle, previewSource.gaugeEndAngle)} fill="none" stroke={previewSource.gaugeSplitLineColor} strokeWidth="1" strokeDasharray="3 6" opacity="0.55" />
                          </svg>
                        </div>
                      </div>
                    ) : activeEditorTab === "funnel" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 16, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 340 180" width="100%" height="100%" preserveAspectRatio="none">
                            {[
                              { points: "42,20 246,20 216,48 72,48", name: "访问", value: "100000", color: previewSource.funnelPalette[0] },
                              { points: "64,54 224,54 200,82 88,82", name: "加购", value: "64000", color: previewSource.funnelPalette[1] },
                              { points: "84,88 204,88 186,116 102,116", name: "下单", value: "48000", color: previewSource.funnelPalette[2] },
                              { points: "102,122 186,122 172,150 116,150", name: "支付", value: "32000", color: previewSource.funnelPalette[3] },
                              { points: "118,156 170,156 160,174 128,174", name: "复购", value: "16000", color: previewSource.funnelPalette[4] },
                            ].map((item, index) => {
                              const labelY = 38 + index * 34;
                              return (
                                <Fragment key={`funnel_preview_${item.name}`}>
                                  <polygon
                                    points={item.points}
                                    fill={item.color}
                                    stroke={previewSource.funnelBlockBorderColor}
                                    strokeWidth={previewSource.funnelBlockBorderWidth}
                                  />
                                  <path
                                    d={`M${246 - index * 22},${labelY} C${272 - index * 10},${labelY} ${282 - index * 4},${labelY} ${296 - index * 2},${labelY}`}
                                    fill="none"
                                    stroke={previewSource.funnelGuideLineColor}
                                    strokeWidth="1.5"
                                    strokeDasharray={previewSource.funnelItemGap > 2 ? "5 3" : "0"}
                                  />
                                  <text x="302" y={labelY - 2} fill={previewSource.funnelLabelColor} fontSize="11" fontWeight="600">
                                    {item.name}
                                  </text>
                                  <text x="302" y={labelY + 12} fill={previewSource.funnelValueColor} fontSize="11" fontWeight="700">
                                    {item.value}
                                  </text>
                                </Fragment>
                              );
                            })}
                          </svg>
                        </div>
                      </div>
                    ) : activeEditorTab === "wordCloud" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 12, clipPath: previewSource.wordCloudClipPath, background: "rgba(148,163,184,0.06)" }} />
                          <div style={{ position: "absolute", inset: 12, clipPath: previewSource.wordCloudClipPath }}>
                            {previewSource.wordCloudPreviewWords.map((item: { label: string; size: number; left: string; top: string; rotate: number; color: string }) => (
                              <span
                                key={item.label}
                                style={{
                                  position: "absolute",
                                  left: item.left,
                                  top: item.top,
                                  transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`,
                                  fontSize: item.size,
                                  fontWeight: previewSource.wordCloudFontWeight,
                                  color: item.color,
                                  textShadow: `0 0 ${previewSource.wordCloudTextShadowBlur}px ${previewSource.wordCloudTextShadowColor}`,
                                  whiteSpace: "nowrap",
                                  letterSpacing: 0,
                                  lineHeight: 1,
                                }}
                              >
                                {item.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : activeEditorTab === "line" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 320 160" width="100%" height="100%" preserveAspectRatio="none">
                            {[0, 1, 2, 3].map((item) => (
                              <line
                                key={`line_grid_${item}`}
                                x1="36"
                                x2="300"
                                y1={28 + item * 30}
                                y2={28 + item * 30}
                                stroke={previewSource.lineSplitLineColor}
                                strokeDasharray="4 4"
                                strokeWidth="1"
                              />
                            ))}
                            <polyline
                              fill={`rgba(79,140,255,${Math.max(0.08, Math.min(0.4, Number(previewSource.lineAreaOpacity || 0.18)))})`}
                              stroke={previewSource.linePalette[0]}
                              strokeWidth={Math.max(1, Number(previewSource.lineWidth || 3))}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              points="36,122 86,98 136,106 186,72 236,58 286,40 286,140 36,140"
                            />
                            <polyline
                              fill="none"
                              stroke={previewSource.linePalette[0]}
                              strokeWidth={Math.max(1, Number(previewSource.lineWidth || 3))}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              points="36,122 86,98 136,106 186,72 236,58 286,40"
                            />
                            {[36, 86, 136, 186, 236, 286].map((x, index) => (
                              <g key={`line_point_${index}`}>
                                {previewSource.lineShowSymbol ? (
                                  <circle cx={x} cy={[122, 98, 106, 72, 58, 40][index]} r={Math.max(2, Number(previewSource.lineSymbolSize || 6) / 2)} fill={previewSource.linePalette[index % previewSource.linePalette.length]} stroke={previewSource.chromeBackground} strokeWidth="2" />
                                ) : null}
                                <text x={x} y={18} textAnchor="middle" fill={previewSource.linePalette[index % previewSource.linePalette.length]} fontSize="12" fontWeight="600">
                                  {[120, 160, 148, 210, 230, 268][index]}
                                </text>
                              </g>
                            ))}
                            {["1月", "2月", "3月", "4月", "5月", "6月"].map((label, index) => (
                              <text key={label} x={[36, 86, 136, 186, 236, 286][index]} y="156" textAnchor="middle" fill={previewSource.lineAxisLabelColor} fontSize="11">
                                {label}
                              </text>
                            ))}
                          </svg>
                        </div>
                      </div>
                    ) : activeEditorTab === "combo" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 320 160" width="100%" height="100%" preserveAspectRatio="none">
                            {[0, 1, 2, 3].map((item) => (
                              <line
                                key={`combo_grid_${item}`}
                                x1="34"
                                x2="298"
                                y1={30 + item * 28}
                                y2={30 + item * 28}
                                stroke={previewSource.comboSplitLineColor}
                                strokeDasharray="4 4"
                                strokeWidth="1"
                              />
                            ))}
                            {[96, 78, 66, 48, 58, 34].map((y, index) => (
                              <g key={`combo_bar_${index}`}>
                                <rect
                                  x={36 + index * 42}
                                  y={y}
                                  width="22"
                                  height={140 - y}
                                  rx={previewSource.comboBarBorderRadius}
                                  fill={previewSource.comboPalette[0]}
                                />
                                <text
                                  x={47 + index * 42}
                                  y={y - 8}
                                  textAnchor="middle"
                                  fill={previewSource.comboLabelColor}
                                  fontSize="11"
                                  fontWeight="600"
                                >
                                  {[320, 368, 402, 456, 428, 512][index]}
                                </text>
                              </g>
                            ))}
                            <polyline
                              fill={previewSource.comboPalette[1]}
                              fillOpacity={Math.max(0.08, Math.min(0.4, Number(previewSource.comboLineAreaOpacity || 0.18)))}
                              stroke={previewSource.comboPalette[1]}
                              strokeWidth={Math.max(1, Number(previewSource.comboLineWidth || 3))}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              points="47,94 89,78 131,68 173,56 215,60 257,44 257,140 47,140"
                            />
                            <polyline
                              fill="none"
                              stroke={previewSource.comboPalette[1]}
                              strokeWidth={Math.max(1, Number(previewSource.comboLineWidth || 3))}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              points="47,94 89,78 131,68 173,56 215,60 257,44"
                            />
                            {[47, 89, 131, 173, 215, 257].map((x, index) => (
                              <g key={`combo_point_${index}`}>
                                {previewSource.comboLineShowSymbol ? (
                                  <circle
                                    cx={x}
                                    cy={[94, 78, 68, 56, 60, 44][index]}
                                    r={Math.max(2, Number(previewSource.comboLineSymbolSize || 6) / 2)}
                                    fill={previewSource.comboPalette[1]}
                                    stroke={previewSource.chromeBackground}
                                    strokeWidth="2"
                                  />
                                ) : null}
                              </g>
                            ))}
                            <circle cx="257" cy="44" r="7" fill={previewSource.comboMaxPointColor} />
                            <circle cx="47" cy="94" r="7" fill={previewSource.comboMinPointColor} />
                            <text x="257" y="28" textAnchor="middle" fill={previewSource.comboMaxPointColor} fontSize="11" fontWeight="700">最大值</text>
                            <text x="47" y="112" textAnchor="middle" fill={previewSource.comboMinPointColor} fontSize="11" fontWeight="700">最小值</text>
                            {["1月", "2月", "3月", "4月", "5月", "6月"].map((label, index) => (
                              <text key={label} x={47 + index * 42} y="156" textAnchor="middle" fill={previewSource.comboAxisLabelColor} fontSize="11">
                                {label}
                              </text>
                            ))}
                          </svg>
                          <div style={{ position: "absolute", left: 18, right: 18, bottom: 8, display: "flex", justifyContent: "center", gap: 18, color: previewSource.comboLegendColor, fontSize: 12 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: previewSource.comboPalette[0], display: "inline-block" }} />交易额</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 2, background: previewSource.comboPalette[1], display: "inline-block" }} />转化率</span>
                          </div>
                        </div>
                      </div>
                    ) : activeEditorTab === "scatter" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 320 160" width="100%" height="100%" preserveAspectRatio="none">
                            {[0, 1, 2, 3].map((item) => (
                              <line
                                key={`scatter_grid_${item}`}
                                x1="40"
                                x2="300"
                                y1={28 + item * 28}
                                y2={28 + item * 28}
                                stroke={previewSource.scatterSplitLineColor}
                                strokeDasharray="4 4"
                                strokeWidth="1"
                              />
                            ))}
                            <line x1="40" y1="140" x2="300" y2="140" stroke={previewSource.scatterAxisColor} strokeWidth="1.5" />
                            <line x1="40" y1="24" x2="40" y2="140" stroke={previewSource.scatterAxisColor} strokeWidth="1.5" />
                            {[
                              { x: 82, y: 114, label: "私银", color: previewSource.scatterPalette[0], scale: 0.85 },
                              { x: 126, y: 98, label: "财富", color: previewSource.scatterPalette[1], scale: 1 },
                              { x: 158, y: 88, label: "零售", color: previewSource.scatterPalette[2], scale: 0.92 },
                              { x: 208, y: 64, label: "会员", color: previewSource.scatterPalette[3], scale: 1.08 },
                              { x: 252, y: 46, label: "高净值", color: previewSource.scatterPalette[4], scale: 1.18 },
                            ].map((item) => (
                              <g key={`scatter_point_${item.label}`}>
                                <circle
                                  cx={item.x}
                                  cy={item.y}
                                  r={Math.max(5, (previewSource.scatterSymbolSize / 2.3) * item.scale)}
                                  fill={item.color}
                                  fillOpacity={Math.max(0.15, Math.min(1, previewSource.scatterPointOpacity))}
                                  stroke={previewSource.scatterPointBorderColor}
                                  strokeWidth={previewSource.scatterPointBorderWidth}
                                />
                                <text
                                  x={item.x}
                                  y={previewSource.scatterLabelPosition === "bottom" ? item.y + 18 : item.y - 12}
                                  textAnchor="middle"
                                  fill={previewSource.scatterLabelColor}
                                  fontSize="11"
                                  fontWeight="600"
                                >
                                  {item.label}
                                </text>
                              </g>
                            ))}
                            {["60", "100", "140", "180"].map((label, index) => (
                              <text key={`scatter_x_${label}`} x={84 + index * 56} y="156" textAnchor="middle" fill={previewSource.scatterAxisLabelColor} fontSize="11">
                                {label}
                              </text>
                            ))}
                            {["30%", "50%", "70%", "90%"].map((label, index) => (
                              <text key={`scatter_y_${label}`} x="30" y={136 - index * 28} textAnchor="end" fill={previewSource.scatterAxisLabelColor} fontSize="11">
                                {label}
                              </text>
                            ))}
                          </svg>
                          <div style={{ position: "absolute", left: 18, right: 18, bottom: 8, display: "flex", justifyContent: "center", gap: 8, color: previewSource.scatterLegendColor, fontSize: 12 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: previewSource.scatterPalette[0], display: "inline-block" }} />
                              客单价 vs 复购率
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : activeEditorTab === "radar" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 280 180" width="100%" height="100%" preserveAspectRatio="none">
                            {[30, 55, 80].map((radius, ringIndex) => (
                              <polygon
                                key={`radar_ring_${ringIndex}`}
                                points={[
                                  [140, 28 + radius],
                                  [140 + radius * 0.82, 80 - radius * 0.35],
                                  [140 + radius * 0.5, 136 + radius * 0.02],
                                  [140 - radius * 0.5, 136 + radius * 0.02],
                                  [140 - radius * 0.82, 80 - radius * 0.35],
                                ].map(([x, y]) => `${x},${y}`).join(" ")}
                                fill="none"
                                stroke={previewSource.radarGridLineColor}
                                strokeWidth="1"
                                strokeDasharray={ringIndex === 2 ? "0" : "4 4"}
                              />
                            ))}
                            <polygon
                              points="140,44 192,71 180,125 100,125 88,71"
                              fill={`rgba(79,140,255,${Math.max(0.08, Math.min(0.4, Number(previewSource.radarAreaOpacity || 0.22)))})`}
                              stroke={previewSource.radarPalette[0]}
                              strokeWidth="2"
                            />
                            {[
                              { x1: 140, y1: 44, x2: 140, y2: 18, label: "维度一", lx: 140, ly: 12 },
                              { x1: 192, y1: 71, x2: 214, y2: 56, label: "维度二", lx: 225, ly: 56 },
                              { x1: 180, y1: 125, x2: 198, y2: 148, label: "维度三", lx: 214, ly: 157 },
                              { x1: 100, y1: 125, x2: 82, y2: 148, label: "维度四", lx: 66, ly: 157 },
                              { x1: 88, y1: 71, x2: 66, y2: 56, label: "维度五", lx: 52, ly: 56 },
                            ].map((item, index) => (
                              <g key={item.label}>
                                <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={previewSource.radarGridLineColor} strokeWidth="1" />
                                <circle cx={item.x1} cy={item.y1} r={3} fill={previewSource.radarPointColor} />
                                <text x={item.lx} y={item.ly} textAnchor="middle" fill={previewSource.radarIndicatorTextColor} fontSize="11">
                                  {item.label}
                                </text>
                                <text x={item.lx} y={item.ly + 12} textAnchor="middle" fill={previewSource.radarIndicatorTextColor} fontSize="11">
                                  {[80, 72, 84, 76, 90][index]}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>
                    ) : activeEditorTab === "map" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, padding: 14, height: "100%", position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 360 176" width="100%" height="100%" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="theme-map-gradient" x1="0" y1="0" x2="1" y2="0">
                                {previewSource.mapPalette.map((color, index) => (
                                  <stop key={`${color}_${index}`} offset={`${(index / Math.max(1, previewSource.mapPalette.length - 1)) * 100}%`} stopColor={color} />
                                ))}
                              </linearGradient>
                            </defs>
                            {[
                              { key: "west", label: "西部", fill: previewSource.mapPalette[0], points: "44,74 82,44 122,54 118,94 74,112 46,96", x: 84, y: 82 },
                              { key: "north", label: "华北", fill: previewSource.mapPalette[1], points: "118,48 162,38 188,54 176,82 130,86 114,66", x: 152, y: 64 },
                              { key: "mid", label: "华中", fill: previewSource.mapPalette[2], points: "124,88 170,84 196,100 182,126 136,128 114,108", x: 154, y: 108 },
                              { key: "east", label: "华东", fill: previewSource.mapPalette[3], points: "188,56 228,54 250,78 234,116 196,106 178,82", x: 220, y: 86 },
                              { key: "south", label: "华南", fill: previewSource.mapPalette[4], points: "158,130 196,126 228,138 214,162 170,164 146,146", x: 186, y: 148 },
                              { key: "northeast", label: "东北", fill: previewSource.mapPalette[3], points: "230,30 274,22 304,46 286,74 246,66 226,48", x: 266, y: 48 },
                            ].map((item) => (
                              <Fragment key={item.key}>
                                <polygon points={item.points} fill={item.fill} stroke={previewSource.mapRegionBorderColor} strokeWidth="2" />
                                <text x={item.x} y={item.y} textAnchor="middle" fill={previewSource.mapLabelColor} fontSize="11" fontWeight="600">
                                  {item.label}
                                </text>
                              </Fragment>
                            ))}
                            <g transform="translate(60 150)">
                              <rect x="0" y="0" width="188" height="12" rx="6" fill="url(#theme-map-gradient)" />
                              <text x="0" y="-8" fill={previewSource.mapVisualMapTextColor} fontSize="10">低</text>
                              <text x="188" y="-8" textAnchor="end" fill={previewSource.mapVisualMapTextColor} fontSize="10">高</text>
                            </g>
                          </svg>
                        </div>
                      </div>
                    ) : activeEditorTab === "tabs" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden" }}>
                        <div style={{ background: previewSource.tabsTabBarBackground, borderRadius: 18, padding: 12, height: "100%", overflow: "hidden" }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <div style={{ padding: "8px 14px", borderRadius: 999, background: previewSource.tabsActiveBackground, color: previewSource.tabsActiveTextColor, boxShadow: `inset 0 -2px 0 ${previewSource.tabsIndicatorColor}` }}>概览</div>
                            <div style={{ padding: "8px 14px", borderRadius: 999, color: previewSource.tabsInactiveTextColor }}>趋势</div>
                            <div style={{ padding: "8px 14px", borderRadius: 999, color: previewSource.tabsInactiveTextColor }}>明细</div>
                          </div>
                          <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 16, padding: 16, height: 140, overflow: "hidden" }}>
                            <div style={{ color: previewSource.titleColor, fontWeight: 700 }}>标签页容器预览</div>
                          </div>
                        </div>
                      </div>
                    ) : activeEditorTab === "canvasBackground" || activeEditorTab === "chrome" ? (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden", border: `1px solid ${previewSource.chromeBorder}`, display: "flex", alignItems: "stretch", boxSizing: "border-box" }}>
                        <div style={{ background: previewSource.chromeBackground, border: `1px solid ${previewSource.chromeBorder}`, borderRadius: 18, height: "100%", width: "100%", padding: 14, boxSizing: "border-box", overflow: "hidden", position: "relative", display: "flex", alignItems: "stretch" }}>
                          <div
                            style={{
                              position: "absolute",
                              inset: 12,
                              borderRadius: 14,
                              backgroundColor: previewSource.canvasBackground.backgroundColor,
                              backgroundImage: previewSource.canvasBackground.backgroundImage,
                              backgroundPosition: previewSource.canvasBackground.backgroundPosition,
                              backgroundSize: previewSource.canvasBackground.backgroundSize,
                              backgroundRepeat: previewSource.canvasBackground.backgroundRepeat,
                              opacity: 0.85,
                              pointerEvents: "none",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              right: 16,
                              bottom: 16,
                              width: 72,
                              height: 72,
                              borderRadius: 999,
                              border: "1px solid rgba(255,255,255,0.45)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255,255,255,0.18)",
                              color: previewSource.titleColor,
                              fontSize: 28,
                              fontWeight: 700,
                            }}
                          >
                            {previewValues.canvasBackgroundType === "gradient"
                              ? (String(previewValues.canvasGradientDirection || "to bottom") === "to bottom" ? "↓"
                                : String(previewValues.canvasGradientDirection || "") === "to top" ? "↑"
                                  : String(previewValues.canvasGradientDirection || "") === "to right" ? "→"
                                    : String(previewValues.canvasGradientDirection || "") === "to left" ? "←"
                                      : String(previewValues.canvasGradientDirection || "") === "to bottom right" ? "↘"
                                        : "↗")
                              : "■"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 10, borderRadius: 18, backgroundColor: previewSource.canvasBackground.backgroundColor, backgroundImage: previewSource.canvasBackground.backgroundImage, backgroundPosition: previewSource.canvasBackground.backgroundPosition, backgroundSize: previewSource.canvasBackground.backgroundSize, backgroundRepeat: previewSource.canvasBackground.backgroundRepeat, height: 240, overflow: "hidden", border: `1px solid ${previewSource.chromeBorder}` }} />
                    ),
                  },
                  {
                    key: "code",
                    label: "源码",
                    children: (
                      <Input.TextArea value={previewSource.code} style={{ height: 240 }} />
                    ),
                  },
                ]}
              />
            </Card>
          </div>

          <Card>
            <Tabs
                activeKey={activeEditorTab}
                onChange={setActiveEditorTab}
                items={[
                {
                  key: "canvasBackground",
                  label: "画布背景",
                  children: (
                    <Form.Item noStyle shouldUpdate>
                      {() => {
                        const backgroundType = form.getFieldValue("canvasBackgroundType") || "solid";
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                            <Form.Item name="canvasBackgroundType" label="画布背景类型" initialValue="solid" style={{ gridColumn: "1 / -1" }}>
                              <Select options={[{ value: "solid", label: "纯色" }, { value: "gradient", label: "渐变" }, { value: "image", label: "图片" }]} />
                            </Form.Item>

                            {backgroundType === "solid" ? (
                              <>
                                <ThemeColorField form={form} name="canvasBackgroundColor" label="画布纯色" />
                                <Card size="small" title="纯色预设" styles={{ body: { padding: 12 } }} style={{ gridColumn: "span 2" }}>
                                  <Space wrap>
                                    {backgroundPresets.solid.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() => form.setFieldValue("canvasBackgroundColor", color)}
                                        style={{ width: 56, height: 56, borderRadius: 14, border: "1px solid #d6deea", background: color, cursor: "pointer" }}
                                      />
                                    ))}
                                  </Space>
                                </Card>
                              </>
                            ) : null}

                            {backgroundType === "gradient" ? (
                              <>
                                <ThemeColorField form={form} name="canvasGradientStart" label="渐变起始色" />
                                <ThemeColorField form={form} name="canvasGradientEnd" label="渐变结束色" />
                                <Card size="small" title="渐变方向" styles={{ body: { padding: 12 } }}>
                                  <Form.Item name="canvasGradientDirection" noStyle>
                                    <Input type="hidden" />
                                  </Form.Item>
                                  <Form.Item noStyle shouldUpdate>
                                    {() => (
                                      <Space wrap>
                                        {GRADIENT_DIRECTION_OPTIONS.map((item) => {
                                          const active = form.getFieldValue("canvasGradientDirection") === item.value;
                                          return (
                                            <button
                                              key={item.value}
                                              type="button"
                                              onClick={() => form.setFieldValue("canvasGradientDirection", item.value)}
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
                                <Card size="small" title="渐变预设" styles={{ body: { padding: 12 } }} style={{ gridColumn: "1 / -1" }}>
                                  <Space wrap>
                                    {backgroundPresets.gradient.map((preset, index) => (
                                      <button
                                        key={`${preset.start}_${preset.end}_${index}`}
                                        type="button"
                                        onClick={() => {
                                          form.setFieldValue("canvasGradientStart", preset.start);
                                          form.setFieldValue("canvasGradientEnd", preset.end);
                                          form.setFieldValue("canvasGradientDirection", preset.direction);
                                        }}
                                        style={{
                                          width: 120,
                                          height: 56,
                                          borderRadius: 14,
                                          border: "1px solid #d6deea",
                                          background: `linear-gradient(${preset.direction}, ${preset.start} 0%, ${preset.end} 100%)`,
                                          cursor: "pointer",
                                        }}
                                      />
                                    ))}
                                  </Space>
                                </Card>
                              </>
                            ) : null}

                            {backgroundType === "image" ? (
                              <>
                                <Form.Item name="canvasBackgroundImage" label="背景图片地址" style={{ gridColumn: "1 / span 2" }}><Input /></Form.Item>
                                <Form.Item label="上传背景图" style={{ marginBottom: 0 }}>
                                  <Upload
                                    showUploadList={false}
                                    accept="image/*"
                                    beforeUpload={async (file) => {
                                      const buffer = await file.arrayBuffer();
                                      const base64 = Buffer.from(buffer).toString("base64");
                                      const dataUrl = `data:${file.type};base64,${base64}`;
                                      form.setFieldValue("canvasBackgroundType", "image");
                                      form.setFieldValue("canvasBackgroundImage", dataUrl);
                                      message.success("背景图已载入");
                                      return false;
                                    }}
                                  >
                                    <Button icon={<UploadOutlined />}>上传背景图</Button>
                                  </Upload>
                                </Form.Item>
                                <Card size="small" title="图片预设" styles={{ body: { padding: 12 } }} style={{ gridColumn: "1 / -1" }}>
                                  <Space wrap>
                                    {backgroundPresets.image.map((image, index) => (
                                      <button
                                        key={`image_preset_${index}`}
                                        type="button"
                                        onClick={() => form.setFieldValue("canvasBackgroundImage", image)}
                                        style={{
                                          width: 120,
                                          height: 56,
                                          borderRadius: 14,
                                          border: "1px solid #d6deea",
                                          background: `url(${image}) center/cover no-repeat`,
                                          cursor: "pointer",
                                        }}
                                      />
                                    ))}
                                  </Space>
                                </Card>
                              </>
                            ) : null}
                            <ThemeColorField form={form} name="dashboardTitleColor" label="报表名称颜色" />
                          </div>
                        );
                      }}
                    </Form.Item>
                  ),
                },
                {
                  key: "chrome",
                  label: "容器",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <Form.Item name="chromeBackgroundType" label="容器背景类型" style={{ gridColumn: "1 / -1" }}>
                        <Select options={[{ value: "solid", label: "纯色" }, { value: "gradient", label: "渐变" }, { value: "image", label: "图片" }]} />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate>
                        {() => {
                          const chromeType = form.getFieldValue("chromeBackgroundType") || "solid";
                          if (chromeType === "solid") {
                            return <ThemeColorField form={form} name="chromeBackgroundColor" label="容器纯色" />;
                          }
                          if (chromeType === "image") {
                            return (
                              <>
                                <Form.Item name="chromeBackgroundImage" label="容器背景图片" style={{ gridColumn: "1 / span 3" }}>
                                  <Input />
                                </Form.Item>
                                <Form.Item label="上传容器背景图">
                                  <Upload
                                    showUploadList={false}
                                    accept="image/*"
                                    beforeUpload={async (file) => {
                                      const buffer = await file.arrayBuffer();
                                      const base64 = Buffer.from(buffer).toString("base64");
                                      const dataUrl = `data:${file.type};base64,${base64}`;
                                      form.setFieldValue("chromeBackgroundType", "image");
                                      form.setFieldValue("chromeBackgroundImage", dataUrl);
                                      message.success("容器背景图已载入");
                                      return false;
                                    }}
                                  >
                                    <Button icon={<UploadOutlined />}>上传图片</Button>
                                  </Upload>
                                </Form.Item>
                              </>
                            );
                          }
                          return (
                            <>
                              <ThemeColorField form={form} name="chromeGradientStart" label="容器渐变起始色" />
                              <ThemeColorField form={form} name="chromeGradientEnd" label="容器渐变结束色" />
                              <Card size="small" title="容器渐变方向" styles={{ body: { padding: 12 } }} style={{ gridColumn: "span 2" }}>
                                <Form.Item name="chromeGradientDirection" noStyle>
                                  <Input type="hidden" />
                                </Form.Item>
                                <Form.Item noStyle shouldUpdate>
                                  {() => (
                                    <Space wrap>
                                      {GRADIENT_DIRECTION_OPTIONS.map((item) => {
                                        const active = form.getFieldValue("chromeGradientDirection") === item.value;
                                        return (
                                          <button
                                            key={`chrome_${item.value}`}
                                            type="button"
                                            onClick={() => form.setFieldValue("chromeGradientDirection", item.value)}
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
                      <ThemeColorField form={form} name="chromeBorder" label="容器边框" />
                      <ThemeColorField form={form} name="titleColor" label="标题颜色" />
                      <ThemeColorField form={form} name="primary" label="主色" />
                    </div>
                  ),
                },
                {
                  key: "kpi",
                  label: "指标看板",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="kpiValueColor" label="数值颜色" />
                      <ThemeColorField form={form} name="kpiLabelColor" label="名称颜色" />
                      <ThemeColorField form={form} name="kpiDividerColor" label="分割线颜色" />
                      <ThemeColorField form={form} name="kpiItemBackgroundColor" label="卡片背景" />
                      <ThemeColorField form={form} name="kpiCompareColor" label="对比颜色" />
                      <Form.Item name="kpiFlipperBackgroundType" label="翻牌背景类型" style={{ gridColumn: "1 / -1" }}>
                        <Select options={[{ value: "solid", label: "纯色" }, { value: "gradient", label: "渐变" }, { value: "image", label: "图片" }]} />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate>
                        {() => {
                          const flipperType = form.getFieldValue("kpiFlipperBackgroundType") || "gradient";
                          if (flipperType === "solid") {
                            return <ThemeColorField form={form} name="kpiFlipperBackgroundColor" label="翻牌纯色" />;
                          }
                          if (flipperType === "image") {
                            return (
                              <>
                                <Form.Item name="kpiFlipperBackgroundImage" label="翻牌背景图片" style={{ gridColumn: "1 / span 3" }}>
                                  <Input />
                                </Form.Item>
                                <Form.Item label="上传翻牌背景图">
                                  <Upload
                                    showUploadList={false}
                                    accept="image/*"
                                    beforeUpload={async (file) => {
                                      const buffer = await file.arrayBuffer();
                                      const base64 = Buffer.from(buffer).toString("base64");
                                      const dataUrl = `data:${file.type};base64,${base64}`;
                                      form.setFieldValue("kpiFlipperBackgroundType", "image");
                                      form.setFieldValue("kpiFlipperBackgroundImage", dataUrl);
                                      message.success("翻牌背景图已载入");
                                      return false;
                                    }}
                                  >
                                    <Button icon={<UploadOutlined />}>上传图片</Button>
                                  </Upload>
                                </Form.Item>
                              </>
                            );
                          }
                          return (
                            <>
                              <ThemeColorField form={form} name="kpiFlipperGradientStart" label="翻牌渐变起始色" />
                              <ThemeColorField form={form} name="kpiFlipperGradientEnd" label="翻牌渐变结束色" />
                              <Card size="small" title="翻牌渐变方向" styles={{ body: { padding: 12 } }} style={{ gridColumn: "span 2" }}>
                                <Form.Item name="kpiFlipperGradientDirection" noStyle>
                                  <Input type="hidden" />
                                </Form.Item>
                                <Form.Item noStyle shouldUpdate>
                                  {() => (
                                    <Space wrap>
                                      {GRADIENT_DIRECTION_OPTIONS.map((item) => {
                                        const active = form.getFieldValue("kpiFlipperGradientDirection") === item.value;
                                        return (
                                          <button
                                            key={`kpi_flipper_${item.value}`}
                                            type="button"
                                            onClick={() => form.setFieldValue("kpiFlipperGradientDirection", item.value)}
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
                    </div>
                  ),
                },
                {
                  key: "pie",
                  label: "饼图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="pieCenterTitleColor" label="中心标题颜色" />
                      <ThemeColorField form={form} name="pieCenterValueColor" label="中心数值颜色" />
                      <ThemeColorField form={form} name="pieCenterUnitColor" label="中心单位颜色" />
                      <ThemeColorField form={form} name="pieCenterMetaColor" label="中心副文案颜色" />
                      <ThemeColorField form={form} name="pieLabelColor" label="标签颜色" />
                      <ThemeColorField form={form} name="pieValueColor" label="数值颜色" />
                      <ThemeColorField form={form} name="pieGuideLineColor" label="引导线颜色" />
                      <ThemeColorField form={form} name="pieSliceBorderColor" label="描边颜色" />
                      <ThemeColorField form={form} name="pieShadowColor" label="阴影颜色" />
                      <ThemeColorField form={form} name="piePalette1" label="主色一" />
                      <ThemeColorField form={form} name="piePalette2" label="主色二" />
                      <ThemeColorField form={form} name="piePalette3" label="主色三" />
                      <ThemeColorField form={form} name="piePalette4" label="主色四" />
                      <ThemeColorField form={form} name="piePalette5" label="主色五" />
                      <Card size="small" title="默认内半径" styles={{ body: { padding: 12 } }}><Form.Item name="pieDefaultInnerRadius" noStyle><Input type="number" /></Form.Item></Card>
                      <Card size="small" title="默认外半径" styles={{ body: { padding: 12 } }}><Form.Item name="pieDefaultOuterRadius" noStyle><Input type="number" /></Form.Item></Card>
                      <Card size="small" title="默认标签模式" styles={{ body: { padding: 12 } }}><Form.Item name="pieDefaultLabelMode" noStyle><Select options={[{ value: "outside", label: "外部" }, { value: "inside", label: "内部" }, { value: "center", label: "中心" }, { value: "hidden", label: "隐藏" }]} /></Form.Item></Card>
                    </div>
                  ),
                },
                {
                  key: "bar",
                  label: "柱状图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="barPalette1" label="柱色一" />
                      <ThemeColorField form={form} name="barPalette2" label="柱色二" />
                      <ThemeColorField form={form} name="barLabelColor" label="标签颜色" />
                      <ThemeColorField form={form} name="barLegendColor" label="图例颜色" />
                      <ThemeColorField form={form} name="barAxisColor" label="坐标轴颜色" />
                      <ThemeColorField form={form} name="barAxisLabelColor" label="坐标文字颜色" />
                      <ThemeColorField form={form} name="barSplitLineColor" label="分割线颜色" />
                      <Card size="small" title="柱体圆角" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="barBorderRadius" noStyle><Input type="number" min={0} max={32} /></Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "horizontalBar",
                  label: "条形图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="horizontalBarPalette1" label="颜色一" />
                      <ThemeColorField form={form} name="horizontalBarPalette2" label="颜色二" />
                      <ThemeColorField form={form} name="horizontalBarPalette3" label="颜色三" />
                      <ThemeColorField form={form} name="horizontalBarPalette4" label="颜色四" />
                      <ThemeColorField form={form} name="horizontalBarPalette5" label="颜色五" />
                      <ThemeColorField form={form} name="horizontalBarLabelColor" label="标签颜色" />
                      <ThemeColorField form={form} name="horizontalBarLegendColor" label="图例颜色" />
                      <ThemeColorField form={form} name="horizontalBarAxisColor" label="坐标轴颜色" />
                      <ThemeColorField form={form} name="horizontalBarAxisLabelColor" label="坐标文字颜色" />
                      <ThemeColorField form={form} name="horizontalBarSplitLineColor" label="分割线颜色" />
                      <Card size="small" title="颜色组数" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="horizontalBarColorCount" noStyle>
                          <Select options={[{ value: 1, label: "单色" }, { value: 3, label: "三色循环" }, { value: 5, label: "五色循环" }]} />
                        </Form.Item>
                      </Card>
                      <Card size="small" title="条形圆角" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="horizontalBarBorderRadius" noStyle><Input type="number" min={0} max={32} /></Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "sankey",
                  label: "桑基图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="sankeyPalette1" label="节点色一" />
                      <ThemeColorField form={form} name="sankeyPalette2" label="节点色二" />
                      <ThemeColorField form={form} name="sankeyPalette3" label="节点色三" />
                      <ThemeColorField form={form} name="sankeyPalette4" label="节点色四" />
                      <ThemeColorField form={form} name="sankeyPalette5" label="节点色五" />
                      <ThemeColorField form={form} name="sankeyLabelColor" label="标签颜色" />
                      <ThemeColorField form={form} name="sankeyNodeBorderColor" label="节点描边色" />
                      <Card size="small" title="节点描边宽度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="sankeyNodeBorderWidth" noStyle><Input type="number" min={0} max={8} step={0.5} /></Form.Item>
                      </Card>
                      <Card size="small" title="节点圆角" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="sankeyNodeBorderRadius" noStyle><Input type="number" min={0} max={16} /></Form.Item>
                      </Card>
                      <Card size="small" title="连线透明度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="sankeyLinkOpacity" noStyle><Input type="number" min={0} max={1} step={0.05} /></Form.Item>
                      </Card>
                      <Card size="small" title="连线弯曲度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="sankeyLinkCurveness" noStyle><Input type="number" min={0} max={1} step={0.05} /></Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "gauge",
                  label: "仪表盘",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="gaugePalette1" label="色带一" />
                      <ThemeColorField form={form} name="gaugePalette2" label="色带二" />
                      <ThemeColorField form={form} name="gaugePalette3" label="色带三" />
                      <ThemeColorField form={form} name="gaugePalette4" label="色带四" />
                      <ThemeColorField form={form} name="gaugePalette5" label="色带五" />
                      <ThemeColorField form={form} name="gaugePointerColor" label="指针颜色" />
                      <ThemeColorField form={form} name="gaugeDetailColor" label="数值颜色" />
                      <ThemeColorField form={form} name="gaugeTitleColor" label="标题颜色" />
                      <ThemeColorField form={form} name="gaugeAxisLabelColor" label="刻度文字颜色" />
                      <ThemeColorField form={form} name="gaugeSplitLineColor" label="刻度线颜色" />
                      <Card size="small" title="起始角度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeStartAngle" noStyle><Input type="number" min={-360} max={360} /></Form.Item>
                      </Card>
                      <Card size="small" title="结束角度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeEndAngle" noStyle><Input type="number" min={-360} max={360} /></Form.Item>
                      </Card>
                      <Card size="small" title="仪表半径" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeRadius" noStyle><Input placeholder="90% / 120" /></Form.Item>
                      </Card>
                      <Card size="small" title="指针长度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugePointerLength" noStyle><Input placeholder="58% / 72" /></Form.Item>
                      </Card>
                      <Card size="small" title="进度环宽度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeProgressWidth" noStyle><Input type="number" min={4} max={40} /></Form.Item>
                      </Card>
                      <Card size="small" title="底环宽度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeAxisLineWidth" noStyle><Input type="number" min={4} max={40} /></Form.Item>
                      </Card>
                      <Card size="small" title="数值字号" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeDetailFontSize" noStyle><Input type="number" min={12} max={48} /></Form.Item>
                      </Card>
                      <Card size="small" title="数值字重" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeDetailFontWeight" noStyle><Input type="number" min={300} max={900} step={100} /></Form.Item>
                      </Card>
                      <Card size="small" title="标题字号" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="gaugeTitleFontSize" noStyle><Input type="number" min={10} max={32} /></Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "funnel",
                  label: "漏斗图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="funnelPalette1" label="阶段色一" />
                      <ThemeColorField form={form} name="funnelPalette2" label="阶段色二" />
                      <ThemeColorField form={form} name="funnelPalette3" label="阶段色三" />
                      <ThemeColorField form={form} name="funnelPalette4" label="阶段色四" />
                      <ThemeColorField form={form} name="funnelPalette5" label="阶段色五" />
                      <ThemeColorField form={form} name="funnelLabelColor" label="名称颜色" />
                      <ThemeColorField form={form} name="funnelValueColor" label="数值颜色" />
                      <ThemeColorField form={form} name="funnelGuideLineColor" label="引导线颜色" />
                      <ThemeColorField form={form} name="funnelBlockBorderColor" label="描边颜色" />
                      <Card size="small" title="描边宽度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="funnelBlockBorderWidth" noStyle><Input type="number" min={0} max={8} step={0.5} /></Form.Item>
                      </Card>
                      <Card size="small" title="区块间距" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="funnelItemGap" noStyle><Input type="number" min={0} max={24} /></Form.Item>
                      </Card>
                      <Card size="small" title="排序方式" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="funnelSortOrder" noStyle>
                          <Select options={[{ value: "descending", label: "从大到小" }, { value: "ascending", label: "从小到大" }, { value: "none", label: "保持原序" }]} />
                        </Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "wordCloud",
                  label: "词云图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="wordCloudPalette1" label="词色一" />
                      <ThemeColorField form={form} name="wordCloudPalette2" label="词色二" />
                      <ThemeColorField form={form} name="wordCloudPalette3" label="词色三" />
                      <ThemeColorField form={form} name="wordCloudPalette4" label="词色四" />
                      <ThemeColorField form={form} name="wordCloudPalette5" label="词色五" />
                      <ThemeColorField form={form} name="wordCloudTextShadowColor" label="文字阴影色" />
                      <Card size="small" title="词云外形" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="wordCloudShape" noStyle>
                          <Select options={WORD_CLOUD_SHAPE_OPTIONS} />
                        </Form.Item>
                      </Card>
                      <Card size="small" title="排布密度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="wordCloudGridSize" noStyle><Input type="number" min={4} max={32} /></Form.Item>
                      </Card>
                      <Card size="small" title="旋转步长" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="wordCloudRotationStep" noStyle><Input type="number" min={0} max={180} step={15} /></Form.Item>
                      </Card>
                      <Card size="small" title="最小字号" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="wordCloudMinFontSize" noStyle><Input type="number" min={8} max={80} /></Form.Item>
                      </Card>
                      <Card size="small" title="最大字号" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="wordCloudMaxFontSize" noStyle><Input type="number" min={8} max={120} /></Form.Item>
                      </Card>
                      <Card size="small" title="文字字重" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="wordCloudFontWeight" noStyle><Input type="number" min={300} max={900} step={100} /></Form.Item>
                      </Card>
                      <Card size="small" title="阴影模糊" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="wordCloudTextShadowBlur" noStyle><Input type="number" min={0} max={40} /></Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "line",
                  label: "折线图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="linePalette1" label="线色一" />
                      <ThemeColorField form={form} name="linePalette2" label="线色二" />
                      <ThemeColorField form={form} name="linePalette3" label="线色三" />
                      <ThemeColorField form={form} name="linePalette4" label="线色四" />
                      <ThemeColorField form={form} name="lineAxisColor" label="坐标轴颜色" />
                      <ThemeColorField form={form} name="lineAxisLabelColor" label="坐标文字颜色" />
                      <ThemeColorField form={form} name="lineSplitLineColor" label="网格线颜色" />
                      <Card size="small" title="线条粗细" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="lineWidth" noStyle><Input type="number" min={1} max={12} /></Form.Item>
                      </Card>
                      <Card size="small" title="平滑曲线" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="lineSmooth" noStyle valuePropName="checked"><Switch /></Form.Item>
                      </Card>
                      <Card size="small" title="显示节点" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="lineShowSymbol" noStyle valuePropName="checked"><Switch /></Form.Item>
                      </Card>
                      <Card size="small" title="节点大小" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="lineSymbolSize" noStyle><Input type="number" min={0} max={24} /></Form.Item>
                      </Card>
                      <Card size="small" title="面积透明度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="lineAreaOpacity" noStyle><Input type="number" min={0} max={1} step={0.05} /></Form.Item>
                      </Card>
                      <Card size="small" title="标签位置" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="lineLabelPosition" noStyle>
                          <Select options={[{ value: "top", label: "顶部" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }, { value: "right", label: "右侧" }, { value: "inside", label: "内部" }]} />
                        </Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "combo",
                  label: "组合图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="comboPalette1" label="柱系列颜色" />
                      <ThemeColorField form={form} name="comboPalette2" label="线系列颜色" />
                      <ThemeColorField form={form} name="comboLabelColor" label="标签颜色" />
                      <ThemeColorField form={form} name="comboLegendColor" label="图例颜色" />
                      <ThemeColorField form={form} name="comboAxisColor" label="坐标轴颜色" />
                      <ThemeColorField form={form} name="comboAxisLabelColor" label="坐标文字颜色" />
                      <ThemeColorField form={form} name="comboSplitLineColor" label="分割线颜色" />
                      <ThemeColorField form={form} name="comboMaxPointColor" label="最大值颜色" />
                      <ThemeColorField form={form} name="comboMinPointColor" label="最小值颜色" />
                      <Card size="small" title="柱体圆角" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="comboBarBorderRadius" noStyle><Input type="number" min={0} max={32} /></Form.Item>
                      </Card>
                      <Card size="small" title="线条粗细" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="comboLineWidth" noStyle><Input type="number" min={1} max={12} /></Form.Item>
                      </Card>
                      <Card size="small" title="平滑曲线" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="comboLineSmooth" noStyle valuePropName="checked"><Switch /></Form.Item>
                      </Card>
                      <Card size="small" title="显示节点" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="comboLineShowSymbol" noStyle valuePropName="checked"><Switch /></Form.Item>
                      </Card>
                      <Card size="small" title="节点大小" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="comboLineSymbolSize" noStyle><Input type="number" min={0} max={24} /></Form.Item>
                      </Card>
                      <Card size="small" title="面积透明度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="comboLineAreaOpacity" noStyle><Input type="number" min={0} max={1} step={0.05} /></Form.Item>
                      </Card>
                      <Card size="small" title="标签位置" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="comboLineLabelPosition" noStyle>
                          <Select options={[{ value: "top", label: "顶部" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }, { value: "right", label: "右侧" }, { value: "inside", label: "内部" }]} />
                        </Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "scatter",
                  label: "散点气泡图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="scatterPalette1" label="气泡色一" />
                      <ThemeColorField form={form} name="scatterPalette2" label="气泡色二" />
                      <ThemeColorField form={form} name="scatterPalette3" label="气泡色三" />
                      <ThemeColorField form={form} name="scatterPalette4" label="气泡色四" />
                      <ThemeColorField form={form} name="scatterPalette5" label="气泡色五" />
                      <ThemeColorField form={form} name="scatterLabelColor" label="标签颜色" />
                      <ThemeColorField form={form} name="scatterLegendColor" label="图例颜色" />
                      <ThemeColorField form={form} name="scatterAxisColor" label="坐标轴颜色" />
                      <ThemeColorField form={form} name="scatterAxisLabelColor" label="坐标文字颜色" />
                      <ThemeColorField form={form} name="scatterSplitLineColor" label="分割线颜色" />
                      <ThemeColorField form={form} name="scatterPointBorderColor" label="描边颜色" />
                      <Card size="small" title="气泡大小" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="scatterSymbolSize" noStyle><Input type="number" min={4} max={48} /></Form.Item>
                      </Card>
                      <Card size="small" title="描边宽度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="scatterPointBorderWidth" noStyle><Input type="number" min={0} max={8} step={0.5} /></Form.Item>
                      </Card>
                      <Card size="small" title="透明度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="scatterPointOpacity" noStyle><Input type="number" min={0} max={1} step={0.05} /></Form.Item>
                      </Card>
                      <Card size="small" title="标签位置" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="scatterLabelPosition" noStyle>
                          <Select options={[{ value: "top", label: "顶部" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }, { value: "right", label: "右侧" }, { value: "inside", label: "内部" }]} />
                        </Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "radar",
                  label: "雷达图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="radarPalette1" label="主色一" />
                      <ThemeColorField form={form} name="radarPalette2" label="主色二" />
                      <ThemeColorField form={form} name="radarPalette3" label="主色三" />
                      <ThemeColorField form={form} name="radarPalette4" label="主色四" />
                      <ThemeColorField form={form} name="radarGridLineColor" label="网格线颜色" />
                      <ThemeColorField form={form} name="radarIndicatorTextColor" label="指标文字颜色" />
                      <ThemeColorField form={form} name="radarPointColor" label="节点颜色" />
                      <Card size="small" title="填充透明度" styles={{ body: { padding: 12 } }}>
                        <Form.Item name="radarAreaOpacity" noStyle><Input type="number" min={0} max={1} step={0.05} /></Form.Item>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "map",
                  label: "中国地图",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="mapPalette1" label="低值颜色" />
                      <ThemeColorField form={form} name="mapPalette2" label="次低颜色" />
                      <ThemeColorField form={form} name="mapPalette3" label="中值颜色" />
                      <ThemeColorField form={form} name="mapPalette4" label="次高颜色" />
                      <ThemeColorField form={form} name="mapPalette5" label="高值颜色" />
                      <ThemeColorField form={form} name="mapRegionBorderColor" label="区域边界颜色" />
                      <ThemeColorField form={form} name="mapLabelColor" label="区域文字颜色" />
                      <ThemeColorField form={form} name="mapVisualMapTextColor" label="视觉映射文字" />
                    </div>
                  ),
                },
                {
                  key: "tabs",
                  label: "标签页",
                  children: (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <ThemeColorField form={form} name="tabsTabBarBackground" label="标签栏背景" />
                      <ThemeColorField form={form} name="tabsActiveTextColor" label="激活文字" />
                      <ThemeColorField form={form} name="tabsInactiveTextColor" label="未激活文字" />
                      <ThemeColorField form={form} name="tabsActiveBackground" label="激活背景" />
                      <ThemeColorField form={form} name="tabsIndicatorColor" label="指示器颜色" />
                    </div>
                  ),
                },
                ]}
            />
          </Card>
        </Form>
      </Spin>
    </Space>
  );
}

