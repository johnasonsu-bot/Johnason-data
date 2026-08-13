const assert = require("node:assert/strict");
const test = require("node:test");

const { RISK_GATES, normalizeModuleEvidence } = require("../src/risk/evidence-schema");
const { evaluateModuleEvidence } = require("../src/risk/acceptance");

const HASH = `sha256:${"a".repeat(64)}`;
const INTEGRITY = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;

function gate(overrides = {}) {
  return {
    status: "passed",
    startedAt: "2026-08-13T00:00:00.000Z",
    finishedAt: "2026-08-13T00:00:01.000Z",
    durationMs: 1000,
    commands: [{ argv: ["node", "--test", "acceptance.test.js"], exitCode: 0 }],
    versions: { node: "22.20.0" },
    environmentFingerprint: HASH,
    counts: { passed: 1, failed: 0, skipped: 0, secrets: 0 },
    artifactHashes: { tap: HASH },
    executionTargets: [],
    ...overrides,
  };
}

function acceptedEvidence() {
  return {
    schemaVersion: "1.0.0",
    moduleName: "auth",
    moduleVersion: "0.2.0",
    status: "accepted",
    startedAt: "2026-08-13T00:00:00.000Z",
    finishedAt: "2026-08-13T00:01:00.000Z",
    package: {
      name: "@johnason/data-platform-module-auth",
      version: "0.2.0",
      integrity: INTEGRITY,
      exports: ["createAuthCapabilities", "moduleDefinition"],
    },
    environment: { fingerprint: HASH, nodeVersion: "22.20.0", platform: "darwin-arm64" },
    gates: Object.fromEntries(RISK_GATES.map((name) => [name, gate()])),
    accepted: true,
  };
}

test("all eleven passed zero-failure zero-secret gates are accepted", () => {
  const evidence = acceptedEvidence();
  assert.equal(Object.keys(evidence.gates).length, 11);
  assert.deepEqual(evaluateModuleEvidence(evidence), {
    accepted: true,
    status: "accepted",
    failures: [],
  });
  assert.equal(Object.isFrozen(normalizeModuleEvidence(evidence)), true);
});

test("skipped, unknown, and spoofed acceptance evidence is rejected", () => {
  const skipped = acceptedEvidence();
  skipped.gates.rollbackDrill = gate({ status: "skipped", counts: { passed: 0, failed: 0, skipped: 1, secrets: 0 } });
  assert.deepEqual(evaluateModuleEvidence(skipped), {
    accepted: false,
    status: "failed",
    failures: ["GATE_NOT_PASSED:rollbackDrill", "ACCEPTED_SPOOF"],
  });

  const unknown = acceptedEvidence();
  unknown.gates.shadowCanary = gate();
  const result = evaluateModuleEvidence(unknown);
  assert.equal(result.accepted, false);
  assert.equal(result.status, "failed");
  assert.ok(result.failures.some((failure) => failure.startsWith("SCHEMA_INVALID:")));
});

test("Oracle and DM require live execution evidence rather than mock adapters", () => {
  for (const engine of ["oracle", "dm"]) {
    const evidence = acceptedEvidence();
    evidence.gates.executionTargets = gate({
      executionTargets: [{ kind: "database", engine, evidenceMode: "mock", adapter: "fixture" }],
    });
    const result = evaluateModuleEvidence(evidence);
    assert.equal(result.accepted, false);
    assert.ok(result.failures.includes(`NON_LIVE_DATABASE_EVIDENCE:${engine}`));
  }
});

test("package integrity, exact version agreement, and chronological timestamps are mandatory", () => {
  const missingIntegrity = acceptedEvidence();
  delete missingIntegrity.package.integrity;
  assert.ok(evaluateModuleEvidence(missingIntegrity).failures.some((failure) => failure.startsWith("SCHEMA_INVALID:")));

  const mismatch = acceptedEvidence();
  mismatch.package.version = "0.1.0";
  assert.ok(evaluateModuleEvidence(mismatch).failures.includes("PACKAGE_VERSION_MISMATCH"));

  const reversed = acceptedEvidence();
  reversed.finishedAt = "2026-08-12T23:59:59.000Z";
  assert.ok(evaluateModuleEvidence(reversed).failures.includes("TIMESTAMP_ORDER_INVALID:evidence"));
  const gateReversed = acceptedEvidence();
  gateReversed.gates.transaction = gate({
    startedAt: "2026-08-13T00:00:02.000Z",
    finishedAt: "2026-08-13T00:00:01.000Z",
  });
  assert.ok(evaluateModuleEvidence(gateReversed).failures.includes("TIMESTAMP_ORDER_INVALID:transaction"));
});

test("plaintext secret-shaped fields and command arguments fail closed", () => {
  const nested = acceptedEvidence();
  nested.gates.faultInjection.diagnostics = { databasePassword: "plain-secret" };
  assert.ok(evaluateModuleEvidence(nested).failures.some((failure) => failure.startsWith("SECRET_FIELD:")));

  const command = acceptedEvidence();
  command.gates.packageInstall.commands[0].argv.push("--token", "plain-token");
  assert.ok(evaluateModuleEvidence(command).failures.includes("SECRET_ARGUMENT:packageInstall"));

  for (const secret of [
    "Server=db;User=admin;Password=plain-value",
    "oracle-user/oracle-password@db-host:1521/service",
    "https://example.invalid/resource?token=plain-value",
    "Basic dXNlcjpwYXNzd29yZA==",
  ]) {
    const allowedField = acceptedEvidence();
    allowedField.gates.packageInstall.commands[0].argv.push("--connection", secret);
    assert.ok(
      evaluateModuleEvidence(allowedField).failures.some((failure) => failure.startsWith("PLAINTEXT_SECRET:")),
      `must reject ${secret}`,
    );
  }

  const scopedInstall = acceptedEvidence();
  scopedInstall.gates.packageInstall.commands[0].argv = [
    "npm", "install", "@johnason/data-platform-module-auth@0.2.0", "--ignore-scripts",
  ];
  assert.deepEqual(evaluateModuleEvidence(scopedInstall), {
    accepted: true,
    status: "accepted",
    failures: [],
  });
});

test("status is a strict lifecycle enum and accepted is calculated rather than trusted", () => {
  const invalidStatus = acceptedEvidence();
  invalidStatus.status = "ready";
  assert.ok(evaluateModuleEvidence(invalidStatus).failures.some((failure) => failure.startsWith("SCHEMA_INVALID:")));

  const testing = acceptedEvidence();
  testing.status = "testing";
  testing.accepted = true;
  assert.deepEqual(evaluateModuleEvidence(testing), {
    accepted: false,
    status: "testing",
    failures: ["ACCEPTED_SPOOF"],
  });
});

test("redacted fingerprints, counts, durations, and artifact hashes are mandatory", () => {
  for (const field of ["environmentFingerprint", "counts", "durationMs", "artifactHashes"]) {
    const evidence = acceptedEvidence();
    delete evidence.gates.runtimeIsolation[field];
    assert.ok(
      evaluateModuleEvidence(evidence).failures.some((failure) => failure.startsWith("SCHEMA_INVALID:")),
      `${field} must be required`,
    );
  }

  const rawEnvironment = acceptedEvidence();
  rawEnvironment.environment.variables = { NODE_ENV: "test" };
  assert.ok(evaluateModuleEvidence(rawEnvironment).failures.some((failure) => failure.startsWith("SCHEMA_INVALID:")));
});
