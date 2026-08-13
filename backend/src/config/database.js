const mysql = require("mysql2/promise");
const env = require("./env");

function webDatabaseConfig() {
  return {
    ...env.db,
    timezone: env.db.timezone || "+08:00",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
  };
}

function createWebDatabaseRuntime(runtimePort, mysqlImpl = mysql) {
  if (!runtimePort || typeof runtimePort.createDatabaseRuntime !== "function") {
    throw new TypeError("Database runtime port must expose createDatabaseRuntime");
  }
  return runtimePort.createDatabaseRuntime(webDatabaseConfig(), mysqlImpl);
}

const pool = mysql.createPool(webDatabaseConfig());

async function testConnection() {
  const connection = await pool.getConnection();
  connection.release();
}

module.exports = {
  pool,
  testConnection,
  createWebDatabaseRuntime,
};
