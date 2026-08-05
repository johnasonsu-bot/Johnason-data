const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function projectWhere() {
  const projectId = getCurrentProjectId();
  return projectId ? { sql: " WHERE project_id = ?", params: [projectId] } : { sql: "", params: [] };
}

async function countProjectTable(tableName) {
  const scoped = projectWhere();
  const [[row]] = await pool.query(`SELECT COUNT(*) AS total FROM ${tableName}${scoped.sql}`, scoped.params);
  return Number(row?.total || 0);
}

async function getModuleMetrics() {
  const [
    dataSourceCount,
    ingestionCount,
    qualityRuleCount,
    processingCount,
    modelTemplateCount,
    modelInstanceCount,
    serviceCount,
  ] = await Promise.all([
    countProjectTable("data_sources"),
    countProjectTable("ingestion_tasks"),
    countProjectTable("qc_strategy"),
    countProjectTable("dev_processing_jobs"),
    countProjectTable("lab_business_system_template"),
    countProjectTable("lab_business_system_instance"),
    countProjectTable("service_apis"),
  ]);

  return {
    dataSourceCount,
    ingestionJobCount: ingestionCount,
    qualityRuleCount,
    processingJobCount: processingCount,
    dataModelCount: Number(modelTemplateCount || 0) + Number(modelInstanceCount || 0),
    serviceApiCount: serviceCount,
  };
}

module.exports = {
  getModuleMetrics,
};
