const assert = require("node:assert/strict");
const test = require("node:test");
const { Command } = require("commander");

const { readHiddenInput } = require("../src/runtime/hidden-input");
const { executeWithProfile } = require("../src/runtime/cli-execution");
const { createFoundationCommands } = require("../src/registry/foundation-commands");
const { createCommandRegistry } = require("../src/registry/command-registry");
const { createDoctorPorts, main } = require("../src/main");

function fixture() {
  const calls = [];
  const sessions = new Map([["dev", "signed-token"]]);
  const selectedProjects = [];
  const keychain = {
    getDatabasePassword(name) { return name === "missing-db" ? null : "database-from-keychain"; },
    getSessionToken(name) { return sessions.get(name) || null; },
    setSessionToken(name, value) { sessions.set(name, value); },
    deleteSessionToken(name) { sessions.delete(name); return true; },
  };
  const profile = { name: "dev", db: { host: "db", port: 3306, database: "platform", user: "operator" }, dataxHome: "/opt/datax", kafkaBootstrapServers: ["kafka:9092"] };
  const core = {
    async runWithDatabaseRuntime(_runtime, callback) { return callback(); },
    async execute(capability, input, context) {
      calls.push({ capability, input, context });
      if (capability === "auth.login") return { token: "signed-token", user: { id: 7, username: "alice", passwordHash: "must-not-leak" } };
      if (capability === "auth.profile") {
        if (["disabled-token", "revoked-token", "missing-session-token"].includes(input.token)) {
          const error = new Error("认证会话无效"); error.code = "AUTHENTICATION_REQUIRED"; error.statusCode = 401; throw error;
        }
        return { user: { id: input.userId, sub: input.userId, username: "alice", roleCode: "developer", permissions: { modules: ["system_projects"] } } };
      }
      if (capability === "auth.logout") return { success: true };
      if (capability === "project.list-my") return [
        { id: 12, code: "alpha", name: "Alpha", role: "developer", modules: ["catalog"] },
        { id: 13, code: "dup", name: "Duplicate One", role: "viewer", modules: ["catalog"] },
        { id: 14, code: "dup", name: "Duplicate Two", role: "viewer", modules: ["catalog"] },
      ];
      if (capability === "project.access-check") return { allowed: true, project: { id: input.projectId }, member: { role: "developer" }, modules: ["catalog"] };
      throw new Error(`unexpected capability ${capability}`);
    },
  };
  const databaseRuntime = { async testConnection() {}, pool: {} };
  const dependencies = {
    core, databaseRuntime, keychain, profile,
    sessionIdentity: { verify(token) { if (!token) throw new Error("missing token"); return { sub: 7 }; } },
    createDatabaseRuntime(selectedProfile) {
      if (!keychain.getDatabasePassword(selectedProfile.name)) {
        const error = new Error("Database password unavailable"); error.code = "DATABASE_PASSWORD_UNAVAILABLE"; error.statusCode = 503; throw error;
      }
      return databaseRuntime;
    },
    profileStore: { setCurrentProject(name, projectId) { selectedProjects.push([name, projectId]); } },
    databaseCapabilities: () => ({ mysql: { available: true } }),
    doctorPorts: { keychain: async () => {}, schema: async () => {}, datax: async () => {}, kafka: async () => {} },
  };
  return {
    calls, keychain, selectedProjects,
    profile, dependencies, commands: createFoundationCommands(dependencies),
  };
}

test("auth login executes through the injected core runtime, persists only its token, and never returns a password", async () => {
  const fake = fixture();
  const result = await fake.commands.auth.login({ username: "alice", password: "pw" });

  assert.equal(result.user.username, "alice");
  assert.equal(fake.keychain.getSessionToken("dev"), "signed-token");
  assert.equal(JSON.stringify(result).includes("password"), false);
  assert.deepEqual(fake.calls[0], {
    capability: "auth.login",
    input: { username: "alice", password: "pw" },
    context: { userAgent: "data-platform-cli", ipAddress: null },
  });
});

test("auth login obtains a missing password only from the injected hidden-input reader", async () => {
  const fake = fixture();
  fake.commands = createFoundationCommands({
    ...fake.dependencies,
    readHiddenInput: async () => "hidden-password",
  });

  await fake.commands.auth.login({ username: "alice" });

  assert.equal(fake.calls[0].input.password, "hidden-password");
});

test("config add obtains the database password through hidden input and stores only the keychain value", async () => {
  let savedProfile;
  let savedPassword;
  const commands = createFoundationCommands({
    ...fixture().dependencies,
    readHiddenInput: async () => "database-password",
    profileStore: {
      add(profile) { savedProfile = profile; return profile; },
      list() { return []; },
      get() { return null; },
      current() { return null; },
      use() {},
      remove() {},
    },
    keychain: {
      setDatabasePassword(name, password) { savedPassword = [name, password]; },
      getSessionToken() { return null; },
      deleteSessionToken() {},
      deleteDatabasePassword() {},
    },
  });

  const profile = { name: "dev", db: { host: "db", port: 3306, database: "platform", user: "operator" } };
  assert.deepEqual(await commands.config.add(profile), profile);
  assert.deepEqual(savedProfile, profile);
  assert.deepEqual(savedPassword, ["dev", "database-password"]);
  assert.equal(Object.hasOwn(savedProfile, "databasePassword"), false);
});

test("config add compensates a failed profile write by removing the newly stored keychain secret", async () => {
  const events = [];
  const commands = createFoundationCommands({
    ...fixture().dependencies,
    profileStore: {
      add() { events.push("profile:add"); throw new Error("disk full"); },
      list() { return []; }, get() { return null; }, current() { return null; }, use() {}, remove() {},
    },
    keychain: {
      setDatabasePassword() { events.push("keychain:set"); },
      deleteDatabasePassword() { events.push("keychain:delete"); },
      getSessionToken() { return null; }, deleteSessionToken() {},
    },
  });
  await assert.rejects(() => commands.config.add({
    name: "dev", databasePassword: "secret", db: { host: "db", port: 3306, database: "platform", user: "operator" },
  }), /disk full/);
  assert.deepEqual(events, ["keychain:set", "profile:add", "keychain:delete"]);
});

test("auth logout deletes the stored token only after core logout", async () => {
  const fake = fixture();
  fake.keychain.setSessionToken("dev", "signed-token");

  assert.deepEqual(await fake.commands.auth.logout({ userId: 7 }), { success: true });
  assert.equal(fake.keychain.getSessionToken("dev"), null);
});

test("auth logout clears expired, revoked, and missing-session tokens while preserving the remote error", async () => {
  for (const token of ["revoked-token", "missing-session-token"]) {
    const fake = fixture();
    fake.keychain.setSessionToken("dev", token);
    await assert.rejects(() => fake.commands.auth.logout(), { code: "AUTHENTICATION_REQUIRED" });
    assert.equal(fake.keychain.getSessionToken("dev"), null);
  }

  const expired = fixture();
  expired.keychain.setSessionToken("dev", "expired-token");
  expired.commands = createFoundationCommands({
    ...expired.dependencies,
    sessionIdentity: { verify() { throw new Error("jwt expired"); } },
  });
  await assert.rejects(() => expired.commands.auth.logout(), { code: "AUTHENTICATION_REQUIRED" });
  assert.equal(expired.keychain.getSessionToken("dev"), null);
});

test("auth profile fails closed for missing DB passwords and disabled sessions", async () => {
  const missing = fixture();
  missing.commands = createFoundationCommands({ ...missing.dependencies, profile: { ...missing.profile, name: "missing-db" } });
  await assert.rejects(
    () => missing.commands.auth.profile({ userId: 7 }),
    { code: "DATABASE_PASSWORD_UNAVAILABLE" },
  );

  const disabled = fixture();
  disabled.keychain.setSessionToken("dev", "disabled-token");
  await assert.rejects(() => disabled.commands.auth.profile({ userId: 7 }), { code: "AUTHENTICATION_REQUIRED" });
});

test("auth and project commands verify the keychain token and revalidate the database session before use", async () => {
  const fake = fixture();
  await fake.commands.project.list();
  assert.deepEqual(fake.calls.slice(0, 2).map((entry) => entry.capability), ["auth.profile", "project.list-my"]);
  assert.equal(fake.calls[1].context.actor.sub, 7);

  const unsafe = fixture();
  unsafe.commands = createFoundationCommands({ ...unsafe.dependencies, sessionIdentity: undefined });
  await assert.rejects(() => unsafe.commands.project.list(), { code: "SECURITY_DEPENDENCY_MISSING" });
});

test("project resolve requires exactly one match and persists a selected project", async () => {
  const fake = fixture();
  await assert.rejects(() => fake.commands.project.resolve({ code: "dup" }), { code: "PROJECT_NOT_UNIQUE" });
  assert.deepEqual(await fake.commands.project.resolve({ code: "alpha", requireOne: true }), { id: 12, code: "alpha", name: "Alpha", role: "developer", modules: ["catalog"] });
  assert.deepEqual(await fake.commands.project.use({ projectId: 12 }), { projectId: 12 });
  assert.deepEqual(fake.selectedProjects, [["dev", 12]]);
});

test("project access check returns a stable capability-derived summary", async () => {
  const fake = fixture();
  assert.deepEqual(await fake.commands.project.accessCheck({ projectId: 12, action: "write" }), {
    allowed: true, projectId: 12, projectRole: "developer", modules: ["catalog"],
  });
  assert.equal(fake.calls.at(-1).input.action, "write");
});

test("platform capabilities are injected and system doctor returns dependency exit code 7", async () => {
  const fake = fixture();
  assert.deepEqual(await fake.commands.platform.databaseCapabilities(), { mysql: { available: true } });
  assert.deepEqual(await fake.commands.platform.overview(), {
    databaseCapabilities: { mysql: { available: true } },
  });
  const failure = fixture();
  failure.commands = createFoundationCommands({
    ...failure.dependencies,
    databaseRuntime: { async testConnection() { throw new Error("database unavailable"); }, pool: {} },
  });
  await assert.rejects(() => failure.commands.system.doctor(), { code: "DEPENDENCY_UNAVAILABLE", exitCode: 7 });
});

test("default doctor ports perform keychain, schema, DataX, and Kafka checks with injected system adapters", async () => {
  const events = [];
  const ports = createDoctorPorts({
    keychain: { getDatabasePassword(name) { events.push(["keychain", name]); return "secret"; } },
    fsImpl: { constants: { X_OK: 1 }, accessSync(file, mode) { events.push(["datax", file, mode]); } },
  });
  const profile = { name: "dev", dataxHome: "/opt/datax", kafkaBootstrapServers: ["kafka:9092"] };
  const databaseRuntime = { pool: { async query(sql) { events.push(["schema", sql]); } } };
  await ports.keychain(profile, databaseRuntime);
  await ports.schema(profile, databaseRuntime);
  await ports.datax(profile, databaseRuntime);
  await ports.kafka(profile, databaseRuntime);
  assert.deepEqual(events.map((entry) => entry[0]), ["keychain", "schema", "datax"]);
  await assert.rejects(() => ports.kafka({ ...profile, kafkaBootstrapServers: [] }, databaseRuntime), /Kafka/i);
});

test("system doctor maps every unavailable dependency check to exit code 7", async () => {
  for (const failingName of ["keychain", "database", "schema", "datax", "kafka"]) {
    const fake = fixture();
    fake.commands = createFoundationCommands({
      ...fake.dependencies,
      databaseRuntime: {
        pool: {},
        async testConnection() { if (failingName === "database") throw new Error("unavailable"); },
      },
      doctorPorts: Object.fromEntries(["keychain", "schema", "datax", "kafka"].map((name) => [
        name,
        async () => { if (name === failingName) throw new Error("unavailable"); },
      ])),
    });
    await assert.rejects(() => fake.commands.system.doctor(), { code: "DEPENDENCY_UNAVAILABLE", exitCode: 7 });
  }
});

test("hidden input always restores TTY echo after success and failure", async () => {
  const events = [];
  assert.equal(await readHiddenInput({ prompt: "Password: ", output: { write(value) { events.push(value); } }, setEcho(enabled) { events.push(enabled); }, read: async () => "pw" }), "pw");
  await assert.rejects(
    () => readHiddenInput({ prompt: "Password: ", output: { write() {} }, setEcho(enabled) { events.push(enabled); }, read: async () => { throw new Error("cancelled"); } }),
    /cancelled/,
  );
  assert.deepEqual(events, ["Password: ", false, true, false, true]);
});

test("profile execution closes only command-owned database runtimes after success and failure", async () => {
  let ownedCloses = 0;
  const dependencies = {
    profile: { name: "dev", db: {} },
    core: { async execute() {} },
    createDatabaseRuntime() {
      return { async close() { ownedCloses += 1; } };
    },
  };

  assert.equal(await executeWithProfile(dependencies, async () => "ok"), "ok");
  await assert.rejects(() => executeWithProfile(dependencies, async () => { throw new Error("failed"); }), /failed/);
  assert.equal(ownedCloses, 2);

  let injectedCloses = 0;
  await executeWithProfile({
    ...dependencies,
    databaseRuntime: { async close() { injectedCloses += 1; } },
  }, async () => "ok");
  assert.equal(injectedCloses, 0);
});

test("main uses parseAsync and exits 2 without a command while entering only an injected TTY REPL", async () => {
  let parsed = false;
  let helpCount = 0;
  let replCount = 0;
  const stdout = { isTTY: false, write() {} };
  const stderr = { isTTY: false, write() {} };
  const program = { parseAsync: async () => { parsed = true; }, outputHelp() { helpCount += 1; } };
  assert.equal(await main([], { program, stdin: { isTTY: false }, stdout, stderr, createCommands: () => [] }), 2);
  assert.equal(await main(["--json"], { program, stdin: { isTTY: false }, stdout, stderr, createCommands: () => [] }), 2);
  assert.equal(await main([], {
    program,
    stdin: { isTTY: true },
    stdout: { isTTY: true, write() {} },
    stderr,
    createCommands: () => [],
    async runRepl() { replCount += 1; },
  }), 0);
  assert.equal(parsed, true);
  assert.equal(helpCount, 2);
  assert.equal(replCount, 1);
});

test("all foundation command definitions register without invented HTTP source keys", () => {
  const fake = fixture();
  const registry = createCommandRegistry();
  for (const definition of fake.commands) registry.register(definition);

  assert.equal(registry.getByCommand("config list").sourceApiKeys.length, 0);
  assert.equal(registry.getByCommand("project current").sourceApiKeys.length, 0);
  assert.equal(registry.getBySourceApiKey("POST /api/v1/auth/login").capabilityId, "auth.login");
  assert.equal(registry.getBySourceApiKey("GET /api/health").command, "system doctor health");
  assert.equal(registry.getBySourceApiKey("GET /api/v1/platform/database-capabilities").command, "system doctor database-capabilities");
});

test("main binds command options and passes normalized global context to a registered handler", async () => {
  let received;
  let rendered;
  const schema = { parse(value) { return value; } };
  const definition = {
    command: "auth login",
    capabilityId: "auth.login",
    modules: [],
    action: "write",
    sourceApiKeys: ["POST /api/v1/auth/login"],
    sourceFrontendKeys: ["/login"],
    executionTargets: [{ kind: "database", engine: "mysql" }],
    inputSchema: schema,
    outputSchema: schema,
    async handler(input) { received = input; return { user: "alice" }; },
  };
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeErr() {}, writeOut() {} })
    .option("--profile <name>")
    .option("--project <id>")
    .option("--json")
    .option("--no-color");

  const exitCode = await main(["--profile", "dev", "auth", "login", "--username", "alice"], {
    program,
    stdin: { isTTY: false },
    stdout: { isTTY: false, write() {} },
    stderr: { isTTY: false, write() {} },
    createCommands: () => [definition],
    renderer: {
      success(value) { rendered = value; return 0; },
      error() { return 2; },
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(received, { profileName: "dev", username: "alice" });
  assert.deepEqual(rendered, { user: "alice" });
});
