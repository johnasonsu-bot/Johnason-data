const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeApiSourceConfig, sanitizeRequestInfo } = require("./apiIngestionService");

test("运行日志脱敏 Aviationstack access_key 查询参数和请求头", () => {
  const safe = sanitizeRequestInfo({
    url: "https://example.test/flights?access_key=sensitive-value&dep_iata=CAN",
    method: "GET",
    headers: { access_key: "sensitive-value", Accept: "application/json" },
  });

  assert.doesNotMatch(JSON.stringify(safe), /sensitive-value/);
  assert.match(safe.url, /access_key=\*\*\*\*\*\*/);
  assert.equal(safe.headers.access_key, "******");
});

test("API 任务标准化时保留受控行适配器编码", () => {
  const config = normalizeApiSourceConfig({
    endpointPath: "/flights",
    rowAdapter: "aviationstack_flight_schedule",
  });

  assert.equal(config.rowAdapter, "aviationstack_flight_schedule");
});
