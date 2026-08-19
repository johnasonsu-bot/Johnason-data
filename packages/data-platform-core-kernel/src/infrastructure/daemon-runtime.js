function createDaemonRuntime({ tasks = [], intervalMs = 1000, onError = () => {} } = {}) {
  if (!Array.isArray(tasks) || tasks.some((task) => typeof task !== "function")) throw new TypeError("tasks must be functions");
  let running = false;
  let stopRequested = false;
  let wake = null;

  async function wait() {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      wake = () => { clearTimeout(timer); resolve(); };
    });
    wake = null;
  }

  return {
    async run() {
      if (running) return;
      running = true;
      stopRequested = false;
      try {
        while (!stopRequested) {
          for (const task of tasks) {
            if (stopRequested) break;
            try { await task(); } catch (error) { await onError(error); }
          }
          if (!stopRequested) await wait();
        }
      } finally {
        running = false;
      }
    },
    async stop() {
      stopRequested = true;
      if (wake) wake();
    },
    status() { return { running, stopRequested }; },
  };
}

module.exports = { createDaemonRuntime };
