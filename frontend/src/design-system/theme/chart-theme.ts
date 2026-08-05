import { medataFoundations } from "./foundations";

export const medataChartPalette = [
  medataFoundations.colors.primary,
  "#14b8a6",
  "#7c3aed",
  "#f59e0b",
  "#ef5da8",
  medataFoundations.colors.success,
] as const;

export const medataEChartsTheme = {
  color: [...medataChartPalette],
  backgroundColor: "transparent",
  textStyle: {
    color: medataFoundations.colors.textSecondary,
    fontFamily: medataFoundations.typography.fontFamily,
    fontSize: medataFoundations.typography.fontSizeXs,
  },
  title: {
    textStyle: {
      color: medataFoundations.colors.text,
      fontFamily: medataFoundations.typography.fontFamily,
      fontSize: medataFoundations.typography.fontSizeLg,
      fontWeight: 600,
    },
    subtextStyle: {
      color: medataFoundations.colors.textSecondary,
      fontFamily: medataFoundations.typography.fontFamily,
      fontSize: medataFoundations.typography.fontSizeSm,
    },
  },
  legend: {
    textStyle: {
      color: medataFoundations.colors.textSecondary,
      fontFamily: medataFoundations.typography.fontFamily,
      fontSize: medataFoundations.typography.fontSizeXs,
    },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: medataFoundations.colors.border } },
    axisTick: { lineStyle: { color: medataFoundations.colors.border } },
    axisLabel: { color: medataFoundations.colors.textTertiary },
    splitLine: { lineStyle: { color: "#eef1f4" } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: medataFoundations.colors.border } },
    axisTick: { lineStyle: { color: medataFoundations.colors.border } },
    axisLabel: { color: medataFoundations.colors.textTertiary },
    splitLine: { lineStyle: { color: "#eef1f4" } },
  },
  tooltip: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderColor: medataFoundations.colors.border,
    borderWidth: 1,
    textStyle: { color: medataFoundations.colors.text },
    extraCssText: `box-shadow: ${medataFoundations.shadows.float}; border-radius: ${medataFoundations.radii.md}px;`,
  },
} as const;
