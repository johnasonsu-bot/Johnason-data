const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { getActiveDriverBinding, resolveDriverFile } = require("./database-driver-store");

const JAVA_SOURCE = path.resolve(__dirname, "../../runtime/jdbc/JdbcDriverRunner.java");
const JAVA_CLASSES = path.resolve(process.cwd(), "runtime/database-drivers/java-runtime/classes");
const JAVA_CLASS = "medata.jdbc.JdbcDriverRunner";

function ensureJdbcRunnerCompiled() {
  const classFile = path.join(JAVA_CLASSES, "medata/jdbc/JdbcDriverRunner.class");
  const needsCompile = !fs.existsSync(classFile)
    || fs.statSync(classFile).mtimeMs < fs.statSync(JAVA_SOURCE).mtimeMs;
  if (!needsCompile) return JAVA_CLASSES;
  fs.mkdirSync(JAVA_CLASSES, { recursive: true });
  const result = spawnSync(process.env.JAVAC_BIN || "javac", ["-encoding", "UTF-8", "-d", JAVA_CLASSES, JAVA_SOURCE], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`JDBC 运行器编译失败: ${String(result.stderr || result.stdout || "javac 不可用").trim()}`);
  }
  return JAVA_CLASSES;
}

function encode(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64");
}

function serializeParams(params = []) {
  const env = { JDBC_PARAM_COUNT: String(params.length) };
  params.forEach((value, index) => {
    const type = value === null || value === undefined
      ? "null"
      : typeof value === "number" || typeof value === "bigint"
        ? "number"
        : typeof value === "boolean" ? "boolean" : "string";
    env[`JDBC_PARAM_${index}_TYPE`] = type;
    env[`JDBC_PARAM_${index}_VALUE_B64`] = encode(value ?? "");
  });
  return env;
}

function runJdbcAction(binding, action, payload = {}) {
  const classes = ensureJdbcRunnerCompiled();
  const driverFile = resolveDriverFile(binding.filePath);
  if (!fs.existsSync(driverFile)) throw new Error(`驱动文件不存在: ${binding.filePath}`);
  const javaEnv = {
    PATH: process.env.PATH || "",
    Path: process.env.Path || "",
    SystemRoot: process.env.SystemRoot || "",
    JAVA_HOME: process.env.JAVA_HOME || "",
    TEMP: process.env.TEMP || "",
    TMP: process.env.TMP || "",
    LANG: process.env.LANG || "",
    LC_ALL: process.env.LC_ALL || "",
    JDBC_DRIVER_CLASS: binding.driverClass,
    JDBC_URL: payload.jdbcUrl || "",
    JDBC_USER: payload.username || "",
    JDBC_PASSWORD: payload.password || "",
    JDBC_SQL_BASE64: encode(payload.sql || ""),
    JDBC_MAX_ROWS: String(payload.maxRows || 1000),
    JDBC_CATALOG: payload.catalog || "",
    JDBC_SCHEMA: payload.schema || "",
    JDBC_TABLE: payload.table || "",
    ...serializeParams(payload.params || []),
  };
  const classPath = `${classes}${path.delimiter}${driverFile}`;
  return new Promise((resolve, reject) => {
    const restrictedIdentity = process.platform !== "win32"
      && typeof process.getuid === "function"
      && process.getuid() === 0
      ? {
          uid: Number(process.env.JDBC_RUNNER_UID || 65534),
          gid: Number(process.env.JDBC_RUNNER_GID || 65534),
        }
      : {};
    const child = spawn(process.env.JAVA_BIN || "java", ["-cp", classPath, JAVA_CLASS, action], {
      env: javaEnv,
      windowsHide: true,
      shell: false,
      ...restrictedIdentity,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, Number(payload.timeoutMs || 90000));
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`JDBC 操作超过 ${Number(payload.timeoutMs || 90000)} 毫秒，已终止`));
        return;
      }
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
      let result;
      try { result = JSON.parse(line || "{}"); } catch { result = null; }
      if (code !== 0 || !result || result.success === false) {
        reject(new Error(result?.error || stderr.trim() || stdout.trim() || `JDBC 运行器退出码 ${code}`));
        return;
      }
      resolve(result);
    });
  });
}

function getManagedBinding(databaseType) {
  const binding = getActiveDriverBinding(databaseType, "query");
  return binding?.filePath && binding?.driverClass ? binding : null;
}

module.exports = {
  ensureJdbcRunnerCompiled,
  getManagedBinding,
  runJdbcAction,
};
