# 航空本体语义层知识库

> 版本：1.0.0 ｜ 项目：`aviation_ontology_demo` ｜ 契约：**5 实体 + 3 关系 + 2 规则**

## 1. 知识库用途

这份知识库把航空运行术语、语义层实体、物理字段口径、延误规则和处置经验统一到可检索的行业知识中。它是 DWD 视图和延误处置模拟的业务解释层，不替代 ODS 原始证据。

## 2. 五类本体实体

| 实体 | 中文 | DWD 视图 | ODS 表 | 稳定标识 | 粒度 |
|---|---|---|---|---|---|
| `FlightSegment` | 航班架次 | `dwd_ent_flight_segment` | `ods_flight_schedule` | `flight_segment_id` | 一条航班架次 |
| `AircraftTail` | 物理飞机与 MEL | `dwd_ent_aircraft_tail` | `ods_aircraft_tail` | `tail_no` | 一架物理飞机 |
| `CrewMember` | 机组与值勤时长 | `dwd_ent_crew_member` | `ods_crew_roster` | `crew_id` | 一名机组成员的一段排班 |
| `WeatherEvent` | 强雷暴气象事件 | `dwd_ent_weather_event` | `ods_weather_metar` / `ods_china_airport_current_weather` | `airport_icao#observe_time` | 一机场一观测时刻 |
| `RunwayCapacity` | 跑道容量时刻 | `dwd_ent_runway_capacity` | `ods_runway_slot` | `airport_icao#runway_id#slot_hour` | 一跑道一小时 |

## 3. 三类本体关系

### `operatedBy`：航班由航空器执飞

`ods_flight_schedule.tail_no = ods_aircraft_tail.tail_no`，落到 `dwd_rel_flight_operated_by_tail`。空 `tail_no` 不用伪造机尾号，关系保持为空并进入治理待补清单。

### `staffedBy`：航班由机组保障

`ods_flight_schedule.flight_no = ods_crew_roster.assigned_flight_no`，落到 `dwd_rel_flight_staffed_by_crew`。生产实现应再限定计划日期或运行窗口，避免同航班号跨天误配。

### `impacts`：气象影响航班

天气事件的 `airport_icao` 匹配航班起飞/到达机场，`observe_time` 落入 `std/sta` 的同小时窗口，落到 `dwd_rel_weather_impacts_flight`。当前演示优先使用起飞机场窗口，后续可扩展到到达机场。

## 4. 两条推理与约束规则

1. **SWRL 风格天气延误推理**：如果 `WeatherEvent impacts FlightSegment` 且 `delay_minutes > 0`，则将航班归类为 `WeatherDelayedFlight`，落到 `dwd_rule_weather_delay_inferred`。
2. **SHACL 风格机组约束**：如果 `duty_hours > duty_limit_hours` 或 `rest_hours < rest_min_hours`，则调配方案标记 `DUTY_OVER_LIMIT`/`REST_UNDER_MIN`，阻断并要求换用合规机组，落到 `dwd_rule_crew_duty_violation`。

## 5. 术语速查

| 术语 | 口径 |
|---|---|
| METAR | 机场当前风、能见度、天气现象和飞行规则类别的标准气象报文。 |
| CODA 延误代码 | 将天气、机组、技术、机场设施和空管流量等源方言统一的延误分类。 |
| 业务唯一键 | 跨来源识别同一航班的稳定组合键，支持增量更新和去重。 |
| 增量游标 | 用于识别新增/变更记录的时间字段，如 `std`、`source_updated_at`、`last_fetched_at`。 |
| `VRB` | METAR 中的风向可变原始值，必须按字符串保留，不能直接 cast 为 numeric。 |
| `NO_CURRENT_REPORT` | 机场目录存在但当前没有有效报文，不代表天气为零值。 |
| `WeatherDelayedFlight` | 同时存在天气影响边且航班有正延误分钟数的推理类。 |
| `DUTY_OVER_LIMIT` | 连续值勤超过允许上限，调配方案阻断。 |
| `REST_UNDER_MIN` | 休息时间低于最低要求，调配方案阻断。 |

## 6. CODA 字典

| 标准码 | 分类 | 源值示例 |
|---|---|---|
| `71` | 天气 | `WX`、`weather-thunderstorm`、`天气原因` |
| `63` | 机组 | `CREW_OVER` |
| `41` | 航空器技术 | `TECH-MEL` |
| `89` | 机场设施与时刻 | `AIRPORT_SLOT` |
| `81` | 空管流量 | `ATC_FLOW` |
| `00` | 无延误 | 空字符串 |

## 7. 经验案例与处置动作

### 案例 A：广州雷暴导致航班延误

METAR 标记强雷暴，观测小时与广州出发航班的 `std` 小时相交，且 `delay_minutes=85`。系统推理 `WeatherDelayedFlight`，建议申请后移时隙并发送旅客通知。

### 案例 B：机组连续值勤超限

候选机组 `duty_hours=13.6`，超过 13 小时上限。系统输出 `DUTY_OVER_LIMIT`，阻断原调配方案，改派合规备份机组。

### 案例 C：雷暴叠加跑道容量下降

`available_capacity / declared_capacity=0.45` 且限制原因为 `THUNDERSTORM`。建议申请下一可用时隙，保留原航班架次与动作审计。

| 动作 | 触发条件 | 写入审计 |
|---|---|---|
| 申请后移时隙 | 天气延误且容量比例 < 0.7 | `ods_action_log_clean` / `REQUEST_SLOT` |
| 改派合规机组 | 出现任一机组违规 | `ods_action_log_clean` / `REASSIGN_CREW` |
| 旅客延误通知 | 延误分钟数 ≥ 30 | `ods_action_log_clean` / `PAX_NOTIFY` |

## 8. 治理边界

- `flight_segment_id`、`tail_no`、`crew_id` 和天气复合键必须先补齐，再依赖增量同步或去重。
- `wind_direction_deg` 和 `temperature_c` 等 METAR 原始字段允许保留字符串；`VRB`、加号能见度等值必须在 DWD 转换层安全解析。
- 缺失更新时间字段的表需确定全量窗口或补充审计字段；当前推荐使用 `std`、`source_updated_at`、`ingested_at`、`last_fetched_at`。
- 空的 `dim_delay_code_coda` 会导致语义层延误分类不可用，必须先完成字典加载。

## 9. 机器可读资产

- 术语、规则、案例和动作：`scripts/aviation_ontology_knowledge_base.json`
- 概念到物理字段级血缘：`scripts/aviation_ontology_field_lineage.md/json`
- 幂等 SQL 视图与字段映射：`scripts/aviation_ontology_field_lineage.sql`
- 分层动态图谱：`outputs/aviation_ontology_knowledge_graph.html`
- 延误处置模拟：`outputs/aviation_delay_decision_simulation.html`
