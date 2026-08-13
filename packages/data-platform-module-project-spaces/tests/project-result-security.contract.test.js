const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createProjectCapabilities } = require("../src");

const timestamp = "2026-08-13T00:00:00.000Z";
const actor = { sub: 7, roleCode: "admin", permissions: { modules: ["system_projects"] } };

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
    resourceConfig: { maxDataSources: 2, maxConcurrentTasks: 1, schedulerEnabled: true },
    settings: { defaultStoragePath: "/runtime/projects/one" },
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

function previewResult(overrides = {}) {
  return {
    sourceProject: { id: 1, code: "project_one", name: "Project One", type: "standard" },
    exportedAt: timestamp,
    sensitiveMode: "encrypted",
    packageVersion: "3.0.0",
    sourcePackageVersion: "3.0.0",
    integrityVerified: true,
    warnings: [],
    coverage: { configurationAssets: true, projectRuntimeFiles: true, externalPhysicalData: false, sensitiveConfiguration: "encrypted" },
    modules: [],
    tableCount: 0,
    rowCount: 0,
    runtimeFileCount: 0,
    databaseTypes: [],
    tables: [],
    ...overrides,
  };
}

function importResult(overrides = {}) {
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
    ...overrides,
  };
}

function transferLog(overrides = {}) {
  return {
    id: 4,
    projectId: 1,
    operationType: "export",
    packageVersion: "3.0.0",
    modules: [],
    status: "success",
    summary: { tableCount: 0, rowCount: 0, runtimeFileCount: 0, warnings: [] },
    errorMessage: null,
    operatorName: "admin",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function integrityFor(payload) {
  const withoutIntegrity = { ...payload, manifest: { ...payload.manifest } };
  delete withoutIntegrity.manifest.integrity;
  return {
    algorithm: "sha256",
    payloadSha256: sha256(withoutIntegrity),
    tables: payload.tables.map((table) => ({
      tableName: table.tableName,
      rowCount: table.rows.length,
      sha256: sha256({ tableName: table.tableName, columns: table.columns, rows: table.rows }),
    })),
  };
}

function encryptedValue(seed) {
  return {
    __medataEncrypted: true,
    ivBase64: Buffer.from(`iv-${seed}`).toString("base64"),
    authTagBase64: Buffer.from(`tag-${seed}`).toString("base64"),
    ciphertextBase64: Buffer.from(`cipher-${seed}`).toString("base64"),
  };
}

function encryptedArtifact(extraTopLevel = {}) {
  const payload = {
    manifest: {
      exportFormatVersion: "3.0.0",
      appVersion: "2.0.0",
      packageType: "medata-project-assets",
      exportedAt: timestamp,
      exportedBy: "admin",
      sensitiveMode: "encrypted",
      sensitiveEncryption: {
        algorithm: "aes-256-gcm",
        keyDerivation: "pbkdf2-sha256",
        iterations: 200000,
        saltBase64: Buffer.from("fixture-salt").toString("base64"),
      },
      sourceProject: { id: 1, code: "project_one", name: "Project One", type: "standard" },
      modules: [{ moduleKey: "dataSources", moduleName: "数据源", tableCount: 1, rowCount: 1 }],
      compatibility: { minimumImportVersion: "2.0.0", supportedLegacyVersions: ["1.0.0", "2.0.0"] },
      coverage: { configurationAssets: true, projectRuntimeFiles: true, externalPhysicalData: false, sensitiveConfiguration: "encrypted" },
    },
    project: {
      projectName: "Project One",
      projectCode: "project_one",
      projectType: "standard",
      description: "Project description",
      ownerName: "Admin",
      status: "active",
      resourceConfig: {},
      settings: {},
    },
    schema: { importOrder: ["data_sources"], foreignKeys: [] },
    references: { users: [], modelProviders: [] },
    tables: [{
      tableName: "data_sources",
      moduleKey: "dataSources",
      columns: ["id", "password", "config_json"],
      rows: [{ id: 1, password: encryptedValue("password"), config_json: { apiKey: encryptedValue("api-key") } }],
    }],
    files: [],
    ...extraTopLevel,
  };
  payload.manifest.integrity = integrityFor(payload);
  return payload;
}

function dateArtifact() {
  const nestedTimestamp = "2026-08-13T01:02:03.456Z";
  const payload = encryptedArtifact();
  payload.manifest.exportedAt = new Date(timestamp);
  payload.manifest.sensitiveMode = "desensitized";
  payload.manifest.coverage.sensitiveConfiguration = "desensitized";
  delete payload.manifest.sensitiveEncryption;
  payload.project.resourceConfig = { maxDataSources: 2 };
  payload.project.settings = { synchronization: { lastCompletedAt: new Date(nestedTimestamp) } };
  payload.tables[0].columns = ["id", "observedAt", "metadata"];
  payload.tables[0].rows = [{
    id: 1,
    observedAt: new Date(timestamp),
    metadata: { lastSeenAt: new Date(nestedTimestamp) },
  }];
  payload.manifest.integrity = {
    algorithm: "sha256",
    payloadSha256: "222606908516217bfdb2b9fd49e2f17c6531153982f0c415a461bd46b6b08b75",
    tables: [{
      tableName: "data_sources",
      rowCount: 1,
      sha256: "97f0e5b3f787aedf9aa7abc6fb83355e9630e35001a62014cbf6cd4136978fdd",
    }],
  };
  return payload;
}

function canonicalDateArtifact() {
  const nestedTimestamp = "2026-08-13T01:02:03.456Z";
  const payload = dateArtifact();
  payload.manifest.exportedAt = timestamp;
  payload.project.settings.synchronization.lastCompletedAt = nestedTimestamp;
  payload.tables[0].rows[0].observedAt = timestamp;
  payload.tables[0].rows[0].metadata.lastSeenAt = nestedTimestamp;
  return payload;
}

function expectInvalidResult(call) {
  return assert.rejects(call, (error) => error?.code === "PROJECT_PORT_INVALID_RESULT" && error.statusCode === 502 && error.retryable === false);
}

test("ordinary project operation results reject unknown top-level and nested DTO fields", async () => {
  const validBody = { projectName: "Project One", projectCode: "project_one" };
  const cases = {
    detail: [{ ...projectRecord(), members: [], rawConnectionString: "not-a-connection" }, [1, actor]],
    create: [{ ...projectRecord(), ssn: "not-an-identifier" }, [validBody, actor]],
    update: [projectRecord({ resourceConfig: { maxDataSources: 2, privateEndpoint: "private.example.invalid" } }), [1, validBody, actor]],
    remove: [{ projectId: 1, deleted: true, ssn: "not-an-identifier" }, [1, actor]],
    setStatus: [{ ...projectRecord(), privateEndpoint: "private.example.invalid" }, [1, "active", actor]],
    upsertMember: [memberRecord({ permissions: { modules: [], ssn: "not-an-identifier" } }), [1, { userId: 9 }, actor]],
    removeMember: [{ projectId: 1, userId: 9, rawConnectionString: "not-a-connection" }, [1, 9, actor]],
    listTransferLogs: [[transferLog({ summary: { tableCount: 0, privateEndpoint: "private.example.invalid" } })], [{ projectId: 1 }, actor]],
    previewImport: [previewResult({ coverage: { configurationAssets: true, projectRuntimeFiles: true, externalPhysicalData: false, privateEndpoint: "private.example.invalid" } }), [{ name: "fixture.json" }, actor]],
    importAssets: [importResult({ summary: { ...importResult().summary, integrity: { ...importResult().summary.integrity, ssn: "not-an-identifier" } } }), [{ name: "fixture.json" }, { mode: "new" }, actor]],
    listBackups: [[{ id: 2, projectId: 1, packageVersion: "3.0.0", packageSha256: null, createdBy: "admin", createdAt: timestamp, ssn: "not-an-identifier" }], [1, actor]],
    createBackup: [{ id: 2, projectId: 1, packageVersion: "3.0.0", packageSha256: null, createdAt: timestamp, privateEndpoint: "private.example.invalid" }, [1, actor]],
  };
  for (const [name, [result, args]] of Object.entries(cases)) {
    const project = createProjectCapabilities({ projectOperations: { [name]: async () => result } }).project;
    await expectInvalidResult(() => project[name](...args));
  }
});

test("service-backed project results also reject unknown fields instead of bypassing DTO parsers", async () => {
  const invalidProject = { ...projectRecord(), rawConnectionString: "not-a-connection" };
  const projectService = {
    async listMyProjects() { return [invalidProject]; },
    async listProjects() { return [invalidProject]; },
    async getUserDefaultProjectId() { return "1"; },
    async resolveRequestProject() { return { project: invalidProject, member: { projectId: 1, userId: 7, projectRole: "owner", status: "active" } }; },
    async setDefaultProject() { return { defaultProjectId: 1, project: invalidProject }; },
  };
  const project = createProjectCapabilities({ projectService }).project;
  const calls = [
    () => project.listMy(actor),
    () => project.list(actor),
    () => project.current(actor),
    () => project.resolve(actor, 1),
    () => project.use(actor, 1),
    () => project.accessCheck(actor, 1),
    () => project.setDefault(1, actor),
  ];
  for (const call of calls) await expectInvalidResult(call);
});

test("export and download preserve an encrypted artifact byte-for-byte and retain verifiable integrity", async () => {
  const artifact = encryptedArtifact();
  const project = createProjectCapabilities({ projectOperations: {
    exportAssets: async () => artifact,
    downloadBackup: async () => artifact,
  } }).project;
  for (const call of [
    () => project.exportAssets(1, { sensitiveMode: "encrypted" }, actor),
    () => project.downloadBackup(1, 2, actor),
  ]) {
    const result = await call();
    assert.deepEqual(result.data, artifact);
    assert.deepEqual(integrityFor(result.data), result.data.manifest.integrity);
    assert.equal(result.data.tables[0].rows[0].password.__medataEncrypted, true);
    assert.equal(result.data.tables[0].rows[0].config_json.apiKey.__medataEncrypted, true);
  }
});

test("export and download canonicalize Date artifacts before backend-compatible integrity verification", async () => {
  for (const operation of ["exportAssets", "downloadBackup"]) {
    const project = createProjectCapabilities({ projectOperations: {
      [operation]: async () => dateArtifact(),
    } }).project;
    const result = operation === "exportAssets"
      ? await project.exportAssets(1, { sensitiveMode: "desensitized" }, actor)
      : await project.downloadBackup(1, 2, actor);
    assert.deepEqual(result.data, canonicalDateArtifact());
    assert.deepEqual(integrityFor(result.data), result.data.manifest.integrity);
  }
});

test("Date artifact canonicalization retains Buffer and cycle rejection", async () => {
  const withBuffer = encryptedArtifact();
  withBuffer.tables[0].rows[0].config_json = Buffer.from("unsafe");
  withBuffer.manifest.integrity = integrityFor(withBuffer);

  const withCycle = encryptedArtifact();
  withCycle.manifest.exportFormatVersion = "1.0.0";
  delete withCycle.manifest.integrity;
  withCycle.project.settings.self = withCycle.project.settings;

  for (const artifact of [withBuffer, withCycle]) {
    const project = createProjectCapabilities({ projectOperations: { exportAssets: async () => artifact } }).project;
    await expectInvalidResult(() => project.exportAssets(1, { sensitiveMode: "encrypted" }, actor));
  }
});

test("artifact schemas preserve backend-valid empty sensitive values without post-integrity rewrites", async () => {
  const artifact = encryptedArtifact();
  artifact.tables[0].rows[0].password = "";
  artifact.manifest.integrity = integrityFor(artifact);
  const project = createProjectCapabilities({ projectOperations: { exportAssets: async () => artifact } }).project;
  assert.deepEqual((await project.exportAssets(1, { sensitiveMode: "encrypted" }, actor)).data, artifact);
});

test("artifact schemas preserve legacy user-reference shape without synthesizing post-integrity fields", async () => {
  const artifact = encryptedArtifact();
  artifact.references.users = [{ id: 7, username: "admin", displayName: "Admin" }];
  artifact.manifest.integrity = integrityFor(artifact);
  const project = createProjectCapabilities({ projectOperations: { downloadBackup: async () => artifact } }).project;
  assert.deepEqual((await project.downloadBackup(1, 2, actor)).data, artifact);
});

test("artifact schemas reject extra top-level secret, connection, and private endpoint fields even with matching integrity", async () => {
  for (const field of ["apiKey", "rawConnectionString", "privateEndpoint"]) {
    const artifact = encryptedArtifact({ [field]: "not-a-real-value" });
    const project = createProjectCapabilities({ projectOperations: { exportAssets: async () => artifact } }).project;
    await expectInvalidResult(() => project.exportAssets(1, { sensitiveMode: "encrypted" }, actor));
  }
});

test("artifact schemas report malformed version metadata as a stable invalid-result error", async () => {
  const artifact = encryptedArtifact();
  delete artifact.manifest.compatibility.supportedLegacyVersions;
  artifact.manifest.integrity = integrityFor(artifact);
  const project = createProjectCapabilities({ projectOperations: { exportAssets: async () => artifact } }).project;
  await expectInvalidResult(() => project.exportAssets(1, { sensitiveMode: "encrypted" }, actor));
});

test("artifact schemas inspect JSON text and reject plaintext secret values before preserving the payload", async () => {
  const artifact = encryptedArtifact();
  artifact.manifest.sensitiveMode = "desensitized";
  artifact.manifest.coverage.sensitiveConfiguration = "desensitized";
  delete artifact.manifest.sensitiveEncryption;
  artifact.tables[0].rows[0].password = null;
  artifact.tables[0].rows[0].config_json = JSON.stringify({ apiKey: "LEAK_MARKER" });
  artifact.manifest.integrity = integrityFor(artifact);
  const project = createProjectCapabilities({ projectOperations: { downloadBackup: async () => artifact } }).project;
  await expectInvalidResult(() => project.downloadBackup(1, 2, actor));
});

test("public error detail schemas omit actual and unsafe URI, bearer, and key-like string values", async () => {
  function portError(code, details) {
    const error = new Error("untrusted port message");
    error.code = code;
    error.details = details;
    return error;
  }
  const invalidProject = createProjectCapabilities({ projectOperations: {
    detail: async () => { throw portError("PROJECT_OPERATION_INVALID", {
      field: "mode",
      supported: ["new", "overwrite", "api_key=LEAK_MARKER"],
      actual: "mysql://user:LEAK_MARKER@private.example.invalid/data",
    }); },
  } }).project;
  await assert.rejects(() => invalidProject.detail(1, actor), (error) => {
    assert.deepEqual(error.details, { field: "mode", supported: ["new", "overwrite"] });
    assert.equal(JSON.stringify(error.details).includes("LEAK_MARKER"), false);
    return true;
  });

  const missingProject = createProjectCapabilities({ projectOperations: {
    detail: async () => { throw portError("PROJECT_NOT_FOUND", { resource: "mysql://user:LEAK_MARKER@host/data", projectId: 1 }); },
  } }).project;
  await assert.rejects(() => missingProject.detail(1, actor), (error) => {
    assert.deepEqual(error.details, { projectId: 1 });
    return true;
  });

  const conflictProject = createProjectCapabilities({ projectOperations: {
    detail: async () => { throw portError("PROJECT_CONFLICT", { field: "Bearer LEAK_MARKER", projectId: 1 }); },
  } }).project;
  await assert.rejects(() => conflictProject.detail(1, actor), (error) => {
    assert.deepEqual(error.details, { projectId: 1 });
    return true;
  });
});
