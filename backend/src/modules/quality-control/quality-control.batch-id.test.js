const test = require("node:test");
const assert = require("node:assert/strict");
const { buildQualityBatchId } = require("./quality-control.batch-id");

test("quality batch id uses readable time and task identifier", () => {
  const runAt = new Date(2026, 7, 2, 17, 47, 54, 766);
  assert.equal(buildQualityBatchId(502, runAt), "QC_20260802_174754766_T502");
});

test("quality batch id rejects invalid task identifiers", () => {
  assert.throws(() => buildQualityBatchId(0), /positive integer/);
});
