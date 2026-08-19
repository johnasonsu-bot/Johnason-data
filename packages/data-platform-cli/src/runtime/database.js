const mysql = require("mysql2/promise");
const { createDatabaseRuntime } = require("@johnason/data-platform-core-kernel");

function createProfileDatabaseRuntime(profile, keychain, mysqlImpl = mysql) {
  if (!profile?.db) throw new TypeError("profile.db is required");
  const password = keychain.getDatabasePassword(profile.name);
  if (!password) {
    const error = new Error(`Database password is missing for profile: ${profile.name}`);
    error.code = "DATABASE_PASSWORD_MISSING";
    throw error;
  }
  return createDatabaseRuntime({
    ...profile.db,
    password,
    timezone: profile.db.timezone || "+08:00",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
  }, mysqlImpl);
}

module.exports = { createProfileDatabaseRuntime };
