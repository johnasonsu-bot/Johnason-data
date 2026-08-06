# 航空本体知识库、字段血缘与动态演示实施计划

> 目标：交付航空术语/规则/案例知识库、概念到物理字段级血缘、分层动态知识图谱和延误处置模拟 HTML，并同步到现有行业知识库。

## 1. 建模与结构化资产

- 阅读现有语义层与治理 SQL，冻结 5 个实体、3 个关系、2 条规则、CODA 字典及 7 张核心 ODS 表字段口径。
- 新增 `scripts/aviation_ontology_knowledge_base.md/json`，写入术语、规则、案例、质量口径、实体关系和证据来源。
- 新增 `scripts/aviation_ontology_field_lineage.md/json`，逐字段维护概念字段、DWD 输出字段、ODS 源字段、转换和连接条件。
- 新增 `scripts/aviation_ontology_field_lineage.sql`，幂等落地实体、关系、规则视图和字段级注释/映射证据。

## 2. 交互式知识图谱

- 复制 `interactive-knowledge-graph/assets/knowledge-graph-template.html` 到 `outputs/aviation_ontology_knowledge_graph.html`。
- 仅替换数据块，使用五层横带布局，加入实体、关系、规则、物理字段和案例节点；保留拖拽、缩放、搜索、筛选、详情、邻居跳转和 Force 切换。
- 运行模板要求的 `node --check`、端点完整性和 group-layer 映射校验。

## 3. 延误处置模拟视觉 HTML

- 新增 `outputs/aviation_delay_decision_simulation.html`，不依赖前端构建或外部网络。
- 实现输入面板、推理时间线、规则结果、推荐动作、审计事件和字段级服务追踪。
- 覆盖正常、天气延误、机组违规阻断和容量不足四种状态，并提供重置/执行按钮。

## 4. 平台知识库同步

- 使用现有 `system-knowledge-base` 服务，通过标签查找/创建 `航空本体语义层知识库`。
- 将知识库 Markdown、字段血缘 Markdown、动态图谱 HTML 和模拟 HTML 作为生成文档写入并触发解析。
- 输出知识库 ID、文档 ID、解析状态；同步失败时保留本地文件并报告失败原因。

## 5. 验证与交付

- 运行 JSON/HTML/SQL 静态校验。
- 运行相关后端测试与前端构建，确认不回归现有数据接入和数据地图功能。
- 通过本地 HTTP 读取或浏览器打开两个 HTML，确认布局、搜索、详情和模拟执行可用。
- 汇总交付路径、平台知识库 ID/文档 ID、验证结果和已知限制。
