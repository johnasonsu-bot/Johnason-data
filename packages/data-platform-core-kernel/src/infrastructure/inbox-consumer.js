const { serializeRedactedContract } = require("./command.repository");

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} is required`);
  return value.trim();
}

function createInboxConsumer({ transaction }) {
  if (typeof transaction !== "function") throw new TypeError("Inbox consumer requires transaction");
  return Object.freeze({
    async consumeEvent(consumerName, event, handler) {
      consumerName = requiredString(consumerName, "consumerName");
      const eventId = requiredString(event?.eventId, "event.eventId");
      if (typeof handler !== "function") throw new TypeError("Inbox event handler is required");
      return transaction(async (connection) => {
        const payload = serializeRedactedContract(event?.payload || {});
        try {
          await connection.execute(
            `INSERT INTO event_inbox (consumer_name, event_id, project_id, payload_sha256)
             VALUES (?, ?, ?, ?)`,
            [consumerName, eventId, Number(event?.projectId || 0), payload.sha256],
          );
        } catch (error) {
          if (error?.code !== "ER_DUP_ENTRY") throw error;
          return Object.freeze({ duplicate: true, processed: false, eventId });
        }
        await handler(event, connection);
        const [write] = await connection.execute(
          `UPDATE event_inbox SET processed_at = CURRENT_TIMESTAMP(3)
           WHERE consumer_name = ? AND event_id = ? AND processed_at IS NULL`,
          [consumerName, eventId],
        );
        if (write?.affectedRows !== 1) throw new Error(`Inbox checkpoint conflict: ${eventId}`);
        return Object.freeze({ duplicate: false, processed: true, eventId });
      });
    },
  });
}

module.exports = { createInboxConsumer };
