const { pool } = require("../config/database");
const { cliRuntimeMigration } = require("@johnason/data-platform-core");
const { createTableStatements, columnMigrations, postMigrations } = require("./schema");
const { createTableStatements: dataModelingStatements } = require("../modules/data-lab/data-lab.migration");
const { createTableStatements: reportingStatements } = require("../modules/reporting/reporting.migration");
const {
  createTableStatements: dataStandardsStatements,
  postMigrations: dataStandardsPostMigrations,
} = require("../modules/data-standards/data-standards.migration");
const { createTableStatements: knowledgeBaseStatements } = require("../modules/system-knowledge-base/system-knowledge-base.migration");
const { createTableStatements: projectAssetStatements, postMigrations: projectAssetPostMigrations } = require("../modules/project-spaces/project-asset.migration");

const migrationStatements = Object.freeze([
  ...createTableStatements,
  ...dataModelingStatements,
  ...reportingStatements,
  ...dataStandardsStatements,
  ...knowledgeBaseStatements,
  ...projectAssetStatements,
  ...cliRuntimeMigration.createTableStatements,
]);

const defaultAfterMigrations = Object.freeze([
  ...(postMigrations || []),
  ...(dataStandardsPostMigrations || []),
  ...(projectAssetPostMigrations || []),
]);

async function columnExists(database, tableName, columnName) {
  const [rows] = await database.query(
    "SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?",
    [tableName, columnName],
  );
  return rows[0].total > 0;
}

async function runMigrations({
  database = pool,
  statements = migrationStatements,
  columns = columnMigrations,
  afterMigrations = defaultAfterMigrations,
} = {}) {
  for (const statement of statements) await database.query(statement);
  for (const migration of columns) {
    const exists = await columnExists(database, migration.tableName, migration.columnName);
    const shouldRun = (migration.operation === "always" && exists)
      || (migration.operation === "drop" && exists)
      || (migration.operation !== "always" && migration.operation !== "drop" && !exists);
    if (!shouldRun) continue;
    try {
      await database.query(migration.definition);
    } catch (error) {
      if (error.code !== "ER_NO_SUCH_TABLE") throw error;
    }
  }
  for (const migration of afterMigrations) await migration(database);
}

module.exports = { migrationStatements, runMigrations };
