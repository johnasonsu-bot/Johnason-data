const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { main } = require("../src/main");
const { createCommandRegistry } = require("../src/registry/command-registry");
const { createFoundationCommands } = require("../src/registry/foundation-commands");
const {
  resolveRuntimeTargets,
  validateExecutionTargets,
} = require("../src/registry/execution-targets");

const schema = Object.freeze({ parse(value) { return value; } });

function definition(overrides = {}) {
  return {
    command: "datasource inspect",
    capabilityId: "datasource.inspect",
    modules: ["data_sources"],
    action: "read",
    sourceApiKeys: ["GET /api/v1/data-sources/:id"],
    sourceFrontendKeys: ["/data-sources/:id"],
    executionTargets: [{ kind: "database", engine: "mysql", role: "platform-authority" }],
    inputSchema: schema,
    outputSchema: schema,
    async handler() { return {}; },
    ...overrides,
  };
}

function capture() {
  let value = "";
  return {
    stream: { isTTY: false, write(chunk) { value += String(chunk); return true; } },
    value() { return value; },
  };
}

test("strict target validation rejects unsupported values, unknown keys, empty business targets, and local mixtures", () => {
  assert.throws(
    () => validateExecutionTargets([{ kind: "database", engine: "sql" }]),
    /unsupported database engine/i,
  );
  assert.throws(
    () => validateExecutionTargets([{ kind: "api", provider: "platform-http" }]),
    /unsupported API provider/i,
  );
  assert.throws(
    () => validateExecutionTargets([{ kind: "database", engine: "mysql", options: {} }]),
    /unknown|unrecognized/i,
  );
  assert.throws(() => validateExecutionTargets([]), /executionTargets/i);
  assert.throws(
    () => validateExecutionTargets([{ kind: "local" }, { kind: "database", engine: "mysql" }]),
    /local/i,
  );
  assert.throws(
    () => createCommandRegistry().register(definition({ executionTargets: [] })),
    /executionTargets/i,
  );
});

test("strict target validation deduplicates exact cloned targets and never freezes caller metadata", () => {
  const callerTarget = { kind: "database", engine: "postgresql", role: "business-datasource" };
  const normalized = validateExecutionTargets([
    { kind: "api", provider: "external-api" },
    callerTarget,
    { kind: "database", engine: "postgresql", role: "business-datasource" },
  ]);
  assert.deepEqual(normalized, [
    { kind: "api", provider: "external-api" },
    { kind: "database", engine: "postgresql", role: "business-datasource" },
  ]);
  assert.notEqual(normalized[1], callerTarget);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized[1]), true);
  assert.equal(Object.isFrozen(callerTarget), false);

  const candidate = definition({ executionTargets: [callerTarget] });
  const registered = createCommandRegistry().register(candidate);
  assert.equal(Object.isFrozen(candidate.executionTargets), false);
  assert.equal(Object.isFrozen(callerTarget), false);
  callerTarget.engine = "oracle";
  assert.equal(registered.executionTargets[0].engine, "postgresql");
});

test("runtime resolution replaces all datasource engine candidates with one actual configured engine", () => {
  const dynamic = definition({
    executionTargets: [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "database", engine: "mysql", role: "business-datasource" },
      { kind: "database", engine: "postgresql", role: "business-datasource" },
      { kind: "database", engine: "oracle", role: "business-datasource" },
      { kind: "database", engine: "dm", role: "business-datasource" },
      { kind: "api", provider: "external-api" },
    ],
  });

  assert.deepEqual(resolveRuntimeTargets(dynamic, {
    datasource: { sourceType: "oracle" },
  }, {}), [
    { kind: "database", engine: "mysql", role: "platform-authority" },
    { kind: "database", engine: "oracle", role: "business-datasource" },
    { kind: "api", provider: "external-api" },
  ]);

  assert.deepEqual(resolveRuntimeTargets(definition(), {}, {}), [
    { kind: "database", engine: "mysql", role: "platform-authority" },
  ]);
});

test("dynamic datasource resolution emits every actual database target and preserves conditional API targets", () => {
  const dynamic = definition({
    executionTargets: [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "database", engine: "mysql", role: "business-datasource" },
      { kind: "database", engine: "postgresql", role: "business-datasource" },
      { kind: "api", provider: "external-api", role: "conditional-datasource" },
    ],
  });
  assert.deepEqual(
    resolveRuntimeTargets(dynamic, {
      source: { sourceType: "mysql" },
      target: { databaseEngine: "postgresql" },
    }, {}),
    [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "database", engine: "mysql", role: "business-datasource" },
      { kind: "database", engine: "postgresql", role: "business-datasource" },
    ],
  );
  assert.deepEqual(
    resolveRuntimeTargets(dynamic, {
      source: { sourceType: "api" },
      target: { databaseEngine: "mysql" },
    }, {}),
    [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "database", engine: "mysql", role: "business-datasource" },
      { kind: "api", provider: "external-api", role: "conditional-datasource" },
    ],
  );
  assert.deepEqual(
    resolveRuntimeTargets(dynamic, { source: { sourceType: "api" } }, {}),
    [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "api", provider: "external-api", role: "conditional-datasource" },
    ],
  );
});

test("dynamic datasource resolution ignores known non-database kinds and fails closed for unknown engines", () => {
  const dynamic = definition({
    executionTargets: [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "database", engine: "mysql", role: "business-datasource" },
      { kind: "database", engine: "postgresql", role: "business-datasource" },
      { kind: "api", provider: "external-api", role: "conditional-datasource" },
    ],
  });
  assert.throws(() => resolveRuntimeTargets(dynamic, {}, {}), /datasource.*engine/i);
  assert.doesNotThrow(() => resolveRuntimeTargets(dynamic, { source: { sourceType: "ftp" } }, {}));
  assert.doesNotThrow(() => resolveRuntimeTargets(dynamic, { source: { sourceType: "kafka" } }, {}));
  assert.throws(
    () => resolveRuntimeTargets(dynamic, { datasource: { databaseEngine: "sqlite" } }, {}),
    /unsupported database engine/i,
  );
  assert.throws(
    () => resolveRuntimeTargets(dynamic, { source: { type: "sqlite" } }, {}),
    /unsupported database engine/i,
  );
});

test("JDBC datasource wrappers resolve every supported vendor and fail closed without a supported URL", () => {
  const dynamic = definition({
    executionTargets: [
      { kind: "database", engine: "mysql", role: "business-datasource" },
      { kind: "database", engine: "postgresql", role: "business-datasource" },
      { kind: "database", engine: "oracle", role: "business-datasource" },
      { kind: "database", engine: "dm", role: "business-datasource" },
    ],
  });
  for (const [vendor, engine] of [
    ["mysql", "mysql"],
    ["postgresql", "postgresql"],
    ["oracle", "oracle"],
    ["dm", "dm"],
  ]) {
    assert.deepEqual(resolveRuntimeTargets(dynamic, {
      datasource: { sourceType: "jdbc", connectionConfig: { jdbcUrl: `jdbc:${vendor}://database.invalid/demo` } },
    }, {}), [
      { kind: "database", engine, role: "business-datasource" },
    ]);
  }
  assert.throws(
    () => resolveRuntimeTargets(dynamic, { datasource: { sourceType: "jdbc", connectionConfig: {} } }, {}),
    /JDBC.*URL/i,
  );
  assert.throws(
    () => resolveRuntimeTargets(dynamic, {
      datasource: { sourceType: "jdbc", connectionConfig: { jdbcUrl: "jdbc:sqlite://database.invalid/demo" } },
    }, {}),
    /unsupported.*JDBC.*vendor/i,
  );
});

test("connectivity targets reflect only active datasource checks with explicit result evidence", () => {
  const conditional = definition({
    executionTargets: [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "database", engine: "mysql", role: "connectivity-check" },
      { kind: "database", engine: "postgresql", role: "connectivity-check" },
      { kind: "database", engine: "oracle", role: "connectivity-check" },
      { kind: "database", engine: "dm", role: "connectivity-check" },
      { kind: "api", provider: "external-api", role: "connectivity-check" },
    ],
  });
  assert.deepEqual(resolveRuntimeTargets(conditional, { includeConnectivity: false }, [
    { sourceType: "api" },
  ]), [
    { kind: "database", engine: "mysql", role: "platform-authority" },
  ]);
  assert.deepEqual(resolveRuntimeTargets(conditional, { includeConnectivity: true }, [
    { sourceType: "mysql", status: "active", connectionStatus: "online", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
    { sourceType: "postgresql", status: "active", connectionStatus: "offline", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
    { sourceType: "oracle", status: "active", connectionStatus: "online", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
    { sourceType: "dm", status: "active", connectionStatus: "online", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
    { sourceType: "api", status: "active", connectionStatus: "online", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
    { sourceType: "api", status: "inactive", connectionStatus: "disabled", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
    { sourceType: "api", status: "active", connectionStatus: "unknown", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
  ]), [
    { kind: "database", engine: "mysql", role: "platform-authority" },
    { kind: "database", engine: "mysql", role: "connectivity-check" },
    { kind: "database", engine: "postgresql", role: "connectivity-check" },
    { kind: "database", engine: "oracle", role: "connectivity-check" },
    { kind: "database", engine: "dm", role: "connectivity-check" },
    { kind: "api", provider: "external-api", role: "connectivity-check" },
  ]);
  assert.deepEqual(resolveRuntimeTargets(conditional, { includeConnectivity: true }, [
    { sourceType: "api", status: "inactive", connectionStatus: "disabled", lastCheckedAt: "2026-08-13T00:00:00.000Z" },
  ]), [
    { kind: "database", engine: "mysql", role: "platform-authority" },
  ]);
});

test("database capability discovery is an honest local foundation target", () => {
  const commands = createFoundationCommands({
    core: {},
    keychain: {},
    databaseCapabilities() { return []; },
    doctorPorts: {},
  });
  const target = commands.find((entry) => entry.command === "system doctor database-capabilities");
  assert.deepEqual(target.executionTargets, [{ kind: "local" }]);
});

test("main emits actual runtime targets in one JSON success envelope and fails closed on unresolved targets", async () => {
  const stdout = capture();
  const stderr = capture();
  const dynamic = definition({
    executionTargets: [
      { kind: "database", engine: "mysql", role: "business-datasource" },
      { kind: "database", engine: "postgresql", role: "business-datasource" },
      { kind: "database", engine: "oracle", role: "business-datasource" },
      { kind: "database", engine: "dm", role: "business-datasource" },
    ],
    async handler() { return { datasource: { sourceType: "dm" }, rows: [] }; },
  });
  assert.equal(await main(["--json", "datasource", "inspect"], {
    createCommands: () => [dynamic],
    stdin: { isTTY: false },
    stdout: stdout.stream,
    stderr: stderr.stream,
  }), 0);
  assert.equal(stdout.value().trim().split("\n").length, 1);
  assert.deepEqual(JSON.parse(stdout.value()).meta.executionTargets, [
    { kind: "database", engine: "dm", role: "business-datasource" },
  ]);

  const failedStdout = capture();
  assert.equal(await main(["--json", "datasource", "inspect"], {
    createCommands: () => [{ ...dynamic, handler: async () => ({ rows: [] }) }],
    stdin: { isTTY: false },
    stdout: failedStdout.stream,
    stderr: capture().stream,
  }), 1);
  assert.equal(failedStdout.value().trim().split("\n").length, 1);
  assert.equal(JSON.parse(failedStdout.value()).success, false);
});

test("coverage generation is byte-deterministic and every emitted target passes the shared strict contract", (t) => {
  const workspaceRoot = path.resolve(__dirname, "../../..");
  const inventory = "/Users/sushi/Downloads/data-platform-dev/source/api-inventory.json";
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "execution-target-baseline-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const first = path.join(temporaryRoot, "first.json");
  const second = path.join(temporaryRoot, "second.json");
  for (const output of [first, second]) {
    const generated = childProcess.spawnSync(process.execPath, [
      "scripts/generate-cli-coverage-baseline.js",
      inventory,
      output,
    ], { cwd: workspaceRoot, encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr);
  }
  assert.equal(fs.readFileSync(first, "utf8"), fs.readFileSync(second, "utf8"));

  const baseline = JSON.parse(fs.readFileSync(first, "utf8"));
  assert.equal(baseline.apiCoverage.length, 596);
  assert.equal(baseline.frontendCoverage.length, 84);
  assert.equal(baseline.gates.unclassifiedBusinessCommands, 0);
  assert.ok(baseline.gates.apiClassified > 0);
  for (const engine of ["mysql", "postgresql", "oracle", "dm"]) {
    assert.ok(baseline.gates.databaseClassified[engine] > 0);
  }
  for (const entry of baseline.apiCoverage) {
    assert.deepEqual(validateExecutionTargets(entry.executionTargets), entry.executionTargets);
  }

  const byApiKey = new Map(baseline.apiCoverage.map((entry) => [entry.apiKey, entry]));
  assert.deepEqual(
    byApiKey.get("GET /api/v1/data-sources/:id/tables/:tableName/sample")
      .executionTargets
      .filter((target) => target.kind === "database" && target.role === "business-datasource")
      .map((target) => target.engine),
    ["mysql", "postgresql", "oracle", "dm"],
  );
  assert.deepEqual(
    byApiKey.get("POST /api/v1/data-sources")
      .executionTargets
      .filter((target) => target.kind === "database" && target.role === "business-datasource"),
    [],
    "persisting datasource configuration only touches the platform authority database",
  );
  assert.deepEqual(
    byApiKey.get("POST /api/v1/data-source-research/source/:sourceId/runs")
      .executionTargets
      .filter((target) => target.kind === "database" && target.role === "business-datasource")
      .map((target) => target.engine),
    ["mysql", "postgresql"],
    "research execution explicitly supports MySQL/PostgreSQL among the allowed target schema",
  );
  assert.deepEqual(
    byApiKey.get("GET /api/v1/platform/database-capabilities").executionTargets,
    [{ kind: "local" }],
  );
  assert.deepEqual(
    byApiKey.get("GET /api/v1/data-sources").executionTargets,
    [
      { kind: "database", engine: "mysql", role: "platform-authority" },
      { kind: "database", engine: "mysql", role: "connectivity-check" },
      { kind: "database", engine: "postgresql", role: "connectivity-check" },
      { kind: "database", engine: "oracle", role: "connectivity-check" },
      { kind: "database", engine: "dm", role: "connectivity-check" },
      { kind: "api", provider: "external-api", role: "connectivity-check" },
    ],
  );
  for (const apiKey of [
    "POST /api/v1/data-modeling/scenario-management/instances/:id/ai-business-data/batches/:batchId/load",
    "POST /api/v1/data-modeling/scenario-management/ai-business-data/tasks",
    "POST /api/v1/data-modeling/scenario-management/ai-business-data/tasks/:taskId/schedule",
    "POST /api/v1/data-modeling/scenario-management/ai-business-data/tasks/:taskId/delete",
    "POST /api/v1/quality-control/strategies/tables/:monitorTableId/recommendations/:runId/apply",
    "POST /api/v1/quality-control/strategies/tables/:monitorTableId/recommendations/:runId/reject",
  ]) {
    assert.equal(
      byApiKey.get(apiKey).executionTargets.some((target) => target.kind === "api"),
      false,
      `${apiKey} persists or reviews existing data and must not enter the external API gate`,
    );
  }
  for (const apiKey of [
    "POST /api/v1/data-modeling/scenario-management/instances/:id/ai-business-data/plans/generate",
    "POST /api/v1/data-modeling/scenario-management/instances/:id/ai-business-data/batches/generate",
    "POST /api/v1/data-modeling/scenario-management/ai-business-data/tasks/:taskId/run",
    "POST /api/v1/quality-control/strategies/tables/:monitorTableId/recommendations",
  ]) {
    assert.equal(
      byApiKey.get(apiKey).executionTargets.some((target) => target.kind === "api" && target.provider === "external-api"),
      true,
      `${apiKey} directly or asynchronously invokes a model-backed operation`,
    );
  }
});
