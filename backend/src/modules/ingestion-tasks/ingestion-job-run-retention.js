const cron = require("node-cron");
const repository = require("./ingestion-task.repository");

const RETENTION_DAYS = 30;
const CLEANUP_CRON = "0 * * * *";

let cleanupJob = null;
let cleanupRunning = false;

async function cleanupOldJobRuns(options = {}) {
  return repository.cleanupOldJobRuns({
    retentionDays: options.retentionDays || RETENTION_DAYS,
    batchSize: options.batchSize,
  });
}

function startScheduler() {
  if (cleanupJob) {
    return true;
  }

  cleanupJob = cron.schedule(
    CLEANUP_CRON,
    async () => {
      if (cleanupRunning) {
        return;
      }

      cleanupRunning = true;
      try {
        const result = await cleanupOldJobRuns();
        if (result.deleted > 0) {
          console.log(`[IngestionRetention] Deleted ${result.deleted} job run logs older than ${result.retentionDays} days`);
        }
      } catch (error) {
        console.error("[IngestionRetention] Cleanup failed:", error.message);
      } finally {
        cleanupRunning = false;
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Shanghai",
    }
  );

  console.log(`[IngestionRetention] Scheduled job run cleanup with cron: ${CLEANUP_CRON}`);
  return true;
}

function stopScheduler() {
  if (!cleanupJob) {
    return false;
  }

  cleanupJob.stop();
  cleanupJob = null;
  return true;
}

module.exports = {
  cleanupOldJobRuns,
  startScheduler,
  stopScheduler,
};
