export type ThemeEditorField = {
  path: string[];
  label: string;
  type: "color" | "number" | "text" | "select";
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
};

export type ThemeCapability = {
  getOverrideSchema: () => ThemeEditorField[];
  getEditorSections: () => Array<{ key: string; label: string; fields: ThemeEditorField[] }>;
};

const pieFields: ThemeEditorField[] = [
  { path: ["chartVariants", "pie", "centerTitleColor"], label: "中心标题颜色", type: "color" },
  { path: ["chartVariants", "pie", "centerValueColor"], label: "中心数值颜色", type: "color" },
  { path: ["chartVariants", "pie", "centerUnitColor"], label: "中心单位颜色", type: "color" },
  { path: ["chartVariants", "pie", "centerMetaColor"], label: "中心副文案颜色", type: "color" },
  { path: ["chartVariants", "pie", "labelColor"], label: "标签颜色", type: "color" },
  { path: ["chartVariants", "pie", "valueColor"], label: "标签数值颜色", type: "color" },
  { path: ["chartVariants", "pie", "guideLineColor"], label: "引导线颜色", type: "color" },
  { path: ["chartVariants", "pie", "sliceBorderColor"], label: "描边颜色", type: "color" },
];

const barFields: ThemeEditorField[] = [
  { path: ["chartVariants", "bar", "labelColor"], label: "标签颜色", type: "color" },
  { path: ["chartVariants", "bar", "legendColor"], label: "图例颜色", type: "color" },
  { path: ["chartVariants", "bar", "axisColor"], label: "坐标轴颜色", type: "color" },
  { path: ["chartVariants", "bar", "axisLabelColor"], label: "坐标文字颜色", type: "color" },
  { path: ["chartVariants", "bar", "splitLineColor"], label: "分割线颜色", type: "color" },
  { path: ["chartVariants", "bar", "barBorderRadius"], label: "柱子圆角", type: "number", min: 0, max: 32 },
];

const horizontalBarFields: ThemeEditorField[] = [
  { path: ["chartVariants", "horizontalBar", "labelColor"], label: "标签颜色", type: "color" },
  { path: ["chartVariants", "horizontalBar", "legendColor"], label: "图例颜色", type: "color" },
  { path: ["chartVariants", "horizontalBar", "axisColor"], label: "坐标轴颜色", type: "color" },
  { path: ["chartVariants", "horizontalBar", "axisLabelColor"], label: "坐标文字颜色", type: "color" },
  { path: ["chartVariants", "horizontalBar", "splitLineColor"], label: "分割线颜色", type: "color" },
  { path: ["chartVariants", "horizontalBar", "barBorderRadius"], label: "条形圆角", type: "number", min: 0, max: 32 },
  { path: ["chartVariants", "horizontalBar", "colorCount"], label: "颜色组数", type: "select", options: [{ value: "1", label: "单色" }, { value: "3", label: "三色循环" }, { value: "5", label: "五色循环" }] },
];

const sankeyFields: ThemeEditorField[] = [
  { path: ["chartVariants", "sankey", "labelColor"], label: "标签颜色", type: "color" },
  { path: ["chartVariants", "sankey", "nodeBorderColor"], label: "节点描边颜色", type: "color" },
  { path: ["chartVariants", "sankey", "nodeBorderWidth"], label: "节点描边宽度", type: "number", min: 0, max: 8 },
  { path: ["chartVariants", "sankey", "nodeBorderRadius"], label: "节点圆角", type: "number", min: 0, max: 16 },
  { path: ["chartVariants", "sankey", "linkOpacity"], label: "连线透明度", type: "number", min: 0, max: 1 },
  { path: ["chartVariants", "sankey", "linkCurveness"], label: "连线弯曲度", type: "number", min: 0, max: 1 },
];

const gaugeFields: ThemeEditorField[] = [
  { path: ["chartVariants", "gauge", "palette", "0"], label: "色带一", type: "color" },
  { path: ["chartVariants", "gauge", "palette", "1"], label: "色带二", type: "color" },
  { path: ["chartVariants", "gauge", "palette", "2"], label: "色带三", type: "color" },
  { path: ["chartVariants", "gauge", "palette", "3"], label: "色带四", type: "color" },
  { path: ["chartVariants", "gauge", "palette", "4"], label: "色带五", type: "color" },
  { path: ["chartVariants", "gauge", "pointerColor"], label: "指针颜色", type: "color" },
  { path: ["chartVariants", "gauge", "detailColor"], label: "数值颜色", type: "color" },
  { path: ["chartVariants", "gauge", "titleColor"], label: "标题颜色", type: "color" },
  { path: ["chartVariants", "gauge", "axisLabelColor"], label: "刻度文字颜色", type: "color" },
  { path: ["chartVariants", "gauge", "splitLineColor"], label: "刻度线颜色", type: "color" },
  { path: ["chartVariants", "gauge", "startAngle"], label: "起始角度", type: "number", min: -360, max: 360 },
  { path: ["chartVariants", "gauge", "endAngle"], label: "结束角度", type: "number", min: -360, max: 360 },
  { path: ["chartVariants", "gauge", "radius"], label: "半径", type: "text" },
  { path: ["chartVariants", "gauge", "progressWidth"], label: "进度环宽度", type: "number", min: 4, max: 40 },
  { path: ["chartVariants", "gauge", "axisLineWidth"], label: "底环宽度", type: "number", min: 4, max: 40 },
  { path: ["chartVariants", "gauge", "pointerLength"], label: "指针长度", type: "text" },
  { path: ["chartVariants", "gauge", "detailFontSize"], label: "数值字号", type: "number", min: 12, max: 48 },
  { path: ["chartVariants", "gauge", "detailFontWeight"], label: "数值字重", type: "number", min: 300, max: 900 },
  { path: ["chartVariants", "gauge", "titleFontSize"], label: "标题字号", type: "number", min: 10, max: 32 },
];

const funnelFields: ThemeEditorField[] = [
  { path: ["chartVariants", "funnel", "labelColor"], label: "名称颜色", type: "color" },
  { path: ["chartVariants", "funnel", "valueColor"], label: "数值颜色", type: "color" },
  { path: ["chartVariants", "funnel", "guideLineColor"], label: "引导线颜色", type: "color" },
  { path: ["chartVariants", "funnel", "blockBorderColor"], label: "描边颜色", type: "color" },
  { path: ["chartVariants", "funnel", "blockBorderWidth"], label: "描边宽度", type: "number", min: 0, max: 8 },
  { path: ["chartVariants", "funnel", "itemGap"], label: "区块间距", type: "number", min: 0, max: 24 },
  { path: ["chartVariants", "funnel", "sortOrder"], label: "排序方式", type: "select", options: [{ value: "descending", label: "从大到小" }, { value: "ascending", label: "从小到大" }, { value: "none", label: "保持原序" }] },
];

const wordCloudFields: ThemeEditorField[] = [
  { path: ["chartVariants", "wordCloud", "palette", "0"], label: "词色一", type: "color" },
  { path: ["chartVariants", "wordCloud", "palette", "1"], label: "词色二", type: "color" },
  { path: ["chartVariants", "wordCloud", "palette", "2"], label: "词色三", type: "color" },
  { path: ["chartVariants", "wordCloud", "palette", "3"], label: "词色四", type: "color" },
  { path: ["chartVariants", "wordCloud", "palette", "4"], label: "词色五", type: "color" },
  { path: ["chartVariants", "wordCloud", "textShadowColor"], label: "文字阴影色", type: "color" },
  { path: ["chartVariants", "wordCloud", "textShadowBlur"], label: "阴影模糊", type: "number", min: 0, max: 32 },
  { path: ["chartVariants", "wordCloud", "shape"], label: "词云形状", type: "select", options: [{ value: "circle", label: "圆形" }, { value: "cardioid", label: "心形" }, { value: "diamond", label: "菱形" }, { value: "triangle-forward", label: "三角" }, { value: "star", label: "星形" }] },
  { path: ["chartVariants", "wordCloud", "gridSize"], label: "网格密度", type: "number", min: 4, max: 36 },
  { path: ["chartVariants", "wordCloud", "rotationStep"], label: "旋转步长", type: "number", min: 0, max: 180 },
  { path: ["chartVariants", "wordCloud", "minFontSize"], label: "最小字号", type: "number", min: 8, max: 48 },
  { path: ["chartVariants", "wordCloud", "maxFontSize"], label: "最大字号", type: "number", min: 16, max: 120 },
  { path: ["chartVariants", "wordCloud", "fontWeight"], label: "文字字重", type: "number", min: 300, max: 900 },
];

const lineFields: ThemeEditorField[] = [
  { path: ["chartVariants", "line", "axisColor"], label: "坐标轴颜色", type: "color" },
  { path: ["chartVariants", "line", "axisLabelColor"], label: "坐标文字颜色", type: "color" },
  { path: ["chartVariants", "line", "splitLineColor"], label: "分割线颜色", type: "color" },
  { path: ["chartVariants", "line", "lineWidth"], label: "线宽", type: "number", min: 1, max: 12 },
  { path: ["chartVariants", "line", "areaOpacity"], label: "面积透明度", type: "number", min: 0, max: 1 },
  { path: ["chartVariants", "line", "showSymbol"], label: "显示节点", type: "select", options: [{ value: "true", label: "显示" }, { value: "false", label: "隐藏" }] },
  { path: ["chartVariants", "line", "symbolSize"], label: "节点大小", type: "number", min: 0, max: 24 },
  { path: ["chartVariants", "line", "labelPosition"], label: "标签位置", type: "select", options: [{ value: "top", label: "顶部" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }, { value: "right", label: "右侧" }, { value: "inside", label: "内部" }] },
];

const comboFields: ThemeEditorField[] = [
  { path: ["chartVariants", "combo", "palette", "0"], label: "柱系列颜色", type: "color" },
  { path: ["chartVariants", "combo", "palette", "1"], label: "线系列颜色", type: "color" },
  { path: ["chartVariants", "combo", "labelColor"], label: "标签颜色", type: "color" },
  { path: ["chartVariants", "combo", "legendColor"], label: "图例颜色", type: "color" },
  { path: ["chartVariants", "combo", "axisColor"], label: "坐标轴颜色", type: "color" },
  { path: ["chartVariants", "combo", "axisLabelColor"], label: "坐标文字颜色", type: "color" },
  { path: ["chartVariants", "combo", "splitLineColor"], label: "分割线颜色", type: "color" },
  { path: ["chartVariants", "combo", "barBorderRadius"], label: "柱体圆角", type: "number", min: 0, max: 32 },
  { path: ["chartVariants", "combo", "lineWidth"], label: "线宽", type: "number", min: 1, max: 12 },
  { path: ["chartVariants", "combo", "lineSmooth"], label: "平滑曲线", type: "select", options: [{ value: "true", label: "平滑" }, { value: "false", label: "折线" }] },
  { path: ["chartVariants", "combo", "showSymbol"], label: "显示节点", type: "select", options: [{ value: "true", label: "显示" }, { value: "false", label: "隐藏" }] },
  { path: ["chartVariants", "combo", "symbolSize"], label: "节点大小", type: "number", min: 0, max: 24 },
  { path: ["chartVariants", "combo", "labelPosition"], label: "标签位置", type: "select", options: [{ value: "top", label: "顶部" }, { value: "bottom", label: "底部" }, { value: "left", label: "左侧" }, { value: "right", label: "右侧" }, { value: "inside", label: "内部" }] },
  { path: ["chartVariants", "combo", "areaOpacity"], label: "面积透明度", type: "number", min: 0, max: 1 },
  { path: ["chartVariants", "combo", "maxPointColor"], label: "最大值颜色", type: "color" },
  { path: ["chartVariants", "combo", "minPointColor"], label: "最小值颜色", type: "color" },
];

const areaFields: ThemeEditorField[] = [
  { path: ["chartVariants", "area", "axisColor"], label: "坐标轴颜色", type: "color" },
  { path: ["chartVariants", "area", "axisLabelColor"], label: "坐标文字颜色", type: "color" },
  { path: ["chartVariants", "area", "splitLineColor"], label: "分割线颜色", type: "color" },
  { path: ["chartVariants", "area", "lineWidth"], label: "线宽", type: "number", min: 1, max: 12 },
  { path: ["chartVariants", "area", "areaOpacity"], label: "面积透明度", type: "number", min: 0, max: 1 },
];

const radarFields: ThemeEditorField[] = [
  { path: ["chartVariants", "radar", "gridLineColor"], label: "网格线颜色", type: "color" },
  { path: ["chartVariants", "radar", "indicatorTextColor"], label: "指标文字颜色", type: "color" },
  { path: ["chartVariants", "radar", "pointColor"], label: "点颜色", type: "color" },
  { path: ["chartVariants", "radar", "areaOpacity"], label: "面积透明度", type: "number", min: 0, max: 1 },
];

const mapFields: ThemeEditorField[] = [
  { path: ["chartVariants", "map", "regionPalette", "0"], label: "低值颜色", type: "color" },
  { path: ["chartVariants", "map", "regionPalette", "1"], label: "次低颜色", type: "color" },
  { path: ["chartVariants", "map", "regionPalette", "2"], label: "中值颜色", type: "color" },
  { path: ["chartVariants", "map", "regionPalette", "3"], label: "次高颜色", type: "color" },
  { path: ["chartVariants", "map", "regionPalette", "4"], label: "高值颜色", type: "color" },
  { path: ["chartVariants", "map", "regionBorderColor"], label: "区域边界颜色", type: "color" },
  { path: ["chartVariants", "map", "labelColor"], label: "区域文字颜色", type: "color" },
  { path: ["chartVariants", "map", "visualMapTextColor"], label: "视觉映射文字", type: "color" },
];

const kpiFields: ThemeEditorField[] = [
  { path: ["chartVariants", "kpi", "valueColor"], label: "数值颜色", type: "color" },
  { path: ["chartVariants", "kpi", "labelColor"], label: "名称颜色", type: "color" },
  { path: ["chartVariants", "kpi", "compareColor"], label: "对比颜色", type: "color" },
  { path: ["chartVariants", "kpi", "dividerColor"], label: "分割线颜色", type: "color" },
  { path: ["chartVariants", "kpi", "itemBackgroundColor"], label: "卡片背景", type: "color" },
];

const tableFields: ThemeEditorField[] = [
  { path: ["chartVariants", "table", "headerBackground"], label: "表头背景", type: "color" },
  { path: ["chartVariants", "table", "headerTextColor"], label: "表头文字", type: "color" },
  { path: ["chartVariants", "table", "rowBackground"], label: "行背景", type: "color" },
  { path: ["chartVariants", "table", "rowAlternateBackground"], label: "隔行背景", type: "color" },
  { path: ["chartVariants", "table", "rowBorderColor"], label: "行边框", type: "color" },
];

const tabsFields: ThemeEditorField[] = [
  { path: ["chartVariants", "tabs", "tabBarBackground"], label: "标签栏背景", type: "color" },
  { path: ["chartVariants", "tabs", "activeTextColor"], label: "激活文字", type: "color" },
  { path: ["chartVariants", "tabs", "inactiveTextColor"], label: "未激活文字", type: "color" },
  { path: ["chartVariants", "tabs", "activeBackground"], label: "激活背景", type: "color" },
  { path: ["chartVariants", "tabs", "indicatorColor"], label: "指示器颜色", type: "color" },
];

export const themeCapabilityRegistry: Record<string, ThemeCapability> = {
  pie: {
    getOverrideSchema: () => pieFields,
    getEditorSections: () => [{ key: "pie", label: "饼图主题覆盖", fields: pieFields }],
  },
  bar: {
    getOverrideSchema: () => barFields,
    getEditorSections: () => [{ key: "bar", label: "柱图主题覆盖", fields: barFields }],
  },
  horizontalBar: {
    getOverrideSchema: () => horizontalBarFields,
    getEditorSections: () => [{ key: "horizontalBar", label: "条形图主题覆盖", fields: horizontalBarFields }],
  },
  sankey: {
    getOverrideSchema: () => sankeyFields,
    getEditorSections: () => [{ key: "sankey", label: "桑基图主题覆盖", fields: sankeyFields }],
  },
  gauge: {
    getOverrideSchema: () => gaugeFields,
    getEditorSections: () => [{ key: "gauge", label: "仪表盘主题覆盖", fields: gaugeFields }],
  },
  funnel: {
    getOverrideSchema: () => funnelFields,
    getEditorSections: () => [{ key: "funnel", label: "漏斗图主题覆盖", fields: funnelFields }],
  },
  wordCloud: {
    getOverrideSchema: () => wordCloudFields,
    getEditorSections: () => [{ key: "wordCloud", label: "词云图主题覆盖", fields: wordCloudFields }],
  },
  line: {
    getOverrideSchema: () => lineFields,
    getEditorSections: () => [{ key: "line", label: "折线主题覆盖", fields: lineFields }],
  },
  combo: {
    getOverrideSchema: () => comboFields,
    getEditorSections: () => [{ key: "combo", label: "组合图主题覆盖", fields: comboFields }],
  },
  area: {
    getOverrideSchema: () => areaFields,
    getEditorSections: () => [{ key: "area", label: "面积图主题覆盖", fields: areaFields }],
  },
  radar: {
    getOverrideSchema: () => radarFields,
    getEditorSections: () => [{ key: "radar", label: "雷达图主题覆盖", fields: radarFields }],
  },
  map: {
    getOverrideSchema: () => mapFields,
    getEditorSections: () => [{ key: "map", label: "地图主题覆盖", fields: mapFields }],
  },
  kpi: {
    getOverrideSchema: () => kpiFields,
    getEditorSections: () => [{ key: "kpi", label: "KPI 主题覆盖", fields: kpiFields }],
  },
  table: {
    getOverrideSchema: () => tableFields,
    getEditorSections: () => [{ key: "table", label: "表格主题覆盖", fields: tableFields }],
  },
  tabs: {
    getOverrideSchema: () => tabsFields,
    getEditorSections: () => [{ key: "tabs", label: "Tabs 主题覆盖", fields: tabsFields }],
  },
  chart: {
    getOverrideSchema: () => [],
    getEditorSections: () => [],
  },
};
