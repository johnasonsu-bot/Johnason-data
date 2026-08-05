const fs = require("fs");
const path = require("path");
const { getActiveDriverBinding } = require("./database-driver-store");

const DATABASE_CAPABILITIES = Object.freeze({
  mysql: Object.freeze({
    type: "mysql",
    label: "MySQL",
    aliases: Object.freeze(["mysql", "mariadb"]),
    defaultPort: 3306,
    driverClassName: "com.mysql.cj.jdbc.Driver",
    healthCheckSql: "SELECT 1 AS ok",
    dataxReader: "mysqlreader",
    dataxWriter: "mysqlwriter",
    nodePackage: "mysql2",
    capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true }),
  }),
  postgresql: Object.freeze({
    type: "postgresql",
    label: "PostgreSQL",
    aliases: Object.freeze(["postgresql", "postgres", "pg"]),
    defaultPort: 5432,
    driverClassName: "org.postgresql.Driver",
    healthCheckSql: "SELECT 1 AS ok",
    dataxReader: "postgresqlreader",
    dataxWriter: "postgresqlwriter",
    nodePackage: "pg",
    capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true }),
  }),
  oracle: Object.freeze({
    type: "oracle",
    label: "Oracle",
    aliases: Object.freeze(["oracle"]),
    defaultPort: 1521,
    driverClassName: "oracle.jdbc.OracleDriver",
    healthCheckSql: "SELECT 1 AS ok FROM DUAL",
    dataxReader: "oraclereader",
    dataxWriter: "oraclewriter",
    nodePackage: "oracledb",
    capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true }),
  }),
  dm: Object.freeze({
    type: "dm",
    label: "达梦数据库",
    aliases: Object.freeze(["dm", "dameng", "dmdb"]),
    defaultPort: 5236,
    driverClassName: "dm.jdbc.driver.DmDriver",
    healthCheckSql: "SELECT 1 AS ok FROM DUAL",
    dataxReader: "rdbmsreader",
    dataxWriter: "rdbmswriter",
    nodePackage: "dmdb",
    capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true }),
  }),
});

const DATABASE_ALIAS_MAP = Object.freeze(Object.fromEntries(
  Object.values(DATABASE_CAPABILITIES).flatMap((capability) =>
    capability.aliases.map((alias) => [alias, capability.type])
  )
));

function getRuntimeDatabaseCapabilityStatus() {
  const pluginRoot = path.resolve(__dirname, "../../../datax/plugin");
  const hasPlugin = (kind, name) => fs.existsSync(path.join(pluginRoot, kind, name, "plugin.json"));
  const hasJar = (kind, name, pattern) => {
    const libs = path.join(pluginRoot, kind, name, "libs");
    return fs.existsSync(libs) && fs.readdirSync(libs).some((fileName) => pattern.test(fileName));
  };
  return listDatabaseCapabilities().map((capability) => {
    let driverLoaded = false;
    try {
      require.resolve(capability.nodePackage);
      driverLoaded = true;
    } catch {
      driverLoaded = false;
    }
    const readerJarReady = capability.type === "oracle"
      ? hasJar("reader", capability.dataxReader, /^ojdbc.*\.jar$/i)
      : capability.type === "dm"
        ? hasJar("reader", capability.dataxReader, /^Dm.*JdbcDriver.*\.jar$/i)
        : true;
    const writerJarReady = capability.type === "oracle"
      ? hasJar("writer", capability.dataxWriter, /^ojdbc.*\.jar$/i)
      : capability.type === "dm"
        ? hasJar("writer", capability.dataxWriter, /^Dm.*JdbcDriver.*\.jar$/i)
        : true;
    const managedQueryDriver = getActiveDriverBinding(capability.type, "query");
    return {
      ...capability,
      driverLoaded,
      queryReady: driverLoaded || Boolean(managedQueryDriver),
      managedQueryDriver: managedQueryDriver ? {
        packageId: managedQueryDriver.packageId,
        version: managedQueryDriver.version,
        sha256: managedQueryDriver.sha256,
      } : null,
      dataxReaderReady: hasPlugin("reader", capability.dataxReader) && readerJarReady,
      dataxWriterReady: hasPlugin("writer", capability.dataxWriter) && writerJarReady,
    };
  });
}

function normalizeRegisteredDatabaseType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return DATABASE_ALIAS_MAP[normalized] || normalized;
}

function getDatabaseCapability(value) {
  return DATABASE_CAPABILITIES[normalizeRegisteredDatabaseType(value)] || null;
}

function listDatabaseCapabilities() {
  return Object.values(DATABASE_CAPABILITIES);
}

function isSupportedDatabaseType(value) {
  return Boolean(getDatabaseCapability(value));
}

module.exports = {
  DATABASE_CAPABILITIES,
  getDatabaseCapability,
  isSupportedDatabaseType,
  listDatabaseCapabilities,
  getRuntimeDatabaseCapabilityStatus,
  normalizeRegisteredDatabaseType,
};
