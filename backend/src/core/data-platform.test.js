const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createProjectOperations,
  createWebDataPlatformCore,
  createWebRuntimeDependencies,
  toArtifactDto,
} = require("./data-platform");

test("Web adapter converts Multer metadata to a transport-neutral artifact DTO", () => {
  const multerFile = {
    fieldname: "file",
    originalname: "project-assets.json",
    encoding: "7bit",
    mimetype: "application/json",
    destination: "/tmp/uploads",
    filename: "random-name",
    path: "/tmp/uploads/random-name",
    size: 418,
    buffer: Buffer.from("must-not-cross-boundary"),
  };
  assert.deepEqual(toArtifactDto(multerFile), {
    name: "project-assets.json",
    size: 418,
    mediaType: "application/json",
    path: "/tmp/uploads/random-name",
  });
});

test("Web project operation adapter reads neutral artifacts before invoking legacy import behavior", async () => {
  const calls = [];
  const payload = { manifest: {} };
  const operations = createProjectOperations({
    projectService: {},
    assetService: {
      async readPackageFile(file) { calls.push(["read", file]); return payload; },
      async previewImport(value) { calls.push(["preview", value]); return { tableCount: 0 }; },
      async importProject(value, options, actor) { calls.push(["import", value, options, actor]); return { projectId: 9 }; },
    },
  });
  const artifact = Object.freeze({ name: "assets.json", size: 8, mediaType: "application/json", path: "/tmp/assets.json" });
  const actor = { sub: 7 };

  assert.deepEqual(await operations.previewImport(artifact), { tableCount: 0 });
  assert.deepEqual(await operations.importAssets(artifact, { mode: "new" }, actor), { projectId: 9 });
  assert.deepEqual(calls, [
    ["read", artifact],
    ["preview", payload],
    ["read", artifact],
    ["import", payload, { mode: "new" }, actor],
  ]);
});

test("Web constructs environment-backed dependencies and gives them only to the aggregate factory", () => {
  const databaseRuntime = { pool: {}, async testConnection() {}, async close() {} };
  const projectOperations = {};
  const runtimeDependencies = createWebRuntimeDependencies({
    databaseRuntime,
    projectOperations,
    env: { jwtSecret: "runtime-only-secret", jwtExpiresIn: "4h" },
    jwtImpl: {
      sign(payload, secret, options) { return JSON.stringify({ payload, secret, options }); },
      decode() { return { sub: 7 }; },
      verify(token, secret) { return { token, secret }; },
    },
    passwordHasher: { async compare() { return true; } },
    clock: { now() { return new Date("2026-08-13T00:00:00.000Z"); } },
    idGenerator() { return "id-1"; },
    errorFactory(message, statusCode) { return Object.assign(new Error(message), { statusCode }); },
  });
  assert.equal(runtimeDependencies.databaseRuntime, databaseRuntime);
  assert.equal(runtimeDependencies.project.projectOperations, projectOperations);
  assert.deepEqual(runtimeDependencies.auth.jwtCodec.verify("token"), { token: "token", secret: "runtime-only-secret" });

  const expected = {};
  const corePackage = {
    createDataPlatformCore(actual) {
      assert.equal(actual, runtimeDependencies);
      return expected;
    },
  };
  assert.equal(createWebDataPlatformCore({ corePackage, runtimeDependencies }), expected);
});
