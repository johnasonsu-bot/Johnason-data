const crypto = require("node:crypto");
const { redact, digest } = require("./value-utils");

const JOB_STATES = Object.freeze(["pending", "running", "waiting_approval", "compensating", "succeeded", "failed"]);

function createJobRepository(connection) {
  if (!connection || typeof connection.query !== "function") throw new TypeError("transaction connection is required");
  return {
    async enqueueJob(input) {
      const id = input.jobId || crypto.randomUUID();
      const payload = redact(input.input || {});
      await connection.query(
        "INSERT INTO durable_jobs (id, job_type, module_name, module_version, project_id, actor_id, input_json, input_sha256, max_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, input.type, input.moduleName, input.moduleVersion, input.projectId ?? null, input.actorId, JSON.stringify(payload), digest(payload), input.maxAttempts || 5],
      );
      return { id, status: "pending" };
    },
  };
}

module.exports = { createJobRepository, JOB_STATES };
