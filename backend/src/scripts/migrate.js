const { runMigrations } = require("../database/migrate");
const { pool } = require("../config/database");

(async () => {
  try {
    await runMigrations();
    console.log("Migrations completed.");
    await pool.end();
  } catch (error) {
    console.error("Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
})();
