const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createDaemonRuntime, PlatformError } = require("@johnason/data-platform-core-kernel");
const { createProcessManager } = require("../daemon/process-manager");
const { envelope, writeJson } = require("../output");

function defaultProcessOps() {
  return {
    pid: process.pid,
    execPath: process.execPath,
    kill(pid, signal) { return process.kill(pid, signal); },
    isAlive(pid) {
      try { process.kill(pid, 0); return true; } catch { return false; }
    },
    on(signal, handler) { process.once(signal, handler); },
    off(signal, handler) { process.off(signal, handler); },
  };
}

function selectedProfile(profileStore, name) {
  const profile = name ? profileStore.get(name) : profileStore.current();
  if (!profile) throw new PlatformError("PROFILE_REQUIRED", "Select a profile or pass --profile");
  return profile;
}

function registerDaemonCommands(program, options) {
  const {
    profileStore,
    paths,
    output,
    daemonTasks = [],
    daemonRuntimeFactory = createDaemonRuntime,
    processOps = defaultProcessOps(),
    spawnImpl = spawn,
    binPath = path.resolve(__dirname, "../../bin/data-platform.js"),
  } = options;
  const daemon = program.command("daemon").description("profile-scoped background workers without an HTTP listener");

  function resources(command) {
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    const directory = path.join(paths.dataDir, "daemon", profile.name);
    const logFile = path.join(directory, "daemon.log");
    const manager = createProcessManager({ dataDir: paths.dataDir, profile: profile.name, fsImpl: fs, isProcessAlive: processOps.isAlive });
    return { profile, directory, logFile, manager };
  }

  async function stop(command) {
    const state = resources(command);
    const status = state.manager.status();
    if (!status.running) return { ...state, stopped: false };
    processOps.kill(status.pid, "SIGTERM");
    return { ...state, stopped: true, pid: status.pid };
  }

  async function waitForExit(manager, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (manager.status().running && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (manager.status().running) throw new PlatformError("DAEMON_STOP_TIMEOUT", "Daemon did not stop before the restart timeout");
  }

  function start(command) {
    const state = resources(command);
    const status = state.manager.status();
    if (status.running) throw new PlatformError("DAEMON_ALREADY_RUNNING", `Daemon already running for profile ${state.profile.name}`);
    fs.mkdirSync(state.directory, { recursive: true, mode: 0o700 });
    const descriptor = fs.openSync(state.logFile, "a", 0o600);
    let child;
    try {
      child = spawnImpl(processOps.execPath, [binPath, "--profile", state.profile.name, "daemon", "run"], {
        detached: true,
        stdio: ["ignore", descriptor, descriptor],
      });
      child.unref?.();
    } finally {
      fs.closeSync(descriptor);
    }
    return { ...state, pid: child.pid };
  }

  daemon.command("run").description("run worker loops in the foreground").action(async (_options, command) => {
    const state = resources(command);
    state.manager.acquire(processOps.pid);
    const runtime = daemonRuntimeFactory({ tasks: daemonTasks, onError: (error) => fs.appendFileSync(state.logFile, `${new Date().toISOString()} ${error.code || "DAEMON_TASK_FAILED"}\n`) });
    const shutdown = () => { void runtime.stop(); };
    processOps.on("SIGINT", shutdown);
    processOps.on("SIGTERM", shutdown);
    try {
      await runtime.run();
    } finally {
      processOps.off("SIGINT", shutdown);
      processOps.off("SIGTERM", shutdown);
      state.manager.release(processOps.pid);
    }
  });
  daemon.command("start").action((_options, command) => {
    const state = start(command);
    writeJson(output, envelope({ running: true, profile: state.profile.name, pid: state.pid, logFile: state.logFile }));
  });
  daemon.command("status").action((_options, command) => {
    const state = resources(command);
    writeJson(output, envelope({ profile: state.profile.name, ...state.manager.status(), logFile: state.logFile }));
  });
  daemon.command("logs").option("--lines <count>", "number of trailing lines", (value) => Number(value), 100).action((local, command) => {
    const state = resources(command);
    const lines = fs.existsSync(state.logFile) ? fs.readFileSync(state.logFile, "utf8").trimEnd().split("\n").slice(-Math.max(1, local.lines)) : [];
    writeJson(output, envelope({ profile: state.profile.name, logFile: state.logFile, lines }));
  });
  daemon.command("stop").action(async (_options, command) => {
    const state = await stop(command);
    writeJson(output, envelope({ profile: state.profile.name, stopped: state.stopped, pid: state.pid || null }));
  });
  daemon.command("restart").action(async (_options, command) => {
    const stopped = await stop(command);
    if (stopped.stopped) await waitForExit(stopped.manager);
    const state = start(command);
    writeJson(output, envelope({ running: true, restarted: true, profile: state.profile.name, pid: state.pid, logFile: state.logFile }));
  });
}

module.exports = { registerDaemonCommands, defaultProcessOps };
