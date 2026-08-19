const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
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
const apiGatePolicy = require("./fixtures/api-gate-policy.json");
const apiGateCases = require("./fixtures/api-gate-cases.json");

const workspaceRoot = path.resolve(__dirname, "../../..");
const installPrefix = path.join(workspaceRoot, ".local", "data-platform-cli", "install");
const packageRoot = path.resolve(__dirname, "..");

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function findVerifiedLocalInstall() {
  const prefix = fs.realpathSync(installPrefix);
  const packageJson = path.join(prefix, "node_modules", "@johnason", "data-platform-cli", "package.json");
  const packagePath = fs.realpathSync(packageJson);
  if (!isWithin(prefix, packagePath)) throw new Error("packed CLI package is outside the approved local install prefix");
  const installedPackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const sourcePackage = require("../package.json");
  if (installedPackage.name !== "@johnason/data-platform-cli" || installedPackage.version !== sourcePackage.version) {
    throw new Error("packed CLI package name or version does not match this repository");
  }
  const binRelative = installedPackage.bin?.["data-platform"];
  if (typeof binRelative !== "string") throw new Error("packed CLI package does not declare data-platform bin");
  const packageDirectory = path.dirname(packagePath);
  const binary = fs.realpathSync(path.join(packageDirectory, binRelative));
  const shim = fs.realpathSync(path.join(prefix, "node_modules", ".bin", "data-platform"));
  if (binary !== shim || !isWithin(packageDirectory, binary) || !isWithin(prefix, binary)) {
    throw new Error("packed CLI bin does not resolve to the repository-owned package bin");
  }
  return { prefix, binary, package: installedPackage };
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function currentPackManifest() {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: packageRoot, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error("cannot produce current npm-pack manifest");
  const manifest = JSON.parse(result.stdout);
  if (!Array.isArray(manifest) || manifest.length !== 1 || !Array.isArray(manifest[0].files)) {
    throw new Error("current npm-pack manifest is invalid");
  }
  return manifest[0].files.map((entry) => entry.path).sort();
}

function verifyCurrentPackedInstall() {
  const installed = findVerifiedLocalInstall();
  const manifest = currentPackManifest();
  const packageDirectory = path.dirname(fs.realpathSync(path.join(installed.prefix, "node_modules", "@johnason", "data-platform-cli", "package.json")));
  for (const relative of manifest) {
    const source = path.join(packageRoot, relative);
    const packed = path.join(packageDirectory, relative);
    if (!fs.existsSync(source) || !fs.existsSync(packed) || hashFile(source) !== hashFile(packed)) {
      throw new Error(`installed package content differs from current npm-pack file: ${relative}`);
    }
  }
  return { ...installed, manifestFiles: manifest.length };
}

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

function isSafeCaseArgument(value) {
  return typeof value === "string" && !/password|secret|token|authorization|credential/i.test(value);
}

function commandDefinition(capabilityId) {
  return createDomainCommands(createCapabilityCatalog()).find((definition) => definition.capabilityIds.includes(capabilityId));
}

function parseCommandOutput(definition, stdout) {
  if (definition.streamOutput === "ndjson") {
    const records = String(stdout).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    if (!records.length) throw new Error("NDJSON command output is empty");
    return { format: "ndjson", records };
  }
  const envelope = JSON.parse(stdout);
  if (!envelope?.success) throw new Error("command did not return a successful JSON envelope");
  return { format: "json", envelope };
}

function apiProvider(capability) {
  const targets = capability.executionTargets.filter((target) => target.kind === "api");
  if (targets.length !== 1) throw new Error(`${capability.capabilityId} must declare exactly one API provider`);
  return targets[0].provider;
}

function outputValue(output, fieldPath) {
  const root = output.format === "json" ? output.envelope : output.records.at(-1);
  return String(fieldPath || "").split(".").filter(Boolean).reduce((value, key) => value?.[key], root);
}

function validateCaseContract(entry, capability) {
  const failures = [];
  if (!Array.isArray(entry?.args) || entry.args.some((argument) => !isSafeCaseArgument(argument))) failures.push("case has unsafe command arguments");
  const evidence = entry?.evidence;
  for (const field of ["audit", "event", "idempotency"]) {
    if (typeof evidence?.[field] !== "boolean") failures.push(`case must explicitly declare ${field} evidence`);
  }
  if (capability.action === "write") {
    if (!evidence?.audit) failures.push("case omits required audit evidence");
    if (!evidence?.event) failures.push("case omits required event evidence");
    if (!evidence?.idempotency) failures.push("case omits required idempotency evidence");
  }
  const output = entry?.output;
  if (typeof output?.providerHost !== "string") failures.push("case does not map provider-host output evidence");
  for (const [contractField, outputField] of [["audit", "auditId"], ["event", "eventId"], ["idempotency", "idempotencyKeyHash"]]) {
    if (evidence?.[contractField] && typeof output?.[outputField] !== "string") {
      failures.push(`case does not map required ${contractField} output evidence`);
    }
  }
  if (capability.interaction === "stream" && typeof output?.terminal !== "string") {
    failures.push("stream case does not map terminal output evidence");
  }
  return failures;
}

function collectPreflightBlocks({ profile, catalog, cases, policy }) {
  const blocked = [];
  for (const capabilityId of apiCapabilityIds()) {
    const capability = catalog.get(capabilityId);
    const provider = apiProvider(capability);
    if (!policy.providers?.[provider]?.approvedHosts?.length) blocked.push(`${capabilityId}: no committed approved host for ${provider}`);
    const entry = cases.get(capabilityId);
    if (!entry) blocked.push(`${capabilityId}: no committed command case`);
    else for (const failure of validateCaseContract(entry, capability)) blocked.push(`${capabilityId}: ${failure}`);
    if (!profile) blocked.push(`${capabilityId}: CLI_API_GATE_PROFILE is required`);
  }
  return blocked;
}

async function runApprovedApiGate({ env = process.env, spawn = spawnSync, lookup = dns.lookup } = {}) {
  const profile = env.CLI_API_GATE_PROFILE;
  const expected = apiCapabilityIds();
  const catalog = createCapabilityCatalog();
  const cases = new Map(apiGateCases.cases.map((entry) => [entry.capabilityId, entry]));
  const blocked = collectPreflightBlocks({ profile, catalog, cases, policy: apiGatePolicy });
  if (blocked.length) return { status: "blocked", failures: blocked, tested: 0, expected: expected.length };
  let installed;
  try {
    installed = verifyCurrentPackedInstall();
  } catch (error) {
    return { status: "failed", failures: [error.message] };
  }
  const providerHosts = new Map();
  try {
    for (const [provider, policy] of Object.entries(apiGatePolicy.providers)) {
      providerHosts.set(provider, await Promise.all(policy.approvedHosts.map((host) => assertApprovedEndpoint(host, policy.approvedHosts, lookup))));
    }
  } catch (error) {
    return { status: "failed", failures: [error.message] };
  }
  const failures = [];
  for (const capabilityId of expected) {
    const entry = cases.get(capabilityId);
    const definition = commandDefinition(capabilityId);
    if (!definition) {
      failures.push(`missing CLI definition: ${capabilityId}`);
      continue;
    }
    const capability = catalog.get(capabilityId);
    const apiIndex = definition.capabilityIds.indexOf(capabilityId);
    const argv = [definition.streamOutput === "ndjson" ? "--ndjson" : "--json", "--profile", profile, ...definition.command.split(" ")];
    if (definition.capabilityIds.length > 1) argv.push("--api-key", definition.sourceApiKeys[apiIndex]);
    argv.push(...entry.args);
    const result = spawn(installed.binary, argv, { encoding: "utf8", timeout: Number(env.CLI_API_GATE_TIMEOUT_MS || 120000) });
    if (result.error || result.status !== 0) {
      failures.push(`installed command failed: ${capabilityId}`);
      continue;
    }
    try {
      const output = parseCommandOutput(definition, result.stdout);
      const provider = apiProvider(capability);
      const actualHost = normalizeHost(outputValue(output, entry.output.providerHost));
      if (!providerHosts.get(provider).includes(actualHost)) throw new Error("provider endpoint metadata is not an approved host");
      for (const [required, outputField] of [[entry.evidence.audit, entry.output.auditId], [entry.evidence.event, entry.output.eventId], [entry.evidence.idempotency, entry.output.idempotencyKeyHash]]) {
        if (required && !outputValue(output, outputField)) throw new Error("missing required command evidence");
      }
      if (definition.streamOutput === "ndjson" && !outputValue(output, entry.output.terminal)) {
        throw new Error("missing required NDJSON terminal evidence");
      }
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

test("gate locates and verifies only the repository-owned packed CLI install", () => {
  const installed = findVerifiedLocalInstall();
  assert.match(installed.binary, /\.local\/data-platform-cli\/install\/node_modules\/@johnason\/data-platform-cli\/bin\/data-platform\.js$/);
  assert.equal(installed.package.name, "@johnason/data-platform-cli");
  assert.equal(installed.package.version, require("../package.json").version);
});

test("gate binds the installed package files to the current npm-pack manifest", () => {
  const installed = verifyCurrentPackedInstall();
  assert.equal(installed.package.name, "@johnason/data-platform-cli");
  assert.ok(installed.manifestFiles >= 20);
});

test("provider policy is committed by provider and begins with no approved hosts", () => {
  assert.deepEqual(apiGatePolicy.providers, {
    "external-api": { approvedHosts: [] },
    "model-provider": { approvedHosts: [] },
    "service-runtime": { approvedHosts: [] },
  });
  assert.deepEqual(apiGateCases.cases, []);
});

test("API classifications map to the committed provider policy buckets", () => {
  const counts = { "external-api": 0, "model-provider": 0, "service-runtime": 0 };
  for (const capability of createCapabilityCatalog().values()) {
    if (capability.executionTargets.some((target) => target.kind === "api")) counts[apiProvider(capability)] += 1;
  }
  assert.deepEqual(counts, { "external-api": 34, "model-provider": 1, "service-runtime": 2 });
});

test("stream output is parsed as NDJSON rather than as one JSON envelope", () => {
  assert.deepEqual(parseCommandOutput({ streamOutput: "ndjson" }, '{"event":"progress"}\n{"event":"complete"}\n'), {
    format: "ndjson",
    records: [{ event: "progress" }, { event: "complete" }],
  });
});

test("approved write case must explicitly require audit, event, and idempotency evidence", () => {
  assert.deepEqual(
    validateCaseContract({ capabilityId: "write.capability", args: [], evidence: { audit: false, event: false, idempotency: false }, output: { providerHost: "meta.providerHost" } }, { action: "write", interaction: "json-write" }),
    ["case omits required audit evidence", "case omits required event evidence", "case omits required idempotency evidence"],
  );
});

test("policy and case preflight blocks before installed-package verification", () => {
  const blocks = collectPreflightBlocks({ profile: null, catalog: createCapabilityCatalog(), cases: new Map(), policy: apiGatePolicy });
  assert.match(blocks.join("\n"), /no committed approved host for external-api/);
});

test("approved command harness lists classified capabilities blocked by absent committed policy and cases", async () => {
  const result = await runApprovedApiGate({ env: {} });
  assert.equal(result.status, "blocked");
  assert.match(result.failures.join("\n"), /data-development\.028\.runcopilottaskstream: no committed approved host for external-api/);
  assert.match(result.failures.join("\n"), /model-providers\.002\.testmodelprovider: no committed approved host for model-provider/);
  assert.match(result.failures.join("\n"), /data-services\.031\.handleinvoke: no committed approved host for service-runtime/);
});

test("profile or arbitrary binary input does not override the committed provider policy", async () => {
  const result = await runApprovedApiGate({
    env: { CLI_API_GATE_PROFILE: "approved-profile", CLI_API_GATE_BINARY: process.execPath },
  });
  assert.equal(result.status, "blocked");
  assert.match(result.failures.join("\n"), /no committed approved host for external-api/);
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

test("service-runtime contract stays limited to controlled-fixture mechanics", () => {
  assert.equal(serviceRuntimeContract.provider, "service-runtime");
  assert.equal(Object.hasOwn(serviceRuntimeContract, "requiredEnvelopeMeta"), false);
  assert.equal(Object.hasOwn(serviceRuntimeContract, "approvedEndpointAllowlist"), false);
});

test("API gate requires command-derived real evidence", async () => {
  const requested = process.env.CLI_API_GATE === "1";
  const result = await runApprovedApiGate();
  if (requested) assert.equal(result.status, "accepted", result.failures.join("\n"));
  else assert.equal(result.status, "blocked", result.failures.join("\n"));
});
