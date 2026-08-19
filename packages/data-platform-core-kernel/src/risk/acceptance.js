const { EXACT_VERSION, deepFreeze } = require("../contracts/module-manifest");

const RISK_GATES = Object.freeze([
  "dependencyBoundary",
  "runtimeIsolation",
  "transaction",
  "webCompatibility",
  "cliParity",
  "executionTargets",
  "faultInjection",
  "packageInstall",
  "schemaCompatibility",
  "rollbackDrill",
  "reUpgradeIdempotency",
]);

function containsSecretShape(value, trail = []) {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    const next = [...trail, key];
    const isFindingCounter = /^(?:secretFindings|secretFindingCount)$/i.test(key) && Number.isInteger(child);
    if (!isFindingCounter && /password|secret|token|authorization|api[-_]?key/i.test(key) && child !== "[REDACTED]") return next.join(".");
    const found = containsSecretShape(child, next);
    if (found) return found;
  }
  return null;
}

function evaluateModuleEvidence(evidence) {
  const failures = [];
  if (!evidence || typeof evidence !== "object") return { accepted: false, status: "blocked", failures: ["evidence missing"] };
  for (const field of ["candidateVersion", "rollbackVersion", "capabilitySchemaVersion"]) {
    if (!EXACT_VERSION.test(String(evidence[field] || ""))) failures.push(`${field} must be an exact version`);
  }
  if (!String(evidence.packageIntegrity || "").startsWith("sha512-")) failures.push("package integrity missing");
  const gates = evidence.riskGates || {};
  const unknown = Object.keys(gates).filter((key) => !RISK_GATES.includes(key));
  if (unknown.length) failures.push(`unknown risk gates: ${unknown.join(", ")}`);
  for (const gate of RISK_GATES) {
    if (gates[gate] !== "passed") failures.push(`${gate} is not passed`);
  }
  if (Number(evidence.failures) !== 0) failures.push("failure count is not zero");
  if (Number(evidence.secretFindings) !== 0) failures.push("secret findings are not zero");
  const startedAt = Date.parse(evidence.startedAt);
  const finishedAt = Date.parse(evidence.finishedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) failures.push("evidence timestamps are invalid");
  for (const engine of ["oracle", "dm"]) {
    const database = evidence.databaseEvidence?.[engine];
    if (database && database.real !== true) failures.push(`${engine} database evidence is not real`);
  }
  const secretPath = containsSecretShape(evidence);
  if (secretPath) failures.push(`secret-shaped evidence field: ${secretPath}`);
  return deepFreeze({ accepted: failures.length === 0, status: failures.length ? "failed" : "accepted", failures });
}

module.exports = { RISK_GATES, evaluateModuleEvidence, containsSecretShape };
