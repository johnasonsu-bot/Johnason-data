const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createCapabilityCatalog,
} = require("../src/catalog");
const {
  aggregateManifest: exportedAggregateManifest,
  createCoreRuntime,
  createDataPlatformCore,
} = require("../src/runtime");

const packageRoot = path.resolve(__dirname, "..");

function capability(capabilityId, sourceApiKeys = []) {
  return {
    capabilityId,
    sourceApiKeys,
    sourceFrontendKeys: [],
    executionTargets: ["web", "cli"],
  };
}

function aggregateManifest(modules, overrides = {}) {
  return {
    aggregateVersion: "0.1.0",
    capabilitySchemaVersion: "1.0.0",
    kernel: {
      packageName: "@johnason/data-platform-core-kernel",
      version: "0.1.0",
    },
    modules,
    sourceApiAliases: [],
    ...overrides,
  };
}

function moduleSelection(packageName, moduleName, overrides = {}) {
  return {
    packageName,
    moduleName,
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    capabilitySchemaVersion: "1.0.0",
    factoryExport: `create${moduleName.replace(/(^|-)([a-z])/g, (_match, _dash, letter) => letter.toUpperCase())}Capabilities`,
    ...overrides,
  };
}

function moduleExport(selection, capabilities) {
  return {
    moduleManifest: {
      moduleName: selection.moduleName,
      moduleVersion: selection.candidateVersion,
      capabilitySchemaVersion: selection.capabilitySchemaVersion,
      capabilities,
    },
    [selection.factoryExport]() {
      return {};
    },
  };
}

function catalogFixture(selections, moduleCapabilities, overrides = {}) {
  const manifest = aggregateManifest(selections, overrides.manifest);
  const dependencyVersions = Object.fromEntries([
    [manifest.kernel.packageName, manifest.kernel.version],
    ...selections.map((selection) => [selection.packageName, selection.candidateVersion]),
  ]);
  const modules = Object.fromEntries(selections.map((selection, index) => [
    selection.packageName,
    moduleExport(selection, moduleCapabilities[index]),
  ]));
  return {
    manifest,
    aggregatePackageVersion: manifest.aggregateVersion,
    kernelVersion: manifest.kernel.version,
    dependencyVersions: { ...dependencyVersions, ...overrides.dependencyVersions },
    modules: { ...modules, ...overrides.modules },
  };
}

test("aggregate package records exact candidate and rollback versions", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "src/module-manifest.json"), "utf8"));
  const workspaceLock = JSON.parse(fs.readFileSync(path.resolve(packageRoot, "../../package-lock.json"), "utf8"));

  assert.equal(pkg.name, "@johnason/data-platform-core");
  assert.equal(pkg.version, manifest.aggregateVersion);
  assert.deepEqual(pkg.files, ["src"]);
  assert.deepEqual(pkg.dependencies, {
    "@johnason/data-platform-core-kernel": "0.1.0",
    "@johnason/data-platform-module-auth": "0.2.0",
    "@johnason/data-platform-module-project-spaces": "0.2.0",
  });
  assert.equal(workspaceLock.packages["packages/data-platform-core"].version, manifest.aggregateVersion);
  assert.deepEqual(workspaceLock.packages["packages/data-platform-core"].dependencies, pkg.dependencies);
  assert.deepEqual(manifest.modules.map(({ moduleName, candidateVersion, rollbackVersion }) => ({
    moduleName,
    candidateVersion,
    rollbackVersion,
  })), [
    { moduleName: "auth", candidateVersion: "0.2.0", rollbackVersion: "0.1.0" },
    { moduleName: "project-spaces", candidateVersion: "0.2.0", rollbackVersion: "0.1.0" },
  ]);
  assert.equal(Object.isFrozen(exportedAggregateManifest), true);
  assert.equal(Object.isFrozen(exportedAggregateManifest.kernel), true);
  assert.equal(Object.isFrozen(exportedAggregateManifest.modules), true);
  assert.equal(Object.isFrozen(exportedAggregateManifest.modules[0]), true);
  assert.equal(Object.isFrozen(exportedAggregateManifest.sourceApiAliases), true);
});

test("catalog rejects duplicate capability IDs across required modules", () => {
  const first = moduleSelection("@fixture/first", "first");
  const second = moduleSelection("@fixture/second", "second");
  const fixture = catalogFixture([first, second], [
    [capability("shared.read")],
    [capability("shared.read")],
  ]);

  assert.throws(() => createCapabilityCatalog(fixture), /duplicate capability id.*shared\.read/i);
});

test("catalog rejects duplicate source API keys unless one capability explicitly aliases the canonical capability", () => {
  const first = moduleSelection("@fixture/first", "first");
  const second = moduleSelection("@fixture/second", "second");
  const sourceApiKey = "GET /api/v1/shared";
  const fixture = catalogFixture([first, second], [
    [capability("shared.canonical", [sourceApiKey])],
    [capability("shared.compatible", [sourceApiKey])],
  ]);

  assert.throws(() => createCapabilityCatalog(fixture), /duplicate source api key.*GET \/api\/v1\/shared/i);

  const catalog = createCapabilityCatalog({
    ...fixture,
    manifest: {
      ...fixture.manifest,
      sourceApiAliases: [{
        sourceApiKey,
        canonicalCapabilityId: "shared.canonical",
        aliasCapabilityId: "shared.compatible",
      }],
    },
  });
  assert.equal(catalog.getBySourceApiKey(sourceApiKey).capabilityId, "shared.canonical");
});

test("catalog alias resolution is independent of module order and rejects duplicate alias declarations", () => {
  const canonical = moduleSelection("@fixture/canonical", "canonical");
  const compatible = moduleSelection("@fixture/compatible", "compatible");
  const sourceApiKey = "GET /api/v1/shared";
  const fixture = catalogFixture([compatible, canonical], [
    [capability("shared.compatible", [sourceApiKey])],
    [capability("shared.canonical", [sourceApiKey])],
  ], {
    manifest: {
      sourceApiAliases: [{ sourceApiKey, canonicalCapabilityId: "shared.canonical", aliasCapabilityId: "shared.compatible" }],
    },
  });

  assert.equal(createCapabilityCatalog(fixture).getBySourceApiKey(sourceApiKey).capabilityId, "shared.canonical");
  assert.throws(() => createCapabilityCatalog({
    ...fixture,
    manifest: {
      ...fixture.manifest,
      sourceApiAliases: [...fixture.manifest.sourceApiAliases, ...fixture.manifest.sourceApiAliases],
    },
  }), /duplicate source api alias.*GET \/api\/v1\/shared/i);
});

test("catalog rejects manifest, dependency lock, and module export version mismatches", () => {
  const selection = moduleSelection("@fixture/auth", "auth");
  const base = catalogFixture([selection], [[capability("auth.profile")]]);

  assert.throws(() => createCapabilityCatalog({
    ...base,
    dependencyVersions: { ...base.dependencyVersions, [selection.packageName]: "0.1.0" },
  }), /dependency lock version mismatch.*@fixture\/auth/i);

  assert.throws(() => createCapabilityCatalog({
    ...base,
    aggregatePackageVersion: "0.0.9",
  }), /aggregate package version mismatch/i);

  assert.throws(() => createCapabilityCatalog({
    ...base,
    kernelVersion: "0.0.9",
  }), /kernel export version mismatch.*core-kernel/i);

  assert.throws(() => createCapabilityCatalog({
    ...base,
    modules: {
      [selection.packageName]: {
        ...base.modules[selection.packageName],
        moduleManifest: {
          ...base.modules[selection.packageName].moduleManifest,
          moduleVersion: "0.1.0",
        },
      },
    },
  }), /module export version mismatch.*@fixture\/auth/i);

  assert.throws(() => createCapabilityCatalog({
    ...base,
    manifest: { ...base.manifest, aggregateVersion: "^0.1.0" },
  }), /aggregate version.*exact/i);
});

test("catalog rejects incompatible capability schemas and missing required modules", () => {
  const selection = moduleSelection("@fixture/auth", "auth");
  const base = catalogFixture([selection], [[capability("auth.profile")]]);

  assert.throws(() => createCapabilityCatalog({
    ...base,
    modules: {
      [selection.packageName]: {
        ...base.modules[selection.packageName],
        moduleManifest: {
          ...base.modules[selection.packageName].moduleManifest,
          capabilitySchemaVersion: "2.0.0",
        },
      },
    },
  }), /incompatible capability schema.*@fixture\/auth/i);

  assert.throws(() => createCapabilityCatalog({
    ...base,
    modules: {},
  }), /missing required module.*@fixture\/auth/i);
});

test("runtime validates input and output schemas before returning a selected capability result", async () => {
  const selection = moduleSelection("@fixture/echo", "echo");
  const catalog = createCapabilityCatalog(catalogFixture([selection], [[capability("echo.value")]]));
  const calls = [];
  const core = createCoreRuntime({
    catalog,
    bindings: {
      "echo.value": {
        inputSchema: {
          parse(input) {
            assert.equal(typeof input?.value, "string");
            return { value: input.value.trim() };
          },
        },
        outputSchema: {
          parse(output) {
            assert.deepEqual(Object.keys(output), ["value"]);
            return Object.freeze({ value: output.value });
          },
        },
        async invoke(input, context) {
          calls.push({ input, context });
          return { value: input.value.toUpperCase() };
        },
      },
    },
  });

  const context = { actor: { sub: 7 } };
  assert.deepEqual(await core.execute("echo.value", { value: "  ready " }, context), { value: "READY" });
  assert.deepEqual(calls, [{ input: { value: "ready" }, context }]);
  assert.deepEqual(core.moduleVersions, { echo: "0.2.0" });
  assert.throws(() => core.catalog.get("echo.missing"), /unknown capability.*echo\.missing/i);
});

test("installed aggregate definitions expose exactly one auth/project capability and execute through public factories", async () => {
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
  };
  const user = {
    id: 7,
    username: "operator",
    displayName: "Operator",
    roleId: 1,
    roleCode: "admin",
    roleType: "admin",
    roleName: "Administrator",
    defaultProjectId: null,
    permissions: { modules: ["system_projects"] },
    status: "active",
  };
  const core = createDataPlatformCore({
    databaseRuntime: {
      pool: { async getConnection() { return connection; } },
      async testConnection() {},
      async close() {},
    },
    auth: {
      authRepository: {
        async findByUsername() { return user; },
        async findProfileById() { return user; },
      },
      sessionRepository: {
        async createSession() {}, async findActiveSession() { return null; }, async touchSession() {}, async revokeSession() {},
      },
      jwtCodec: { sign() { return "signed"; }, decode() { return {}; }, verify() { return {}; } },
      passwordHasher: { async compare() { return true; } },
      clock: { now() { return new Date("2026-08-13T00:00:00.000Z"); } },
      idGenerator() { return "session-1"; },
    },
    project: {
      projectRepository: {
        async ensureDefaultProject() { return null; },
        async listProjects() { return []; },
      },
    },
  });

  assert.equal(core.catalog.get("auth.profile").moduleName, "auth");
  assert.equal(core.catalog.get("project.list-my").moduleName, "project-spaces");
  assert.deepEqual(await core.execute("auth.profile", { userId: 7 }, {}), {
    user: {
      id: 7,
      sub: 7,
      username: "operator",
      displayName: "Operator",
      roleId: 1,
      roleCode: "admin",
      roleType: "admin",
      roleName: "Administrator",
      defaultProjectId: null,
      permissions: { modules: ["system_projects"] },
    },
  });
  assert.deepEqual(await core.execute("project.list-my", {}, { actor: user }), []);
});

test("aggregate rejects malformed auth input before an authentication repository side effect", async () => {
  let repositoryCalls = 0;
  let revokeCalls = 0;
  const core = createDataPlatformCore({
    databaseRuntime: {
      pool: { async getConnection() { throw new Error("connection must not be requested"); } },
      async testConnection() {},
      async close() {},
    },
    auth: {
      authRepository: {
        async findByUsername() { repositoryCalls += 1; return null; },
        async findProfileById() { repositoryCalls += 1; return null; },
      },
      sessionRepository: {
        async createSession() {}, async findActiveSession() { return null; }, async touchSession() {}, async revokeSession() { revokeCalls += 1; },
      },
      jwtCodec: { sign() { return "signed"; }, decode() { return {}; }, verify() { return {}; } },
      passwordHasher: { async compare() { return false; } },
      clock: { now() { return new Date("2026-08-13T00:00:00.000Z"); } },
      idGenerator() { return "session-1"; },
    },
    project: { projectRepository: {} },
  });

  await assert.rejects(() => core.execute("auth.login", { username: "", password: "" }, {}), /auth login input/i);
  await assert.rejects(() => core.execute("auth.profile", { userId: 0 }, {}), /auth profile input/i);
  await assert.rejects(() => core.execute("auth.logout", { unexpected: true }, {}), /auth logout input/i);
  assert.equal(repositoryCalls, 0);
  assert.equal(revokeCalls, 0);
});

test("aggregate rejects malformed project service input before a repository side effect", async () => {
  let repositoryCalls = 0;
  const core = createDataPlatformCore({
    databaseRuntime: { pool: {}, async testConnection() {}, async close() {} },
    project: {
      projectRepository: {
        async getProjectById() { repositoryCalls += 1; return null; },
      },
    },
  });
  const context = { actor: { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } } };

  await assert.rejects(
    () => core.execute("project.set-default", { projectId: 0, unexpected: true }, context),
    /project set-default input/i,
  );
  assert.equal(repositoryCalls, 0);
});

test("aggregate project access-check enforces action against the resolved membership role", async () => {
  const project = { id: 1, projectName: "One", projectCode: "one", status: "active" };
  const member = { projectId: 1, userId: 7, projectRole: "viewer", status: "active", permissions: { modules: [] } };
  const core = createDataPlatformCore({
    databaseRuntime: { pool: {}, async testConnection() {}, async close() {} },
    project: { projectRepository: {
      async getProjectById() { return project; },
      async getProjectMember() { return member; },
    } },
  });
  const context = { actor: { sub: 7, roleCode: "developer", permissions: { modules: ["system_projects"] } } };

  assert.equal((await core.execute("project.access-check", { projectId: 1, action: "read" }, context)).project.id, 1);
  await assert.rejects(
    () => core.execute("project.access-check", { projectId: 1, action: "write" }, context),
    (error) => error.code === "READ_ONLY_FORBIDDEN" && error.statusCode === 403,
  );
});

test("aggregate rejects malformed authentication output", async () => {
  const core = createDataPlatformCore({
    databaseRuntime: {
      pool: { async getConnection() { throw new Error("connection must not be requested"); } },
      async testConnection() {},
      async close() {},
    },
    auth: {
      authRepository: {
        async findByUsername() { return null; },
        async findProfileById() { return { id: 7, status: "active" }; },
      },
      sessionRepository: {
        async createSession() {}, async findActiveSession() { return null; }, async touchSession() {}, async revokeSession() {},
      },
      jwtCodec: { sign() { return "signed"; }, decode() { return {}; }, verify() { return {}; } },
      passwordHasher: { async compare() { return false; } },
      clock: { now() { return new Date("2026-08-13T00:00:00.000Z"); } },
      idGenerator() { return "session-1"; },
    },
  });

  await assert.rejects(() => core.execute("auth.profile", { userId: 7 }, {}), /auth profile output/i);
});
