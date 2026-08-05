const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const env = require("../config/env");
const {
  buildJdbcUrl,
  inferDatasourceDialect,
  normalizeDatasourceType,
  normalizeJdbcUrlForDialect,
} = require("../common/utils/datasource-dialect");
const { materializeActiveDataXDrivers } = require("../common/utils/database-driver-store");

const DATA_X_HOME = env.dataxHome
  ? path.resolve(env.dataxHome)
  : path.resolve(__dirname, "../../datax");
const DATA_X_BIN = env.dataxBin
  ? path.resolve(env.dataxBin)
  : path.join(DATA_X_HOME, "bin", "datax.py");
const PYTHON_BIN = env.dataxPython || process.env.PYTHON || "python3";

const runningJobs = new Map();

function resolveTransferType(type, connection = {}) {
  const normalizedType = normalizeDatasourceType(type);
  const dialect = inferDatasourceDialect(normalizedType, connection || {});
  return dialect === "unknown" ? normalizedType : dialect;
}

function buildDataXJob(jobConfig) {
  const { source, writer, fieldMappings, transformRules } = jobConfig;

  let reader = buildReader(source);
  const writerConfig = buildWriter(writer);

  if (fieldMappings && fieldMappings.length > 0) {
    reader = applyFieldMappings(reader, fieldMappings);
  }

  const content = {
    reader: reader,
    writer: writerConfig
  };
  const transformers = buildTransformers(transformRules);
  if (transformers && transformers.length > 0) {
    content.transformer = transformers;
  }

  const job = {
    job: {
      content: [content],
      setting: {
        speed: {
          channel: jobConfig.channel || 1,
          byte: jobConfig.byteSpeed || -1,
          record: jobConfig.recordSpeed || -1
        },
        errorLimit: {
          record: jobConfig.errorRecordLimit || 10000,
          percentage: jobConfig.errorPercentage || 0.01
        }
      }
    }
  };

  return job;
}

function buildReader(source) {
  const connection = source.connection || {};
  const sourceType = resolveTransferType(source.type, connection);
  const table = normalizeTables(connection.table);

  switch (sourceType) {
    case "mysql":
      return {
        name: "mysqlreader",
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          column: connection.column || ["*"],
          connection: [
            {
              jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType),
              table
            }
          ],
          ...(connection.splitPk ? { splitPk: connection.splitPk } : {}),
          ...(connection.where ? { where: connection.where } : {})
        }
      };

    case "postgresql":
      return {
        name: "postgresqlreader",
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          column: connection.column || ["*"],
          splitPk: connection.splitPk || null,
          connection: [
            {
              jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType),
              table
            }
          ],
          where: connection.where || null
        }
      };

    case "oracle":
      return buildJdbcReader("oraclereader", sourceType, connection, table);

    case "dm":
      return buildJdbcReader("rdbmsreader", sourceType, connection, table);

    case "sftp":
    case "ftp":
      return {
        name: "streamreader",
        parameter: {
          column: connection.column || ["*"],
          sliceRecordCount: 100
        }
      };

    case "api":
    case "http":
      return {
        name: "streamreader",
        parameter: {
          column: connection.column || ["*"],
          sliceRecordCount: 100
        }
      };

    default:
      throw new Error(`DataX 不支持数据源类型 ${source.type || sourceType}，未生成降级流任务`);
  }
}

function buildWriter(writer) {
  const connection = writer.connection || {};
  const writerType = resolveTransferType(writer.type, connection);
  const table = normalizeTables(connection.table);

  switch (writerType) {
    case "mysql":
      return buildMysqlWriter(connection, table, writerType);

    case "postgresql":
      return buildPostgresqlWriter(connection, table, writerType);

    case "oracle":
      return buildJdbcWriter("oraclewriter", writerType, connection, table);

    case "dm":
      return buildJdbcWriter("rdbmswriter", writerType, connection, table);

    case "hive":
      return buildHiveWriter(connection);

    case "kafka":
      return {
        name: "streamwriter",
        parameter: {
          column: ["*"],
          sliceRecordCount: 100
        }
      };

    case "file":
      return {
        name: "txtfilewriter",
        parameter: {
          fileName: connection.fileName || "output",
          path: connection.path || "/tmp/datax/output",
          fileType: connection.fileType || "text",
          fieldDelimiter: connection.fieldDelimiter || ",",
          column: connection.column || ["*"]
        }
      };

    default:
      throw new Error(`DataX 不支持数据源类型 ${writer.type || writerType}，未生成降级流任务`);
  }
}

function applyFieldMappings(reader, fieldMappings) {
  return reader;
}

function normalizeTables(table) {
  if (Array.isArray(table)) {
    return table.filter(Boolean);
  }

  if (table) {
    return [table];
  }

  return [];
}

function normalizeReaderJdbcUrls(connection, sourceType = "mysql") {
  const dialect = resolveTransferType(sourceType, connection);
  const normalizeUrl = (value) => normalizeJdbcUrlForDialect(value, dialect);
  if (Array.isArray(connection.jdbcUrl)) {
    return connection.jdbcUrl.filter(Boolean).map(normalizeUrl);
  }

  if (Array.isArray(connection.url)) {
    return connection.url.filter(Boolean).map(normalizeUrl);
  }

  const jdbcUrl = connection.jdbcUrl || connection.url || buildJdbcUrl(sourceType, connection);
  return jdbcUrl ? [normalizeUrl(jdbcUrl)] : [];
}

function normalizeWriterJdbcUrl(connection, writerType = "mysql") {
  const dialect = resolveTransferType(writerType, connection);
  const normalizeUrl = (value) => normalizeJdbcUrlForDialect(value, dialect);
  if (Array.isArray(connection.jdbcUrl)) {
    return normalizeUrl(connection.jdbcUrl[0] || "");
  }

  if (Array.isArray(connection.url)) {
    return normalizeUrl(connection.url[0] || "");
  }

  return normalizeUrl(connection.jdbcUrl || connection.url || buildJdbcUrl(writerType, connection));
}

function buildJdbcReader(name, sourceType, connection, table) {
  return {
    name,
    parameter: {
      username: connection.username || "",
      password: connection.password || "",
      column: connection.column || ["*"],
      connection: [{ jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType), table }],
      ...(connection.splitPk ? { splitPk: connection.splitPk } : {}),
      ...(connection.where ? { where: connection.where } : {}),
    },
  };
}

function buildJdbcWriter(name, sourceType, connection, table) {
  const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
  const preSql = [...(connection.preSql || [])];
  if (normalizedWriteMode === "overwrite" && table[0]) {
    const quote = sourceType === "oracle" || sourceType === "dm" ? '"' : "`";
    const target = table[0].split(".").filter(Boolean).map((part) => `${quote}${part.replaceAll(quote, quote + quote)}${quote}`).join(".");
    preSql.unshift(`TRUNCATE TABLE ${target}`);
  }
  return {
    name,
    parameter: {
      username: connection.username || "",
      password: connection.password || "",
      writeMode: normalizedWriteMode === "replace" ? "replace" : "insert",
      column: connection.column || ["*"],
      connection: [{ jdbcUrl: normalizeWriterJdbcUrl(connection, sourceType), table }],
      preSql,
      postSql: connection.postSql || [],
    },
  };
}

function buildTransformers(transformRules) {
  if (!transformRules || transformRules.length === 0) {
    return null;
  }

  return transformRules.map(rule => {
    const config = rule.config || {};
    switch (rule.transformType) {
      case "rename":
        return {
          name: "replace",
          rule: {
            destination: config.newName || rule.field,
            source: rule.field
          }
        };
      case "uppercase":
        return {
          name: "replace",
          rule: {
            destination: rule.field,
            source: rule.field,
            replaceWith: config.expression || `upper(${rule.field})`
          }
        };
      case "lowercase":
        return {
          name: "replace",
          rule: {
            destination: rule.field,
            source: rule.field,
            replaceWith: config.expression || `lower(${rule.field})`
          }
        };
      default:
        return null;
    }
  }).filter(t => t !== null);
}

async function executeJob(jobId, jobJson, options = {}) {
  const tempDir = os.tmpdir();
  const jobFileName = `datax_job_${jobId}_${uuidv4()}.json`;
  const jobFilePath = path.join(tempDir, jobFileName);

  try {
    validateDataXEnvironment();
    materializeActiveDataXDrivers(DATA_X_HOME);
    fs.writeFileSync(jobFilePath, JSON.stringify(jobJson, null, 2), "utf8");

    return new Promise((resolve, reject) => {
      const dataXProcess = spawn(PYTHON_BIN, [DATA_X_BIN, jobFilePath], {
        cwd: DATA_X_HOME,
        env: { ...process.env },
        shell: true
      });

      runningJobs.set(jobId, {
        process: dataXProcess,
        cancelRequested: false
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const finalize = (code, signal, source) => {
        if (settled) {
          return;
        }
        settled = true;
        const runningJob = runningJobs.get(jobId);
        const cancelRequested = Boolean(runningJob?.cancelRequested);
        runningJobs.delete(jobId);

        try {
          fs.unlinkSync(jobFilePath);
        } catch (e) {
          // ignore cleanup error
        }

        const result = parseJobResult(stdout, stderr, code, signal, cancelRequested);
        result.completedBy = source;

        if (code === 0 && !signal && !cancelRequested) {
          resolve({
            success: true,
            jobId,
            result
          });
        } else {
          resolve({
            success: false,
            jobId,
            error: result.error || stderr || stdout || `DataX exited with code ${code}`,
            result
          });
        }
      };

      dataXProcess.stdout.on("data", (data) => {
        const chunk = data.toString();
        stdout += chunk;

        const progress = extractLatestProgress(stdout);
        if (progress && typeof options.onProgress === "function") {
          options.onProgress({
            stdout,
            stderr,
            metrics: progress.metrics,
            latestLine: progress.line
          });
        }
      });

      dataXProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      dataXProcess.on("close", (code, signal) => {
        finalize(code, signal, "close");
      });

      dataXProcess.on("exit", (code, signal) => {
        finalize(code, signal, "exit");
      });

      dataXProcess.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        runningJobs.delete(jobId);
        try {
          fs.unlinkSync(jobFilePath);
        } catch (e) {
          // ignore cleanup error
        }
        reject({
          success: false,
          jobId,
          error: error.message
        });
      });
    });
  } catch (error) {
    try {
      if (fs.existsSync(jobFilePath)) {
        fs.unlinkSync(jobFilePath);
      }
    } catch (e) {
      // ignore cleanup error
    }
    throw error;
  }
}

function validateDataXEnvironment() {
  if (!fs.existsSync(DATA_X_BIN)) {
    const configuredByEnv = env.dataxBin || env.dataxHome;
    const configHint = configuredByEnv
      ? `当前 DATAX 配置无效，请检查 DATAX_HOME / DATAX_BIN。`
      : "当前未配置 DATAX_HOME / DATAX_BIN。";
    throw new Error(
      `DataX 未安装或路径不存在: ${DATA_X_BIN}。${configHint}`
    );
  }
}

function buildMysqlWriter(connection, table, writerType = "mysql") {
  const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
  const firstTable = table[0];
  const preSql = [...(connection.preSql || [])];
  let dataXWriteMode = "insert";

  if (normalizedWriteMode === "replace") {
    dataXWriteMode = "replace";
  } else if (normalizedWriteMode === "overwrite") {
    if (firstTable) {
      preSql.unshift(`TRUNCATE TABLE ${quoteMysqlTableName(firstTable)}`);
    }
  }

  return {
    name: "mysqlwriter",
    parameter: {
      username: connection.username || "",
      password: connection.password || "",
      writeMode: dataXWriteMode,
      session: connection.session || [],
      column: connection.column || ["*"],
      connection: [
        {
          jdbcUrl: normalizeWriterJdbcUrl(connection, writerType),
          table
        }
      ],
      preSql,
      postSql: connection.postSql || []
    }
  };
}

function buildPostgresqlWriter(connection, table, writerType = "postgresql") {
  const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
  const firstTable = table[0];
  const preSql = [...(connection.preSql || [])];

  if (normalizedWriteMode === "overwrite" && firstTable) {
    preSql.unshift(`TRUNCATE TABLE ${quotePostgresqlTableName(firstTable)}`);
  }

  return {
    name: "postgresqlwriter",
    parameter: {
      username: connection.username || "",
      password: connection.password || "",
      session: connection.session || [],
      column: connection.column || ["*"],
      connection: [
        {
          jdbcUrl: normalizeWriterJdbcUrl(connection, writerType),
          table
        }
      ],
      preSql,
      postSql: connection.postSql || []
    }
  };
}

function buildHiveWriter(connection) {
  const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
  const partitionConfig = connection.partitionConfig || {};
  const parameter = {
    defaultFS: connection.defaultFS || "hdfs://localhost:9000",
    fileType: connection.fileType || "text",
    path: connection.path || "/tmp/datax",
    fileName: connection.fileName || "datax",
    column: connection.column || ["*"],
    writeMode: normalizedWriteMode === "partition_overwrite" ? "overwrite" : normalizedWriteMode,
    fieldDelimiter: connection.fieldDelimiter || "\t"
  };

  if (normalizedWriteMode === "partition_overwrite") {
    parameter.partition = {
      mode: partitionConfig.mode || "latest",
      partitionColumn: partitionConfig.partitionColumn || "",
      ...(partitionConfig.partitionValue ? { partitionValue: partitionConfig.partitionValue } : {})
    };
  }

  return {
    name: "hdfswriter",
    parameter
  };
}

function quoteMysqlTableName(tableName) {
  return String(tableName || "")
    .split(".")
    .filter(Boolean)
    .map((part) => `\`${part.replace(/`/g, "``")}\``)
    .join(".");
}

function quotePostgresqlTableName(tableName) {
  return String(tableName || "")
    .split(".")
    .filter(Boolean)
    .map((part) => `"${part.replace(/"/g, "\"\"")}"`)
    .join(".");
}

function cancelJob(jobId) {
  const runningJob = runningJobs.get(jobId);
  if (runningJob?.process) {
    runningJob.cancelRequested = true;
    terminateProcessTree(runningJob.process);
    return true;
  }
  return false;
}

function terminateProcessTree(childProcess) {
  if (!childProcess || !childProcess.pid) {
    return false;
  }

  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(childProcess.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    return result.status === 0;
  }

  try {
    childProcess.kill("SIGTERM");
    return true;
  } catch (error) {
    return false;
  }
}

const OUTPUT_TAIL_LIMIT = 8000;

function tailText(value, maxLength = OUTPUT_TAIL_LIMIT) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(text.length - maxLength);
}

function parseJobResult(stdout, stderr, exitCode, signal = null, cancelled = false) {
  const result = {
    exitCode: exitCode,
    signal,
    metrics: {}
  };

  try {
    const progress = extractLatestProgress(stdout);
    if (progress) {
      result.metrics = progress.metrics;
      result.latestProgressLine = progress.line;
    }

    if (cancelled || signal) {
      result.status = "cancelled";
      result.error = "任务已取消";
    } else if (stdout.includes("任务执行整个成功")) {
      result.status = "success";
      result.error = null;
    } else if (stdout.includes("任务执行失败")) {
      result.status = "failed";
      result.error = "任务执行失败";
    }

    if (result.status !== "success") {
      const stderrTail = tailText(stderr);
      const stdoutTail = tailText(stdout);
      if (stderrTail) {
        result.stderr = stderrTail;
      }
      if (stdoutTail) {
        result.stdout = stdoutTail;
      }
      if (!result.error) {
        result.error = stderrTail || stdoutTail || `DataX exited with code ${exitCode}`;
      }
      result.error = normalizeDataXError(result.error);
    }
  } catch (e) {
    // parsing error, ignore
  }

  return result;
}

function isJobRunning(jobId) {
  return runningJobs.has(jobId);
}

function getRunningJobIds() {
  return [...runningJobs.keys()];
}

function normalizeDataXError(value) {
  const message = String(value || "").trim();
  if (/ClassNotFoundException|NoClassDefFoundError|No suitable driver/i.test(message)) return `数据库 JDBC 驱动未加载：${tailText(message, 1200)}`;
  if (/ORA-01017|invalid username\/password/i.test(message)) return "Oracle 账号或密码错误";
  if (/ORA-12514|ORA-12505/i.test(message)) return "Oracle Service Name 或 SID 不存在";
  if (/ORA-01031|insufficient privileges/i.test(message)) return "Oracle 当前用户权限不足";
  if (/网络通信异常|connection refused|connect timed out/i.test(message)) return `数据库网络连接失败：${tailText(message, 1200)}`;
  return message;
}

function extractLatestProgress(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const metrics = parseProgressLine(line);
    if (metrics) {
      return { line, metrics };
    }
  }

  return null;
}

function parseProgressLine(line) {
  if (!line.includes("Total") || !line.includes("Speed") || !line.includes("records")) {
    return null;
  }

  const progressMatch = line.match(
    /Total\s+(\d+)\s+records,\s+(\d+)\s+bytes\s+\|\s+Speed\s+([^,|]+),\s+([^|]+)\|\s+Error\s+(\d+)\s+records,\s+(\d+)\s+bytes.*?\|\s+Percentage\s+([\d.]+)%/i
  );

  if (!progressMatch) {
    return null;
  }

  return {
    totalRecords: parseInt(progressMatch[1], 10),
    totalBytes: parseInt(progressMatch[2], 10),
    speed: progressMatch[3].trim(),
    recordSpeed: progressMatch[4].trim(),
    errorRecords: parseInt(progressMatch[5], 10),
    errorBytes: parseInt(progressMatch[6], 10),
    percentage: Number(progressMatch[7])
  };
}

module.exports = {
  buildDataXJob,
  executeJob,
  cancelJob,
  parseJobResult,
  isJobRunning,
  getRunningJobIds,
};
