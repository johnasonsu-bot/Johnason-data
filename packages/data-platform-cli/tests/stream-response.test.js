const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const { createResponse } = require("@johnason/data-platform-module-system-knowledge-base/src/runtime");

test("generated CLI response is a real Writable and collects piped content", async () => {
  const response = createResponse();
  response.setHeader("Content-Type", "text/plain");
  const finished = new Promise((resolve, reject) => {
    response.once("finish", resolve);
    response.once("error", reject);
  });
  Readable.from(["flight", "-data"]).pipe(response);
  await finished;
  assert.equal(response.headers["content-type"], "text/plain");
  assert.equal(response.payload.toString("utf8"), "flight-data");
});

test("generated CLI response keeps download paths for --output handling", async () => {
  const response = createResponse();
  const payload = response.download("/tmp/report.csv", "report.csv");
  assert.deepEqual(payload, { path: "/tmp/report.csv", filename: "report.csv" });
  assert.deepEqual(response.payload, payload);
});
