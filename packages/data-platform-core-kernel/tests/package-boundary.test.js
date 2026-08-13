const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateModuleManifest } = require("../src/contracts/module-manifest");

function readPackage(packagePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../..", packagePath), "utf8"));
}

test("kernel is publishable and transport neutral", () => {
  const pkg = readPackage("packages/data-platform-core-kernel/package.json");
  assert.equal(pkg.name, "@johnason/data-platform-core-kernel");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src"]);
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.commander, undefined);
});

test("module manifest rejects non-exact versions", () => {
  assert.throws(() => validateModuleManifest({
    moduleName: "auth",
    moduleVersion: "^0.1.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: [],
  }), /exact version/i);
});

test("module manifest freezes unique capability metadata", () => {
  const manifest = validateModuleManifest({
    moduleName: "auth",
    moduleVersion: "0.1.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: [{
      capabilityId: "auth.session.create",
      sourceApiKeys: ["POST /api/v1/auth/login"],
      sourceFrontendKeys: ["/login"],
      executionTargets: ["web", "cli"],
    }],
  });

  assert.equal(Object.isFrozen(manifest.capabilities), true);
  assert.equal(Object.isFrozen(manifest.capabilities[0].sourceApiKeys), true);
  assert.equal(Object.isFrozen(manifest.capabilities[0].sourceFrontendKeys), true);
  assert.equal(Object.isFrozen(manifest.capabilities[0].executionTargets), true);
  assert.throws(() => validateModuleManifest({
    ...manifest,
    capabilities: [manifest.capabilities[0], manifest.capabilities[0]],
  }), /duplicate capability id/i);
});
