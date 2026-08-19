const fs = require("node:fs");
const path = require("node:path");
const { createCapabilityCatalog } = require("@johnason/data-platform-core");

const baseline = require("../../../docs/superpowers/specs/data-platform-cli-coverage-baseline.json");
const engines = Object.freeze(["mysql", "postgresql", "oracle", "dm"]);

function classifiedCapabilities(target) {
  return [...createCapabilityCatalog().values()]
    .filter((capability) => capability.executionTargets.some(target))
    .map((capability) => capability.capabilityId)
    .sort();
}

function apiCapabilityIds() {
  return classifiedCapabilities((target) => target.kind === "api");
}

function databaseCapabilityIds(engine) {
  if (!engines.includes(engine)) throw new TypeError(`Unsupported database gate engine: ${engine}`);
  return classifiedCapabilities((target) => target.kind === "database" && target.engine === engine);
}

function readEvidence(file) {
  if (!file) return null;
  const resolved = path.resolve(file);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function validateEvidence(evidence, expected, kind, engine = null) {
  const failures = [];
  if (!evidence) return { status: "blocked", failures: [`${kind} gate evidence is missing`] };
  if (evidence.kind !== kind) failures.push(`evidence kind must be ${kind}`);
  if (engine && evidence.engine !== engine) failures.push(`evidence engine must be ${engine}`);
  if (evidence.real !== true) failures.push("real infrastructure evidence is required");
  if (evidence.mock === true || evidence.adapter === "mock") failures.push("mock evidence is forbidden");
  if (Number(evidence.bypassCount) !== 0) failures.push("bypass count must be zero");
  if (Number(evidence.secretFindings) !== 0) failures.push("secret findings must be zero");
  const tested = [...new Set(evidence.capabilityIds || [])].sort();
  const missing = expected.filter((id) => !tested.includes(id));
  const unknown = tested.filter((id) => !expected.includes(id));
  if (missing.length) failures.push(`untested capabilities: ${missing.join(", ")}`);
  if (unknown.length) failures.push(`unknown capabilities: ${unknown.join(", ")}`);
  if (!evidence.environmentFingerprint || /password|secret|token|authorization/i.test(JSON.stringify(evidence.environmentFingerprint))) {
    failures.push("redacted environment fingerprint is required");
  }
  return { status: failures.length ? "failed" : "accepted", failures, tested: tested.length, expected: expected.length };
}

function validateApiEvidence(evidence) {
  return validateEvidence(evidence, apiCapabilityIds(), "api");
}

function validateDatabaseEvidence(engine, evidence) {
  return validateEvidence(evidence, databaseCapabilityIds(engine), "database", engine);
}

module.exports = {
  baseline,
  engines,
  apiCapabilityIds,
  databaseCapabilityIds,
  readEvidence,
  validateApiEvidence,
  validateDatabaseEvidence,
};
