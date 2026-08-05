const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildServiceSql,
  normalizeServicePath,
} = require("./data-service.runtime");

test("normalizeServicePath keeps a single leading slash", () => {
  assert.equal(normalizeServicePath("demo/list"), "/demo/list");
  assert.equal(normalizeServicePath("/demo//list"), "/demo/list");
});

test("buildServiceSql creates mysql list query with pagination", () => {
  const result = buildServiceSql(
    {
      serviceType: "list",
      sourceTable: "orders",
      queryConfig: {
        filters: [
          { columnName: "status", paramName: "status", operator: "eq", required: true, dataType: "string" },
          { columnName: "buyer_name", paramName: "buyerName", operator: "like", required: false, dataType: "string" },
        ],
        pagination: true,
        defaultPageSize: 20,
        maxPageSize: 50,
        defaultSortField: "created_at",
        defaultSortOrder: "desc",
      },
      responseConfig: {
        fields: [
          { columnName: "id", fieldName: "id" },
          { columnName: "buyer_name", fieldName: "buyerName" },
        ],
      },
    },
    {
      sourceType: "mysql",
      connectionConfig: {
        host: "127.0.0.1",
        port: 3306,
        database: "demo",
        username: "root",
        password: "123456",
      },
    },
    {
      status: "paid",
      buyerName: "alice",
      pageNum: 2,
      pageSize: 10,
    }
  );

  assert.match(result.dataSql, /SELECT `id` AS `id`, `buyer_name` AS `buyerName` FROM `demo`\.`orders`/);
  assert.match(result.dataSql, /WHERE `status` = \? AND `buyer_name` LIKE \?/);
  assert.match(result.dataSql, /ORDER BY `created_at` DESC LIMIT 10, 10/);
  assert.deepEqual(result.dataParams, ["paid", "%alice%"]);
  assert.equal(result.meta.pageNum, 2);
  assert.equal(result.meta.pageSize, 10);
});

test("buildServiceSql creates postgresql detail query with range filter", () => {
  const result = buildServiceSql(
    {
      serviceType: "detail",
      sourceTable: "orders",
      queryConfig: {
        filters: [
          {
            columnName: "created_at",
            startParamName: "createdAtStart",
            endParamName: "createdAtEnd",
            operator: "between",
            required: true,
            dataType: "string",
          },
        ],
      },
      responseConfig: {
        fields: [{ columnName: "id", fieldName: "id" }],
      },
    },
    {
      sourceType: "postgresql",
      connectionConfig: {
        host: "127.0.0.1",
        port: 5432,
        database: "demo",
        schema: "public",
        username: "postgres",
        password: "123456",
      },
    },
    {
      createdAtStart: "2026-01-01 00:00:00",
      createdAtEnd: "2026-01-31 23:59:59",
    }
  );

  assert.match(result.dataSql, /FROM "public"\."orders"/);
  assert.match(result.dataSql, /"created_at" BETWEEN \$1 AND \$2/);
  assert.match(result.dataSql, /LIMIT 1$/);
  assert.deepEqual(result.dataParams, ["2026-01-01 00:00:00", "2026-01-31 23:59:59"]);
  assert.equal(result.meta.paginationEnabled, false);
});

test("buildServiceSql creates Oracle named binds and offset pagination", () => {
  const result = buildServiceSql(
    {
      serviceType: "list",
      sourceTable: "ORDERS",
      queryConfig: { filters: [{ columnName: "STATUS", paramName: "status", operator: "eq", required: true }], pagination: true },
      responseConfig: { fields: [{ columnName: "ID", fieldName: "id" }] },
    },
    { sourceType: "oracle", connectionConfig: { host: "db", port: 1521, database: "ORCLPDB1", schema: "APP", username: "APP" } },
    { status: "PAID", pageNum: 2, pageSize: 10 },
  );
  assert.match(result.dataSql, /FROM "APP"\."ORDERS"/);
  assert.match(result.dataSql, /"STATUS" = :1/);
  assert.match(result.dataSql, /OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY$/);
  assert.deepEqual(result.dataParams, ["PAID"]);
});

test("buildServiceSql creates DM question-mark binds and fetch pagination", () => {
  const result = buildServiceSql(
    {
      serviceType: "list",
      sourceTable: "ORDERS",
      queryConfig: { filters: [{ columnName: "STATUS", paramName: "status", operator: "eq", required: true }], pagination: true },
      responseConfig: { fields: [{ columnName: "ID", fieldName: "id" }] },
    },
    { sourceType: "dm", connectionConfig: { host: "db", port: 5236, database: "APP", schema: "APP", username: "APP" } },
    { status: "PAID", pageNum: 1, pageSize: 20 },
  );
  assert.match(result.dataSql, /FROM "APP"\."ORDERS"/);
  assert.match(result.dataSql, /"STATUS" = \?/);
  assert.match(result.dataSql, /OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY$/);
  assert.deepEqual(result.dataParams, ["PAID"]);
});
