const env = require("../config/env");
const { runMigrations } = require("../database/migrate");
const { seedAdminUser, seedDemoDataSources, seedDemoLabDataSources, seedPlatformAssets } = require("../database/seed");
const { pool } = require("../config/database");

(async () => {
  try {
    await runMigrations();
    await seedAdminUser();
    if (env.seedDemoData) {
      await seedDemoDataSources();
      await seedDemoLabDataSources();
      await seedPlatformAssets();
    }
    console.log("Bootstrap completed.");
    await pool.end();
  } catch (error) {
    console.error("Bootstrap failed:", error);
    await pool.end();
    process.exit(1);
  }
})();
