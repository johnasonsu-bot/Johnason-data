# ECharts 6 与词云扩展兼容升级设计

## 目标

将前端图表栈统一升级到稳定版 ECharts 6，并消除 `echarts-wordcloud@2.1.0` 仅声明支持 ECharts 5 所导致的 `npm ci` 依赖冲突。升级后必须可以使用标准 `npm ci` 安装、通过 TypeScript 与 Vite 生产构建，并保持现有词云主题配置能力。

## 方案

采用 Apache ECharts 官方维护的 `@echarts-x/custom-word-cloud` 替换 `echarts-wordcloud`：

- ECharts 依赖升级到当前稳定的 6.1 系列；
- 官方词云扩展声明 `echarts ^6.0.0`，不再需要 `--legacy-peer-deps`；
- 在前端增加一个集中式兼容适配器，注册官方自定义系列，并将现有 `type: "wordCloud"` 系列转换为 ECharts 6 自定义系列格式；
- 保留形状、网格、字号范围、旋转、颜色、阴影和数据标签语义；
- 报表编辑器与预览页使用同一注册及转换入口，避免两套行为分叉。

## 数据转换

旧词云系列：

```ts
{
  type: "wordCloud",
  shape,
  gridSize,
  sizeRange,
  rotationRange,
  rotationStep,
  data: [{ name, value, textStyle }]
}
```

转换为官方 ECharts 6 自定义系列：

```ts
{
  type: "custom",
  renderItem: "wordCloud",
  itemPayload: {
    shape,
    gridSize,
    sizeRange,
    rotationRange,
    rotationStep
  },
  data: [[name, value, textStyle]]
}
```

适配器仅转换词云系列，其他 ECharts 配置保持原样。输入为空、非数组数据或已经转换的系列时必须安全返回。

## 测试与验收

采用测试先行：

1. 新增适配器测试，先验证旧格式转换、普通图表不变和幂等行为；
2. 实现最小适配器并让测试通过；
3. 删除旧插件导入，接入统一入口；
4. 删除 `node_modules` 后执行不带兼容参数的 `npm ci`；
5. 执行前端测试、TypeScript/Vite 生产构建和运行时页面健康检查；
6. 检查依赖树中 ECharts 仅保留兼容的 6.x 版本。

## Git 发布范围

本次 `dev` 提交包含：

- ECharts 6 与官方词云扩展兼容修复；
- 当前未提交的数据调研字段级关系解析修改；
- 航空本体治理 SQL 与语义层 Markdown 文件；
- 本设计与实施计划文档。

明确排除运行时目录、TypeScript 构建缓存及 Vite 生成文件。完成验证后推送至 `origin/dev`。
