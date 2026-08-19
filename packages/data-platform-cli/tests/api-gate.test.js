const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const net = require("node:net");
const dns = require("node:dns/promises");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const { baseline, apiCapabilityIds } = require("./gate-harness");
const { createCapabilityCatalog } = require("@johnason/data-platform-core");
const { createDomainCommands } = require("../src/registry/domain-commands");
const { startExternalApiServer } = require("./fixtures/external-api-server");
const { startModelProviderServer } = require("./fixtures/model-provider-server");
const serviceRuntimeContract = require("./fixtures/service-runtime-contract.json");

function normalizeHost(host) {
  const value = String(host || "").trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!value) throw new TypeError("endpoint host is required");
  return value.startsWith("::ffff:") ? value.slice("::ffff:".length) : value;
}

function isLoopbackAddress(address) {
  const host = normalizeHost(address);
  if (host === "localhost" || host === "0.0.0.0" || host === "::" || host === "::1") return true;
  if (net.isIP(host) === 4) return host.startsWith("127.");
  return false;
}

async function assertApprovedEndpoint(host, allowedHosts, lookup = dns.lookup) {
  const normalized = normalizeHost(host);
  const allowed = new Set((allowedHosts || []).map(normalizeHost));
  if (!allowed.has(normalized)) throw new Error("endpoint host is not in the approved endpoint allowlist");
  if (isLoopbackAddress(normalized)) throw new Error("loopback endpoint is forbidden");
  const addresses = net.isIP(normalized) ? [{ address: normalized }] : await lookup(normalized, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isLoopbackAddress(address))) {
    throw new Error("endpoint host resolves to a loopback address");
  }
  return normalized;
}

function readApprovedCases(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.cases)) throw new TypeError("approved command-case file must include cases");
  return parsed;
}

function isSafeCaseArgument(value) {
  return typeof value === "string" && !/password|secret|token|authorization|credential/i.test(value);
}

function commandDefinition(capabilityId) {
  return createDomainCommands(createCapabilityCatalog()).find((definition) => definition.capabilityIds.includes(capabilityId));
}

function parseJsonEnvelope(stdout) {
  const parsed = JSON.parse(stdout);
  if (!parsed?.success || !parsed.meta) throw new Error("command did not return a successful JSON envelope with metadata");
  return parsed;
}

async function runApprovedApiGate({ env = process.env, spawn = spawnSync, lookup = dns.lookup } = {}) {
  const endpointHost = env.CLI_API_GATE_APPROVED_ENDPOINT;
  const casesFile = env.CLI_API_GATE_CASES;
  const binary = env.CLI_API_GATE_BINARY;
  const profile = env.CLI_API_GATE_PROFILE;
  if (!endpointHost || !casesFile || !binary || !profile) {
    return { status: "blocked", failures: ["approved endpoint, case file, installed binary, and profile are required"] };
  }
  if (!serviceRuntimeContract.approvedEndpointAllowlist.length) {
    return { status: "blocked", failures: ["no provider endpoint is approved in the versioned allowlist"] };
  }
  const failures = [];
  let approvedHost;
  let configured;
  try {
    approvedHost = await assertApprovedEndpoint(endpointHost, serviceRuntimeContract.approvedEndpointAllowlist, lookup);
    if (!fs.existsSync(binary)) throw new Error("installed data-platform binary is missing");
    configured = readApprovedCases(casesFile);
    if (normalizeHost(configured.endpointHost) !== approvedHost) throw new Error("command-case endpoint does not match the approved endpoint");
  } catch (error) {
    return { status: "failed", failures: [error.message] };
  }
  const expected = apiCapabilityIds();
  const cases = new Map(configured.cases.map((entry) => [entry.capabilityId, entry]));
  for (const capabilityId of expected) {
    const entry = cases.get(capabilityId);
    if (!entry) {
      failures.push(`untested command case: ${capabilityId}`);
      continue;
    }
    if (!Array.isArray(entry.args) || entry.args.some((argument) => !isSafeCaseArgument(argument))) {
      failures.push(`unsafe command arguments: ${capabilityId}`);
      continue;
    }
    const definition = commandDefinition(capabilityId);
    if (!definition) {
      failures.push(`missing CLI definition: ${capabilityId}`);
      continue;
    }
    const apiIndex = definition.capabilityIds.indexOf(capabilityId);
    const idempotencyKey = `api-gate-${crypto.createHash("sha256").update(capabilityId).digest("hex").slice(0, 24)}`;
    const argv = ["--json", "--profile", profile, ...definition.command.split(" ")];
    if (definition.capabilityIds.length > 1) argv.push("--api-key", definition.sourceApiKeys[apiIndex]);
    argv.push(...entry.args, "--idempotency-key", idempotencyKey);
    const result = spawn(binary, argv, { encoding: "utf8", timeout: Number(env.CLI_API_GATE_TIMEOUT_MS || 120000) });
    if (result.error || result.status !== 0) {
      failures.push(`installed command failed: ${capabilityId}`);
      continue;
    }
    try {
      const envelope = parseJsonEnvelope(result.stdout);
      const meta = envelope.meta;
      if (normalizeHost(meta.providerEndpointHost) !== approvedHost) throw new Error("provider endpoint metadata mismatch");
      for (const field of serviceRuntimeContract.requiredEnvelopeMeta) {
        if (!meta[field]) throw new Error(`missing command metadata: ${field}`);
      }
      const expectedHash = crypto.createHash("sha256").update(idempotencyKey).digest("hex");
      if (meta.idempotencyKeyHash !== expectedHash) throw new Error("idempotency metadata mismatch");
    } catch (error) {
      failures.push(`${capabilityId}: ${error.message}`);
    }
  }
  for (const capabilityId of cases.keys()) {
    if (!expected.includes(capabilityId)) failures.push(`unknown command case: ${capabilityId}`);
  }
  return { status: failures.length ? "failed" : "accepted", failures, tested: expected.length - failures.length, expected: expected.length };
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
  const cancelled = once(server.state, "cancelled");
  cancellation.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  await cancelled;
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

test("approved command harness stays blocked without an approved endpoint and command-case file", async () => {
  const result = await runApprovedApiGate({ env: {} });
  assert.equal(result.status, "blocked");
  assert.match(result.failures.join("\n"), /approved endpoint/);
});

test("approved command harness remains blocked until a provider host is versioned into the allowlist", async () => {
  const result = await runApprovedApiGate({
    env: {
      CLI_API_GATE_APPROVED_ENDPOINT: "provider.example.test",
      CLI_API_GATE_CASES: "not-read-without-approval.json",
      CLI_API_GATE_BINARY: process.execPath,
      CLI_API_GATE_PROFILE: "approved-profile",
    },
    lookup: async () => [{ address: "203.0.113.1" }],
  });
  assert.equal(result.status, "blocked");
  assert.match(result.failures.join("\n"), /no provider endpoint is approved/);
});

test("approved endpoint validation rejects normalized and DNS-resolved loopback hosts", async () => {
  await assert.rejects(
    assertApprovedEndpoint("localhost.", ["localhost."], async () => [{ address: "203.0.113.1" }]),
    /loopback/,
  );
  await assert.rejects(
    assertApprovedEndpoint("provider.example.test", ["provider.example.test"], async () => [{ address: "::ffff:127.0.0.1" }]),
    /loopback/,
  );
});

test("service-runtime contract supplies the metadata consumed by real command evidence", () => {
  assert.deepEqual(serviceRuntimeContract.approvedEndpointAllowlist, []);
  assert.deepEqual(serviceRuntimeContract.requiredEnvelopeMeta, [
    "providerEndpointHost",
    "auditId",
    "eventId",
    "idempotencyKeyHash",
  ]);
});

test("API gate requires command-derived real evidence", async () => {
  const requested = process.env.CLI_API_GATE === "1";
  const result = await runApprovedApiGate();
  if (requested) assert.equal(result.status, "accepted", result.failures.join("\n"));
  else assert.equal(result.status, "blocked", result.failures.join("\n"));
});
