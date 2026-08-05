const cron = require("node-cron");
const AppError = require("../../common/errors/app-error");
const repository = require("./data-development.repository");
const { getAdapter } = require("./adapters");
const {
  buildResultPreview,
  decryptSecret,
  formatDateTime,
  isQuerySql,
  normalizeDatasourceStorageType,
  resolveRuntimeDatasourceConfig,
} = require("./data-development.utils");

const scheduledTasks = new Map();
const activeRuns = new Set();

function materializeDatasource(datasource) {
  const password = decryptSecret(datasource.passwordEncrypted);
  const resolved = resolveRuntimeDatasourceConfig({
    ...datasource,
    password,
  });
  return {
    ...datasource,
    type: resolved.dialect,
    storageType: normalizeDatasourceStorageType(datasource.type),
    host: resolved.host,
    port: resolved.port,
    databaseName: resolved.databaseName,
    username: resolved.username,
    extraConfig: resolved.extraConfig,
    password,
  };
}

function buildNodeLookup(nodes) {
  return new Map(nodes.map((node) => [node.nodeKey, node]));
}

function buildEdgeLookup(edges) {
  const outgoing = new Map();
  for (const edge of edges) {
    if (!outgoing.has(edge.sourceNodeKey)) {
      outgoing.set(edge.sourceNodeKey, []);
    }
    outgoing.get(edge.sourceNodeKey).push(edge);
  }
  return outgoing;
}

function buildTopologicalOrder(nodes, edges) {
  const inDegree = new Map(nodes.map((node) => [node.nodeKey, 0]));
  const graph = new Map(nodes.map((node) => [node.nodeKey, []]));

  for (const edge of edges) {
    if (!graph.has(edge.sourceNodeKey) || !graph.has(edge.targetNodeKey)) {
      throw new AppError(`Workflow edge references unknown node: ${edge.sourceNodeKey} -> ${edge.targetNodeKey}`, 400);
    }
    graph.get(edge.sourceNodeKey).push(edge.targetNodeKey);
    inDegree.set(edge.targetNodeKey, (inDegree.get(edge.targetNodeKey) || 0) + 1);
  }

  const queue = nodes.filter((node) => (inDegree.get(node.nodeKey) || 0) === 0).map((node) => node.nodeKey);
  const order = [];

  while (queue.length) {
    const nodeKey = queue.shift();
    order.push(nodeKey);
    for (const next of graph.get(nodeKey) || []) {
      inDegree.set(next, (inDegree.get(next) || 0) - 1);
      if ((inDegree.get(next) || 0) === 0) {
        queue.push(next);
      }
    }
  }

  if (order.length !== nodes.length) {
    throw new AppError("Workflow graph contains a cycle", 400);
  }

  return order;
}

async function runWithTimeout(task, timeoutSec) {
  const timeoutMs = Math.max(1, Number(timeoutSec || 300)) * 1000;
  let timer;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Execution timed out after ${timeoutSec}s`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function appendLog(instanceId, logType, content) {
  await repository.createJobLog({
    instanceId,
    logType,
    content,
  });
}

function resolveRuntimeParams(workflow, run) {
  const defaults = workflow.runtimeConfig?.defaultParams;
  return {
    ...(defaults && typeof defaults === "object" ? defaults : {}),
    ...(run.runParams && typeof run.runParams === "object" ? run.runParams : {}),
  };
}

function interpolateTemplate(value, params) {
  return String(value ?? "").replace(/\$\{([^}]+)\}/g, (_, key) => {
    const trimmedKey = String(key || "").trim();
    const replacement = params[trimmedKey];
    return replacement === null || replacement === undefined ? "" : String(replacement);
  });
}

function parseScalarValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }
  if (/^(true|false)$/i.test(text)) {
    return text.toLowerCase() === "true";
  }
  if (/^null$/i.test(text)) {
    return null;
  }
  const numeric = Number(text);
  if (!Number.isNaN(numeric) && text === String(numeric)) {
    return numeric;
  }
  return text;
}

function compareBranchValue(actualValue, operator, expectedValue) {
  const op = String(operator || "eq").toLowerCase();
  const actual = parseScalarValue(actualValue);
  const expected = parseScalarValue(expectedValue);

  switch (op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return String(actual ?? "").includes(String(expected ?? ""));
    case "in": {
      const candidates = Array.isArray(expected)
        ? expected
        : String(expected ?? "")
          .split(",")
          .map((item) => parseScalarValue(item));
      return candidates.some((candidate) => candidate === actual);
    }
    default:
      throw new Error(`Unsupported branch operator: ${operator}`);
  }
}

function extractFirstCell(result) {
  const firstRow = Array.isArray(result?.rows) ? result.rows[0] : null;
  if (!firstRow || typeof firstRow !== "object") {
    return null;
  }
  const firstKey = Object.keys(firstRow)[0];
  return firstKey ? firstRow[firstKey] : null;
}

async function markInstanceSuccess(instance, payload = {}) {
  const finishedAt = new Date();
  return repository.updateJobInstance(instance.id, {
    status: "success",
    startedAt: instance.startedAt || new Date(),
    finishedAt,
    durationMs: finishedAt.getTime() - new Date(instance.startedAt || finishedAt).getTime(),
    retryCount: payload.retryCount || 0,
    errorMessage: null,
    resultPreview: payload.resultPreview || null,
    branchResult: payload.branchResult || null,
  });
}

async function markInstanceFailure(instance, error, retryCount = 0) {
  const finishedAt = new Date();
  return repository.updateJobInstance(instance.id, {
    status: "failed",
    startedAt: instance.startedAt || new Date(),
    finishedAt,
    durationMs: finishedAt.getTime() - new Date(instance.startedAt || finishedAt).getTime(),
    retryCount,
    errorMessage: error?.message || "Node execution failed",
    resultPreview: null,
    branchResult: null,
  });
}

function waitForRetry(seconds) {
  const delayMs = Math.max(0, Number(seconds || 0)) * 1000;
  if (!delayMs) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function executeScriptNode({ node, instance, params }) {
  const script = await repository.getScriptById(node.scriptId);
  if (!script) {
    throw new AppError(`Script not found for node ${node.nodeName}`, 404);
  }

  const datasource = await repository.getDatasourceById(script.datasourceId, true);
  if (!datasource) {
    throw new AppError(`Datasource not found for script ${script.name}`, 404);
  }

  const connection = materializeDatasource(datasource);
  const adapter = getAdapter(connection);
  const resultLimit = Number(node.nodeConfig?.resultLimit || 200);
  const databaseName = interpolateTemplate(
    node.nodeConfig?.databaseName || script.defaultDatabase || datasource.databaseName || "",
    params
  ) || undefined;
  const renderedSql = interpolateTemplate(script.content, params);

  await appendLog(instance.id, "sql", renderedSql);
  const result = isQuerySql(renderedSql)
    ? await adapter.executeQuery(connection, renderedSql, { databaseName, resultLimit })
    : await adapter.executeStatement(connection, renderedSql, { databaseName });
  return { resultPreview: buildResultPreview(result) };
}

async function executeBranchNode({ node, instance, params, edgeLookup }) {
  const datasourceId = Number(node.nodeConfig?.datasourceId || 0);
  if (!datasourceId) {
    throw new Error(`Branch node ${node.nodeName} is missing datasource configuration`);
  }

  const datasource = await repository.getDatasourceById(datasourceId, true);
  if (!datasource) {
    throw new AppError(`Datasource not found for branch node ${node.nodeName}`, 404);
  }

  const connection = materializeDatasource(datasource);
  const adapter = getAdapter(connection);
  const resultLimit = Number(node.nodeConfig?.resultLimit || 1);
  const databaseName = interpolateTemplate(
    node.nodeConfig?.databaseName || datasource.databaseName || "",
    params
  ) || undefined;
  const sqlText = interpolateTemplate(node.nodeConfig?.sqlText || "", params);
  if (!isQuerySql(sqlText)) {
    throw new Error(`Branch node ${node.nodeName} must use query SQL`);
  }

  const operator = node.nodeConfig?.operator || "eq";
  const expectedValue = interpolateTemplate(node.nodeConfig?.expectedValue ?? "", params);
  await appendLog(instance.id, "sql", sqlText);

  const result = await adapter.executeQuery(connection, sqlText, { databaseName, resultLimit });

  const actualValue = extractFirstCell(result);
  const matched = result.rowCount
    ? compareBranchValue(actualValue, operator, expectedValue)
    : Boolean(node.nodeConfig?.emptyAs);
  const selectedEdgeLabel = matched ? "true" : "false";
  const outgoing = edgeLookup.get(node.nodeKey) || [];
  const selectedEdge = outgoing.find((edge) => String(edge.edgeLabel || "default").toLowerCase() === selectedEdgeLabel);
  if (!selectedEdge) {
    throw new Error(`Branch node ${node.nodeName} cannot find ${selectedEdgeLabel} edge`);
  }

  const branchResult = {
    actualValue,
    expectedValue: parseScalarValue(expectedValue),
    operator,
    matched,
    selectedEdgeLabel,
  };

  await appendLog(
    instance.id,
    "branch",
    `Branch result: actual=${String(actualValue)} operator=${operator} expected=${String(expectedValue)} matched=${matched}`
  );
  await appendLog(instance.id, "route", `Branch selected ${selectedEdgeLabel} -> ${selectedEdge.targetNodeKey}`);

  return {
    selectedEdgeLabel,
    resultPreview: buildResultPreview(result),
    branchResult,
  };
}

async function executePassiveNode({ node, instance }) {
  await appendLog(instance.id, "info", `Node ${node.nodeName} executed`);
  return { resultPreview: null };
}

async function executeProcessingNode({ node, params }) {
  const service = require("./data-development.service");
  const result = await service.runProcessingJob(node.processingJobId, {
    triggerType: "workflow",
    ...(node.nodeConfig?.versionNo ? { versionNo: Number(node.nodeConfig.versionNo) } : {}),
    ...(node.nodeConfig?.outputMode ? { outputMode: node.nodeConfig.outputMode } : {}),
    ...(node.nodeConfig?.targetTableName
      ? { targetTableName: interpolateTemplate(node.nodeConfig.targetTableName, params) }
      : {}),
  });
  if (result?.runStatus === "failed") {
    throw new Error(result.errorMessage || `数据处理任务 ${node.nodeName} 执行失败`);
  }
  return {
    resultPreview: result?.resultPreview || {
      rowCount: result?.outputRowCount || 0,
      affectedRows: result?.affectedRows || 0,
    },
  };
}

async function executeOperatorTaskNode({ node }) {
  const service = require("./data-development.service");
  const result = await service.runOrchestration(node.orchestrationTaskId);
  return {
    resultPreview: {
      rowCount: 0,
      affectedRows: result?.statementCount || 0,
      rows: [{ targetTables: result?.targetTables || [], warnings: result?.warnings || [] }],
    },
  };
}

async function executeNodeOnce(context) {
  switch (context.node.nodeType) {
    case "start":
    case "end":
    case "parallel":
    case "join":
      return executePassiveNode(context);
    case "script":
      return executeScriptNode(context);
    case "processing":
      return executeProcessingNode(context);
    case "operator_task":
      return executeOperatorTaskNode(context);
    case "branch":
      return executeBranchNode(context);
    default:
      throw new Error(`Unsupported node type: ${context.node.nodeType}`);
  }
}

async function executeNodeWithRetry({ workflow, run, node, params, edgeLookup, workflowAttempt }) {
  const startedAt = new Date();
  const instance = {
    ...await repository.createJobInstance({
      workflowRunId: run.id,
      workflowId: workflow.id,
      workflowNodeId: node.id,
      nodeType: node.nodeType,
      scriptId: node.scriptId,
      processingJobId: node.processingJobId,
      orchestrationTaskId: node.orchestrationTaskId,
      triggerType: run.triggerType,
      status: "running",
      startedAt,
      retryCount: 0,
      runAttempt: workflowAttempt,
    }),
    // MySQL DATETIME columns do not preserve milliseconds. Keep the in-memory
    // start time so sub-second nodes never produce a negative duration.
    startedAt,
  };
  await appendLog(instance.id, "info", `节点 ${node.nodeName} 于 ${formatDateTime()} 开始执行`);

  const retryTimes = node.retryTimes === null || node.retryTimes === undefined
    ? Number(node.nodeConfig?.retryTimes || 0)
    : Number(node.retryTimes);
  const retryIntervalSec = Number(node.retryIntervalSec ?? node.nodeConfig?.retryIntervalSec ?? 5);
  const timeoutSec = Number(node.timeoutSec ?? node.nodeConfig?.timeoutSec ?? workflow.timeoutSec ?? 300);
  let lastError;

  for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
    if (attempt > 0) {
      await appendLog(instance.id, "retry", `节点重试 ${attempt}/${retryTimes}，等待 ${retryIntervalSec} 秒`);
      await waitForRetry(retryIntervalSec);
    }
    try {
      const outcome = await runWithTimeout(
        () => executeNodeOnce({ workflow, run, node, instance, params, edgeLookup }),
        timeoutSec
      );
      await markInstanceSuccess(instance, {
        retryCount: attempt,
        resultPreview: outcome?.resultPreview || null,
        branchResult: outcome?.branchResult || null,
      });
      await appendLog(instance.id, "success", `节点 ${node.nodeName} 执行成功`);
      return { success: true, outcome: outcome || {}, instance };
    } catch (error) {
      lastError = error;
      await appendLog(instance.id, "error", error.message || "节点执行失败");
    }
  }

  await markInstanceFailure(instance, lastError, retryTimes);
  return { success: false, error: lastError || new Error(`节点 ${node.nodeName} 执行失败`), instance };
}

function buildDagState(nodes, edges) {
  const nodeLookup = buildNodeLookup(nodes);
  const incoming = new Map(nodes.map((node) => [node.nodeKey, []]));
  const outgoing = new Map(nodes.map((node) => [node.nodeKey, []]));
  const edgeStates = new Map();

  edges.forEach((edge, index) => {
    const runtimeEdge = { ...edge, runtimeKey: `${edge.sourceNodeKey}:${edge.targetNodeKey}:${edge.edgeLabel || "default"}:${index}` };
    incoming.get(edge.targetNodeKey)?.push(runtimeEdge);
    outgoing.get(edge.sourceNodeKey)?.push(runtimeEdge);
    edgeStates.set(runtimeEdge.runtimeKey, "pending");
  });

  return { nodeLookup, incoming, outgoing, edgeStates };
}

function settleOutgoingEdges(node, success, outcome, dag) {
  const outgoing = dag.outgoing.get(node.nodeKey) || [];
  for (const edge of outgoing) {
    let state = success || node.nodeType !== "branch" ? "active" : "inactive";
    if (node.nodeType === "branch" && success) {
      state = String(edge.edgeLabel || "default").toLowerCase() === outcome.selectedEdgeLabel ? "active" : "inactive";
    }
    dag.edgeStates.set(edge.runtimeKey, state);
  }
}

function deactivateOutgoingEdges(node, dag) {
  for (const edge of dag.outgoing.get(node.nodeKey) || []) {
    dag.edgeStates.set(edge.runtimeKey, "inactive");
  }
}

async function createSkippedInstance(workflow, run, node, workflowAttempt, reason) {
  const now = new Date();
  const instance = await repository.createJobInstance({
    workflowRunId: run.id,
    workflowId: workflow.id,
    workflowNodeId: node.id,
    nodeType: node.nodeType,
    scriptId: node.scriptId,
    processingJobId: node.processingJobId,
    orchestrationTaskId: node.orchestrationTaskId,
    triggerType: run.triggerType,
    status: "skipped",
    startedAt: now,
    retryCount: 0,
    runAttempt: workflowAttempt,
  });
  await repository.updateJobInstance(instance.id, {
    status: "skipped",
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    retryCount: 0,
    errorMessage: reason,
    resultPreview: null,
    branchResult: null,
  });
  await appendLog(instance.id, "skip", reason);
}

async function executeDag(workflow, run, workflowAttempt) {
  buildTopologicalOrder(workflow.nodes, workflow.edges);
  const dag = buildDagState(workflow.nodes, workflow.edges);
  const statuses = new Map(workflow.nodes.map((node) => [node.nodeKey, "pending"]));
  const params = resolveRuntimeParams(workflow, run);

  while ([...statuses.values()].some((status) => status === "pending")) {
    const ready = [];
    let progressed = false;

    for (const node of workflow.nodes) {
      if (statuses.get(node.nodeKey) !== "pending") continue;
      const incoming = dag.incoming.get(node.nodeKey) || [];
      if (!incoming.length) {
        if (node.nodeType === "start") ready.push(node);
        continue;
      }
      if (!incoming.every((edge) => dag.edgeStates.get(edge.runtimeKey) !== "pending")) continue;

      const activeIncoming = incoming.filter((edge) => dag.edgeStates.get(edge.runtimeKey) === "active");
      if (!activeIncoming.length) {
        statuses.set(node.nodeKey, "skipped");
        deactivateOutgoingEdges(node, dag);
        await createSkippedInstance(workflow, run, node, workflowAttempt, "上游分支未激活，节点已跳过");
        progressed = true;
        continue;
      }

      const triggerRule = node.triggerRule || "all_success";
      const activeSourceStatuses = activeIncoming.map((edge) => statuses.get(edge.sourceNodeKey));
      if (triggerRule === "all_success" && activeSourceStatuses.some((status) => status !== "success")) {
        statuses.set(node.nodeKey, "skipped");
        deactivateOutgoingEdges(node, dag);
        await createSkippedInstance(workflow, run, node, workflowAttempt, "上游存在失败节点，未满足全部成功触发规则");
        progressed = true;
        continue;
      }
      ready.push(node);
    }

    if (ready.length) {
      progressed = true;
      ready.forEach((node) => statuses.set(node.nodeKey, "running"));
      const results = await Promise.all(ready.map((node) => executeNodeWithRetry({
        workflow,
        run,
        node,
        params,
        edgeLookup: dag.outgoing,
        workflowAttempt,
      })));
      results.forEach((result, index) => {
        const node = ready[index];
        statuses.set(node.nodeKey, result.success ? "success" : "failed");
        settleOutgoingEdges(node, result.success, result.outcome || {}, dag);
      });
    }

    if (!progressed) {
      const pendingNames = workflow.nodes
        .filter((node) => statuses.get(node.nodeKey) === "pending")
        .map((node) => node.nodeName)
        .join("、");
      throw new Error(`工作流无法继续推进，待处理节点：${pendingNames}`);
    }
  }

  const failedNodes = workflow.nodes.filter((node) => statuses.get(node.nodeKey) === "failed");
  if (failedNodes.length) {
    throw new Error(`工作流存在失败节点：${failedNodes.map((node) => node.nodeName).join("、")}`);
  }
  return statuses;
}

function resolveRunWorkflow(currentWorkflow, run) {
  const snapshot = run.graphSnapshot;
  if (!snapshot || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
    return currentWorkflow;
  }
  return {
    ...currentWorkflow,
    name: snapshot.name || currentWorkflow.name,
    retryTimes: Number(snapshot.retryTimes ?? currentWorkflow.retryTimes ?? 0),
    timeoutSec: Number(snapshot.timeoutSec ?? currentWorkflow.timeoutSec ?? 300),
    runtimeConfig: snapshot.runtimeConfig || currentWorkflow.runtimeConfig || {},
    nodes: snapshot.nodes,
    edges: snapshot.edges,
  };
}

async function executeWorkflowRun(runId) {
  if (activeRuns.has(runId)) return;
  activeRuns.add(runId);
  const runStartedAt = new Date();

  try {
    const run = await repository.getWorkflowRunById(runId);
    if (!run) throw new AppError("Workflow run not found", 404);
    const currentWorkflow = await repository.getWorkflowById(run.workflowId);
    if (!currentWorkflow) throw new AppError("Workflow not found", 404);
    const workflow = resolveRunWorkflow(currentWorkflow, run);
    if (!workflow.nodes.length) throw new AppError("Workflow has no nodes", 400);

    await repository.updateWorkflowRun(runId, {
      status: "running",
      startedAt: runStartedAt,
      finishedAt: null,
      durationMs: null,
      errorMessage: null,
      workflowRetryCount: 0,
    });

    const workflowRetryTimes = Number(workflow.retryTimes || 0);
    let lastError;
    for (let attempt = 0; attempt <= workflowRetryTimes; attempt += 1) {
      if (attempt > 0) {
        await repository.updateWorkflowRun(runId, {
          status: "running",
          startedAt: runStartedAt,
          finishedAt: null,
          durationMs: null,
          errorMessage: lastError?.message || null,
          workflowRetryCount: attempt,
        });
      }
      try {
        await executeDag(workflow, run, attempt + 1);
        const finishedAt = new Date();
        await repository.updateWorkflowRun(runId, {
          status: "success",
          startedAt: runStartedAt,
          finishedAt,
          durationMs: finishedAt.getTime() - runStartedAt.getTime(),
          errorMessage: null,
          workflowRetryCount: attempt,
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Workflow execution failed");
  } catch (error) {
    const finishedAt = new Date();
    await repository.updateWorkflowRun(runId, {
      status: "failed",
      startedAt: runStartedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - runStartedAt.getTime(),
      errorMessage: error.message || "Workflow execution failed",
      workflowRetryCount: Number((await repository.getWorkflowRunById(runId))?.workflowRetryCount || 0),
    });
  } finally {
    activeRuns.delete(runId);
  }
}

function enqueueWorkflowRun(runId) {
  setTimeout(() => {
    void executeWorkflowRun(runId);
  }, 0);
}

function clearSchedule(workflowId) {
  const existing = scheduledTasks.get(workflowId);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(workflowId);
  }
}

function normalizeScheduledDate(value = new Date()) {
  const scheduledDate = new Date(value);
  scheduledDate.setMilliseconds(0);
  return scheduledDate;
}

function upsertWorkflowSchedule(workflow) {
  clearSchedule(workflow.id);

  if (!workflow.cronExpr || workflow.isPaused || !workflow.publishedVersionNo) {
    return;
  }

  if (!cron.validate(workflow.cronExpr)) {
    return;
  }

  const task = cron.schedule(workflow.cronExpr, async () => {
    try {
      const version = await repository.getPublishedWorkflowVersion(workflow.id);
      if (!version) return;
      const scheduledDate = normalizeScheduledDate();
      const scheduledAt = formatDateTime(scheduledDate);
      const existing = await repository.findScheduledWorkflowRun(workflow.id, scheduledAt);
      if (existing) return;
      const run = await repository.createWorkflowRun({
        workflowId: workflow.id,
        triggerType: "cron",
        runParams: {},
        status: "pending",
        workflowVersionNo: version.versionNo,
        graphSnapshot: version.graphSnapshot,
        workflowRetryCount: 0,
        scheduledAt,
        startedAt: null,
      });
      enqueueWorkflowRun(run.id);
    } catch (error) {
      console.error(`[workflow-scheduler] failed to create scheduled run for workflow ${workflow.id}:`, error);
    }
  });
  scheduledTasks.set(workflow.id, task);
}

async function reloadSchedules() {
  const workflows = await repository.listWorkflows();
  const workflowIds = new Set(workflows.map((workflow) => workflow.id));
  for (const workflowId of scheduledTasks.keys()) {
    if (!workflowIds.has(workflowId)) {
      clearSchedule(workflowId);
    }
  }
  for (const workflow of workflows) {
    upsertWorkflowSchedule(workflow);
  }
}

async function startScheduler() {
  await reloadSchedules();
  const recoverableRuns = await repository.listRecoverableWorkflowRuns();
  for (const run of recoverableRuns) {
    enqueueWorkflowRun(run.id);
  }
}

module.exports = {
  buildTopologicalOrder,
  executeDag,
  enqueueWorkflowRun,
  executeWorkflowRun,
  reloadSchedules,
  normalizeScheduledDate,
  startScheduler,
  upsertWorkflowSchedule,
  validateCronExpression: cron.validate,
};
