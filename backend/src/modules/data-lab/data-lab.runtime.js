const fs = require("fs");
const path = require("path");

const runtimeRoot = path.resolve(__dirname, "../../runtime");
const topicRoot = path.join(runtimeRoot, "data-lab-topics");
const exportRoot = path.join(runtimeRoot, "data-lab-exports");
const templateDocRoot = path.join(runtimeRoot, "data-lab-template-docs");

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function ensureRuntimeStructure() {
  ensureDir(runtimeRoot);
  ensureDir(topicRoot);
  ensureDir(exportRoot);
  ensureDir(templateDocRoot);
}

function getSceneTopicDir(sceneCode) {
  ensureRuntimeStructure();
  const dir = path.join(topicRoot, String(sceneCode || "default"));
  ensureDir(dir);
  return dir;
}

function getTopicFilePath(sceneCode, topicName) {
  const dir = getSceneTopicDir(sceneCode);
  const fileName = String(topicName || "topic").replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(dir, `${fileName}.jsonl`);
}

function createTopic(sceneCode, topicName) {
  const filePath = getTopicFilePath(sceneCode, topicName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf8");
  }
  return filePath;
}

function deleteTopic(sceneCode, topicName) {
  const filePath = getTopicFilePath(sceneCode, topicName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function clearSceneTopics(sceneCode) {
  ensureRuntimeStructure();
  const dir = path.join(topicRoot, String(sceneCode || "default"));
  fs.rmSync(dir, { recursive: true, force: true });
}

function appendTopicMessages(sceneCode, topicName, messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return;
  }
  const filePath = createTopic(sceneCode, topicName);
  fs.appendFileSync(filePath, `${messages.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

function readTopicMessages(sceneCode, topicName, limit = 20) {
  const filePath = getTopicFilePath(sceneCode, topicName);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { raw: line };
      }
    });
}

function getTopicMetrics(sceneCode, topicName) {
  const filePath = getTopicFilePath(sceneCode, topicName);
  if (!fs.existsSync(filePath)) {
    return {
      fileExists: false,
      messageCount: 0,
      lastMessageAt: null,
      sizeBytes: 0
    };
  }
  const stat = fs.statSync(filePath);
  const messages = readTopicMessages(sceneCode, topicName, Number.MAX_SAFE_INTEGER);
  const lastMessage = messages[messages.length - 1] || null;
  return {
    fileExists: true,
    messageCount: messages.length,
    lastMessageAt: lastMessage?.eventTime || stat.mtime.toISOString(),
    sizeBytes: stat.size
  };
}

function exportSceneArtifact(sceneCode, runId, fileName, content) {
  ensureRuntimeStructure();
  const dir = path.join(exportRoot, `run-${runId}`);
  ensureDir(dir);
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function deleteRunArtifacts(runIds) {
  ensureRuntimeStructure();
  for (const runId of runIds || []) {
    const dir = path.join(exportRoot, `run-${runId}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = {
  ensureRuntimeStructure,
  createTopic,
  deleteTopic,
  clearSceneTopics,
  appendTopicMessages,
  readTopicMessages,
  getTopicMetrics,
  exportSceneArtifact,
  deleteRunArtifacts
};
