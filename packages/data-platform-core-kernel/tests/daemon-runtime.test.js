const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOutboxPublisher,
  createInboxConsumer,
  createJobWorker,
  createDaemonRuntime,
} = require("../src");

test("outbox publishes claimed events in order and records failures", async () => {
  const completed = [];
  const repository = {
    async claimBatch() { return [{ id: "a", key: "p:x:1" }, { id: "b", key: "p:x:1" }]; },
    async markPublished(id) { completed.push(["published", id]); },
    async markFailed(id, code) { completed.push(["failed", id, code]); },
  };
  const publisher = createOutboxPublisher({
    repository,
    producer: { async send(event) { if (event.id === "b") throw Object.assign(new Error("down"), { code: "KAFKA_DOWN" }); } },
  });
  assert.deepEqual(await publisher.publishBatch({ limit: 10, leaseMs: 1000 }), { claimed: 2, published: 1, failed: 1 });
  assert.deepEqual(completed, [["published", "a"], ["failed", "b", "KAFKA_DOWN"]]);
});

test("inbox makes duplicate delivery a no-op", async () => {
  let handled = 0;
  const consumer = createInboxConsumer({
    transaction: async (handler) => handler({}),
    inboxRepository: { async record(_connection, _consumer, event) { return { duplicate: event.id === "seen" }; } },
  });
  assert.deepEqual(await consumer.consumeEvent("projection", { id: "seen" }, async () => { handled += 1; }), { duplicate: true });
  assert.deepEqual(await consumer.consumeEvent("projection", { id: "new" }, async () => { handled += 1; }), { duplicate: false });
  assert.equal(handled, 1);
});

test("job worker reclaims jobs and uses explicit terminal states", async () => {
  const states = [];
  const worker = createJobWorker({
    repository: {
      async claimJobs() { return [{ id: "ok" }, { id: "bad" }]; },
      async succeed(id) { states.push([id, "succeeded"]); },
      async fail(id, code) { states.push([id, "failed", code]); },
    },
    handlers: new Map([
      ["ok", async () => ({ value: 1 })],
      ["bad", async () => { throw Object.assign(new Error("bad"), { code: "BROKEN" }); }],
    ]),
  });
  assert.deepEqual(await worker.runBatch({ workerId: "w", limit: 2, leaseMs: 1000 }), { claimed: 2, succeeded: 1, failed: 1 });
  assert.deepEqual(states, [["ok", "succeeded"], ["bad", "failed", "BROKEN"]]);
});

test("daemon starts loops without opening a network listener and stops gracefully", async () => {
  let iterations = 0;
  const daemon = createDaemonRuntime({
    intervalMs: 1,
    tasks: [async () => { iterations += 1; }],
  });
  assert.equal("listen" in daemon, false);
  const running = daemon.run();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await daemon.stop();
  await running;
  assert.ok(iterations > 0);
  assert.equal(daemon.status().running, false);
});
