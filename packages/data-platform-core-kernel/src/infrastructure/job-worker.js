const defaultJobRepository = require("./job.repository");

function startHeartbeat({ intervalMs, renew }) {
  const controller = new AbortController();
  let stopped = false;
  let failure;
  let timer;
  let active = Promise.resolve();
  const tick = () => {
    if (stopped || failure) return;
    active = Promise.resolve().then(renew).catch((error) => {
      failure = error;
      controller.abort(error);
    }).finally(() => {
      if (!stopped && !failure) timer = setTimeout(tick, intervalMs);
    });
  };
  timer = setTimeout(tick, intervalMs);
  return Object.freeze({
    signal: controller.signal,
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await active;
      if (failure) throw failure;
    },
  });
}

function createJobWorker({
  transaction,
  repository = defaultJobRepository,
  handlers,
  authorize,
  backoffMs = (attempt) => Math.min(300_000, 2_000 * (2 ** Math.max(0, attempt - 1))),
}) {
  if (typeof transaction !== "function") throw new TypeError("Job worker requires transaction");
  if (!repository || typeof repository.claimJobs !== "function") throw new TypeError("Job worker requires claimJobs");
  if (typeof repository.renewLease !== "function") throw new TypeError("Job worker requires renewLease");
  if (!handlers || typeof handlers !== "object") throw new TypeError("Job worker requires handlers");
  if (typeof authorize !== "function") throw new TypeError("Job worker requires authorize");

  const inTransaction = (name, input) => transaction((connection) => repository[name](input, connection));

  async function transition(job, from, to, extra = {}) {
    return inTransaction("transitionJob", {
      jobId: job.jobId,
      workerId: job.leaseOwner,
      attemptNo: job.attemptNo,
      from,
      to,
      ...extra,
    });
  }

  return Object.freeze({
    async runBatch({ workerId, limit, leaseMs }) {
      const jobs = [];
      let succeeded = 0;
      let retried = 0;
      let failed = 0;
      while (jobs.length < limit) {
        const [job] = await inTransaction("claimJobs", { workerId, limit: 1, leaseMs });
        if (!job) break;
        jobs.push(job);
        const definition = handlers[job.jobType];
        const heartbeat = startHeartbeat({
          intervalMs: Math.max(1, Math.floor(leaseMs / 3)),
          renew: () => inTransaction("renewLease", {
            jobId: job.jobId,
            workerId: job.leaseOwner,
            attemptNo: job.attemptNo,
            status: job.status,
            leaseMs,
          }),
        });
        try {
          await authorize(job);
          if (!definition) throw Object.assign(new Error(`No handler for job type: ${job.jobType}`), { code: "JOB_HANDLER_MISSING" });
          const recoveredCompensation = job.status === "compensating";
          const run = recoveredCompensation ? definition.compensate : (typeof definition === "function" ? definition : definition.run);
          if (typeof run !== "function") {
            throw Object.assign(new Error(`No ${recoveredCompensation ? "compensation" : "run"} handler for job type: ${job.jobType}`), {
              code: recoveredCompensation ? "JOB_COMPENSATION_MISSING" : "JOB_HANDLER_MISSING",
            });
          }
          const result = recoveredCompensation
            ? await run(job.input, Object.freeze({ ...job, signal: heartbeat.signal }), job.error)
            : await run(job.input, Object.freeze({ ...job, signal: heartbeat.signal }));
          await heartbeat.stop();
          await transition(job, job.status, "succeeded", { result });
          succeeded += 1;
        } catch (error) {
          let leaseError;
          try { await heartbeat.stop(); } catch (failure) { leaseError = failure; }
          if (leaseError?.code === "JOB_LEASE_CONFLICT" || error?.code === "JOB_LEASE_CONFLICT") {
            throw leaseError || error;
          }
          if (job.status === "compensating") {
            await transition(job, "compensating", "failed", { error });
            failed += 1;
          } else if (error?.compensate && typeof definition?.compensate === "function") {
            await transition(job, job.status, "compensating", { error });
            const compensationHeartbeat = startHeartbeat({
              intervalMs: Math.max(1, Math.floor(leaseMs / 3)),
              renew: () => inTransaction("renewLease", {
                jobId: job.jobId,
                workerId: job.leaseOwner,
                attemptNo: job.attemptNo,
                status: "compensating",
                leaseMs,
              }),
            });
            try {
              const result = await definition.compensate(job.input, Object.freeze({
                ...job,
                status: "compensating",
                signal: compensationHeartbeat.signal,
              }), error);
              await compensationHeartbeat.stop();
              await transition(job, "compensating", "succeeded", { result });
              succeeded += 1;
            } catch (compensationError) {
              let compensationLeaseError;
              try { await compensationHeartbeat.stop(); } catch (failure) { compensationLeaseError = failure; }
              if (compensationLeaseError?.code === "JOB_LEASE_CONFLICT" || compensationError?.code === "JOB_LEASE_CONFLICT") {
                throw compensationLeaseError || compensationError;
              }
              await transition(job, "compensating", "failed", { error: compensationError });
              failed += 1;
            }
          } else if (error?.retryable && job.attemptNo < job.maxAttempts && typeof repository.scheduleRetry === "function") {
            await inTransaction("scheduleRetry", {
              jobId: job.jobId,
              workerId: job.leaseOwner,
              attemptNo: job.attemptNo,
              delayMs: backoffMs(job.attemptNo),
              error,
            });
            retried += 1;
          } else {
            await transition(job, job.status, "failed", { error });
            failed += 1;
          }
        }
      }
      return Object.freeze({ claimed: jobs.length, succeeded, retried, failed });
    },
  });
}

module.exports = { createJobWorker };
