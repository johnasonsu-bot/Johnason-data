const DATABASE_ENGINES = new Set(["mysql", "postgresql", "oracle", "dm"]);
const API_PROVIDERS = new Set(["external-api", "model-provider", "service-runtime"]);

function assertKeys(target, allowed) {
  for (const key of Object.keys(target)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown key in execution target: ${key}`);
  }
}

function validateExecutionTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new TypeError("executionTargets must contain at least one target");
  }
  const normalized = targets.map((target) => {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new TypeError("execution target must be an object");
    }
    if (target.kind === "local") {
      assertKeys(target, new Set(["kind"]));
      return { kind: "local" };
    }
    if (target.kind === "api") {
      assertKeys(target, new Set(["kind", "provider"]));
      if (!API_PROVIDERS.has(target.provider)) throw new TypeError(`Unsupported API provider: ${target.provider}`);
      return { kind: "api", provider: target.provider };
    }
    if (target.kind === "database") {
      assertKeys(target, new Set(["kind", "engine", "role"]));
      if (!DATABASE_ENGINES.has(target.engine)) throw new TypeError(`Unsupported database engine: ${target.engine}`);
      return { kind: "database", engine: target.engine, ...(target.role ? { role: target.role } : {}) };
    }
    throw new TypeError(`Unsupported execution target kind: ${target.kind}`);
  });
  return normalized.filter((target, index, values) => (
    values.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(target)) === index
  ));
}

function resolveRuntimeTargets(definition, input, result) {
  const targets = validateExecutionTargets(definition.executionTargets);
  const engine = result?.datasourceEngine || input?.datasourceEngine || input?.engine;
  if (!engine) return targets;
  if (!DATABASE_ENGINES.has(engine)) throw new TypeError(`Unsupported database engine: ${engine}`);
  return targets.filter((target) => (
    target.kind !== "database" || target.role !== "business-datasource" || target.engine === engine
  ));
}

module.exports = { validateExecutionTargets, resolveRuntimeTargets, DATABASE_ENGINES, API_PROVIDERS };
