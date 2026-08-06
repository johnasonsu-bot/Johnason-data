# 航空 Demo 语义层与数据治理规范

## 1. 结论

`aviation_ontology_demo` 采用“ODS 物理数据—DWD 本体实体—关系边—推理与约束规则”的四层结构。治理后的可交付状态为：7 张演示 ODS 表具备主键或可追踪的业务唯一键，7 项资源均有责任归属，10 条 CODA 延误代码完成统一，6 项字段采标生效，7 条质量规则启用，5 类实体、3 类关系与2条本体规则可重复计算。

## 2. 物理层键定义

| 表 | 主键/业务唯一键 | 增量或审计字段 | 说明 |
|---|---|---|---|
| `aviationweather_icao_batches` | `batch_no` | `updated_at` | 每批最多 50 个 ICAO |
| `meta_resource_registry` | `(project_id, resource_name)`；`res_code`唯一 | `registered_at`,`updated_at` | 资源责任与发布状态 |
| `ods_aircraft_tail` | `tail_no` | `updated_at` | AircraftTail 实体 |
| `ods_flight_schedule` | `flight_segment_id`；`(record_source,source_record_id)`唯一 | `std`,`source_updated_at`,`ingested_at`,`updated_at` | FlightSegment 统一湖表，支持手工与 Aviationstack API |
| `ods_crew_roster` | `crew_id` | `updated_at` | CrewMember 实体 |
| `ods_weather_metar` | `(airport_icao, observe_time)` | `observe_time`,`ingested_at` | 离线可复现气象基线 |
| `ods_runway_slot` | `(airport_icao, runway_id, slot_hour)` | `slot_hour`,`updated_at` | RunwayCapacity 实体 |
| `ods_pax_connection` | `pax_id` | `updated_at` | 旅客中转保障 |
| `ods_action_log` | 原始层不强加主键 | `action_time` | 保留重复审计证据 |
| `ods_action_log_clean` | `action_id` | `updated_at` | 对外服务去重表 |
| `ods_china_airport_current_weather` | `airport_icao` | `last_fetched_at` | 283 机场铺底总表 |
| `stg_aviationweather_current_metar` | `airport_icao` | `observe_time`,`last_fetched_at` | 当前 METAR 快照 |

## 3. 本体实体

| 实体类 | 实体视图 | 实体标识 | 核心属性 |
|---|---|---|---|
| `FlightSegment` | `dwd_ent_flight_segment` | `flight_segment_id` | 航班号、起降机场、时刻、延误、机尾号 |
| `AircraftTail` | `dwd_ent_aircraft_tail` | `tail_no` | 机型、宽窄体、剩余可飞小时、MEL、状态 |
| `CrewMember` | `dwd_ent_crew_member` | `crew_id` | 角色、资质、值勤、休息、基地 |
| `WeatherEvent` | `dwd_ent_weather_event` | `airport_icao#observe_time` | 天气现象、能见度、阵风、严重度 |
| `RunwayCapacity` | `dwd_ent_runway_capacity` | `airport_icao#runway_id#slot_hour` | 公布容量、可用容量、容量比例、限制原因 |

## 4. 本体关系

| 关系 | 主语 | 宾语 | 关系视图 | 连接条件 |
|---|---|---|---|---|
| `operatedBy` | FlightSegment | AircraftTail | `dwd_rel_flight_operated_by_tail` | `flight_schedule.tail_no = aircraft_tail.tail_no` |
| `staffedBy` | FlightSegment | CrewMember | `dwd_rel_flight_staffed_by_crew` | `flight_schedule.flight_no = crew_roster.assigned_flight_no` |
| `impacts` | WeatherEvent | FlightSegment | `dwd_rel_weather_impacts_flight` | 起飞机场一致且计划起飞小时与观测小时一致 |

关系可信的前提是两端实体均具有稳定标识、来源资源已发布且责任部门/业务系统不为空。

## 5. 本体规则

### 5.1 SWRL 风格推理：天气延误

若 WeatherEvent `impacts` FlightSegment 且 `delay_minutes > 0`，则推理该航班属于 `WeatherDelayedFlight`。落地视图为 `dwd_rule_weather_delay_inferred`。

### 5.2 SHACL 风格约束：机组值勤

若 `duty_hours > duty_limit_hours`，产生 `DUTY_OVER_LIMIT`；若 `rest_hours < rest_min_hours`，产生 `REST_UNDER_MIN`。违规关系进入 `dwd_rule_crew_duty_violation`，供调配方案阻断。

## 6. 数据质量规则

| 规则 | 资源字段 | 类型 | 通过条件 | 严重度 |
|---|---|---|---|---|
| Q001 | `ods_action_log_clean.action_id` | 唯一性 | 去重后无重复 action_id | 高 |
| Q002 | `ods_flight_schedule.flight_segment_id` | 非空 | 全部非空 | 高 |
| Q003 | `ods_flight_schedule.delay_code_raw` | 代码集 | 全部命中 `dim_delay_code_coda` | 高 |
| Q004 | `ods_crew_roster.duty_hours` | 范围 | 0–13 小时；超限进入违规视图 | 高 |
| Q005 | `ods_crew_roster.rest_hours` | 范围 | 不低于 10 小时；不足进入违规视图 | 高 |
| Q006 | `ods_aircraft_tail.remain_flight_hours` | 范围 | 大于等于 0 | 中 |
| Q007 | `ods_runway_slot.capacity_ratio` | 范围 | 0–1 | 中 |
| Q008 | `ods_flight_schedule.business_key` | 非空 | 统一业务键不为空 | 高 |
| Q009 | `ods_flight_schedule.carrier_code` | 来源约束 | Aviationstack 来源固定为 CZ | 高 |
| Q010 | `ods_flight_schedule.dep_airport` | 来源约束 | Aviationstack 来源固定为 ZGGG | 高 |
| Q011 | `ods_flight_schedule.sta/std` | 一致性 | 计划到达不早于计划起飞 | 高 |
| Q012 | `ods_flight_schedule.delay_minutes` | 范围 | 延误分钟不小于 0 | 高 |
| Q013 | `ods_flight_schedule.business_key` | 重复复核 | 跨来源同业务键进入待融合清单 | 中 |

### 6.1 航班计划双来源标准

`ods_flight_schedule` 同时保留 `MANUAL` 与 `AVIATIONSTACK` 来源。手工记录继续使用 `FS...` 主键；Aviationstack 使用基于航班日期、航班号和计划起飞时间生成的 `AS_...` 稳定主键。API 按来源记录标识重复运行更新自身记录，不覆盖手工记录；两种来源通过 `business_key` 识别同一业务航班，原始证据保留后再由质量流程决定融合策略。

来源审计字段包括 `record_source`、`source_record_id`、`business_key`、`source_updated_at`、`ingested_at` 和 `raw_payload`。其中 `tail_no`、`atd`、`delay_code_raw` 等 API 可能暂缺的属性允许为空，不以空字符串伪造业务值。

## 7. CODA 标准化

`dim_delay_code_coda` 将源系统方言统一为 CODA 类别：天气 `71`、机组 `63`、航空器技术 `41`、机场设施及时刻 `89`、空管流量 `81`、无延误 `00`。`dwd_ent_flight_segment` 通过左连接输出标准代码、中文大类和延误等级。

## 8. 治理后验收标准

1. 资源注册完整性：7/7 发布，部门与业务系统归属完整。
2. 延误代码采标：18 条航班未命中数为 0。
3. 动作日志服务视图：重复 `action_id` 数为 0，原始表仍保留重复证据。
4. 机组关系可信：`staffedBy` 边数大于 0，机组资源已发布。
5. 283 个机场铺底行全部保留；无当前报文机场只标记 `NO_CURRENT_REPORT`，不补造天气。

## 9. 执行入口

数据库迁移脚本：`scripts/aviation_ontology_governance.sql`。脚本为 PostgreSQL 方言，可在 `ods` 库重复运行。
