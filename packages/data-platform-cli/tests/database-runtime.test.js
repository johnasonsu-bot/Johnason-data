const assert = require("node:assert/strict");
const test = require("node:test");

const { createProfileDatabaseRuntime } = require("../src/runtime/database");

test("CLI database runtime reads the password only from keychain and does not retain it in the profile", () => {
  const profile = Object.freeze({
    name: "production",
    db: Object.freeze({ host: "db.internal", port: 3307, database: "platform", user: "operator", timezone: "+00:00" }),
  });
  const calls = [];
  const keychain = {
    getDatabasePassword(name) {
      calls.push(name);
      return "keychain-only-password";
    },
  };
  const runtime = { pool: {}, testConnection: async () => {}, close: async () => {} };
  const result = createProfileDatabaseRuntime(profile, keychain, { mysql: true }, {
    createDatabaseRuntime(config, mysqlImpl) {
      calls.push({ config, mysqlImpl });
      return runtime;
    },
  });

  assert.equal(result, runtime);
  assert.deepEqual(calls, ["production", {
    config: {
      host: "db.internal",
      port: 3307,
      database: "platform",
      user: "operator",
      timezone: "+00:00",
      password: "keychain-only-password",
    },
    mysqlImpl: { mysql: true },
  }]);
  assert.equal("password" in profile.db, false);
  assert.equal(JSON.stringify(profile).includes("keychain-only-password"), false);
});

test("CLI database runtime rejects unavailable keychain passwords before creating a pool", () => {
  let createCalls = 0;

  assert.throws(
    () => createProfileDatabaseRuntime({
      name: "dev",
      db: { host: "localhost", port: 3306, database: "platform", user: "root" },
    }, { getDatabasePassword: () => null }, { mysql: true }, {
      createDatabaseRuntime() {
        createCalls += 1;
      },
    }),
    /database password.*keychain/i,
  );

  assert.equal(createCalls, 0);
});
