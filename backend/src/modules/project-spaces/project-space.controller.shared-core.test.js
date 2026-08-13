const assert = require("node:assert/strict");
const test = require("node:test");

const { createProjectSpaceController } = require("./project-space.controller");

function response() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    send(body) { this.body = body; return this; },
  };
}

test("project preview controller passes only a neutral artifact DTO through the aggregate capability", async () => {
  const calls = [];
  const controller = createProjectSpaceController({
    getCore() {
      return {
        async execute(capabilityId, input, context) {
          calls.push({ capabilityId, input, context });
          return { data: { tableCount: 0 } };
        },
      };
    },
  });
  const req = {
    file: {
      originalname: "project.json",
      size: 12,
      mimetype: "application/json",
      path: "/tmp/project.json",
      destination: "/tmp",
      buffer: Buffer.from("private"),
    },
    user: { sub: 7, permissions: { modules: ["system_projects"] } },
    project: { id: 9 },
    projectId: 9,
  };
  const res = response();

  await controller.previewProjectAssetImport(req, res);

  assert.deepEqual(calls, [{
    capabilityId: "project.preview-import",
    input: {
      file: {
        name: "project.json",
        size: 12,
        mediaType: "application/json",
        path: "/tmp/project.json",
      },
    },
    context: { actor: req.user, project: req.project, projectId: 9 },
  }]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: { tableCount: 0 }, meta: undefined });
});

test("project Web controller preserves list metadata, mutation statuses, and aggregate mappings", async () => {
  const calls = [];
  const results = {
    "project.list-my": [{ id: 1 }],
    "project.current": 1,
    "project.detail": { data: { id: 2, members: [] } },
    "project.create": { data: { id: 3 } },
    "project.update": { data: { id: 2 } },
    "project.set-status": { data: { id: 2, status: "disabled" } },
    "project.set-default": { defaultProjectId: 2 },
    "project.upsert-member": { data: { projectId: 2, userId: 8 } },
    "project.remove-member": { data: { success: true } },
    "project.remove": { data: { success: true } },
    "project.create-backup": { data: { id: 11 } },
    "project.list-backups": { data: [{ id: 11 }] },
    "project.list-transfer-logs": { data: [{ id: 12 }] },
  };
  const controller = createProjectSpaceController({
    getCore() {
      return {
        async execute(capabilityId, input, context) {
          calls.push({ capabilityId, input, context });
          return results[capabilityId];
        },
      };
    },
  });
  const base = {
    user: { sub: 7, permissions: { modules: ["system_projects"] } },
    project: { id: 2 },
    projectId: 2,
    params: { id: "2", userId: "8" },
    query: { projectId: "2" },
    validatedBody: { projectName: "Updated" },
  };

  const listResponse = response();
  await controller.listMyProjects(base, listResponse);
  assert.deepEqual(listResponse.body, { success: true, data: [{ id: 1 }], meta: { total: 1, defaultProjectId: 1 } });

  const cases = [
    ["getProjectDetail", "project.detail", { projectId: 2 }, 200],
    ["createProject", "project.create", { body: base.validatedBody }, 201],
    ["updateProject", "project.update", { projectId: 2, body: base.validatedBody }, 200],
    ["updateProjectStatus", "project.set-status", { projectId: 2, status: "disabled" }, 200, { validatedBody: { status: "disabled" } }],
    ["setDefaultProject", "project.set-default", { projectId: 2 }, 200],
    ["upsertProjectMember", "project.upsert-member", { projectId: 2, body: base.validatedBody }, 200],
    ["removeProjectMember", "project.remove-member", { projectId: 2, userId: 8 }, 200],
    ["deleteProject", "project.remove", { projectId: 2 }, 200],
    ["createProjectAssetBackup", "project.create-backup", { projectId: 2 }, 201],
    ["listProjectAssetBackups", "project.list-backups", { projectId: 2 }, 200],
    ["listProjectAssetTransferLogs", "project.list-transfer-logs", { projectId: 2 }, 200],
  ];
  for (const [method, capabilityId, input, statusCode, requestOverride = {}] of cases) {
    const res = response();
    await controller[method]({ ...base, ...requestOverride }, res);
    assert.equal(res.statusCode, statusCode, method);
    assert.deepEqual(calls.at(-1).capabilityId, capabilityId, method);
    assert.deepEqual(calls.at(-1).input, input, method);
  }

  assert.deepEqual(responseFor(calls, "project.list-my").context, { actor: base.user, project: base.project, projectId: 2 });
});

test("project Web controller preserves import/export and backup download transport responses", async () => {
  const calls = [];
  const artifact = { manifest: { sourceProject: { code: "OPS" } }, tables: [] };
  const controller = createProjectSpaceController({
    getCore() {
      return {
        async execute(capabilityId, input) {
          calls.push({ capabilityId, input });
          if (capabilityId === "project.import-assets") return { data: { projectId: 9 } };
          return { data: artifact };
        },
      };
    },
  });
  const req = {
    user: { sub: 7 }, project: { id: 2 }, projectId: 2,
    params: { id: "2", backupId: "11" }, query: { modules: "all" },
    body: { mode: "new", targetProjectId: "9", targetProjectName: "Imported", targetProjectCode: "IMPORTED" },
    file: { originalname: "assets.json", size: 12, mimetype: "application/json", path: "/tmp/assets.json", buffer: Buffer.from("private") },
    get(name) { return name === "x-project-package-key" ? "fixture-package-key" : ""; },
  };

  const importResponse = response();
  await controller.importProjectAssets(req, importResponse);
  assert.equal(importResponse.statusCode, 201);
  assert.deepEqual(calls[0], {
    capabilityId: "project.import-assets",
    input: {
      file: { name: "assets.json", size: 12, mediaType: "application/json", path: "/tmp/assets.json" },
      options: { mode: "new", targetProjectId: 9, targetProjectName: "Imported", targetProjectCode: "IMPORTED", packageKey: "fixture-package-key" },
    },
  });

  const exportResponse = response();
  await controller.exportProjectAssets(req, exportResponse);
  assert.equal(exportResponse.statusCode, 200);
  assert.equal(exportResponse.headers["Content-Type"], "application/json; charset=utf-8");
  assert.match(exportResponse.headers["Content-Disposition"], /^attachment; filename="OPS-assets-\d+\.medata-project\.json"$/);
  assert.deepEqual(JSON.parse(exportResponse.body), artifact);

  const downloadResponse = response();
  await controller.downloadProjectAssetBackup(req, downloadResponse);
  assert.equal(downloadResponse.statusCode, 200);
  assert.equal(downloadResponse.headers["Content-Disposition"], 'attachment; filename="OPS-backup-11.medata-project.json"');
  assert.deepEqual(JSON.parse(downloadResponse.body), artifact);
});

function responseFor(calls, capabilityId) {
  return calls.find((call) => call.capabilityId === capabilityId);
}
