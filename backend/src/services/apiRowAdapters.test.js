const assert = require("node:assert/strict");
const test = require("node:test");

const { adaptApiRows, resolveApiRowAdapter, resolveApiSourceConfig } = require("./apiRowAdapters");

const sampleRow = {
  flight_date: "2026-08-06",
  flight_status: "scheduled",
  departure_airport: "Guangzhou Baiyun International",
  departure_iata: "CAN",
  departure_icao: "ZGGG",
  departure_scheduled: "2026-08-06T08:00:00+00:00",
  departure_estimated: "2026-08-06T08:18:00+00:00",
  departure_actual: null,
  arrival_airport: "Shanghai Hongqiao International",
  arrival_iata: "SHA",
  arrival_icao: "ZSSS",
  arrival_scheduled: "2026-08-06T10:15:00+00:00",
  airline_name: "China Southern Airlines",
  airline_iata: "CZ",
  airline_icao: "CSN",
  flight_number: "3523",
  flight_iata: "CZ3523",
  flight_icao: "CSN3523",
  aircraft_registration: null,
};

test("Aviationstack 航班转换为统一 ods_flight_schedule 记录", () => {
  const now = new Date("2026-08-06T01:02:03.000Z");
  const [row] = adaptApiRows("aviationstack_flight_schedule", [sampleRow], now);

  assert.equal(row.record_source, "AVIATIONSTACK");
  assert.match(row.flight_segment_id, /^AS_[a-f0-9]{40}$/);
  assert.equal(row.flight_no, "CZ3523");
  assert.equal(row.dep_airport, "ZGGG");
  assert.equal(row.arr_airport, "ZSSS");
  assert.equal(row.segment_type, "DOM");
  assert.equal(row.delay_minutes, 18);
  assert.equal(row.tail_no, null);
  assert.equal(row.carrier_code, "CZ");
  assert.equal(row.source_record_id, "CZ3523|2026-08-06|CAN|SHA");
  assert.equal(row.business_key, "CZ3523|2026-08-06|ZGGG|ZSSS");
  assert.equal(row.ingested_at, now.toISOString());
  assert.deepEqual(JSON.parse(row.raw_payload), sampleRow);
});

test("缺失出发 ICAO 时固定规范化为 ZGGG，缺失到达 ICAO 时拒绝入湖", () => {
  const rows = adaptApiRows("aviationstack_flight_schedule", [
    { ...sampleRow, departure_icao: null },
    { ...sampleRow, arrival_icao: null },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].dep_airport, "ZGGG");
  assert.equal(rows[0].arr_airport, "ZSSS");
});

test("缺少航班号、航班日期或计划时刻的记录不会进入统一表", () => {
  const rows = adaptApiRows("aviationstack_flight_schedule", [
    { ...sampleRow, flight_iata: null, flight_number: null },
    { ...sampleRow, flight_date: null, departure_scheduled: null },
    { ...sampleRow, arrival_scheduled: null },
  ]);

  assert.equal(rows.length, 0);
});

test("适配器只保留南航且从广州出发的航班", () => {
  const rows = adaptApiRows("aviationstack_flight_schedule", [
    sampleRow,
    { ...sampleRow, airline_iata: "MU", flight_iata: "MU3523" },
    { ...sampleRow, departure_iata: "SZX", departure_icao: "ZGSZ" },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].flight_no, "CZ3523");
});

test("相同来源记录产生稳定主键，国际到达机场标记为 INT", () => {
  const international = {
    ...sampleRow,
    arrival_iata: "SIN",
    arrival_icao: "WSSS",
    flight_iata: "CZ3039",
    flight_number: "3039",
  };
  const first = adaptApiRows("aviationstack_flight_schedule", [international], new Date("2026-08-06T00:00:00Z"))[0];
  const second = adaptApiRows("aviationstack_flight_schedule", [international], new Date("2026-08-06T02:00:00Z"))[0];

  assert.equal(first.flight_segment_id, second.flight_segment_id);
  assert.equal(first.segment_type, "INT");
});

test("航空stack航班任务缺少 rowAdapter 时自动使用标准适配器", () => {
  assert.equal(
    resolveApiRowAdapter({ sourceType: "api", sourceTable: "/flights", targetTable: "ods_flight_schedule" }, {}),
    "aviationstack_flight_schedule"
  );
  assert.equal(
    resolveApiRowAdapter({ sourceType: "api", sourceTable: "/flights", targetTable: "ods_flight_schedule" }, { rowAdapter: "custom" }),
    "custom"
  );
});

test("航空stack南航广州任务自动注入南航和广州出港查询参数", () => {
  const sourceConfig = resolveApiSourceConfig(
    { sourceType: "api", sourceTable: "/flights", targetTable: "ods_flight_schedule" },
    { endpointPath: "/flights", queryParams: [] }
  );

  assert.equal(sourceConfig.rowAdapter, "aviationstack_flight_schedule");
  assert.deepEqual(sourceConfig.queryParams, [
    { name: "airline_iata", value: "CZ" },
    { name: "dep_iata", value: "CAN" },
  ]);
});
