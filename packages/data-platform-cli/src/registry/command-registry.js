const { z } = require("zod");

const nonEmptyString = z.string().trim().min(1);
const sourceApiKey = z.string().regex(/^[A-Z]+ \/\S*$/, "sourceApiKeys must contain METHOD /path values");
const sourceFrontendKey = z.string().regex(/^\/\S*$/, "sourceFrontendKeys must contain /path values");
const parserSchema = z.custom((value) => value && typeof value.parse === "function", "schema must expose parse()");
const functionSchema = z.custom((value) => typeof value === "function", "handler must be a function");

const definitionSchema = z.object({
  command: nonEmptyString,
  capabilityId: z.string().regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/, "capabilityId is invalid"),
  modules: z.array(nonEmptyString),
  action: nonEmptyString,
  sourceApiKeys: z.array(sourceApiKey).min(1),
  sourceFrontendKeys: z.array(sourceFrontendKey),
  executionTargets: z.array(z.record(z.unknown())),
  inputSchema: parserSchema,
  outputSchema: parserSchema,
  handler: functionSchema,
  sharedCommandAlias: z.boolean().optional(),
  aliasApiKeys: z.array(sourceApiKey).optional(),
}).strict();

function uniqueStrings(values, label) {
  if (new Set(values).size !== values.length) throw new TypeError(`${label} must contain unique values`);
  return Object.freeze([...values]);
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function validateAliasRules(definition) {
  const shared = definition.sharedCommandAlias === true;
  if (!shared && definition.aliasApiKeys !== undefined) {
    throw new TypeError("aliasApiKeys require sharedCommandAlias");
  }
  if (definition.sourceApiKeys.length > 1 && !shared) {
    throw new TypeError("Multiple sourceApiKeys require sharedCommandAlias");
  }
  if (shared) {
    if (!definition.aliasApiKeys) throw new TypeError("sharedCommandAlias requires aliasApiKeys");
    const aliases = new Set(definition.aliasApiKeys);
    if (definition.sourceApiKeys.some((key) => !aliases.has(key))) {
      throw new TypeError("aliasApiKeys must contain every sourceApiKey");
    }
    if (definition.aliasApiKeys.some((key) => !definition.sourceApiKeys.includes(key))) {
      throw new TypeError("aliasApiKeys must exactly match sourceApiKeys");
    }
  }
}

function validateCommandDefinition(candidate) {
  const definition = definitionSchema.parse(candidate);
  validateAliasRules(definition);
  return Object.freeze({
    ...definition,
    modules: uniqueStrings(definition.modules, "modules"),
    sourceApiKeys: uniqueStrings(definition.sourceApiKeys, "sourceApiKeys"),
    sourceFrontendKeys: uniqueStrings(definition.sourceFrontendKeys, "sourceFrontendKeys"),
    executionTargets: deepFreeze([...definition.executionTargets]),
    ...(definition.aliasApiKeys === undefined
      ? {}
      : { aliasApiKeys: uniqueStrings(definition.aliasApiKeys, "aliasApiKeys") }),
  });
}

function createCommandRegistry() {
  const byCapability = new Map();
  const byCommand = new Map();
  const bySourceApi = new Map();
  const bySourceFrontend = new Map();

  function register(candidate) {
    const definition = validateCommandDefinition(candidate);
    const duplicates = [
      [byCapability, definition.capabilityId, "capabilityId"],
      [byCommand, definition.command, "command"],
      ...definition.sourceApiKeys.map((key) => [bySourceApi, key, "sourceApiKey"]),
    ];
    for (const [index, key, label] of duplicates) {
      if (index.has(key)) throw new TypeError(`Duplicate ${label}: ${key}`);
    }

    byCapability.set(definition.capabilityId, definition);
    byCommand.set(definition.command, definition);
    for (const key of definition.sourceApiKeys) bySourceApi.set(key, definition);
    for (const key of definition.sourceFrontendKeys) {
      const definitions = bySourceFrontend.get(key) || [];
      definitions.push(definition);
      bySourceFrontend.set(key, definitions);
    }
    return definition;
  }

  return Object.freeze({
    register,
    get(capabilityId) { return byCapability.get(capabilityId) || null; },
    getByCommand(command) { return byCommand.get(command) || null; },
    getBySourceApiKey(key) { return bySourceApi.get(key) || null; },
    getBySourceFrontendKey(key) { return Object.freeze([...(bySourceFrontend.get(key) || [])]); },
    values() { return Object.freeze([...byCapability.values()]); },
  });
}

const defaultRegistry = createCommandRegistry();
function registerCommand(definition) {
  return defaultRegistry.register(definition);
}

module.exports = {
  commandRegistry: defaultRegistry,
  createCommandRegistry,
  registerCommand,
  validateCommandDefinition,
};
