const { z } = require("zod");

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

const RISK_STATUSES = Object.freeze([
  "legacy-accepted",
  "core-candidate",
  "testing",
  "rollback-drill",
  "re-upgrade",
  "accepted",
  "blocked",
  "failed",
]);

const semverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "must be an exact semantic version");
const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/i, "must be a sha256 digest");
const timestampSchema = z.string().refine((value) => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}, "must be an ISO-8601 UTC timestamp");
const integritySchema = z.string().refine((value) => {
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    const encoded = value.slice("sha512-".length);
    const decoded = Buffer.from(encoded, "base64");
    return decoded.length === 64 && decoded.toString("base64") === encoded;
  } catch {
    return false;
  }
}, "must be a canonical sha512 SRI value");

const commandSchema = z.object({
  argv: z.array(z.string().min(1)).min(1),
  exitCode: z.number().int(),
}).strict();

const executionTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("database"),
    engine: z.enum(["mysql", "postgresql", "oracle", "dm"]),
    evidenceMode: z.enum(["live", "mock"]),
    adapter: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("api"),
    provider: z.string().min(1),
    evidenceMode: z.enum(["live", "mock"]),
    adapter: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("local"),
    evidenceMode: z.literal("live"),
  }).strict(),
]);

const gateSchema = z.object({
  status: z.enum(["passed", "failed", "skipped"]),
  startedAt: timestampSchema,
  finishedAt: timestampSchema,
  durationMs: z.number().int().nonnegative(),
  commands: z.array(commandSchema).min(1),
  versions: z.record(z.string().min(1)).refine((value) => Object.keys(value).length > 0, "must record at least one version"),
  environmentFingerprint: sha256Schema,
  counts: z.object({
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    secrets: z.number().int().nonnegative(),
  }).strict(),
  artifactHashes: z.record(sha256Schema).refine((value) => Object.keys(value).length > 0, "must record at least one artifact hash"),
  executionTargets: z.array(executionTargetSchema),
}).strict();

const gatesSchema = z.object(Object.fromEntries(RISK_GATES.map((name) => [name, gateSchema]))).strict();

const moduleEvidenceSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  moduleName: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a package-safe module name"),
  moduleVersion: semverSchema,
  status: z.enum(RISK_STATUSES),
  startedAt: timestampSchema,
  finishedAt: timestampSchema,
  package: z.object({
    name: z.string().regex(/^@johnason\/data-platform-module-[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: semverSchema,
    integrity: integritySchema,
    exports: z.array(z.string().min(1)).min(1).refine((values) => new Set(values).size === values.length, "exports must be unique"),
  }).strict(),
  environment: z.object({
    fingerprint: sha256Schema,
    nodeVersion: z.string().min(1),
    platform: z.string().min(1),
  }).strict(),
  gates: gatesSchema,
  accepted: z.boolean().optional(),
}).strict();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeModuleEvidence(evidence) {
  return deepFreeze(moduleEvidenceSchema.parse(evidence));
}

module.exports = {
  RISK_GATES,
  RISK_STATUSES,
  moduleEvidenceSchema,
  normalizeModuleEvidence,
};
