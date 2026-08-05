function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function buildQualityBatchId(taskId, value = new Date()) {
  const normalizedTaskId = Number(taskId);
  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) {
    throw new Error("Quality task id must be a positive integer");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Quality batch time is invalid");
  }
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`;
  return `QC_${datePart}_${timePart}_T${normalizedTaskId}`;
}

module.exports = {
  buildQualityBatchId,
};
