const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../config/database");
const { runMigrations } = require("./migrate");

const runDatabaseIntegration = process.env.RUN_DATABASE_MIGRATION_INTEGRATION === "true";

test("runMigrations applies project scope to standard data element tables", { skip: !runDatabaseIntegration }, async () => {
  try {
    await runMigrations();
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'std_data_elements'
         AND column_name = 'project_id'`,
    );
    assert.equal(Number(rows[0]?.total || 0), 1);
  } finally {
    await pool.end();
  }
});
