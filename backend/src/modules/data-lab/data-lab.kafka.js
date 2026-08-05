const { Kafka, logLevel } = require("kafkajs");
const env = require("../../config/env");

let kafkaInstance = null;
let adminInstance = null;
let producerInstance = null;
const consumerRegistry = new Map();

function isKafkaEnabled() {
  return env.kafka.enabled && Array.isArray(env.kafka.bootstrapServers) && env.kafka.bootstrapServers.length > 0;
}

function getKafka() {
  if (!isKafkaEnabled()) {
    return null;
  }
  if (!kafkaInstance) {
    kafkaInstance = new Kafka({
      clientId: env.kafka.clientId,
      brokers: env.kafka.bootstrapServers,
      logLevel: logLevel.NOTHING,
      retry: {
        initialRetryTime: 300,
        retries: 5,
      },
    });
  }
  return kafkaInstance;
}

async function getAdmin() {
  const kafka = getKafka();
  if (!kafka) return null;
  if (!adminInstance) {
    adminInstance = kafka.admin();
    await adminInstance.connect();
  }
  return adminInstance;
}

async function getProducer() {
  const kafka = getKafka();
  if (!kafka) return null;
  if (!producerInstance) {
    producerInstance = kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
      maxInFlightRequests: 1,
      retry: {
        retries: 5,
      },
    });
    await producerInstance.connect();
  }
  return producerInstance;
}

async function ensureTopic(topicName, partitions = 3, replicationFactor = 1) {
  const admin = await getAdmin();
  if (!admin) {
    return { available: false, created: false };
  }
  const existing = await admin.listTopics();
  if (existing.includes(topicName)) {
    return { available: true, created: false };
  }
  const created = await admin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic: topicName,
        numPartitions: partitions,
        replicationFactor,
      },
    ],
  });
  return { available: true, created };
}

async function deleteTopic(topicName) {
  const admin = await getAdmin();
  if (!admin) {
    return { available: false, deleted: false };
  }
  try {
    await admin.deleteTopics({ topics: [topicName] });
    return { available: true, deleted: true };
  } catch (error) {
    if (String(error.message || "").includes("UNKNOWN_TOPIC_OR_PARTITION")) {
      return { available: true, deleted: false };
    }
    throw error;
  }
}

async function topicExists(topicName) {
  const admin = await getAdmin();
  if (!admin) return false;
  const topics = await admin.listTopics();
  return topics.includes(topicName);
}

async function getTopicMetadata(topicName) {
  const admin = await getAdmin();
  if (!admin) {
    return { available: false, topicName, partitions: [], brokerCount: 0 };
  }
  const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
  const topic = (metadata.topics || []).find((item) => item.name === topicName);
  return {
    available: true,
    topicName,
    brokerCount: (metadata.brokers || []).length,
    partitions: (topic?.partitions || []).map((partition) => ({
      partitionId: partition.partitionId,
      leader: partition.leader,
      replicas: partition.replicas,
      isr: partition.isr,
    })),
  };
}

async function sendMessages(topicName, messages, keyField = "traceId") {
  const producer = await getProducer();
  if (!producer) {
    return { available: false, count: 0 };
  }
  await ensureTopic(topicName);
  const kafkaMessages = messages.map((message) => ({
    key: message?.[keyField] ? String(message[keyField]) : undefined,
    value: JSON.stringify(message),
  }));
  const result = await producer.send({
    topic: topicName,
    messages: kafkaMessages,
    acks: -1,
  });
  return { available: true, count: kafkaMessages.length, result };
}

async function startConsumer({ sceneCode, topicName, groupId, eachMessage }) {
  const kafka = getKafka();
  if (!kafka) {
    return { available: false, started: false };
  }
  const consumerKey = `${sceneCode}:${topicName}:${groupId}`;
  if (consumerRegistry.has(consumerKey)) {
    return { available: true, started: false, consumerKey };
  }
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: topicName, fromBeginning: false });
  await consumer.run({
    eachMessage,
  });
  consumerRegistry.set(consumerKey, consumer);
  return { available: true, started: true, consumerKey };
}

async function stopConsumersByScene(sceneCode) {
  const keys = [...consumerRegistry.keys()].filter((key) => key.startsWith(`${sceneCode}:`));
  for (const key of keys) {
    const consumer = consumerRegistry.get(key);
    try {
      await consumer.stop();
      await consumer.disconnect();
    } catch (error) {
      // ignore shutdown errors
    }
    consumerRegistry.delete(key);
  }
}

module.exports = {
  isKafkaEnabled,
  ensureTopic,
  deleteTopic,
  topicExists,
  getTopicMetadata,
  sendMessages,
  startConsumer,
  stopConsumersByScene,
};
