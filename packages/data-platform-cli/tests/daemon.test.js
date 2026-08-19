const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createProcessManager } = require("../src/daemon/process-manager");
const { main } = require("../src/main");

function capture() {
  let value = "";
  return { stream: { write(chunk) { value += chunk; } }, value() { return value; } };
}

test("profile daemon lock is exclusive and recoverable", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-daemon-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const alive = new Set([123]);
  const manager = createProcessManager({ dataDir: root, profile: "dev", fsImpl: fs, isProcessAlive: (pid) => alive.has(pid) });
  manager.acquire(123);
  assert.throws(() => manager.acquire(456), /already running/i);
  alive.delete(123);
  alive.add(456);
  manager.acquire(456);
  assert.equal(manager.status().pid, 456);
  manager.release(456);
  assert.equal(manager.status().running, false);
});

test("daemon start and status are profile-scoped and detached", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-daemon-cli-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const profile = { name: "dev", db: { host: "localhost", port: 3306, database: "platform", user: "cli", timezone: "+08:00" } };
  const profileStore = { current: () => profile, get: (name) => name === "dev" ? profile : null };
  const stdout = capture();
  const stderr = capture();
  let spawned;
  const spawnImpl = (executable, argv, options) => {
    spawned = { executable, argv, options };
    return { pid: 321, unref() {} };
  };
  const common = {
    runtime: { catalog: new Map(), executeCapability() {} },
    profileStore,
    paths: { dataDir: root, configFile: path.join(root, "config.json") },
    stdout: stdout.stream,
    stderr: stderr.stream,
    spawnImpl,
    binPath: "/installed/data-platform.js",
    processOps: { pid: 100, execPath: "/usr/bin/node", isAlive: () => false, kill() {}, on() {}, off() {} },
  };
  assert.equal(await main(["--json", "daemon", "start"], common), 0, stderr.value());
  assert.deepEqual(spawned.argv, ["/installed/data-platform.js", "--profile", "dev", "daemon", "run"]);
  assert.equal(spawned.options.detached, true);
  const result = JSON.parse(stdout.value());
  assert.match(result.data.logFile, /daemon\/dev\/daemon\.log$/);
});
