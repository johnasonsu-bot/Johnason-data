const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseline = require("../../../docs/superpowers/specs/data-platform-cli-coverage-baseline.json");
const { buildAcceptanceManifest, readEvidence } = require("../../../scripts/build-module-acceptance-manifest");

const root = path.resolve(__dirname, "../../..");

test("aggregate acceptance requires all approved coverage and real evidence", () => {
  assert.equal(baseline.gates.apiMapped, 596);
  assert.equal(baseline.gates.frontendMapped, 84);
  assert.equal(baseline.gates.unclassifiedBusinessCommands, 0);
  const manifest = buildAcceptanceManifest({
    evidenceDocuments: readEvidence(path.join(root, "evidence/module-acceptance")),
  });
  const aggregateFile = path.join(root, "evidence/module-acceptance/aggregate/manifest.json");
  const aggregate = fs.existsSync(aggregateFile) ? JSON.parse(fs.readFileSync(aggregateFile, "utf8")) : null;
  const failures = [...manifest.failures];
  if (!aggregate) failures.push({ gate: "aggregate", failures: ["aggregate evidence missing"] });
  else {
    for (const gate of ["api", "mysql", "postgresql", "oracle", "dm", "packageInstall", "aviationTwice"]) {
      if (aggregate.gates?.[gate] !== "passed") failures.push({ gate, failures: [`${gate} is not passed`] });
    }
    if (Number(aggregate.bypassCount) !== 0) failures.push({ gate: "bypass", failures: ["bypass count is not zero"] });
    if (Number(aggregate.secretFindings) !== 0) failures.push({ gate: "secrets", failures: ["secret findings are not zero"] });
  }
  assert.equal(manifest.status, "accepted", JSON.stringify({ status: "blocked", failures }, null, 2));
  assert.equal(failures.length, 0, JSON.stringify({ status: "blocked", failures }, null, 2));
});
