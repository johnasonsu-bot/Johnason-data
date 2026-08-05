const KPI_THEME_TEMPLATES = [
  { key: "clean-card", label: "留白经典", category: "light", chrome: { backgroundColor: "#ffffff", borderColor: "#d9e2ef", borderWidth: 1, borderRadius: 16, shadowPreset: "none", paddingPreset: "comfortable", titleColor: "#1f2d3d" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#e5eaf1", itemBorderWidth: 0, itemBorderRadius: 12, dividerColor: "#e5eaf1", dividerStyle: "solid", valueColor: "#1f2d3d", metricLabelColor: "#66758a", compareLabelColor: "#5b6b82" } },
  { key: "soft-panel", label: "柔光卡片", category: "light", chrome: { backgroundColor: "#f8fbff", borderColor: "#d7e2f0", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#2a3f57" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#dfe7f3", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#dfe7f3", dividerStyle: "solid", valueColor: "#2a3f57", metricLabelColor: "#70839a", compareLabelColor: "#5a718b" } },
  { key: "highlight-frame", label: "明蓝商务", category: "blue", chrome: { backgroundColor: "#ffffff", borderColor: "#7faef5", borderWidth: 2, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#1d3e6f" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#cfe0fb", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#cfe0fb", dividerStyle: "solid", valueColor: "#255fa8", metricLabelColor: "#5f7ea8", compareLabelColor: "#3b82f6" } },
  { key: "mist-card", label: "柔光卡片", category: "light", chrome: { backgroundColor: "#f4f7fb", borderColor: "#d7e2f2", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable" }, kpiStyle: { itemBackgroundColor: "#f8fafc", itemBorderColor: "#cbd5e1", itemBorderWidth: 0, itemBorderRadius: 12, dividerColor: "#cbd5e1", dividerStyle: "solid", valueColor: "#2563eb", metricLabelColor: null, compareLabelColor: null } },
  { key: "midnight-panel", label: "深海面板", category: "dark", chrome: { backgroundColor: "#0b1220", borderColor: "#243247", borderWidth: 1, borderRadius: 20, shadowPreset: "medium", paddingPreset: "comfortable", titleColor: "#e5eefc" }, kpiStyle: { itemBackgroundColor: "#111c2f", itemBorderColor: "#26354b", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "#26354b", dividerStyle: "solid", valueColor: "#f8fbff", metricLabelColor: "#94a8c6", compareLabelColor: "#5eead4" } },
  { key: "obsidian-glow", label: "石墨光泽", category: "dark", chrome: { backgroundColor: "#0a0f1a", borderColor: "#2c3b52", borderWidth: 1, borderRadius: 22, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#eef4ff" }, kpiStyle: { itemBackgroundColor: "#121c2d", itemBorderColor: "#32445f", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "#32445f", dividerStyle: "solid", valueColor: "#f5f9ff", metricLabelColor: "#98a9c2", compareLabelColor: "#7dd3fc" } },
  { key: "aurora-night", label: "冷辉夜色", category: "dark", chrome: { backgroundColor: "#07131b", borderColor: "#1d3d48", borderWidth: 1, borderRadius: 20, shadowPreset: "medium", paddingPreset: "comfortable", titleColor: "#e7fbff" }, kpiStyle: { itemBackgroundColor: "#0d1f28", itemBorderColor: "#1f4f5a", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "rgba(84,214,214,0.18)", dividerStyle: "solid", valueColor: "#7df9ff", metricLabelColor: "#9cc9d0", compareLabelColor: "#67e8f9" } },
  { key: "warm-paper", label: "暖米经营", category: "warm", chrome: { backgroundColor: "#fff7ed", borderColor: "#e7cba3", borderWidth: 1, borderRadius: 16, shadowPreset: "none", paddingPreset: "comfortable", titleColor: "#654321" }, kpiStyle: { itemBackgroundColor: "#fff0d9", itemBorderColor: "#e7cba3", itemBorderWidth: 0, itemBorderRadius: 14, dividerColor: "#e5c69a", dividerStyle: "solid", valueColor: "#9a4f12", metricLabelColor: "#765334", compareLabelColor: "#b8651b" } },
  { key: "emerald-card", label: "青绿经营", category: "green", chrome: { backgroundColor: "#f3fbf8", borderColor: "#7fd1b9", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#155e4a" }, kpiStyle: { itemBackgroundColor: "#effcf6", itemBorderColor: "#6ee7b7", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#6ee7b7", dividerStyle: "solid", valueColor: "#059669", metricLabelColor: "#4f7c69", compareLabelColor: "#047857" } },
  { key: "forest-report", label: "松石分析", category: "green", chrome: { backgroundColor: "#eff8f2", borderColor: "#72b68b", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#2c5a3f" }, kpiStyle: { itemBackgroundColor: "#f8fcf9", itemBorderColor: "#b7d9c1", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#c9e4d2", dividerStyle: "solid", valueColor: "#166534", metricLabelColor: "#486b57", compareLabelColor: "#15803d" } },
  { key: "coral-panel", label: "暖米经营", category: "warm", chrome: { backgroundColor: "#fff8f5", borderColor: "#e7c7b8", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#7b5b49" }, kpiStyle: { itemBackgroundColor: "#fffdfb", itemBorderColor: "#edd6cc", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#edd6cc", dividerStyle: "solid", valueColor: "#9a5b37", metricLabelColor: "#8f6a52", compareLabelColor: "#a06741" } },
  { key: "slate-card", label: "石板分栏", category: "light", chrome: { backgroundColor: "#f7f9fc", borderColor: "#94a3b8", borderWidth: 2, borderRadius: 14, shadowPreset: "none", paddingPreset: "compact", titleColor: "#334155" }, kpiStyle: { itemBackgroundColor: "#f8fafc", itemBorderColor: "#cbd5e1", itemBorderWidth: 0, itemBorderRadius: 0, dividerColor: "#94a3b8", dividerStyle: "dashed", valueColor: "#334155", metricLabelColor: "#64748b", compareLabelColor: "#475569" } },
  { key: "neon-frame", label: "冷青中枢", category: "blue", chrome: { backgroundColor: "#081521", borderColor: "#35d0ff", borderWidth: 2, borderRadius: 18, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#dcf7ff" }, kpiStyle: { itemBackgroundColor: "#102433", itemBorderColor: "#2a6178", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "rgba(83,221,255,0.22)", dividerStyle: "solid", valueColor: "#5fe2ff", metricLabelColor: "#9fd9e8", compareLabelColor: "#53ddff" } },
  { key: "glass-minimal", label: "云幕分析", category: "blue", chrome: { backgroundColor: "#f7fbff", borderColor: "#d6e7fb", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "spacious", titleColor: "#24476b" }, kpiStyle: { itemBackgroundColor: "rgba(255,255,255,0.78)", itemBorderColor: "#e4eefb", itemBorderWidth: 1, itemBorderRadius: 20, dividerColor: "#e4eefb", dividerStyle: "solid", valueColor: "#2f7cf6", metricLabelColor: "#6b8cad", compareLabelColor: "#4b93ff" } },
  { key: "violet-glow", label: "冷紫分析", category: "purple", chrome: { backgroundColor: "#f7f4ff", borderColor: "#b7a2ff", borderWidth: 2, borderRadius: 18, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#4c1d95" }, kpiStyle: { itemBackgroundColor: "#f1ebff", itemBorderColor: "#c4b5fd", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#d8ccff", dividerStyle: "solid", valueColor: "#6d28d9", metricLabelColor: "#6b5a91", compareLabelColor: "#8b5cf6" } },
  { key: "plum-night", label: "深紫夜色", category: "purple", chrome: { backgroundColor: "#171222", borderColor: "#4c3c68", borderWidth: 1, borderRadius: 20, shadowPreset: "medium", paddingPreset: "comfortable", titleColor: "#f3ebff" }, kpiStyle: { itemBackgroundColor: "#20192d", itemBorderColor: "#574071", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "#574071", dividerStyle: "solid", valueColor: "#f5edff", metricLabelColor: "#c7badb", compareLabelColor: "#c084fc" } },
  { key: "number-banner", label: "留白经典", category: "light", chrome: { backgroundColor: "#ffffff", borderColor: "#dbe5f3", borderWidth: 1, borderRadius: 16, shadowPreset: "none", paddingPreset: "comfortable" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#dbe5f3", itemBorderWidth: 0, itemBorderRadius: 16, dividerColor: "#dbe5f3", dividerStyle: "solid", valueColor: "#1d4ed8", metricLabelColor: null, compareLabelColor: null } },
  { key: "progress-focus", label: "留白进度", category: "blue", chrome: { backgroundColor: "#ffffff", borderColor: "#dbe5f3", borderWidth: 1, borderRadius: 16, shadowPreset: "soft", paddingPreset: "comfortable" }, kpiStyle: { itemBackgroundColor: "#f8fafc", itemBorderColor: "#dbe5f3", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#dbe5f3", dividerStyle: "solid", valueColor: "#2563eb", metricLabelColor: null, compareLabelColor: "#2563eb" } },
  { key: "executive-ink", label: "墨金层次", category: "dark", chrome: { backgroundColor: "#14110f", borderColor: "#5a4630", borderWidth: 1, borderRadius: 22, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#f3dfb2" }, kpiStyle: { itemBackgroundColor: "#1b1714", itemBorderColor: "#6a5438", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "rgba(214,180,86,0.24)", dividerStyle: "solid", valueColor: "#e3b86b", metricLabelColor: "#c8b48a", compareLabelColor: "#f1d18a" } },
  { key: "boardroom-silver", label: "银灰专业", category: "light", chrome: { backgroundColor: "#f7f8fa", borderColor: "#cfd5dd", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#344054" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#dde3ea", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#d7dde5", dividerStyle: "solid", valueColor: "#111827", metricLabelColor: "#667085", compareLabelColor: "#475467" } },
  { key: "capital-blueprint", label: "深蓝驾驶舱", category: "blue", chrome: { backgroundColor: "#edf4ff", borderColor: "#9fbbe4", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#173b68" }, kpiStyle: { itemBackgroundColor: "#e7f1ff", itemBorderColor: "#b9cfef", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#abc4e8", dividerStyle: "solid", valueColor: "#1d4f91", metricLabelColor: "#587497", compareLabelColor: "#2f68b2" } },
  { key: "private-banking", label: "米棕汇报", category: "warm", chrome: { backgroundColor: "#fbf8f2", borderColor: "#d7c8ae", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#5b4630" }, kpiStyle: { itemBackgroundColor: "#fffdf9", itemBorderColor: "#e8decd", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#e6dccb", dividerStyle: "solid", valueColor: "#7b5a34", metricLabelColor: "#8c745a", compareLabelColor: "#a06b2c" } },
];

function buildFlipperBackground(primary, itemBackground, category) {
  if (category === "dark" || CATEGORY_META[category] === "深色系") {
    return `linear-gradient(180deg, ${primary} 0%, ${itemBackground || "#15110d"} 100%)`;
  }
  if (category === "warm" || CATEGORY_META[category] === "暖米系") {
    return `linear-gradient(180deg, ${primary} 0%, #5f432d 100%)`;
  }
  if (category === "green" || CATEGORY_META[category] === "青绿系") {
    return `linear-gradient(180deg, ${primary} 0%, #14532d 100%)`;
  }
  if (category === "purple" || CATEGORY_META[category] === "冷紫系") {
    return `linear-gradient(180deg, ${primary} 0%, #312e81 100%)`;
  }
  return `linear-gradient(180deg, ${primary} 0%, ${itemBackground || "#1e293b"} 100%)`;
}

const CATEGORY_META = {
  light: "中性色",
  dark: "深色系",
  blue: "蓝青系",
  green: "青绿系",
  warm: "暖米系",
  purple: "冷紫系",
};

function toThemeTemplate(template, index) {
  const primary = template.kpiStyle.valueColor
    || (template.category === "dark" ? "#34d3ff" : template.category === "green" ? "#059669" : template.category === "warm" ? "#b45309" : template.category === "purple" ? "#7c3aed" : "#1677ff");
  const titleColor = template.chrome.titleColor || (template.category === "dark" ? "#eef4ff" : "#101828");
  const borderColor = template.chrome.borderColor || "#dce6f5";
  const backgroundColor = template.chrome.backgroundColor || "#ffffff";
  const darkCanvas = template.category === "dark";
  const isExecutiveInk = template.key === "executive-ink";
  const isCapitalBlueprint = template.key === "capital-blueprint";
  const isHighlightFrame = template.key === "highlight-frame";
  const isGlassMinimal = template.key === "glass-minimal";
  const isNeonFrame = template.key === "neon-frame";
  const isWarmPaper = template.key === "warm-paper";
  const isVioletGlow = template.key === "violet-glow";
  const executiveInkCommonPalette = ["#d6b36a", "#b88a44", "#f1d089", "#8e6a37", "#f5e6bb"];
  const executiveInkBarPalette = ["#c9a35f", "#e4c27d"];
  const executiveInkHorizontalPalette = ["#d6b36a", "#b88a44", "#f1d089", "#9b7440", "#f3dfb2"];
  const executiveInkLinePalette = ["#d6b36a", "#f1d089", "#b88a44", "#f3dfb2"];
  const executiveInkMapPalette = ["#2a211a", "#4e3b27", "#7b5d37", "#b88a44", "#f1d089"];
  const capitalBlueprintCommonPalette = ["#173b68", "#255fa8", "#3f7ae0", "#63b4ef", "#9fd9f6"];
  const capitalBlueprintBarPalette = ["#1d4f91", "#4fa7ff"];
  const capitalBlueprintHorizontalPalette = ["#1d4f91", "#2f68b2", "#4f8cff", "#5fc8df", "#8fb7ff"];
  const capitalBlueprintLinePalette = ["#214f8f", "#4f8cff", "#66c5f0", "#8fb7ff"];
  const capitalBlueprintMapPalette = ["#edf4ff", "#d3e4ff", "#a9c8ff", "#5f98f2", "#1d4f91"];
  const warmPaperCommonPalette = ["#9a4f12", "#c77522", "#e3a24a", "#8d6b35", "#c8583a"];
  const warmPaperBarPalette = ["#c77522", "#f0b35a"];
  const warmPaperHorizontalPalette = ["#8a5a2b", "#a96b2a", "#c77522", "#e3a24a", "#c8583a"];
  const warmPaperLinePalette = ["#9a4f12", "#d88428", "#8d6b35", "#c8583a"];
  const warmPaperMapPalette = ["#fff7ed", "#f6dfbc", "#edbd7b", "#d88428", "#8a4f1f"];
  const violetGlowCommonPalette = ["#6d28d9", "#8b5cf6", "#22d3ee", "#f472b6", "#a78bfa"];
  const violetGlowBarPalette = ["#7c3aed", "#22d3ee"];
  const violetGlowHorizontalPalette = ["#6d28d9", "#8b5cf6", "#a78bfa", "#22d3ee", "#f472b6"];
  const violetGlowLinePalette = ["#7c3aed", "#22d3ee", "#f472b6", "#a78bfa"];
  const violetGlowMapPalette = ["#f7f4ff", "#e9ddff", "#c4b5fd", "#8b5cf6", "#581c87"];
  const highlightFrameCommonPalette = ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff", "#e8f1ff"];
  const highlightFrameHorizontalPalette = ["#255fa8", "#4b93ff", "#73a7ff", "#9fc4ff", "#c6ddff"];
  const glassMinimalCommonPalette = ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"];
  const neonFrameCommonPalette = ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff", "#c6ecff"];
  const neonFrameMapPalette = ["#0b2230", "#11415a", "#156b8b", "#2fb4ff", "#53ddff"];
  return {
    themeName: template.label,
    themeCode: template.key,
    category: CATEGORY_META[template.category] || template.category,
    description: `${CATEGORY_META[template.category] || template.category}内置主题模板`,
    isBuiltin: true,
    status: "active",
    previewImage: null,
    createdBy: "system",
    canvas: {
      backgroundType: darkCanvas ? "gradient" : "solid",
      backgroundColor: darkCanvas ? backgroundColor : backgroundColor,
      backgroundGradient: darkCanvas ? `linear-gradient(180deg, ${backgroundColor} 0%, ${backgroundColor} 100%)` : null,
      backgroundImage: null,
      overlayColor: darkCanvas ? "#07131b" : "#ffffff",
      overlayOpacity: darkCanvas ? 0.08 : 0,
      dashboardTitleColor: titleColor,
    },
    chrome: {
      backgroundColor,
      borderColor,
      borderWidth: template.chrome.borderWidth || 1,
      borderRadius: template.chrome.borderRadius || 16,
      shadowPreset: template.chrome.shadowPreset || "none",
      titleColor,
      subtitleColor: darkCanvas ? "#9cc9d0" : "#667085",
      paddingPreset: template.chrome.paddingPreset || "comfortable",
    },
    semantic: {
      primary,
      secondary: isExecutiveInk ? "#b88a44" : (isCapitalBlueprint ? "#5b8ff9" : isWarmPaper ? "#c77522" : isVioletGlow ? "#8b5cf6" : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#66b5ff" : isNeonFrame ? "#2fb4ff" : primary),
      success: "#12b76a",
      warning: "#f59e0b",
      danger: "#ef4444",
      info: isExecutiveInk ? "#f1d089" : (isCapitalBlueprint ? "#78c6f2" : isWarmPaper ? "#e3a24a" : isVioletGlow ? "#22d3ee" : isHighlightFrame ? "#8ab8ff" : isGlassMinimal ? "#8ed5ff" : isNeonFrame ? "#53ddff" : primary),
      textPrimary: isExecutiveInk ? "#f5e6bb" : (isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : (darkCanvas ? "#f8fbff" : "#101828")),
      textSecondary: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#5d7798" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#c7d2e3" : "#667085")),
      textTertiary: isExecutiveInk ? "#9f8359" : (isCapitalBlueprint ? "#8aa5c6" : isWarmPaper ? "#9d7a52" : isVioletGlow ? "#9b8ac4" : isHighlightFrame ? "#8faed1" : isGlassMinimal ? "#9ab6d3" : isNeonFrame ? "#6aa9bf" : (darkCanvas ? "#94a3b8" : "#98a2b3")),
      lineSubtle: isExecutiveInk ? "rgba(214,180,86,0.18)" : (isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f2ddbf" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor),
      lineStrong: isExecutiveInk ? "#6a5438" : (isCapitalBlueprint ? "#a8c0e6" : isWarmPaper ? "#e0bd89" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#7faef5" : isGlassMinimal ? "#d6e7fb" : isNeonFrame ? "#2a6178" : borderColor),
    },
    chartCommon: {
      palette: isExecutiveInk
        ? executiveInkCommonPalette
        : isCapitalBlueprint
          ? capitalBlueprintCommonPalette
          : isHighlightFrame
            ? highlightFrameCommonPalette
            : isGlassMinimal
              ? glassMinimalCommonPalette
              : isNeonFrame
                ? neonFrameCommonPalette
                : isWarmPaper
                  ? warmPaperCommonPalette
                  : isVioletGlow
                    ? violetGlowCommonPalette
                : [primary, "#4f8cff", "#76a8ff", "#9cc3ff", "#c6dcff"],
      labelColor: isExecutiveInk ? "#e8d8ae" : (isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : (darkCanvas ? "#d4e4f8" : "#344054")),
      labelFontSize: 14,
      legendColor: isExecutiveInk ? "#d9c39b" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : (darkCanvas ? "#d4e4f8" : "#344054")),
      legendInactiveColor: isExecutiveInk ? "#8f744d" : (isCapitalBlueprint ? "#8aa5c6" : isWarmPaper ? "#b99a75" : isVioletGlow ? "#a89bcb" : isHighlightFrame ? "#9eb9d8" : isGlassMinimal ? "#abc2dd" : isNeonFrame ? "#6aa9bf" : (darkCanvas ? "#7f95b2" : "#98a2b3")),
      guideLineColor: isExecutiveInk ? "#9b7440" : (isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor),
      tooltipBackground: isExecutiveInk ? "#241c16" : (isWarmPaper ? "#4a2f1f" : (isVioletGlow ? "#2e1065" : (darkCanvas ? "#0f1f35" : "#101828"))),
      tooltipTextColor: "#ffffff",
      emphasisShadowColor: isExecutiveInk ? "rgba(214,180,86,0.28)" : (isCapitalBlueprint ? "rgba(59,111,182,0.18)" : isWarmPaper ? "rgba(154,79,18,0.16)" : isVioletGlow ? "rgba(109,40,217,0.18)" : isHighlightFrame ? "rgba(75,147,255,0.16)" : isGlassMinimal ? "rgba(102,181,255,0.16)" : isNeonFrame ? "rgba(83,221,255,0.22)" : (darkCanvas ? "rgba(52,211,255,0.24)" : "rgba(15,23,42,0.14)")),
    },
    chartVariants: {
      pie: {
        palette: isExecutiveInk
          ? executiveInkCommonPalette
          : isCapitalBlueprint
            ? capitalBlueprintCommonPalette
            : isHighlightFrame
              ? highlightFrameCommonPalette
              : isGlassMinimal
                ? glassMinimalCommonPalette
                : isNeonFrame
                  ? neonFrameCommonPalette
                  : isWarmPaper
                    ? warmPaperCommonPalette
                    : isVioletGlow
                      ? violetGlowCommonPalette
                  : [primary, "#4f8cff", "#76a8ff", "#9cc3ff", "#c6dcff"],
        centerTitleColor: isExecutiveInk ? "#bfa67a" : (isCapitalBlueprint ? "#5d7798" : isWarmPaper ? "#9d7a52" : isVioletGlow ? "#8a79b8" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#cfe3ff" : "#667085")),
        centerValueColor: isExecutiveInk ? "#f5e6bb" : (isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : (darkCanvas ? "#f8fbff" : "#101828")),
        centerUnitColor: isExecutiveInk ? "#e7d2a5" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : (darkCanvas ? "#f8fbff" : "#101828")),
        centerMetaColor: isExecutiveInk ? "#9f8359" : (isCapitalBlueprint ? "#8aa5c6" : isWarmPaper ? "#b99a75" : isVioletGlow ? "#a89bcb" : isHighlightFrame ? "#9eb9d8" : isGlassMinimal ? "#abc2dd" : isNeonFrame ? "#6aa9bf" : (darkCanvas ? "#94a3b8" : "#98a2b3")),
        labelColor: isExecutiveInk ? "#ddcaa2" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : (darkCanvas ? "#d4e4f8" : "#344054")),
        valueColor: isExecutiveInk ? "#f5e6bb" : (isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : (darkCanvas ? "#ffffff" : "#101828")),
        guideLineColor: isExecutiveInk ? "#8f6b3b" : (isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor),
        sliceBorderColor: isExecutiveInk ? "#2a211a" : (isCapitalBlueprint ? "#f7fbff" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#f9fcff" : isNeonFrame ? "#0f2c3d" : (darkCanvas ? "#16304f" : "#ffffff")),
        shadowColor: isExecutiveInk ? "rgba(214,180,86,0.22)" : (isCapitalBlueprint ? "rgba(91,143,249,0.18)" : isWarmPaper ? "rgba(154,79,18,0.16)" : isVioletGlow ? "rgba(109,40,217,0.2)" : isHighlightFrame ? "rgba(75,147,255,0.16)" : isGlassMinimal ? "rgba(102,181,255,0.16)" : isNeonFrame ? "rgba(83,221,255,0.22)" : (darkCanvas ? "rgba(52,211,255,0.24)" : "rgba(15,23,42,0.14)")),
        defaultInnerRadius: 52,
        defaultOuterRadius: 82,
        defaultLabelMode: "outside",
      },
      bar: {
        palette: isExecutiveInk
          ? executiveInkBarPalette
          : isCapitalBlueprint
            ? capitalBlueprintBarPalette
            : isHighlightFrame
              ? ["#255fa8", "#4b93ff"]
              : isGlassMinimal
                ? ["#2f7cf6", "#66b5ff"]
                : isNeonFrame
                  ? ["#2fb4ff", "#53ddff"]
          : isWarmPaper
            ? warmPaperBarPalette
          : isVioletGlow
            ? violetGlowBarPalette
          : template.category === "dark"
          ? [primary, "#c89b5c"]
          : template.category === "warm"
            ? [primary, "#9f8a4d"]
            : template.category === "green"
              ? [primary, "#4fae9a"]
              : template.category === "purple"
                ? [primary, "#d07ce3"]
                : template.category === "blue"
                  ? [primary, "#43c7c6"]
                  : [primary, "#6f8fb8"],
        labelColor: isExecutiveInk ? "#f7ecd0" : (isCapitalBlueprint ? "#24476b" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#ffffff" : isNeonFrame ? "#eafcff" : (darkCanvas ? "#d4e4f8" : "#ffffff")),
        legendColor: isExecutiveInk ? "#dcc9a0" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : (darkCanvas ? "#e8d8ae" : "#344054")),
        axisColor: isExecutiveInk ? "#725838" : (isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : (darkCanvas ? "#6b5a3e" : borderColor)),
        axisLabelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#e8d8ae" : titleColor)),
        splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : (isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : (darkCanvas ? "rgba(214,180,86,0.16)" : borderColor)),
        barBorderRadius: 8,
      },
      horizontalBar: {
        palette: isExecutiveInk
          ? executiveInkHorizontalPalette
          : isCapitalBlueprint
            ? capitalBlueprintHorizontalPalette
            : isHighlightFrame
              ? highlightFrameHorizontalPalette
              : isGlassMinimal
                ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"]
                : isNeonFrame
                  ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"]
          : isWarmPaper
            ? warmPaperHorizontalPalette
          : isVioletGlow
            ? violetGlowHorizontalPalette
          : template.category === "dark"
          ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"]
          : template.category === "warm"
            ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"]
            : template.category === "green"
              ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"]
              : template.category === "purple"
                ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"]
                : template.category === "blue"
                  ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"]
                  : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
        labelColor: isExecutiveInk ? "#1b1714" : (isCapitalBlueprint ? "#24476b" : isWarmPaper ? "#fff8ee" : isVioletGlow ? "#ffffff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#ffffff" : isNeonFrame ? "#062231" : (darkCanvas ? "#d4e4f8" : "#ffffff")),
        legendColor: isExecutiveInk ? "#dcc9a0" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : (darkCanvas ? "#e8d8ae" : "#344054")),
        axisColor: isExecutiveInk ? "#725838" : (isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : (darkCanvas ? "#6b5a3e" : borderColor)),
        axisLabelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#e8d8ae" : titleColor)),
        splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : (isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : (darkCanvas ? "rgba(214,180,86,0.16)" : borderColor)),
        barBorderRadius: 10,
        colorCount: 5,
      },
      sankey: {
        palette: isExecutiveInk
          ? executiveInkHorizontalPalette
          : isCapitalBlueprint
            ? capitalBlueprintHorizontalPalette
            : isHighlightFrame
              ? highlightFrameHorizontalPalette
              : isGlassMinimal
                ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"]
                : isNeonFrame
                  ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"]
          : isWarmPaper
            ? warmPaperHorizontalPalette
          : isVioletGlow
            ? violetGlowHorizontalPalette
          : template.category === "dark"
          ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"]
          : template.category === "warm"
            ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"]
            : template.category === "green"
              ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"]
              : template.category === "purple"
                ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"]
                : template.category === "blue"
                  ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"]
                  : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
        labelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#e8d8ae" : titleColor)),
        nodeBorderColor: isExecutiveInk ? "#2a211a" : (isCapitalBlueprint ? "#f7fbff" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#f9fcff" : isNeonFrame ? "#0f2c3d" : (darkCanvas ? "#16304f" : "#ffffff")),
        nodeBorderWidth: 1,
        nodeBorderRadius: isExecutiveInk ? 3 : (isNeonFrame ? 5 : 4),
        linkOpacity: isExecutiveInk ? 0.34 : (isCapitalBlueprint ? 0.3 : isWarmPaper ? 0.32 : isVioletGlow ? 0.3 : isNeonFrame ? 0.34 : (darkCanvas ? 0.32 : 0.28)),
        linkCurveness: isWarmPaper ? 0.42 : (isExecutiveInk ? 0.46 : (isVioletGlow ? 0.52 : 0.5)),
      },
      gauge: {
        palette: isExecutiveInk
          ? executiveInkHorizontalPalette
          : isCapitalBlueprint
            ? capitalBlueprintHorizontalPalette
            : isHighlightFrame
              ? highlightFrameHorizontalPalette
              : isGlassMinimal
                ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"]
                : isNeonFrame
                  ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"]
          : isWarmPaper
            ? warmPaperHorizontalPalette
          : isVioletGlow
            ? violetGlowHorizontalPalette
          : template.category === "dark"
          ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"]
          : template.category === "warm"
            ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"]
            : template.category === "green"
              ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"]
              : template.category === "purple"
                ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"]
                : template.category === "blue"
                  ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"]
                  : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
        pointerColor: isExecutiveInk ? "#f1d089" : (isCapitalBlueprint ? "#3b6fb6" : isWarmPaper ? "#d88428" : isVioletGlow ? "#8b5cf6" : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#2f7cf6" : isNeonFrame ? "#53ddff" : primary),
        detailColor: isExecutiveInk ? "#f5e6bb" : (isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : (darkCanvas ? "#ffffff" : "#101828")),
        titleColor: isExecutiveInk ? "#bfa67a" : (isCapitalBlueprint ? "#5d7798" : isWarmPaper ? "#9d7a52" : isVioletGlow ? "#8a79b8" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#cfe3ff" : "#667085")),
        axisLabelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#e8d8ae" : titleColor)),
        splitLineColor: isExecutiveInk ? "#8f6b3b" : (isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor),
        startAngle: 210,
        endAngle: -30,
        radius: "90%",
        progressWidth: isExecutiveInk ? 16 : (isNeonFrame ? 20 : 18),
        axisLineWidth: isExecutiveInk ? 16 : (isNeonFrame ? 20 : 18),
        pointerLength: isWarmPaper ? "56%" : (isNeonFrame ? "60%" : "58%"),
        detailFontSize: isExecutiveInk ? 26 : 24,
        detailFontWeight: isExecutiveInk ? 800 : 700,
        titleFontSize: 14,
      },
      funnel: {
        palette: isExecutiveInk
          ? executiveInkHorizontalPalette
          : isCapitalBlueprint
            ? capitalBlueprintHorizontalPalette
            : isHighlightFrame
              ? highlightFrameHorizontalPalette
              : isGlassMinimal
                ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"]
                : isNeonFrame
                  ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"]
          : isWarmPaper
            ? warmPaperHorizontalPalette
          : isVioletGlow
            ? violetGlowHorizontalPalette
          : template.category === "dark"
          ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"]
          : template.category === "warm"
            ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"]
            : template.category === "green"
              ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"]
              : template.category === "purple"
                ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"]
                : template.category === "blue"
                  ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"]
                  : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
        labelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : (darkCanvas ? "#e8d8ae" : titleColor)),
        valueColor: isExecutiveInk ? "#f5e6bb" : (isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : (darkCanvas ? "#ffffff" : "#101828")),
        guideLineColor: isExecutiveInk ? "#8f6b3b" : (isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor),
        blockBorderColor: isExecutiveInk ? "#2a211a" : (isCapitalBlueprint ? "#f7fbff" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#f9fcff" : isNeonFrame ? "#0f2c3d" : (darkCanvas ? "#16304f" : "#ffffff")),
        blockBorderWidth: 1,
        itemGap: isExecutiveInk ? 3 : (isWarmPaper ? 4 : 2),
        sortOrder: "descending",
      },
      wordCloud: {
        palette: isExecutiveInk
          ? executiveInkHorizontalPalette
          : isCapitalBlueprint
            ? capitalBlueprintHorizontalPalette
            : isHighlightFrame
              ? highlightFrameHorizontalPalette
              : isGlassMinimal
                ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"]
                : isNeonFrame
                  ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"]
          : isWarmPaper
            ? warmPaperHorizontalPalette
          : isVioletGlow
            ? violetGlowHorizontalPalette
          : template.category === "dark"
          ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"]
          : template.category === "warm"
            ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"]
            : template.category === "green"
              ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"]
              : template.category === "purple"
                ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"]
                : template.category === "blue"
                  ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"]
                  : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
        shape: isWarmPaper ? "cardioid" : (isVioletGlow || isNeonFrame ? "diamond" : "circle"),
        gridSize: isExecutiveInk ? 9 : (isWarmPaper ? 12 : 10),
        rotationStep: isNeonFrame ? 90 : 45,
        minFontSize: 12,
        maxFontSize: isExecutiveInk ? 44 : 40,
        fontWeight: isExecutiveInk ? 800 : 700,
        textShadowColor: isExecutiveInk ? "rgba(214,180,86,0.26)" : (isCapitalBlueprint ? "rgba(59,111,182,0.18)" : isWarmPaper ? "rgba(154,79,18,0.18)" : isVioletGlow ? "rgba(109,40,217,0.2)" : isHighlightFrame ? "rgba(75,147,255,0.18)" : isGlassMinimal ? "rgba(102,181,255,0.18)" : isNeonFrame ? "rgba(83,221,255,0.28)" : (darkCanvas ? "rgba(52,211,255,0.26)" : "rgba(15,23,42,0.12)")),
        textShadowBlur: isNeonFrame ? 18 : (darkCanvas ? 14 : 10),
      },
      line: {
        palette: isExecutiveInk ? executiveInkLinePalette : (isCapitalBlueprint ? capitalBlueprintLinePalette : isWarmPaper ? warmPaperLinePalette : isVioletGlow ? violetGlowLinePalette : isHighlightFrame ? ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff"] : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff"] : isNeonFrame ? ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff"] : [primary, "#4f8cff", "#76a8ff", "#9cc3ff"]),
        lineWidth: isExecutiveInk ? 3 : 3,
        lineSmooth: true,
        showSymbol: true,
        symbolSize: isExecutiveInk ? 6 : 5,
        labelPosition: "top",
        pointBorderColor: isExecutiveInk ? "#14110f" : (isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isNeonFrame ? "#081521" : "#ffffff"),
        areaOpacity: isExecutiveInk ? 0.14 : (isCapitalBlueprint ? 0.16 : isWarmPaper ? 0.18 : isVioletGlow ? 0.16 : isGlassMinimal ? 0.14 : isNeonFrame ? 0.16 : 0.18),
        axisColor: isExecutiveInk ? "#725838" : (isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : borderColor),
        axisLabelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor),
        splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : (isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor),
      },
      area: {
        palette: isExecutiveInk ? executiveInkLinePalette : (isCapitalBlueprint ? capitalBlueprintLinePalette : isWarmPaper ? warmPaperLinePalette : isVioletGlow ? violetGlowLinePalette : isHighlightFrame ? ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff"] : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff"] : isNeonFrame ? ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff"] : [primary, "#4f8cff", "#76a8ff", "#9cc3ff"]),
        lineWidth: 3,
        lineSmooth: true,
        showSymbol: true,
        symbolSize: 6,
        labelPosition: "top",
        pointBorderColor: isExecutiveInk ? "#14110f" : (isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isNeonFrame ? "#081521" : "#ffffff"),
        areaOpacity: isExecutiveInk ? 0.24 : (isCapitalBlueprint ? 0.2 : isWarmPaper ? 0.22 : isVioletGlow ? 0.2 : isGlassMinimal ? 0.18 : isNeonFrame ? 0.22 : 0.24),
        axisColor: isExecutiveInk ? "#725838" : (isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : borderColor),
        axisLabelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor),
        splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : (isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor),
      },
      scatter: {
        palette: isExecutiveInk
          ? executiveInkHorizontalPalette
          : isCapitalBlueprint
            ? capitalBlueprintHorizontalPalette
            : isHighlightFrame
              ? highlightFrameHorizontalPalette
              : isGlassMinimal
                ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"]
                : isNeonFrame
                  ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"]
          : isWarmPaper
            ? warmPaperHorizontalPalette
          : isVioletGlow
            ? violetGlowHorizontalPalette
          : template.category === "dark"
          ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"]
          : template.category === "warm"
            ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"]
            : template.category === "green"
              ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"]
              : template.category === "purple"
                ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"]
                : template.category === "blue"
                  ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"]
                  : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
        labelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor),
        legendColor: isExecutiveInk ? "#dcc9a0" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : (darkCanvas ? "#e8d8ae" : "#344054")),
        axisColor: isExecutiveInk ? "#725838" : (isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : borderColor),
        axisLabelColor: isExecutiveInk ? "#c8b48a" : (isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor),
        splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : (isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor),
        symbolSize: isExecutiveInk ? 18 : (isNeonFrame ? 18 : 16),
        pointBorderColor: isExecutiveInk ? "#14110f" : (isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isNeonFrame ? "#081521" : "#ffffff"),
        pointBorderWidth: isExecutiveInk ? 2 : 1,
        pointOpacity: isExecutiveInk ? 0.86 : (isNeonFrame ? 0.88 : 0.82),
        labelPosition: "top",
      },
      radar: {
        palette: isExecutiveInk ? executiveInkLinePalette : (isCapitalBlueprint ? capitalBlueprintLinePalette : isWarmPaper ? warmPaperLinePalette : isVioletGlow ? violetGlowLinePalette : isHighlightFrame ? ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff"] : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff"] : isNeonFrame ? ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff"] : [primary, "#4f8cff", "#76a8ff", "#9cc3ff"]),
        gridLineColor: isExecutiveInk ? "rgba(214,180,86,0.18)" : (isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : "#dbe7f3"),
        indicatorTextColor: isExecutiveInk ? "#d9c39b" : (isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : "#344054"),
        areaOpacity: isExecutiveInk ? 0.18 : (isCapitalBlueprint ? 0.18 : isWarmPaper ? 0.2 : isVioletGlow ? 0.18 : isGlassMinimal ? 0.16 : isNeonFrame ? 0.18 : 0.22),
        pointColor: isExecutiveInk ? "#f1d089" : (isCapitalBlueprint ? "#3b6fb6" : isWarmPaper ? "#d88428" : isVioletGlow ? "#8b5cf6" : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#66b5ff" : isNeonFrame ? "#53ddff" : "#1677ff"),
        primaryColor: isExecutiveInk ? executiveInkLinePalette[0] : (isCapitalBlueprint ? capitalBlueprintLinePalette[0] : isWarmPaper ? warmPaperLinePalette[0] : isVioletGlow ? violetGlowLinePalette[0] : isHighlightFrame ? "#255fa8" : isGlassMinimal ? "#2f7cf6" : isNeonFrame ? "#53ddff" : primary),
        secondaryColor: isExecutiveInk ? executiveInkLinePalette[1] : (isCapitalBlueprint ? capitalBlueprintLinePalette[1] : isWarmPaper ? warmPaperLinePalette[1] : isVioletGlow ? violetGlowLinePalette[1] : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#66b5ff" : isNeonFrame ? "#2fb4ff" : "#4f8cff"),
      },
      map: {
        regionPalette: isExecutiveInk
          ? executiveInkMapPalette
          : isCapitalBlueprint
            ? capitalBlueprintMapPalette
            : isWarmPaper
              ? warmPaperMapPalette
              : isVioletGlow
                ? violetGlowMapPalette
                : isHighlightFrame
                  ? ["#eef5ff", "#d4e4ff", "#a8c7ff", "#4b93ff", "#255fa8"]
                  : isGlassMinimal
                    ? ["#f1f7ff", "#dff0ff", "#b7ddff", "#7fbfff", "#2f7cf6"]
                    : isNeonFrame
                      ? neonFrameMapPalette
                      : template.category === "dark"
                        ? ["#0f1f35", "#17304f", "#275d7a", primary, "#7dd3fc"]
                        : template.category === "warm"
                          ? ["#fbf8f2", "#ead8b9", "#d7b489", "#a06b2c", primary]
                          : template.category === "green"
                            ? ["#effcf6", "#d8f3e5", "#9edbb8", "#4fae9a", primary]
                            : template.category === "purple"
                              ? ["#f7f4ff", "#eadfff", "#c4b5fd", "#8b5cf6", primary]
                              : template.category === "blue"
                                ? ["#eef5ff", "#d5e6ff", "#9cc3ff", "#4f8cff", primary]
                                : ["#f7f8fa", "#e2e8f0", "#cbd5e1", "#94a3b8", primary],
        regionBorderColor: isExecutiveInk ? "#8f6b3b" : (isCapitalBlueprint ? "#8fb1d6" : isWarmPaper ? "#d8a86a" : isVioletGlow ? "#a78bfa" : isNeonFrame ? "#2fb4ff" : borderColor),
        labelColor: isExecutiveInk ? "#e7d2a5" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : template.category === "warm" ? "#765334" : template.category === "green" ? "#486b57" : template.category === "purple" ? (darkCanvas ? "#d8ccff" : "#6b5a91") : (darkCanvas ? "#d4e4f8" : "#344054")),
        visualMapTextColor: isExecutiveInk ? "#d9c39b" : (isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : template.category === "warm" ? "#8c745a" : template.category === "green" ? "#4f7c69" : template.category === "purple" ? (darkCanvas ? "#c7badb" : "#8a79b8") : (darkCanvas ? "#c7d2e3" : "#344054")),
      },
      kpi: {
        valueColor: template.kpiStyle.valueColor || primary,
        labelColor: template.kpiStyle.metricLabelColor || (darkCanvas ? "#9cc9d0" : "#667085"),
        compareColor: template.kpiStyle.compareLabelColor || primary,
        dividerColor: template.kpiStyle.dividerColor || borderColor,
        itemBackgroundColor: template.kpiStyle.itemBackgroundColor || backgroundColor,
        flipperBackground: template.kpiStyle.flipperBackground || buildFlipperBackground(template.kpiStyle.valueColor || primary, template.kpiStyle.itemBackgroundColor || backgroundColor, template.category),
        progressTrackColor: isWarmPaper ? "#f4dfc1" : (isVioletGlow ? "#e9ddff" : (darkCanvas ? "#17304f" : "#edf4ff")),
        progressFillColor: template.kpiStyle.valueColor || primary,
      },
      table: {
        headerBackground: isWarmPaper ? "#fff0d9" : (isVioletGlow ? "#f1ebff" : (darkCanvas ? "#10223d" : backgroundColor)),
        headerTextColor: titleColor,
        rowBackground: isWarmPaper ? "#fffaf3" : (isVioletGlow ? "#fbfaff" : backgroundColor),
        rowAlternateBackground: isWarmPaper ? "#fff4e6" : (isVioletGlow ? "#f6f1ff" : (darkCanvas ? "rgba(14,28,49,0.92)" : "#fafcff")),
        rowBorderColor: borderColor,
      },
      tabs: {
        tabBarBackground: isWarmPaper ? "#fff0d9" : (isVioletGlow ? "#f1ebff" : (darkCanvas ? "#10223d" : backgroundColor)),
        activeTextColor: primary,
        inactiveTextColor: isWarmPaper ? "#9d7a52" : (isVioletGlow ? "#8a79b8" : (darkCanvas ? "#8aa4c7" : "#667085")),
        activeBackground: isWarmPaper ? "#fff8ee" : (isVioletGlow ? "#ffffff" : (darkCanvas ? "rgba(52,211,255,0.12)" : "#ffffff")),
        indicatorColor: primary,
      },
    },
  };
}

const BUILTIN_THEME_TEMPLATES = KPI_THEME_TEMPLATES
  .filter((template) => !["mist-card", "number-banner", "progress-focus", "coral-panel"].includes(template.key))
  .map(toThemeTemplate);

module.exports = {
  BUILTIN_THEME_TEMPLATES,
};
