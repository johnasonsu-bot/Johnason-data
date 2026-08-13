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
  const projectOperations = Object.fromEntries(Object.values(apiToCapability).filter((name) => !["listMy", "list", "setDefault"].includes(name)).map((name) => [name, async (...args) => { calls.push({ name, args }); return { name, args }; }]));
  const repository = {
    async ensureDefaultProject() { return { id: 1, status: "active" }; }, async getProjectMember() { return { status: "active" }; }, async ensureUserMembership() {},
    async listUserProjects() { return [{ id: 1, status: "active" }]; }, async listProjects() { return [{ id: 1, status: "active" }]; },
    async getUserDefaultProjectId() { return 1; }, async getProjectById(id) { return { id: Number(id), status: "active" }; }, async setUserDefaultProject() { return true; },
  };
  const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["data_map", "system_projects"] } };
  const project = createProjectCapabilities({ projectRepository: repository, projectOperations }).project;
  const argumentsFor = {
    listMy: [actor], list: [actor], listTransferLogs: [{ projectId: 1 }, actor], previewImport: [{ file: "fixture" }, actor],
    importAssets: [{ file: "fixture" }, { mode: "new" }, actor], create: [{ projectCode: "new" }, actor], listBackups: [1, actor],
    createBackup: [1, actor], downloadBackup: [1, 2, actor], exportAssets: [1, { format: "full" }, actor], detail: [1, actor],
    update: [1, { projectCode: "edited" }, actor], remove: [1, actor], setDefault: [1, actor], setStatus: [1, "active", actor],
    upsertMember: [1, { userId: 9 }, actor], removeMember: [1, 9, actor],
  };
  for (const [apiKey, capability] of Object.entries(apiToCapability)) {
    const args = argumentsFor[capability];
    await project[capability](...args);
    if (!["listMy", "list", "setDefault"].includes(capability)) {
      assert.equal(calls.at(-1).name, capability, apiKey);
      assert.deepEqual(calls.at(-1).args, args, `${apiKey} preserves transport inputs for its semantic operation`);
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
    () => project.remove(1, { sub: 8, roleCode: "viewer", permissions: { modules: ["data_map"] } }),
    (error) => error && error.code === "READ_ONLY_FORBIDDEN" && error.statusCode === 403,
  );
  assert.equal(invoked, false);
});
