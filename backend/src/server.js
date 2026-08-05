process.env.TZ = process.env.TZ || "Asia/Shanghai";

const env = require("./config/env");
const app = require("./app");
const { testConnection, pool } = require("./config/database");
const { runMigrations } = require("./database/migrate");
const { seedSystemRoles, seedAdminUser, seedDemoDataSources, seedDemoLabDataSources, seedBuiltinAiConfigs, seedPlatformAssets, seedScenarioEnhancementProfiles } = require("./database/seed");
const schedulerService = require("./services/schedulerService");
const ingestionJobRunRetention = require("./modules/ingestion-tasks/ingestion-job-run-retention");
const dataDevelopmentScheduler = require("./modules/data-development/data-development.scheduler");
const dataLabScheduler = require("./modules/data-lab/data-lab.scheduler");
const dataSourceResearchService = require("./modules/data-source-research/data-source-research.service");
const qualityScheduler = require("./modules/quality-control/quality-control.scheduler");
const projectAssetBackupScheduler = require("./modules/project-spaces/project-asset-backup.scheduler");
const { getRuntimeDatabaseCapabilityStatus } = require("./common/utils/datasource-capabilities");
const databaseDriverService = require("./modules/system-management/database-driver.service");

async function bootstrap() {
  try {
    await testConnection();
    await runMigrations();
    await seedSystemRoles();
    await seedAdminUser();
    await seedBuiltinAiConfigs();
    if (env.seedDemoData) {
      await seedDemoDataSources();
      await seedDemoLabDataSources();
      await seedPlatformAssets();
    }
    await seedScenarioEnhancementProfiles();
    await databaseDriverService.restoreActiveManifest();
    console.log("[DatabaseCapabilities]", getRuntimeDatabaseCapabilityStatus().map((item) => `${item.type}:${item.driverLoaded ? "ready" : "missing"}`).join(", "));
    if (env.nodeEnv !== "test") {
      const recoveredResearchRuns = await dataSourceResearchService.reconcileRunningResearchRunsAfterRestart();
      if (recoveredResearchRuns > 0) {
        console.log(`[DataSourceResearch] Recovered ${recoveredResearchRuns} stale research runs after restart`);
      }
      if (env.backgroundSchedulersEnabled) {
        schedulerService.startScheduler();
        ingestionJobRunRetention.startScheduler();
        await dataDevelopmentScheduler.startScheduler();
        await dataLabScheduler.startScheduler();
        qualityScheduler.startScheduler();
        projectAssetBackupScheduler.startScheduler();
      } else {
        console.log("[Scheduler] Background schedulers disabled by BACKGROUND_SCHEDULERS_ENABLED=false");
      }
    }

    app.listen(env.port, () => {
      console.log(`medata backend running at http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await pool.end();
    process.exit(1);
  }
}

bootstrap();
