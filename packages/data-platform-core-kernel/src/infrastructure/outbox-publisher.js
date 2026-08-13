const { serializeRedactedContract } = require("./command.repository");

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError(`${label} must be a positive integer`);
  return number;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} is required`);
  return value.trim();
}

function jsonValue(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  return JSON.parse(value);
}

function eventFromRow(row) {
  return Object.freeze({
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: Number(row.event_version),
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
    projectId: Number(row.project_id),
    aggregateType: row.aggregate_type,
    aggregateId: String(row.aggregate_id),
    actor: jsonValue(row.actor_json),
    commandId: row.command_id,
    auditId: row.audit_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    contractVersion: Number(row.contract_version),
    payload: jsonValue(row.payload_json),
    payloadSha256: row.payload_sha256,
  });
}

function startHeartbeat({ intervalMs, renew }) {
  let stopped = false;
  let failure;
  let timer;
  let active = Promise.resolve();
  const tick = () => {
    if (stopped || failure) return;
    active = Promise.resolve().then(renew).catch((error) => { failure = error; }).finally(() => {
      if (!stopped && !failure) timer = setTimeout(tick, intervalMs);
    });
  };
  timer = setTimeout(tick, intervalMs);
  return Object.freeze({
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await active;
      if (failure) throw failure;
    },
  });
}

function createOutboxPublisher({
  transaction,
  producer,
  topic,
  destination,
  workerId,
  maxAttempts = 5,
  backoffMs = (attempt) => Math.min(60_000, 1_000 * (2 ** Math.max(0, attempt - 1))),
}) {
  if (typeof transaction !== "function") throw new TypeError("Outbox publisher requires transaction");
  if (!producer || typeof producer.send !== "function") throw new TypeError("Outbox publisher requires producer.send");
  topic = requiredString(topic, "topic");
  destination = requiredString(destination, "destination");
  workerId = requiredString(workerId, "workerId");
  maxAttempts = positiveInteger(maxAttempts, "maxAttempts");

  async function claim({ limit, leaseMs }) {
    return transaction(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT e.event_id, e.event_type, e.event_version, e.occurred_at, e.project_id,
          e.aggregate_type, e.aggregate_id, e.actor_json, e.command_id, e.audit_id,
          e.correlation_id, e.causation_id, e.contract_version, e.payload_json, e.payload_sha256,
          d.id AS delivery_id, d.status AS delivery_status, d.lease_owner,
          COALESCE(d.attempt_count, 0) AS attempt_count
         FROM domain_events e
         LEFT JOIN event_deliveries d ON d.event_id = e.event_id AND d.destination = ?
         WHERE d.id IS NULL
            OR (d.status = 'failed' AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= CURRENT_TIMESTAMP(3)))
            OR (d.status = 'leased' AND d.lease_until < CURRENT_TIMESTAMP(3))
         ORDER BY e.id LIMIT ? FOR UPDATE SKIP LOCKED`,
        [destination, limit],
      );
      const claimed = [];
      for (const row of (rows || []).slice(0, limit)) {
        const [write] = row.delivery_id == null
          ? await connection.execute(
            `INSERT IGNORE INTO event_deliveries
             (event_id, destination, status, attempt_count, lease_owner, lease_until)
             VALUES (?, ?, 'leased', 0, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL (? * 1000) MICROSECOND))`,
            [row.event_id, destination, workerId, leaseMs],
          )
          : await connection.execute(
            `UPDATE event_deliveries SET status = 'leased', lease_owner = ?,
             lease_until = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL (? * 1000) MICROSECOND)
             WHERE event_id = ? AND destination = ?
               AND ((status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP(3)))
                 OR (status = 'leased' AND lease_until < CURRENT_TIMESTAMP(3)))`,
            [workerId, leaseMs, row.event_id, destination],
          );
        if (write?.affectedRows === 0) continue;
        claimed.push(Object.freeze({ row, event: eventFromRow(row) }));
      }
      return claimed;
    });
  }

  async function recordPublished(item, metadata) {
    const first = Array.isArray(metadata) ? metadata[0] : metadata;
    const [write] = await transaction((connection) => connection.execute(
      `UPDATE event_deliveries SET status = 'published', attempt_count = attempt_count + 1,
       lease_owner = NULL, lease_until = NULL, kafka_partition = ?, kafka_offset = ?,
       last_error_json = NULL, last_error_sha256 = NULL, next_attempt_at = NULL
       WHERE event_id = ? AND destination = ? AND status = 'leased' AND lease_owner = ?
         AND lease_until > CURRENT_TIMESTAMP(3)`,
      [first?.partition ?? null, first?.baseOffset ?? first?.offset ?? null, item.event.eventId, destination, workerId],
    ));
    if (write?.affectedRows !== 1) throw leaseConflict(item.event.eventId);
  }

  async function recordFailure(item, error) {
    const attempt = Number(item.row.attempt_count || 0) + 1;
    const terminal = !error?.retryable || attempt >= maxAttempts;
    const failure = serializeRedactedContract({
      name: error?.name || "Error",
      message: error?.message || "Delivery failed",
      code: error?.code || "DELIVERY_FAILED",
      retryable: Boolean(error?.retryable),
    });
    const delayMs = terminal ? null : positiveInteger(backoffMs(attempt), "backoffMs");
    const [write] = await transaction((connection) => connection.execute(
      `UPDATE event_deliveries SET status = ?, attempt_count = attempt_count + 1,
       lease_owner = NULL, lease_until = NULL, last_error_json = CAST(? AS JSON),
       last_error_sha256 = ?, next_attempt_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL (? * 1000) MICROSECOND)
       WHERE event_id = ? AND destination = ? AND status = 'leased' AND lease_owner = ?
         AND lease_until > CURRENT_TIMESTAMP(3)`,
      [terminal ? "dead_letter" : "failed", failure.json, failure.sha256, delayMs, item.event.eventId, destination, workerId],
    ));
    if (write?.affectedRows !== 1) throw leaseConflict(item.event.eventId);
  }

  function leaseConflict(eventId) {
    const error = new Error(`Outbox delivery lease conflict: ${eventId}`);
    error.code = "OUTBOX_LEASE_CONFLICT";
    return error;
  }

  async function renewLease(item, leaseMs) {
    const [write] = await transaction((connection) => connection.execute(
      `UPDATE event_deliveries SET lease_until = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL (? * 1000) MICROSECOND)
       WHERE event_id = ? AND destination = ? AND status = 'leased' AND lease_owner = ?
         AND lease_until > CURRENT_TIMESTAMP(3)`,
      [leaseMs, item.event.eventId, destination, workerId],
    ));
    if (write?.affectedRows !== 1) throw leaseConflict(item.event.eventId);
  }

  return Object.freeze({
    async publishBatch({ limit, leaseMs }) {
      limit = positiveInteger(limit, "limit");
      leaseMs = positiveInteger(leaseMs, "leaseMs");
      const items = [];
      let published = 0;
      let failed = 0;
      const seen = new Set();
      while (items.length < limit) {
        const [item] = await claim({ limit: 1, leaseMs });
        if (!item || seen.has(item.event.eventId)) break;
        seen.add(item.event.eventId);
        items.push(item);
        const key = `${item.event.projectId}:${item.event.aggregateType}:${item.event.aggregateId}`;
        let heartbeat;
        try {
          await renewLease(item, leaseMs);
          heartbeat = startHeartbeat({
            intervalMs: Math.max(1, Math.floor(leaseMs / 3)),
            renew: () => renewLease(item, leaseMs),
          });
          const metadata = await producer.send({
            topic,
            messages: [{ key, value: JSON.stringify(item.event), headers: { eventId: item.event.eventId } }],
          });
          await heartbeat.stop();
          await recordPublished(item, metadata);
          published += 1;
        } catch (error) {
          let leaseError;
          try { await heartbeat?.stop(); } catch (failure) { leaseError = failure; }
          if (leaseError?.code === "OUTBOX_LEASE_CONFLICT" || error?.code === "OUTBOX_LEASE_CONFLICT") throw leaseError || error;
          await recordFailure(item, error);
          failed += 1;
        }
      }
      return Object.freeze({ claimed: items.length, published, failed });
    },
  });
}

module.exports = { createOutboxPublisher };
