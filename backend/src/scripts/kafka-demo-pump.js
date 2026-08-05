const { promisify } = require("util");
const { execFile } = require("child_process");
const mysql = require("mysql2/promise");
const hiveService = require("../services/hiveService");

const execFileAsync = promisify(execFile);
const KAFKA_CONTAINER = process.env.KAFKA_CONTAINER_NAME || "medata-kafka";
const TOPIC = process.env.KAFKA_TOPIC || "medata_demo_events";
const MYSQL_TABLE = process.env.MYSQL_TARGET_TABLE || "kafka_demo_events_sink";
const HIVE_TABLE = process.env.HIVE_TARGET_TABLE || "kafka_demo_events_sink";
const MAX_MESSAGES = Number(process.env.KAFKA_MAX_MESSAGES || 20);
const MYSQL_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "123456",
  database: process.env.DB_NAME || "medata"
};

async function runDocker(args, timeout = 120000) {
  const { stdout, stderr } = await execFileAsync("docker", args, {
    windowsHide: true,
    timeout,
    maxBuffer: 1024 * 1024 * 16
  });

  return {
    stdout: String(stdout || ""),
    stderr: String(stderr || "")
  };
}

async function readKafkaMessages() {
  const { stdout } = await runDocker([
    "exec",
    KAFKA_CONTAINER,
    "/opt/kafka/bin/kafka-console-consumer.sh",
    "--bootstrap-server",
    "localhost:9092",
    "--topic",
    TOPIC,
    "--from-beginning",
    "--timeout-ms",
    "3000",
    "--max-messages",
    String(MAX_MESSAGES)
  ], 30000);

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function ensureMysqlTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${MYSQL_TABLE}\` (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_name VARCHAR(64) NOT NULL,
      user_id BIGINT NULL,
      city VARCHAR(64) NULL,
      raw_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function loadIntoMySql(messages) {
  const connection = await mysql.createConnection(MYSQL_CONFIG);
  try {
    await ensureMysqlTable(connection);
    await connection.query(`TRUNCATE TABLE \`${MYSQL_TABLE}\``);

    if (messages.length === 0) {
      return 0;
    }

    const sql = `
      INSERT INTO \`${MYSQL_TABLE}\` (event_name, user_id, city, raw_json)
      VALUES ?
    `;
    const values = messages.map((item) => [
      String(item.event || ""),
      item.userId ?? null,
      item.city ?? null,
      JSON.stringify(item)
    ]);
    await connection.query(sql, [values]);
    return messages.length;
  } finally {
    await connection.end();
  }
}

async function loadIntoHive(messages) {
  const rows = messages.map((item) => ({
    event_name: String(item.event || ""),
    user_id: item.userId ?? null,
    city: item.city ?? null,
    raw_json: JSON.stringify(item)
  }));

  await hiveService.loadRows(
    {
      host: "127.0.0.1",
      port: 10001,
      database: "default",
      username: "hive",
      password: "hive"
    },
    HIVE_TABLE,
    [
      { columnName: "event_name", dataType: "string" },
      { columnName: "user_id", dataType: "bigint" },
      { columnName: "city", dataType: "string" },
      { columnName: "raw_json", dataType: "string" }
    ],
    rows,
    {
      writeMode: "overwrite",
      fileType: "parquet"
    }
  );

  return rows.length;
}

async function main() {
  const messages = await readKafkaMessages();
  const mysqlCount = await loadIntoMySql(messages);
  const hiveCount = await loadIntoHive(messages);

  process.stdout.write(
    JSON.stringify(
      {
        topic: TOPIC,
        mysqlTable: MYSQL_TABLE,
        hiveTable: HIVE_TABLE,
        messageCount: messages.length,
        mysqlCount,
        hiveCount
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
