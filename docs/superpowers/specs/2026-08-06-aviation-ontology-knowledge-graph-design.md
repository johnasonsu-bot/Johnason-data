# 航空本体语义层与分层知识图谱设计

## 目标

在现有 `aviation_ontology_demo` 项目上交付一套可审阅、可导入、可离线演示的语义层资产：

1. 航空术语、规则与经验案例知识库；
2. 从五类概念实体到 ODS/DWD 物理表和字段的字段级数据血缘；
3. 按截图中的“5 实体 + 3 关系 + 2 规则”构建可切换分层/力导向布局的 Obsidian 风格动态知识图谱；
4. 一个独立的航空延误处置模拟 HTML，用于验证天气影响、航班延误和机组约束推理结果。

## 已有能力与约束

- `scripts/aviation_ontology_semantic_layer.md` 已定义 5 个实体、3 个关系、2 个规则、CODA 延误字典和 7 张核心 ODS 表。
- `scripts/aviation_ontology_governance.sql` 已提供 DWD 实体/关系/规则视图和质量规则基础。
- 系统知识库模块支持创建知识库、生成 Markdown 文档、解析切片和界面预览。
- 数据地图已有表级 `dm_resource_lineage_edges`；本次通过字段级映射文档与 SQL 视图提供确定性的字段血缘证据，不改变已有表级接口契约。
- 动态图谱必须是单文件、零依赖、无 CDN、可从 `file://` 离线打开，不使用浏览器存储。
- 不把 API key、Token、密码写入代码或产物。

## 方案

采用“文件资产 + 平台知识库同步”的混合交付：

### 知识库资产

- `scripts/aviation_ontology_knowledge_base.md`：术语、实体、关系、规则、CODA 字典、质量口径、经验案例和决策动作。
- `scripts/aviation_ontology_knowledge_base.json`：同一内容的结构化版本，包含 `terms`、`rules`、`cases`、`entities`、`relations`、`dictionaries`。
- 通过后端公开的知识库服务生成/更新一个带 `scope:industry` 与 `domain:aviation-ontology` 标签的行业知识库，并将上述 Markdown 作为文档解析入库。

### 字段级血缘资产

- `scripts/aviation_ontology_field_lineage.md`：概念实体 → 关系 → DWD 视图 → ODS 表/字段的可读映射，逐字段注明键、转换、时间窗口和证据。
- `scripts/aviation_ontology_field_lineage.json`：机器可读节点、字段、映射和关系边。
- `scripts/aviation_ontology_field_lineage.sql`：幂等的 PostgreSQL 视图/注释脚本，提供五个实体视图、三个关系视图、两条规则视图，并用显式字段连接表达血缘。

### 动态知识图谱

- `outputs/aviation_ontology_knowledge_graph.html`：基于 `interactive-knowledge-graph` 模板，默认五层横带布局，支持 Force 切换。
- 图谱层级：
  1. 业务场景：航班延误、处置决策；
  2. 本体实体：FlightSegment、AircraftTail、CrewMember、WeatherEvent、RunwayCapacity；
  3. 语义关系：operatedBy、staffedBy、impacts；
  4. 推理与约束：WeatherDelayedFlight、DUTY_OVER_LIMIT、REST_UNDER_MIN；
  5. 物理数据：DWD 视图、ODS 表、字段和 CODA 字典。
- 颜色用于实体/关系/规则/物理数据/知识案例分类，独立于纵向层级。
- 图谱同时登记到行业知识库，作为 `aviation_ontology_knowledge_graph.html` 文档保存；HTML 本身仍可脱离平台离线打开。

### 延误处置模拟

- `outputs/aviation_delay_decision_simulation.html`：零依赖单文件视觉模拟。
- 场景固定为示例航班：广州出发，受 METAR 强雷暴影响并已延误；允许调整延误分钟、天气严重度、跑道容量、机组值勤/休息数据。
- 点击“执行决策”后按事件时间线计算：天气影响 → WeatherDelayedFlight 推理 → 机组 SHACL 约束 → 推荐动作（换机组、申请时隙、旅客通知、阻断违规方案）。
- 页面展示输入快照、推理证据、动作计划和“涉及服务/表/字段”追踪面板，保证模拟结果可回溯到字段级血缘。

## 关键数据模型

### 概念实体与物理映射

| 概念实体 | DWD 视图 | ODS 主表 | 标识字段 |
|---|---|---|---|
| FlightSegment | `dwd_ent_flight_segment` | `ods_flight_schedule` | `flight_segment_id` |
| AircraftTail | `dwd_ent_aircraft_tail` | `ods_aircraft_tail` | `tail_no` |
| CrewMember | `dwd_ent_crew_member` | `ods_crew_roster` | `crew_id` |
| WeatherEvent | `dwd_ent_weather_event` | `stg_aviationweather_current_metar` / `ods_china_airport_current_weather` | `airport_icao#observe_time` |
| RunwayCapacity | `dwd_ent_runway_capacity` | `ods_runway_slot` | `airport_icao#runway_id#slot_hour` |

### 关系与字段连接

- `operatedBy`：`ods_flight_schedule.tail_no = ods_aircraft_tail.tail_no`。
- `staffedBy`：`ods_flight_schedule.flight_no = ods_crew_roster.assigned_flight_no`，并限定计划日期窗口。
- `impacts`：`weather.airport_icao IN (flight.dep_airport, flight.arr_airport)` 且天气观测时间落入计划起飞/到达小时窗口。

### 规则

- SWRL 风格：`impacts(WeatherEvent, FlightSegment) AND delay_minutes > 0` ⇒ `WeatherDelayedFlight`。
- SHACL 风格：`duty_hours > 13 OR rest_hours < 10` ⇒ 调配方案标记违规并阻断。

## 错误处理与可追溯性

- 任何未匹配字段、缺失实体键或空 CODA 字典值均在 Markdown/JSON 中列为待治理项，不用伪造值覆盖。
- SQL 脚本使用 `CREATE OR REPLACE VIEW`、`CREATE TABLE IF NOT EXISTS` 或注释/索引幂等语句。
- 知识库同步失败不影响离线文件交付，命令返回明确的知识库 ID、文档 ID 和错误摘要。

## 验证

1. JSON 通过 `JSON.parse`，且字段映射的源/目标字段均存在。
2. 图谱 HTML 最大 `<script>` 通过 `node --check`，所有边端点存在，每个 group 映射且仅映射到一层。
3. SQL 通过静态检查，视图名称和字段连接与 Markdown/JSON 一致。
4. 模拟页面可在无网络环境打开，执行一次“天气延误 + 机组超限”得到 `WeatherDelayedFlight` 和阻断动作。
5. 知识库 API 返回文档 `PARSE_SUCCESS`，界面可预览 Markdown 与图谱 HTML。
