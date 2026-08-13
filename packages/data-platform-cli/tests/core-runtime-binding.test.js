const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createCliDataPlatformCore,
  createCliRuntimeDependencies,
} = require("../src/main");

function profile() {
  return Object.freeze({
    name: "production",
    db: Object.freeze({ host: "db.internal", port: 3307, database: "platform", user: "operator", timezone: "+00:00" }),
    dataxHome: "/opt/datax",
    kafkaBootstrapServers: Object.freeze(["kafka.internal:9092"]),
    currentProjectId: 42,
  });
}

test("CLI builds aggregate runtime dependencies from its selected profile and system keychain", () => {
  const calls = [];
  const databaseRuntime = Object.freeze({ pool: {}, async testConnection() {}, async close() {} });
  const corePackage = {
    createDatabaseRuntime(config, mysqlImpl) {
      calls.push({ config, mysqlImpl });
      return databaseRuntime;
    },
  };
  const keychain = {
    getDatabasePassword(name) {
      calls.push(["database", name]);
      return "keychain-db-value";
    },
    getSessionToken(name) {
      calls.push(["session", name]);
      return "keychain-session-value";
    },
  };
  const mysqlImpl = { createPool() {} };

  const dependencies = createCliRuntimeDependencies({ profile: profile(), keychain, mysqlImpl, corePackage });

  assert.equal(dependencies.databaseRuntime, databaseRuntime);
  assert.deepEqual(dependencies.session, { token: "keychain-session-value" });
  assert.deepEqual(dependencies.profile, {
    name: "production",
    dataxHome: "/opt/datax",
    kafkaBootstrapServers: ["kafka.internal:9092"],
    currentProjectId: 42,
  });
  assert.deepEqual(calls, [
    ["database", "production"],
    {
      config: {
        host: "db.internal",
        port: 3307,
        database: "platform",
        user: "operator",
        timezone: "+00:00",
        password: "keychain-db-value",
      },
      mysqlImpl,
    },
    ["session", "production"],
  ]);
  assert.equal(JSON.stringify(profile()).includes("keychain-db-value"), false);
});

test("CLI creates its application core only through the aggregate package", () => {
  const expectedCore = Object.freeze({ execute() {} });
  const corePackage = {
    createDatabaseRuntime() {
      return { pool: {}, async testConnection() {}, async close() {} };
    },
    createDataPlatformCore(dependencies) {
      assert.equal(dependencies.session.token, "session-value");
      return expectedCore;
    },
  };
  const result = createCliDataPlatformCore({
    profile: profile(),
    keychain: {
      getDatabasePassword() { return "db-value"; },
      getSessionToken() { return "session-value"; },
    },
    mysqlImpl: {},
    corePackage,
  });
  assert.equal(result, expectedCore);
});

test("CLI supplies its packaged MySQL driver when a caller does not inject one", () => {
  let receivedMysql;
  createCliRuntimeDependencies({
    profile: profile(),
    keychain: {
      getDatabasePassword() { return "fixture-database-passphrase"; },
      getSessionToken() { return null; },
    },
    corePackage: {
      createDatabaseRuntime(_config, mysqlImpl) {
        receivedMysql = mysqlImpl;
        return { pool: {}, async testConnection() {}, async close() {} };
      },
    },
  });
  assert.equal(typeof receivedMysql.createPool, "function");
});

test("CLI can construct the real aggregate without Web-only authentication ports", () => {
  const corePackage = require("@johnason/data-platform-core");
  const pool = {
    async getConnection() { return { release() {} }; },
    async end() {},
  };
  const core = createCliDataPlatformCore({
    profile: profile(),
    keychain: {
      getDatabasePassword() { return "fixture-database-passphrase"; },
      getSessionToken() { return "fixture-session-token"; },
    },
    mysqlImpl: { createPool() { return pool; } },
    corePackage,
  });

  assert.equal(typeof core.execute, "function");
  assert.deepEqual(core.moduleVersions, { auth: "0.2.0", "project-spaces": "0.2.0" });
});

test("CLI exposes explicit runtime-port injection for real aggregate auth and project execution", async () => {
  const corePackage = require("@johnason/data-platform-core");
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
  const token = "fixture-session-token";
  const core = createCliDataPlatformCore({
    profile: profile(),
    keychain: {
      getDatabasePassword() { return "fixture-database-passphrase"; },
      getSessionToken() { return token; },
    },
    mysqlImpl: { createPool() { return { async getConnection() {}, async end() {} }; } },
    corePackage,
    runtimePorts: {
      auth: {
        authRepository: { async findByUsername() { return user; }, async findProfileById() { return user; } },
        sessionRepository: {
          async createSession() {},
          async findActiveSession() { return { id: "session-1", userId: 7, status: "active", expiresAt: new Date("2026-08-14T00:00:00.000Z") }; },
          async touchSession() {},
          async revokeSession() {},
        },
        jwtCodec: { sign() { return token; }, decode() { return { sub: 7 }; }, verify() { return { sub: 7, sessionId: "session-1" }; } },
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
    },
  });

  assert.deepEqual(await core.execute("auth.profile", { userId: 7, token }, {}), {
    user: {
      id: 7, sub: 7, username: "operator", displayName: "Operator", roleId: 1,
      roleCode: "admin", roleType: "admin", roleName: "Administrator",
      defaultProjectId: null, permissions: { modules: ["system_projects"] },
    },
  });
  assert.deepEqual(await core.execute("project.list-my", {}, { actor: user }), []);
});
