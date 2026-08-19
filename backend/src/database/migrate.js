const { pool } = require("../config/database");
const { createTableStatements, columnMigrations, postMigrations } = require("./schema");
const { cliRuntimeCreateTableStatements: cliRuntimeStatements } = require("@johnason/data-platform-core-kernel");
const { createTableStatements: dataModelingStatements } = require("../modules/data-lab/data-lab.migration");
const { createTableStatements: reportingStatements } = require("../modules/reporting/reporting.migration");
const {
  createTableStatements: dataStandardsStatements,
  postMigrations: dataStandardsPostMigrations,
} = require("../modules/data-standards/data-standards.migration");
const { createTableStatements: knowledgeBaseStatements } = require("../modules/system-knowledge-base/system-knowledge-base.migration");
const { createTableStatements: projectAssetStatements, postMigrations: projectAssetPostMigrations } = require("../modules/project-spaces/project-asset.migration");
async function columnExists(tableName,columnName){const [rows]=await pool.query("SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?",[tableName,columnName]);return rows[0].total>0;}
async function runMigrations(){const statements=[...createTableStatements,...cliRuntimeStatements,...dataModelingStatements,...reportingStatements,...dataStandardsStatements,...knowledgeBaseStatements,...projectAssetStatements];for(const statement of statements)await pool.query(statement);for(const migration of columnMigrations){const exists=await columnExists(migration.tableName,migration.columnName);if((migration.operation==="always"&&exists)||(migration.operation==="drop"&&exists)||(migration.operation!=="always"&&migration.operation!=="drop"&&!exists)){try{await pool.query(migration.definition);}catch(error){if(error.code!=="ER_NO_SUCH_TABLE")throw error;}}}for(const migration of [...(postMigrations||[]),...(dataStandardsPostMigrations||[]),...(projectAssetPostMigrations||[])])await migration(pool);}
module.exports={runMigrations};
