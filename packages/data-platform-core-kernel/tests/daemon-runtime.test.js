const assert = require("node:assert/strict");
const test = require("node:test");

const { createOutboxPublisher } = require("../src/infrastructure/outbox-publisher");
const { createInboxConsumer } = require("../src/infrastructure/inbox-consumer");
const { createJobWorker } = require("../src/infrastructure/job-worker");
const { createDaemonRuntime } = require("../src/infrastructure/daemon-runtime");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, reject, resolve };
}

function transactionalConnection(execute) {
  const timeline = [];
  return {
    timeline,
    transaction: async (handler) => {
      timeline.push("begin");
      try {
        const result = await handler({ execute });
        timeline.push("commit");
        return result;
      } catch (error) {
        timeline.push("rollback");
        throw error;
      }
    },
  };
}

function outboxRow(overrides = {}) {
  return {
    event_id: "event-1",
    event_type: "project.updated",
    event_version: 1,
    occurred_at: "2026-08-13T00:00:00.000Z",
    project_id: 12,
    aggregate_type: "project",
    aggregate_id: "44",
    actor_json: JSON.stringify({ id: 7 }),
    command_id: "command-1",
    audit_id: "audit-1",
    correlation_id: null,
    causation_id: null,
    contract_version: 1,
    payload_json: JSON.stringify({ name: "Aviation" }),
    payload_sha256: "a".repeat(64),
    attempt_count: 0,
    ...overrides,
  };
}

test("publishBatch publishes committed Outbox rows with ordered entity keys and immutable events", async () => {
  const row = outboxRow();
  let committed = false;
  const sql = [];
  const timeline = [];
  const transaction = async (handler) => {
    timeline.push("begin");
    const connection = {
      async execute(statement, params) {
        sql.push({ statement, params });
        if (/SELECT[\s\S]+FROM domain_events/.test(statement)) return [[row]];
        return [{ affectedRows: 1 }];
      },
    };
    const result = await handler(connection);
    committed = true;
    timeline.push("commit");
    return result;
  };
  const sent = [];
  const producer = {
    async send(message) {
      assert.equal(committed, true, "Kafka publish must happen after the claim transaction commits");
      timeline.push("publish");
      sent.push(message);
      return [{ partition: 3, baseOffset: "91" }];
    },
  };
  const publisher = createOutboxPublisher({
    transaction,
    producer,
    topic: "data-platform.events",
    destination: "kafka:data-platform.events",
    workerId: "publisher-1",
  });
  assert.deepEqual(await publisher.publishBatch({ limit: 10, leaseMs: 30_000 }), {
    claimed: 1,
    published: 1,
    failed: 0,
  });
  assert.deepEqual(timeline.slice(0, 5), ["begin", "commit", "begin", "commit", "publish"]);
  assert.equal(sent[0].messages[0].key, "12:project:44");
  assert.equal(JSON.parse(sent[0].messages[0].value).eventId, "event-1");
  assert.equal(sql.some(({ statement }) => /UPDATE\s+domain_events/i.test(statement)), false);
  assert.ok(sql.some(({ statement }) => /UPDATE event_deliveries/.test(statement) && /kafka_offset/.test(statement)));
});

test("publishBatch records retry backoff and dead-letter without mutating event bodies", async () => {
  const rows = [
    [outboxRow({ event_id: "retry-event", attempt_count: 0 })],
    [outboxRow({ event_id: "dead-event", attempt_count: 2 })],
    [],
  ];
  const writes = [];
  const transaction = async (handler) => handler({
    async execute(statement, params) {
      writes.push({ statement, params });
      if (/SELECT[\s\S]+FROM domain_events/.test(statement)) return [rows.shift()];
      return [{ affectedRows: 1 }];
    },
  });
  const publisher = createOutboxPublisher({
    transaction,
    producer: { async send() { const error = new Error("broker unavailable"); error.retryable = true; throw error; } },
    topic: "data-platform.events",
    destination: "kafka:data-platform.events",
    workerId: "publisher-1",
    maxAttempts: 3,
    backoffMs: (attempt) => attempt * 1_000,
  });
  assert.deepEqual(await publisher.publishBatch({ limit: 10, leaseMs: 30_000 }), {
    claimed: 2,
    published: 0,
    failed: 2,
  });
  const failures = writes.filter(({ statement }) => /UPDATE event_deliveries/.test(statement) && /last_error_json/.test(statement));
  assert.equal(failures.length, 2);
  assert.equal(failures[0].params[0], "failed");
  assert.equal(failures[0].params[3], 1_000);
  assert.equal(failures[1].params[0], "dead_letter");
  assert.equal(failures[1].params[3], null);
  assert.equal(writes.some(({ statement }) => /UPDATE\s+domain_events/i.test(statement)), false);
});

test("Inbox duplicate delivery is skipped while projection and Inbox share one transaction", async () => {
  let duplicate = false;
  let projections = 0;
  const connection = transactionalConnection(async (statement) => {
    if (/INSERT INTO event_inbox/.test(statement)) {
      if (duplicate) { const error = new Error("duplicate"); error.code = "ER_DUP_ENTRY"; throw error; }
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 1 }];
  });
  const consumer = createInboxConsumer({ transaction: connection.transaction });
  const event = { eventId: "event-1", projectId: 12, payload: { name: "Aviation" } };
  const first = await consumer.consumeEvent("projection-a", event, async (_value, db) => {
    projections += 1;
    await db.execute("INSERT INTO projection_fixture (event_id) VALUES (?)", [event.eventId]);
  });
  duplicate = true;
  const second = await consumer.consumeEvent("projection-a", event, async () => { projections += 1; });
  assert.deepEqual(first, { duplicate: false, processed: true, eventId: "event-1" });
  assert.deepEqual(second, { duplicate: true, processed: false, eventId: "event-1" });
  assert.equal(projections, 1);
  assert.deepEqual(connection.timeline, ["begin", "commit", "begin", "commit"]);
});

test("Inbox handler failure rolls back the deduplication insert and projection together", async () => {
  const connection = transactionalConnection(async () => [{ affectedRows: 1 }]);
  const consumer = createInboxConsumer({ transaction: connection.transaction });
  await assert.rejects(
    consumer.consumeEvent("projection-a", { eventId: "event-2", projectId: 12, payload: {} }, async () => {
      throw new Error("projection failed");
    }),
    /projection failed/,
  );
  assert.deepEqual(connection.timeline, ["begin", "rollback"]);
});

test("job worker retries with backoff, dead-letters permanent failures, and compensates explicitly", async () => {
  const jobs = [
    { jobId: "retry", jobType: "retry", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {}, actor: { id: 7 }, projectId: 12 },
    { jobId: "dead", jobType: "dead", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {}, actor: { id: 7 }, projectId: 12 },
    { jobId: "compensate", jobType: "compensate", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {}, actor: { id: 7 }, projectId: 12 },
  ];
  const operations = [];
  const repository = {
    async claimJobs() { return jobs.length ? [jobs.shift()] : []; },
    async renewLease() {},
    async scheduleRetry(input) { operations.push(["retry", input]); },
    async transitionJob(input) { operations.push(["transition", input]); },
  };
  const retry = new Error("temporary"); retry.retryable = true;
  const dead = new Error("invalid input");
  const compensate = new Error("partial external write"); compensate.compensate = true;
  const worker = createJobWorker({
    transaction: async (handler) => handler({}),
    repository,
    authorize: async (job) => operations.push(["authorize", job.jobId]),
    handlers: {
      retry: async () => { throw retry; },
      dead: async () => { throw dead; },
      compensate: Object.freeze({
        async run() { throw compensate; },
        async compensate() { operations.push(["compensated", "compensate"]); },
      }),
    },
    backoffMs: (attempt) => attempt * 2_000,
  });
  assert.deepEqual(await worker.runBatch({ workerId: "worker-1", limit: 5, leaseMs: 30_000 }), {
    claimed: 3,
    succeeded: 1,
    retried: 1,
    failed: 1,
  });
  assert.equal(operations.find(([type]) => type === "retry")[1].delayMs, 2_000);
  assert.ok(operations.some(([type, value]) => type === "transition" && value.jobId === "dead" && value.to === "failed"));
  assert.ok(operations.some(([type, value]) => type === "transition" && value.jobId === "compensate" && value.to === "compensating"));
  assert.ok(operations.some(([type]) => type === "compensated"));
  assert.ok(operations.some(([type, value]) => type === "transition" && value.jobId === "compensate" && value.from === "compensating" && value.to === "succeeded"));
});

test("recovered compensating jobs run only compensation and each job is claimed separately", async () => {
  const claims = [
    [{ jobId: "recover", jobType: "write", status: "compensating", attemptNo: 2, maxAttempts: 3, leaseOwner: "worker-1", input: {} }],
    [{ jobId: "normal", jobType: "write", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {} }],
    [],
  ];
  const calls = [];
  const repository = {
    async claimJobs(input) { calls.push(["claim", input.limit]); return claims.shift(); },
    async renewLease() {},
    async transitionJob(input) { calls.push(["transition", input]); },
  };
  const worker = createJobWorker({
    transaction: async (handler) => handler({}),
    repository,
    authorize: async () => {},
    handlers: {
      write: {
        async run() { calls.push(["run"]); },
        async compensate() { calls.push(["compensate"]); },
      },
    },
  });
  assert.deepEqual(await worker.runBatch({ workerId: "worker-1", limit: 5, leaseMs: 30_000 }), {
    claimed: 2, succeeded: 2, retried: 0, failed: 0,
  });
  assert.deepEqual(calls.filter(([name]) => name === "claim").map(([, limit]) => limit), [1, 1, 1]);
  assert.deepEqual(calls.filter(([name]) => ["run", "compensate"].includes(name)).map(([name]) => name), ["compensate", "run"]);
  assert.ok(calls.some(([name, input]) => name === "transition" && input.jobId === "recover" && input.from === "compensating" && input.to === "succeeded"));
});

test("publisher claims one event at a time and fails closed when delivery fencing is lost", async () => {
  const rows = [[outboxRow()], []];
  const transaction = async (handler) => handler({
    async execute(statement) {
      if (/SELECT[\s\S]+FROM domain_events/.test(statement)) return [rows.shift()];
      if (/UPDATE event_deliveries SET lease_until/.test(statement)) return [{ affectedRows: 1 }];
      if (/UPDATE event_deliveries SET status = 'published'/.test(statement)) return [{ affectedRows: 0 }];
      return [{ affectedRows: 1 }];
    },
  });
  const publisher = createOutboxPublisher({
    transaction,
    producer: { async send() { return [{ partition: 0, baseOffset: "1" }]; } },
    topic: "events", destination: "kafka:events", workerId: "publisher-1",
  });
  await assert.rejects(
    publisher.publishBatch({ limit: 2, leaseMs: 30_000 }),
    (error) => error?.code === "OUTBOX_LEASE_CONFLICT",
  );
});

test("publisher renews its lease throughout a slow Kafka send", async () => {
  const rows = [[outboxRow()], []];
  let renewals = 0;
  const publisher = createOutboxPublisher({
    transaction: async (handler) => handler({
      async execute(statement) {
        if (/SELECT[\s\S]+FROM domain_events/.test(statement)) return [rows.shift()];
        if (/SET lease_until/.test(statement)) { renewals += 1; return [{ affectedRows: 1 }]; }
        return [{ affectedRows: 1 }];
      },
    }),
    producer: { async send() { await new Promise((resolve) => setTimeout(resolve, 45)); return [{ partition: 0, baseOffset: "1" }]; } },
    topic: "events", destination: "kafka:events", workerId: "publisher-1",
  });
  assert.deepEqual(await publisher.publishBatch({ limit: 1, leaseMs: 30 }), { claimed: 1, published: 1, failed: 0 });
  assert.ok(renewals >= 2);
});

test("job worker heartbeats slow work and aborts a cancellable handler after lease loss", async () => {
  const jobs = [
    { jobId: "slow", jobType: "slow", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {} },
  ];
  let renewals = 0;
  let aborted = false;
  const repository = {
    async claimJobs() { return jobs.length ? [jobs.shift()] : []; },
    async renewLease() {
      renewals += 1;
      if (renewals === 2) { const error = new Error("lease lost"); error.code = "JOB_LEASE_CONFLICT"; throw error; }
    },
    async transitionJob() { throw new Error("must not transition after lease loss"); },
  };
  const worker = createJobWorker({
    transaction: async (handler) => handler({}),
    repository,
    authorize: async () => {},
    handlers: {
      slow: async (_input, job) => new Promise((resolve, reject) => {
        job.signal.addEventListener("abort", () => { aborted = true; reject(job.signal.reason); }, { once: true });
      }),
    },
  });
  await assert.rejects(worker.runBatch({ workerId: "worker-1", limit: 1, leaseMs: 30 }), (error) => error?.code === "JOB_LEASE_CONFLICT");
  assert.equal(aborted, true);
});

test("job worker renews a lease through slow successful work", async () => {
  const jobs = [{ jobId: "slow-ok", jobType: "slow", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {} }];
  let renewals = 0;
  let transitions = 0;
  const worker = createJobWorker({
    transaction: async (handler) => handler({}),
    repository: {
      async claimJobs() { return jobs.length ? [jobs.shift()] : []; },
      async renewLease() { renewals += 1; },
      async transitionJob() { transitions += 1; },
    },
    authorize: async () => {},
    handlers: { slow: async () => { await new Promise((resolve) => setTimeout(resolve, 45)); } },
  });
  assert.deepEqual(await worker.runBatch({ workerId: "worker-1", limit: 1, leaseMs: 30 }), {
    claimed: 1, succeeded: 1, retried: 0, failed: 0,
  });
  assert.ok(renewals >= 2);
  assert.equal(transitions, 1);
});

test("immediate compensation gets its own compensating heartbeat", async () => {
  const jobs = [{ jobId: "compensate-slow", jobType: "write", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {} }];
  const renewalStatuses = [];
  const transitions = [];
  const partial = new Error("partial write"); partial.compensate = true;
  const worker = createJobWorker({
    transaction: async (handler) => handler({}),
    repository: {
      async claimJobs() { return jobs.length ? [jobs.shift()] : []; },
      async renewLease(input) { renewalStatuses.push(input.status); },
      async transitionJob(input) { transitions.push(input); },
    },
    authorize: async () => {},
    handlers: {
      write: {
        async run() { throw partial; },
        async compensate(_input, job) {
          assert.equal(job.status, "compensating");
          assert.equal(job.signal.aborted, false);
          await new Promise((resolve) => setTimeout(resolve, 45));
        },
      },
    },
  });
  assert.deepEqual(await worker.runBatch({ workerId: "worker-1", limit: 1, leaseMs: 30 }), {
    claimed: 1, succeeded: 1, retried: 0, failed: 0,
  });
  assert.ok(renewalStatuses.filter((status) => status === "compensating").length >= 2);
  assert.deepEqual(transitions.map(({ from, to }) => `${from}->${to}`), ["running->compensating", "compensating->succeeded"]);
});

test("immediate compensation aborts and leaves no terminal write when its lease is lost", async () => {
  const jobs = [{ jobId: "compensate-lost", jobType: "write", status: "running", attemptNo: 1, maxAttempts: 3, leaseOwner: "worker-1", input: {} }];
  const transitions = [];
  let renewals = 0;
  let aborted = false;
  const partial = new Error("partial write"); partial.compensate = true;
  const worker = createJobWorker({
    transaction: async (handler) => handler({}),
    repository: {
      async claimJobs() { return jobs.length ? [jobs.shift()] : []; },
      async renewLease() {
        renewals += 1;
        if (renewals === 2) { const error = new Error("lease lost"); error.code = "JOB_LEASE_CONFLICT"; throw error; }
      },
      async transitionJob(input) { transitions.push(input); },
    },
    authorize: async () => {},
    handlers: {
      write: {
        async run() { throw partial; },
        async compensate(_input, job) {
          return new Promise((_resolve, reject) => {
            job.signal.addEventListener("abort", () => { aborted = true; reject(job.signal.reason); }, { once: true });
          });
        },
      },
    },
  });
  await assert.rejects(worker.runBatch({ workerId: "worker-1", limit: 1, leaseMs: 30 }), (error) => error?.code === "JOB_LEASE_CONFLICT");
  assert.equal(aborted, true);
  assert.deepEqual(transitions.map(({ from, to }) => `${from}->${to}`), ["running->compensating"]);
});

test("publisher reports lease conflict after an uncancellable send and never counts success", async () => {
  const rows = [[outboxRow()], []];
  let renewals = 0;
  let deliveryUpdates = 0;
  const publisher = createOutboxPublisher({
    transaction: async (handler) => handler({
      async execute(statement) {
        if (/SELECT[\s\S]+FROM domain_events/.test(statement)) return [rows.shift()];
        if (/SET lease_until/.test(statement)) {
          renewals += 1;
          return [{ affectedRows: renewals < 2 ? 1 : 0 }];
        }
        if (/UPDATE event_deliveries SET status/.test(statement)) deliveryUpdates += 1;
        return [{ affectedRows: 1 }];
      },
    }),
    producer: { async send() { await new Promise((resolve) => setTimeout(resolve, 45)); return []; } },
    topic: "events", destination: "kafka:events", workerId: "publisher-1",
  });
  await assert.rejects(publisher.publishBatch({ limit: 1, leaseMs: 30 }), (error) => error?.code === "OUTBOX_LEASE_CONFLICT");
  assert.equal(deliveryUpdates, 0);
});

test("daemon runtime stops claiming, drains active work, checkpoints, and closes without listeners", async () => {
  const active = deferred();
  const entered = deferred();
  const timeline = [];
  const abort = new AbortController();
  const originalListen = require("node:net").Server.prototype.listen;
  require("node:net").Server.prototype.listen = function forbiddenListen() { throw new Error("listener forbidden"); };
  try {
    const runtime = createDaemonRuntime({
      loops: [{
        async runBatch() { timeline.push("batch-start"); entered.resolve(); await active.promise; timeline.push("batch-end"); },
      }],
      schedulers: [{ async start() { timeline.push("scheduler-start"); }, async stop() { timeline.push("scheduler-stop"); } }],
      checkpoint: async () => timeline.push("checkpoint"),
      resources: [{ async close() { timeline.push("resource-close"); } }],
      wait: async () => {},
    });
    const running = runtime.run({ signal: abort.signal, pollIntervalMs: 1 });
    await entered.promise;
    abort.abort();
    active.resolve();
    await running;
    assert.deepEqual(timeline, [
      "scheduler-start",
      "batch-start",
      "batch-end",
      "scheduler-stop",
      "checkpoint",
      "resource-close",
    ]);
  } finally {
    require("node:net").Server.prototype.listen = originalListen;
  }
});

test("daemon runtime retains primary and cleanup failures together", async () => {
  const primary = new Error("loop failed");
  const cleanup = new Error("close failed");
  const runtime = createDaemonRuntime({
    loops: [{ async runBatch() { throw primary; } }],
    resources: [{ async close() { throw cleanup; } }],
  });
  await assert.rejects(runtime.run({ signal: new AbortController().signal }), (error) => {
    assert.equal(error, primary);
    assert.deepEqual(error.cleanupErrors, [cleanup]);
    return true;
  });
});

test("real Kafka/MySQL daemon gate is explicit", {
  skip: "blocked: Task 17/18 must provide disposable Kafka and MySQL infrastructure",
}, () => {});
