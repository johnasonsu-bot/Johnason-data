const assert = require("node:assert/strict");
const test = require("node:test");

const { errorEnvelope, exitCodeFor, successEnvelope } = require("../src/output/envelope");
const { redact } = require("../src/output/redaction");
const { createRenderer } = require("../src/output/renderer");
const { createCommandRegistry } = require("../src/registry/command-registry");

const schema = Object.freeze({ parse(value) { return value; } });

function definition(overrides = {}) {
  return {
    command: "project list",
    capabilityId: "project.list",
    modules: ["system_projects"],
    action: "read",
    sourceApiKeys: ["GET /api/v1/projects"],
    sourceFrontendKeys: ["/projects"],
    executionTargets: [{ kind: "database", engine: "mysql", role: "platform-authority" }],
    inputSchema: schema,
    outputSchema: schema,
    async handler() { return []; },
    ...overrides,
  };
}

function capture() {
  let value = "";
  return {
    stream: { write(chunk) { value += String(chunk); return true; } },
    value() { return value; },
  };
}

test("success envelope always has a stable redacted shape", () => {
  assert.deepEqual(successEnvelope({ user: "alice", password: "private" }, {
    auditId: "audit-1",
    meta: { page: 1, authorization: "Bearer private" },
  }), {
    success: true,
    data: { user: "alice", password: "[REDACTED]" },
    meta: { page: 1, authorization: "[REDACTED]" },
    auditId: "audit-1",
  });
  assert.deepEqual(successEnvelope([]), { success: true, data: [], meta: null, auditId: null });
});

test("error envelope exposes only stable public error fields", () => {
  const source = Object.assign(new Error("cannot open mysql://alice:private@db.internal/platform"), {
    code: "DEPENDENCY_UNAVAILABLE",
    retryable: true,
    details: { host: "db.internal", token: "private" },
    stack: "must-not-leak",
  });
  assert.deepEqual(errorEnvelope(source, "audit-2"), {
    success: false,
    error: {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "cannot open mysql://alice:[REDACTED]@db.internal/platform",
      retryable: true,
      details: { host: "db.internal", token: "[REDACTED]" },
    },
    auditId: "audit-2",
  });
  assert.equal(JSON.stringify(errorEnvelope(source, "audit-2")).includes("must-not-leak"), false);
});

test("exit codes are deterministic for every public category", () => {
  const hostile = {};
  Object.defineProperty(hostile, "success", { get() { throw new Error("broken success getter"); } });
  assert.deepEqual([
    exitCodeFor({ success: true }),
    exitCodeFor(undefined),
    exitCodeFor({ code: "INPUT_INVALID" }),
    exitCodeFor({ statusCode: 401 }),
    exitCodeFor({ code: "MODULE_PERMISSION_FORBIDDEN" }),
    exitCodeFor({ statusCode: 404 }),
    exitCodeFor({ code: "PROJECT_NOT_UNIQUE" }),
    exitCodeFor({ code: "DEPENDENCY_UNAVAILABLE" }),
    exitCodeFor({ code: "PARTIAL_SUCCESS" }),
    exitCodeFor({ code: "UNEXPECTED_FAILURE" }),
    exitCodeFor(hostile),
  ], [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 1]);
});

test("redaction recursively handles sensitive keys, arrays, and URI authority passwords", () => {
  assert.deepEqual(redact({
    password: "x",
    nested: { token: "y", host: "db", api_key: "z" },
    entries: [{ clientSecret: "private" }, "postgres://reader:p%40ss@db.internal:5432/app"],
  }), {
    password: "[REDACTED]",
    nested: { token: "[REDACTED]", host: "db", api_key: "[REDACTED]" },
    entries: [{ clientSecret: "[REDACTED]" }, "postgres://reader:[REDACTED]@db.internal:5432/app"],
  });
});

test("redaction produces JSON-safe output for cycles, throwing getters, bigint, dates, and binary data", () => {
  const hostile = new Proxy({}, { ownKeys() { throw new Error("private proxy failure"); } });
  const value = { count: 7n, createdAt: new Date("2026-08-13T00:00:00.000Z"), payload: Buffer.from("private"), hostile };
  value.self = value;
  Object.defineProperty(value, "broken", { enumerable: true, get() { throw new Error("private getter failure"); } });

  const result = redact(value);
  assert.deepEqual(result, {
    count: "7",
    createdAt: "2026-08-13T00:00:00.000Z",
    payload: "[BINARY]",
    hostile: "[UNSERIALIZABLE]",
    self: "[Circular]",
    broken: "[UNSERIALIZABLE]",
  });
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("JSON renderer writes one success document to stdout and redacted diagnostics to stderr", () => {
  const stdout = capture();
  const stderr = capture();
  const renderer = createRenderer({ json: true, stdout: stdout.stream, stderr: stderr.stream });

  renderer.diagnostic("connecting mysql://alice:private@db.internal/platform");
  assert.equal(renderer.success({ password: "private", ready: true }, { auditId: "audit-3" }), 0);

  assert.deepEqual(JSON.parse(stdout.value()), {
    success: true,
    data: { password: "[REDACTED]", ready: true },
    meta: null,
    auditId: "audit-3",
  });
  assert.equal(stdout.value().trim().split("\n").length, 1);
  assert.equal(stderr.value(), "connecting mysql://alice:[REDACTED]@db.internal/platform\n");
});

test("JSON renderer writes one error document to stdout while diagnostics remain on stderr", () => {
  const stdout = capture();
  const stderr = capture();
  const renderer = createRenderer({ json: true, stdout: stdout.stream, stderr: stderr.stream });
  renderer.diagnostic({ phase: "database", credential: "private" });

  assert.equal(renderer.error({ code: "MODULE_PERMISSION_FORBIDDEN", message: "denied", retryable: false }, "audit-4"), 4);
  assert.deepEqual(JSON.parse(stdout.value()), {
    success: false,
    error: { code: "MODULE_PERMISSION_FORBIDDEN", message: "denied", retryable: false },
    auditId: "audit-4",
  });
  assert.equal(stdout.value().trim().split("\n").length, 1);
  assert.equal(stderr.value(), '{"phase":"database","credential":"[REDACTED]"}\n');

  const missingStdout = capture();
  const missingRenderer = createRenderer({ json: true, stdout: missingStdout.stream, stderr: capture().stream });
  assert.equal(missingRenderer.error(undefined), 1);
  assert.deepEqual(JSON.parse(missingStdout.value()), {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Internal error", retryable: false },
    auditId: null,
  });
});

test("JSON renderer refuses to emit a second stdout document", () => {
  const stdout = capture();
  const renderer = createRenderer({ json: true, stdout: stdout.stream, stderr: capture().stream });
  renderer.success({ ready: true });
  assert.throws(() => renderer.error(new Error("late failure")), /already emitted/i);
  assert.equal(stdout.value().trim().split("\n").length, 1);
});

test("command registry rejects incomplete, unknown, and malformed schema definitions", () => {
  const registry = createCommandRegistry();
  assert.throws(() => registry.register({ capabilityId: "x", sourceApiKeys: [] }), /command|modules|action/i);
  assert.throws(() => registry.register(definition({ unexpected: true })), /unrecognized|unknown/i);
  assert.throws(() => registry.register(definition({ inputSchema: {}, outputSchema: schema })), /inputSchema/i);
  assert.throws(() => registry.register(definition({ modules: "not-an-array" })), /modules/i);
});

test("command registry indexes one immutable validated definition by command, capability, and source keys", () => {
  const registry = createCommandRegistry();
  const registered = registry.register(definition());

  assert.equal(registry.get("project.list"), registered);
  assert.equal(registry.getByCommand("project list"), registered);
  assert.equal(registry.getBySourceApiKey("GET /api/v1/projects"), registered);
  assert.deepEqual(registry.getBySourceFrontendKey("/projects"), [registered]);
  assert.deepEqual(registry.values(), [registered]);
  assert.equal(Object.isFrozen(registered), true);
  assert.equal(Object.isFrozen(registered.modules), true);
  assert.equal(Object.isFrozen(registered.executionTargets), true);
  assert.equal(Object.isFrozen(registered.executionTargets[0]), true);
  assert.equal(Object.isFrozen(registry.values()), true);
});

test("command registry rejects duplicate capability, command, and API source keys atomically while sharing frontend pages", () => {
  for (const duplicate of [
    definition({ command: "other", sourceApiKeys: ["GET /other"], sourceFrontendKeys: ["/other"] }),
    definition({ capabilityId: "project.other", sourceApiKeys: ["GET /other"], sourceFrontendKeys: ["/other"] }),
    definition({ command: "other", capabilityId: "project.other", sourceFrontendKeys: ["/other"] }),
  ]) {
    const registry = createCommandRegistry();
    registry.register(definition());
    assert.throws(() => registry.register(duplicate), /duplicate/i);
    assert.equal(registry.values().length, 1);
  }

  const registry = createCommandRegistry();
  const first = registry.register(definition());
  const second = registry.register(definition({
    command: "project current",
    capabilityId: "project.current",
    sourceApiKeys: ["GET /api/v1/projects/current"],
  }));
  assert.deepEqual(registry.getBySourceFrontendKey("/projects"), [first, second]);
});

test("shared command aliases require an explicit exact alias API key set", () => {
  const shared = definition({
    sourceApiKeys: ["GET /api/v1/projects", "GET /api/projects"],
    sharedCommandAlias: true,
  });
  assert.throws(() => createCommandRegistry().register(shared), /aliasApiKeys/i);
  assert.throws(() => createCommandRegistry().register({
    ...shared,
    aliasApiKeys: ["GET /api/v1/projects"],
  }), /every sourceApiKey/i);
  assert.throws(() => createCommandRegistry().register(definition({
    aliasApiKeys: ["GET /api/v1/projects"],
  })), /sharedCommandAlias/i);

  const registered = createCommandRegistry().register({
    ...shared,
    aliasApiKeys: ["GET /api/projects", "GET /api/v1/projects"],
  });
  assert.deepEqual(registered.aliasApiKeys, ["GET /api/projects", "GET /api/v1/projects"]);
});
