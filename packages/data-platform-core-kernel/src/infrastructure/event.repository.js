const crypto = require("node:crypto");
const { redact, digest } = require("./value-utils");

function createEventRepository(connection) {
  if (!connection || typeof connection.query !== "function") throw new TypeError("transaction connection is required");
  return {
    async appendEvent(input) {
      const id = input.eventId || crypto.randomUUID();
      const payload = redact(input.payload || {});
      const payloadDigest = digest(payload);
      await connection.query(
        "INSERT INTO domain_events (id, event_type, aggregate_type, aggregate_id, project_id, payload_json, payload_sha256, audit_id, command_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, input.eventType, input.aggregate.type, String(input.aggregate.id), input.projectId ?? null, JSON.stringify(payload), payloadDigest, input.auditId, input.commandId],
      );
      await connection.query(
        "INSERT INTO event_deliveries (event_id, destination) VALUES (?, ?)",
        [id, input.destination || "kafka"],
      );
      return { id, payloadSha256: payloadDigest };
    },
    async recordInbox(consumerName, event) {
      try {
        await connection.query(
          "INSERT INTO event_inbox (consumer_name, event_id, payload_sha256) VALUES (?, ?, ?)",
          [consumerName, event.id, event.payloadSha256],
        );
        return { duplicate: false };
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return { duplicate: true };
        throw error;
      }
    },
  };
}

module.exports = { createEventRepository };
