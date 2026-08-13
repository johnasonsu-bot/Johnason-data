# 航空本体概念模型到物理表/字段模型血缘

> 粒度：概念字段 → DWD 语义视图字段 → ODS/字典源字段。完整机器可读版本见 `aviation_ontology_field_lineage.json`。

## 1. 概念到物理映射总览

| 概念 | DWD 视图 | 主物理表 | 主键 |
|---|---|---|---|
| FlightSegment | `dwd_ent_flight_segment` | `ods_flight_schedule` | `flight_segment_id` |
| AircraftTail | `dwd_ent_aircraft_tail` | `ods_aircraft_tail` | `tail_no` |
| CrewMember | `dwd_ent_crew_member` | `ods_crew_roster` | `crew_id` |
| WeatherEvent | `dwd_ent_weather_event` | `ods_weather_metar`；回补 `ods_china_airport_current_weather` | `airport_icao#observe_time` |
| RunwayCapacity | `dwd_ent_runway_capacity` | `ods_runway_slot` | `airport_icao#runway_id#slot_hour` |

## 2. 字段级血缘摘要

### FlightSegment → `dwd_ent_flight_segment`

| 概念字段 | DWD 字段 | ODS/字典来源 | 转换与用途 |
|---|---|---|---|
| entity_id | entity_id | `ods_flight_schedule.flight_segment_id` | 直连，主键 |
| flight_no | flight_no | `ods_flight_schedule.flight_no` | 直连，航班号 |
| dep_airport | dep_airport | `ods_flight_schedule.dep_airport` | ICAO 直连，关系连接键 |
| arr_airport | arr_airport | `ods_flight_schedule.arr_airport` | ICAO 直连 |
| std / sta / atd | std / sta / atd | `ods_flight_schedule.std/sta/atd` | 时间直连；`std` 作为增量游标 |
| flight_status | flight_status | `ods_flight_schedule.flight_status` | 直连 |
| delay_minutes | delay_minutes | `ods_flight_schedule.delay_minutes` | 安全 numeric cast；规则输入 |
| delay_code_raw | delay_code_raw | `ods_flight_schedule.delay_code_raw` | 保留源证据 |
| delay_code_std | delay_code_std | `dim_delay_code_coda.coda_code` | `raw_code=COALESCE(delay_code_raw,'')` 左连接 |
| delay_category_cn | delay_category_cn | `dim_delay_code_coda.category_cn` | CODA 中文分类 |
| tail_no | tail_no | `ods_flight_schedule.tail_no` | 允许 API 暂缺；关联 AircraftTail |
| carrier_code | carrier_code | `ods_flight_schedule.carrier_code` | Aviationstack 来源约束为 CZ |

### AircraftTail → `dwd_ent_aircraft_tail`

`tail_no` 直连为实体键；`aircraft_model`、`cabin_class`、`current_station`、`tail_status` 直连；`remain_flight_hours` 安全转数值；`mel_defect` 通过“空=0、非空=1”变换为 `has_mel_defect`。

### CrewMember → `dwd_ent_crew_member`

`crew_id` 直连为实体键；`crew_role`、`qualified_model`、`duty_start`、`assigned_flight_no`、`compliance_flag` 保留源语义；`duty_hours`、`duty_limit_hours`、`rest_hours`、`rest_min_hours` 安全转数值，其中 13 小时/10 小时是默认策略阈值。

### WeatherEvent → `dwd_ent_weather_event`

实体键为 `airport_icao || '#' || observe_time`。`airport_icao` 和 `observe_time` 用于时间空间连接；`weather_phenomenon`、`visibility_m`、`wind_gust_kt`、`severity_level` 是天气规则输入。当前天气铺底表可通过 `flight_category` 补充可见度分类；`VRB` 等原始风向必须保留为文本。

### RunwayCapacity → `dwd_ent_runway_capacity`

实体键为 `airport_icao || '#' || runway_id || '#' || slot_hour`。容量字段使用 `NULLIF(blank,'')::numeric`，`capacity_ratio` 必须通过 0–1 质量规则；`restriction_reason` 进入处置证据。

## 3. 字段级关系血缘

| 关系 | 源字段 | 目标字段 | DWD 关系视图 | 连接/窗口 |
|---|---|---|---|---|
| operatedBy | `ods_flight_schedule.tail_no` | `ods_aircraft_tail.tail_no` | `dwd_rel_flight_operated_by_tail` | 相等连接 |
| staffedBy | `ods_flight_schedule.flight_no` | `ods_crew_roster.assigned_flight_no` | `dwd_rel_flight_staffed_by_crew` | 航班号相等且同运行窗口 |
| impacts | `ods_weather_metar.airport_icao#observe_time` | `ods_flight_schedule.dep_airport#std` | `dwd_rel_weather_impacts_flight` | 机场一致且观测/计划小时重叠 |

## 4. 规则字段血缘

- `dwd_rule_weather_delay_inferred.inferred_class` ← `dwd_rel_weather_impacts_flight.weather_phenomenon` + `dwd_ent_flight_segment.delay_minutes`。
- `dwd_rule_crew_duty_violation.violation_type` ← `dwd_rel_flight_staffed_by_crew.duty_hours/duty_limit_hours/rest_hours/rest_min_hours`。
- `ods_action_log_clean` 是处置动作的审计落点，不回写覆盖 ODS 原始航班、天气或机组证据。

## 5. 数据治理注意点

1. 主键/业务唯一键先于增量同步：`flight_segment_id`、`tail_no`、`crew_id` 和天气/跑道复合键必须稳定。
2. `VRB`、能见度加号和空报文值在 ODS 保留原文，DWD 只在明确可转换时做 numeric cast。
3. 机场无当前报文使用 `NO_CURRENT_REPORT`，不填充虚假的零天气值。
4. CODA 字典为空会使 `delay_code_std` 与延误推理不可用，必须在视图重跑前完成字典同步。
