const assert = require("node:assert/strict");
const test = require("node:test");

const { compileOrchestrationTask } = require("./data-development.orchestration-compiler");

function buildTask(filterRules) {
  return {
    id: 1,
    name: "filter-value-source-test",
    datasourceId: 1,
    datasourceType: "postgresql",
    databaseName: "demo",
    nodes: [
      {
        nodeKey: "source",
        nodeName: "数据输入",
        nodeType: "source",
        operatorCode: "source_table",
        nodeConfig: {
          datasourceId: 1,
          databaseName: "demo",
          tableName: "source_table",
          selectedColumns: ["status", "allowed_status"],
        },
      },
      {
        nodeKey: "filter",
        nodeName: "数据过滤",
        nodeType: "operator",
        operatorCode: "filter",
        nodeConfig: {
          filterLogic: "all",
          filterRules,
        },
      },
    ],
    edges: [
      {
        sourceNodeKey: "source",
        targetNodeKey: "filter",
        edgeType: "default",
        edgeStatus: "active",
      },
    ],
  };
}

async function compileFilter(filterRules) {
  return compileOrchestrationTask(buildTask(filterRules), {
    datasourceId: 1,
    datasourceType: "postgresql",
    databaseName: "demo",
    dialect: "postgresql",
    loadSourceColumns: async () => [
      { name: "status" },
      { name: "allowed_status" },
    ],
  });
}

test("filter IN supports values from an upstream field result", async () => {
  const compiled = await compileFilter([
    {
      ruleType: "condition",
      fieldName: "status",
      operator: "in",
      valueSource: "upstream_field",
      referenceField: "allowed_status",
    },
  ]);

  const filterSql = compiled.nodeSqls.find((item) => item.nodeKey === "filter")?.sql || "";
  assert.match(filterSql, /CAST\("source_data"\."status" AS TEXT\) IN \(/);
  assert.match(filterSql, /SELECT CAST\("reference_data"\."allowed_status" AS TEXT\)/);
  assert.match(filterSql, /FROM "cte_01_source" AS "reference_data"/);
});

test("filter can use a different connected upstream node as the IN value source", async () => {
  const task = {
    id: 2,
    name: "multi-upstream-filter-test",
    datasourceId: 1,
    datasourceType: "postgresql",
    databaseName: "demo",
    nodes: [
      {
        nodeKey: "source_reference",
        nodeName: "准入编码加工",
        nodeType: "source",
        operatorCode: "source_table",
        nodeConfig: {
          datasourceId: 1,
          databaseName: "demo",
          tableName: "allowed_codes",
          selectedColumns: ["allowed_code"],
        },
      },
      {
        nodeKey: "source_main",
        nodeName: "业务明细加工",
        nodeType: "source",
        operatorCode: "source_table",
        nodeConfig: {
          datasourceId: 1,
          databaseName: "demo",
          tableName: "business_rows",
          selectedColumns: ["status", "payload"],
        },
      },
      {
        nodeKey: "filter",
        nodeName: "跨节点数据过滤",
        nodeType: "operator",
        operatorCode: "filter",
        nodeConfig: {
          schemaSourceNodeKey: "source_main",
          filterLogic: "all",
          filterRules: [
            {
              ruleType: "condition",
              fieldName: "status",
              operator: "in",
              valueSource: "upstream_field",
              referenceNodeKey: "source_reference",
              referenceField: "allowed_code",
            },
          ],
        },
      },
    ],
    edges: [
      {
        sourceNodeKey: "source_reference",
        targetNodeKey: "filter",
        edgeType: "default",
        edgeStatus: "active",
      },
      {
        sourceNodeKey: "source_main",
        targetNodeKey: "filter",
        edgeType: "default",
        edgeStatus: "active",
      },
    ],
  };

  const compiled = await compileOrchestrationTask(task, {
    datasourceId: 1,
    datasourceType: "postgresql",
    databaseName: "demo",
    dialect: "postgresql",
    loadSourceColumns: async ({ tableName }) => (
      tableName === "allowed_codes"
        ? [{ name: "allowed_code" }]
        : [{ name: "status" }, { name: "payload" }]
    ),
  });

  const filterPlan = compiled.nodeSqls.find((item) => item.nodeKey === "filter");
  const mainPlan = compiled.nodeSqls.find((item) => item.nodeKey === "source_main");
  const referencePlan = compiled.nodeSqls.find((item) => item.nodeKey === "source_reference");
  assert.deepEqual(filterPlan?.columns, ["status", "payload"]);
  assert.ok(filterPlan?.sql.includes(`FROM "${mainPlan?.cteName}" AS "source_data"`));
  assert.ok(filterPlan?.sql.includes(`FROM "${referencePlan?.cteName}" AS "reference_data"`));
  assert.match(filterPlan?.sql || "", /CAST\("source_data"\."status" AS TEXT\) IN \(/);
  assert.match(filterPlan?.sql || "", /SELECT CAST\("reference_data"\."allowed_code" AS TEXT\)/);
});

test("filter NOT IN supports a wrapped custom SQL subquery", async () => {
  const compiled = await compileFilter([
    {
      ruleType: "condition",
      fieldName: "status",
      operator: "not_in",
      valueSource: "custom_sql",
      customSql: "IN (SELECT code FROM allowed_codes)",
    },
  ]);

  const filterSql = compiled.nodeSqls.find((item) => item.nodeKey === "filter")?.sql || "";
  assert.match(filterSql, /"source_data"\."status" NOT IN \(/);
  assert.match(filterSql, /SELECT code FROM allowed_codes/);
  assert.doesNotMatch(filterSql, /NOT IN \(\s*IN \(/);
});

test("legacy fixed-value IN rules remain compatible", async () => {
  const compiled = await compileFilter([
    {
      ruleType: "condition",
      fieldName: "status",
      operator: "in",
      value: "active, pending",
    },
  ]);

  const filterSql = compiled.nodeSqls.find((item) => item.nodeKey === "filter")?.sql || "";
  assert.match(filterSql, /IN \('active', 'pending'\)/);
});

test("custom SQL filter rejects multi-column queries", async () => {
  await assert.rejects(
    () => compileFilter([
      {
        ruleType: "condition",
        fieldName: "status",
        operator: "in",
        valueSource: "custom_sql",
        customSql: "SELECT code, name FROM allowed_codes",
      },
    ]),
    /必须明确返回一个字段/
  );
});
