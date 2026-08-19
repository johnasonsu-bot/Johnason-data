const mysql = require("mysql2/promise");
const { createDatabaseRuntime } = require("@johnason/data-platform-core-kernel");

function databaseError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireDriver(engine) {
  try {
    if (engine === "postgresql") return { driver: require("pg"), version: require("pg/package.json").version, name: "pg" };
    if (engine === "oracle") return { driver: require("oracledb"), version: require("oracledb/package.json").version, name: "oracledb" };
    if (engine === "dm") return { driver: require("dmdb"), version: require("dmdb/package.json").version, name: "dmdb" };
  } catch {
    throw databaseError("DATABASE_DRIVER_MISSING", `No installed ${engine} driver is available for this profile`);
  }
  throw databaseError("DATABASE_DRIVER_MISSING", `Unsupported database engine: ${engine}`);
}

function driverInfo(engine, driver, fallback) {
  const version = String(fallback.version || driver.version || "unknown");
  return Object.freeze({ engine, name: fallback.name, version, fingerprint: `${fallback.name}@${version}` });
}

function createLazyNativeRuntime(engine, profile, password, driver, info) {
  let pool;
  let closed = false;
  async function openPool() {
    if (pool) return pool;
    const config = { host: profile.db.host, port: profile.db.port, user: profile.db.user, password };
    if (engine === "postgresql") {
      pool = new driver.Pool({ ...config, database: profile.db.database });
      return pool;
    }
    if (engine === "oracle") {
      const service = profile.db.serviceName || profile.db.sid;
      const connectString = profile.db.sid
        ? `${profile.db.host}:${profile.db.port}:${service}`
        : `${profile.db.host}:${profile.db.port}/${service}`;
      pool = await driver.createPool({ ...config, connectString });
      return pool;
    }
    if (engine === "dm" && typeof driver.createPool === "function") {
      pool = await driver.createPool({ ...config, connectString: profile.db.jdbcUrl || `${profile.db.host}:${profile.db.port}/${profile.db.database}` });
      return pool;
    }
    throw databaseError("DATABASE_DRIVER_MISSING", `The installed ${engine} driver has no supported pool adapter`);
  }
  async function connection() {
    const opened = await openPool();
    if (typeof opened.connect === "function") return opened.connect();
    if (typeof opened.getConnection === "function") return opened.getConnection();
    throw databaseError("DATABASE_DRIVER_MISSING", `The installed ${engine} driver has no supported connection adapter`);
  }
  async function release(value) {
    const close = value?.release || value?.close;
    if (typeof close === "function") await close.call(value);
  }
  return Object.freeze({
    engine,
    driver: info,
    pool: null,
    async testConnection() {
      const value = await connection();
      try { return true; } finally { await release(value); }
    },
    async probe() {
      await this.testConnection();
      return Object.freeze({ engine, driver: info, connectionVerified: true });
    },
    async close() {
      if (closed) return;
      closed = true;
      if (!pool) return;
      const end = pool.end || pool.close;
      if (typeof end === "function") await end.call(pool);
    },
  });
}

function createProfileDatabaseRuntime(profile, keychain, drivers = mysql) {
  if (!profile?.db) throw new TypeError("profile.db is required");
  const password = keychain.getDatabasePassword(profile.name);
  if (!password) {
    const error = new Error(`Database password is missing for profile: ${profile.name}`);
    error.code = "DATABASE_PASSWORD_MISSING";
    throw error;
  }
  const engine = profile.db.engine || "mysql";
  if (engine === "mysql") {
    const mysqlImpl = typeof drivers.createPool === "function" ? drivers : (drivers.mysql || mysql);
    const runtime = createDatabaseRuntime({
      ...profile.db,
      password,
      timezone: profile.db.timezone || "+08:00",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      namedPlaceholders: true,
    }, mysqlImpl);
    const version = require("mysql2/package.json").version;
    const info = Object.freeze({ engine, name: "mysql2", version, fingerprint: `mysql2@${version}` });
    return Object.freeze({
      ...runtime,
      engine,
      driver: info,
      async probe() {
        await runtime.testConnection();
        return Object.freeze({ engine, driver: info, connectionVerified: true });
      },
    });
  }
  const configured = drivers[engine] ? { driver: drivers[engine], name: engine, version: drivers[engine].version } : requireDriver(engine);
  return createLazyNativeRuntime(engine, profile, password, configured.driver, driverInfo(engine, configured.driver, configured));
}

module.exports = { createProfileDatabaseRuntime, requireDriver };
