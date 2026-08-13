const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createProcessManager, createProcessInspector } = require("../src/daemon/process-manager");
const { createDaemonCommands } = require("../src/commands/daemon");
const { createFoundationCommands } = require("../src/registry/foundation-commands");
const { main } = require("../src/main");

function fixtureChild() {
  return childProcess.spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
}

function optionValue(args, name) {
  return args[args.indexOf(name) + 1];
}

async function waitForExit(child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`fixture child ${child.pid} did not exit`);
}

test("profile-scoped PID lock verifies CLI identity and refuses an unrelated live PID", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-daemon-identity-"));
  const unrelated = fixtureChild();
  const signals = [];
  const manager = createProcessManager({
    dataDir,
    binPath: "/installed/data-platform",
    processInspector: {
      describe(pid) {
        return { alive: pid === unrelated.pid, command: "node unrelated-fixture", startedAt: "2026-08-13T00:00:00.000Z" };
      },
    },
    processController: { signal(pid, signal) { signals.push({ pid, signal }); } },
  });
  const paths = manager.pathsFor("prod");
  fs.mkdirSync(path.dirname(paths.lockFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(paths.lockFile, `${JSON.stringify({
    schemaVersion: 1,
    profileName: "prod",
    pid: unrelated.pid,
    instanceId: "expected-instance",
    startedAt: "2026-08-13T00:00:00.000Z",
    binPath: "/installed/data-platform",
  })}\n`, { mode: 0o600 });
  try {
    assert.deepEqual(await manager.status({ profileName: "prod" }), {
      running: false,
      profileName: "prod",
      reason: "identity_mismatch",
      pid: unrelated.pid,
    });
    await assert.rejects(manager.stop({ profileName: "prod" }), (error) => error?.code === "DAEMON_IDENTITY_MISMATCH");
    assert.deepEqual(signals, []);
    assert.equal(unrelated.exitCode, null);
  } finally {
    unrelated.kill("SIGTERM");
    await waitForExit(unrelated);
  }
});

test("daemon start status logs restart and stop use a real fixture child and archive locks without deletion", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-daemon-lifecycle-"));
  const children = new Map();
  const spawnImpl = (_executable, args) => {
    const child = fixtureChild();
    children.set(child.pid, { child, args });
    const readinessId = optionValue(args, "--readiness-id");
    const profileName = optionValue(args, "--profile");
    manager.reportReadiness({ profileName, readinessId, instanceId: optionValue(args, "--instance-id"), status: "ready" });
    return child;
  };
  const processInspector = {
    describe(pid) {
      const entry = children.get(pid);
      if (!entry || entry.child.killed || entry.child.exitCode !== null) return { alive: false };
      return {
        alive: true,
        command: `${process.execPath} /installed/data-platform ${entry.args.join(" ")}`,
        startedAt: entry.startedAt,
      };
    },
  };
  const processController = {
    signal(pid, signal) { children.get(pid)?.child.kill(signal); },
  };
  const manager = createProcessManager({
    dataDir,
    binPath: "/installed/data-platform",
    spawnImpl,
    processInspector,
    processController,
    clock: { now: () => new Date("2026-08-13T00:00:00.000Z") },
    idGenerator: (() => { let id = 0; return () => `instance-${++id}`; })(),
    wait: async () => {},
  });

  const started = await manager.start({ profileName: "prod" });
  children.get(started.pid).startedAt = started.startedAt;
  assert.equal((await manager.status({ profileName: "prod" })).running, true);
  const paths = manager.pathsFor("prod");
  fs.appendFileSync(paths.logFile, "one\ntwo\nthree\n");
  assert.equal((await manager.logs({ profileName: "prod", lines: 2 })).text, "two\nthree\n");

  const stopped = await manager.stop({ profileName: "prod", timeoutMs: 1_000 });
  assert.equal(stopped.stopped, true);
  await waitForExit(children.get(started.pid).child);
  assert.equal(fs.existsSync(paths.lockFile), false);
  assert.ok(fs.readdirSync(paths.archiveDir).some((name) => name.startsWith("prod.lock.")));

  const restarted = await manager.restart({ profileName: "prod", timeoutMs: 1_000 });
  children.get(restarted.pid).startedAt = restarted.startedAt;
  assert.notEqual(restarted.pid, started.pid);
  await manager.stop({ profileName: "prod", timeoutMs: 1_000 });
  await waitForExit(children.get(restarted.pid).child);
});

test("daemon start waits for readiness and archives an error handshake without an active lock", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-daemon-readiness-"));
  const children = [];
  let manager;
  manager = createProcessManager({
    dataDir,
    binPath: "/installed/data-platform",
    spawnImpl(_executable, args) {
      const child = fixtureChild();
      children.push(child);
      setImmediate(async () => {
        await manager.reportReadiness({
          profileName: optionValue(args, "--profile"),
          readinessId: optionValue(args, "--readiness-id"),
          instanceId: optionValue(args, "--instance-id"),
          status: "error",
          error: { code: "DEPENDENCY_UNAVAILABLE", message: "daemon ports unavailable" },
        });
        child.kill("SIGTERM");
      });
      return child;
    },
    processInspector: { describe: async (pid) => ({ alive: children.some((child) => child.pid === pid && child.exitCode === null) }) },
    processController: { signal(pid, signal) { children.find((child) => child.pid === pid)?.kill(signal); } },
    wait: () => new Promise((resolve) => setTimeout(resolve, 5)),
  });
  await assert.rejects(manager.start({ profileName: "prod", readinessTimeoutMs: 1_000 }), (error) => error?.code === "DEPENDENCY_UNAVAILABLE");
  assert.equal(fs.existsSync(manager.pathsFor("prod").lockFile), false);
  assert.ok(fs.readdirSync(manager.pathsFor("prod").archiveDir).some((name) => name.includes("readiness")));
  await Promise.all(children.map(waitForExit));
});

test("Windows inspector verifies command and creation time through an injected PowerShell query", async () => {
  const calls = [];
  const inspector = createProcessInspector({
    platform: "win32",
    execFileSync(command, args) {
      calls.push({ command, args });
      return JSON.stringify({ ProcessId: 44, CommandLine: "node C:\\bin\\data-platform daemon run --instance-id abc", CreationDate: "2026-08-13T00:00:00.000Z" });
    },
    signalProbe() {},
  });
  assert.deepEqual(await inspector.describe(44), {
    alive: true,
    command: "node C:\\bin\\data-platform daemon run --instance-id abc",
    startedAt: "2026-08-13T00:00:00.000Z",
  });
  assert.equal(calls[0].command.toLowerCase().includes("powershell"), true);
});

test("daemon logs read from the tail in bounded chunks", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-daemon-tail-"));
  let maximumRead = 0;
  const fsImpl = Object.create(fs);
  fsImpl.readSync = (...args) => {
    maximumRead = Math.max(maximumRead, args[3]);
    return fs.readSync(...args);
  };
  const manager = createProcessManager({ dataDir, binPath: "/installed/data-platform", fsImpl });
  const paths = manager.pathsFor("prod");
  fs.mkdirSync(paths.daemonDir, { recursive: true });
  fs.writeFileSync(paths.logFile, `${"x".repeat(200_000)}\none\ntwo\nthree\n`);
  assert.equal((await manager.logs({ profileName: "prod", lines: 2 })).text, "two\nthree\n");
  assert.ok(maximumRead > 0);
  assert.ok(maximumRead <= 64 * 1024);
  const boundaryText = `🚀${"x".repeat(65_530)}\none\n`;
  fs.writeFileSync(paths.logFile, boundaryText);
  assert.equal((await manager.logs({ profileName: "prod", lines: 2 })).text, boundaryText);
});

test("daemon command handlers expose start run status logs restart stop and foreground lock archival", async () => {
  const calls = [];
  const processManager = {
    start: async (input) => { calls.push(["start", input]); return { running: true }; },
    status: async (input) => { calls.push(["status", input]); return { running: false }; },
    logs: async (input) => { calls.push(["logs", input]); return { text: "line\n" }; },
    restart: async (input) => { calls.push(["restart", input]); return { running: true }; },
    stop: async (input) => { calls.push(["stop", input]); return { stopped: true }; },
    registerCurrent: async (input) => { calls.push(["register", input]); return { instanceId: input.instanceId || "foreground" }; },
    archiveCurrent: async (input) => { calls.push(["archive", input]); },
  };
  const daemonRuntime = { async run(input) { calls.push(["run", input]); } };
  const commands = createDaemonCommands({
    processManager,
    daemonRuntime,
    signal: new AbortController().signal,
    selectedProfile: () => ({ name: "prod" }),
  });
  assert.deepEqual(Object.keys(commands), ["start", "run", "status", "logs", "restart", "stop"]);
  await commands.start({});
  await commands.status({});
  await commands.logs({ lines: 10 });
  await commands.restart({});
  await commands.stop({});
  await commands.run({ instanceId: "foreground-1" });
  assert.deepEqual(calls.map(([name]) => name), ["start", "status", "logs", "restart", "stop", "register", "run", "archive"]);
});

test("foundation registry and main execute daemon status locally without HTTP listeners", async () => {
  const originalListen = require("node:net").Server.prototype.listen;
  require("node:net").Server.prototype.listen = function forbiddenListen() { throw new Error("listener forbidden"); };
  try {
    const processManager = {
      async status({ profileName }) { return { running: false, profileName, reason: "not_started" }; },
    };
    const dependencies = {
      profile: { name: "prod" },
      keychain: {},
      processManager,
      selectedProfile: () => ({ name: "prod" }),
    };
    const definitions = createFoundationCommands(dependencies);
    assert.ok(definitions.some((definition) => definition.command === "daemon status" && definition.executionTargets[0].kind === "local"));
    let stdout = "";
    const exitCode = await main(["daemon", "status", "--json"], {
      ...dependencies,
      createCommands: createFoundationCommands,
      stdout: { isTTY: false, write(chunk) { stdout += chunk; } },
      stderr: { write() {} },
      stdin: { isTTY: false },
    });
    assert.equal(exitCode, 0);
    assert.deepEqual(JSON.parse(stdout).data, { running: false, profileName: "prod", reason: "not_started" });
  } finally {
    require("node:net").Server.prototype.listen = originalListen;
  }
});

test("default daemon runtime seam fails closed without complete ports and starts injected no-HTTP loops", async () => {
  const originalListen = require("node:net").Server.prototype.listen;
  require("node:net").Server.prototype.listen = function forbiddenListen() { throw new Error("listener forbidden"); };
  try {
    const profile = { name: "prod", db: { host: "db", port: 3306, database: "platform", user: "cli" } };
    const base = {
      profile,
      keychain: {},
      processManager: {},
      corePackage: {
        createOutboxPublisher: () => ({ async publishBatch() {} }),
        createInboxConsumer: () => ({ async consumeEvent() {} }),
        createJobWorker: () => ({ async runBatch() {} }),
        createDaemonRuntime: ({ loops, schedulers }) => ({ loops, schedulers, async run() {} }),
      },
      createDatabaseRuntime: () => ({ pool: { async getConnection() {} }, async close() {} }),
    };
    assert.throws(() => require("../src/main").createProductionDaemonRuntimeFactory(base)({ profileName: "prod" }), /daemon ports/i);
    const runtime = await require("../src/main").createProductionDaemonRuntimeFactory({
      ...base,
      daemonPorts: {
        transaction: async (handler) => handler({}),
        producer: { async connect() {}, async send() {}, async disconnect() {} },
        topic: "events",
        destination: "kafka:events",
        publisherWorkerId: "publisher-1",
        jobWorkerId: "jobs-1",
        jobHandlers: { fixture: async () => {} },
        authorize: async () => {},
        createConsumerSchedulers({ inbox }) { assert.equal(typeof inbox.consumeEvent, "function"); return []; },
      },
    })({ profileName: "prod" });
    assert.equal(runtime.loops.length, 2);
  } finally {
    require("node:net").Server.prototype.listen = originalListen;
  }
});
