const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "outputs");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", fileName), "utf8"));
}

test("aviation ontology knowledge assets expose the semantic layer contract", () => {
  const knowledge = readJson("aviation_ontology_knowledge_base.json");
  const lineage = readJson("aviation_ontology_field_lineage.json");

  assert.equal(knowledge.entities.length, 5);
  assert.equal(knowledge.relations.length, 3);
  assert.equal(knowledge.rules.length, 2);
  assert.ok(knowledge.terms.length >= 10);
  assert.ok(knowledge.cases.length >= 3);
  assert.equal(lineage.concepts.length, 5);
  assert.ok(lineage.fieldMappings.length >= 30);
  assert.ok(lineage.relationMappings.length >= 3);
  for (const edge of lineage.fieldMappings) {
    assert.ok(edge.conceptField);
    assert.ok(edge.source.table);
    assert.ok(edge.source.field);
    assert.ok(edge.target.view);
    assert.ok(edge.target.field);
  }
});

test("aviation ontology graph and simulation are standalone artifacts", () => {
  for (const fileName of [
    "aviation_ontology_knowledge_graph.html",
    "aviation_delay_decision_simulation.html",
  ]) {
    const filePath = path.join(OUTPUT_DIR, fileName);
    assert.ok(fs.existsSync(filePath), `${fileName} should exist`);
    const html = fs.readFileSync(filePath, "utf8");
    assert.equal(/<script\s+src=/i.test(html), false);
    assert.equal(/(?:src|href)\s*=\s*["']https?:\/\//i.test(html), false);
    assert.ok(html.includes("<script"));
  }
});
