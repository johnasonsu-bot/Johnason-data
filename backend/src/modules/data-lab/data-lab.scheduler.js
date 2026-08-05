const cron = require("node-cron");
const service = require("./data-lab.service");
const aiBusinessDataService = require("./scenario-management/ai-business-data.service");

const scheduledTasks = new Map();
const scheduledAiBusinessDataTasks = new Map();

function stopSceneSchedule(sceneId) {
  const task = scheduledTasks.get(sceneId);
  if (task) {
    task.stop();
    scheduledTasks.delete(sceneId);
  }
}

function stopAiBusinessDataTaskSchedule(taskId) {
  const task = scheduledAiBusinessDataTasks.get(taskId);
  if (task) {
    task.stop();
    scheduledAiBusinessDataTasks.delete(taskId);
  }
}

async function reloadAiBusinessDataTaskSchedules() {
  const tasks = await aiBusinessDataService.listSchedulableAiBusinessDataTasks();
  const activeIds = new Set(tasks.map((task) => task.id));
  for (const taskId of scheduledAiBusinessDataTasks.keys()) {
    if (!activeIds.has(taskId)) {
      stopAiBusinessDataTaskSchedule(taskId);
    }
  }
  tasks.forEach((taskRecord) => {
    if (!taskRecord.cronExpr || !cron.validate(taskRecord.cronExpr)) {
      return;
    }
    stopAiBusinessDataTaskSchedule(taskRecord.id);
    const task = cron.schedule(taskRecord.cronExpr, async () => {
      try {
        await aiBusinessDataService.runAiBusinessDataTask(taskRecord.id, { triggerType: "schedule" }, { username: "system" });
      } catch (error) {
        console.error(`[DataLabScheduler] AI business data task ${taskRecord.id} failed:`, error.message);
      }
    });
    scheduledAiBusinessDataTasks.set(taskRecord.id, task);
  });
}

async function reloadSchedules() {
  const scenes = await service.listSchedulableScenes();
  const activeIds = new Set(scenes.map((scene) => scene.id));
  for (const sceneId of scheduledTasks.keys()) {
    if (!activeIds.has(sceneId)) {
      stopSceneSchedule(sceneId);
    }
  }
  scenes.forEach((scene) => {
    const expr = scene.incrCycle === "MINUTE" ? "*/5 * * * *" : scene.incrCycle === "HOUR" ? "0 * * * *" : "0 2 * * *";
    if (!cron.validate(expr)) {
      return;
    }
    stopSceneSchedule(scene.id);
    const task = cron.schedule(expr, async () => {
      await service.executeScheduledIncrement(scene.id);
    });
    scheduledTasks.set(scene.id, task);
  });
  await reloadAiBusinessDataTaskSchedules();
}

async function startScheduler() {
  await reloadSchedules();
}

module.exports = {
  startScheduler,
  reloadSchedules,
  reloadAiBusinessDataTaskSchedules,
  stopSceneSchedule,
  stopAiBusinessDataTaskSchedule
};
