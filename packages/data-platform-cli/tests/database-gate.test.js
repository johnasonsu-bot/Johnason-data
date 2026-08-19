const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { baseline, engines, databaseCapabilityIds } = require("./gate-harness");
const { createCapabilityCatalog } = require("@johnason/data-platform-core");
const { createDomainCommands } = require("../src/registry/domain-commands");
const { verifyCurrentPackedInstall } = require("./packed-cli-provenance");

const contractsDirectory = path.join(__dirname, "fixtures", "database-contracts");
const profileByEngine = Object.freeze({
  mysql: "test-mysql",
  postgresql: "test-postgresql",
  oracle: "test-oracle",
  dm: "test-dm",
});
const requiredOperationsByEngine = Object.freeze({
  mysql: Object.freeze(["crud", "query", "transaction", "projectIsolation", "durableRuntime"]),
  postgresql: Object.freeze(["ods", "datax", "jdbc", "schema", "dialect", "rollback", "aviationExceptionalValues"]),
  oracle: Object.freeze(["serviceOrSid", "schema", "binds", "pagination", "rollback"]),
  dm: Object.freeze(["jdbc", "schema", "binds", "pagination", "rollback"]),
});
const operationReceiptType = "database-operation-receipt/v1";
const connectionReceiptType = "database-connection-probe/v1";

function readDatabaseContract(engine) {
  if (!engines.includes(engine)) throw new TypeError(`Unsupported database gate engine: ${engine}`);
  return JSON.parse(fs.readFileSync(path.join(contractsDirectory, `${engine}.json`), "utf8"));
}

function sensitiveValue(value) {
  if (typeof value === "string") return /password|secret|token|authorization|credential/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => /password|secret|token|authorization|credential/i.test(key) || sensitiveValue(child));
}

function safeCaseArgument(argument) {
  return typeof argument === "string"
    && !sensitiveValue(argument)
    && !["--profile", "--json", "--ndjson", "--password-stdin", "--secrets-stdin"].includes(argument);
}

function commandDefinition(capabilityId) {
  return createDomainCommands(createCapabilityCatalog()).find((definition) => definition.capabilityIds.includes(capabilityId));
}

function validateContract(engine, contract, expected) {
  const failures = [];
  if (!contract || contract.engine !== engine) failures.push("contract engine does not match selected engine");
  if (contract?.profile !== profileByEngine[engine]) failures.push(`contract must use only ${profileByEngine[engine]}`);
  if (contract?.mock === true || contract?.adapter === "mock") failures.push("mock database contracts are forbidden");
  if (!Array.isArray(contract?.cases)) failures.push("contract cases must be an array");
  const cases = new Map();
  for (const entry of contract?.cases || []) {
    if (!expected.includes(entry?.capabilityId)) {
      failures.push(`unknown command case: ${entry?.capabilityId || "missing capabilityId"}`);
      continue;
    }
    if (cases.has(entry.capabilityId)) {
      failures.push(`duplicate command case: ${entry.capabilityId}`);
      continue;
    }
    if (entry.mock === true || entry.adapter === "mock") failures.push(`${entry.capabilityId}: mock command cases are forbidden`);
    if (!Array.isArray(entry.args) || entry.args.some((argument) => !safeCaseArgument(argument))) {
      failures.push(`${entry.capabilityId}: command arguments may not contain credentials or override gate options`);
    }
    if (entry.input !== undefined && sensitiveValue(entry.input)) {
      failures.push(`${entry.capabilityId}: command input may not contain credentials`);
    }
    cases.set(entry.capabilityId, entry);
  }
  const missing = expected.filter((capabilityId) => !cases.has(capabilityId));
  return { failures, cases, missing };
}

function profileConnectivity(installed, contract, spawn, env) {
  const result = spawn(installed.binary, ["--json", "--profile", contract.profile, "database", "probe"], {
    encoding: "utf8",
    timeout: Number(env.CLI_DATABASE_GATE_TIMEOUT_MS || 120000),
  });
  if (result.error || result.status !== 0) return { status: "blocked", reason: `installed CLI could not obtain an OS-keychain connection receipt for ${contract.profile}` };
  try {
    const receipt = JSON.parse(result.stdout)?.data;
    if (receipt?.receiptType !== connectionReceiptType || receipt.engine !== contract.engine || receipt.connectionVerified !== true
      || typeof receipt.receiptId !== "string" || !receipt.driver?.name || !receipt.driver?.version || receipt.driver.version === "unknown"
      || receipt.driver.fingerprint !== `${receipt.driver.name}@${receipt.driver.version}`) {
      throw new Error("invalid receipt");
    }
    return { status: "connected", receipt };
  } catch {
    return { status: "blocked", reason: `installed CLI returned an invalid connection receipt for ${contract.profile}` };
  }
}

function createRunScope(engine) {
  const runId = `dbgate_${engine}_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return Object.freeze({ runId, schema: `${runId}_schema`, table: `${runId}_table`, projectId: `${runId}_project` });
}

function operationReceipt(envelope, engine, scope, capabilityId) {
  const receipt = envelope?.data?.databaseGateReceipt;
  if (receipt?.receiptType !== operationReceiptType || receipt.engine !== engine || receipt.capabilityId !== capabilityId) return null;
  if (!requiredOperationsByEngine[engine].includes(receipt.operation) || receipt.runId !== scope.runId) return null;
  if (receipt.objectId !== scope.table || receipt.schema !== scope.schema || receipt.projectId !== scope.projectId) return null;
  if (receipt.transaction?.rolledBack !== true || receipt.cleanup?.verifiedNoResidue !== true || receipt.projectIsolation?.verified !== true) return null;
  if (!receipt.driver?.name || !receipt.driver?.version || receipt.driver.version === "unknown" || receipt.driver.fingerprint !== `${receipt.driver.name}@${receipt.driver.version}`) return null;
  return receipt;
}

function commandArguments(definition, capabilityId, contract, entry) {
  const argv = ["--json", "--profile", contract.profile, ...definition.command.split(" ")];
  if (definition.capabilityIds.length > 1) {
    const index = definition.capabilityIds.indexOf(capabilityId);
    const apiKey = definition.sourceApiKeys[index];
    if (!apiKey) throw new Error("command cannot select the classified capability");
    argv.push("--api-key", apiKey);
  }
  if (entry.input !== undefined) argv.push("--input", JSON.stringify(entry.input));
  argv.push(...entry.args);
  return argv;
}

function gateReceiptArguments(selected, scope, capabilityId, entry, operation) {
  const argv = [
    "--json",
    "--profile",
    profileByEngine[selected],
    "database",
    "gate-receipt",
    "--run",
    scope.runId,
    "--schema",
    scope.schema,
    "--table",
    scope.table,
    "--project-id",
    scope.projectId,
    "--capability-id",
    capabilityId,
    "--operation",
    operation,
  ];
  if (entry.input !== undefined) argv.push("--input", JSON.stringify(entry.input));
  return argv;
}

async function runDatabaseGate({ engine, env = process.env, spawn = spawnSync } = {}) {
  const selected = engine || env.CLI_DATABASE_ENGINE;
  if (!engines.includes(selected)) return { status: "blocked", failures: ["CLI_DATABASE_ENGINE must select mysql, postgresql, oracle, or dm"] };
  const expected = databaseCapabilityIds(selected);
  const contract = readDatabaseContract(selected);
  const preflight = validateContract(selected, contract, expected);
  const failures = [...preflight.failures];
  if (preflight.missing.length) {
    failures.push(`command cases are missing for ${preflight.missing.length}/${expected.length} classified capabilities (first: ${preflight.missing.slice(0, 3).join(", ")})`);
  }

  let installed;
  try {
    installed = verifyCurrentPackedInstall();
  } catch (error) {
    return { status: "failed", failures: [error.message], tested: 0, expected: expected.length };
  }
  const connectivity = profileConnectivity(installed, contract, spawn, env);
  if (connectivity.status !== "connected") failures.push(connectivity.reason);
  const receiptDefinition = createDomainCommands(createCapabilityCatalog()).find((definition) => definition.command === "database gate-receipt");
  if (!receiptDefinition) {
    failures.push(`installed CLI has no safe ${operationReceiptType} command for isolated schema/table, rollback, project isolation, and cleanup verification`);
  }
  if (failures.length) return { status: "blocked", failures, tested: 0, expected: expected.length, connectivity: connectivity.status, passedCapabilityIds: new Set() };

  const scope = createRunScope(selected);
  const commandFailures = [];
  const passedCapabilityIds = new Set();
  const coveredOperations = new Set();
  let operationIndex = 0;
  try {
    for (const capabilityId of expected) {
      const entry = preflight.cases.get(capabilityId);
      const definition = commandDefinition(capabilityId);
      if (!definition) {
        commandFailures.push(`${capabilityId}: registry command definition is missing`);
        continue;
      }
      let argv;
      try {
        const operation = requiredOperationsByEngine[selected][operationIndex % requiredOperationsByEngine[selected].length];
        operationIndex += 1;
        argv = gateReceiptArguments(selected, scope, capabilityId, entry, operation);
      } catch (error) {
        commandFailures.push(`${capabilityId}: ${error.message}`);
        continue;
      }
      const result = spawn(installed.binary, argv, { encoding: "utf8", timeout: Number(env.CLI_DATABASE_GATE_TIMEOUT_MS || 120000) });
      if (result.error || result.status !== 0) {
        commandFailures.push(`${capabilityId}: installed CLI command did not produce a fixed operation receipt`);
        continue;
      }
      const receipt = operationReceipt(JSON.parse(result.stdout), selected, scope, capabilityId);
      if (!receipt) {
        commandFailures.push(`${capabilityId}: installed CLI did not return the required fixed operation receipt`);
        continue;
      }
      coveredOperations.add(receipt.operation);
      passedCapabilityIds.add(capabilityId);
    }
  } finally {
    const cleanup = spawn(installed.binary, ["--json", "--profile", contract.profile, "database", "gate-cleanup", "--run", scope.runId, "--schema", scope.schema, "--table", scope.table, "--project-id", scope.projectId], { encoding: "utf8", timeout: Number(env.CLI_DATABASE_GATE_TIMEOUT_MS || 120000) });
    if (cleanup.error || cleanup.status !== 0) commandFailures.push("installed CLI cleanup failed");
  }
  for (const operation of requiredOperationsByEngine[selected]) {
    if (!coveredOperations.has(operation)) commandFailures.push(`missing fixed ${operation} operation receipt`);
  }
  return { status: commandFailures.length ? "failed" : "accepted", failures: commandFailures, tested: passedCapabilityIds.size, expected: expected.length, connectivity: connectivity.status, passedCapabilityIds };
}

test("database gate enumerates every engine-classified capability", () => {
  for (const engine of engines) {
    assert.equal(databaseCapabilityIds(engine).length, baseline.gates.databaseClassified[engine], engine);
  }
});

test("database contracts reserve fixed OS-keychain profiles while operation requirements stay in gate code", () => {
  for (const engine of engines) {
    const contract = readDatabaseContract(engine);
    const result = validateContract(engine, contract, databaseCapabilityIds(engine));
    assert.equal(contract.profile, profileByEngine[engine]);
    assert.deepEqual(contract.requiredOperations, undefined, engine);
    assert.deepEqual(result.failures, [], engine);
    assert.ok(requiredOperationsByEngine[engine].length, engine);
  }
});

test("database gate blocks empty contracts instead of accepting self-declared evidence", async () => {
  const result = await runDatabaseGate({ engine: "postgresql", env: { CLI_DATABASE_GATE_EVIDENCE: "/tmp/untrusted.json" } });
  assert.equal(result.status, "blocked");
  assert.match(result.failures.join("\n"), /command cases are missing for 130\/130 classified capabilities/);
  assert.match(result.failures.join("\n"), /installed CLI could not obtain an OS-keychain connection receipt/);
});

test("MySQL gate uses the current packed CLI profile and OS Keychain for connectivity", {
  skip: process.env.CLI_DATABASE_GATE === "1" && process.env.CLI_DATABASE_ENGINE === "mysql"
    ? false
    : "runs only in the explicit MySQL database gate",
}, async () => {
  const result = await runDatabaseGate({ engine: "mysql" });
  assert.equal(result.connectivity, "connected");
});

test("database gate requires command-derived real evidence", async () => {
  const requested = process.env.CLI_DATABASE_GATE === "1";
  const selected = process.env.CLI_DATABASE_ENGINE;
  const result = await runDatabaseGate({ engine: selected });
  if (requested) assert.equal(result.status, "accepted", result.failures.join("\n"));
  else assert.equal(result.status, "blocked", result.failures.join("\n"));
});
