const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateModuleManifest } = require("../src/contracts/module-manifest");
const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

function readPackage(packagePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../..", packagePath), "utf8"));
}

function manifestWithCapability() {
  return {
    moduleName: "auth",
    moduleVersion: "0.1.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: [{
      capabilityId: "auth.session.create",
      sourceApiKeys: ["POST /api/v1/auth/login"],
      sourceFrontendKeys: ["/login"],
      executionTargets: ["web", "cli"],
    }],
  };
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
  const manifest = validateModuleManifest(manifestWithCapability());

  assert.equal(Object.isFrozen(manifest.capabilities), true);
  assert.equal(Object.isFrozen(manifest.capabilities[0].sourceApiKeys), true);
  assert.equal(Object.isFrozen(manifest.capabilities[0].sourceFrontendKeys), true);
  assert.equal(Object.isFrozen(manifest.capabilities[0].executionTargets), true);
  assert.throws(() => validateModuleManifest({
    ...manifest,
    capabilities: [manifest.capabilities[0], manifest.capabilities[0]],
  }), /duplicate capability id/i);
});

test("module manifest rejects unknown top-level and capability fields", () => {
  assert.throws(() => validateModuleManifest({
    ...manifestWithCapability(),
    unrecognizedTopLevel: true,
  }), /unrecognized key/i);
  assert.throws(() => validateModuleManifest({
    ...manifestWithCapability(),
    capabilities: [{
      ...manifestWithCapability().capabilities[0],
      unrecognizedCapabilityField: true,
    }],
  }), /unrecognized key/i);
});

test("backend and CLI do not directly depend on the kernel", () => {
  for (const packagePath of ["backend/package.json", "packages/data-platform-cli/package.json"]) {
    const pkg = readPackage(packagePath);
    assert.equal(pkg.dependencies?.["@johnason/data-platform-core-kernel"], undefined, packagePath);
    assert.equal(pkg.devDependencies?.["@johnason/data-platform-core-kernel"], undefined, packagePath);
  }
});

test("Task 1 workspace manifests use exact direct dependency versions", () => {
  for (const packagePath of [
    "package.json",
    "backend/package.json",
    "packages/data-platform-cli/package.json",
    "packages/data-platform-core-kernel/package.json",
  ]) {
    const pkg = readPackage(packagePath);
    for (const dependencyType of ["dependencies", "devDependencies"]) {
      for (const [name, version] of Object.entries(pkg[dependencyType] ?? {})) {
        assert.match(version, EXACT_SEMVER, `${packagePath} ${dependencyType}.${name}`);
      }
    }
  }

  for (const nonExactSpecifier of [
    ">=1.0.0",
    "1.x",
    "*",
    "1.0.0 || 2.0.0",
    "next",
    "npm:replacement@1.0.0",
    "git+https://example.com/package.git",
    "git@github.com:owner/package.git",
    "workspace:*",
    "file:../package",
  ]) {
    assert.doesNotMatch(nonExactSpecifier, EXACT_SEMVER, nonExactSpecifier);
  }
});

test("backend standalone lock matches its exact manifest and root workspace lock", () => {
  const backendPackage = readPackage("backend/package.json");
  const backendLock = readPackage("backend/package-lock.json");
  const rootLock = readPackage("package-lock.json");

  assert.deepEqual(backendLock.packages[""].dependencies, backendPackage.dependencies);
  assert.deepEqual(rootLock.packages.backend.dependencies, backendPackage.dependencies);
});
