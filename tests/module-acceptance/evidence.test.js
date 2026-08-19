const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAcceptanceManifest } = require("../../scripts/build-module-acceptance-manifest");

test("aggregate builder accounts for exactly 21 modules and does not accept missing evidence", () => {
  const manifest = buildAcceptanceManifest({ evidenceDocuments: [], verifyPackages: false });
  assert.equal(manifest.modules.length, 21);
  assert.equal(manifest.acceptedModules, 0);
  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.failures.length, 21);
});

test("aggregate builder reports an installed candidate mismatch without mutating frozen evaluation", () => {
  const evidence = {
    module: "auth",
    candidateVersion: "0.1.0",
    rollbackVersion: "0.0.9",
    capabilitySchemaVersion: "1.0.0",
    packageIntegrity: "sha512-fixture",
    riskGates: Object.fromEntries([
      "dependencyBoundary", "runtimeIsolation", "transaction", "webCompatibility", "cliParity",
      "executionTargets", "faultInjection", "packageInstall", "schemaCompatibility", "rollbackDrill",
      "reUpgradeIdempotency",
    ].map((gate) => [gate, "passed"])),
    failures: 0,
    secretFindings: 0,
    startedAt: "2026-08-13T00:00:00.000Z",
    finishedAt: "2026-08-13T00:01:00.000Z",
  };
  const manifest = buildAcceptanceManifest({ evidenceDocuments: [evidence] });
  assert.match(manifest.modules.find((entry) => entry.module === "auth").failures.join("\n"), /installed package version mismatch/);
});
