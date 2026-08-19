function createInboxConsumer({ transaction, inboxRepository }) {
  if (typeof transaction !== "function" || !inboxRepository) throw new TypeError("transaction and inboxRepository are required");
  return {
    async consumeEvent(consumerName, event, handler) {
      return transaction(async (connection) => {
        const receipt = await inboxRepository.record(connection, consumerName, event);
        if (receipt.duplicate) return { duplicate: true };
        await handler(event, connection);
        return { duplicate: false };
      });
    },
  };
}

module.exports = { createInboxConsumer };
