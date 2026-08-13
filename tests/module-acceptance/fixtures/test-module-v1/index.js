const fs = require("node:fs");

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(operation, file) {
  const state = read(file);
  if (state.schemaVersion < 1 || !Array.isArray(state.facts)) throw new Error("incompatible upgraded schema");
  if (operation === "verify-rollback") {
    const expected = state.facts.find((fact) => fact.id === "fact-command-1" && fact.value === "stable");
    if (state.schemaVersion !== 2 || state.facts.length !== 1 || !expected) throw new Error("candidate fact missing");
    return { version: "0.1.0", schemaVersion: 2, factCount: 1, factId: expected.id };
  }
  if (operation === "maintenance-off") {
    state.maintenance = false;
    write(file, state);
    return { maintenance: false };
  }
  throw new Error(`unsupported v1 operation: ${operation}`);
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(run(process.argv[2], process.argv[3]))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { moduleDefinition: Object.freeze({ moduleName: "rollback-fixture", moduleVersion: "0.1.0" }), run };
