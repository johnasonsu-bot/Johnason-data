#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { validateExecutionTargets } = require("../packages/data-platform-cli/src/registry/execution-targets");

const [, , inventoryPath, outputPath] = process.argv;

if (!inventoryPath || !outputPath) {
  console.error("Usage: node scripts/generate-cli-coverage-baseline.js <api-inventory.json> <output.json>");
  process.exit(2);
}

const inventoryBuffer = fs.readFileSync(path.resolve(inventoryPath));
const inventorySha256 = crypto.createHash("sha256").update(inventoryBuffer).digest("hex");
const approvedInventorySha256 = "6cd896d1e38fb54ebd8317842eb618c4a28ede4eecf5e09f5bfb16374d696d0f";
const inventory = JSON.parse(inventoryBuffer.toString("utf8"));

const API_GROUPS = {
  auth: "auth",
  projects: "project",
  platform: "platform",
  "asset-search": "asset-search",
  "data-map": "data-map",
  "data-standards": "standard",
  "data-sources": "datasource",
  "data-source-research": "source-research",
  "data-modeling-sources": "data-lab source",
  "ingestion-tasks": "ingestion",
  "file-imports": "file-import",
  "model-providers": "model-provider",
  "ingestion-ai-configs": "ingestion ai-config",
  "dev-ai-configs": "development ai-config",
  "reporting-ai-configs": "reporting ai-config",
  "system-management": "system",
  "system-knowledge-bases": "knowledge-base",
  "data-development": "development",
  "data-modeling": "data-lab",
  "quality-control": "quality",
  "data-services": "service",
  "service-runtime": "service invoke",
  reporting: "reporting",
  health: "system doctor",
  "platform-runtime": "platform",
};

const FRONTEND_GROUPS = {
  "asset-search": "asset-search",
  "data-development": "development",
  "data-file-imports": "file-import",
  "data-ingestion-ai": "ingestion ai-config",
  "data-ingestion-jobs": "ingestion",
  "data-ingestion-monitor": "ingestion monitor",
  "data-map": "data-map",
  "data-modeling": "data-lab",
  "data-source-research": "source-research",
  "data-sources": "datasource",
  "data-standards": "standard",
  overview: "platform",
  processing: "development processing",
  "processing-rules": "development processing-rule",
  "processing-schedule": "development scheduling",
  "quality-control": "quality",
  reporting: "reporting",
  "service-apps": "service app",
  "service-audit": "service audit",
  "service-authorizations": "service authorization",
  "service-data-sources": "service datasource",
  "service-models": "service ai-config",
  "service-ops": "service ops",
  "service-usage": "service usage",
  services: "service",
  system: "system",
  "system-database-drivers": "system database-driver",
  "system-knowledge-bases": "knowledge-base",
  "system-models": "model-provider",
  "system-projects": "project",
  "system-roles": "system role",
  "system-services": "system service",
  "system-users": "system user",
};

const PROJECT_SCOPED_MODULES = new Set([
  "projects",
  "asset-search",
  "data-map",
  "data-standards",
  "data-sources",
  "data-source-research",
  "data-modeling-sources",
  "ingestion-tasks",
  "file-imports",
  "data-development",
  "data-modeling",
  "quality-control",
  "data-services",
  "reporting",
]);

function kebabCase(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function fallbackCapability(route) {
  const pathPart = route.path
    .replace(/^\/api\/(v1\/)?/, "")
    .replace(/:([A-Za-z0-9_]+)/g, "by-$1")
    .replace(/\*/g, "wildcard");
  return `${route.method.toLowerCase()}-${kebabCase(pathPart)}`;
}

function commandFor(route) {
  if (route.path === "/api/health") return "system doctor health";
  if (route.path === "/api/v1/platform/database-capabilities") return "system doctor database-capabilities";
  if (route.path === "/api/v1/jobs/:id") return "job show";
  if (route.path === "/api/auth/login") return "auth login";
  if (route.path === "/api/auth/profile") return "auth profile";
  if (route.path === "/api/v1/reporting/runtime/dashboards/:id") return "reporting runtime dashboard show";
  const operation = kebabCase(route.controller) || fallbackCapability(route);
  return `${API_GROUPS[route.module]} ${operation}`;
}

function inputMode(interaction) {
  if (interaction === "multipart") return "--file/--files plus validated flags";
  if (interaction === "download") return "validated flags/path parameters";
  if (interaction === "stream") return "validated flags or --file JSON/YAML";
  if (interaction === "json-write") return "validated flags or --file JSON/YAML";
  return "validated flags/query options";
}

function outputMode(interaction) {
  if (interaction === "download") return "required --output file";
  if (interaction === "stream") return "human stream or NDJSON";
  return "human table/detail or JSON envelope";
}

function executionMode(route) {
  if (route.interaction === "stream") return "foreground-stream";
  if (route.interaction === "download") return "sync-file";
  if (route.module === "service-runtime") return "sync-runtime-invocation";
  if (/\/(run|start|sync|publish|generate|recommendations|ai-analysis|research)(\/|$)/.test(route.path)) {
    return "async-job-capable";
  }
  return "sync-command";
}

function actionFor(route) {
  if (["GET", "HEAD", "OPTIONS"].includes(route.method)) return "read";
  if (route.method === "DELETE") return "delete";
  if (/\/(run|start|execute|publish|activate)(\/|$)/.test(route.path)) return "execute";
  if (route.interaction === "multipart") return "upload";
  return "write";
}

function confirmationRequired(route) {
  return route.method === "DELETE" || /\/(run|start|publish|activate|reject|stop)(\/|$)/.test(route.path);
}

const EXTERNAL_API_ROUTE_KEYS = new Set([
  // research runs and comparisons call the configured model provider asynchronously.
  "POST /api/v1/data-source-research/tasks/:taskId/runs",
  "POST /api/v1/data-source-research/tasks/:taskId/compare",
  "POST /api/v1/data-source-research/source/:sourceId/runs",
]);

const CONDITIONAL_DATASOURCE_API_ROUTE_KEYS = new Set([
  // These routes call apiIngestionService only when the resolved datasource/task source is API-backed.
  "GET /api/v1/data-sources/:id/tables/:tableName/columns",
  "GET /api/v1/data-sources/:id/tables/:tableName/sample",
  "POST /api/v1/data-sources/test-connection",
  "POST /api/v1/ingestion-tasks/:id/run",
  "POST /api/v1/ingestion-tasks/preview-source",
]);

const CONNECTIVITY_API_ROUTE_KEY = "GET /api/v1/data-sources";

const EXTERNAL_API_CONTROLLERS = new Set([
  "analyzeDictionaryTable",
  "analyzeJobRunFailure",
  "analyzeRegexRule",
  "analyzeResourceContentProfile",
  "analyzeResourceFieldProfile",
  "analyzeResourceProfile",
  "analyzeScene",
  "generateAiBusinessDataBatch",
  "generateAiBusinessDataPlan",
  "planAiChartSql",
  "queryQualityOpsRobot",
  "recommendAiChart",
  "recommendServiceConfig",
  "recommendStrategy",
  "recommendTaskConfig",
  "reviseAiChartSql",
  "runAiBusinessDataTask",
  "runAiChartQuery",
  "runCopilotTask",
  "runCopilotTaskStream",
  "runQualityAiAnalysis",
  "startRecommendation",
  "suggestAiChartAnalysis",
  "suggestDataElements",
  "allocateAiChartFieldMap",
]);

const FOUR_DATABASE_ENGINES = Object.freeze(["mysql", "postgresql", "oracle", "dm"]);

const BUSINESS_DATASOURCE_ENGINES = new Map([
  // data-source.metadata + the managed adapter capability suite implement these operations for all four engines.
  ...["listTables", "listColumns", "sampleRows", "testConnection"].map((controller) => [
    `data-sources:${controller}`,
    FOUR_DATABASE_ENGINES,
  ]),
  ...["listTables", "listColumns", "sampleRows", "testConnection"].map((controller) => [
    `data-modeling-sources:${controller}`,
    FOUR_DATABASE_ENGINES,
  ]),
  // DataX/database adapters exercise source preview and ingestion runs against all four engines.
  ["ingestion-tasks:previewSourceData", FOUR_DATABASE_ENGINES],
  ["ingestion-tasks:runTaskNow", FOUR_DATABASE_ENGINES],
  // Research execution explicitly accepts MySQL/PostgreSQL (plus non-database source kinds outside this schema).
  ["data-source-research:createResearchTaskRun", Object.freeze(["mysql", "postgresql"])],
  ["data-source-research:createResearchRun", Object.freeze(["mysql", "postgresql"])],
  // Development uses the shared managed adapters/JDBC inference for metadata, queries, and executable plans.
  ...[
    "testDatasourceConfig",
    "testDatasource",
    "listDatasourceDatabases",
    "listDatasourceTables",
    "listDatasourceColumns",
    "listDatasourceFunctions",
    "executeQuery",
    "previewOrchestrationNode",
    "runOrchestration",
    "previewProcessingJobDraft",
    "previewProcessingJob",
    "runProcessingJob",
    "runWorkflow",
  ].map((controller) => [`data-development:${controller}`, FOUR_DATABASE_ENGINES]),
  // Quality source metadata/preview and synchronous runs dispatch through configured source adapters.
  ...[
    "listQualitySourceTables",
    "listQualitySourceColumns",
    "syncQualitySourceTables",
    "previewDictionarySourceRows",
    "runTaskNow",
  ].map((controller) => [`quality-control:${controller}`, FOUR_DATABASE_ENGINES]),
  // Service authoring currently validates MySQL/PostgreSQL sources; runtime invocation separately supports all four.
  ...[
    "testServiceDataSourceConnection",
    "listServiceDataSourceTables",
    "listServiceDataSourceColumns",
    "sampleServiceDataSourceRows",
    "previewServiceSql",
    "debugService",
  ].map((controller) => [`data-services:${controller}`, Object.freeze(["mysql", "postgresql"])]),
  ["service-runtime:handleInvoke", FOUR_DATABASE_ENGINES],
  // Reporting schemas and runtime query paths explicitly support all four database dialects.
  ["reporting:previewRuntimeDashboardChart", FOUR_DATABASE_ENGINES],
  ["reporting:runAiChartQuery", FOUR_DATABASE_ENGINES],
]);

function executionTargets(route) {
  if (route.path === "/api/health" || route.path === "/api/v1/platform/database-capabilities") {
    return [{ kind: "local" }];
  }

  const targets = [{ kind: "database", engine: "mysql", role: "platform-authority" }];
  const businessDatasourceEngines = BUSINESS_DATASOURCE_ENGINES.get(`${route.module}:${route.controller}`) || [];
  for (const engine of businessDatasourceEngines) {
    targets.push({ kind: "database", engine, role: "business-datasource" });
  }

  if (route.module === "service-runtime") {
    targets.push({ kind: "api", provider: "service-runtime" });
  }

  if (route.module === "model-providers" && route.path.endsWith("/test-connection")) {
    targets.push({ kind: "api", provider: "model-provider" });
  }

  const apiKey = `${route.method} ${route.path}`;
  if (apiKey === CONNECTIVITY_API_ROUTE_KEY) {
    for (const engine of FOUR_DATABASE_ENGINES) {
      targets.push({
        kind: "database",
        engine,
        role: "connectivity-check",
      });
    }
    targets.push({
      kind: "api",
      provider: "external-api",
      role: "connectivity-check",
    });
  } else if (CONDITIONAL_DATASOURCE_API_ROUTE_KEYS.has(apiKey)) {
    targets.push({
      kind: "api",
      provider: "external-api",
      role: "conditional-datasource",
    });
  } else if (EXTERNAL_API_ROUTE_KEYS.has(apiKey) || EXTERNAL_API_CONTROLLERS.has(route.controller)) {
    targets.push({
      kind: "api",
      provider: "external-api",
    });
  }

  return validateExecutionTargets(targets.filter((target, index, values) => (
    values.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(target)) === index
  )));
}

const apiCoverageRaw = inventory.routes.map((route, index) => ({
  apiKey: `${route.method} ${route.path}`,
  ordinal: index + 1,
  module: route.module,
  moduleLabel: route.moduleLabel || null,
  controller: route.controller || null,
  cliCommand: commandFor(route),
  action: actionFor(route),
  interaction: route.interaction,
  inputMode: inputMode(route.interaction),
  outputMode: outputMode(route.interaction),
  executionMode: executionMode(route),
  executionTargets: executionTargets(route),
  authRequired: route.authRequired,
  projectScoped: PROJECT_SCOPED_MODULES.has(route.module),
  featureGuard: route.featureGuard,
  validationSchemas: route.validation || [],
  confirmationRequired: confirmationRequired(route),
  sourceFile: route.sourceFile,
  coverageStatus: "designed",
}));

const commandAliases = apiCoverageRaw.reduce((aliases, entry) => {
  const keys = aliases.get(entry.cliCommand) || [];
  keys.push(entry.apiKey);
  aliases.set(entry.cliCommand, keys);
  return aliases;
}, new Map());

const apiCoverage = apiCoverageRaw.map((entry) => ({
  ...entry,
  sharedCommandAlias: commandAliases.get(entry.cliCommand).length > 1,
  aliasApiKeys: commandAliases.get(entry.cliCommand),
}));

const frontendCoverage = inventory.frontendPaths.map((entry, index) => ({
  frontendKey: entry.path,
  ordinal: index + 1,
  frontendModule: entry.module,
  cliSurface: FRONTEND_GROUPS[entry.module],
  sourceFile: entry.sourceFile,
  coverageRule: "all user-visible actions and states on this entry must map to registered CLI capabilities",
  coverageStatus: "designed",
}));

const missingApiGroups = apiCoverage.filter((entry) => !entry.cliCommand || entry.cliCommand.startsWith("undefined "));
const missingFrontendGroups = frontendCoverage.filter((entry) => !entry.cliSurface);
const apiKeyCounts = apiCoverage.reduce((counts, entry) => {
  counts.set(entry.apiKey, (counts.get(entry.apiKey) || 0) + 1);
  return counts;
}, new Map());
const duplicateApiKeys = Array.from(apiKeyCounts.entries()).filter(([, count]) => count > 1);
const staleSourceFingerprint = inventorySha256 === approvedInventorySha256 ? 0 : 1;
const unclassifiedBusinessCommands = apiCoverage.filter((entry) => (
  !entry.executionTargets.some((target) => ["api", "database", "local"].includes(target.kind))
));

if (
  missingApiGroups.length ||
  missingFrontendGroups.length ||
  duplicateApiKeys.length ||
  unclassifiedBusinessCommands.length ||
  staleSourceFingerprint ||
  apiCoverage.length !== inventory.summary.routeCount ||
  frontendCoverage.length !== inventory.summary.frontendPathCount
) {
  console.error(JSON.stringify({
    missingApiGroups,
    missingFrontendGroups,
    duplicateApiKeys,
    unclassifiedBusinessCommandEntries: unclassifiedBusinessCommands,
    staleSourceFingerprint,
    unclassifiedBusinessCommands: unclassifiedBusinessCommands.length,
    apiClassified: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "api")).length,
    databaseClassified: {
      mysql: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "mysql")).length,
      postgresql: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "postgresql")).length,
      oracle: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "oracle")).length,
      dm: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "dm")).length,
    },
  }, null, 2));
  process.exit(1);
}

const result = {
  schemaVersion: 1,
  purpose: "Design-time traceability baseline from Data Platform UI/API inventory to CLI capability surfaces.",
  source: {
    generatedAt: inventory.generatedAt,
    branch: inventory.branch,
    commit: inventory.commit,
    summary: inventory.summary,
    inventorySha256,
    approvedInventorySha256,
    inventoryFile: "api-inventory.json",
    companionFiles: ["PROJECT_OPERATION_MANUAL.md", "project-operation-knowledge-graph.html"],
  },
  gates: {
    apiExpected: inventory.summary.routeCount,
    apiMapped: apiCoverage.length,
    frontendExpected: inventory.summary.frontendPathCount,
    frontendMapped: frontendCoverage.length,
    unmappedApi: missingApiGroups.length,
    unmappedFrontend: missingFrontendGroups.length,
    duplicateApiKeys: duplicateApiKeys.length,
    unknownCliGroups: missingApiGroups.length + missingFrontendGroups.length,
    staleSourceFingerprint,
    unclassifiedBusinessCommands: unclassifiedBusinessCommands.length,
    apiClassified: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "api")).length,
    databaseClassified: {
      mysql: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "mysql")).length,
      postgresql: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "postgresql")).length,
      oracle: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "oracle")).length,
      dm: apiCoverage.filter((entry) => entry.executionTargets.some((target) => target.kind === "database" && target.engine === "dm")).length,
    },
  },
  statusSemantics: {
    designed: "A CLI capability surface and I/O strategy are assigned; implementation is not yet claimed.",
    implemented: "The command registry and application-service adapter exist.",
    verified: "Contract and subprocess tests pass against the inventory baseline.",
    notApplicable: "Allowed only with a written reason and explicit review approval.",
  },
  apiCoverage,
  frontendCoverage,
};

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.gates));
