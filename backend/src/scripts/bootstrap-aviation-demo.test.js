const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildAviationStandardSpecs,
  buildAviationLogicalModel,
  buildAviationReportDataset,
  buildAviationWeatherAdjustmentDataset,
  buildAviationReportWidgetSpecs,
} = require("./bootstrap-aviation-demo");

test("航空标准种子覆盖本体字段并保留业务唯一键语义", () => {
  const specs = buildAviationStandardSpecs();
  assert.ok(specs.length >= 40);
  assert.ok(specs.some((item) => item.elementIdentifier === "AVIATION.FLIGHT.FLIGHT_SEGMENT_ID"));
  assert.ok(specs.some((item) => item.elementIdentifier === "AVIATION.FLIGHT.BUSINESS_KEY"));
  assert.ok(specs.every((item) => item.elementCode.startsWith("HB")));
});

test("逻辑模型由字段血缘和 ER 关系生成", () => {
  const model = buildAviationLogicalModel();
  assert.equal(model.tables.length, 5);
  assert.equal(model.relations.length, 3);
  assert.ok(model.tables.find((table) => table.tableName === "FlightSegment").keyInfoItems.some((item) => item.keyType === "PRIMARY_KEY"));
  assert.ok(model.relations.some((relation) => relation.fromField === "tail_no" && relation.toField === "tail_no"));
});

test("天气影响延误数据集使用真实 CODA 连接并保留可执行的指标", () => {
  const dataset = buildAviationReportDataset();
  assert.equal(dataset.datasetType, "sql");
  assert.match(dataset.sourceSql, /ods_flight_schedule/i);
  assert.match(dataset.sourceSql, /ods_weather_metar/i);
  assert.match(dataset.sourceSql, /d\.raw_code\s*=\s*COALESCE\(f\.delay_code_raw/i);
  assert.doesNotMatch(dataset.sourceSql, /d\.coda_code\s*=\s*COALESCE\(f\.delay_code_raw/i);
  assert.match(dataset.sourceSql, /severity_level\s*=\s*'SEVERE'/i);
  assert.match(dataset.sourceSql, /NULLIF\(f\.delay_minutes::text, ''\)::numeric/i);
  assert.ok(dataset.fields.some((field) => field.columnName === "delay_minutes" && field.role === "metric"));
  assert.ok(dataset.fields.some((field) => field.columnName === "delay_category" && field.role === "category"));
  assert.ok(dataset.fields.some((field) => field.columnName === "weather_affected_flight_count" && field.role === "metric"));
});

test("天气处置明细数据集返回受影响航班的全字段和处置建议", () => {
  const dataset = buildAviationWeatherAdjustmentDataset();
  assert.equal(dataset.datasetType, "sql");
  for (const columnName of [
    "flight_segment_id", "flight_no", "dep_airport", "arr_airport", "std", "sta", "atd",
    "flight_status", "delay_code_raw", "delay_minutes", "tail_no", "carrier_code",
    "weather_airport_icao", "weather_observe_time", "weather_phenomenon", "visibility_m",
    "wind_gust_kt", "severity_level", "runway_id", "available_capacity", "restriction_reason",
    "adjustment_type", "recommended_action",
  ]) {
    assert.ok(dataset.fields.some((field) => field.columnName === columnName), `missing field ${columnName}`);
  }
  assert.match(dataset.sourceSql, /WHERE\s+w\.severity_level\s*=\s*'SEVERE'/i);
  assert.match(dataset.sourceSql, /NULLIF\(r\.available_capacity::text, ''\)::numeric/i);
  assert.match(dataset.sourceSql, /recommended_action/i);
});

test("航空报表 KPI 和全字段明细部件都绑定到对应数据集", () => {
  const widgets = buildAviationReportWidgetSpecs({ summaryDatasetId: 14, detailDatasetId: 15, chartIds: [39, 40] });
  const kpi = widgets.find((item) => item[0] === "delay-kpi");
  const table = widgets.find((item) => item[0] === "decision-table");
  assert.equal(kpi[4], 14);
  assert.equal(table[4], 15);
  assert.ok(Array.isArray(table[6].columns));
  assert.ok(table[6].columns.every((column) => typeof column === "object" && column.dataIndex));
  assert.equal(table[6].columns.some((column) => column.dataIndex === "recommended_action"), true);
});
