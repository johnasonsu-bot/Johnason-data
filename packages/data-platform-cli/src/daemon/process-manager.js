const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { redact } = require("../output/redaction");

function requiredProfile(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new TypeError("profileName is invalid");
  return value;
}

function createProcessInspector({
  platform = process.platform,
  execFileSync = childProcess.execFileSync,
  signalProbe = (pid) => process.kill(pid, 0),
} = {}) {
  return Object.freeze({
    describe(pid) {
      try {
        signalProbe(pid);
      } catch (error) {
        if (error?.code === "ESRCH") return { alive: false };
        if (error?.code !== "EPERM") throw error;
      }
      try {
        if (platform === "win32") {
          const script = `$p=Get-CimInstance Win32_Process -Filter \"ProcessId = ${Number(pid)}\"; if ($p) {$p | Select-Object ProcessId,CommandLine,@{n='CreationDate';e={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress}`;
          const parsed = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim());
          if (!parsed) return { alive: false };
          const started = new Date(parsed.CreationDate);
          return {
            alive: true,
            command: String(parsed.CommandLine || ""),
            startedAt: Number.isNaN(started.getTime()) ? null : started.toISOString(),
          };
        }
        const output = execFileSync("ps", ["-p", String(pid), "-o", "lstart=", "-o", "command="], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (!output) return { alive: false };
        const started = new Date(output.slice(0, 24).trim());
        return {
          alive: true,
          command: output.slice(24).trim(),
          startedAt: Number.isNaN(started.getTime()) ? null : started.toISOString(),
        };
      } catch {
        return { alive: true, command: "", startedAt: null };
      }
    },
  });
}

function daemonError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createProcessManager({
  dataDir,
  binPath,
  fsImpl = fs,
  spawnImpl = childProcess.spawn,
  processInspector = createProcessInspector(),
  processController = { signal: (pid, signal) => process.kill(pid, signal) },
  clock = { now: () => new Date() },
  idGenerator = crypto.randomUUID,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  if (!dataDir || !binPath) throw new TypeError("Process manager requires dataDir and binPath");
  const daemonDir = path.join(dataDir, "daemon");
  const archiveDir = path.join(daemonDir, "archive");

  function pathsFor(profileName) {
    profileName = requiredProfile(profileName);
    return Object.freeze({
      daemonDir,
      archiveDir,
      lockFile: path.join(daemonDir, `${profileName}.lock.json`),
      logFile: path.join(daemonDir, `${profileName}.log`),
    });
  }

  function readinessFile(profileName, readinessId) {
    profileName = requiredProfile(profileName);
    if (typeof readinessId !== "string" || !/^[A-Za-z0-9-]{8,128}$/.test(readinessId)) throw new TypeError("readinessId is invalid");
    return path.join(daemonDir, `${profileName}.readiness.${readinessId}.json`);
  }

  function ensureDirectories() {
    fsImpl.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
  }

  function readLock(profileName) {
    const paths = pathsFor(profileName);
    if (!fsImpl.existsSync(paths.lockFile)) return null;
    try {
      return JSON.parse(fsImpl.readFileSync(paths.lockFile, "utf8"));
    } catch {
      return Object.freeze({ invalid: true, profileName });
    }
  }

  function writeLock(record) {
    ensureDirectories();
    const paths = pathsFor(record.profileName);
    let descriptor;
    try {
      descriptor = fsImpl.openSync(paths.lockFile, "wx", 0o600);
      fsImpl.writeFileSync(descriptor, `${JSON.stringify(record)}\n`);
    } finally {
      if (descriptor !== undefined) fsImpl.closeSync(descriptor);
    }
    fsImpl.chmodSync(paths.lockFile, 0o600);
  }

  function archiveLock(profileName, suffix = "stopped") {
    const paths = pathsFor(profileName);
    if (!fsImpl.existsSync(paths.lockFile)) return null;
    ensureDirectories();
    const stamp = clock.now().toISOString().replace(/[:.]/g, "-");
    let target = path.join(paths.archiveDir, `${profileName}.lock.${stamp}.${suffix}.json`);
    let collision = 0;
    while (fsImpl.existsSync(target)) {
      collision += 1;
      target = path.join(paths.archiveDir, `${profileName}.lock.${stamp}.${suffix}.${collision}.json`);
    }
    fsImpl.renameSync(paths.lockFile, target);
    return target;
  }

  function archiveReadiness(profileName, readinessId, suffix) {
    const source = readinessFile(profileName, readinessId);
    if (!fsImpl.existsSync(source)) return null;
    ensureDirectories();
    const stamp = clock.now().toISOString().replace(/[:.]/g, "-");
    let target = path.join(archiveDir, `${profileName}.readiness.${stamp}.${suffix}.json`);
    let collision = 0;
    while (fsImpl.existsSync(target)) {
      collision += 1;
      target = path.join(archiveDir, `${profileName}.readiness.${stamp}.${suffix}.${collision}.json`);
    }
    fsImpl.renameSync(source, target);
    return target;
  }

  async function reportReadiness({ profileName, readinessId, instanceId, status: readinessStatus, error }) {
    if (!["ready", "error"].includes(readinessStatus)) throw new TypeError("readiness status is invalid");
    if (typeof instanceId !== "string" || instanceId.length === 0) throw new TypeError("instanceId is invalid");
    ensureDirectories();
    const payload = Object.freeze({
      schemaVersion: 1,
      profileName: requiredProfile(profileName),
      readinessId,
      instanceId,
      status: readinessStatus,
      reportedAt: clock.now().toISOString(),
      ...(error === undefined ? {} : { error: redact(error) }),
    });
    const filename = readinessFile(profileName, readinessId);
    const descriptor = fsImpl.openSync(filename, "wx", 0o600);
    try { fsImpl.writeFileSync(descriptor, `${JSON.stringify(payload)}\n`); } finally { fsImpl.closeSync(descriptor); }
    fsImpl.chmodSync(filename, 0o600);
    return payload;
  }

  async function identity(record) {
    if (!record || record.invalid || !Number.isSafeInteger(Number(record.pid))) return { owned: false, alive: false };
    const described = await processInspector.describe(Number(record.pid));
    if (!described?.alive) return { owned: false, alive: false, described };
    const command = String(described.command || "");
    const commandMatches = command.includes(String(record.binPath))
      && command.includes("daemon run")
      && command.includes(String(record.instanceId));
    let startMatches = false;
    if (described.startedAt && record.startedAt) {
      const delta = Math.abs(new Date(described.startedAt).getTime() - new Date(record.startedAt).getTime());
      startMatches = Number.isFinite(delta) && delta <= 15_000;
    }
    return { owned: commandMatches && startMatches, alive: true, described };
  }

  async function status({ profileName }) {
    profileName = requiredProfile(profileName);
    const record = readLock(profileName);
    if (!record) return Object.freeze({ running: false, profileName, reason: "not_started" });
    if (record.invalid) return Object.freeze({ running: false, profileName, reason: "invalid_lock" });
    const check = await identity(record);
    if (!check.alive) return Object.freeze({ running: false, profileName, reason: "stale", pid: record.pid });
    if (!check.owned) return Object.freeze({ running: false, profileName, reason: "identity_mismatch", pid: record.pid });
    return Object.freeze({ running: true, profileName, pid: record.pid, instanceId: record.instanceId, startedAt: record.startedAt });
  }

  async function prepare(profileName) {
    const current = readLock(profileName);
    if (!current) return;
    const state = await status({ profileName });
    if (state.running) throw daemonError(`Daemon already running for profile ${profileName}`, "DAEMON_ALREADY_RUNNING");
    archiveLock(profileName, state.reason);
  }

  async function start({ profileName, readinessTimeoutMs = 10_000 }) {
    profileName = requiredProfile(profileName);
    if (!Number.isSafeInteger(Number(readinessTimeoutMs)) || Number(readinessTimeoutMs) <= 0) throw new TypeError("readinessTimeoutMs is invalid");
    await prepare(profileName);
    const instanceId = idGenerator();
    const readinessId = idGenerator();
    const startedAt = clock.now().toISOString();
    const paths = pathsFor(profileName);
    ensureDirectories();
    const logDescriptor = fsImpl.openSync(paths.logFile, "a", 0o600);
    let child;
    try {
      child = spawnImpl(process.execPath, [
        binPath,
        "daemon",
        "run",
        "--profile",
        profileName,
        "--instance-id",
        instanceId,
        "--readiness-id",
        readinessId,
      ], {
        detached: true,
        stdio: ["ignore", logDescriptor, logDescriptor],
      });
    } finally {
      fsImpl.closeSync(logDescriptor);
    }
    if (!child || !Number.isSafeInteger(Number(child.pid))) throw daemonError("Daemon process did not start", "DAEMON_START_FAILED");
    child.unref?.();
    let readiness;
    const checks = Math.max(1, Math.ceil(Number(readinessTimeoutMs) / 25));
    try {
      for (let index = 0; index < checks; index += 1) {
        const filename = readinessFile(profileName, readinessId);
        if (fsImpl.existsSync(filename)) {
          readiness = JSON.parse(fsImpl.readFileSync(filename, "utf8"));
          break;
        }
        await wait(25);
      }
      if (!readiness || readiness.instanceId !== instanceId || readiness.readinessId !== readinessId) {
        throw daemonError("Daemon readiness timed out", "DAEMON_READINESS_TIMEOUT");
      }
      archiveReadiness(profileName, readinessId, readiness.status);
      if (readiness.status !== "ready") {
        const failure = daemonError(readiness.error?.message || "Daemon dependencies are unavailable", readiness.error?.code || "DAEMON_START_FAILED");
        failure.details = readiness.error?.details;
        throw failure;
      }
      writeLock(Object.freeze({ schemaVersion: 1, profileName, pid: Number(child.pid), instanceId, startedAt, binPath }));
    } catch (error) {
      processController.signal(Number(child.pid), "SIGTERM");
      if (fsImpl.existsSync(readinessFile(profileName, readinessId))) archiveReadiness(profileName, readinessId, "aborted");
      throw error;
    }
    return Object.freeze({ running: true, profileName, pid: Number(child.pid), instanceId, startedAt });
  }

  async function stop({ profileName, timeoutMs = 10_000 }) {
    profileName = requiredProfile(profileName);
    const record = readLock(profileName);
    if (!record) return Object.freeze({ stopped: false, profileName, reason: "not_started" });
    const check = await identity(record);
    if (!check.owned) {
      throw daemonError(`Daemon lock identity mismatch for profile ${profileName}`, "DAEMON_IDENTITY_MISMATCH");
    }
    processController.signal(Number(record.pid), "SIGTERM");
    const checks = Math.max(1, Math.ceil(Number(timeoutMs) / 25));
    for (let index = 0; index < checks; index += 1) {
      const current = await processInspector.describe(Number(record.pid));
      if (!current?.alive) {
        const archivedLock = archiveLock(profileName, "stopped");
        return Object.freeze({ stopped: true, profileName, pid: record.pid, archivedLock });
      }
      await wait(25);
    }
    throw daemonError(`Daemon did not stop gracefully for profile ${profileName}`, "DAEMON_STOP_TIMEOUT");
  }

  async function logs({ profileName, lines = 100 }) {
    profileName = requiredProfile(profileName);
    lines = Number(lines);
    if (!Number.isSafeInteger(lines) || lines <= 0 || lines > 10_000) throw new TypeError("lines is invalid");
    const logFile = pathsFor(profileName).logFile;
    let text = "";
    if (fsImpl.existsSync(logFile)) {
      const descriptor = fsImpl.openSync(logFile, "r");
      try {
        const size = fsImpl.fstatSync(descriptor).size;
        let position = size;
        let newlineCount = 0;
        const chunks = [];
        while (position > 0 && newlineCount <= lines) {
          const length = Math.min(64 * 1024, position);
          position -= length;
          const buffer = Buffer.allocUnsafe(length);
          const count = fsImpl.readSync(descriptor, buffer, 0, length, position);
          const chunk = buffer.subarray(0, count);
          chunks.unshift(chunk);
          for (const byte of chunk) if (byte === 0x0a) newlineCount += 1;
        }
        text = Buffer.concat(chunks).toString("utf8");
      } finally {
        fsImpl.closeSync(descriptor);
      }
    }
    const entries = text.match(/.*(?:\n|$)/g)?.filter(Boolean) || [];
    return Object.freeze({ profileName, text: entries.slice(-lines).join("") });
  }

  async function restart(input) {
    const state = await status(input);
    if (state.running) await stop(input);
    else if (readLock(input.profileName)) archiveLock(input.profileName, state.reason);
    return start(input);
  }

  async function registerCurrent({ profileName, instanceId = idGenerator() }) {
    profileName = requiredProfile(profileName);
    await prepare(profileName);
    const record = Object.freeze({
      schemaVersion: 1,
      profileName,
      pid: process.pid,
      instanceId,
      startedAt: clock.now().toISOString(),
      binPath,
    });
    writeLock(record);
    return record;
  }

  async function archiveCurrent({ profileName, instanceId, allowMissing = false }) {
    const record = readLock(profileName);
    if (!record && allowMissing) return null;
    if (!record || Number(record.pid) !== process.pid || record.instanceId !== instanceId) {
      throw daemonError(`Foreground daemon lock identity mismatch for profile ${profileName}`, "DAEMON_IDENTITY_MISMATCH");
    }
    return archiveLock(profileName, "foreground-stopped");
  }

  return Object.freeze({ archiveCurrent, logs, pathsFor, registerCurrent, reportReadiness, restart, start, status, stop });
}

module.exports = { createProcessInspector, createProcessManager };
