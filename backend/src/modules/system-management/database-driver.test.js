const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DRIVER_STORE_ROOT, ensureDriverStore } = require("../../common/utils/database-driver-store");
const { materializeDataXTarget } = require("../../common/utils/database-driver-store");
const { runJdbcAction } = require("../../common/utils/managed-jdbc-runtime");
const { prepareSql } = require("../data-development/adapters/managed-jdbc.adapter");

const testDirectory = path.join(ensureDriverStore(), "runtime-test");

function stageDriver(source, name) {
  fs.mkdirSync(testDirectory, { recursive: true });
  const destination = path.join(testDirectory, name);
  fs.copyFileSync(source, destination);
  return path.relative(DRIVER_STORE_ROOT, destination).replace(/\\/g, "/");
}

test.after(() => {
  const relative = path.relative(DRIVER_STORE_ROOT, testDirectory);
  if (relative === "runtime-test") fs.rmSync(testDirectory, { recursive: true, force: true });
});

test("managed JDBC bind normalization supports named and PostgreSQL binds", () => {
  assert.deepEqual(prepareSql("SELECT * FROM t WHERE a = :value AND b = :value", { value: 3 }), {
    sql: "SELECT * FROM t WHERE a = ? AND b = ?",
    params: [3, 3],
  });
  assert.deepEqual(prepareSql("SELECT * FROM t WHERE a = $2 AND b = $1", ["first", "second"]), {
    sql: "SELECT * FROM t WHERE a = ? AND b = ?",
    params: ["second", "first"],
  });
});

test("one-click upload infers versions and database driver classes", () => {
  const driverServiceTest = require("./database-driver.service").__test;
  assert.equal(driverServiceTest.inferDriverVersion("mysql-connector-java-5.1.47.jar"), "5.1.47");
  assert.equal(driverServiceTest.inferDriverVersion("Dm7JdbcDriver17-7.6.0.142.jar"), "7.6.0.142");
  assert.deepEqual(driverServiceTest.getDriverClassCandidates("mysql", "com.mysql.cj.jdbc.Driver"), [
    "com.mysql.cj.jdbc.Driver",
    "com.mysql.jdbc.Driver",
    "org.mariadb.jdbc.Driver",
  ]);
});

test("uploaded MySQL JDBC jar is loadable by the managed runtime", async () => {
  const source = path.resolve(__dirname, "../../../datax/plugin/reader/mysqlreader/libs/mysql-connector-java-5.1.47.jar");
  const binding = {
    filePath: stageDriver(source, "mysql-driver.jar"),
    driverClass: "com.mysql.jdbc.Driver",
  };
  const result = await runJdbcAction(binding, "validate");
  assert.equal(result.success, true);
  assert.equal(result.driverClass, "com.mysql.jdbc.Driver");
});

for (const driver of [
  {
    name: "Oracle",
    source: "../../../datax/plugin/reader/oraclereader/libs/ojdbc8-21.21.0.0.jar",
    fileName: "oracle-driver.jar",
    driverClass: "oracle.jdbc.OracleDriver",
  },
  {
    name: "达梦",
    source: "../../../datax/plugin/reader/rdbmsreader/libs/Dm7JdbcDriver17-7.6.0.142.jar",
    fileName: "dm-driver.jar",
    driverClass: "dm.jdbc.driver.DmDriver",
  },
]) {
  test(`uploaded ${driver.name} JDBC jar is loadable by the managed runtime`, async () => {
    const binding = {
      filePath: stageDriver(path.resolve(__dirname, driver.source), driver.fileName),
      driverClass: driver.driverClass,
    };
    const result = await runJdbcAction(binding, "validate");
    assert.equal(result.success, true);
    assert.equal(result.driverClass, driver.driverClass);
  });
}

test("managed MySQL JDBC runtime executes a real query", { skip: !process.env.TEST_MYSQL_HOST }, async () => {
  const source = path.resolve(__dirname, "../../../datax/plugin/reader/mysqlreader/libs/mysql-connector-java-5.1.47.jar");
  const binding = {
    filePath: stageDriver(source, "mysql-integration-driver.jar"),
    driverClass: "com.mysql.jdbc.Driver",
  };
  const base = {
    jdbcUrl: `jdbc:mysql://${process.env.TEST_MYSQL_HOST}:${process.env.TEST_MYSQL_PORT || 3306}/${process.env.TEST_MYSQL_DATABASE}?useUnicode=true&characterEncoding=utf8&useSSL=false`,
    username: process.env.TEST_MYSQL_USERNAME,
    password: process.env.TEST_MYSQL_PASSWORD,
  };
  await runJdbcAction(binding, "test", { ...base, sql: "SELECT 1" });
  const result = await runJdbcAction(binding, "query", { ...base, sql: "SELECT 1 AS ok" });
  assert.equal(Number(result.rows[0].ok), 1);
});

test("managed PostgreSQL JDBC runtime executes a real query", { skip: !process.env.TEST_POSTGRESQL_HOST }, async () => {
  const source = path.resolve(__dirname, "../../../datax/plugin/reader/postgresqlreader/libs/postgresql-42.3.3.jar");
  const binding = {
    filePath: stageDriver(source, "postgresql-integration-driver.jar"),
    driverClass: "org.postgresql.Driver",
  };
  const base = {
    jdbcUrl: `jdbc:postgresql://${process.env.TEST_POSTGRESQL_HOST}:${process.env.TEST_POSTGRESQL_PORT || 5432}/${process.env.TEST_POSTGRESQL_DATABASE}`,
    username: process.env.TEST_POSTGRESQL_USERNAME,
    password: process.env.TEST_POSTGRESQL_PASSWORD,
  };
  await runJdbcAction(binding, "test", { ...base, sql: "SELECT 1" });
  const result = await runJdbcAction(binding, "query", { ...base, sql: "SELECT 1 AS ok" });
  assert.equal(Number(result.rows[0].ok), 1);
});

test("DataX driver materialization replaces and restores the built-in jar", () => {
  const dataxHome = path.join(testDirectory, "datax-home");
  const pluginDirectory = path.join(dataxHome, "plugin/reader/mysqlreader/libs");
  fs.mkdirSync(pluginDirectory, { recursive: true });
  const builtIn = path.join(pluginDirectory, "mysql-connector-java-built-in.jar");
  fs.writeFileSync(builtIn, "built-in");
  const source = path.resolve(__dirname, "../../../datax/plugin/reader/mysqlreader/libs/mysql-connector-java-5.1.47.jar");
  const binding = { filePath: stageDriver(source, "mysql-datax-driver.jar") };

  materializeDataXTarget(dataxHome, "mysql", "dataxReader", binding);
  assert.equal(fs.existsSync(`${builtIn}.builtin-disabled`), true);
  assert.equal(fs.existsSync(path.join(pluginDirectory, "medata-managed-mysql.jar")), true);

  materializeDataXTarget(dataxHome, "mysql", "dataxReader", null);
  assert.equal(fs.existsSync(builtIn), true);
  assert.equal(fs.existsSync(path.join(pluginDirectory, "medata-managed-mysql.jar")), false);
});
