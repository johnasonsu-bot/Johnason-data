const cron = require("node-cron");
const env = require("../../config/env");
const projectRepository = require("./project-space.repository");
const projectAssetService = require("./project-asset.service");

let scheduledTask = null;

async function runScheduledProjectBackups() {
  const projects = await projectRepository.listProjects({ includeInactive: false });
  const result = { total: projects.length, success: 0, failed: 0 };
  for (const project of projects) {
    try {
      await projectAssetService.createProjectBackup(project.id, { username: "scheduled-backup" });
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`[ProjectBackup] ${project.projectCode} failed: ${error.message}`);
    }
  }
  console.log(`[ProjectBackup] completed: ${result.success}/${result.total}`);
  return result;
}

function startScheduler() {
  if (!env.projectAssetBackup.enabled || scheduledTask) return;
  if (!cron.validate(env.projectAssetBackup.cron)) {
    console.error(`[ProjectBackup] invalid cron: ${env.projectAssetBackup.cron}`);
    return;
  }
  scheduledTask = cron.schedule(env.projectAssetBackup.cron, () => {
    runScheduledProjectBackups().catch((error) => console.error(`[ProjectBackup] scheduler failed: ${error.message}`));
  });
  console.log(`[ProjectBackup] scheduler started: ${env.projectAssetBackup.cron}`);
}

function stopScheduler() {
  scheduledTask?.stop();
  scheduledTask = null;
}

module.exports = { startScheduler, stopScheduler, runScheduledProjectBackups };
