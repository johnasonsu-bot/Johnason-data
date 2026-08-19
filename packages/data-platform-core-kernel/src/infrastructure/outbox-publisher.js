function createOutboxPublisher({ repository, producer }) {
  if (!repository || !producer) throw new TypeError("repository and producer are required");
  return {
    async publishBatch(options = {}) {
      const events = await repository.claimBatch(options);
      let published = 0;
      let failed = 0;
      for (const event of events) {
        try {
          await producer.send(event);
          await repository.markPublished(event.id);
          published += 1;
        } catch (error) {
          await repository.markFailed(event.id, error.code || "EVENT_PUBLISH_FAILED");
          failed += 1;
        }
      }
      return { claimed: events.length, published, failed };
    },
  };
}

module.exports = { createOutboxPublisher };
