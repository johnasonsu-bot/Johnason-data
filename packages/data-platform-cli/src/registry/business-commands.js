const { executeWithProfile, revalidateSession } = require("../runtime/cli-execution");
const { createFoundationCommands } = require("./foundation-commands");

const DATABASE_ENGINES = new Set(["mysql", "postgresql", "oracle", "dm"]);
const ANONYMOUS_CAPABILITIES = new Set(["platform.auth-login", "platform.health", "platform.database-capabilities", "platform.job"]);
const FACADE_ALIASES = Object.freeze([
  ["datasource test-connection", "dataLabSources.testConnection"],
  ["ingestion preview-source-data", "ingestionTasks.previewSource"],
  ["ingestion create-task", "ingestionTasks.create"],
  ["ingestion run-task-now", "ingestionTasks.run"],
  ["ingestion get-job-runs", "ingestionTasks.runs"],
  ["quality create-task", "qualityControl.createTask"],
  ["quality run-task-now", "qualityControl.runTaskNow"],
  ["quality list-task-runs", "qualityControl.listTaskRuns"],
  ["quality create-quality-report", "qualityControl.createQualityReport"],
  ["development query execute", "dataDevelopment.executeQuery"],
  ["standard create-data-element", "dataStandards.createDataElement"],
  ["quality save-dictionary", "qualityControl.saveDictionary"],
  ["data-map register-resources", "dataMap.registerResources"],
  ["source-research create-research-task-run", "dataSourceResearch.createResearchTaskRun"],
  ["data-lab save-business-system-template-logical-model", "dataModeling.saveBusinessSystemTemplateLogicalModel"],
  ["data-lab save-business-system-instance-physical-model", "dataModeling.saveBusinessSystemInstancePhysicalModel"],
  ["knowledge-base upload-knowledge-document", "systemKnowledgeBases.uploadKnowledgeDocument"],
  ["reporting create-report-dataset", "reporting.createReportDataset"],
  ["reporting create-report-dashboard", "reporting.createReportDashboard"],
  ["reporting preview-report-dataset", "reporting.previewReportDataset"],
  ["asset-search business-data-search", "assetSearch.businessDataSearch"],
]);

function executionTargetsFor(values) {
  const targets = [];
  for (const value of values || []) {
    const text = String(value).trim().toLowerCase();
    if (text === "local" || text === "web" || text === "cli") {
      targets.push({ kind: "local" });
      continue;
    }
    if (text === "api") {
      targets.push({ kind: "api", provider: "external-api" });
      continue;
    }
    if (text.startsWith("api:")) {
      const [, provider, role] = text.split(":", 3);
      targets.push({ kind: "api", provider: provider || "external-api", ...(role ? { role } : {}) });
      continue;
    }
    if (text === "managed-jdbc") {
      targets.push({ kind: "api", provider: "service-runtime" });
      continue;
    }
    const [engine, role] = text.split(":", 2);
    if (DATABASE_ENGINES.has(engine)) {
      targets.push({ kind: "database", engine, role: role || "platform-authority" });
      continue;
    }
    throw new TypeError(`Unsupported aggregate execution target: ${value}`);
  }
  const unique = new Map(targets.map((target) => [JSON.stringify(target), target]));
  const result = [...unique.values()];
  if (result.some((target) => target.kind === "local") && result.some((target) => target.kind !== "local")) {
    throw new TypeError("Local aggregate execution target cannot be mixed with external targets");
  }
  return result.length > 0 ? result : [{ kind: "local" }];
}

function actionFor(sourceApiKeys) {
  const method = String(sourceApiKeys?.[0] || "GET").split(/\s+/, 1)[0].toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? "write" : "read";
}

function registryCapabilityId(capabilityId) {
  return String(capabilityId).replace(/#/g, "-duplicate-");
}

function createBusinessCommands(dependencies = {}) {
  const list = dependencies.corePackage?.listCapabilityDefinitions;
  if (typeof list !== "function") return Object.freeze([]);
  const foundationDefinitions = createFoundationCommands(dependencies);
  const foundationIds = new Set(foundationDefinitions.map((definition) => definition.capabilityId));
  const foundationSourceApiKeys = new Set(foundationDefinitions.flatMap((definition) => definition.sourceApiKeys));
  const definitions = [];
  const byAggregateId = new Map();
  for (const capability of list()) {
    if (foundationIds.has(capability.capabilityId)) continue;
    const sourceApiKeys = Object.freeze([...(capability.sourceApiKeys || [])]);
    const sourceFrontendKeys = Object.freeze([...(capability.sourceFrontendKeys || [])].map((key) => (
      String(key).startsWith("/") ? String(key) : `/${String(key)}`
    )));
    if (sourceApiKeys.length === 0 || sourceApiKeys.every((sourceApiKey) => foundationSourceApiKeys.has(sourceApiKey))) continue;
    const capabilityId = capability.capabilityId;
    const cliCapabilityId = registryCapabilityId(capabilityId);
    definitions.push(Object.freeze({
      command: `capability ${cliCapabilityId}`,
      capabilityId: cliCapabilityId,
      modules: Object.freeze([capability.moduleName]),
      action: actionFor(sourceApiKeys),
      sourceApiKeys,
      sourceFrontendKeys,
      executionTargets: Object.freeze(executionTargetsFor(capability.executionTargets)),
      inputSchema: Object.freeze({ parse(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Capability input must be an object");
        return value;
      } }),
      outputSchema: Object.freeze({ parse(value) { return value; } }),
      inputMode: "json",
      handler: async (input = {}) => {
        const { profileName, ...payload } = input;
        return executeWithProfile(dependencies, async ({ core, profile, runtimePorts }) => {
          if (ANONYMOUS_CAPABILITIES.has(capabilityId)) return core.execute(capabilityId, payload, {});
          const session = await revalidateSession(dependencies, core, profile, runtimePorts);
          return core.execute(capabilityId, payload, { actor: session.user, token: session.token });
        }, { profileName });
      },
    }));
    byAggregateId.set(capabilityId, definitions.at(-1));
  }
  for (const [command, aggregateId] of FACADE_ALIASES) {
    const source = byAggregateId.get(aggregateId);
    if (!source) continue;
    definitions.push(Object.freeze({
      ...source,
      command,
      capabilityId: `facade.${command.replace(/[^A-Za-z0-9]+/g, "-")}`,
      sourceApiKeys: Object.freeze([]),
      sourceFrontendKeys: Object.freeze([]),
    }));
  }
  return Object.freeze(definitions);
}

module.exports = { createBusinessCommands, executionTargetsFor };
