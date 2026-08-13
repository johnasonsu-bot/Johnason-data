const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { readDocumentText } = require("./system-knowledge-base.service");

test("reads browser-previewable HTML and SQL as source text", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-source-text-"));
  const htmlPath = path.join(directory, "decision.html");
  const sqlPath = path.join(directory, "lineage.sql");
  fs.writeFileSync(htmlPath, "<!doctype html><title>Aviation Decision</title>");
  fs.writeFileSync(sqlPath, "select * from ods_flight_schedule;");

  assert.match(await readDocumentText(htmlPath, "html"), /Aviation Decision/);
  assert.equal(await readDocumentText(sqlPath, "sql"), "select * from ods_flight_schedule;");
});
