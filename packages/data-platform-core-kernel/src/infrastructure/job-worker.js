function createJobWorker({ repository, handlers }) {
  if (!repository || !(handlers instanceof Map)) throw new TypeError("repository and handlers are required");
  return {
    async runBatch(options = {}) {
      const jobs = await repository.claimJobs(options);
      let succeeded = 0;
      let failed = 0;
      for (const job of jobs) {
        const handler = handlers.get(job.type) || handlers.get(job.id);
        try {
          if (!handler) throw Object.assign(new Error(`No handler for job: ${job.type || job.id}`), { code: "JOB_HANDLER_MISSING" });
          const result = await handler(job);
          await repository.succeed(job.id, result);
          succeeded += 1;
        } catch (error) {
          await repository.fail(job.id, error.code || "JOB_EXECUTION_FAILED");
          failed += 1;
        }
      }
      return { claimed: jobs.length, succeeded, failed };
    },
  };
}

module.exports = { createJobWorker };
