const test = require("node:test");
const assert = require("node:assert/strict");

const { createKeychain } = require("../src/runtime/keychain");

class FakeEntry {
  static values = new Map();

  constructor(service, account) {
    this.key = `${service}/${account}`;
  }

  setPassword(value) {
    FakeEntry.values.set(this.key, value);
  }

  getPassword() {
    return FakeEntry.values.get(this.key) ?? null;
  }

  deletePassword() {
    return FakeEntry.values.delete(this.key);
  }
}

test.beforeEach(() => FakeEntry.values.clear());

test("namespaces database and session secrets per profile", () => {
  const keychain = createKeychain({ EntryClass: FakeEntry });
  keychain.setDatabasePassword("dev", "db-pass");
  keychain.setSessionToken("dev", "jwt");
  keychain.setRuntimeSigningSecret("dev", "signing-secret");
  assert.equal(FakeEntry.values.get("data-platform-cli/profile:dev:database-password"), "db-pass");
  assert.equal(FakeEntry.values.get("data-platform-cli/profile:dev:session-token"), "jwt");
  assert.equal(FakeEntry.values.get("data-platform-cli/profile:dev:runtime-signing-secret"), "signing-secret");
});

test("reads database and session values without exposing account internals", () => {
  const keychain = createKeychain({ EntryClass: FakeEntry, serviceName: "custom-service" });
  keychain.setDatabasePassword("prod", "db-pass");
  keychain.setSessionToken("prod", "signed-token");
  assert.equal(keychain.getDatabasePassword("prod"), "db-pass");
  assert.equal(keychain.getSessionToken("prod"), "signed-token");
});

test("deletes each secret independently", () => {
  const keychain = createKeychain({ EntryClass: FakeEntry });
  keychain.setDatabasePassword("dev", "db-pass");
  keychain.setSessionToken("dev", "jwt");
  assert.equal(keychain.deleteDatabasePassword("dev"), true);
  assert.equal(keychain.getDatabasePassword("dev"), null);
  assert.equal(keychain.getSessionToken("dev"), "jwt");
  assert.equal(keychain.deleteSessionToken("dev"), true);
});

test("returns null for a missing secret", () => {
  const keychain = createKeychain({ EntryClass: FakeEntry });
  assert.equal(keychain.getDatabasePassword("missing"), null);
  assert.equal(keychain.getSessionToken("missing"), null);
});

test("rejects empty profile names and secret values", () => {
  const keychain = createKeychain({ EntryClass: FakeEntry });
  assert.throws(() => keychain.setDatabasePassword("", "value"), /profile/i);
  assert.throws(() => keychain.setSessionToken("dev", ""), /secret value/i);
});

test("fails closed when native keyring is unavailable", () => {
  assert.throws(
    () => createKeychain({ EntryClass: null }),
    (error) => error.code === "KEYCHAIN_UNAVAILABLE" && /system keychain unavailable/i.test(error.message),
  );
});

test("redacts native failures and offers no filesystem fallback", () => {
  class ThrowingEntry {
    constructor() {}
    getPassword() {
      throw new Error("native failure leaked-account leaked-secret");
    }
  }
  const keychain = createKeychain({ EntryClass: ThrowingEntry, fallbackFile: "/tmp/plaintext" });
  assert.equal("fallbackFile" in keychain, false);
  assert.throws(
    () => keychain.getSessionToken("dev"),
    (error) => error.code === "KEYCHAIN_UNAVAILABLE"
      && !error.message.includes("leaked-account")
      && !error.message.includes("leaked-secret"),
  );
});
