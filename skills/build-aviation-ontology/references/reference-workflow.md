# 已验证的航空 Demo 参考契约

此参考来自 Codex 会话 `019fd07c-f4e0-7731-9405-327145a7f6e3` 的航空本体构建过程，以及仓库 `/Users/sushi/Downloads/data-platform-dev/source` 中已落地的脚本。仅在复现或扩展该 Demo 时使用；不要把其中 ID 和计数硬编码到其他项目。

## 默认演示契约

- 项目编码：`aviation_ontology_demo`
- 固定基线：7 张 ODS 表、89 条记录
- 实体：`FlightSegment`、`AircraftTail`、`CrewMember`、`WeatherEvent`、`RunwayCapacity`
- 关系：`operatedBy`、`staffedBy`、`impacts`
- 规则：天气延误推理、机组值勤/休息约束
- 首轮预期失败：资源注册不全、延误代码未采标、动作日志重复、机组关系缺乏可信资源登记

## 推荐入口

仅在项目 ID、数据源 ID、SQL 内历史硬编码和脏数据预检全部通过后，在仓库根目录运行；DSN 和项目 ID 由环境注入：

```bash
node scripts/verify-datax-enterprise-plugins.js
psql "$AVIATION_ODS_DSN" -v ON_ERROR_STOP=1 -f scripts/aviation_ontology_governance.sql
psql "$AVIATION_ODS_DSN" -v ON_ERROR_STOP=1 -f scripts/aviation_ontology_field_lineage.sql
AVIATION_PROJECT_ID="$AVIATION_PROJECT_ID" node backend/src/scripts/bootstrap-aviation-demo.js
node --test scripts/aviation_ontology_assets.test.js backend/src/scripts/bootstrap-aviation-demo.test.js
```

核心文件：

- `scripts/aviation_ontology_governance.sql`
- `scripts/aviation_ontology_field_lineage.sql`
- `scripts/aviation_ontology_semantic_layer.md`
- `scripts/aviation_ontology_knowledge_base.{md,json}`
- `scripts/aviation_ontology_field_lineage.{md,json}`
- `backend/src/scripts/bootstrap-aviation-demo.js`
- `outputs/aviation_ontology_knowledge_graph.html`
- `outputs/aviation_delay_decision_simulation.html`
- `docs/aviation-ontology-codex-script-inventory.md`

## 已验证平台入口

- 行业知识库：`/dashboard/system-knowledge-bases/industry`
- 标准数据元：`/dashboard/data-standards/elements`
- 字段标准映射：`/dashboard/data-standards/mappings`
- 数据地图资源：`/dashboard/data-map/resources`
- 数据调研：`/dashboard/data-source-research/:taskId`
- 业务数据检索：`/dashboard/asset-search/business-data`
- SQL 开发：`/dashboard/data-development/workbench2`
- 逻辑模型：`/dashboard/data-modeling/logical-models`
- 物理模型：`/dashboard/data-modeling/physical-models`
- 报表工作台：`/dashboard/reporting/workbench`

API 调用需使用登录态和实际项目上下文；历史 Demo 使用 `X-Project-Id: 7`，新运行必须替换为实际项目 ID。

## 历史故障模式

| 症状 | 根因/处理 |
|---|---|
| 导入包提示结构不兼容 | 先取得精确缺表/缺列，补幂等迁移与跨环境引用映射，再重试事务导入 |
| `flight_segment_id` 非空失败 | 任务行适配器丢失；恢复显式适配器并增加按供应商/目标表的安全兜底 |
| METAR `VRB` 写 numeric 失败 | 原始风向及可能含 `M`、`6+` 的字段先按文本暂存，再在语义层规范化 |
| API 400/无数据 | 检查请求参数实际发送、响应根数组/路径、批次上限和过滤条件 |
| 数据调研选不到表 | 平台连接的实际数据源中缺表；在权威 ODS 创建/登记，而非只在平台 MySQL 留副本 |
| 标准数据元查询引用缺失 `project_id` | 模块迁移未接入统一迁移入口；补迁移钩子、索引和回归测试 |
| SQL 分析连接失败 | 数据源主机/库/加密凭据/默认数据库与运行环境不一致 |
| ER 图关系不完整 | 表扫描范围或关系解析只到表级；补齐显式外键、业务键和字段级键角色 |
| 报表预览要求登录 | 运行时路由缺少正确的可选/必需鉴权中间件 |
| 离线 HTML 已生成但平台看不到 | 上传行业知识库，验证解析与预览；公共预览需隔离 iframe/CSP |

## 当前实现门禁

- `aviation_ontology_governance.sql` 的历史实现可能使用项目 ID `7`，而 Bootstrap 接受 `AVIATION_PROJECT_ID`；运行前必须确认一致。
- Bootstrap 读取 ODS 元数据时，缺少 PostgreSQL 连接信息可能返回空集合而不立即失败；以 `dataMap.resourceCount > 0` 为硬门禁。
- 历史报表装载曾引用固定开发数据源 ID；必须通过数据源编码/连接信息反查并校验，不能复用裸 ID。
- Bootstrap 不负责行业知识库文档同步；知识库上传、解析等待、向量就绪和关键词检索是独立必做阶段。
- 现有 HTML 是版本化成品，仓库没有统一的 JSON → HTML 生成器。若语义契约变化，使用交互知识图谱生成能力重新生成，或补充可测试的仓内生成入口；仅验证旧 HTML 不算同步更新。
- 治理前先查询历史脏数据；`SET NOT NULL`、主键或唯一索引若失败，事务应回滚并先清理/隔离异常记录。

## 历史验收值

治理后曾验证：7/7 资源发布、延误代码未采标 0、动作日志消费层重复 0、`staffedBy` 有效、目标表字段注释覆盖完整。知识库曾同步 7 个文档并达到 `PARSE_SUCCESS`/`READY`；图谱为 40 节点、57 边、5 层。这些是回归参照，不是新项目的强制计数。
