const fs = require("node:fs");

function read(file) {
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { schemaVersion: 1, maintenance: false, workers: { scheduler: true, consumer: true, jobs: true }, facts: [], idempotencyKeys: [] };
}

function write(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(operation, file, idempotencyKey) {
  const state = read(file);
  if (operation === "upgrade-write") {
    state.schemaVersion = 2;
    if (!state.idempotencyKeys.includes(idempotencyKey)) {
      state.idempotencyKeys.push(idempotencyKey);
      state.facts.push({ id: `fact-${idempotencyKey}`, value: "stable" });
    }
  } else if (operation === "maintenance-on") state.maintenance = true;
  else if (operation === "drain") state.drained = true;
  else if (operation === "stop-workers") state.workers = { scheduler: false, consumer: false, jobs: false };
  else if (operation === "snapshot") return { schemaVersion: state.schemaVersion, factCount: state.facts.length };
  else if (operation === "maintenance-off") state.maintenance = false;
  else throw new Error(`unsupported v2 operation: ${operation}`);
  write(file, state);
  return {
    version: "0.2.0",
    maintenance: state.maintenance,
    factCount: state.facts.length,
    duplicateCount: state.facts.length - new Set(state.facts.map((fact) => fact.id)).size,
  };
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(run(process.argv[2], process.argv[3], process.argv[4]))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { moduleDefinition: Object.freeze({ moduleName: "rollback-fixture", moduleVersion: "0.2.0" }), run };
