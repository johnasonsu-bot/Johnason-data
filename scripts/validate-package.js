const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(process.argv[2] || process.cwd());
const failures = [];

function fail(message) {
  failures.push(message);
}

function relative(filePath) {
  return path.relative(packageRoot, filePath).replace(/\\/g, "/");
}

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    output.push(fullPath);
    if (entry.isDirectory()) walk(fullPath, output);
  }
  return output;
}

if (!fs.existsSync(packageRoot)) throw new Error(`Package root not found: ${packageRoot}`);

const requiredPaths = [
  "SOURCE_PACKAGE_MANIFEST.json",
  "SOURCE_FILE_SHA256SUMS.txt",
  "THIRD_PARTY_NOTICES.md",
  "环境说明与启动指南.md",
  ".env.example",
  "compose.dev.yml",
  "backend/package.json",
  "backend/package-lock.json",
  "backend/src/app.js",
  "backend/src/modules/system-knowledge-base/system-knowledge-base.routes.js",
  "frontend/package.json",
  "frontend/package-lock.json",
  "frontend/src/services/systemKnowledgeBases.ts",
  "frontend/src/pages/system/SystemKnowledgeBasePage.tsx",
  "scripts/start-dev.ps1",
  "scripts/stop-dev.ps1",
  "scripts/verify-package.ps1",
  "seed-data/project-assets/manifest.json",
  "seed-data/project-assets/quality-regex-rules.json",
];
for (const item of requiredPaths) {
  if (!fs.existsSync(path.join(packageRoot, item))) fail(`缺少必需文件：${item}`);
}

const forbiddenExactPaths = [
  "node_modules", "dist", "runtime", "keys", "deploy", "delivery", "images", "bootstrap", "logs", "log", "log_perf", ".env",
  "frontend/src/pages/online-docs", "frontend/src/pages/agent-platform", "frontend/src/pages/dev-tools", "frontend/src/pages/data-experiment-lab",
  "frontend/src/services/onlineDocs.ts", "frontend/src/services/agentPlatform.ts", "frontend/src/services/devTools.ts", "frontend/src/services/dataExperimentLab.ts",
  "backend/src/modules/online-docs", "backend/src/modules/agent-platform", "backend/src/modules/dev-tools", "backend/src/modules/data-experiment-lab",
  "backend/src/modules/licenses", "backend/src/modules/ops-robot",
];
for (const item of forbiddenExactPaths) {
  if (fs.existsSync(path.join(packageRoot, item))) fail(`发现禁止路径：${item}`);
}

const entries = walk(packageRoot);
const forbiddenNames = new Set(["node_modules", "dist", "dist-secure", "runtime", "keys", ".git", "__pycache__", "logs", "log", "log_perf"]);
const forbiddenFilePatterns = [/\.log$/i, /\.pyc$/i, /\.tsbuildinfo$/i, /^tmp_/i, /^\.env$/i];
for (const entry of entries) {
  const stat = fs.statSync(entry);
  const name = path.basename(entry);
  if (forbiddenNames.has(name)) fail(`发现禁止目录：${relative(entry)}`);
  if (stat.isFile() && forbiddenFilePatterns.some((pattern) => pattern.test(name))) fail(`发现禁止文件：${relative(entry)}`);
}

const sourceExtensions = new Set([".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".json", ".css", ".html", ".ps1", ".yml", ".yaml"]);
const excludedContentFiles = new Set(["SOURCE_PACKAGE_MANIFEST.json"]);
const forbiddenContentPatterns = [
  [/\/api\/v1\/(agent-platform|online-docs|dev-tools|data-experiment-lab|licenses|ops-robot)/i, "禁止接口"],
  [/modules\/(agent-platform|online-docs|dev-tools|data-experiment-lab|licenses|ops-robot)/i, "禁止后端模块引用"],
  [/services\/(agentPlatform|onlineDocs|devTools|dataExperimentLab)/i, "禁止前端服务引用"],
  [/agent_platform_/i, "智能体平台数据表"],
  [/experiment_lab_/i, "独立实验平台数据表"],
  [/\bops_robot\b/i, "接入运维机器人"],
  [/\bdify\b/i, "Dify 能力"],
];
for (const entry of entries) {
  if (!fs.statSync(entry).isFile()) continue;
  const rel = relative(entry);
  if (excludedContentFiles.has(rel) || rel === "SOURCE_FILE_SHA256SUMS.txt" || rel === "scripts/validate-package.js" || rel.startsWith("seed-data/") || rel.endsWith(".md") || rel.endsWith(".docx")) continue;
  if (!sourceExtensions.has(path.extname(entry).toLowerCase())) continue;
  const content = fs.readFileSync(entry, "utf8");
  for (const [pattern, label] of forbiddenContentPatterns) {
    if (pattern.test(content)) fail(`${rel} 包含${label}`);
  }
}

const manifestPath = path.join(packageRoot, "SOURCE_PACKAGE_MANIFEST.json");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
  if (manifest.status !== "ready") fail("源码包清单状态不是 ready");
  if (manifest.assemblyPolicy !== "strict-whitelist") fail("源码包未声明 strict-whitelist");
  if (manifest.approvedBaselineDate !== "2026-07-18") fail("源码包批准基线日期不正确");
}

const snapshotManifestPath = path.join(packageRoot, "seed-data/project-assets/manifest.json");
if (fs.existsSync(snapshotManifestPath)) {
  const snapshotManifest = JSON.parse(fs.readFileSync(snapshotManifestPath, "utf8").replace(/^\uFEFF/, ""));
  const runtimeTables = [
    /^asset_search_ai_runs$/i, /^asset_search_feedback$/i, /^auth_sessions$/i,
    /^data_source_research_ai_batches$/i, /^data_source_research_logs$/i, /^data_source_research_runs$/i,
    /^dev_job_instances$/i, /^dev_job_logs$/i, /^dev_processing_run_logs$/i, /^dev_processing_runs$/i,
    /^dev_query_history$/i, /^dev_workflow_runs$/i, /^file_import_run_errors$/i, /^file_import_runs$/i,
    /^ingestion_api_sync_states$/i, /^ingestion_job_runs$/i, /^lab_industry_incubation_log$/i,
    /^project_audit_logs$/i, /^qc_finding$/i, /^qc_issue(?:_|$)/i, /^qc_recommendation_run$/i,
    /^qc_result_/i, /^qc_task_run$/i, /^reporting_ai_runs$/i,
    /^service_api_call_logs$/i, /^std_compliance_findings$/i, /^std_compliance_runs$/i,
  ];
  for (const project of snapshotManifest.projects || []) {
    const snapshotPath = path.join(packageRoot, "seed-data/project-assets", project.fileName);
    if (!fs.existsSync(snapshotPath)) continue;
    const payload = JSON.parse(fs.readFileSync(snapshotPath, "utf8").replace(/^\uFEFF/, ""));
    for (const table of payload.tables || []) {
      if (runtimeTables.some((pattern) => pattern.test(table.tableName))) fail(`${project.fileName} 仍包含运行表：${table.tableName}`);
      const reportSyncColumns = ["online_document_id", "document_sync_status", "document_synced_at", "document_sync_error"];
      if (table.tableName === "qc_report" && reportSyncColumns.some((columnName) => table.columns.includes(columnName))) {
        fail(`${project.fileName} 仍包含质量报告在线文档同步字段`);
      }
      for (const row of table.rows || []) {
        if (table.tableName === "dev_datasources") {
          const extraConfig = typeof row.extra_config_json === "string" ? JSON.parse(row.extra_config_json || "{}") : row.extra_config_json || {};
          if (row.host !== "example.invalid" || Number(row.port) !== 0 || row.database_name !== "replace_with_your_database") {
            fail(`${project.fileName} 的 dev_datasources 仍包含部署环境连接信息`);
          }
          if (row.username || row.password_encrypted || extraConfig.redacted !== true || extraConfig.connectionConfigured !== false) {
            fail(`${project.fileName} 的 dev_datasources 未正确脱敏`);
          }
        }
        for (const columnName of ["connection_config", "connection_config_json"]) {
          if (!Object.prototype.hasOwnProperty.call(row, columnName)) continue;
          const config = typeof row[columnName] === "string" ? JSON.parse(row[columnName] || "{}") : row[columnName] || {};
          if (config.host !== "example.invalid" || config.redacted !== true || config.connectionConfigured !== false) {
            fail(`${project.fileName} 的 ${table.tableName}.${columnName} 未正确标记为脱敏连接`);
          }
        }
      }
    }
  }
  const qualityRuleSeed = snapshotManifest.qualityRegexRules;
  const qualityRulePath = qualityRuleSeed?.fileName ? path.join(packageRoot, "seed-data/project-assets", path.basename(qualityRuleSeed.fileName)) : null;
  if (!qualityRulePath || !fs.existsSync(qualityRulePath)) {
    fail("缺少质量正则规则种子文件");
  } else {
    const rules = JSON.parse(fs.readFileSync(qualityRulePath, "utf8").replace(/^\uFEFF/, ""));
    const ruleCodes = new Set();
    if (!Array.isArray(rules) || rules.length !== Number(qualityRuleSeed.rowCount || 0)) fail("质量正则规则种子数量与清单不一致");
    for (const [index, rule] of (Array.isArray(rules) ? rules : []).entries()) {
      if (!rule?.rule_code || !rule?.rule_name || !rule?.regex_pattern) fail(`质量正则规则种子字段不完整：${index}`);
      if (rule?.status === "deleted") fail(`质量正则规则种子包含已删除规则：${rule.rule_code}`);
      if (ruleCodes.has(rule?.rule_code)) fail(`质量正则规则种子编码重复：${rule.rule_code}`);
      ruleCodes.add(rule?.rule_code);
    }
  }
}

const rolePagePath = path.join(packageRoot, "frontend/src/pages/system/SystemRoleManagementPage.tsx");
if (fs.existsSync(rolePagePath) && /(智能体平台|开发工具|独立实验平台|在线文档|许可证管理)/.test(fs.readFileSync(rolePagePath, "utf8"))) {
  fail("角色管理页面仍包含规定外模块选项");
}
const serviceManagementPath = path.join(packageRoot, "backend/src/modules/system-management/system-management.service.js");
if (fs.existsSync(serviceManagementPath) && /智能体平台基础配置/.test(fs.readFileSync(serviceManagementPath, "utf8"))) {
  fail("系统服务能力示例仍包含规定外模块");
}

const qualityReportFiles = [
  "backend/src/database/schema.js",
  "backend/src/modules/quality-control/quality-analytics.service.js",
  "backend/src/modules/quality-control/quality-control.controller.js",
  "backend/src/modules/quality-control/quality-control.routes.js",
  "frontend/src/pages/quality-control/QualityControlReportsPage.tsx",
  "frontend/src/services/qualityControl.ts",
];
for (const relativePath of qualityReportFiles) {
  const filePath = path.join(packageRoot, relativePath);
  if (fs.existsSync(filePath) && /(online_document_id|onlineDocumentId|document_sync|document-sync|updateReportDocumentSync|updateQualityReportDocumentSync)/i.test(fs.readFileSync(filePath, "utf8"))) {
    fail(`${relativePath} 仍包含质量报告在线文档同步逻辑`);
  }
}

const databaseSchemaPath = path.join(packageRoot, "backend/src/database/schema.js");
if (fs.existsSync(databaseSchemaPath)) {
  const { columnMigrations = [] } = require(databaseSchemaPath);
  for (const [index, migration] of columnMigrations.entries()) {
    if (!migration || typeof migration.tableName !== "string" || typeof migration.columnName !== "string" || typeof migration.definition !== "string") {
      fail(`数据库字段迁移定义不完整：columnMigrations[${index}]`);
    }
  }
}

const startScriptPath = path.join(packageRoot, "scripts/start-dev.ps1");
if (fs.existsSync(startScriptPath)) {
  const startScript = fs.readFileSync(startScriptPath, "utf8");
  if (!/Stop-StaleSourcePortProcess 46120/.test(startScript) || !/Stop-StaleSourcePortProcess 46121/.test(startScript)) {
    fail("源码版启动脚本未清理旧前后端端口进程");
  }
  if (!/npm\.cmd run dev -- --force/.test(startScript)) fail("源码版前端启动未强制重建 Vite 依赖缓存");
}

const routerPath = path.join(packageRoot, "frontend/src/app/router/index.tsx");
if (fs.existsSync(routerPath) && !/reloadForLazyRouteFailure/.test(fs.readFileSync(routerPath, "utf8"))) {
  fail("源码版路由未配置动态模块加载失败自动恢复");
}

const qualityServicePath = path.join(packageRoot, "backend/src/modules/quality-control/quality-control.service.js");
if (fs.existsSync(qualityServicePath) && !/isRedactedSourceConnection/.test(fs.readFileSync(qualityServicePath, "utf8"))) {
  fail("源码版质量结果统计未跳过脱敏数据源连接");
}

const seedImportPath = path.join(packageRoot, "scripts/import-seed-project-assets.js");
if (fs.existsSync(seedImportPath)) {
  const seedImport = fs.readFileSync(seedImportPath, "utf8");
  if (!/seed-assets\.sha256/.test(seedImport) || !/mode: existing \? "overwrite" : "new"/.test(seedImport) || !/removeSharedStandardAssets/.test(seedImport) || !/ensureLocalDevelopmentDatasource/.test(seedImport)) {
    fail("源码版种子项目未按包版本刷新已有资产");
  }
}

if (failures.length > 0) {
  console.error("[third-party-validate] failed");
  for (const item of [...new Set(failures)]) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`[third-party-validate] passed: ${packageRoot}`);
