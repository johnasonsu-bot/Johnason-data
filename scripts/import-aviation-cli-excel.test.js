const assert = require("node:assert/strict");
const test = require("node:test");

const {
  fieldSql,
  qualifyAviationSql,
  seedSql,
  sqlIdentifier,
  tableSql,
  viewSql,
} = require("./import-aviation-cli-excel");

test("builds idempotent PostgreSQL table DDL from workbook fields and natural keys", () => {
  const sql = tableSql({
    table_name: "ods_weather_metar",
    object_type: "ODS",
    natural_key_columns: "airport_icao#observe_time",
  }, [
    { column_name: "airport_icao", data_type: "text", nullable: "FALSE" },
    { column_name: "airport_icao", data_type: "text", nullable: "TRUE" },
    { column_name: "observe_time", data_type: "timestamp", nullable: "FALSE" },
    { column_name: "visibility_m", data_type: "numeric", nullable: "TRUE" },
  ]);

  assert.match(sql, /CREATE TABLE IF NOT EXISTS ods\."ods_weather_metar"/);
  assert.match(sql, /"airport_icao" text NOT NULL/);
  assert.match(sql, /PRIMARY KEY \("airport_icao", "observe_time"\)/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "visibility_m" numeric/);
  assert.equal((sql.match(/"airport_icao" text NOT NULL/g) || []).length, 1);
});

test("maps READY seed payloads to conflict-safe SQL", () => {
  const dictionary = seedSql({
    table_name: "dim_delay_code_coda",
    table_natural_key: "raw_code=WX",
    natural_key: "seed:CODA:WX",
    seed_payload_json: JSON.stringify({ raw_code: "WX", coda_code: "71", category_cn: "天气" }),
  });
  assert.match(dictionary, /ON CONFLICT \("raw_code"\) DO UPDATE SET/);
  assert.match(dictionary, /'天气'/);

  const quality = seedSql({
    table_name: "meta_quality_rule",
    table_natural_key: "rule_code=Q001",
    natural_key: "seed:QUALITY:Q001",
    seed_payload_json: JSON.stringify({ id: "Q001", field: "a.b", check: "value = 'ok'", severity: "HIGH" }),
  });
  assert.match(quality, /"rule_code"/);
  assert.match(quality, /'value = ''ok'''/);
});

test("qualifies aviation SQL and rejects unsafe identifiers", () => {
  assert.equal(
    qualifyAviationSql("SELECT * FROM ods_flight_schedule JOIN dim_delay_code_coda USING (coda_code)"),
    "SELECT * FROM ods.ods_flight_schedule JOIN ods.dim_delay_code_coda USING (coda_code)",
  );
  assert.throws(() => sqlIdentifier("ods.table"), /Unsafe SQL identifier/);
  assert.match(fieldSql({ table_name: "ods_flight_schedule", column_name: "std", data_type: "timestamp" }), /ADD COLUMN IF NOT EXISTS "std" timestamp/);
  assert.match(viewSql("dwd_ent_flight_segment"), /CREATE OR REPLACE VIEW ods\."dwd_ent_flight_segment"/);
});
