const { CliError, selectedProfile: defaultSelectedProfile } = require("../runtime/cli-execution");

function createDaemonCommands(dependencies) {
  const manager = dependencies.processManager;
  if (!manager) throw new TypeError("Daemon commands require processManager");

  function profileName(input = {}) {
    const profile = dependencies.selectedProfile
      ? dependencies.selectedProfile(input.profileName)
      : defaultSelectedProfile(dependencies, input.profileName);
    return profile.name;
  }

  async function runtimeFor(input) {
    if (dependencies.daemonRuntime?.run) return dependencies.daemonRuntime;
    if (typeof dependencies.createDaemonRuntime === "function") {
      const runtime = await dependencies.createDaemonRuntime({ profileName: profileName(input) });
      if (runtime?.run) return runtime;
    }
    throw new CliError("Daemon runtime dependencies are unavailable", {
      code: "DEPENDENCY_UNAVAILABLE",
      statusCode: 503,
      exitCode: 7,
    });
  }

  return Object.freeze({
    start(input = {}) {
      return manager.start({ profileName: profileName(input), readinessTimeoutMs: input.readinessTimeoutMs });
    },
    async run(input = {}) {
      const selected = profileName(input);
      const controller = dependencies.signal ? null : new AbortController();
      const signal = dependencies.signal || controller.signal;
      const stop = () => controller?.abort();
      if (controller) {
        process.once("SIGTERM", stop);
        process.once("SIGINT", stop);
      }
      let record;
      let primaryError;
      let readinessReported = false;
      try {
        const runtime = await runtimeFor(input);
        if (!input.readinessId) {
          record = await manager.registerCurrent({ profileName: selected, instanceId: input.instanceId });
        }
        await runtime.run({
          signal,
          onReady: input.readinessId ? async () => {
            await manager.reportReadiness({
              profileName: selected,
              readinessId: input.readinessId,
              instanceId: input.instanceId,
              status: "ready",
            });
            readinessReported = true;
          } : undefined,
        });
        return { stopped: true, profileName: selected };
      } catch (error) {
        primaryError = error;
        if (input.readinessId && !readinessReported) {
          await manager.reportReadiness({
            profileName: selected,
            readinessId: input.readinessId,
            instanceId: input.instanceId,
            status: "error",
            error,
          });
        }
        throw error;
      } finally {
        if (controller) {
          process.removeListener("SIGTERM", stop);
          process.removeListener("SIGINT", stop);
        }
        if (record || input.readinessId) {
          try {
            await manager.archiveCurrent({
              profileName: selected,
              instanceId: record?.instanceId || input.instanceId,
              allowMissing: Boolean(input.readinessId),
            });
          } catch (error) {
            if (!primaryError) throw error;
          }
        }
      }
    },
    status(input = {}) { return manager.status({ profileName: profileName(input) }); },
    logs(input = {}) { return manager.logs({ profileName: profileName(input), lines: input.lines || 100 }); },
    restart(input = {}) { return manager.restart({ profileName: profileName(input), timeoutMs: input.timeoutMs }); },
    stop(input = {}) { return manager.stop({ profileName: profileName(input), timeoutMs: input.timeoutMs }); },
  });
}

module.exports = { createDaemonCommands };
