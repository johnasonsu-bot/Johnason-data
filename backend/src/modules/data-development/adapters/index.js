const mysqlAdapter = require("./mysql.adapter");
const postgresAdapter = require("./postgres.adapter");
const oracleAdapter = require("./oracle.adapter");
const dmAdapter = require("./dm.adapter");
const clickhouseAdapter = require("./clickhouse.adapter");
const hiveAdapter = require("./hive.adapter");
const { inferDatasourceDialect, normalizeDatasourceType } = require("../data-development.utils");
const { createManagedJdbcAdapter } = require("./managed-jdbc.adapter");

const managedAdapters = {
  mysql: createManagedJdbcAdapter("mysql", mysqlAdapter),
  postgresql: createManagedJdbcAdapter("postgresql", postgresAdapter),
  oracle: createManagedJdbcAdapter("oracle", oracleAdapter),
  dm: createManagedJdbcAdapter("dm", dmAdapter),
};

function getAdapter(input) {
  const normalized = input && typeof input === "object"
    ? inferDatasourceDialect(input)
    : normalizeDatasourceType(input);

  switch (normalized) {
    case "mysql":
      return managedAdapters.mysql;
    case "postgresql":
      return managedAdapters.postgresql;
    case "oracle":
      return managedAdapters.oracle;
    case "dm":
      return managedAdapters.dm;
    case "clickhouse":
      return clickhouseAdapter;
    case "hive":
      return hiveAdapter;
    default:
      throw new Error(`Unsupported datasource type: ${normalized || input}`);
  }
}

module.exports = {
  getAdapter,
};
