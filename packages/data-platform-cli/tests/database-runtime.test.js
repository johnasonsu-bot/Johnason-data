const test = require("node:test");
const assert = require("node:assert/strict");

const { createProfileDatabaseRuntime } = require("../src/runtime/database");

test("database password is read only from keychain", () => {
  const calls = [];
  const mysql = { createPool(config) { calls.push(config); return { end() {} }; } };
  const profile = { name: "dev", db: { host: "db", port: 3306, database: "platform", user: "cli" } };
  createProfileDatabaseRuntime(profile, { getDatabasePassword(name) { assert.equal(name, "dev"); return "secret"; } }, mysql);
  assert.equal(calls[0].password, "secret");
  assert.equal("password" in profile.db, false);
});

test("missing keychain password fails closed", () => {
  const profile = { name: "dev", db: { host: "db", port: 3306, database: "platform", user: "cli" } };
  assert.throws(
    () => createProfileDatabaseRuntime(profile, { getDatabasePassword() { return null; } }, { createPool() {} }),
    (error) => error.code === "DATABASE_PASSWORD_MISSING",
  );
});
