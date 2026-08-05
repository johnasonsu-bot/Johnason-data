const test = require("node:test");
const assert = require("node:assert/strict");
const metadata = require("./data-source.metadata");
const { buildTargetColumnsFromMappings } = require("../ingestion-tasks/ingestion-task.service");

test("postgres typed NULL defaults are treated as no default", () => {
  assert.equal(metadata.__test.normalizePostgreSqlColumnDefault("NULL::numeric"), null);
  assert.equal(metadata.__test.normalizePostgreSqlColumnDefault("NULL::character varying"), null);
  assert.equal(metadata.__test.normalizePostgreSqlColumnDefault("NULL::timestamp without time zone"), null);
  assert.equal(metadata.__test.formatDefaultValue("postgresql", "NULL::numeric"), null);
  assert.equal(metadata.__test.formatDefaultValue("mysql", "NULL::numeric"), null);
  assert.equal(metadata.__test.normalizeDefaultValueForCompare("NULL::numeric"), null);

  assert.equal(
    metadata.__test.buildColumnDefinitionSql("postgresql", {
      columnName: "gross_profit_rate",
      columnType: "numeric(18,6)",
      isNullable: true,
      isPrimaryKey: false,
      columnDefault: "NULL::numeric",
      extra: "",
    }),
    '"gross_profit_rate" numeric(18,6)'
  );
});

test("explicit null mapping default suppresses source column default", () => {
  const sourceColumns = [
    {
      columnName: "amount",
      columnType: "numeric(18,2)",
      dataType: "numeric",
      columnDefault: "0",
      extra: "",
      columnComment: "",
    },
  ];

  const explicitNull = buildTargetColumnsFromMappings(
    sourceColumns,
    [{ sourceField: "amount", targetField: "amount", defaultValue: null }],
    "postgresql"
  );
  assert.equal(explicitNull[0].columnDefault, null);

  const inherited = buildTargetColumnsFromMappings(
    sourceColumns,
    [{ sourceField: "amount", targetField: "amount" }],
    "postgresql"
  );
  assert.equal(inherited[0].columnDefault, "0");
});

test("postgres native source column types are preserved for postgres targets", () => {
  const result = buildTargetColumnsFromMappings(
    [
      {
        columnName: "name",
        columnType: "character varying(64)",
        dataType: "character varying",
      },
      {
        columnName: "created_at",
        columnType: "timestamp without time zone",
        dataType: "timestamp without time zone",
      },
      {
        columnName: "payload",
        columnType: "jsonb",
        dataType: "jsonb",
      },
    ],
    [
      { sourceField: "name", targetField: "name", dataType: "character varying(64)" },
      { sourceField: "created_at", targetField: "created_at", dataType: "timestamp without time zone" },
      { sourceField: "payload", targetField: "payload", dataType: "jsonb" },
    ],
    "postgresql"
  );

  assert.equal(result[0].columnType, "varchar(64)");
  assert.equal(result[1].columnType, "timestamp without time zone");
  assert.equal(result[2].columnType, "text");
});

test("mysql native numeric source column types remain numeric for mysql targets", () => {
  const result = buildTargetColumnsFromMappings(
    [
      {
        columnName: "id",
        columnType: "bigint",
        dataType: "bigint",
        columnDefault: null,
        extra: "auto_increment",
      },
      {
        columnName: "sort_order",
        columnType: "int unsigned",
        dataType: "int",
        columnDefault: "0",
        extra: "",
      },
    ],
    [
      { sourceField: "id", targetField: "id", dataType: "bigint", isPrimaryKey: true },
      { sourceField: "sort_order", targetField: "sort_order", dataType: "int unsigned" },
    ],
    "mysql"
  );

  assert.equal(result[0].columnType, "bigint");
  assert.equal(result[0].extra, "auto_increment");
  assert.equal(result[1].columnType, "int unsigned");
});

test("managed row estimates keep each database system catalog", () => {
  const mysql = metadata.__test.buildAdapterEstimateQuery("mysql", {}, { database: "medata", tableName: "users" });
  assert.match(mysql.sql, /information_schema\.tables/i);
  assert.deepEqual(mysql.binds, ["medata", "users"]);

  const postgres = metadata.__test.buildAdapterEstimateQuery("postgresql", {}, { schema: "public", tableName: "users" });
  assert.match(postgres.sql, /pg_class/i);
  assert.deepEqual(postgres.binds, ["public", "users"]);

  const oracle = metadata.__test.buildAdapterEstimateQuery("oracle", { username: "report" }, { tableName: "orders" });
  assert.match(oracle.sql, /all_tables.*:1.*:2/i);
  assert.deepEqual(oracle.binds, ["REPORT", "ORDERS"]);
});
