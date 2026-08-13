const kernel = require("@johnason/data-platform-core-kernel");
const authModule = require("@johnason/data-platform-module-auth");
const assetSearchModule = require("@johnason/data-platform-module-asset-search");
const dataSourcesModule = require("@johnason/data-platform-module-data-sources");
const dataSourceResearchModule = require("@johnason/data-platform-module-data-source-research");
const dataLabSourcesModule = require("@johnason/data-platform-module-data-lab-sources");
const ingestionAiConfigsModule = require("@johnason/data-platform-module-ingestion-ai-configs");
const ingestionTasksModule = require("@johnason/data-platform-module-ingestion-tasks");
const platformModule = require("@johnason/data-platform-module-platform");
const projectModule = require("@johnason/data-platform-module-project-spaces");
const kernelPackage = require("@johnason/data-platform-core-kernel/package.json");
const packageManifest = require("../package.json");
const rawAggregateManifest = require("./module-manifest.json");
const { createCapabilityCatalog } = require("./catalog");

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const aggregateManifest = deepFreeze(rawAggregateManifest);

const moduleExports = Object.freeze({
  "@johnason/data-platform-module-auth": authModule,
  "@johnason/data-platform-module-asset-search": assetSearchModule,
  "@johnason/data-platform-module-data-sources": dataSourcesModule,
  "@johnason/data-platform-module-data-source-research": dataSourceResearchModule,
  "@johnason/data-platform-module-data-lab-sources": dataLabSourcesModule,
  "@johnason/data-platform-module-ingestion-ai-configs": ingestionAiConfigsModule,
  "@johnason/data-platform-module-ingestion-tasks": ingestionTasksModule,
  "@johnason/data-platform-module-platform": platformModule,
  "@johnason/data-platform-module-project-spaces": projectModule,
});

const identitySchema = Object.freeze({ parse(value) { return value; } });
const objectInputSchema = Object.freeze({
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Capability input must be an object");
    return value;
  },
});

function exactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError(`${label} is invalid`);
  return id;
}

function exactObjectInputSchema(label, allowedKeys, normalize = (value) => value) {
  return Object.freeze({
    parse(value, context) {
      return normalize(exactKeys(value, allowedKeys, `${label} input`), context);
    },
  });
}

function validOptionalString(value, label, { nullable = false } = {}) {
  if (value === null && nullable) return value;
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} is invalid`);
  return value;
}

function authUserOutput(value, label) {
  const user = exactKeys(value, [
    "id", "sub", "username", "displayName", "roleId", "roleCode", "roleType", "roleName", "defaultProjectId", "permissions",
  ], label);
  const id = positiveId(user.id, label);
  const sub = positiveId(user.sub, label);
  if (id !== sub) throw new TypeError(`${label} is invalid`);
  const permissions = exactKeys(user.permissions, ["modules", "mode", "actions"], `${label} permissions`);
  if (!Array.isArray(permissions.modules) || permissions.modules.some((moduleName) => typeof moduleName !== "string" || moduleName.length === 0)
    || (permissions.mode !== undefined && permissions.mode !== "readonly")
    || (permissions.actions !== undefined && (!Array.isArray(permissions.actions)
      || permissions.actions.some((action) => typeof action !== "string" || action.length === 0)))) {
    throw new TypeError(`${label} permissions is invalid`);
  }
  const roleId = user.roleId === null ? null : positiveId(user.roleId, label);
  const defaultProjectId = user.defaultProjectId === null ? null : positiveId(user.defaultProjectId, label);
  return Object.freeze({
    id,
    sub,
    username: validOptionalString(user.username, label),
    displayName: validOptionalString(user.displayName, label),
    roleId,
    roleCode: validOptionalString(user.roleCode, label),
    roleType: validOptionalString(user.roleType, label, { nullable: true }),
    roleName: validOptionalString(user.roleName, label),
    defaultProjectId,
    permissions: Object.freeze({
      modules: Object.freeze([...permissions.modules]),
      ...(permissions.mode === undefined ? {} : { mode: permissions.mode }),
      ...(permissions.actions === undefined ? {} : { actions: Object.freeze([...permissions.actions]) }),
    }),
  });
}

const authLoginInputSchema = Object.freeze({
  parse(value) {
    const input = exactKeys(value, ["username", "password"], "Auth login input");
    if (typeof input.username !== "string" || input.username.length === 0
      || typeof input.password !== "string" || input.password.length === 0) {
      throw new TypeError("Auth login input is invalid");
    }
    return Object.freeze({ username: input.username, password: input.password });
  },
});

const authProfileInputSchema = Object.freeze({
  parse(value) {
    const input = exactKeys(value, ["userId", "token"], "Auth profile input");
    const userId = Number(input.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0
      || (input.token !== undefined && (typeof input.token !== "string" || input.token.length === 0))) {
      throw new TypeError("Auth profile input is invalid");
    }
    return Object.freeze({ userId, ...(input.token === undefined ? {} : { token: input.token }) });
  },
});

const authLogoutInputSchema = exactObjectInputSchema("Auth logout", ["sessionId", "token", "userId", "user"], (input) => {
  if (input.sessionId !== undefined && (typeof input.sessionId !== "string" || input.sessionId.length === 0)) {
    throw new TypeError("Auth logout input is invalid");
  }
  if (input.token !== undefined && typeof input.token !== "string") throw new TypeError("Auth logout input is invalid");
  const userId = input.userId === undefined ? undefined : positiveId(input.userId, "Auth logout input");
  let user;
  if (input.user !== undefined) {
    const nested = exactKeys(input.user, ["sub"], "Auth logout input user");
    user = Object.freeze({ sub: positiveId(nested.sub, "Auth logout input user") });
  }
  return Object.freeze({
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    ...(input.token === undefined ? {} : { token: input.token }),
    ...(userId === undefined ? {} : { userId }),
    ...(user === undefined ? {} : { user }),
  });
});

const authLoginOutputSchema = Object.freeze({
  parse(value) {
    const output = exactKeys(value, ["token", "user"], "Auth login output");
    return Object.freeze({
      token: validOptionalString(output.token, "Auth login output token"),
      user: authUserOutput(output.user, "Auth login output user"),
    });
  },
});

const authProfileOutputSchema = Object.freeze({
  parse(value) {
    const output = exactKeys(value, ["user"], "Auth profile output");
    return Object.freeze({ user: authUserOutput(output.user, "Auth profile output user") });
  },
});

const authLogoutOutputSchema = Object.freeze({
  parse(value) {
    const output = exactKeys(value, ["success"], "Auth logout output");
    if (output.success !== true) throw new TypeError("Auth logout output is invalid");
    return Object.freeze({ success: true });
  },
});

const emptyInputSchema = (label) => exactObjectInputSchema(label, [], () => Object.freeze({}));
const projectIdInputSchema = (label) => exactObjectInputSchema(label, ["projectId"], (input) => Object.freeze({
  projectId: positiveId(input.projectId, `${label} input`),
}));
const optionalProjectIdInputSchema = (label) => exactObjectInputSchema(label, ["projectId"], (input) => {
  if (input.projectId === undefined || input.projectId === null || input.projectId === "") return Object.freeze({});
  return Object.freeze({ projectId: positiveId(input.projectId, `${label} input`) });
});
const projectAccessCheckInputSchema = exactObjectInputSchema("Project access-check", ["projectId", "action"], (input) => {
  const action = validOptionalString(input.action, "Project access-check action");
  if (!["read", "write", "delete", "run", "publish"].includes(action)) throw new TypeError("Project access-check action is invalid");
  return Object.freeze({
    action,
    ...(input.projectId === undefined || input.projectId === null || input.projectId === ""
      ? {}
      : { projectId: positiveId(input.projectId, "Project access-check input") }),
  });
});

function projectOperationInputSchema(name, label, allowedKeys, argumentsFor) {
  return exactObjectInputSchema(label, allowedKeys, (input, context) => {
    projectModule.projectOperationSchemas[name].parseInput(...argumentsFor(input, context));
    return input;
  });
}

function createCoreRuntime({ catalog, bindings }) {
  if (!catalog || typeof catalog.get !== "function" || typeof catalog.values !== "function") throw new TypeError("Capability catalog is required");
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) throw new TypeError("Capability bindings are required");
  for (const definition of catalog.values()) {
    const binding = bindings[definition.capabilityId];
    if (!binding || typeof binding.invoke !== "function") throw new TypeError(`Missing capability binding: ${definition.capabilityId}`);
    if (!binding.inputSchema || typeof binding.inputSchema.parse !== "function") throw new TypeError(`Missing input schema: ${definition.capabilityId}`);
    if (!binding.outputSchema || typeof binding.outputSchema.parse !== "function") throw new TypeError(`Missing output schema: ${definition.capabilityId}`);
  }

  async function execute(capabilityId, input, context = {}) {
    catalog.get(capabilityId);
    const binding = bindings[capabilityId];
    const parsedInput = binding.inputSchema.parse(input, context);
    const result = await binding.invoke(parsedInput, context);
    return binding.outputSchema.parse(result, context);
  }

  return Object.freeze({
    catalog,
    execute,
    moduleVersions: catalog.moduleVersions,
  });
}

function actorFrom(context) {
  return context?.actor || context;
}

function bind(handler, argumentsFor, schemas = {}) {
  if (typeof handler !== "function") throw new TypeError("Module capability handler is required");
  return Object.freeze({
    inputSchema: schemas.inputSchema || objectInputSchema,
    outputSchema: schemas.outputSchema || identitySchema,
    invoke(input, context) {
      return handler(...argumentsFor(input, context));
    },
  });
}

function productionBindings(auth, project, moduleBindings = {}) {
  async function projectAccessCheck(input, context) {
    const actor = actorFrom(context);
    kernel.authorizeCapability(actor, { modules: ["system_projects"], action: input.action, readOnlyAllowed: input.action === "read" });
    const result = await project.accessCheck(actor, input.projectId);
    kernel.authorizeCapability({ ...actor, roleType: result.member?.projectRole }, {
      modules: ["system_projects"], action: input.action, readOnlyAllowed: input.action === "read",
    });
    return result;
  }
  return Object.freeze({
    "auth.login": bind(auth.login, (input, context) => [input, context], { inputSchema: authLoginInputSchema, outputSchema: authLoginOutputSchema }),
    "auth.profile": bind(auth.profile, (input) => [input], { inputSchema: authProfileInputSchema, outputSchema: authProfileOutputSchema }),
    "auth.logout": bind(auth.logout, (input) => [input], { inputSchema: authLogoutInputSchema, outputSchema: authLogoutOutputSchema }),
    "project.list-my": bind(project.listMy, (_input, context) => [actorFrom(context)], { inputSchema: emptyInputSchema("Project list-my") }),
    "project.list": bind(project.list, (_input, context) => [actorFrom(context)], { inputSchema: emptyInputSchema("Project list") }),
    "project.current": bind(project.current, (_input, context) => [actorFrom(context)], { inputSchema: emptyInputSchema("Project current") }),
    "project.detail": bind(project.detail, (input, context) => [input.projectId, actorFrom(context)], { inputSchema: projectOperationInputSchema("detail", "Project detail", ["projectId"], (input) => [input.projectId]) }),
    "project.resolve": bind(project.resolve, (input, context) => [actorFrom(context), input.projectId], { inputSchema: optionalProjectIdInputSchema("Project resolve") }),
    "project.use": bind(project.use, (input, context) => [actorFrom(context), input.projectId], { inputSchema: optionalProjectIdInputSchema("Project use") }),
    "project.access-check": bind(projectAccessCheck, (input, context) => [input, context], { inputSchema: projectAccessCheckInputSchema }),
    "project.set-default": bind(project.setDefault, (input, context) => [input.projectId, actorFrom(context)], { inputSchema: projectIdInputSchema("Project set-default") }),
    "project.create": bind(project.create, (input, context) => [input.body, actorFrom(context)], { inputSchema: projectOperationInputSchema("create", "Project create", ["body"], (input, context) => [input.body, actorFrom(context)]) }),
    "project.update": bind(project.update, (input, context) => [input.projectId, input.body, actorFrom(context)], { inputSchema: projectOperationInputSchema("update", "Project update", ["projectId", "body"], (input) => [input.projectId, input.body]) }),
    "project.remove": bind(project.remove, (input, context) => [input.projectId, actorFrom(context)], { inputSchema: projectOperationInputSchema("remove", "Project remove", ["projectId"], (input) => [input.projectId]) }),
    "project.set-status": bind(project.setStatus, (input, context) => [input.projectId, input.status, actorFrom(context)], { inputSchema: projectOperationInputSchema("setStatus", "Project set-status", ["projectId", "status"], (input) => [input.projectId, input.status]) }),
    "project.upsert-member": bind(project.upsertMember, (input, context) => [input.projectId, input.body, actorFrom(context)], { inputSchema: projectOperationInputSchema("upsertMember", "Project upsert-member", ["projectId", "body"], (input) => [input.projectId, input.body]) }),
    "project.remove-member": bind(project.removeMember, (input, context) => [input.projectId, input.userId, actorFrom(context)], { inputSchema: projectOperationInputSchema("removeMember", "Project remove-member", ["projectId", "userId"], (input) => [input.projectId, input.userId]) }),
    "project.list-transfer-logs": bind(project.listTransferLogs, (input, context) => [input, actorFrom(context)], { inputSchema: projectOperationInputSchema("listTransferLogs", "Project list-transfer-logs", ["projectId"], (input) => [input]) }),
    "project.preview-import": bind(project.previewImport, (input, context) => [input.file, actorFrom(context)], { inputSchema: projectOperationInputSchema("previewImport", "Project preview-import", ["file"], (input) => [input.file]) }),
    "project.import-assets": bind(project.importAssets, (input, context) => [input.file, input.options || {}, actorFrom(context)], { inputSchema: projectOperationInputSchema("importAssets", "Project import-assets", ["file", "options"], (input, context) => [input.file, input.options || {}, actorFrom(context)]) }),
    "project.list-backups": bind(project.listBackups, (input, context) => [input.projectId, actorFrom(context)], { inputSchema: projectOperationInputSchema("listBackups", "Project list-backups", ["projectId"], (input) => [input.projectId]) }),
    "project.create-backup": bind(project.createBackup, (input, context) => [input.projectId, actorFrom(context)], { inputSchema: projectOperationInputSchema("createBackup", "Project create-backup", ["projectId"], (input, context) => [input.projectId, actorFrom(context)]) }),
    "project.download-backup": bind(project.downloadBackup, (input, context) => [input.projectId, input.backupId, actorFrom(context)], { inputSchema: projectOperationInputSchema("downloadBackup", "Project download-backup", ["projectId", "backupId"], (input) => [input.projectId, input.backupId]) }),
    "project.export-assets": bind(project.exportAssets, (input, context) => [input.projectId, input.options || {}, actorFrom(context)], { inputSchema: projectOperationInputSchema("exportAssets", "Project export-assets", ["projectId", "options"], (input, context) => [input.projectId, input.options || {}, actorFrom(context)]) }),
    ...moduleBindings,
  });
}

function moduleInputSchema(definition) {
  return Object.freeze({
    parse(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`${definition.capabilityId} input must be an object`);
      }
      for (const key of definition.inputSchema?.required || []) {
        if (value[key] === undefined || value[key] === null) {
          throw new TypeError(`${definition.capabilityId} input is missing ${key}`);
        }
      }
      return value;
    },
  });
}

function moduleCapabilityBindings(capabilities) {
  return Object.fromEntries(capabilities.map((capability) => [capability.capabilityId, Object.freeze({
    inputSchema: moduleInputSchema(capability),
    outputSchema: identitySchema,
    invoke(input, context) {
      return capability.execute(input, context);
    },
  })]));
}

function moduleNamespace(capabilities, prefix) {
  const byId = new Map(capabilities.map((capability) => [capability.capabilityId, capability.execute]));
  return new Proxy(Object.create(null), {
    get(_target, property) {
      const capabilityId = `${prefix}.${String(property)}`;
      const execute = byId.get(capabilityId);
      if (typeof execute !== "function") throw new TypeError(`Missing ${capabilityId} capability handler`);
      return execute;
    },
  });
}

function moduleDependencies(runtimeDependencies, moduleName) {
  const moduleSpecific = runtimeDependencies[moduleName] || {};
  return { ...runtimeDependencies, ...moduleSpecific };
}

function lazyCapabilityNamespace(factory, dependencies, namespace) {
  let capabilities;
  return new Proxy(Object.create(null), {
    get(_target, property) {
      return (...args) => {
        if (!capabilities) capabilities = factory(dependencies)[namespace];
        const handler = capabilities?.[property];
        if (typeof handler !== "function") throw new TypeError(`Missing ${namespace} capability handler: ${String(property)}`);
        return handler(...args);
      };
    },
  });
}

function createDataPlatformCore(runtimeDependencies = {}) {
  if (!runtimeDependencies || typeof runtimeDependencies !== "object" || Array.isArray(runtimeDependencies)) {
    throw new TypeError("Runtime dependencies must be an object");
  }
  const catalog = createCapabilityCatalog({
    manifest: aggregateManifest,
    aggregatePackageVersion: packageManifest.version,
    kernelVersion: kernelPackage.version,
    dependencyVersions: packageManifest.dependencies,
    modules: moduleExports,
  });
  const auth = lazyCapabilityNamespace(authModule.createAuthCapabilities, moduleDependencies(runtimeDependencies, "auth"), "auth");
  const project = lazyCapabilityNamespace(projectModule.createProjectCapabilities, moduleDependencies(runtimeDependencies, "project"), "project");
  const platformCapabilities = platformModule.createCapabilities(moduleDependencies(runtimeDependencies, "platform"));
  const assetSearchCapabilities = assetSearchModule.createCapabilities(moduleDependencies(runtimeDependencies, "asset-search"));
  const dataSourcesCapabilities = dataSourcesModule.createCapabilities(moduleDependencies(runtimeDependencies, "data-sources"));
  const dataSourceResearchCapabilities = dataSourceResearchModule.createCapabilities(moduleDependencies(runtimeDependencies, "data-source-research"));
  const dataLabSourcesCapabilities = dataLabSourcesModule.createCapabilities(moduleDependencies(runtimeDependencies, "data-lab-sources"));
  const ingestionAiConfigsCapabilities = ingestionAiConfigsModule.createCapabilities(moduleDependencies(runtimeDependencies, "ingestion-ai-configs"));
  const ingestionTasksCapabilities = ingestionTasksModule.createCapabilities(moduleDependencies(runtimeDependencies, "ingestion-tasks"));
  const moduleBindings = {
    ...moduleCapabilityBindings(platformCapabilities),
    ...moduleCapabilityBindings(assetSearchCapabilities),
    ...moduleCapabilityBindings(dataSourcesCapabilities),
    ...moduleCapabilityBindings(dataSourceResearchCapabilities),
    ...moduleCapabilityBindings(dataLabSourcesCapabilities),
    ...moduleCapabilityBindings(ingestionAiConfigsCapabilities),
    ...moduleCapabilityBindings(ingestionTasksCapabilities),
  };
  const coreRuntime = createCoreRuntime({ catalog, bindings: productionBindings(auth, project, moduleBindings) });
  return Object.freeze({
    ...coreRuntime,
    platform: moduleNamespace(platformCapabilities, "platform"),
    assetSearch: moduleNamespace(assetSearchCapabilities, "assetSearch"),
    dataSources: moduleNamespace(dataSourcesCapabilities, "data-sources"),
    dataSourceResearch: moduleNamespace(dataSourceResearchCapabilities, "dataSourceResearch"),
    dataLabSources: moduleNamespace(dataLabSourcesCapabilities, "dataLabSources"),
    ingestionAiConfigs: moduleNamespace(ingestionAiConfigsCapabilities, "ingestionAiConfigs"),
    ingestionTasks: moduleNamespace(ingestionTasksCapabilities, "ingestionTasks"),
  });
}

module.exports = Object.freeze({
  ...kernel,
  aggregateManifest,
  createCapabilityCatalog,
  createCoreRuntime,
  createDataPlatformCore,
});
