const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeTargetTableMode } = require("./ingestion-task.service");

test("legacy target table mode defaults to existing", () => {
  assert.equal(normalizeTargetTableMode(undefined), "existing");
  assert.equal(normalizeTargetTableMode("existing"), "existing");
});

test("target table mode only enables schema sync when explicitly create", () => {
  assert.equal(normalizeTargetTableMode("create"), "create");
  assert.equal(normalizeTargetTableMode("unexpected"), "existing");
  assert.equal(normalizeTargetTableMode(undefined, "create"), "create");
});
