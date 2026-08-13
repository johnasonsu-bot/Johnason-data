const crypto = require("node:crypto");

const { serializeRedactedContract } = require("./command.repository");

const JOB_STATES = Object.freeze([
  "pending",
  "running",
  "waiting_approval",
  "compensating",
  "succeeded",
  "failed",
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  pending: new Set(["running"]),
  running: new Set(["waiting_approval", "compensating", "succeeded", "failed"]),
  waiting_approval: new Set(["pending"]),
  compensating: new Set(["succeeded", "failed"]),
  failed: new Set(),
  succeeded: new Set(),
});

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} is required`);
  return value.trim();
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError(`${label} must be a positive integer`);
  return number;
}

function projectScope(projectId) {
  const value = Number(projectId ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("projectId must be a non-negative integer");
  return value;
}

async function enqueueJob(candidate, connection) {
  const jobId = candidate?.jobId || crypto.randomUUID();
  const input = serializeRedactedContract(candidate?.input || {});
  const actor = serializeRedactedContract(candidate?.actor || {});
  await connection.execute(
    `INSERT INTO durable_jobs
     (job_id, job_type, project_id, input_json, input_sha256, actor_json, status, max_attempts)
     VALUES (?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON), 'pending', ?)`,
    [jobId, requiredString(candidate?.type, "type"), projectScope(candidate?.projectId), input.json, input.sha256, actor.json, positiveInteger(candidate?.maxAttempts, "maxAttempts")],
  );
  return Object.freeze({ jobId, status: "pending", inputSha256: input.sha256 });
}

async function claimJobs(candidate, connection) {
  const workerId = requiredString(candidate?.workerId, "workerId");
  const limit = positiveInteger(candidate?.limit, "limit");
  const leaseMs = positiveInteger(candidate?.leaseMs, "leaseMs");
  const [rows] = await connection.execute(
    `SELECT job_id, status, attempt_count, max_attempts, lease_owner, lease_until
     FROM durable_jobs
     WHERE (status = 'pending' AND attempt_count < max_attempts AND next_run_at <= CURRENT_TIMESTAMP(3))
        OR (status = 'running' AND lease_until < CURRENT_TIMESTAMP(3))
        OR (status = 'compensating' AND lease_until < CURRENT_TIMESTAMP(3))
     ORDER BY next_run_at, job_id LIMIT ? FOR UPDATE SKIP LOCKED`,
    [limit],
  );
  const claimed = [];
  for (const row of rows || []) {
    const attemptCount = Number(row.attempt_count || 0);
    const maxAttempts = Number(row.max_attempts);
    const expiredLease = row.status === "running" || row.status === "compensating";
    if (expiredLease && attemptCount >= maxAttempts) {
      const exhausted = serializeRedactedContract({
        code: "LEASE_EXHAUSTED",
        message: "Job lease expired after maximum attempts",
      });
      const [reaped] = await connection.execute(
        `UPDATE durable_jobs SET status = 'failed', lease_owner = NULL, lease_until = NULL,
         last_error_json = CAST(? AS JSON), last_error_sha256 = ?
         WHERE job_id = ? AND status = ? AND attempt_count = ?
           AND lease_owner <=> ? AND lease_until < CURRENT_TIMESTAMP(3)`,
        [exhausted.json, exhausted.sha256, row.job_id, row.status, attemptCount, row.lease_owner ?? null],
      );
      if (reaped?.affectedRows === 1) {
        await connection.execute(
          `UPDATE durable_job_attempts SET status = 'failed', error_category = 'lease_exhausted',
           error_json = CAST(? AS JSON), error_sha256 = ?, finished_at = CURRENT_TIMESTAMP(3)
           WHERE job_id = ? AND attempt_no = ? AND worker_id <=> ? AND status = 'running'`,
          [exhausted.json, exhausted.sha256, row.job_id, attemptCount, row.lease_owner ?? null],
        );
      }
      continue;
    }
    if (attemptCount >= maxAttempts) continue;
    const claimedStatus = row.status === "compensating" ? "compensating" : "running";
    const [write] = await connection.execute(
      `UPDATE durable_jobs SET status = ?, lease_owner = ?,
       lease_until = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ? MICROSECOND),
       heartbeat_at = CURRENT_TIMESTAMP(3), attempt_count = attempt_count + 1
       WHERE job_id = ? AND attempt_count < max_attempts
         AND ((status = 'pending')
           OR (status = 'running' AND lease_until < CURRENT_TIMESTAMP(3))
           OR (status = 'compensating' AND lease_until < CURRENT_TIMESTAMP(3)))`,
      [claimedStatus, workerId, leaseMs * 1000, row.job_id],
    );
    if (write?.affectedRows !== 1) continue;
    if (expiredLease) {
      const abandoned = serializeRedactedContract({
        code: "LEASE_EXPIRED",
        message: "Worker lease expired before the attempt completed",
      });
      await connection.execute(
        `UPDATE durable_job_attempts SET status = 'failed', error_category = 'lease_expired',
         error_json = CAST(? AS JSON), error_sha256 = ?, finished_at = CURRENT_TIMESTAMP(3)
         WHERE job_id = ? AND attempt_no = ? AND worker_id <=> ? AND status = 'running'`,
        [abandoned.json, abandoned.sha256, row.job_id, attemptCount, row.lease_owner ?? null],
      );
    }
    const attemptNo = attemptCount + 1;
    await connection.execute(
      `INSERT INTO durable_job_attempts (job_id, attempt_no, worker_id, status)
       VALUES (?, ?, ?, 'running')`,
      [row.job_id, attemptNo, workerId],
    );
    claimed.push(Object.freeze({ jobId: row.job_id, status: claimedStatus, leaseOwner: workerId, attemptNo }));
  }
  return Object.freeze(claimed);
}

function transitionJob(candidate, connection) {
  const jobId = requiredString(candidate?.jobId, "jobId");
  const from = requiredString(candidate?.from, "from");
  const to = requiredString(candidate?.to, "to");
  const workerId = requiredString(candidate?.workerId, "workerId");
  const attemptNo = positiveInteger(candidate?.attemptNo, "attemptNo");
  if (!JOB_STATES.includes(from) || !JOB_STATES.includes(to) || !ALLOWED_TRANSITIONS[from]?.has(to)) {
    throw new Error(`Invalid durable job transition: ${from} -> ${to}`);
  }
  return (async () => {
    const result = candidate?.result == null ? null : serializeRedactedContract(candidate.result);
    const error = candidate?.error == null ? null : serializeRedactedContract(candidate.error);
    const continuesWithSameLease = from === "running" && to === "compensating";
    const leaseAssignment = continuesWithSameLease
      ? "lease_owner = lease_owner, lease_until = lease_until"
      : "lease_owner = NULL, lease_until = NULL";
    const [write] = await connection.execute(
      `UPDATE durable_jobs SET status = ?, result_json = CAST(? AS JSON), result_sha256 = ?,
       last_error_json = CAST(? AS JSON), last_error_sha256 = ?,
       ${leaseAssignment}
       WHERE job_id = ? AND status = ? AND lease_owner = ?
         AND lease_until > CURRENT_TIMESTAMP(3) AND attempt_count = ?`,
      [to, result?.json ?? null, result?.sha256 ?? null, error?.json ?? null, error?.sha256 ?? null, jobId, from, workerId, attemptNo],
    );
    if (write?.affectedRows !== 1) {
      const conflict = new Error(`Durable job lease fencing conflict: ${jobId}`);
      conflict.code = "JOB_LEASE_CONFLICT";
      throw conflict;
    }
    if (continuesWithSameLease) return Object.freeze({ jobId, from, to, attemptNo });
    const [attemptWrite] = await connection.execute(
      `UPDATE durable_job_attempts
       SET status = ?, error_json = CAST(? AS JSON), error_sha256 = ?, finished_at = CURRENT_TIMESTAMP(3)
       WHERE job_id = ? AND attempt_no = ? AND worker_id = ? AND status = 'running'`,
      [to, error?.json ?? null, error?.sha256 ?? null, jobId, attemptNo, workerId],
    );
    if (attemptWrite?.affectedRows !== 1) {
      const conflict = new Error(`Durable job attempt fencing conflict: ${jobId}`);
      conflict.code = "JOB_ATTEMPT_CONFLICT";
      throw conflict;
    }
    return Object.freeze({ jobId, from, to });
  })();
}

async function approveJob(candidate, connection) {
  const approvalId = candidate?.approvalId || crypto.randomUUID();
  const approver = serializeRedactedContract(candidate?.approver || {});
  const evidence = serializeRedactedContract(candidate?.evidence || {});
  const jobId = requiredString(candidate?.jobId, "jobId");
  await connection.execute(
    `INSERT INTO durable_job_approvals
     (approval_id, job_id, approver_json, reason, from_status, to_status, evidence_json, evidence_sha256)
     VALUES (?, ?, CAST(? AS JSON), ?, 'waiting_approval', 'pending', CAST(? AS JSON), ?)`,
    [approvalId, jobId, approver.json, requiredString(candidate?.reason, "reason"), evidence.json, evidence.sha256],
  );
  const [write] = await connection.execute(
    `UPDATE durable_jobs SET status = 'pending', next_run_at = CURRENT_TIMESTAMP(3)
     WHERE job_id = ? AND status = 'waiting_approval'`,
    [jobId],
  );
  if (write?.affectedRows !== 1) throw new Error(`Durable job approval lost race: ${jobId}`);
  return Object.freeze({ approvalId, jobId, status: "pending", evidenceSha256: evidence.sha256 });
}

module.exports = { JOB_STATES, approveJob, claimJobs, enqueueJob, transitionJob };
