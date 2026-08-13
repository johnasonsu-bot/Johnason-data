const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildAcceptanceManifest } = require("../../scripts/build-module-acceptance-manifest");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const RISK_GATES = [
  "dependencyBoundary", "runtimeIsolation", "transaction", "webCompatibility", "cliParity",
  "executionTargets", "faultInjection", "packageInstall", "schemaCompatibility", "rollbackDrill",
  "reUpgradeIdempotency",
];
const HASH = `sha256:${"b".repeat(64)}`;

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function acceptedEvidence(integrity) {
  const gate = () => ({
    status: "passed",
    startedAt: "2026-08-13T00:00:00.000Z",
    finishedAt: "2026-08-13T00:00:01.000Z",
    durationMs: 1000,
    commands: [{ argv: ["node", "--test", "fixture.test.js"], exitCode: 0 }],
    versions: { node: "22.20.0" },
    environmentFingerprint: HASH,
    counts: { passed: 1, failed: 0, skipped: 0, secrets: 0 },
    artifactHashes: { tap: HASH },
    executionTargets: [],
  });
  return {
    schemaVersion: "1.0.0",
    moduleName: "fixture",
    moduleVersion: "0.2.0",
    status: "accepted",
    startedAt: "2026-08-13T00:00:00.000Z",
    finishedAt: "2026-08-13T00:01:00.000Z",
    package: {
      name: "@johnason/data-platform-module-fixture",
      version: "0.2.0",
      integrity,
      exports: ["createFixture", "moduleDefinition"],
    },
    environment: { fingerprint: HASH, nodeVersion: "22.20.0", platform: "darwin-arm64" },
    gates: Object.fromEntries(RISK_GATES.map((name) => [name, gate()])),
    accepted: true,
  };
}

test("builder verifies exact lock bytes and exports from an external installed package", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "module-acceptance-builder-"));
  const evidenceRoot = path.join(root, "evidence");
  const installPrefix = path.join(root, "prefix");
  const sourceDirectory = path.join(root, "source");
  const tarballDirectory = path.join(root, "tarballs");
  const packageDirectory = path.join(installPrefix, "node_modules", "@johnason", "data-platform-module-fixture");
  const lockfile = path.join(installPrefix, "package-lock.json");
  const outputFile = path.join(root, "manifest.json");
  fs.mkdirSync(path.join(sourceDirectory, "src"), { recursive: true });
  fs.mkdirSync(tarballDirectory, { recursive: true });
  fs.mkdirSync(path.join(evidenceRoot, "fixture", "0.2.0"), { recursive: true });
  fs.writeFileSync(path.join(sourceDirectory, "package.json"), `${JSON.stringify({
    name: "@johnason/data-platform-module-fixture",
    version: "0.2.0",
    main: "src/index.js",
  })}\n`);
  fs.writeFileSync(path.join(sourceDirectory, "src", "index.js"), "module.exports = { createFixture: () => ({}), moduleDefinition: {} };\n");
  const packed = childProcess.spawnSync("npm", ["pack", "--json", "--pack-destination", tarballDirectory], {
    cwd: sourceDirectory,
    encoding: "utf8",
  });
  assert.equal(packed.status, 0, packed.stderr);
  const tarball = path.join(tarballDirectory, JSON.parse(packed.stdout)[0].filename);
  const integrity = `sha512-${crypto.createHash("sha512").update(fs.readFileSync(tarball)).digest("base64")}`;
  fs.mkdirSync(installPrefix, { recursive: true });
  fs.writeFileSync(path.join(installPrefix, "package.json"), `${JSON.stringify({ name: "acceptance-install", private: true })}\n`);
  const installed = childProcess.spawnSync("npm", [
    "install", tarball, "--ignore-scripts", "--no-audit", "--no-fund", "--workspaces=false",
  ], { cwd: installPrefix, encoding: "utf8" });
  assert.equal(installed.status, 0, installed.stderr);
  for (const npmLockfile of [lockfile, path.join(installPrefix, "node_modules", ".package-lock.json")]) {
    const npmLock = JSON.parse(fs.readFileSync(npmLockfile, "utf8"));
    if (npmLock.packages[""]) npmLock.packages[""].dependencies["@johnason/data-platform-module-fixture"] = "0.2.0";
    const entry = npmLock.packages["node_modules/@johnason/data-platform-module-fixture"];
    entry.resolved = "https://registry.invalid/fixture/-/fixture-0.2.0.tgz";
    entry.integrity = integrity;
    fs.writeFileSync(npmLockfile, `${JSON.stringify(npmLock, null, 2)}\n`);
  }
  const lockBytes = fs.readFileSync(lockfile, "utf8");
  fs.writeFileSync(
    path.join(evidenceRoot, "fixture", "0.2.0", "accepted.json"),
    `${JSON.stringify(acceptedEvidence(integrity))}\n`,
  );

  const manifest = buildAcceptanceManifest({ evidenceRoot, installPrefix, lockfile, tarballDirectory, outputFile });
  assert.equal(manifest.lock.sha256, digest(lockBytes));
  assert.deepEqual(manifest.acceptedModules, ["fixture"]);
  assert.equal(manifest.modules[0].packageLocator, "node_modules/@johnason/data-platform-module-fixture");
  assert.match(manifest.modules[0].contentSha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal("installedPackagePath" in manifest.modules[0], false);
  assert.deepEqual(manifest.modules[0].exports, ["createFixture", "moduleDefinition"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(outputFile, "utf8")), manifest);

  const mismatchedLock = JSON.parse(lockBytes);
  mismatchedLock.packages["node_modules/@johnason/data-platform-module-fixture"].integrity =
    `sha512-${Buffer.alloc(64, 8).toString("base64")}`;
  fs.writeFileSync(lockfile, `${JSON.stringify(mismatchedLock)}\n`);
  assert.throws(
    () => buildAcceptanceManifest({ evidenceRoot, installPrefix, lockfile, tarballDirectory, verifyOnly: true }),
    /lock (?:integrity mismatch|disagrees with hidden install lock)/,
  );

  fs.writeFileSync(lockfile, lockBytes);
  const wrongExports = acceptedEvidence(integrity);
  wrongExports.package.exports = ["moduleDefinition"];
  fs.writeFileSync(
    path.join(evidenceRoot, "fixture", "0.2.0", "accepted.json"),
    `${JSON.stringify(wrongExports)}\n`,
  );
  assert.throws(
    () => buildAcceptanceManifest({ evidenceRoot, installPrefix, lockfile, tarballDirectory, verifyOnly: true }),
    /installed package exports mismatch/,
  );

  fs.writeFileSync(
    path.join(evidenceRoot, "fixture", "0.2.0", "accepted.json"),
    `${JSON.stringify(acceptedEvidence(integrity))}\n`,
  );
  fs.appendFileSync(path.join(packageDirectory, "src", "index.js"), "// tampered after npm install\n");
  assert.throws(
    () => buildAcceptanceManifest({ evidenceRoot, installPrefix, lockfile, tarballDirectory, verifyOnly: true }),
    /installed package content mismatch/,
  );

  fs.writeFileSync(path.join(sourceDirectory, "package.json"), `${JSON.stringify({
    name: "@johnason/data-platform-module-fixture",
    version: "0.2.1",
    main: "src/index.js",
  })}\n`);
  fs.writeFileSync(path.join(sourceDirectory, "src", "index.js"), "module.exports = require(process.env.REPOSITORY_KERNEL_PATH);\n");
  const wrapperPacked = childProcess.spawnSync("npm", ["pack", "--json", "--pack-destination", tarballDirectory], {
    cwd: sourceDirectory,
    encoding: "utf8",
  });
  assert.equal(wrapperPacked.status, 0, wrapperPacked.stderr);
  const wrapperTarball = path.join(tarballDirectory, JSON.parse(wrapperPacked.stdout)[0].filename);
  const wrapperIntegrity = `sha512-${crypto.createHash("sha512").update(fs.readFileSync(wrapperTarball)).digest("base64")}`;
  const wrapperInstalled = childProcess.spawnSync("npm", [
    "install", wrapperTarball, "--force", "--ignore-scripts", "--no-audit", "--no-fund", "--workspaces=false",
  ], { cwd: installPrefix, encoding: "utf8" });
  assert.equal(wrapperInstalled.status, 0, wrapperInstalled.stderr);
  for (const npmLockfile of [lockfile, path.join(installPrefix, "node_modules", ".package-lock.json")]) {
    const npmLock = JSON.parse(fs.readFileSync(npmLockfile, "utf8"));
    if (npmLock.packages[""]) npmLock.packages[""].dependencies["@johnason/data-platform-module-fixture"] = "0.2.1";
    const entry = npmLock.packages["node_modules/@johnason/data-platform-module-fixture"];
    entry.resolved = "https://registry.invalid/fixture/-/fixture-0.2.1.tgz";
    entry.integrity = wrapperIntegrity;
    fs.writeFileSync(npmLockfile, `${JSON.stringify(npmLock, null, 2)}\n`);
  }
  const wrapperEvidenceRoot = path.join(root, "wrapper-evidence");
  fs.mkdirSync(path.join(wrapperEvidenceRoot, "fixture", "0.2.1"), { recursive: true });
  const wrapperEvidence = acceptedEvidence(wrapperIntegrity);
  wrapperEvidence.moduleVersion = "0.2.1";
  wrapperEvidence.package.version = "0.2.1";
  fs.writeFileSync(
    path.join(wrapperEvidenceRoot, "fixture", "0.2.1", "accepted.json"),
    `${JSON.stringify(wrapperEvidence)}\n`,
  );
  const previousRepositoryPath = process.env.REPOSITORY_KERNEL_PATH;
  process.env.REPOSITORY_KERNEL_PATH = path.join(REPOSITORY_ROOT, "packages", "data-platform-core-kernel", "src");
  try {
    assert.throws(
      () => buildAcceptanceManifest({
        evidenceRoot: wrapperEvidenceRoot,
        installPrefix,
        lockfile,
        tarballDirectory,
        verifyOnly: true,
      }),
      /loaded code outside external prefix/,
    );
  } finally {
    if (previousRepositoryPath === undefined) delete process.env.REPOSITORY_KERNEL_PATH;
    else process.env.REPOSITORY_KERNEL_PATH = previousRepositoryPath;
  }
});

test("builder rejects evidence path mismatches and duplicate module names before counting", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "module-acceptance-paths-"));
  const evidenceRoot = path.join(root, "evidence");
  const integrity = `sha512-${Buffer.alloc(64, 9).toString("base64")}`;
  fs.mkdirSync(path.join(evidenceRoot, "wrong", "0.2.0"), { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, "wrong", "0.2.0", "accepted.json"), `${JSON.stringify(acceptedEvidence(integrity))}\n`);
  assert.throws(() => buildAcceptanceManifest({ evidenceRoot, verifyOnly: true }), /evidence path mismatch/);

  const duplicateRoot = path.join(root, "duplicates");
  for (const version of ["0.2.0", "0.2.1"]) {
    const evidence = acceptedEvidence(integrity);
    evidence.moduleVersion = version;
    evidence.package.version = version;
    const directory = path.join(duplicateRoot, "fixture", version);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "accepted.json"), `${JSON.stringify(evidence)}\n`);
  }
  assert.throws(() => buildAcceptanceManifest({ evidenceRoot: duplicateRoot, verifyOnly: true }), /duplicate accepted module/);
});

test("builder rejects workspace source as installed evidence and lock integrity mismatches", () => {
  assert.throws(() => buildAcceptanceManifest({
    evidenceRoot: path.join(REPOSITORY_ROOT, "evidence", "module-acceptance"),
    installPrefix: REPOSITORY_ROOT,
    lockfile: path.join(REPOSITORY_ROOT, "package-lock.json"),
    verifyOnly: true,
  }), /external install prefix/i);
});

test("verify-only reports zero accepted modules until rollback evidence exists", () => {
  const result = childProcess.spawnSync(process.execPath, [
    path.join(REPOSITORY_ROOT, "scripts", "build-module-acceptance-manifest.js"),
    "--verify-only",
  ], { cwd: REPOSITORY_ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.acceptedModuleCount, 0);
  assert.deepEqual(output.acceptedModules, []);
});
