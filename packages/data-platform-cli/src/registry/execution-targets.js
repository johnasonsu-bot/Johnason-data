const { z } = require("zod");

const API_PROVIDERS = new Set(["external-api", "model-provider", "service-runtime"]);
const DATABASE_ENGINES = new Set(["mysql", "postgresql", "oracle", "dm"]);
const role = z.string().trim().min(1).optional();
const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("api"), provider: z.string().trim().min(1), role }).strict(),
  z.object({ kind: z.literal("database"), engine: z.string().trim().min(1), role }).strict(),
  z.object({ kind: z.literal("local") }).strict(),
]);

function targetError(error) {
  const message = Array.isArray(error?.issues)
    ? error.issues.map((issue) => issue.message).join("; ")
    : String(error?.message || error);
  return new TypeError(`Invalid executionTargets: ${message}`);
}

function validateExecutionTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new TypeError("executionTargets must contain at least one target");
  }

  const normalized = [];
  const seen = new Set();
  for (const candidate of targets) {
    if (candidate?.kind === "api" && !API_PROVIDERS.has(candidate.provider)) {
      throw new TypeError(`unsupported API provider: ${String(candidate.provider)}`);
    }
    if (candidate?.kind === "database" && !DATABASE_ENGINES.has(candidate.engine)) {
      throw new TypeError(`unsupported database engine: ${String(candidate.engine)}`);
    }

    let parsed;
    try {
      parsed = targetSchema.parse(candidate);
    } catch (error) {
      throw targetError(error);
    }
    const key = JSON.stringify(parsed);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(Object.freeze({ ...parsed }));
  }

  if (normalized.some((target) => target.kind === "local") && normalized.some((target) => target.kind !== "local")) {
    throw new TypeError("local executionTargets cannot be mixed with API or database targets");
  }
  return Object.freeze(normalized);
}

const rootEngineKeys = ["datasourceEngine", "databaseEngine", "datasourceType", "databaseType", "sourceType"];
const configEngineKeys = [...rootEngineKeys, "engine", "dialect", "type"];
const configKeys = new Set([
  "datasource",
  "dataSource",
  "datasourceConfig",
  "dataSourceConfig",
  "source",
  "target",
  "reader",
  "writer",
  "sink",
  "sourceConfig",
  "targetConfig",
  "connectionConfig",
]);
const resultCollectionKeys = new Set(["data", "rows", "items", "sources", "dataSources"]);
const databaseAliases = new Map([
  ["mysql", "mysql"],
  ["pg", "postgresql"],
  ["postgres", "postgresql"],
  ["postgresql", "postgresql"],
  ["gaussdb", "postgresql"],
  ["oracle", "oracle"],
  ["dm", "dm"],
  ["dameng", "dm"],
]);
const knownNonDatabaseKinds = new Set(["api", "ftp", "sftp", "kafka", "hive", "clickhouse", "other"]);
const structuralTypes = new Set(["source", "target", "reader", "writer", "operator", "output"]);

function collectRuntimeDatasourceTargets(input, result) {
  const databaseEngines = [];
  const nonDatabaseKinds = new Set();
  const seen = new WeakSet();

  function jdbcUrlFrom(value) {
    if (!value || typeof value !== "object") return null;
    for (const key of ["jdbcUrl", "connectionString"]) {
      if (typeof value[key] === "string" && value[key].trim()) return value[key];
    }
    for (const key of configKeys) {
      const nested = value[key];
      if (!nested || typeof nested !== "object") continue;
      for (const urlKey of ["jdbcUrl", "connectionString"]) {
        if (typeof nested[urlKey] === "string" && nested[urlKey].trim()) return nested[urlKey];
      }
    }
    return null;
  }

  function addJdbcUrl(value, required = false) {
    const text = String(value || "").trim();
    const match = /^jdbc:([^:]+):/i.exec(text);
    if (!match) {
      if (required) throw new TypeError("JDBC datasource requires a JDBC URL");
      return;
    }
    const engine = databaseAliases.get(match[1].toLowerCase());
    if (!engine || !DATABASE_ENGINES.has(engine)) {
      throw new TypeError(`unsupported JDBC vendor: ${match[1].toLowerCase()}`);
    }
    databaseEngines.push(engine);
  }

  function add(value, key, container) {
    if (value === undefined || value === null || value === "") return;
    const configuredType = String(value).trim().toLowerCase();
    if (configuredType === "jdbc") {
      addJdbcUrl(jdbcUrlFrom(container), true);
      return;
    }
    const engine = databaseAliases.get(configuredType);
    if (engine) {
      databaseEngines.push(engine);
      return;
    }
    if (knownNonDatabaseKinds.has(configuredType)) {
      nonDatabaseKinds.add(configuredType);
      return;
    }
    // Generic `type` is also used for orchestration nodes. Those exact structural
    // values are not engines; every other configured datasource type is checked.
    if (key === "type" && structuralTypes.has(configuredType)) return;
    throw new TypeError(`unsupported database engine: ${configuredType}`);
  }

  function visitConfig(value) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visitConfig(item);
      return;
    }
    for (const key of configEngineKeys) {
      if (Object.hasOwn(value, key)) add(value[key], key, value);
    }
    for (const key of ["jdbcUrl", "connectionString"]) {
      if (Object.hasOwn(value, key)) addJdbcUrl(value[key]);
    }
    for (const [key, nested] of Object.entries(value)) {
      if (configKeys.has(key) || resultCollectionKeys.has(key)) visitConfig(nested);
    }
  }

  function visitRoot(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visitRoot(item);
      return;
    }
    for (const key of rootEngineKeys) {
      if (Object.hasOwn(value, key)) add(value[key], key, value);
    }
    for (const [key, nested] of Object.entries(value)) {
      if (configKeys.has(key)) visitConfig(nested);
      else if (resultCollectionKeys.has(key)) visitRoot(nested);
    }
  }

  visitRoot(input);
  visitRoot(result);
  return Object.freeze({
    databaseEngines: Object.freeze([...new Set(databaseEngines)]),
    nonDatabaseKinds: Object.freeze([...nonDatabaseKinds]),
  });
}

function collectConnectivityTargets(input, result) {
  if (input?.includeConnectivity !== true) {
    return Object.freeze({ databaseEngines: Object.freeze([]), nonDatabaseKinds: Object.freeze([]) });
  }
  const rows = Array.isArray(result)
    ? result
    : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.rows)
        ? result.rows
        : [];
  const checkedRows = rows.filter((row) => (
    row?.status === "active"
    && ["online", "offline"].includes(row?.connectionStatus)
    && typeof row?.lastCheckedAt === "string"
    && row.lastCheckedAt.length > 0
  ));
  return collectRuntimeDatasourceTargets({}, checkedRows);
}

function resolveRuntimeTargets(definition, input = {}, result = {}) {
  const declared = validateExecutionTargets(definition?.executionTargets);
  const datasourceCandidates = declared.filter((target) => (
    target.kind === "database" && target.role === "business-datasource"
  ));
  const conditionalApiTargets = declared.filter((target) => (
    target.kind === "api" && ["conditional-datasource", "connectivity-check"].includes(target.role)
  ));
  const connectivityCandidates = declared.filter((target) => target.role === "connectivity-check");
  if (connectivityCandidates.length > 0) {
    const observed = collectConnectivityTargets(input, result);
    const declaredConnectivityEngines = new Set(connectivityCandidates
      .filter((target) => target.kind === "database")
      .map((target) => target.engine));
    for (const engine of observed.databaseEngines) {
      if (!declaredConnectivityEngines.has(engine)) {
        throw new TypeError(`Runtime datasource engine is not declared: ${engine}`);
      }
    }
    const apiObserved = observed.nonDatabaseKinds.includes("api");
    return validateExecutionTargets(declared.filter((target) => {
      if (target.role !== "connectivity-check") return true;
      if (target.kind === "database") return observed.databaseEngines.includes(target.engine);
      if (target.kind === "api") return apiObserved;
      return false;
    }));
  }
  const candidateEngines = new Set(datasourceCandidates.map((target) => target.engine));
  if (datasourceCandidates.length === 0 && conditionalApiTargets.length === 0) return declared;

  const runtimeTargets = collectRuntimeDatasourceTargets(input, result);
  if (
    datasourceCandidates.length > 0
    && runtimeTargets.databaseEngines.length === 0
    && runtimeTargets.nonDatabaseKinds.length === 0
    && candidateEngines.size > 1
  ) {
    throw new TypeError("Dynamic datasource engine is required at runtime");
  }
  for (const engine of runtimeTargets.databaseEngines) {
    if (datasourceCandidates.length > 0 && !candidateEngines.has(engine)) {
      throw new TypeError(`Runtime datasource engine is not declared: ${engine}`);
    }
  }

  const apiDatasourceObserved = runtimeTargets.nonDatabaseKinds.includes("api");
  const resolved = [];
  let emittedDatasourceDatabases = false;
  for (const target of declared) {
    if (target.kind === "database" && target.role === "business-datasource") {
      if (emittedDatasourceDatabases) continue;
      emittedDatasourceDatabases = true;
      const engines = runtimeTargets.databaseEngines.length > 0
        ? runtimeTargets.databaseEngines
        : runtimeTargets.nonDatabaseKinds.length > 0
          ? []
          : [target.engine];
      for (const engine of engines) resolved.push({ ...target, engine });
      continue;
    }
    if (target.kind === "api" && target.role === "conditional-datasource") {
      if (apiDatasourceObserved) resolved.push(target);
      continue;
    }
    if (target.kind === "api" && target.role === "connectivity-check") {
      if (input?.includeConnectivity === true && apiDatasourceObserved) resolved.push(target);
      continue;
    }
    resolved.push(target);
  }
  return validateExecutionTargets(resolved);
}

module.exports = {
  resolveRuntimeTargets,
  validateExecutionTargets,
};
