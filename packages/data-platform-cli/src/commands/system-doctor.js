const { CliError, executeWithProfile } = require("../runtime/cli-execution");

function createSystemDoctorCommands(dependencies) {
  return Object.freeze({
    async health() {
      return Object.freeze({ healthy: true });
    },
    async doctor(input = {}) {
      try {
        return await executeWithProfile(dependencies, async ({ databaseRuntime, profile }) => {
          const ports = dependencies.doctorPorts || {};
          const checks = {};
          for (const [name, operation, arguments_] of [
            ["keychain", ports.keychain, [profile, databaseRuntime]],
            ["database", databaseRuntime?.testConnection?.bind(databaseRuntime), []],
            ["schema", ports.schema, [profile, databaseRuntime]],
            ["datax", ports.datax, [profile, databaseRuntime]],
            ["kafka", ports.kafka, [profile, databaseRuntime]],
          ]) {
            if (typeof operation !== "function") throw new Error(`${name} check unavailable`);
            await operation(...arguments_);
            checks[name] = { available: true };
          }
          return Object.freeze({ healthy: true, checks: Object.freeze(checks) });
        }, input);
      } catch (error) {
        if (error?.code === "DEPENDENCY_UNAVAILABLE") throw error;
        throw new CliError("One or more platform dependencies are unavailable", {
          code: "DEPENDENCY_UNAVAILABLE",
          statusCode: 503,
          exitCode: 7,
        });
      }
    },
  });
}

module.exports = { createSystemDoctorCommands };
