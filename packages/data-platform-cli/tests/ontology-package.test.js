const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const XLSX = require("xlsx");

const {
  inspectOntologyPackage,
  readOntologyPackage,
} = require("../src/commands/ontology-package");

const COMMON = {
  action: "VALIDATE",
  natural_key: "",
  depends_on: "",
  enabled: "TRUE",
  source_system: "SOURCE_ONLY",
  source_ref: "fixture",
  payload_version: "1.0.0",
  notes: "fixture",
};

function workbookFile(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ontology-package-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "package.xlsx");
  const workbook = XLSX.utils.book_new();
  const sheets = {
    "01_\u5bfc\u5165\u987a\u5e8f": [{ ...COMMON, step_code: "S01", natural_key: "step:S01" }],
    "02_\u73af\u5883\u53d8\u91cf": [{ ...COMMON, variable_name: "AVIATION_PROJECT_CODE", required: "TRUE", natural_key: "env:AVIATION_PROJECT_CODE" }],
    "10_\u6570\u636e\u6e90": [{ ...COMMON, source_code: "AVIATION_ODS_PG", natural_key: "source:AVIATION_ODS_PG" }],
    "50_PG\u7269\u7406\u8868": [{ ...COMMON, table_name: "ods_flight_schedule", natural_key: "pg:ods.ods_flight_schedule" }],
    "52_PG\u94fa\u5e95\u6570\u636e": [{ ...COMMON, table_name: "ods_flight_schedule", seed_status: "SOURCE_ONLY", action: "LOAD_SOURCE_DATA", natural_key: "seed:flight", depends_on: "pg:ods.ods_flight_schedule" }],
    "90_CLI\u6620\u5c04": [
      { ...COMMON, sheet_name: "10_\u6570\u636e\u6e90", natural_key: "cli:10_\u6570\u636e\u6e90" },
      { ...COMMON, sheet_name: "50_PG\u7269\u7406\u8868", natural_key: "cli:50_PG\u7269\u7406\u8868" },
      { ...COMMON, sheet_name: "52_PG\u94fa\u5e95\u6570\u636e", natural_key: "cli:52_PG\u94fa\u5e95\u6570\u636e" },
    ],
    ...overrides,
  };
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  }
  XLSX.writeFile(workbook, file);
  return file;
}

test("ontology package inspection distinguishes valid rows from missing source baselines", (t) => {
  const inspection = inspectOntologyPackage(readOntologyPackage(workbookFile(t)), {
    environment: { AVIATION_PROJECT_CODE: "aviation_cli" },
  });
  assert.equal(inspection.valid, true);
  assert.equal(inspection.ready, false);
  assert.equal(inspection.enabledRows, 8);
  assert.equal(inspection.sourceOnlyBlockers.length, 1);
  assert.deepEqual(inspection.unresolvedRequiredVariables, []);
});

test("ontology package validation rejects duplicate natural keys and dangling dependencies", (t) => {
  const file = workbookFile(t, {
    "10_\u6570\u636e\u6e90": [
      { ...COMMON, natural_key: "duplicate" },
      { ...COMMON, natural_key: "duplicate", depends_on: "missing:key" },
    ],
  });
  const inspection = inspectOntologyPackage(readOntologyPackage(file), { environment: { AVIATION_PROJECT_CODE: "aviation_cli" } });
  assert.equal(inspection.valid, false);
  assert.match(inspection.errors.join("\n"), /Duplicate natural key/);
  assert.match(inspection.errors.join("\n"), /Dangling dependency/);
});

test("ontology package reports required environment names without exposing values", (t) => {
  const inspection = inspectOntologyPackage(readOntologyPackage(workbookFile(t)), { environment: {} });
  assert.deepEqual(inspection.unresolvedRequiredVariables, ["AVIATION_PROJECT_CODE"]);
  assert.doesNotMatch(JSON.stringify(inspection), /password|token|secret/i);
});
