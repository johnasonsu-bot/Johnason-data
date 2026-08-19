const test = require("node:test");
const assert = require("node:assert/strict");

const {
  cliRuntimeCreateTableStatements,
  createCommandRepository,
  createAuditRepository,
  createEventRepository,
  createJobRepository,
  JOB_STATES,
  runInTransaction,
  runWithDatabaseRuntime,
} = require("../src");

function fakeConnection(results = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params) { calls.push({ sql, params }); return results.shift() || [[], []]; },
    async beginTransaction() { calls.push({ sql: "BEGIN" }); },
    async commit() { calls.push({ sql: "COMMIT" }); },
    async rollback() { calls.push({ sql: "ROLLBACK" }); },
    release() { calls.push({ sql: "RELEASE" }); },
  };
}

test("migration defines all durable runtime tables and indexes", () => {
  const sql = cliRuntimeCreateTableStatements.join("\n");
  for (const table of ["cli_commands", "cli_audit_facts", "domain_events", "event_deliveries", "event_inbox", "durable_jobs", "durable_job_attempts", "durable_job_approvals"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(sql, /uk_cli_command_idempotency/);
  assert.match(sql, /uk_event_inbox_consumer/);
  assert.match(sql, /idx_durable_jobs_claim/);
});

test("command acceptance returns an existing idempotent result", async () => {
  const connection = fakeConnection([[[{ id: "original", status: "succeeded", resultRef: "asset:1" }], []]]);
  const result = await createCommandRepository(connection).acceptCommand({
    projectId: 1,
    capabilityId: "quality.run",
    idempotencyKey: "same",
  });
  assert.deepEqual(result, { id: "original", status: "succeeded", resultRef: "asset:1", duplicate: true });
  assert.equal(connection.calls.length, 1);
});

test("audit, event, and job payloads redact secrets", async () => {
  const connection = fakeConnection();
  await createAuditRepository(connection).appendAudit({
    auditId: "audit", actorId: "actor", capabilityId: "x", action: "write", outcome: "accepted", inputDigest: "a".repeat(64), details: { token: "leak" },
  });
  await createEventRepository(connection).appendEvent({
    eventId: "event", eventType: "changed", aggregate: { type: "asset", id: 1 }, payload: { password: "leak" }, auditId: "audit", commandId: "command",
  });
  await createJobRepository(connection).enqueueJob({
    jobId: "job", type: "build", moduleName: "quality", moduleVersion: "0.2.0", actorId: "actor", input: { apiKey: "leak" },
  });
  const serialized = JSON.stringify(connection.calls);
  assert.doesNotMatch(serialized, /leak/);
  assert.match(serialized, /\[REDACTED\]/);
  assert.deepEqual(JOB_STATES, ["pending", "running", "waiting_approval", "compensating", "succeeded", "failed"]);
});

test("transaction commits on success and rolls back on failure", async () => {
  const success = fakeConnection();
  const runtime = { pool: { async getConnection() { return success; } } };
  const value = await runWithDatabaseRuntime(runtime, () => runInTransaction(async () => 42));
  assert.equal(value, 42);
  assert.deepEqual(success.calls.map((call) => call.sql), ["BEGIN", "COMMIT", "RELEASE"]);

  const failure = fakeConnection();
  const failingRuntime = { pool: { async getConnection() { return failure; } } };
  await assert.rejects(
    runWithDatabaseRuntime(failingRuntime, () => runInTransaction(async () => { throw new Error("stop"); })),
    /stop/,
  );
  assert.deepEqual(failure.calls.map((call) => call.sql), ["BEGIN", "ROLLBACK", "RELEASE"]);
});
