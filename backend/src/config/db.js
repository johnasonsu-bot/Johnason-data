const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "123456",
  database: process.env.DB_NAME || "medata",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  const connection = await pool.getConnection();
  connection.release();
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      source_name VARCHAR(128) NOT NULL,
      source_code VARCHAR(64) NOT NULL UNIQUE,
      source_type VARCHAR(32) NOT NULL,
      connection_config JSON NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_by VARCHAR(64) DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingestion_jobs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      job_name VARCHAR(128) NOT NULL,
      job_code VARCHAR(64) NOT NULL UNIQUE,
      source_id BIGINT NOT NULL,
      schedule_type VARCHAR(32) NOT NULL DEFAULT 'manual',
      cron_expression VARCHAR(64) NULL,
      sync_mode VARCHAR(16) NOT NULL DEFAULT 'full',
      target_table VARCHAR(128) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      last_run_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_ingestion_source FOREIGN KEY (source_id) REFERENCES data_sources(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS processing_jobs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      job_name VARCHAR(128) NOT NULL,
      job_code VARCHAR(64) NOT NULL UNIQUE,
      input_source VARCHAR(128) NOT NULL,
      output_target VARCHAR(128) NOT NULL,
      process_type VARCHAR(32) NOT NULL DEFAULT 'etl',
      process_config JSON NULL,
      schedule_type VARCHAR(32) NOT NULL DEFAULT 'manual',
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      last_run_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_apis (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      service_name VARCHAR(128) NOT NULL,
      service_code VARCHAR(64) NOT NULL UNIQUE,
      service_path VARCHAR(255) NOT NULL UNIQUE,
      request_method VARCHAR(16) NOT NULL DEFAULT 'GET',
      data_domain VARCHAR(64) NOT NULL,
      auth_type VARCHAR(32) NOT NULL DEFAULT 'token',
      status VARCHAR(16) NOT NULL DEFAULT 'offline',
      description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await pool.query(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    ["admin"]
  );

  if (rows.length === 0) {
    const passwordHash = await bcrypt.hash("Admin@123", 10);
    await pool.query(
      "INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)",
      ["admin", passwordHash, "系统管理员"]
    );
  }
}

module.exports = {
  pool,
  testConnection,
  initDatabase
};
