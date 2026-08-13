const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildAviationStandardSpecs,
  buildAviationLogicalModel,
  buildAviationReportDataset,
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

test("延误分析数据集包含可执行的查询字段", () => {
  const dataset = buildAviationReportDataset();
  assert.equal(dataset.datasetType, "sql");
  assert.match(dataset.sourceSql, /ods_flight_schedule/i);
  assert.ok(dataset.fields.some((field) => field.columnName === "delay_minutes" && field.role === "metric"));
  assert.ok(dataset.fields.some((field) => field.columnName === "delay_category" && field.role === "category"));
});
