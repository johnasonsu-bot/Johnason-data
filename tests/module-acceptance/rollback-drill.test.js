const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { runRollbackDrill, validateOptions } = require("../../scripts/run-module-rollback-drill");

function options(overrides = {}) {
  const state = { version: null, maintenance: false, facts: new Map(), others: { auth: "0.2.0" } };
  return {
    moduleName: "fixture",
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    registryUrl: "http://127.0.0.1:4873/",
    environment: "test",
    idempotencyKey: "flight-9",
    lifecycle: {
      async enterMaintenance() { state.maintenance = true; },
      async drain() {},
      async snapshot() { return { facts: state.facts.size }; },
      async otherPackageVersions() { return state.others; },
      async install(_module, version) { state.version = version; },
      async verifyInstalledVersion(_module, version) { assert.equal(state.version, version); },
      async writeCandidateFact(key) {
        if (!state.facts.has(key)) state.facts.set(key, { id: state.facts.size + 1, key });
        return state.facts.get(key);
      },
      async verifyRollbackFacts(_snapshot, fact) { assert.deepEqual(state.facts.get(fact.key), fact); },
      async verifySchemaCompatibility() {},
      async verifyIdempotent(first, second) { assert.deepEqual(second, first); assert.equal(state.facts.size, 1); },
      async exitMaintenance() { state.maintenance = false; },
    },
    ...overrides,
  };
}

test("rollback drill restores old package, preserves facts, and re-upgrades idempotently", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-evidence-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evidenceFile = path.join(root, "fixture.json");
  const evidence = await runRollbackDrill(options({ evidenceFile }));
  assert.equal(evidence.status, "accepted");
  assert.equal(evidence.maintenance, false);
  assert.equal(evidence.rollbackDrill, "passed");
  assert.equal(evidence.reUpgradeIdempotency, "passed");
  assert.equal(JSON.parse(fs.readFileSync(evidenceFile, "utf8")).secretFindings, 0);
});

test("rollback drill keeps maintenance enabled after an injected failure", async () => {
  const value = options();
  value.lifecycle.verifyRollbackFacts = async () => { throw Object.assign(new Error("fact mismatch"), { code: "FACT_MISMATCH" }); };
  const evidence = await runRollbackDrill(value);
  assert.equal(evidence.status, "failed");
  assert.equal(evidence.maintenance, true);
  assert.equal(evidence.error.code, "FACT_MISMATCH");
});

test("rollback drill rejects production, external registry, ranges, migrations, and inline secrets", () => {
  assert.throws(() => validateOptions(options({ environment: "production" })), /forbidden in production/i);
  assert.throws(() => validateOptions(options({ registryUrl: "https://registry.npmjs.org" })), /loopback/i);
  assert.throws(() => validateOptions(options({ candidateVersion: "^0.2.0" })), /exact version/i);
  assert.throws(() => validateOptions(options({ downgradeMigrations: ["down.sql"] })), /downgrade migrations/i);
  assert.throws(() => validateOptions(options({ commands: ["npm --password=plain"] })), /inline secrets/i);
});
