const mysql = require("mysql2/promise");
const env = require("./env");
const { setDefaultDatabaseRuntime } = require("@johnason/data-platform-core-kernel");

const pool = mysql.createPool({
  ...env.db,
  timezone: env.db.timezone || "+08:00",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
});

async function testConnection() {
  const connection = await pool.getConnection();
  connection.release();
}

setDefaultDatabaseRuntime({ pool, testConnection, close: () => pool.end() });

module.exports = {
  pool,
  testConnection,
};
