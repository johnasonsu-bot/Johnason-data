const hive = require("hive-driver");
const { resolveDatasourceConnection } = require("../common/utils/datasource-dialect");

const DEFAULT_HIVE_HOST = process.env.HIVE_HOST || "hive";
const DEFAULT_HIVE_PORT = Number(process.env.HIVE_PORT || 10000);
const DEFAULT_HIVE_TIMEOUT_MS = Number(process.env.HIVE_TIMEOUT_MS || 300000);

function normalizeConnectionConfig(config = {}) {
  const source = config.connectionConfig || config;
  const resolved = resolveDatasourceConnection(source.sourceType || "hive", source);
  return {
    host: resolved.host || source.host || DEFAULT_HIVE_HOST,
    port: Number(resolved.port || source.port || DEFAULT_HIVE_PORT),
    database: resolved.database || source.database || "default",
    username: resolved.username || source.username || "hive",
    password: resolved.password || source.password || "hive",
    authType: String(source.authType || source.auth || source.authentication || "plain").toLowerCase()
  };
}

function escapeHiveIdentifier(identifier) {
  return String(identifier || "")
    .split(".")
    .filter(Boolean)
    .map((part) => `\`${String(part).replace(/`/g, "``")}\``)
    .join(".");
}

function normalizeHiveType(value) {
  const normalized = String(value || "string").trim().toLowerCase();

  if (!normalized) {
    return "STRING";
  }
  if (normalized.includes("bigint")) {
    return "BIGINT";
  }
  if (normalized.includes("smallint") || normalized.includes("tinyint") || normalized === "int" || normalized.includes("integer")) {
    return "INT";
  }
  if (normalized.includes("double")) {
    return "DOUBLE";
  }
  if (normalized.includes("float")) {
    return "FLOAT";
  }
  if (normalized.includes("boolean")) {
    return "BOOLEAN";
  }
  if (normalized.includes("timestamp")) {
    return "TIMESTAMP";
  }
  if (normalized === "date") {
    return "DATE";
  }
  if (normalized.startsWith("decimal") || normalized.startsWith("numeric")) {
    const match = normalized.match(/\(([^)]+)\)/);
    return match ? `DECIMAL(${match[1]})` : "DECIMAL(18,2)";
  }

  return "STRING";
}

function escapeHiveComment(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildCreateTableSql(database, tableName, columns, options = {}) {
  const fileType = typeof options === "string" ? options : options.fileType || "parquet";
  const columnSql = columns.map((column) => {
    const comment = String(column.columnComment || "").trim();
    return `  ${escapeHiveIdentifier(column.columnName)} ${normalizeHiveType(column.dataType || column.columnType)}${comment ? ` COMMENT '${escapeHiveComment(comment)}'` : ""}`;
  });
  const storageSql = String(fileType || "parquet").toLowerCase() === "text"
    ? "ROW FORMAT DELIMITED FIELDS TERMINATED BY '\\t' STORED AS TEXTFILE"
    : "STORED AS PARQUET";
  const tableComment = typeof options === "object" && options.tableComment
    ? `COMMENT '${escapeHiveComment(options.tableComment)}' `
    : "";

  return [
    `CREATE DATABASE IF NOT EXISTS ${escapeHiveIdentifier(database)};`,
    `USE ${escapeHiveIdentifier(database)};`,
    `CREATE TABLE IF NOT EXISTS ${escapeHiveIdentifier(tableName)} (`,
    columnSql.join(",\n"),
    `) ${tableComment}${storageSql};`
  ].join("\n");
}

function buildJdbcUrl(config) {
  return `jdbc:hive2://${config.host}:${config.port}/${config.database}`;
}

function splitHiveStatements(sqlText) {
  const statements = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (const char of String(sqlText || "")) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      current += char;
      quote = char;
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

function withTimeout(promise, timeoutMs, label) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`${label}超时`));
    }, timeoutMs);

    promise.then((value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function createHiveClient(config) {
  const { TCLIService, TCLIService_types } = hive.thrift;
  const connection = new hive.connections.TcpConnection();
  const authProvider = config.authType === "none" || config.authType === "nosasl"
    ? new hive.auth.NoSaslAuthentication()
    : new hive.auth.PlainTcpAuthentication({
        username: config.username,
        password: config.password
      });
  const client = new hive.HiveClient(TCLIService, TCLIService_types);

  return {
    client,
    connect: () => client.connect({
      host: config.host,
      port: Number(config.port),
      options: {
        username: config.username,
        password: config.password,
        connect_timeout: DEFAULT_HIVE_TIMEOUT_MS,
        timeout: DEFAULT_HIVE_TIMEOUT_MS
      }
    }, connection, authProvider)
  };
}

async function executeHiveStatement(session, utils, statement) {
  const operation = await session.executeStatement(statement, { runAsync: true });
  try {
    await utils.waitUntilReady(operation, false);
    await utils.fetchAll(operation);
    return utils.getResult(operation).getValue();
  } finally {
    await operation.close().catch(() => {});
  }
}

async function runHiveSql(sqlText, connectionConfig = {}) {
  const config = normalizeConnectionConfig(connectionConfig);
  const statements = splitHiveStatements(sqlText);
  const { TCLIService_types } = hive.thrift;
  const utils = new hive.HiveUtils(TCLIService_types);
  const hiveClient = createHiveClient(config);
  let connectedClient = null;
  let session = null;
  const rows = [];

  try {
    connectedClient = await withTimeout(hiveClient.connect(), DEFAULT_HIVE_TIMEOUT_MS, "Hive 客户端连接");
    session = await connectedClient.openSession({
      client_protocol: TCLIService_types.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V10
    });

    for (const statement of statements) {
      const result = await withTimeout(
        executeHiveStatement(session, utils, statement),
        DEFAULT_HIVE_TIMEOUT_MS,
        "Hive SQL 执行"
      );
      if (Array.isArray(result) && result.length > 0) {
        rows.push(...result);
      }
    }

    return {
      stdout: rows.map((row) => JSON.stringify(row)).join("\n"),
      stderr: "",
      rows
    };
  } catch (error) {
    throw new Error(`Hive SQL 执行失败：${error.message}`);
  } finally {
    if (session) {
      await session.close().catch(() => {});
    }
    if (connectedClient) {
      connectedClient.close();
    }
  }
}

async function tableExists(connectionConfig, tableName) {
  const config = normalizeConnectionConfig(connectionConfig);
  const sql = [
    `USE ${escapeHiveIdentifier(config.database)};`,
    `SHOW TABLES LIKE '${String(tableName || "").replace(/'/g, "\\'")}';`
  ].join("\n");
  const result = await runHiveSql(sql, config);
  return result.stdout.includes(tableName) || result.rows?.some((row) => Object.values(row).some((value) => String(value) === String(tableName)));
}

async function ensureTableExists(connectionConfig, tableName, columns, options = {}) {
  const config = normalizeConnectionConfig(connectionConfig);
  const sql = buildCreateTableSql(config.database, tableName, columns, options);
  await runHiveSql(sql, config);
  return { tableName, database: config.database, created: true };
}

function buildHiveValueLiteral(value, dataType) {
  const hiveType = normalizeHiveType(dataType);

  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  if (["INT", "BIGINT", "FLOAT", "DOUBLE"].includes(hiveType)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : "NULL";
  }

  if (hiveType.startsWith("DECIMAL")) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : "NULL";
  }

  if (hiveType === "BOOLEAN") {
    return value ? "TRUE" : "FALSE";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

async function loadRows(connectionConfig, tableName, columns, rows, options = {}) {
  const config = normalizeConnectionConfig(connectionConfig);
  const writeMode = String(options.writeMode || "append").toLowerCase();
  const fileType = String(options.fileType || "parquet").toLowerCase();
  const targetColumns = columns.map((column) => ({
    columnName: column.columnName,
    dataType: column.dataType || column.columnType || "string"
  }));

  await ensureTableExists(config, tableName, targetColumns, { fileType });

  if (!Array.isArray(rows) || rows.length === 0) {
    if (writeMode === "overwrite") {
      await runHiveSql(
        [
          `USE ${escapeHiveIdentifier(config.database)};`,
          `TRUNCATE TABLE ${escapeHiveIdentifier(tableName)};`
        ].join("\n"),
        config
      );
    }

    return {
      rowCount: 0,
      writeMode
    };
  }

  const batchSize = Number(options.batchSize || 200);
  const batches = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize));
  }

  const statements = [`USE ${escapeHiveIdentifier(config.database)};`];
  batches.forEach((batch, index) => {
    const modeSql = writeMode === "overwrite" && index === 0 ? "INSERT OVERWRITE TABLE" : "INSERT INTO TABLE";
    const valuesSql = batch
      .map((row) => {
        const values = targetColumns.map((column) => buildHiveValueLiteral(row[column.columnName], column.dataType));
        return `(${values.join(", ")})`;
      })
      .join(",\n");
    statements.push(`${modeSql} ${escapeHiveIdentifier(tableName)} VALUES\n${valuesSql};`);
  });

  await runHiveSql(statements.join("\n"), config);

  return {
    rowCount: rows.length,
    writeMode
  };
}

module.exports = {
  normalizeConnectionConfig,
  tableExists,
  ensureTableExists,
  loadRows,
  runHiveSql
};
