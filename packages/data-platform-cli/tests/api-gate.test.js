const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const { baseline, apiCapabilityIds, readEvidence, validateApiEvidence } = require("./gate-harness");
const { startExternalApiServer } = require("./fixtures/external-api-server");
const { startModelProviderServer } = require("./fixtures/model-provider-server");

function isLoopbackHost(host) {
  return /^(?:localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(String(host || ""));
}

function validateApiReleaseEvidence(evidence) {
  const baselineResult = validateApiEvidence(evidence);
  if (baselineResult.status === "blocked") return baselineResult;
  const failures = [...baselineResult.failures];
  const fingerprint = evidence?.providerFingerprint;
  if (!fingerprint || typeof fingerprint !== "object") {
    failures.push("approved real-provider fingerprint is required");
  } else {
    if (!fingerprint.provider || !fingerprint.endpointHost || !/^[a-f0-9]{64}$/i.test(fingerprint.fingerprintSha256 || "")) {
      failures.push("provider fingerprint must identify a provider, non-secret endpoint host, and SHA-256 digest");
    }
    if (isLoopbackHost(fingerprint.endpointHost)) failures.push("loopback fixtures cannot be release evidence");
  }
  const records = Array.isArray(evidence?.executions) ? evidence.executions : [];
  const expected = apiCapabilityIds();
  const recordIds = records.map((record) => record?.capabilityId).filter(Boolean);
  const missing = expected.filter((id) => recordIds.filter((recordId) => recordId === id).length !== 1);
  const unknown = recordIds.filter((id) => !expected.includes(id));
  if (missing.length) failures.push(`untested command evidence: ${missing.join(", ")}`);
  if (unknown.length) failures.push(`unknown command evidence: ${[...new Set(unknown)].join(", ")}`);
  for (const record of records) {
    if (record?.binary !== "data-platform" || record.exitCode !== 0) {
      failures.push(`installed command execution is required for ${record?.capabilityId || "unknown capability"}`);
    }
    if (!["json", "ndjson"].includes(record?.stdoutFormat)) {
      failures.push(`JSON or NDJSON command output is required for ${record?.capabilityId || "unknown capability"}`);
    }
    if (!record?.auditId || !record?.eventId || !/^[a-f0-9]{64}$/i.test(record?.idempotencyKeyHash || "")) {
      failures.push(`redacted audit, event, and idempotency references are required for ${record?.capabilityId || "unknown capability"}`);
    }
  }
  if (/password|secret|token|authorization|api[_-]?key|credential/i.test(JSON.stringify({ fingerprint, records }))) {
    failures.push("release evidence contains a sensitive field name");
  }
  return { ...baselineResult, status: failures.length ? "failed" : "accepted", failures };
}

async function readNdjson(response) {
  const text = await response.text();
  return text.trim().split("\n").map((line) => JSON.parse(line));
}

test("controlled external API fixture preserves success, pagination, rate-limit, retry, and malformed contracts", async (t) => {
  const server = await startExternalApiServer({ retryFailures: 1 });
  t.after(() => server.close());

  const success = await fetch(`${server.baseUrl}/success`);
  assert.deepEqual(await success.json(), { data: { source: "controlled-external-api", status: "ok" } });

  const page = await fetch(`${server.baseUrl}/pages?page=2`);
  assert.deepEqual(await page.json(), { data: ["row-3", "row-4"], nextPage: null });

  const limited = await fetch(`${server.baseUrl}/rate-limit`);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "1");

  const firstAttempt = await fetch(`${server.baseUrl}/retry`);
  assert.equal(firstAttempt.status, 503);
  const retry = await fetch(`${server.baseUrl}/retry`);
  assert.deepEqual(await retry.json(), { data: { attempt: 2, retried: true } });
  assert.equal(server.state.retryAttempts, 2);

  const malformed = await fetch(`${server.baseUrl}/malformed`);
  assert.equal(malformed.status, 200);
  await assert.rejects(malformed.json(), SyntaxError);
});

test("controlled external API fixture supports NDJSON streaming, timeout, and cancellation", async (t) => {
  const server = await startExternalApiServer();
  t.after(() => server.close());

  const stream = await fetch(`${server.baseUrl}/stream`);
  assert.deepEqual(await readNdjson(stream), [
    { event: "progress", sequence: 1 },
    { event: "complete", sequence: 2 },
  ]);

  await assert.rejects(
    fetch(`${server.baseUrl}/timeout`, { signal: AbortSignal.timeout(20) }),
    (error) => error.name === "TimeoutError",
  );

  const cancellation = new AbortController();
  const pending = fetch(`${server.baseUrl}/cancel`, { signal: cancellation.signal });
  await once(server.state, "cancellable-request");
  cancellation.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  await once(server.state, "cancelled");
  assert.equal(server.state.cancelledRequests, 1);
});

test("controlled model-provider fixture supports model discovery and streaming completion", async (t) => {
  const server = await startModelProviderServer();
  t.after(() => server.close());

  const models = await fetch(`${server.baseUrl}/v1/models`);
  assert.deepEqual(await models.json(), { object: "list", data: [{ id: "controlled-model", object: "model" }] });

  const completion = await fetch(`${server.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "controlled-model", stream: true, messages: [{ role: "user", content: "hello" }] }),
  });
  assert.equal(completion.headers.get("content-type"), "text/event-stream");
  assert.match(await completion.text(), /data: \{"choices":\[\{"delta":\{"content":"hello"\}\}\]\}/);
});

test("API gate enumerates every classified capability", () => {
  assert.equal(apiCapabilityIds().length, baseline.gates.apiClassified);
});

test("API release evidence rejects loopback fixtures and requires one installed-command record per capability", () => {
  const fixture = {
    kind: "api",
    real: true,
    mock: false,
    bypassCount: 0,
    secretFindings: 0,
    capabilityIds: apiCapabilityIds(),
    environmentFingerprint: { node: process.version },
    providerFingerprint: { provider: "controlled", endpointHost: "127.0.0.1", fingerprintSha256: "a".repeat(64) },
    executions: apiCapabilityIds().map((capabilityId) => ({
      capabilityId,
      binary: "data-platform",
      exitCode: 0,
      stdoutFormat: "json",
      auditId: "audit-redacted",
      eventId: "event-redacted",
      idempotencyKeyHash: "b".repeat(64),
    })),
  };
  const rejected = validateApiReleaseEvidence(fixture);
  assert.equal(rejected.status, "failed");
  assert.match(rejected.failures.join("\n"), /loopback/);

  fixture.providerFingerprint.endpointHost = "provider.example.test";
  fixture.executions.pop();
  const incomplete = validateApiReleaseEvidence(fixture);
  assert.equal(incomplete.status, "failed");
  assert.match(incomplete.failures.join("\n"), /untested command evidence/);
});

test("API gate requires complete real non-mock evidence", () => {
  const requested = process.env.CLI_API_GATE === "1";
  const result = validateApiReleaseEvidence(readEvidence(process.env.CLI_API_GATE_EVIDENCE));
  if (requested) assert.equal(result.status, "accepted", result.failures.join("\n"));
  else assert.equal(result.status, process.env.CLI_API_GATE_EVIDENCE ? "accepted" : "blocked", result.failures.join("\n"));
});
