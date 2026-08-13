const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createProjectCapabilities, moduleManifest } = require("../src");

const timestamp = "2026-08-13T00:00:00.000Z";

function projectRecord(overrides = {}) {
  return {
    id: 1,
    projectName: "Project One",
    projectCode: "project_one",
    projectType: "standard",
    description: "Project description",
    ownerUserId: 7,
    ownerName: "Admin",
    status: "active",
    resourceConfig: {},
    settings: {},
    createdBy: "admin",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function memberRecord(overrides = {}) {
  return {
    id: 3,
    projectId: 1,
    userId: 9,
    username: "member",
    displayName: "Member",
    projectRole: "developer",
    permissions: { modules: [] },
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function packageArtifact() {
  const artifact = {
    manifest: {
      appVersion: "2.0.0",
      packageType: "medata-project-assets",
      exportFormatVersion: "3.0.0",
      exportedAt: timestamp,
      exportedBy: "admin",
      sensitiveMode: "desensitized",
      sourceProject: { id: 1, code: "project_one", name: "Project One", type: "standard" },
      modules: [],
      compatibility: { minimumImportVersion: "2.0.0", supportedLegacyVersions: ["1.0.0", "2.0.0"] },
      coverage: { configurationAssets: true, projectRuntimeFiles: true, externalPhysicalData: false, sensitiveConfiguration: "desensitized" },
    },
    project: {
      projectName: "Project One", projectCode: "project_one", projectType: "standard", description: "Project description",
      ownerName: "Admin", status: "active", resourceConfig: {}, settings: {},
    },
    schema: { importOrder: [], foreignKeys: [] },
    references: { users: [], modelProviders: [] },
    tables: [],
    files: [],
  };
  const withoutIntegrity = { ...artifact, manifest: { ...artifact.manifest } };
  artifact.manifest.integrity = { algorithm: "sha256", payloadSha256: sha256(withoutIntegrity), tables: [] };
  return artifact;
}

function sha256(value) {
  function stable(item) {
    if (Array.isArray(item)) return item.map(stable);
    if (item && typeof item === "object") return Object.keys(item).sort().reduce((result, key) => { result[key] = stable(item[key]); return result; }, {});
    return item;
  }
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function previewResult() {
  return {
    sourceProject: { id: 1, code: "project_one", name: "Project One", type: "standard" },
    exportedAt: timestamp,
    sensitiveMode: "desensitized",
    packageVersion: "3.0.0",
    sourcePackageVersion: "3.0.0",
    integrityVerified: true,
    warnings: [],
    coverage: { configurationAssets: true, projectRuntimeFiles: true, externalPhysicalData: false },
    modules: [],
    tableCount: 0,
    rowCount: 0,
    runtimeFileCount: 0,
    databaseTypes: [],
    tables: [],
  };
}

function importResult() {
  return {
    projectId: 1,
    summary: {
      mode: "new",
      tableCount: 0,
      rowCount: 0,
      tables: [],
      integrity: { verified: true, expectedRowCount: 0, importedRowCount: 0, restoredRuntimeFileCount: 0 },
      warnings: [],
      automaticBackup: null,
    },
  };
}

function validProjectBody(overrides = {}) {
  return { projectName: "Project One", projectCode: "project_one", ...overrides };
}

const apiToCapability = {
  "GET /api/v1/projects/my": "listMy",
  "GET /api/v1/projects/asset-transfer-logs": "listTransferLogs",
  "POST /api/v1/projects/assets/import/preview": "previewImport",
  "POST /api/v1/projects/assets/import": "importAssets",
  "GET /api/v1/projects": "list",
  "POST /api/v1/projects": "create",
  "GET /api/v1/projects/:id/assets/backups": "listBackups",
  "POST /api/v1/projects/:id/assets/backups": "createBackup",
  "GET /api/v1/projects/:id/assets/backups/:backupId/download": "downloadBackup",
  "GET /api/v1/projects/:id/assets/export": "exportAssets",
  "GET /api/v1/projects/:id": "detail",
  "PUT /api/v1/projects/:id": "update",
  "DELETE /api/v1/projects/:id": "remove",
  "POST /api/v1/projects/:id/default": "setDefault",
  "POST /api/v1/projects/:id/status": "setStatus",
  "POST /api/v1/projects/:id/members": "upsertMember",
  "DELETE /api/v1/projects/:id/members/:userId": "removeMember",
};

test("each project source API maps to its own semantic transport capability", async () => {
  const calls = [];
  const resultFor = {
    detail: { ...projectRecord(), members: [memberRecord()] }, create: projectRecord(), update: projectRecord(), remove: { projectId: 1, deleted: true }, setStatus: projectRecord(),
    upsertMember: memberRecord(), removeMember: { projectId: 1, userId: 9 }, listTransferLogs: [], previewImport: previewResult(),
    importAssets: importResult(), listBackups: [], createBackup: { id: 2, projectId: 1, packageVersion: "3.0.0", packageSha256: null, createdAt: timestamp },
    downloadBackup: packageArtifact(), exportAssets: packageArtifact(),
  };
  const projectOperations = Object.fromEntries(Object.values(apiToCapability).filter((name) => !["listMy", "list", "setDefault"].includes(name)).map((name) => [name, async (...args) => { calls.push({ name, args }); return resultFor[name]; }]));
  const repository = {
    async ensureDefaultProject() { return projectRecord(); }, async getProjectMember() { return memberRecord({ userId: 7 }); }, async ensureUserMembership() {},
    async listUserProjects() { return [projectRecord()]; }, async listProjects() { return [projectRecord()]; },
    async getUserDefaultProjectId() { return 1; }, async getProjectById(id) { return projectRecord({ id: Number(id) }); }, async setUserDefaultProject() { return true; },
  };
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["data_map", "system_projects"] } };
  const project = createProjectCapabilities({ projectRepository: repository, projectOperations }).project;
  const argumentsFor = {
    listMy: [actor], list: [actor], listTransferLogs: [{ projectId: 1 }, actor], previewImport: [{ name: "fixture.json", size: 1 }, actor],
    importAssets: [{ name: "fixture.json", size: 1 }, { mode: "new" }, actor], create: [validProjectBody(), actor], listBackups: [1, actor],
    createBackup: [1, actor], downloadBackup: [1, 2, actor], exportAssets: [1, { sensitiveMode: "desensitized" }, actor], detail: [1, actor],
    update: [1, validProjectBody({ projectCode: "edited" }), actor], remove: [1, actor], setDefault: [1, actor], setStatus: [1, "active", actor],
    upsertMember: [1, { userId: 9, projectRole: "developer" }, actor], removeMember: [1, 9, actor],
  };
  for (const [apiKey, capability] of Object.entries(apiToCapability)) {
    const args = argumentsFor[capability];
    const result = await project[capability](...args);
    if (!["listMy", "list", "setDefault"].includes(capability)) {
      assert.equal(calls.at(-1).name, capability, apiKey);
      assert.deepEqual(result, { data: resultFor[capability] }, `${apiKey} returns a validated public DTO envelope`);
    }
  }
  const baseline = require("../../../docs/superpowers/specs/data-platform-cli-coverage-baseline.json");
  const expectedKeys = baseline.apiCoverage.filter((entry) => entry.module === "projects").map((entry) => entry.apiKey).sort();
  assert.deepEqual(moduleManifest.capabilities.flatMap((entry) => entry.sourceApiKeys).sort(), expectedKeys);
  assert.deepEqual(moduleManifest.capabilities.filter((entry) => ["project.current", "project.resolve", "project.use", "project.access-check"].includes(entry.capabilityId)).flatMap((entry) => entry.sourceApiKeys), []);
});

test("project mutation operations reject viewers before invoking the injected IO port", async () => {
  let invoked = false;
  const project = createProjectCapabilities({ projectOperations: { remove: async () => { invoked = true; } } }).project;
  await assert.rejects(
    () => project.remove(1, { sub: 8, roleCode: "viewer", permissions: { modules: ["system_projects"] } }),
    (error) => error && error.code === "READ_ONLY_FORBIDDEN" && error.statusCode === 403,
  );
  assert.equal(invoked, false);
});

test("source project operations require system_projects while /my remains self-service", async () => {
  const calls = [];
  const repository = {
    async ensureDefaultProject() { return projectRecord(); }, async getProjectMember() { return memberRecord({ userId: 8 }); }, async ensureUserMembership() {},
    async listUserProjects() { return [projectRecord()]; }, async listProjects() { return [projectRecord()]; },
    async getUserDefaultProjectId() { return 1; }, async getProjectById(id) { return projectRecord({ id: Number(id) }); }, async setUserDefaultProject() { return true; },
  };
  const port = { detail: async () => ({ ...projectRecord(), members: [] }), previewImport: async () => { calls.push("previewImport"); return previewResult(); } };
  const project = createProjectCapabilities({ projectRepository: repository, projectOperations: port }).project;
  const systemOnly = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const dataMapOnly = { sub: 8, roleCode: "admin", permissions: { modules: ["data_map"] } };
  const viewer = { sub: 9, roleCode: "viewer", permissions: { modules: ["system_projects"] } };

  assert.deepEqual(await project.listMy(dataMapOnly), [projectRecord()]);
  assert.deepEqual(await project.detail(1, systemOnly), { data: { ...projectRecord(), members: [] } });
  await assert.rejects(() => project.detail(1, dataMapOnly), (error) => error?.code === "MODULE_PERMISSION_FORBIDDEN" && error.statusCode === 403);
  await assert.rejects(() => project.list(dataMapOnly), (error) => error?.code === "MODULE_PERMISSION_FORBIDDEN" && error.statusCode === 403);
  await assert.rejects(() => project.setDefault(1, dataMapOnly), (error) => error?.code === "MODULE_PERMISSION_FORBIDDEN" && error.statusCode === 403);
  await assert.rejects(() => project.previewImport({ originalname: "fixture.json", size: 1 }, viewer), (error) => error?.code === "READ_ONLY_FORBIDDEN" && error.statusCode === 403);
  assert.deepEqual(calls, []);
});

test("project port operations validate transport inputs, business errors, and public DTOs", async () => {
  const calls = [];
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const port = {
    detail: async (...args) => { calls.push(["detail", args]); return { ...projectRecord(), members: [] }; },
    create: async () => { const error = new Error("duplicate"); error.code = "CONFLICT"; throw error; },
    previewImport: async (...args) => { calls.push(["previewImport", args]); return previewResult(); },
    exportAssets: async () => packageArtifact(),
  };
  const project = createProjectCapabilities({ projectOperations: port }).project;
  await assert.rejects(() => project.detail("bad", actor), (error) => error?.code === "PROJECT_REQUEST_INVALID" && error.statusCode === 400);
  assert.deepEqual(calls, []);
  await assert.rejects(() => project.create({}, actor), (error) => error?.code === "PROJECT_REQUEST_INVALID" && error.statusCode === 400);
  await assert.rejects(() => project.create(validProjectBody({ projectCode: "new" }), actor), (error) => error?.code === "PROJECT_CONFLICT" && error.statusCode === 409);
  assert.deepEqual(await project.detail(1, actor), { data: { ...projectRecord(), members: [] } });
  assert.deepEqual(await project.previewImport({ name: "fixture.json", size: 1 }, actor), { data: previewResult() });
  assert.deepEqual(await project.exportAssets(1, { sensitiveMode: "desensitized" }, actor), { data: packageArtifact() });
  await assert.rejects(() => project.previewImport({ size: 1 }, actor), (error) => error?.code === "PROJECT_REQUEST_INVALID" && error.statusCode === 400);
});

test("project input schemas reject missing fields and illegal codes, statuses, roles, and import options before IO", async () => {
  let invoked = 0;
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const projectOperations = Object.fromEntries([
    "create", "update", "setStatus", "upsertMember", "importAssets", "exportAssets",
  ].map((name) => [name, async () => { invoked += 1; return {}; }]));
  const project = createProjectCapabilities({ projectOperations }).project;
  const invalidCalls = [
    () => project.create({ projectCode: "valid_code" }, actor),
    () => project.create({ projectName: "Valid Name" }, actor),
    () => project.create(validProjectBody({ projectCode: "Invalid-Code" }), actor),
    () => project.update(1, { projectCode: "valid_code" }, actor),
    () => project.setStatus(1, "disabled", actor),
    () => project.upsertMember(1, { userId: 9, projectRole: "administrator" }, actor),
    () => project.upsertMember(1, { userId: 9, status: "disabled" }, actor),
    () => project.importAssets({ name: "fixture.json", size: 1 }, { mode: "replace" }, actor),
    () => project.importAssets({ name: "fixture.json", size: 1 }, { mode: "overwrite" }, actor),
    () => project.importAssets({ name: "fixture.json", size: 1 }, { mode: "new", targetProjectCode: "Invalid-Code" }, actor),
    () => project.exportAssets(1, { sensitiveMode: "plain-text" }, actor),
  ];
  for (const call of invalidCalls) {
    await assert.rejects(call, (error) => error?.code === "PROJECT_REQUEST_INVALID" && error.statusCode === 400 && error.retryable === false);
  }
  assert.equal(invoked, 0);
});

test("each project operation applies its own result schema instead of accepting empty records or malformed lists", async () => {
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const malformedByOperation = {
    detail: [{ ...projectRecord() }, [1, actor]],
    create: [{ ...projectRecord(), id: "1" }, [validProjectBody(), actor]],
    update: [{ ...projectRecord(), status: "disabled" }, [1, validProjectBody(), actor]],
    remove: [{ projectId: 1 }, [1, actor]],
    setStatus: [{ ...projectRecord(), status: "disabled" }, [1, "active", actor]],
    upsertMember: [{ ...memberRecord(), projectRole: "administrator" }, [1, { userId: 9 }, actor]],
    removeMember: [{ projectId: 1 }, [1, 9, actor]],
    listTransferLogs: [[{}], [{ projectId: 1 }, actor]],
    previewImport: [{ warnings: [] }, [{ name: "fixture.json", size: 1 }, actor]],
    importAssets: [{ projectId: 1, summary: {} }, [{ name: "fixture.json", size: 1 }, { mode: "new" }, actor]],
    listBackups: [[{}], [1, actor]],
    createBackup: [{ id: 2, projectId: 1 }, [1, actor]],
    downloadBackup: [{ manifest: {} }, [1, 2, actor]],
    exportAssets: [{ manifest: {} }, [1, {}, actor]],
  };
  for (const [name, [malformed, args]] of Object.entries(malformedByOperation)) {
    const project = createProjectCapabilities({ projectOperations: { [name]: async () => malformed } }).project;
    await assert.rejects(() => project[name](...args), (error) => error?.code === "PROJECT_PORT_INVALID_RESULT" && error.statusCode === 502, name);
  }
});

test("port errors are reconstructed from a public whitelist and recursively redact details", async () => {
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const failure = new Error("driver password=hunter2");
  failure.code = "PROJECT_DRIVER_FAILURE";
  failure.statusCode = 418;
  failure.retryable = true;
  failure.password = "hunter2";
  failure.details = { password: "hunter2", nested: { accessToken: "token-value" }, host: "private-host" };
  const unknownProject = new Error("raw storage failure");
  unknownProject.code = "PROJECT_NOT_FOUND";
  unknownProject.statusCode = 500;
  unknownProject.retryable = true;
  unknownProject.details = { resource: "backup", backupId: 2, password: "hidden", nested: { token: "hidden" } };
  const project = createProjectCapabilities({ projectOperations: {
    detail: async () => { throw failure; },
    downloadBackup: async () => { throw unknownProject; },
  } }).project;

  await assert.rejects(() => project.detail(1, actor), (error) => {
    assert.deepEqual({ message: error.message, code: error.code, statusCode: error.statusCode, retryable: error.retryable, details: error.details }, {
      message: "项目空间操作失败", code: "PROJECT_OPERATION_FAILED", statusCode: 500, retryable: false, details: {},
    });
    assert.equal(JSON.stringify(error).includes("hunter2"), false);
    return true;
  });
  await assert.rejects(() => project.downloadBackup(1, 2, actor), (error) => {
    assert.deepEqual({ message: error.message, code: error.code, statusCode: error.statusCode, retryable: error.retryable, details: error.details }, {
      message: "项目空间资源不存在", code: "PROJECT_NOT_FOUND", statusCode: 404, retryable: false, details: { resource: "backup", backupId: 2 },
    });
    assert.equal(JSON.stringify(error.details).includes("hidden"), false);
    return true;
  });
});

test("strict public DTO serialization converts dates and rejects secret keys, buffers, and cycles", async () => {
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const date = new Date(timestamp);
  const serializedProject = projectRecord({
    createdAt: date,
    updatedAt: date,
  });
  const withSecret = projectRecord({ resourceConfig: { password: "hidden" } });
  const withBuffer = projectRecord({ resourceConfig: { bytes: Buffer.from("unsafe") } });
  const cyclicConfig = {};
  cyclicConfig.self = cyclicConfig;
  const withCycle = projectRecord({ resourceConfig: cyclicConfig });

  const success = createProjectCapabilities({ projectOperations: { create: async () => serializedProject } }).project;
  assert.deepEqual(await success.create(validProjectBody(), actor), { data: projectRecord({
    createdAt: timestamp,
    updatedAt: timestamp,
  }) });
  for (const value of [withSecret, withBuffer, withCycle]) {
    const project = createProjectCapabilities({ projectOperations: { create: async () => value } }).project;
    await assert.rejects(() => project.create(validProjectBody(), actor), (error) => {
      assert.equal(error.code, "PROJECT_PORT_INVALID_RESULT");
      assert.equal(error.statusCode, 502);
      assert.equal(error.retryable, false);
      assert.equal(error.message, "项目空间返回结果无效");
      return true;
    });
  }
});
