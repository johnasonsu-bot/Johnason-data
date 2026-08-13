const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../config/database");
const { migrationStatements, runMigrations } = require("./migrate");

const runDatabaseIntegration = process.env.RUN_DATABASE_MIGRATION_INTEGRATION === "true";

test("backend migration includes the aggregate CLI runtime schema and remains idempotent", async () => {
  const cliTables = [
    "cli_commands",
    "cli_audit_facts",
    "domain_events",
    "event_deliveries",
    "event_inbox",
    "durable_jobs",
    "durable_job_attempts",
    "durable_job_approvals",
  ];
  assert.equal(Array.isArray(migrationStatements), true);
  for (const table of cliTables) {
    const matching = migrationStatements.filter((statement) => new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(statement));
    assert.equal(matching.length, 1, `${table} must have one idempotent create statement`);
  }

  const calls = [];
  const database = { async query(sql, params) { calls.push({ sql, params }); return [[], []]; } };
  const options = { database, columns: [], afterMigrations: [] };
  await runMigrations(options);
  await runMigrations(options);
  for (const table of cliTables) {
    assert.equal(calls.filter(({ sql }) => new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(sql)).length, 2);
  }
});

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
