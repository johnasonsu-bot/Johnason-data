const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { resolveCliPaths } = require("../src/runtime/paths");
const { createProfileStore } = require("../src/runtime/profile-store");

function createStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-profile-"));
  const configFile = path.join(root, "nested", "config.json");
  return { root, configFile, store: createProfileStore({ configFile, fsImpl: fs }) };
}

function profile(name = "dev", overrides = {}) {
  return {
    name,
    db: {
      host: "127.0.0.1",
      port: 3306,
      database: "data_platform",
      user: "operator",
      timezone: "+08:00",
    },
    ...overrides,
  };
}

test("resolves the macOS application support config path", () => {
  assert.equal(
    resolveCliPaths({ platform: "darwin", homeDir: "/u", env: {} }).configFile,
    "/u/Library/Application Support/data-platform-cli/config.json",
  );
});

test("resolves the Linux XDG config path", () => {
  assert.equal(
    resolveCliPaths({ platform: "linux", homeDir: "/u", env: { XDG_CONFIG_HOME: "/cfg" } }).configFile,
    "/cfg/data-platform-cli/config.json",
  );
});

test("persists profile state atomically with mode 0600", (t) => {
  const { root, configFile, store } = createStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  store.add(profile());
  assert.equal(fs.statSync(configFile).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(`${configFile}.tmp`), false);
  assert.equal(store.get("dev").db.database, "data_platform");
});

test("rejects recursively nested secret fields", (t) => {
  const { root, store } = createStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(
    () => store.add(profile("dev", { metadata: { apiKey: "must-not-persist" } })),
    /secret fields are forbidden/i,
  );
});

test("rejects duplicate profile names", (t) => {
  const { root, store } = createStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  store.add(profile());
  assert.throws(() => store.add(profile()), /already exists/i);
});

test("rejects invalid database ports", (t) => {
  const { root, store } = createStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => store.add(profile("dev", { db: { ...profile().db, port: 70000 } })), /port/i);
});

test("accepts secret-free PostgreSQL, Oracle, and DM profile connection contracts", () => {
  const { profileSchema } = require("../src/runtime/profile-store");
  assert.equal(profileSchema.parse({ name: "test-postgresql", db: { engine: "postgresql", host: "db", port: 5432, database: "platform", user: "cli" } }).db.engine, "postgresql");
  assert.equal(profileSchema.parse({ name: "test-oracle", db: { engine: "oracle", host: "db", port: 1521, user: "cli", serviceName: "service", schema: "APP" } }).db.serviceName, "service");
  assert.equal(profileSchema.parse({ name: "test-dm", db: { engine: "dm", host: "db", port: 5236, user: "cli", jdbcUrl: "jdbc:dm://db:5236/APP" } }).db.engine, "dm");
  assert.throws(() => profileSchema.parse({ name: "unsafe", db: { engine: "dm", host: "db", port: 5236, user: "cli", jdbcUrl: "jdbc:dm://cli:password@db:5236/APP" } }), /secret/i);
});

test("selects an existing profile and lists deterministic names", (t) => {
  const { root, store } = createStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  store.add(profile("zeta"));
  store.add(profile("alpha"));
  store.use("alpha");
  assert.equal(store.current().name, "alpha");
  assert.deepEqual(store.list().map((item) => item.name), ["alpha", "zeta"]);
});

test("refuses to select a missing profile", (t) => {
  const { root, store } = createStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => store.use("missing"), /not found/i);
});

test("removing the current profile clears selection and supports project selection", (t) => {
  const { root, store } = createStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  store.add(profile());
  store.use("dev");
  store.setCurrentProject("dev", 42);
  assert.equal(store.current().currentProjectId, 42);
  store.remove("dev");
  assert.equal(store.current(), null);
  assert.deepEqual(store.list(), []);
});
