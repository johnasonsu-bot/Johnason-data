const assert = require("node:assert/strict");
const test = require("node:test");
const { createProjectCapabilities, moduleManifest } = require("../src");

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
    detail: { id: 1 }, create: { id: 1 }, update: { id: 1 }, remove: { projectId: 1, deleted: true }, setStatus: { id: 1, status: "active" },
    upsertMember: { projectId: 1, userId: 9 }, removeMember: { projectId: 1, userId: 9 }, listTransferLogs: [], previewImport: { valid: true, warnings: [] },
    importAssets: { projectId: 1, summary: {} }, listBackups: [], createBackup: { id: 2, projectId: 1 }, downloadBackup: { manifest: {} }, exportAssets: { manifest: {} },
  };
  const projectOperations = Object.fromEntries(Object.values(apiToCapability).filter((name) => !["listMy", "list", "setDefault"].includes(name)).map((name) => [name, async (...args) => { calls.push({ name, args }); return resultFor[name]; }]));
  const repository = {
    async ensureDefaultProject() { return { id: 1, status: "active" }; }, async getProjectMember() { return { status: "active" }; }, async ensureUserMembership() {},
    async listUserProjects() { return [{ id: 1, status: "active" }]; }, async listProjects() { return [{ id: 1, status: "active" }]; },
    async getUserDefaultProjectId() { return 1; }, async getProjectById(id) { return { id: Number(id), status: "active" }; }, async setUserDefaultProject() { return true; },
  };
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["data_map", "system_projects"] } };
  const project = createProjectCapabilities({ projectRepository: repository, projectOperations }).project;
  const argumentsFor = {
    listMy: [actor], list: [actor], listTransferLogs: [{ projectId: 1 }, actor], previewImport: [{ originalname: "fixture.json", size: 1 }, actor],
    importAssets: [{ originalname: "fixture.json", size: 1 }, { mode: "new" }, actor], create: [{ projectCode: "new" }, actor], listBackups: [1, actor],
    createBackup: [1, actor], downloadBackup: [1, 2, actor], exportAssets: [1, { format: "full" }, actor], detail: [1, actor],
    update: [1, { projectCode: "edited" }, actor], remove: [1, actor], setDefault: [1, actor], setStatus: [1, "active", actor],
    upsertMember: [1, { userId: 9 }, actor], removeMember: [1, 9, actor],
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
    async ensureDefaultProject() { return { id: 1, status: "active" }; }, async getProjectMember() { return { status: "active" }; }, async ensureUserMembership() {},
    async listUserProjects() { return [{ id: 1, status: "active" }]; }, async listProjects() { return [{ id: 1, status: "active" }]; },
    async getUserDefaultProjectId() { return 1; }, async getProjectById(id) { return { id: Number(id), status: "active" }; }, async setUserDefaultProject() { return true; },
  };
  const port = { detail: async () => ({ id: 1 }), previewImport: async () => { calls.push("previewImport"); return { valid: true }; } };
  const project = createProjectCapabilities({ projectRepository: repository, projectOperations: port }).project;
  const systemOnly = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const dataMapOnly = { sub: 8, roleCode: "admin", permissions: { modules: ["data_map"] } };
  const viewer = { sub: 9, roleCode: "viewer", permissions: { modules: ["system_projects"] } };

  assert.deepEqual(await project.listMy(dataMapOnly), [{ id: 1, status: "active" }]);
  assert.deepEqual(await project.detail(1, systemOnly), { data: { id: 1 } });
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
    detail: async (...args) => { calls.push(["detail", args]); return { id: 1, internal: "removed" }; },
    create: async () => { const error = new Error("duplicate"); error.code = "CONFLICT"; throw error; },
    previewImport: async (...args) => { calls.push(["previewImport", args]); return { valid: true, warnings: [] }; },
    exportAssets: async () => ({ manifest: { version: "1" } }),
  };
  const project = createProjectCapabilities({ projectOperations: port }).project;
  await assert.rejects(() => project.detail("bad", actor), (error) => error?.code === "PROJECT_REQUEST_INVALID" && error.statusCode === 400);
  assert.deepEqual(calls, []);
  await assert.rejects(() => project.create({}, actor), (error) => error?.code === "PROJECT_REQUEST_INVALID" && error.statusCode === 400);
  await assert.rejects(() => project.create({ projectCode: "new" }, actor), (error) => error?.code === "PROJECT_CONFLICT" && error.statusCode === 409);
  assert.deepEqual(await project.detail(1, actor), { data: { id: 1 } });
  assert.deepEqual(await project.previewImport({ originalname: "fixture.json", size: 1 }, actor), { data: { valid: true, warnings: [] } });
  assert.deepEqual(await project.exportAssets(1, { format: "full" }, actor), { data: { manifest: { version: "1" } } });
  await assert.rejects(() => project.previewImport({ size: 1 }, actor), (error) => error?.code === "PROJECT_REQUEST_INVALID" && error.statusCode === 400);
});

test("each project port category rejects malformed successful results instead of accepting arbitrary stubs", async () => {
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };
  const inputs = {
    detail: [1, actor], create: [{ projectCode: "new" }, actor], update: [1, { projectCode: "new" }, actor], remove: [1, actor],
    setStatus: [1, "active", actor], upsertMember: [1, { userId: 9 }, actor], removeMember: [1, 9, actor],
    importAssets: [{ originalname: "fixture.json", size: 1 }, { mode: "new" }, actor], listBackups: [1, actor], createBackup: [1, actor],
    downloadBackup: [1, 2, actor], exportAssets: [1, { format: "full" }, actor],
  };
  for (const [name, args] of Object.entries(inputs)) {
    const project = createProjectCapabilities({ projectOperations: { [name]: async () => null } }).project;
    await assert.rejects(() => project[name](...args), (error) => error?.code === "PROJECT_PORT_INVALID_RESULT" && error.statusCode === 502, name);
  }
});
