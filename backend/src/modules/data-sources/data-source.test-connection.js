const net = require("net");
const ftp = require("basic-ftp");
const { Kafka, logLevel } = require("kafkajs");
const {
  normalizeDatasourceType,
  parseJdbcUrl,
  resolveDatasourceConnection,
} = require("../../common/utils/datasource-dialect");
const apiIngestionService = require("../../services/apiIngestionService");
const { getAdapter } = require("../data-development/adapters");

async function testDatabaseConnection(config, sourceType) {
  const normalizedType = normalizeDatasourceType(sourceType);
  const resolved = resolveDatasourceConnection(sourceType, config || {});
  const { host, port, database, username, password, dialect } = resolved;

  if (!["kafka", "api"].includes(dialect) && (!host || !port)) {
    return {
      success: false,
      message: "缺少必要的连接参数",
    };
  }

  if (["mysql", "postgresql", "oracle", "dm"].includes(dialect) && !username) {
    return {
      success: false,
      message: "缺少必要的连接参数",
    };
  }

  try {
    switch (dialect) {
      case "mysql":
      case "postgresql":
      case "oracle":
      case "dm":
        return await getAdapter(dialect).testConnection({ ...config, sourceType: dialect, databaseName: database });
      case "hive":
        return await testTcpConnection(host, port, `Hive 连接测试成功 ${host}:${port}${database ? `/${database}` : ""}`);
      case "kafka":
        return await testKafkaConnection(config, host, port);
      case "ftp":
        return await testFtpConnection(config, host, port, username, password);
      case "api":
        return await apiIngestionService.testApiConnection(config);
      case "clickhouse":
        return await testTcpConnection(host, port, `ClickHouse 连接测试成功 ${host}:${port}${database ? `/${database}` : ""}`);
      default:
        if (normalizedType === "jdbc") {
          const jdbcMeta = parseJdbcUrl(config?.jdbcUrl || config?.url || config?.connectionString);
          const targetLabel = jdbcMeta?.vendor ? `JDBC(${jdbcMeta.vendor})` : "JDBC";
          return await testTcpConnection(host, port, `${targetLabel} 基础连通性测试成功 ${host}:${port}${database ? `/${database}` : ""}`);
        }

        return {
          success: true,
          message: `${sourceType} 类型的数据源暂不支持自动连通性校验，已跳过`,
        };
    }
  } catch (error) {
    const friendlyMessage = normalizeDatabaseConnectionError(error, dialect);
    return {
      success: false,
      message: friendlyMessage,
      error: error.message,
    };
  }
}

function normalizeDatabaseConnectionError(error, dialect) {
  const message = String(error?.message || "").trim();
  if (/cannot find module|module not found/i.test(message)) return "数据库驱动未安装";
  if (/ORA-01017|invalid username\/password|密码错误|用户名或密码错误/i.test(message)) return "数据库账号或密码错误";
  if (/ORA-12514|ORA-12505|service.*not known|listener.*service/i.test(message)) return "Oracle Service Name 或 SID 不存在";
  if (/ORA-12170|connect timeout|connection timeout|连接超时/i.test(message)) return "数据库连接超时";
  if (/ECONNREFUSED|network.*error|socket.*error|网络通信异常/i.test(message)) return "数据库网络连接失败";
  if (/permission|privilege|ORA-01031|没有权限|权限不足/i.test(message)) return "当前用户没有所需的数据库权限";
  const label = dialect === "oracle" ? "Oracle" : dialect === "dm" ? "达梦数据库" : "数据库";
  return `${label} 连接测试失败${message ? `：${message}` : ""}`;
}

async function testFtpConnection(config, host, port, username, password) {
  if (!username) {
    return { success: false, message: "缺少必要的连接参数" };
  }
  const client = new ftp.Client(8000);
  try {
    await client.connect(host, Number(port));
    if (Boolean(config?.secure || config?.ftps)) {
      await client.useTLS({ host });
    }
    await client.login(username, password);
    await client.send("TYPE I");
    await client.sendIgnoringError("STRU F");
    const rootPath = String(config?.rootPath || config?.path || "/").trim() || "/";
    const files = await client.list(rootPath);
    return {
      success: true,
      message: `FTP 连接测试成功 ${host}:${port}${rootPath ? `，目录: ${rootPath}` : ""}，可见 ${files.length} 个对象`,
    };
  } finally {
    client.close();
  }
}

async function testKafkaConnection(config, host, port) {
  const bootstrapServers = String(config?.bootstrapServers || config?.bootstrapServer || `${host}:${port}`)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!bootstrapServers.length) {
    return { success: false, message: "缺少 Kafka bootstrapServers" };
  }
  const kafka = new Kafka({
    clientId: String(config?.clientId || "medata-ingestion-test"),
    brokers: bootstrapServers,
    logLevel: logLevel.NOTHING,
    retry: { retries: 2 },
    connectionTimeout: 8000,
    requestTimeout: 10000,
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    const topics = await admin.listTopics();
    return {
      success: true,
      message: `Kafka 连接测试成功 ${bootstrapServers.join(", ")}，可见 ${topics.filter((topic) => !topic.startsWith("__")).length} 个 Topic`,
    };
  } finally {
    await admin.disconnect();
  }
}

function testTcpConnection(host, port, successMessage) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(5000);
    socket.once("connect", () => {
      done({
        success: true,
        message: successMessage,
      });
    });
    socket.once("timeout", () => {
      done({
        success: false,
        message: "连接测试超时",
      });
    });
    socket.once("error", (error) => {
      done({
        success: false,
        message: "连接测试失败",
        error: error.message,
      });
    });

    socket.connect(Number(port), host);
  });
}

module.exports = {
  testDatabaseConnection,
};
