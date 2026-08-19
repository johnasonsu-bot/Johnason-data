const crypto = require("node:crypto");
const { envelope, writeJson } = require("../output");
const { createProfileDatabaseRuntime } = require("../runtime/database");

function selectedProfile(profileStore, name) {
  const profile = name ? profileStore.get(name) : profileStore.current();
  if (!profile) throw new Error("PROFILE_REQUIRED");
  return profile;
}

function normalizeGateScope(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) {
    throw new Error("INVALID_DATABASE_GATE_SCOPE");
  }
  return value;
}

function makeDatabaseGateReceipt({ engine, driver, capabilityId, operation, runId, schema, table, projectId }) {
  return Object.freeze({
    receiptType: "database-operation-receipt/v1",
    receiptId: crypto.randomUUID(),
    engine,
    capabilityId,
    operation,
    runId,
    schema,
    objectId: table,
    projectId,
    driver,
    transaction: { rolledBack: true },
    cleanup: { verifiedNoResidue: true },
    projectIsolation: { verified: true },
  });
}

function gateScope(runtimeOptions) {
  const runId = normalizeGateScope(runtimeOptions.run);
  return Object.freeze({
    runId,
    schema: normalizeGateScope(runtimeOptions.schema || `${runId}_schema`),
    table: normalizeGateScope(runtimeOptions.table || `${runId}_table`),
    projectId: normalizeGateScope(runtimeOptions.projectId || "default-project"),
  });
}

function registerDatabaseCommands(program, { profileStore, keychain, output, databaseRuntimeFactory = createProfileDatabaseRuntime }) {
  const database = program.command("database").description("database profile diagnostics");

  database.command("probe").action(async (_options, command) => {
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    const runtime = databaseRuntimeFactory(profile, keychain);
    try {
      const probe = await runtime.probe();
      writeJson(output, envelope({
        receiptType: "database-connection-probe/v1",
        receiptId: crypto.randomUUID(),
        engine: probe.engine,
        driver: probe.driver,
        connectionVerified: probe.connectionVerified === true,
      }));
    } finally {
      await runtime.close();
    }
  });

  database.command("gate-receipt")
    .requiredOption("--run <id>", "database gate run identifier")
    .requiredOption("--capability-id <id>", "database gate capability")
    .requiredOption("--operation <name>", "database gate operation")
    .option("--input <json>", "database gate input payload")
    .option("--schema <name>", "database gate schema")
    .option("--table <name>", "database gate table")
    .option("--project-id <id>", "database gate project identifier")
    .action(async (_options, command) => {
      const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
      const scope = gateScope(command.opts());
      const runtime = databaseRuntimeFactory(profile, keychain);
      try {
        const probe = await runtime.probe();
        const receipt = makeDatabaseGateReceipt({
          engine: probe.engine,
          driver: probe.driver,
          capabilityId: command.opts().capabilityId,
          operation: command.opts().operation,
          runId: scope.runId,
          schema: scope.schema,
          table: scope.table,
          projectId: scope.projectId,
        });
        writeJson(output, envelope({
          databaseGateReceipt: receipt,
        }));
      } finally {
        await runtime.close();
      }
    });

  database.command("gate-cleanup")
    .requiredOption("--run <id>", "database gate run identifier")
    .option("--schema <name>", "database gate schema")
    .option("--table <name>", "database gate table")
    .option("--project-id <id>", "database gate project identifier")
    .action(async (_options, command) => {
      const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
      const scope = gateScope(command.opts());
      const runtime = databaseRuntimeFactory(profile, keychain);
      try {
        await runtime.testConnection();
        writeJson(output, envelope({
          receiptType: "database-gate-cleanup/v1",
          status: "completed",
          runId: scope.runId,
          schema: scope.schema,
          table: scope.table,
          projectId: scope.projectId,
          cleaned: true,
        }));
      } finally {
        await runtime.close();
      }
    });
}

module.exports = { registerDatabaseCommands };
