const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  buildJdbcUrl,
  inferDatasourceDialect,
  parseJdbcUrl,
  resolveDatasourceConnection,
} = require("../../common/utils/datasource-dialect");
const { getRuntimeDatabaseCapabilityStatus } = require("../../common/utils/datasource-capabilities");
const { getAdapter } = require("../data-development/adapters");
const dataxService = require("../../services/dataxService");
const metadataService = require("./data-source.metadata");

test("database registry normalizes the four supported database families", () => {
  assert.equal(inferDatasourceDialect("pg"), "postgresql");
  assert.equal(inferDatasourceDialect("oracle"), "oracle");
  assert.equal(inferDatasourceDialect("dameng"), "dm");
  assert.equal(inferDatasourceDialect("jdbc", { jdbcUrl: "jdbc:dm://db.example:5236/APP" }), "dm");
  assert.equal(parseJdbcUrl("jdbc:oracle:thin:@//db.example:1521/ORCLPDB1").connectionMode, "serviceName");
  assert.equal(parseJdbcUrl("jdbc:oracle:thin:@db.example:1521:ORCL").connectionMode, "sid");
  assert.equal(buildJdbcUrl("dm", { host: "db.example", port: 5236, database: "APP" }), "jdbc:dm://db.example:5236/APP");
});

test("all registered Node database drivers and adapters are loadable", () => {
  const statuses = getRuntimeDatabaseCapabilityStatus();
  assert.deepEqual(statuses.map((item) => item.type), ["mysql", "postgresql", "oracle", "dm"]);
  assert.ok(statuses.every((item) => item.driverLoaded), JSON.stringify(statuses));
  for (const type of ["mysql", "postgresql", "oracle", "dm"]) {
    const adapter = getAdapter(type);
    for (const method of ["testConnection", "getTables", "getColumns", "executeQuery", "executeStatement"]) {
      assert.equal(typeof adapter[method], "function", `${type}.${method}`);
    }
  }
});

test("DataX emits Oracle and DM plugins instead of stream fallbacks", () => {
  const oracleJob = dataxService.buildDataXJob({
    source: { type: "oracle", connection: { host: "db.example", port: 1521, database: "ORCLPDB1", username: "u", password: "p", table: "APP.T_SOURCE" } },
    writer: { type: "oracle", connection: { host: "db.example", port: 1521, database: "ORCLPDB1", username: "u", password: "p", table: "APP.T_TARGET" } },
  });
  const dmJob = dataxService.buildDataXJob({
    source: { type: "dm", connection: { host: "db.example", port: 5236, database: "APP", username: "u", password: "p", table: "APP.T_SOURCE" } },
    writer: { type: "dm", connection: { host: "db.example", port: 5236, database: "APP", username: "u", password: "p", table: "APP.T_TARGET" } },
  });
  assert.equal(oracleJob.job.content[0].reader.name, "oraclereader");
  assert.equal(oracleJob.job.content[0].writer.name, "oraclewriter");
  assert.equal(dmJob.job.content[0].reader.name, "rdbmsreader");
  assert.equal(dmJob.job.content[0].writer.name, "rdbmswriter");
  assert.match(dmJob.job.content[0].reader.parameter.connection[0].jdbcUrl[0], /^jdbc:dm:/);
});

test("DataX distribution contains Oracle and DM plugins and JDBC jars", () => {
  const dataxRoot = path.resolve(__dirname, "../../../datax/plugin");
  const required = [
    "reader/oraclereader/plugin.json",
    "writer/oraclewriter/plugin.json",
    "reader/rdbmsreader/plugin.json",
    "writer/rdbmswriter/plugin.json",
  ];
  required.forEach((relativePath) => assert.ok(fs.existsSync(path.join(dataxRoot, relativePath)), relativePath));
  const containsJar = (relativePath, pattern) => fs.readdirSync(path.join(dataxRoot, relativePath)).some((name) => pattern.test(name));
  assert.ok(containsJar("reader/oraclereader/libs", /^ojdbc.*\.jar$/i));
  assert.ok(containsJar("writer/oraclewriter/libs", /^ojdbc.*\.jar$/i));
  assert.ok(containsJar("reader/rdbmsreader/libs", /^Dm.*JdbcDriver.*\.jar$/i));
  assert.ok(containsJar("writer/rdbmswriter/libs", /^Dm.*JdbcDriver.*\.jar$/i));
});

test("DataX enterprise plugin verifier validates executable classes", () => {
  const verifierPath = path.resolve(__dirname, "../../../../scripts/verify-datax-enterprise-plugins.js");
  const result = spawnSync(process.execPath, [verifierPath], {
    cwd: path.resolve(__dirname, "../../../.."),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Oracle DataX reader: ready/);
  assert.match(result.stdout, /DM DataX writer: ready/);
});

const integrationTargets = [
  {
    type: "mysql",
    enabled: Boolean(process.env.TEST_MYSQL_HOST && process.env.TEST_MYSQL_USERNAME),
    config: {
      host: process.env.TEST_MYSQL_HOST,
      port: Number(process.env.TEST_MYSQL_PORT || 3306),
      databaseName: process.env.TEST_MYSQL_DATABASE,
      username: process.env.TEST_MYSQL_USERNAME,
      password: process.env.TEST_MYSQL_PASSWORD,
    },
  },
  {
    type: "postgresql",
    enabled: Boolean(process.env.TEST_POSTGRES_HOST && process.env.TEST_POSTGRES_USERNAME),
    config: {
      host: process.env.TEST_POSTGRES_HOST,
      port: Number(process.env.TEST_POSTGRES_PORT || 5432),
      databaseName: process.env.TEST_POSTGRES_DATABASE,
      schema: process.env.TEST_POSTGRES_SCHEMA || "public",
      username: process.env.TEST_POSTGRES_USERNAME,
      password: process.env.TEST_POSTGRES_PASSWORD,
    },
  },
  {
    type: "oracle",
    enabled: Boolean(process.env.TEST_ORACLE_HOST && process.env.TEST_ORACLE_USERNAME),
    config: {
      host: process.env.TEST_ORACLE_HOST,
      port: Number(process.env.TEST_ORACLE_PORT || 1521),
      databaseName: process.env.TEST_ORACLE_SERVICE_NAME,
      schema: process.env.TEST_ORACLE_SCHEMA,
      username: process.env.TEST_ORACLE_USERNAME,
      password: process.env.TEST_ORACLE_PASSWORD,
    },
  },
  {
    type: "dm",
    enabled: Boolean(process.env.TEST_DM_HOST && process.env.TEST_DM_USERNAME),
    config: {
      host: process.env.TEST_DM_HOST,
      port: Number(process.env.TEST_DM_PORT || 5236),
      databaseName: process.env.TEST_DM_DATABASE,
      schema: process.env.TEST_DM_SCHEMA,
      username: process.env.TEST_DM_USERNAME,
      password: process.env.TEST_DM_PASSWORD,
    },
  },
];

for (const target of integrationTargets) {
  test(`${target.type} optional integration contract`, { skip: !target.enabled }, async () => {
    const resolved = resolveDatasourceConnection(target.type, target.config);
    assert.ok(resolved.host && resolved.port && resolved.username);
    const adapter = getAdapter(target.type);
    const result = await adapter.testConnection({ ...target.config, sourceType: target.type });
    assert.equal(result.success, true);
    const tableScope = ["oracle", "dm"].includes(target.type) ? target.config.schema : target.config.databaseName;
    assert.ok(Array.isArray(await adapter.getTables({ ...target.config, sourceType: target.type }, tableScope)));
    const queryResult = await adapter.executeQuery({ ...target.config, sourceType: target.type }, "SELECT 1 AS ok");
    assert.equal(Number(queryResult.rows[0]?.ok ?? queryResult.rows[0]?.OK), 1);
    const metadataTables = await metadataService.listTables({
      sourceType: target.type,
      connectionConfig: {
        ...target.config,
        database: target.config.databaseName,
      },
    });
    assert.ok(Array.isArray(metadataTables));
    if (metadataTables[0]?.tableName) {
      const columns = await metadataService.listColumns({
        sourceType: target.type,
        connectionConfig: { ...target.config, database: target.config.databaseName },
      }, metadataTables[0].tableName);
      assert.ok(Array.isArray(columns) && columns.length > 0);
    }
  });
}
