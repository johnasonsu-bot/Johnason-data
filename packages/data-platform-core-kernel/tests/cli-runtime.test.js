const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { cliRuntimeMigration } = require("../src/infrastructure/cli-runtime.migration");
const {
  acceptCommand,
  appendAuditFact,
  completeCommand,
  serializeRedactedContract,
} = require("../src/infrastructure/command.repository");
const {
  appendEvent,
  recordDeliveryAttempt,
} = require("../src/infrastructure/event.repository");
const {
  JOB_STATES,
  approveJob,
  claimJobs,
  enqueueJob,
  transitionJob,
} = require("../src/infrastructure/job.repository");
const { getExecutionContext, runWithExecutionContext } = require("../src/runtime/execution-context");

test("CLI runtime migration declares eight idempotent tables and exact risk-gate indexes", () => {
  assert.equal(cliRuntimeMigration.schemaVersion, 1);
  assert.deepEqual(cliRuntimeMigration.tables, [
    "cli_commands",
    "cli_audit_facts",
    "domain_events",
    "event_deliveries",
    "event_inbox",
    "durable_jobs",
    "durable_job_attempts",
    "durable_job_approvals",
  ]);
  assert.equal(cliRuntimeMigration.createTableStatements.length, 8);
  const sql = cliRuntimeMigration.createTableStatements.join("\n");
  for (const table of cliRuntimeMigration.tables) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  for (const index of [
    "uk_cli_commands_idempotency",
    "idx_cli_commands_project_created",
    "idx_cli_audit_project_created",
    "uk_domain_events_event_id",
    "idx_domain_events_project_occurred",
    "uk_event_deliveries_event_destination",
    "uk_event_inbox_consumer_event",
    "idx_durable_jobs_lease",
    "idx_durable_jobs_project_created",
  ]) {
    assert.match(sql, new RegExp(`(?:UNIQUE )?(?:KEY|INDEX) ${index}\\b`));
  }
  assert.doesNotMatch(sql, /password|access_token|refresh_token|api_key|secret/i);
  assert.match(sql, /payload_json JSON NOT NULL/);
  assert.match(sql, /payload_sha256 CHAR\(64\) NOT NULL/);
});

test("duplicate command acceptance returns the original fixed result reference after an insert conflict", async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/INSERT INTO cli_commands/.test(sql)) {
        const error = new Error("duplicate key");
        error.code = "ER_DUP_ENTRY";
        throw error;
      }
      if (/SELECT[\s\S]+FROM cli_commands/.test(sql)) {
        return [[{
          command_id: "command-original",
          status: "succeeded",
          result_ref: "result://original",
          result_sha256: "a".repeat(64),
        }]];
      }
      throw new Error("unexpected duplicate acceptance query");
    },
  };
  const result = await acceptCommand({
    idempotencyKey: "idem-1",
    capabilityId: "project.update",
    actor: { id: 7, username: "alice" },
    projectId: 12,
    inputDigest: "b".repeat(64),
  }, connection);
  assert.deepEqual(result, {
    accepted: false,
    commandId: "command-original",
    status: "succeeded",
    resultRef: "result://original",
    resultSha256: "a".repeat(64),
  });
  assert.match(calls[0].sql, /INSERT INTO cli_commands/);
  assert.match(calls[1].sql, /SELECT[\s\S]+FROM cli_commands/);
  assert.equal(calls.length, 2);
});

test("concurrent idempotency uses insert-first and duplicate current-read without a missing-key gap lock", async () => {
  const original = {
    command_id: "command-winner",
    status: "succeeded",
    result_ref: "result://winner",
    result_sha256: "e".repeat(64),
  };
  let inserts = 0;
  const connection = {
    async execute(sql) {
      if (/INSERT INTO cli_commands/.test(sql)) {
        inserts += 1;
        const error = new Error("duplicate key");
        error.code = "ER_DUP_ENTRY";
        throw error;
      }
      if (/SELECT[\s\S]+FROM cli_commands/.test(sql)) return [[original]];
      throw new Error(`unexpected SQL: ${sql}`);
    },
  };
  const result = await acceptCommand({
    idempotencyKey: "idem-race",
    capabilityId: "project.update",
    actor: { id: 7 },
    projectId: 12,
    inputDigest: "f".repeat(64),
  }, connection);
  assert.equal(inserts, 1);
  assert.equal(result.commandId, "command-winner");
  assert.equal(result.resultRef, "result://winner");
});

test("persisted contracts redact JDBC URI and key-value connection passwords before hashing", () => {
  const contract = serializeRedactedContract({
    jdbcUrl: "jdbc:mysql://admin:supersecret@db.internal:3306/platform",
    connectionString: "Server=db.internal;User Id=admin;Password=supersecret;Database=platform",
  });
  assert.equal(contract.json.includes("supersecret"), false);
  assert.match(contract.json, /\[REDACTED\]/);
  assert.equal(contract.sha256, crypto.createHash("sha256").update(contract.json).digest("hex"));
});

test("event contracts redact sensitive JSON, hash stored bytes, and keep delivery attempts separate", async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const event = await appendEvent({
    eventId: "event-1",
    eventType: "project.updated",
    aggregate: { type: "project", id: "12", version: 1 },
    payload: { name: "Aviation", nested: { password: "must-not-persist" } },
    actor: { id: 7 },
    projectId: 12,
    auditId: "audit-1",
    commandId: "command-1",
  }, connection);
  const insert = calls[0];
  assert.match(insert.sql, /INSERT INTO domain_events/);
  const payloadJson = insert.params.find((value) => typeof value === "string" && value.includes("Aviation"));
  assert.equal(payloadJson.includes("must-not-persist"), false);
  assert.match(payloadJson, /\[REDACTED\]/);
  assert.equal(event.payloadSha256, crypto.createHash("sha256").update(payloadJson).digest("hex"));
  assert.equal(Object.isFrozen(event), true);

  await recordDeliveryAttempt({
    eventId: "event-1",
    destination: "kafka:data-platform.events",
    status: "failed",
    error: { message: "broker unavailable", token: "must-not-persist" },
  }, connection);
  assert.match(calls[1].sql, /INSERT INTO event_deliveries/);
  assert.doesNotMatch(calls[1].sql, /UPDATE\s+domain_events/i);
  assert.equal(JSON.stringify(calls[1].params).includes("must-not-persist"), false);
});

test("durable jobs enforce states, leases, and waiting-approval transitions", async () => {
  assert.deepEqual(JOB_STATES, [
    "pending",
    "running",
    "waiting_approval",
    "compensating",
    "succeeded",
    "failed",
  ]);
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/SELECT[\s\S]+FROM durable_jobs/.test(sql)) {
        return [[{ job_id: "job-1", status: "pending", lease_owner: null, lease_until: null }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
  const job = await enqueueJob({
    type: "ingestion.run",
    input: { sourceId: 4, password: "must-not-persist" },
    actor: { id: 7 },
    projectId: 12,
    maxAttempts: 3,
  }, connection);
  assert.equal(job.status, "pending");
  assert.equal(JSON.stringify(calls[0].params).includes("must-not-persist"), false);

  const claimed = await claimJobs({ workerId: "worker-1", limit: 1, leaseMs: 30_000 }, connection);
  assert.equal(claimed[0].jobId, "job-1");
  assert.equal(claimed[0].attemptNo, 1);
  assert.match(calls.find((call) => /UPDATE durable_jobs/.test(call.sql)).sql, /lease_owner/);
  assert.ok(calls.some((call) => /INSERT INTO durable_job_attempts/.test(call.sql)));

  const exhaustedCalls = [];
  const exhaustedConnection = {
    async execute(sql, params) {
      exhaustedCalls.push({ sql, params });
      if (/SELECT[\s\S]+FROM durable_jobs/.test(sql)) {
        return [[{ job_id: "job-exhausted", status: "running", attempt_count: 3, max_attempts: 3 }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
  assert.deepEqual(await claimJobs({ workerId: "worker-1", limit: 1, leaseMs: 30_000 }, exhaustedConnection), []);
  assert.match(exhaustedCalls[0].sql, /status = 'running'[\s\S]+lease_until < CURRENT_TIMESTAMP/);
  const exhaustedUpdate = exhaustedCalls.find((call) => /UPDATE durable_jobs SET status = 'failed'/.test(call.sql));
  assert.ok(exhaustedUpdate);
  assert.ok(exhaustedCalls.some((call) => /UPDATE durable_job_attempts/.test(call.sql) && /finished_at/.test(call.sql)));

  await transitionJob({
    jobId: "job-1",
    from: "running",
    to: "waiting_approval",
    workerId: "worker-1",
    attemptNo: 1,
  }, connection);
  const transitionUpdate = calls.find((call) => /UPDATE durable_jobs SET status = \?, result_json/.test(call.sql));
  assert.match(transitionUpdate.sql, /lease_owner = \?/);
  assert.match(transitionUpdate.sql, /lease_until > CURRENT_TIMESTAMP/);
  assert.match(transitionUpdate.sql, /attempt_count = \?/);
  assert.ok(calls.some((call) => /UPDATE durable_job_attempts/.test(call.sql) && /finished_at/.test(call.sql)));

  const compensationCalls = [];
  const compensationConnection = {
    async execute(sql, params) {
      compensationCalls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  await transitionJob({
    jobId: "job-compensating",
    from: "running",
    to: "compensating",
    workerId: "worker-1",
    attemptNo: 2,
  }, compensationConnection);
  assert.match(compensationCalls[0].sql, /lease_owner = lease_owner/);
  assert.equal(compensationCalls.some((call) => /UPDATE durable_job_attempts/.test(call.sql)), false);
  await transitionJob({
    jobId: "job-compensating",
    from: "compensating",
    to: "succeeded",
    workerId: "worker-1",
    attemptNo: 2,
  }, compensationConnection);
  assert.match(compensationCalls[1].sql, /lease_owner = NULL/);
  assert.ok(compensationCalls.some((call) => /UPDATE durable_job_attempts/.test(call.sql)));
  await approveJob({
    jobId: "job-1",
    approver: { id: 9 },
    reason: "Reviewed source contract",
    evidence: { ticket: "OPS-7" },
  }, connection);
  assert.ok(calls.some((call) => /INSERT INTO durable_job_approvals/.test(call.sql)));
  assert.throws(
    () => transitionJob({ jobId: "job-1", from: "pending", to: "succeeded", workerId: "worker-1", attemptNo: 1 }, connection),
    /invalid durable job transition/i,
  );
  assert.throws(
    () => transitionJob({ jobId: "job-1", from: "failed", to: "pending", workerId: "worker-1", attemptNo: 1 }, connection),
    /invalid durable job transition/i,
  );
});

test("stale durable-job workers fail closed before finishing an attempt", async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/UPDATE durable_jobs SET status/.test(sql)) return [{ affectedRows: 0 }];
      throw new Error("stale worker must not finish its attempt");
    },
  };
  await assert.rejects(
    transitionJob({
      jobId: "job-1",
      from: "running",
      to: "succeeded",
      workerId: "worker-stale",
      attemptNo: 1,
    }, connection),
    (error) => error?.code === "JOB_LEASE_CONFLICT" && /lease fencing conflict/i.test(error.message),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls.some((call) => /UPDATE durable_job_attempts/.test(call.sql)), false);
});

test("claimJobs recovers an expired compensating lease with a new fenced attempt", async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/SELECT[\s\S]+FROM durable_jobs/.test(sql)) {
        return [[{
          job_id: "job-compensating",
          status: "compensating",
          attempt_count: 2,
          max_attempts: 4,
          lease_owner: "worker-dead",
        }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
  const jobs = await claimJobs({ workerId: "worker-recovery", limit: 1, leaseMs: 30_000 }, connection);
  assert.match(calls[0].sql, /status = 'compensating'[\s\S]+lease_until < CURRENT_TIMESTAMP/);
  assert.deepEqual(jobs, [{
    jobId: "job-compensating",
    status: "compensating",
    leaseOwner: "worker-recovery",
    attemptNo: 3,
  }]);
  const claimUpdate = calls.find((call) => /UPDATE durable_jobs SET status/.test(call.sql));
  assert.equal(claimUpdate.params[0], "compensating");
  const oldAttemptCloseIndex = calls.findIndex((call) => /UPDATE durable_job_attempts/.test(call.sql) && /finished_at/.test(call.sql));
  const newAttemptIndex = calls.findIndex((call) => /INSERT INTO durable_job_attempts/.test(call.sql));
  assert.ok(oldAttemptCloseIndex > 0);
  assert.ok(newAttemptIndex > oldAttemptCloseIndex);
});

test("claimJobs reaps an exhausted compensating lease into failed and closes its last attempt", async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/SELECT[\s\S]+FROM durable_jobs/.test(sql)) {
        return [[{
          job_id: "job-exhausted-compensation",
          status: "compensating",
          attempt_count: 4,
          max_attempts: 4,
          lease_owner: "worker-dead",
        }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
  assert.deepEqual(await claimJobs({ workerId: "worker-recovery", limit: 1, leaseMs: 30_000 }, connection), []);
  const jobUpdate = calls.find((call) => /UPDATE durable_jobs SET status = 'failed'/.test(call.sql));
  assert.equal(jobUpdate.params[3], "compensating");
  assert.match(jobUpdate.sql, /attempt_count = \?/);
  assert.ok(calls.some((call) => /UPDATE durable_job_attempts/.test(call.sql) && /status = 'failed'/.test(call.sql)));
  assert.equal(calls.some((call) => /INSERT INTO durable_job_attempts/.test(call.sql)), false);
});

function transactionalDatabase() {
  const committed = [];
  const connections = [];
  return {
    committed,
    connections,
    runtime: {
      pool: {
        async getConnection() {
          const pending = [];
          const connection = {
            began: 0,
            committed: 0,
            rolledBack: 0,
            released: 0,
            async beginTransaction() { this.began += 1; },
            async commit() { this.committed += 1; committed.push(...pending); },
            async rollback() { this.rolledBack += 1; pending.length = 0; },
            release() { this.released += 1; },
            async execute(sql, params = []) {
              if (/SELECT[\s\S]+FROM cli_commands/.test(sql)) return [[]];
              pending.push({ sql, params });
              return [{ affectedRows: 1 }];
            },
          };
          connections.push(connection);
          return connection;
        },
      },
      async testConnection() {},
      async close() {},
    },
  };
}

test("execution context commits business, command, audit, outbox, and result on one injected connection", async () => {
  const database = transactionalDatabase();
  await runWithExecutionContext({ databaseRuntime: database.runtime }, async () => {
    const outer = getExecutionContext();
    assert.equal(typeof outer.transaction, "function");
    await outer.transaction(async (connection) => {
      assert.equal(getExecutionContext().connection, connection);
      await connection.execute("INSERT INTO business_fixture (id) VALUES (?)", [1]);
      const accepted = await acceptCommand({
        idempotencyKey: "idem-atomic",
        capabilityId: "fixture.write",
        actor: { id: 7 },
        projectId: 12,
        inputDigest: "c".repeat(64),
      }, connection);
      await appendAuditFact({
        auditId: "audit-atomic",
        commandId: accepted.commandId,
        capabilityId: "fixture.write",
        actor: { id: 7 },
        projectId: 12,
        outcome: "succeeded",
        detail: { fixtureId: 1 },
      }, connection);
      await appendEvent({
        eventId: "event-atomic",
        eventType: "fixture.written",
        aggregate: { type: "fixture", id: "1", version: 1 },
        payload: { fixtureId: 1 },
        actor: { id: 7 },
        projectId: 12,
        auditId: "audit-atomic",
        commandId: accepted.commandId,
      }, connection);
      await completeCommand({ commandId: accepted.commandId, resultRef: "fixture://1", result: { fixtureId: 1 } }, connection);
    });
  });
  const sql = database.committed.map((entry) => entry.sql).join("\n");
  assert.match(sql, /INSERT INTO business_fixture/);
  assert.match(sql, /INSERT INTO cli_commands/);
  assert.match(sql, /INSERT INTO cli_audit_facts/);
  assert.match(sql, /INSERT INTO domain_events/);
  assert.match(sql, /UPDATE cli_commands/);
  assert.equal(database.connections[0].began, 1);
  assert.equal(database.connections[0].committed, 1);
  assert.equal(database.connections[0].rolledBack, 0);
  assert.equal(database.connections[0].released, 1);
});

test("execution context rolls back every staged write when a transaction step fails", async () => {
  const database = transactionalDatabase();
  await assert.rejects(
    runWithExecutionContext({ databaseRuntime: database.runtime }, async () => {
      await getExecutionContext().transaction(async (connection) => {
        await connection.execute("INSERT INTO business_fixture (id) VALUES (?)", [2]);
        await acceptCommand({
          idempotencyKey: "idem-rollback",
          capabilityId: "fixture.write",
          actor: { id: 7 },
          projectId: 12,
          inputDigest: "d".repeat(64),
        }, connection);
        await appendAuditFact({
          auditId: "audit-rollback",
          commandId: "command-rollback",
          capabilityId: "fixture.write",
          actor: { id: 7 },
          projectId: 12,
          outcome: "failed",
          detail: {},
        }, connection);
        await appendEvent({
          eventId: "event-rollback",
          eventType: "fixture.failed",
          aggregate: { type: "fixture", id: "2", version: 1 },
          payload: { fixtureId: 2 },
          actor: { id: 7 },
          projectId: 12,
          auditId: "audit-rollback",
          commandId: "command-rollback",
        }, connection);
        throw new Error("forced transaction failure");
      });
    }),
    /forced transaction failure/,
  );
  assert.deepEqual(database.committed, []);
  assert.equal(database.connections[0].committed, 0);
  assert.equal(database.connections[0].rolledBack, 1);
  assert.equal(database.connections[0].released, 1);
});

test("execution context preserves the primary error when rollback also fails", async () => {
  const primary = new Error("business failure");
  const rollback = new Error("rollback failure");
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() { throw rollback; },
    release() {},
  };
  const runtime = { pool: { async getConnection() { return connection; } } };
  await assert.rejects(
    runWithExecutionContext({ databaseRuntime: runtime }, async () => {
      await getExecutionContext().transaction(async () => { throw primary; });
    }),
    (error) => error === primary && error.rollbackError === rollback,
  );
});

test("execution context retries a deadlocked transaction on a fresh connection", async () => {
  const connections = [];
  const runtime = {
    pool: {
      async getConnection() {
        const attempt = connections.length + 1;
        const connection = {
          attempt,
          committed: 0,
          rolledBack: 0,
          released: 0,
          async beginTransaction() {},
          async commit() { this.committed += 1; },
          async rollback() { this.rolledBack += 1; },
          release() { this.released += 1; },
        };
        connections.push(connection);
        return connection;
      },
    },
  };
  let handlerCalls = 0;
  const result = await runWithExecutionContext({ databaseRuntime: runtime }, async () => (
    getExecutionContext().transaction(async (connection) => {
      handlerCalls += 1;
      if (connection.attempt === 1) {
        const error = new Error("deadlock");
        error.code = "ER_LOCK_DEADLOCK";
        throw error;
      }
      return "committed";
    })
  ));
  assert.equal(result, "committed");
  assert.equal(handlerCalls, 2);
  assert.equal(connections.length, 2);
  assert.equal(connections[0].rolledBack, 1);
  assert.equal(connections[0].released, 1);
  assert.equal(connections[1].committed, 1);
  assert.equal(connections[1].released, 1);
});

test("live disposable MySQL schema gate is explicit", {
  skip: "blocked: no disposable MySQL configured; Task 18 must supply and run the real schema harness",
}, () => {});
