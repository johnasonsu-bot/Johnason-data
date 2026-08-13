function defaultWait(milliseconds, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function createDaemonRuntime({ loops = [], schedulers = [], checkpoint = async () => {}, resources = [], wait = defaultWait }) {
  if (!Array.isArray(loops) || loops.some((loop) => typeof loop?.runBatch !== "function")) throw new TypeError("Daemon loops must expose runBatch");
  if (!Array.isArray(schedulers)) throw new TypeError("Daemon schedulers must be an array");
  if (!Array.isArray(resources)) throw new TypeError("Daemon resources must be an array");
  return Object.freeze({
    async run({ signal, pollIntervalMs = 1_000, onReady } = {}) {
      const started = [];
      let primaryError;
      try {
        for (const scheduler of schedulers) {
          await scheduler.start?.();
          started.push(scheduler);
        }
        await onReady?.();
        while (!signal?.aborted) {
          await Promise.all(loops.map((loop) => loop.runBatch()));
          if (signal?.aborted) break;
          await wait(pollIntervalMs, signal);
        }
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        const cleanupErrors = [];
        for (const scheduler of started.reverse()) {
          try { await scheduler.stop?.(); } catch (error) { cleanupErrors.push(error); }
        }
        try { await checkpoint(); } catch (error) { cleanupErrors.push(error); }
        for (const resource of resources) {
          try { await resource.close?.(); } catch (error) { cleanupErrors.push(error); }
        }
        if (primaryError && cleanupErrors.length) {
          try {
            Object.defineProperty(primaryError, "cleanupErrors", {
              configurable: true,
              enumerable: false,
              value: Object.freeze([...cleanupErrors]),
            });
          } catch {
            throw new AggregateError([primaryError, ...cleanupErrors], "Daemon run and cleanup failed", { cause: primaryError });
          }
        } else if (cleanupErrors.length) {
          throw new AggregateError(cleanupErrors, "Daemon cleanup failed");
        }
      }
    },
  });
}

module.exports = { createDaemonRuntime };
