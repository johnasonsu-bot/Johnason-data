const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const { validateModuleManifest } = require("../src/contracts/module-manifest");

test("kernel is publishable and transport neutral", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-core-kernel");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src"]);
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.commander, undefined);
});

test("module manifest accepts exact versions and freezes capability metadata", () => {
  const manifest = validateModuleManifest({
    moduleName: "auth",
    moduleVersion: "0.2.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: [{
      capabilityId: "auth.login",
      sourceApiKeys: ["POST /api/v1/auth/login"],
      sourceFrontendKeys: [],
      executionTargets: [{ kind: "database", engine: "mysql" }],
    }],
  });
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.capabilities), true);
  assert.throws(() => validateModuleManifest({
    moduleName: "auth",
    moduleVersion: "^0.2.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: [],
  }), /exact version/i);
});

test("module manifest rejects duplicate capability and source API ownership", () => {
  const base = {
    moduleName: "auth",
    moduleVersion: "0.2.0",
    capabilitySchemaVersion: "1.0.0",
  };
  assert.throws(() => validateModuleManifest({ ...base, capabilities: [
    { capabilityId: "auth.profile", sourceApiKeys: ["GET /profile"], sourceFrontendKeys: [], executionTargets: [] },
    { capabilityId: "auth.profile", sourceApiKeys: ["GET /other"], sourceFrontendKeys: [], executionTargets: [] },
  ] }), /duplicate capability/i);
  assert.throws(() => validateModuleManifest({ ...base, capabilities: [
    { capabilityId: "auth.a", sourceApiKeys: ["GET /profile"], sourceFrontendKeys: [], executionTargets: [] },
    { capabilityId: "auth.b", sourceApiKeys: ["GET /profile"], sourceFrontendKeys: [], executionTargets: [] },
  ] }), /duplicate source api/i);
});
