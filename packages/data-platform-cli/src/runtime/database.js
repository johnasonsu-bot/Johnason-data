function createProfileDatabaseRuntime(profile, keychain, mysqlImpl, runtimePort) {
  if (!profile || typeof profile !== "object" || !profile.db || typeof profile.db !== "object") {
    throw new TypeError("Profile with database settings is required");
  }
  if (typeof profile.name !== "string" || profile.name.length === 0) throw new TypeError("Profile name is required");
  if (!keychain || typeof keychain.getDatabasePassword !== "function") throw new TypeError("Keychain must expose getDatabasePassword");
  if (!runtimePort || typeof runtimePort.createDatabaseRuntime !== "function") {
    throw new TypeError("Database runtime port must expose createDatabaseRuntime");
  }

  const password = keychain.getDatabasePassword(profile.name);
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Database password is unavailable from the system keychain");
  }

  return runtimePort.createDatabaseRuntime({
    ...profile.db,
    password,
    timezone: profile.db.timezone || "+08:00",
  }, mysqlImpl);
}

module.exports = { createProfileDatabaseRuntime };
