import { theme, type ThemeConfig } from "antd";
import { medataFoundations } from "./foundations";

const { colors, controls, radii, shadows, typography } = medataFoundations;

export const medataAntdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  cssVar: { key: "medata" },
  token: {
    colorPrimary: colors.primary,
    colorInfo: colors.info,
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    colorError: colors.error,
    colorBgLayout: colors.canvas,
    colorBgContainer: colors.surface,
    colorBgElevated: colors.surface,
    colorBorder: colors.borderStrong,
    colorBorderSecondary: colors.border,
    colorText: colors.text,
    colorTextSecondary: colors.textSecondary,
    colorTextTertiary: colors.textTertiary,
    colorTextDisabled: colors.disabled,
    borderRadius: radii.md,
    controlHeight: controls.defaultHeight,
    fontSize: typography.fontSizeBase,
    fontFamily: typography.fontFamily,
    boxShadowTertiary: shadows.float,
  },
  components: {
    Layout: {
      headerHeight: medataFoundations.layout.headerHeight,
      headerBg: colors.surface,
      siderBg: colors.surface,
      bodyBg: colors.canvas,
    },
    Menu: {
      itemSelectedBg: colors.primarySoft,
      itemSelectedColor: colors.primary,
      itemHoverBg: colors.surfaceHover,
      itemBorderRadius: radii.sm,
      itemMarginInline: 0,
    },
    Card: {
      borderRadiusLG: radii.md,
    },
    Button: {
      borderRadius: radii.sm,
      controlHeight: controls.defaultHeight,
    },
    Table: {
      headerBg: colors.surfaceSubtle,
      headerColor: colors.textSecondary,
      cellPaddingBlock: medataFoundations.spacing[3],
      cellPaddingInline: medataFoundations.spacing[4],
    },
    Tabs: {
      itemSelectedColor: colors.primary,
      itemColor: colors.textSecondary,
      inkBarColor: colors.primary,
    },
    Tag: {
      borderRadiusSM: radii.xs,
    },
  },
};
