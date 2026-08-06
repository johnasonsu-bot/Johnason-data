# Aviationstack 南航广州出港航班接入设计

## 目标

在项目 7 的航空 Demo 中完善 Aviationstack API 数据源，固定抓取中国南方航空从广州白云机场出发、到达机场不限的实时航班，并直接写入统一航班计划湖表 `ods_flight_schedule`。

API 请求固定使用：

- 接口：`GET /v1/flights`；
- 航空公司过滤：`airline_iata=CZ`；
- 出发机场过滤：`dep_iata=CAN`；
- 单次条数：`limit=100`；
- 起始偏移：`offset=0`；
- 单次运行最多一页，避免测试阶段超出 API 调用额度。

API Key 仅进入本地运行时数据源密钥配置，不写入 Git 文件、SQL、Markdown、日志或错误信息。

## 统一航班湖表

`ods_flight_schedule` 同时接收手工录入和 Aviationstack API 两类来源。现有业务字段继续作为统一接入标准，并增加来源审计字段：

| 字段 | 含义 |
| --- | --- |
| `record_source` | `MANUAL` 或 `AVIATIONSTACK` |
| `source_record_id` | 来源系统稳定记录标识 |
| `business_key` | 跨来源业务唯一键 |
| `source_updated_at` | 来源记录更新时间 |
| `ingested_at` | 平台接入时间 |
| `raw_payload` | API 原始记录 JSON；手工数据为空 |

业务键由承运人代码、航班号、航班日期、出发机场、到达机场和计划起飞时间组成。来源主键策略：

- 手工数据继续保留现有 `FS...` 主键；
- Aviationstack 数据使用 `AS_{航班日期}_{航班IATA}_{计划起飞时间哈希}`；
- API 运行按 `flight_segment_id` upsert，只更新同一 Aviationstack 记录；
- 手工记录与 API 记录互不覆盖，通过 `business_key` 识别跨来源重复。

对于 API 可能缺失的机尾号、实际起飞时间和延误原因，目标字段允许为空，不使用空字符串伪造业务值。

## 字段映射与派生

| Aviationstack 字段 | `ods_flight_schedule` 字段 |
| --- | --- |
| `flight.iata` | `flight_no` |
| `departure.icao` | `dep_airport` |
| `arrival.icao` | `arr_airport` |
| `departure.scheduled` | `std` |
| `arrival.scheduled` | `sta` |
| `departure.actual` | `atd` |
| `flight_status` | `flight_status` |
| `airline.iata` | `carrier_code` |
| `aircraft.registration` | `tail_no` |

派生规则：

- 到达机场 ICAO 属于中国大陆时 `segment_type=DOM`，否则为 `INT`；
- `delay_minutes` 根据实际/预计起飞时间与计划起飞时间计算，最小为 0；
- API 原始记录保留在 `raw_payload`，便于审计和重新映射；
- `record_source` 固定为 `AVIATIONSTACK`，手工存量回填为 `MANUAL`。

## 数据质量规则

新增并执行以下规则：

1. `business_key`、航班号、承运人、出发机场、到达机场和计划起飞时间非空；
2. Aviationstack 来源必须满足 `carrier_code=CZ`；
3. Aviationstack 来源必须满足 `dep_airport=ZGGG`；
4. 计划到达时间不得早于计划起飞时间；
5. 延误分钟不得小于 0；
6. 同一 `business_key` 存在多来源记录时标记为待融合，不删除原始记录。

## 平台运行配置

- 完善现有 `aviationstack` API 数据源；
- 创建并启用“南航广州出港实时航班”接入任务；
- 响应记录路径使用 `data`；
- 分页使用 offset/limit，但测试任务限制为一页；
- 目标源使用航空 Demo PostgreSQL 数据源；
- 写入模式为 upsert，键字段为 `flight_segment_id`；
- 运行日志仅保留脱敏请求信息、状态码、耗时、读取数和写入数。

## 验收

1. Aviationstack 数据源连接和任务预检通过；
2. 实际运行请求只包含南航与广州出发过滤条件；
3. `ods_flight_schedule` 同时保留 `MANUAL` 和 `AVIATIONSTACK` 来源；
4. 重复运行不会重复插入同一 API 航班；
5. 手工数据不会被 API 运行覆盖；
6. API Key 不出现在 Git 差异、运行日志或错误摘要中；
7. 相关表结构、语义层和治理 SQL 同步更新。
