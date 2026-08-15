const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeReportTableColumns,
  resolveRuntimeDashboardPreviewPayload,
} = require("./reporting.service");

test("published runtime preview inherits a dashboard dataset for unbound KPI widgets", () => {
  const resolved = resolveRuntimeDashboardPreviewPayload({
    widgets: [
      { widgetKey: "delay-kpi", widgetType: "kpi", datasetId: null },
      { widgetKey: "delay-table", widgetType: "table", datasetId: 14 },
    ],
  }, { widgetKey: "delay-kpi", widgetType: "kpi" });
  assert.equal(resolved.datasetId, 14);
});

test("runtime table columns normalize legacy string bindings into full data-index objects", () => {
  const columns = normalizeReportTableColumns(["flight_no", "weather_phenomenon"]);
  assert.deepEqual(columns, [
    { key: "flight_no", title: "flight_no", dataIndex: "flight_no" },
    { key: "weather_phenomenon", title: "weather_phenomenon", dataIndex: "weather_phenomenon" },
  ]);
});
