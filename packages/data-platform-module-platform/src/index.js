"use strict";

const {
  getDatabaseRuntime: kernelGetDatabaseRuntime,
  validateModuleManifest,
} = require("@johnason/data-platform-core-kernel");
const {
  SOURCE_API_KEYS,
  SOURCE_FRONTEND_KEYS,
  CAPABILITY_DEFINITIONS,
} = require("../contracts");

const CAPABILITY_SCHEMA_VERSION = "1.0.0";

const validatedModuleManifest = validateModuleManifest({
  moduleName: "platform",
  moduleVersion: "0.2.0",
  capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
  capabilities: CAPABILITY_DEFINITIONS.map(({ inputSchema, outputSchema, permission, mutation, port, executionTargets, ...definition }) => ({
    ...definition,
    executionTargets: executionTargets.map((target) => target.kind === "database" ? "mysql:platform-authority" : target.kind),
  })),
});

// Keep the transport-neutral kernel manifest as the source of validation while
// retaining the richer source/adapter metadata used by Web and CLI catalogs.
const moduleManifest = Object.freeze({
  ...validatedModuleManifest,
  moduleId: "platform",
  sourceApiKeys: SOURCE_API_KEYS,
  sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  dependencies: Object.freeze({ "@johnason/data-platform-core-kernel": "0.1.0" }),
  // The exported manifest stays kernel-compatible (string execution target
  // identifiers); createCapabilities exposes richer target descriptors.
  capabilities: validatedModuleManifest.capabilities,
});

function resolvePort(dependencies, port) {
  const ports = dependencies?.ports || dependencies?.platform || dependencies;
  if (ports && typeof ports[port] === "function") return ports[port].bind(ports);
  return async () => {
    const error = new Error(`Platform capability port is not configured: ${port}`);
    error.code = "CAPABILITY_PORT_NOT_CONFIGURED";
    throw error;
  };
}

function createRuntimeAdapters(dependencies = {}) {
  const getDatabaseRuntime = () => dependencies.databaseRuntime || kernelGetDatabaseRuntime();
  const databaseRuntime = dependencies.databaseRuntime || null;
  const query = typeof dependencies.query === "function"
    ? dependencies.query
    : async (...args) => getDatabaseRuntime().pool.query(...args);
  const port = (name) => resolvePort(dependencies, name);
  return Object.freeze({
    databaseRuntime,
    getDatabaseRuntime,
    query,
    health: port("health"),
    databaseCapabilities: port("databaseCapabilities"),
    jobShow: port("jobShow"),
    authLogin: port("authLogin"),
    authProfile: port("authProfile"),
    reportingRuntimeDashboard: port("reportingRuntimeDashboard"),
  });
}

async function countProjectTable(adapters, tableName, executionContext = {}) {
  const projectId = executionContext.projectId || executionContext.project?.id || null;
  const where = projectId ? " WHERE project_id = ?" : "";
  const params = projectId ? [projectId] : [];
  const [rows] = await adapters.query(`SELECT COUNT(*) AS total FROM ${tableName}${where}`, params);
  return Number(rows?.[0]?.total || 0);
}

async function defaultOverview(adapters, _input, executionContext) {
  const [dataSourceCount, ingestionCount, qualityRuleCount, processingCount, modelTemplateCount, modelInstanceCount, serviceCount] = await Promise.all([
    countProjectTable(adapters, "data_sources", executionContext),
    countProjectTable(adapters, "ingestion_tasks", executionContext),
    countProjectTable(adapters, "qc_strategy", executionContext),
    countProjectTable(adapters, "dev_processing_jobs", executionContext),
    countProjectTable(adapters, "lab_business_system_template", executionContext),
    countProjectTable(adapters, "lab_business_system_instance", executionContext),
    countProjectTable(adapters, "service_apis", executionContext),
  ]);
  const metrics = {
    dataSourceCount,
    ingestionJobCount: ingestionCount,
    qualityRuleCount,
    processingJobCount: processingCount,
    dataModelCount: Number(modelTemplateCount || 0) + Number(modelInstanceCount || 0),
    serviceApiCount: serviceCount,
  };
  return {
    modules: [
      { key: "data-ingestion", name: "数据接入", description: "统一管理数据库、文件、接口、消息等多源异构数据接入链路。", capabilities: ["数据源登记", "接入任务配置", "全量/增量同步", "运行监控"], total: metrics.ingestionJobCount },
      { key: "quality-control", name: "质量管控", description: "围绕质量规则、检测策略、执行任务和问题分析建立数据质量闭环。", capabilities: ["规则管理", "策略配置", "质量检测", "问题追踪"], total: metrics.qualityRuleCount },
      { key: "data-processing", name: "数据处理", description: "提供数据清洗、转换、标准化和调度编排的数据加工能力。", capabilities: ["SQL分析", "SQL任务", "ETL 编排", "清洗标准化", "调度管理"], total: metrics.processingJobCount },
      { key: "data-modeling", name: "数据建模", description: "沉淀行业场景、逻辑模型、物理模型和样本方案等结构化数据资产。", capabilities: ["场景模板", "逻辑模型", "物理模型", "样本方案"], total: metrics.dataModelCount },
      { key: "data-service", name: "数据服务", description: "通过 API、数据集和服务目录向上层应用提供统一的数据消费出口。", capabilities: ["服务编目", "统一鉴权", "发布审批", "访问统计"], total: metrics.serviceApiCount },
    ],
    stats: [
      { key: "dataSourceCount", label: "数据源", value: metrics.dataSourceCount },
      { key: "ingestionJobCount", label: "接入任务", value: metrics.ingestionJobCount },
      { key: "qualityRuleCount", label: "质量规则", value: metrics.qualityRuleCount },
      { key: "processingJobCount", label: "处理任务", value: metrics.processingJobCount },
      { key: "dataModelCount", label: "建模资产", value: metrics.dataModelCount },
      { key: "serviceApiCount", label: "数据服务", value: metrics.serviceApiCount },
    ],
  };
}

function createCapabilities(dependencies = {}) {
  const adapters = createRuntimeAdapters(dependencies);
  return Object.freeze(CAPABILITY_DEFINITIONS.map(({ inputSchema, outputSchema, permission, mutation, port, ...definition }) => Object.freeze({
    ...definition,
    id: definition.capabilityId,
    schema: inputSchema,
    inputSchema,
    outputSchema,
    permission,
    mutation,
    executionTargetDetails: definition.executionTargets.some((target) => target.kind === "database")
      ? Object.freeze([{ kind: "database", engine: "mysql", role: "platform-authority" }])
      : Object.freeze([]),
    execute: async (input = {}, executionContext = {}) => {
      if (port === "overview" && typeof dependencies.overview !== "function") return defaultOverview(adapters, input, executionContext);
      return resolvePort(dependencies, port)(input, executionContext);
    },
  })));
}

module.exports = {
  SOURCE_API_KEYS,
  SOURCE_FRONTEND_KEYS,
  moduleManifest,
  createCapabilities,
  createRuntimeAdapters,
};
