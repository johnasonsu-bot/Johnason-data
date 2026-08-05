const test = require("node:test");
const assert = require("node:assert/strict");
const { isPendingProcessingSourceTable } = require("./data-development.utils");

test("processing draft source table placeholder is recognized", () => {
  assert.equal(isPendingProcessingSourceTable("__pending_source_table__1785146435514"), true);
  assert.equal(isPendingProcessingSourceTable("ods_customer_order"), false);
  assert.equal(isPendingProcessingSourceTable(null), false);
});
