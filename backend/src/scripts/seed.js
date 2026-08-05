const { seedAdminUser, seedDemoDataSources, seedDemoLabDataSources, seedPlatformAssets } = require("../database/seed");
const { pool } = require("../config/database");

(async () => {
  try {
    await seedAdminUser();
    await seedDemoDataSources();
    await seedDemoLabDataSources();
    await seedPlatformAssets();
    console.log("Seed completed.");
    await pool.end();
  } catch (error) {
    console.error("Seed failed:", error);
    await pool.end();
    process.exit(1);
  }
})();
