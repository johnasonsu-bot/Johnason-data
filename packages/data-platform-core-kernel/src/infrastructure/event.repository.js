const crypto = require("node:crypto");

const { serializeRedactedContract } = require("./command.repository");

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} is required`);
  return value.trim();
}

function projectScope(projectId) {
  const value = Number(projectId ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("projectId must be a non-negative integer");
  return value;
}

async function appendEvent(candidate, connection) {
  const aggregate = candidate?.aggregate || {};
  const eventId = requiredString(candidate?.eventId || crypto.randomUUID(), "eventId");
  const eventType = requiredString(candidate?.eventType, "eventType");
  const actor = serializeRedactedContract(candidate?.actor || {});
  const payload = serializeRedactedContract(candidate?.payload || {});
  await connection.execute(
    `INSERT INTO domain_events
     (event_id, event_type, event_version, project_id, aggregate_type, aggregate_id,
      actor_json, command_id, audit_id, correlation_id, causation_id, contract_version,
      payload_json, payload_sha256)
     VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
    [
      eventId,
      eventType,
      Number(candidate?.eventVersion ?? aggregate.version ?? 1),
      projectScope(candidate?.projectId),
      requiredString(aggregate.type, "aggregate.type"),
      requiredString(String(aggregate.id ?? ""), "aggregate.id"),
      actor.json,
      requiredString(candidate?.commandId, "commandId"),
      requiredString(candidate?.auditId, "auditId"),
      candidate?.correlationId || null,
      candidate?.causationId || null,
      Number(candidate?.contractVersion ?? 1),
      payload.json,
      payload.sha256,
    ],
  );
  return Object.freeze({ eventId, eventType, payloadSha256: payload.sha256 });
}

async function recordDeliveryAttempt(candidate, connection) {
  const error = candidate?.error == null ? null : serializeRedactedContract(candidate.error);
  await connection.execute(
    `INSERT INTO event_deliveries
     (event_id, destination, status, attempt_count, kafka_partition, kafka_offset,
      last_error_json, last_error_sha256, next_attempt_at)
     VALUES (?, ?, ?, 1, ?, ?, CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), attempt_count = attempt_count + 1,
       kafka_partition = VALUES(kafka_partition), kafka_offset = VALUES(kafka_offset),
       last_error_json = VALUES(last_error_json), last_error_sha256 = VALUES(last_error_sha256),
       next_attempt_at = VALUES(next_attempt_at)`,
    [
      requiredString(candidate?.eventId, "eventId"),
      requiredString(candidate?.destination, "destination"),
      requiredString(candidate?.status, "status"),
      candidate?.kafkaPartition ?? null,
      candidate?.kafkaOffset ?? null,
      error?.json ?? null,
      error?.sha256 ?? null,
      candidate?.nextAttemptAt ?? null,
    ],
  );
  return Object.freeze({ eventId: candidate.eventId, destination: candidate.destination, status: candidate.status });
}

async function acceptInboxEvent(candidate, connection) {
  const payload = serializeRedactedContract(candidate?.payload || {});
  try {
    await connection.execute(
      `INSERT INTO event_inbox (consumer_name, event_id, project_id, payload_sha256)
       VALUES (?, ?, ?, ?)`,
      [requiredString(candidate?.consumerName, "consumerName"), requiredString(candidate?.eventId, "eventId"), projectScope(candidate?.projectId), payload.sha256],
    );
    return Object.freeze({ accepted: true, eventId: candidate.eventId, payloadSha256: payload.sha256 });
  } catch (error) {
    if (error?.code !== "ER_DUP_ENTRY") throw error;
    return Object.freeze({ accepted: false, eventId: candidate.eventId, payloadSha256: payload.sha256 });
  }
}

module.exports = { acceptInboxEvent, appendEvent, recordDeliveryAttempt };
