const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
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

function outputValue(envelope, fieldPath) {
  return String(fieldPath || "").split(".").filter(Boolean).reduce((value, key) => value?.[key], envelope);
}

function commandDefinition(capabilityId) {
  return createDomainCommands(createCapabilityCatalog()).find((definition) => definition.capabilityIds.includes(capabilityId));
}

function validateContract(engine, contract, expected) {
  const failures = [];
  if (!contract || contract.engine !== engine) failures.push("contract engine does not match selected engine");
  if (contract?.profile !== profileByEngine[engine]) failures.push(`contract must use only ${profileByEngine[engine]}`);
  if (contract?.mock === true || contract?.adapter === "mock") failures.push("mock database contracts are forbidden");
  if (!Array.isArray(contract?.requiredOperations) || !contract.requiredOperations.length) failures.push("contract must require real engine operations");
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
    if (!entry.output || typeof entry.output.executionTarget !== "string" || !entry.evidence || typeof entry.evidence !== "object") {
      failures.push(`${entry.capabilityId}: case must map command output evidence`);
    }
    cases.set(entry.capabilityId, entry);
  }
  const missing = expected.filter((capabilityId) => !cases.has(capabilityId));
  for (const operation of contract?.requiredOperations || []) {
    const operationCase = [...cases.values()].find((entry) => entry.evidence?.[operation]);
    if (!operationCase || typeof operationCase.output?.[operation] !== "string") {
      failures.push(`missing command-derived ${operation} evidence`);
    }
  }
  return { failures, cases, missing };
}

function profileConnectivity(installed, contract) {
  try {
    const { resolveCliPaths } = require(path.join(installed.packageDirectory, "src/runtime/paths"));
    const { createProfileStore } = require(path.join(installed.packageDirectory, "src/runtime/profile-store"));
    const { createLazyKeychain } = require(path.join(installed.packageDirectory, "src/runtime/keychain"));
    const { createProfileDatabaseRuntime } = require(path.join(installed.packageDirectory, "src/runtime/database"));
    const paths = resolveCliPaths({ platform: process.platform, env: process.env, homeDir: os.homedir() });
    const store = createProfileStore({ configFile: paths.configFile, fsImpl: fs });
    const profile = store.get(contract.profile);
    if (!profile) return Promise.resolve({ status: "blocked", reason: `OS-keychain profile ${contract.profile} is unavailable` });
    const runtime = createProfileDatabaseRuntime(profile, createLazyKeychain());
    return Promise.resolve(runtime.testConnection())
      .then(async () => {
        await runtime.close();
        return { status: "connected" };
      })
      .catch(async () => {
        await runtime.close().catch(() => {});
        return { status: "blocked", reason: `OS-keychain profile ${contract.profile} could not connect` };
      });
  } catch {
    return Promise.resolve({ status: "blocked", reason: `OS-keychain profile ${contract.profile} could not be resolved` });
  }
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
  const connectivity = await profileConnectivity(installed, contract);
  if (connectivity.status !== "connected") failures.push(connectivity.reason);
  if (failures.length) return { status: "blocked", failures, tested: 0, expected: expected.length, connectivity: connectivity.status };

  const commandFailures = [];
  const coveredOperations = new Set();
  for (const capabilityId of expected) {
    const entry = preflight.cases.get(capabilityId);
    const definition = commandDefinition(capabilityId);
    if (!definition) {
      commandFailures.push(`${capabilityId}: registry command definition is missing`);
      continue;
    }
    let argv;
    try {
      argv = commandArguments(definition, capabilityId, contract, entry);
    } catch (error) {
      commandFailures.push(`${capabilityId}: ${error.message}`);
      continue;
    }
    const result = spawn(installed.binary, argv, { encoding: "utf8", timeout: Number(env.CLI_DATABASE_GATE_TIMEOUT_MS || 120000) });
    if (result.error || result.status !== 0) {
      commandFailures.push(`${capabilityId}: installed CLI command did not produce real-operation evidence`);
      continue;
    }
    try {
      const envelope = JSON.parse(result.stdout);
      if (!envelope?.success) throw new Error("command JSON envelope is not successful");
      const targetEvidence = outputValue(envelope, entry.output.executionTarget);
      const targets = Array.isArray(targetEvidence) ? targetEvidence : [targetEvidence];
      if (!targets.some((target) => target?.kind === "database" && target.engine === selected)) {
        throw new Error("command output does not prove the selected database engine");
      }
      for (const operation of contract.requiredOperations) {
        if (entry.evidence[operation]) {
          if (!outputValue(envelope, entry.output[operation])) throw new Error(`missing command-derived ${operation} evidence`);
          coveredOperations.add(operation);
        }
      }
    } catch (error) {
      commandFailures.push(`${capabilityId}: ${error.message}`);
    }
  }
  for (const operation of contract.requiredOperations) {
    if (!coveredOperations.has(operation)) commandFailures.push(`missing command-derived ${operation} evidence`);
  }
  return { status: commandFailures.length ? "failed" : "accepted", failures: commandFailures, tested: expected.length - commandFailures.length, expected: expected.length, connectivity: connectivity.status };
}

test("database gate enumerates every engine-classified capability", () => {
  for (const engine of engines) {
    assert.equal(databaseCapabilityIds(engine).length, baseline.gates.databaseClassified[engine], engine);
  }
});

test("database contracts reserve the fixed OS-keychain profiles and required real operations", () => {
  for (const engine of engines) {
    const contract = readDatabaseContract(engine);
    const result = validateContract(engine, contract, databaseCapabilityIds(engine));
    assert.equal(contract.profile, profileByEngine[engine]);
    assert.ok(contract.requiredOperations.length, engine);
    assert.deepEqual(result.failures, contract.requiredOperations.map((operation) => `missing command-derived ${operation} evidence`), engine);
  }
});

test("database gate blocks empty contracts instead of accepting self-declared evidence", async () => {
  const result = await runDatabaseGate({ engine: "postgresql", env: { CLI_DATABASE_GATE_EVIDENCE: "/tmp/untrusted.json" } });
  assert.equal(result.status, "blocked");
  assert.match(result.failures.join("\n"), /command cases are missing for 130\/130 classified capabilities/);
  assert.match(result.failures.join("\n"), /OS-keychain profile test-postgresql/);
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
