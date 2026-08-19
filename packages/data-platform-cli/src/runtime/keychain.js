class KeychainError extends Error {
  constructor(message = "System keychain unavailable") {
    super(message);
    this.name = "KeychainError";
    this.code = "KEYCHAIN_UNAVAILABLE";
    this.statusCode = 503;
    this.retryable = false;
  }
}

function defaultEntryClass() {
  try {
    return require("@napi-rs/keyring").Entry;
  } catch {
    throw new KeychainError();
  }
}

function createKeychain(options = {}) {
  const EntryClass = options.EntryClass === undefined ? defaultEntryClass() : options.EntryClass;
  const serviceName = options.serviceName || "data-platform-cli";
  if (typeof EntryClass !== "function") throw new KeychainError();

  function account(profile, kind) {
    if (typeof profile !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(profile)) {
      throw new TypeError("A valid profile name is required");
    }
    return `profile:${profile}:${kind}`;
  }

  function entry(profile, kind) {
    try {
      return new EntryClass(serviceName, account(profile, kind));
    } catch (error) {
      if (error instanceof TypeError) throw error;
      throw new KeychainError();
    }
  }

  function invoke(profile, kind, method, value) {
    try {
      const target = entry(profile, kind);
      return value === undefined ? target[method]() : target[method](value);
    } catch (error) {
      if (error instanceof TypeError || error instanceof KeychainError) throw error;
      throw new KeychainError();
    }
  }

  function assertValue(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError("Secret value must be a non-empty string");
    }
  }

  return Object.freeze({
    setDatabasePassword(profile, value) {
      assertValue(value);
      invoke(profile, "database-password", "setPassword", value);
    },
    getDatabasePassword(profile) {
      return invoke(profile, "database-password", "getPassword") ?? null;
    },
    deleteDatabasePassword(profile) {
      return Boolean(invoke(profile, "database-password", "deletePassword"));
    },
    setSessionToken(profile, value) {
      assertValue(value);
      invoke(profile, "session-token", "setPassword", value);
    },
    getSessionToken(profile) {
      return invoke(profile, "session-token", "getPassword") ?? null;
    },
    deleteSessionToken(profile) {
      return Boolean(invoke(profile, "session-token", "deletePassword"));
    },
    setRuntimeSigningSecret(profile, value) {
      assertValue(value);
      invoke(profile, "runtime-signing-secret", "setPassword", value);
    },
    getRuntimeSigningSecret(profile) {
      return invoke(profile, "runtime-signing-secret", "getPassword") ?? null;
    },
    deleteRuntimeSigningSecret(profile) {
      return Boolean(invoke(profile, "runtime-signing-secret", "deletePassword"));
    },
  });
}

function createLazyKeychain(options = {}) {
  let keychain;
  return new Proxy({}, {
    get(_target, property) {
      keychain ||= createKeychain(options);
      const value = keychain[property];
      return typeof value === "function" ? value.bind(keychain) : value;
    },
  });
}

module.exports = { createKeychain, createLazyKeychain, KeychainError };
