const { RISK_GATES, moduleEvidenceSchema } = require("./evidence-schema");

const SECRET_KEY = /(?:password|secret|token|authorization|api[-_]?key|credential)/i;
const SECRET_OPTION = /^--?(?:password|secret|token|authorization|api[-_]?key|credential)(?:=|$)/i;
const SECRET_VALUE = /(?:[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@|\b(?:Bearer|Basic)\s+\S+|(?:^|[;?&\s])(?:password|pwd|token|access_token|api[-_]?key)\s*=\s*[^;?&\s]+|(?:^|[\s=])[^\s;/]+\/[^\s@/]+@[^\s]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const SCOPED_PACKAGE_SPEC = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/i;

function scanSecrets(value, path = "$", failures = [], seen = new Set()) {
  if (typeof value === "string") {
    if (!SCOPED_PACKAGE_SPEC.test(value) && SECRET_VALUE.test(value)) failures.push(`PLAINTEXT_SECRET:${path}`);
    return failures;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return failures;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanSecrets(child, `${path}[${index}]`, failures, seen));
    return failures;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key !== "secrets" && SECRET_KEY.test(key) && child !== undefined && child !== null && child !== "[REDACTED]") {
      failures.push(`SECRET_FIELD:${childPath}`);
    }
    scanSecrets(child, childPath, failures, seen);
  }
  return failures;
}

function formatSchemaFailures(error) {
  return error.issues.map((issue) => `SCHEMA_INVALID:${issue.path.join(".") || "$"}:${issue.message}`);
}

function evaluateModuleEvidence(input) {
  const failures = scanSecrets(input);
  const parsed = moduleEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    failures.push(...formatSchemaFailures(parsed.error));
    return { accepted: false, status: "failed", failures };
  }

  const evidence = parsed.data;
  if (evidence.package.version !== evidence.moduleVersion) failures.push("PACKAGE_VERSION_MISMATCH");
  if (evidence.package.name !== `@johnason/data-platform-module-${evidence.moduleName}`) failures.push("PACKAGE_NAME_MISMATCH");
  if (Date.parse(evidence.finishedAt) < Date.parse(evidence.startedAt)) failures.push("TIMESTAMP_ORDER_INVALID:evidence");

  for (const gateName of RISK_GATES) {
    const gate = evidence.gates[gateName];
    if (gate.status !== "passed") failures.push(`GATE_NOT_PASSED:${gateName}`);
    if (Date.parse(gate.finishedAt) < Date.parse(gate.startedAt)) failures.push(`TIMESTAMP_ORDER_INVALID:${gateName}`);
    if (gate.counts.failed !== 0) failures.push(`GATE_FAILURE_COUNT:${gateName}`);
    if (gate.status === "passed" && gate.counts.skipped !== 0) failures.push(`GATE_SKIP_COUNT:${gateName}`);
    if (gate.counts.secrets !== 0) failures.push(`GATE_SECRET_COUNT:${gateName}`);
    if (gate.commands.some((command) => command.exitCode !== 0)) failures.push(`COMMAND_FAILED:${gateName}`);
    if (gate.commands.some((command) => command.argv.some((argument) => SECRET_OPTION.test(argument)))) {
      failures.push(`SECRET_ARGUMENT:${gateName}`);
    }
    for (const target of gate.executionTargets) {
      if (target.kind === "database" && ["oracle", "dm"].includes(target.engine) && target.evidenceMode !== "live") {
        failures.push(`NON_LIVE_DATABASE_EVIDENCE:${target.engine}`);
      }
    }
  }

  const baseAccepted = failures.length === 0 && evidence.status === "accepted";
  if (evidence.accepted !== undefined && evidence.accepted !== baseAccepted) failures.push("ACCEPTED_SPOOF");
  const accepted = baseAccepted && failures.length === 0;
  const status = accepted ? "accepted" : evidence.status === "accepted" ? "failed" : evidence.status;
  return { accepted, status, failures };
}

module.exports = { evaluateModuleEvidence };
