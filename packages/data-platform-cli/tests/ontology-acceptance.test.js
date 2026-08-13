const assert = require("node:assert/strict");
const test = require("node:test");

const { createOntologyAcceptanceCommands } = require("../src/commands/ontology-acceptance");
const { main } = require("../src/main");

function validContract() {
  return {
    version: "1.0.0",
    entities: [{ id: "flight", attributes: ["flight_id"] }, { id: "airport", attributes: ["airport_code"] }],
    relations: [{ id: "departs", subject: "flight", object: "airport", sourceTable: "ods_flight", sourceField: "departure_code", targetTable: "dim_airport", targetField: "airport_code", keyRole: "foreign-key", joinCondition: "flight.departure_code = airport.airport_code" }],
    rules: [{ id: "flight-has-id", kind: "constraint", expression: "flight.flight_id IS NOT NULL" }],
  };
}

test("native ontology and acceptance command facades are registered with stable names", () => {
  const commands = createOntologyAcceptanceCommands({});
  const names = new Set(commands.map((definition) => definition.command));
  for (const name of [
    "ontology contract validate", "ontology contract import", "ontology contract show", "ontology contract diff",
    "ontology lineage validate", "ontology lineage import", "ontology lineage show",
    "ontology graph export", "ontology graph verify", "ontology simulation export", "ontology simulation verify",
    "acceptance aviation-ontology preflight", "acceptance aviation-ontology run", "acceptance aviation-ontology verify", "acceptance aviation-ontology report",
    "standard field-mapping apply", "knowledge-base wait", "knowledge-base search", "reconcile project",
    "project asset import preview", "audit show",
  ]) assert.equal(names.has(name), true, `missing ${name}`);
  assert.ok(commands.every((definition) => definition.executionTargets.length > 0));
  assert.equal(commands.find((definition) => definition.command === "standard field-mapping apply").executionTargets[0].kind, "database");
});

test("ontology contract validation rejects dangling relations and returns deterministic counts", async () => {
  const commands = createOntologyAcceptanceCommands({});
  const validate = commands.find((definition) => definition.command === "ontology contract validate");
  assert.ok(validate);
  const result = await validate.handler(validContract());
  assert.deepEqual(result, { valid: true, version: "1.0.0", entities: 2, relations: 1, rules: 1 });
  await assert.rejects(
    () => validate.handler({ ...validContract(), relations: [{ ...validContract().relations[0], object: "missing" }] }),
    /dangling relation endpoint/,
  );
});

test("write-oriented native facades fail closed unless an explicit port is injected", async () => {
  const commands = createOntologyAcceptanceCommands({});
  const imported = commands.find((definition) => definition.command === "ontology contract import");
  assert.ok(imported);
  await assert.rejects(() => imported.handler(validContract()), { code: "CAPABILITY_PORT_NOT_CONFIGURED" });
});

test("installed main dispatches ontology validation locally without a profile or HTTP dependency", async () => {
  const output = [];
  const status = await main(["ontology", "contract", "validate", "--input", JSON.stringify(validContract())], {
    createCommands: () => createOntologyAcceptanceCommands({}),
    stdin: { isTTY: false },
    stdout: { isTTY: false, write(value) { output.push(String(value)); } },
    stderr: { isTTY: false, write(value) { output.push(String(value)); } },
    renderer: { success(value) { assert.equal(value.valid, true); return 0; }, error(error) { throw error; } },
  });
  assert.equal(status, 0);
  assert.deepEqual(output, []);
});
