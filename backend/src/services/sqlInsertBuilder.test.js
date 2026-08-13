const assert = require("node:assert/strict");
const test = require("node:test");

const { buildConflictClause, deduplicateRowsByKeys } = require("./sqlInsertBuilder");

test("PostgreSQL upsert 使用配置主键并更新非主键字段", () => {
  const sql = buildConflictClause(
    "postgresql",
    ["flight_segment_id", "flight_no", "updated_at"],
    { writeMode: "upsert", keyFields: ["flight_segment_id"] },
  );

  assert.equal(
    sql,
    ' ON CONFLICT ("flight_segment_id") DO UPDATE SET "flight_no" = EXCLUDED."flight_no", "updated_at" = EXCLUDED."updated_at"',
  );
});

test("普通追加写入不生成冲突子句", () => {
  assert.equal(buildConflictClause("postgresql", ["id"], { writeMode: "append" }), "");
});

test("同批 upsert 重复键仅保留来源更新时间最新的记录", () => {
  const rows = deduplicateRowsByKeys([
    { id: "A", status: "scheduled", source_updated_at: "2026-08-06T01:00:00Z" },
    { id: "B", status: "active", source_updated_at: "2026-08-06T01:30:00Z" },
    { id: "A", status: "active", source_updated_at: "2026-08-06T02:00:00Z" },
  ], ["id"]);

  assert.deepEqual(rows, [
    { id: "A", status: "active", source_updated_at: "2026-08-06T02:00:00Z" },
    { id: "B", status: "active", source_updated_at: "2026-08-06T01:30:00Z" },
  ]);
});
