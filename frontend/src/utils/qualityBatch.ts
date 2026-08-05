function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function buildReadableBatchId(taskId: string, timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`;
  return `QC_${datePart}_${timePart}_T${taskId}`;
}

export function formatQualityBatchId(value?: string | null) {
  const batchId = String(value || "").trim();
  if (!batchId) return "-";
  return batchId.replace(/qct_(\d+)_(\d{13})/gi, (legacyId, taskId, timestamp) => (
    buildReadableBatchId(taskId, Number(timestamp)) || legacyId
  ));
}
