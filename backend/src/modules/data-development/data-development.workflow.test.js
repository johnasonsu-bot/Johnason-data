const assert = require("node:assert/strict");
const test = require("node:test");
const scheduler = require("./data-development.scheduler");
const { buildTaskWorkflowGraph, validateWorkflowGraph } = require("./data-development.service");

function buildParallelWorkflow() {
  return {
    id: 1,
    nodes: [
      { nodeKey: "start", nodeName: "开始", nodeType: "start", nodeConfig: {} },
      { nodeKey: "parallel", nodeName: "并行分支", nodeType: "parallel", nodeConfig: {} },
      { nodeKey: "sql", nodeName: "SQL", nodeType: "script", scriptId: 1, nodeConfig: {} },
      { nodeKey: "processing", nodeName: "数据处理", nodeType: "processing", processingJobId: 2, nodeConfig: {} },
      { nodeKey: "join", nodeName: "并行汇聚", nodeType: "join", triggerRule: "all_success", nodeConfig: {} },
      { nodeKey: "end", nodeName: "结束", nodeType: "end", nodeConfig: {} },
    ],
    edges: [
      { sourceNodeKey: "start", targetNodeKey: "parallel", edgeLabel: "default" },
      { sourceNodeKey: "parallel", targetNodeKey: "sql", edgeLabel: "default" },
      { sourceNodeKey: "parallel", targetNodeKey: "processing", edgeLabel: "default" },
      { sourceNodeKey: "sql", targetNodeKey: "join", edgeLabel: "default" },
      { sourceNodeKey: "processing", targetNodeKey: "join", edgeLabel: "default" },
      { sourceNodeKey: "join", targetNodeKey: "end", edgeLabel: "default" },
    ],
  };
}

test("并行分支与并行汇聚工作流可通过严格校验", () => {
  const result = validateWorkflowGraph(buildParallelWorkflow(), { strict: true });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("并行分支少于两条输出时校验失败", () => {
  const workflow = buildParallelWorkflow();
  workflow.edges = workflow.edges.filter((edge) => edge.targetNodeKey !== "processing");
  const result = validateWorkflowGraph(workflow, { strict: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes("至少需要两条输出连线")));
});

test("拓扑排序拒绝循环依赖", () => {
  const workflow = buildParallelWorkflow();
  workflow.edges.push({ sourceNodeKey: "end", targetNodeKey: "parallel", edgeLabel: "default" });
  assert.throws(
    () => scheduler.buildTopologicalOrder(workflow.nodes, workflow.edges),
    /cycle/
  );
});

test("一键创建调度为三类任务生成开始、任务、结束三节点工作流", () => {
  const cases = [
    { taskType: "script", idField: "scriptId", nodeType: "script" },
    { taskType: "processing", idField: "processingJobId", nodeType: "processing" },
    { taskType: "operator_task", idField: "orchestrationTaskId", nodeType: "operator_task" },
  ];

  for (const item of cases) {
    const graph = buildTaskWorkflowGraph(item.taskType, { id: 88, name: "测试任务" });
    assert.deepEqual(graph.nodes.map((node) => node.nodeType), ["start", item.nodeType, "end"]);
    assert.equal(graph.nodes[1][item.idField], 88);
    assert.deepEqual(graph.edges.map((edge) => `${edge.sourceNodeKey}->${edge.targetNodeKey}`), ["start->task", "task->end"]);
    const validation = validateWorkflowGraph({ id: 1, ...graph }, { strict: true });
    assert.equal(validation.valid, true, validation.errors.join("; "));
  }
});

test("工作流调度支持秒级 Cron 表达式", () => {
  assert.equal(scheduler.validateCronExpression("*/5 * * * * *"), true);
  assert.equal(scheduler.validateCronExpression("invalid cron"), false);
  const scheduledDate = scheduler.normalizeScheduledDate(new Date("2026-07-24T06:42:35.987Z"));
  assert.equal(scheduledDate.toISOString(), "2026-07-24T06:42:35.000Z");
});
