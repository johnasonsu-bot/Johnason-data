#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SECRET_PATTERN = /(?:password|secret|token|authorization|api[-_]?key)\s*[=:]/i;

function assertTestRegistry(registryUrl) {
  let url;
  try { url = new URL(registryUrl); } catch { throw new Error("A valid test registry URL is required"); }
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) throw new Error("Rollback registry must use a loopback host");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Rollback registry must use HTTP or HTTPS");
  return url.toString();
}

function assertCommandSafe(command) {
  if (typeof command === "string" && SECRET_PATTERN.test(command)) throw new Error("Inline secrets are forbidden in rollback commands");
  if (Array.isArray(command)) command.forEach(assertCommandSafe);
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value, Object.keys(value || {}).sort())).digest("hex");
}

function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function validateOptions(options) {
  const environment = String(options.environment || "").toLowerCase();
  if (!environment || environment === "production" || environment === "prod") throw new Error("Rollback drills are forbidden in production");
  for (const [name, version] of [["candidateVersion", options.candidateVersion], ["rollbackVersion", options.rollbackVersion]]) {
    if (!EXACT_VERSION.test(String(version || ""))) throw new Error(`${name} must be an exact version`);
  }
  if (options.candidateVersion === options.rollbackVersion) throw new Error("Candidate and rollback versions must differ");
  assertTestRegistry(options.registryUrl);
  assertCommandSafe(options.commands || []);
  if (options.downgradeMigrations?.length) throw new Error("Downgrade migrations are forbidden; use expand/contract schema compatibility");
}

async function runRollbackDrill(options) {
  validateOptions(options);
  const startedAt = new Date().toISOString();
  const steps = [];
  let maintenance = false;
  const lifecycle = options.lifecycle || {};
  const call = async (name, ...args) => {
    if (typeof lifecycle[name] !== "function") throw new Error(`Rollback lifecycle hook is missing: ${name}`);
    const result = await lifecycle[name](...args);
    steps.push({ name, status: "passed", at: new Date().toISOString() });
    return result;
  };
  let evidence;
  try {
    await call("enterMaintenance", options.moduleName);
    maintenance = true;
    await call("drain", options.moduleName);
    const snapshot = await call("snapshot", options.moduleName);
    const otherVersionsBefore = await call("otherPackageVersions", options.moduleName);

    await call("install", options.moduleName, options.candidateVersion, options.registryUrl);
    await call("verifyInstalledVersion", options.moduleName, options.candidateVersion);
    const fact = await call("writeCandidateFact", options.idempotencyKey);

    await call("install", options.moduleName, options.rollbackVersion, options.registryUrl);
    await call("verifyInstalledVersion", options.moduleName, options.rollbackVersion);
    await call("verifyRollbackFacts", snapshot, fact);
    await call("verifySchemaCompatibility", options.moduleName, options.rollbackVersion);
    const otherVersionsAfterRollback = await call("otherPackageVersions", options.moduleName);
    if (stableHash(otherVersionsBefore) !== stableHash(otherVersionsAfterRollback)) throw new Error("Other package versions changed during rollback");

    await call("install", options.moduleName, options.candidateVersion, options.registryUrl);
    await call("verifyInstalledVersion", options.moduleName, options.candidateVersion);
    const repeated = await call("writeCandidateFact", options.idempotencyKey);
    await call("verifyIdempotent", fact, repeated);
    const otherVersionsAfterUpgrade = await call("otherPackageVersions", options.moduleName);
    if (stableHash(otherVersionsBefore) !== stableHash(otherVersionsAfterUpgrade)) throw new Error("Other package versions changed during re-upgrade");

    await call("exitMaintenance", options.moduleName);
    maintenance = false;
    evidence = {
      schemaVersion: "1.0.0",
      module: options.moduleName,
      candidateVersion: options.candidateVersion,
      rollbackVersion: options.rollbackVersion,
      registry: new URL(options.registryUrl).origin,
      environment: options.environment,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "accepted",
      maintenance: false,
      otherPackagesUnchanged: true,
      rollbackDrill: "passed",
      reUpgradeIdempotency: "passed",
      steps,
      secretFindings: 0,
    };
  } catch (error) {
    evidence = {
      schemaVersion: "1.0.0",
      module: options.moduleName,
      candidateVersion: options.candidateVersion,
      rollbackVersion: options.rollbackVersion,
      registry: new URL(options.registryUrl).origin,
      environment: options.environment,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "failed",
      maintenance,
      error: { code: error.code || "ROLLBACK_DRILL_FAILED", message: error.message },
      steps,
      secretFindings: 0,
    };
  }
  if (options.evidenceFile) writeAtomic(path.resolve(options.evidenceFile), evidence);
  return evidence;
}

module.exports = { runRollbackDrill, assertTestRegistry, validateOptions, stableHash };
