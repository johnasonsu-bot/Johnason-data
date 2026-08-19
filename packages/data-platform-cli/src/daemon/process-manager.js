const path = require("node:path");

function createProcessManager({ dataDir, profile, fsImpl, isProcessAlive }) {
  if (!dataDir || !profile || !fsImpl || typeof isProcessAlive !== "function") {
    throw new TypeError("dataDir, profile, fsImpl, and isProcessAlive are required");
  }
  const directory = path.join(dataDir, "daemon", profile);
  const lockFile = path.join(directory, "daemon.lock");

  function readLock() {
    if (!fsImpl.existsSync(lockFile)) return null;
    try {
      const value = JSON.parse(fsImpl.readFileSync(lockFile, "utf8"));
      return Number.isInteger(value.pid) && value.pid > 0 ? value : null;
    } catch {
      return null;
    }
  }

  return {
    lockFile,
    acquire(pid = process.pid) {
      fsImpl.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const current = readLock();
      if (current && isProcessAlive(current.pid)) throw new Error(`Daemon already running for profile ${profile}`);
      const temporary = `${lockFile}.${pid}.tmp`;
      fsImpl.writeFileSync(temporary, `${JSON.stringify({ pid, profile, startedAt: new Date().toISOString() })}\n`, { mode: 0o600 });
      fsImpl.renameSync(temporary, lockFile);
      return { pid, profile };
    },
    release(pid = process.pid) {
      const current = readLock();
      if (current?.pid === pid && fsImpl.existsSync(lockFile)) fsImpl.unlinkSync(lockFile);
    },
    status() {
      const current = readLock();
      return current && isProcessAlive(current.pid) ? { running: true, ...current } : { running: false };
    },
  };
}

module.exports = { createProcessManager };
