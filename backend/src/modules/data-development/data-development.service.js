const AppError = require("../../common/errors/app-error");
const repository = require("./data-development.repository");
const scheduler = require("./data-development.scheduler");
const copilot = require("./data-development.copilot");
const orchestrationCompiler = require("./data-development.orchestration-compiler");
const modelProviderService = require("../model-providers/model-provider.service");
const { testDatabaseConnection } = require("../data-sources/data-source.test-connection");
const { getAdapter } = require("./adapters");
const {
  buildDatasourceEnvironmentSignature,
  buildResultPreview,
  decryptSecret,
  encryptSecret,
  formatDateTime,
  inferDatasourceDialect,
  isPendingProcessingSourceTable,
  isQuerySql,
  normalizeDatasourceType,
  normalizeDatasourceStorageType,
  previewRows,
  quoteIdentifier,
  resolveRuntimeDatasourceConfig,
} = require("./data-development.utils");

function normalizeSqlDialect(dialect) {
  const normalized = normalizeDatasourceType(dialect);
  if (normalized === "gaussdb") return "postgresql";
  return normalized;
}

function buildIdentifierRef(alias, fieldName, dialect) {
  return `${alias}.${quoteIdentifier(fieldName, dialect)}`;
}

function toPostgresDatePattern(format) {
  return String(format || "%Y-%m-%d")
    .replace(/%Y/g, "YYYY")
    .replace(/%m/g, "MM")
    .replace(/%d/g, "DD")
    .replace(/%H/g, "HH24")
    .replace(/%i/g, "MI")
    .replace(/%s/g, "SS");
}

function toOracleDatePattern(format) {
  return String(format || "%Y-%m-%d")
    .replace(/%Y/g, "YYYY")
    .replace(/%m/g, "MM")
    .replace(/%d/g, "DD")
    .replace(/%H/g, "HH24")
    .replace(/%i/g, "MI")
    .replace(/%s/g, "SS");
}

function normalizeRegexPattern(pattern) {
  const rawPattern = String(pattern || "");
  if (!rawPattern) return { isRegex: true, value: rawPattern };
  try {
    new RegExp(rawPattern);
    return { isRegex: true, value: rawPattern };
  } catch (error) {
    return { isRegex: false, value: rawPattern };
  }
}

function buildRegexReplaceExpression(fieldExpression, pattern, replacement, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const normalizedPattern = normalizeRegexPattern(pattern);
  const safePattern = normalizedPattern.value.replace(/'/g, "''");
  const safeReplacement = String(replacement || "").replace(/'/g, "''");
  if (!normalizedPattern.isRegex) {
    return `REPLACE(${fieldExpression}, '${safePattern}', '${safeReplacement}')`;
  }
  if (["postgresql", "oracle", "dm", "hive", "mysql"].includes(normalizedDialect)) {
    return `REGEXP_REPLACE(${fieldExpression}, '${safePattern}', '${safeReplacement}')`;
  }
  return `REGEXP_REPLACE(${fieldExpression}, '${safePattern}', '${safeReplacement}')`;
}

function buildSubstringExpression(fieldExpression, start, length, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const safeStart = Math.max(Number(start || 0), 0);
  const startPos = safeStart + 1;
  if (length === null || length === undefined || length === "") {
    if (normalizedDialect === "postgresql") {
      return `SUBSTRING(${fieldExpression} FROM ${startPos})`;
    }
    return `SUBSTR(${fieldExpression}, ${startPos})`;
  }
  const safeLength = Math.max(Number(length || 0), 0);
  if (normalizedDialect === "postgresql") {
    return `SUBSTRING(${fieldExpression} FROM ${startPos} FOR ${safeLength})`;
  }
  return `SUBSTR(${fieldExpression}, ${startPos}, ${safeLength})`;
}

const FULL_WIDTH_CHARS = "　！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～";
const HALF_WIDTH_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

function buildReplaceChainExpression(fieldExpression, searchChars, replaceChars) {
  let expression = fieldExpression;
  for (let index = 0; index < searchChars.length; index += 1) {
    const search = escapeSqlString(searchChars[index]);
    const replacement = escapeSqlString(replaceChars[index] || "");
    expression = `REPLACE(${expression}, '${search}', '${replacement}')`;
  }
  return expression;
}

function buildWidthConvertExpression(fieldExpression, direction, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const fromChars = direction === "full_to_half" ? FULL_WIDTH_CHARS : HALF_WIDTH_CHARS;
  const toChars = direction === "full_to_half" ? HALF_WIDTH_CHARS : FULL_WIDTH_CHARS;
  if (["postgresql", "oracle", "dm", "hive"].includes(normalizedDialect)) {
    return `TRANSLATE(${fieldExpression}, '${escapeSqlString(fromChars)}', '${escapeSqlString(toChars)}')`;
  }
  return buildReplaceChainExpression(fieldExpression, fromChars, toChars);
}

function buildCharLengthExpression(fieldExpression, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  return ["oracle", "dm"].includes(normalizedDialect) ? `LENGTH(${fieldExpression})` : `CHAR_LENGTH(${fieldExpression})`;
}

function buildStringConcatExpression(parts, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  if (["postgresql", "oracle", "dm", "hive"].includes(normalizedDialect)) {
    return parts.join(" || ");
  }
  return `CONCAT(${parts.join(", ")})`;
}

function buildLeftExpression(fieldExpression, length, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const safeLength = Math.max(0, Number(length || 0));
  if (normalizedDialect === "postgresql") {
    return `SUBSTRING(${fieldExpression} FROM 1 FOR ${safeLength})`;
  }
  return `SUBSTR(${fieldExpression}, 1, ${safeLength})`;
}

function buildHashExpression(fieldExpression, algorithm, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const safeAlgorithm = String(algorithm || "md5").toLowerCase();
  if (normalizedDialect === "oracle") {
    const oracleAlgorithm = safeAlgorithm === "sha1" ? "SHA1" : safeAlgorithm === "sha256" ? "SHA256" : "MD5";
    return `STANDARD_HASH(${fieldExpression}, '${oracleAlgorithm}')`;
  }
  if (safeAlgorithm === "sha1") {
    return `SHA1(${fieldExpression})`;
  }
  if (safeAlgorithm === "sha256") {
    return `SHA2(${fieldExpression}, 256)`;
  }
  return `MD5(${fieldExpression})`;
}

function buildRightExpression(fieldExpression, length, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const safeLength = Math.max(0, Number(length || 0));
  const charLength = ["oracle", "dm"].includes(normalizedDialect) ? `LENGTH(${fieldExpression})` : `CHAR_LENGTH(${fieldExpression})`;
  if (normalizedDialect === "postgresql") {
    return `SUBSTRING(${fieldExpression} FROM GREATEST(${charLength} - ${safeLength} + 1, 1))`;
  }
  return `SUBSTR(${fieldExpression}, GREATEST(${charLength} - ${safeLength} + 1, 1))`;
}

function buildMaskExpression(fieldExpression, prefixLength, suffixLength, dialect, maskChar = "*") {
  const source = fieldExpression;
  const normalizedDialect = normalizeSqlDialect(dialect);
  const lengthExpression = buildCharLengthExpression(source, dialect);
  const maskLength = `GREATEST(${lengthExpression} - ${Number(prefixLength)} - ${Number(suffixLength)}, 0)`;
  const maskLiteral = escapeSqlLiteral(maskChar);
  const repeatExpression = ["oracle", "dm"].includes(normalizedDialect)
    ? `RPAD(${maskLiteral}, ${maskLength}, ${maskLiteral})`
    : `REPEAT(${maskLiteral}, ${maskLength})`;
  return buildStringConcatExpression([
    buildLeftExpression(source, prefixLength, dialect),
    repeatExpression,
    buildRightExpression(source, suffixLength, dialect),
  ], dialect);
}

function buildEmailMaskExpression(fieldExpression, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  if (normalizedDialect === "postgresql") {
    return `REGEXP_REPLACE(${fieldExpression}, '^(.).+(@.+)$', '\\1***\\2')`;
  }
  return `REGEXP_REPLACE(${fieldExpression}, '^(.).+(@.+)$', '\\\\1***\\\\2')`;
}

function buildDesensitizeExpression(fieldExpression, config, columnMeta, dialect) {
  const transform = trimText(config.transform || config.maskType || "mask");
  const textExpression = isStringLikeColumn(columnMeta) ? fieldExpression : buildStringCastExpression(fieldExpression, dialect);
  if (transform === "encrypt" || transform === "hash") {
    const algorithm = String(config.encryptAlgorithm || config.hashAlgorithm || "md5").toLowerCase();
    return buildHashExpression(textExpression, algorithm, dialect);
  }
  if (transform === "replace") {
    const pattern = trimText(config.replacePattern || config.pattern);
    const replacement = String(config.replaceValue ?? config.replacement ?? "");
    if (!pattern) {
      throw new AppError(`步骤【${config.stepName || "脱敏规则"}】缺少替换规则`, 400);
    }
    return buildRegexReplaceExpression(textExpression, pattern, replacement, dialect);
  }
  if (transform === "generalize" || transform === "truncate") {
    const length = Math.max(0, Number(config.generalizeLength || config.truncateLength || 0));
    return buildLeftExpression(`COALESCE(${textExpression}, '')`, length, dialect);
  }
  const prefixLength = Math.max(0, Number(config.prefixLength || 0));
  const suffixLength = Math.max(0, Number(config.suffixLength || 0));
  const maskChar = String(config.maskChar || "*");
  return buildMaskExpression(textExpression, prefixLength, suffixLength, dialect, maskChar);
}

function materializeDatasource(datasource) {
  const password = decryptSecret(datasource.passwordEncrypted);
  const storageType = normalizeDatasourceStorageType(datasource.storageType || datasource.type);
  const resolved = resolveRuntimeDatasourceConfig({
    ...datasource,
    storageType,
    password,
  });
  return {
    ...datasource,
    type: resolved.dialect,
    storageType,
    host: resolved.host,
    port: resolved.port,
    databaseName: resolved.databaseName,
    username: resolved.username,
    extraConfig: resolved.extraConfig,
    password,
  };
}

function buildPersistenceDatasourcePayload(payload) {
  const resolved = resolveRuntimeDatasourceConfig(payload);
  if (!resolved.host || !resolved.port) {
    throw new AppError("Datasource host/port is required, or the JDBC URL must be parsable", 400);
  }

  return {
    ...payload,
    type: normalizeDatasourceStorageType(payload.type),
    host: resolved.host,
    port: Number(resolved.port),
    databaseName: resolved.databaseName || null,
    username: resolved.username || null,
    extraConfig: resolved.extraConfig,
  };
}

function hasPasswordValue(payload) {
  return Object.prototype.hasOwnProperty.call(payload, "password")
    && payload.password !== undefined
    && payload.password !== null
    && String(payload.password).length > 0;
}

async function requireDatasource(id, includePassword = false) {
  const datasource = await repository.getDatasourceById(id, includePassword);
  if (!datasource) {
    throw new AppError("Datasource not found", 404);
  }
  return datasource;
}

async function requireScript(id) {
  const script = await repository.getScriptById(id);
  if (!script) {
    throw new AppError("Script not found", 404);
  }
  return script;
}

async function requireWorkflow(id) {
  const workflow = await repository.getWorkflowById(id);
  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }
  return workflow;
}

async function requireOrchestrationTask(id) {
  const task = await repository.getOrchestrationTaskById(id);
  if (!task) {
    throw new AppError("Orchestration task not found", 404);
  }
  return task;
}

function buildWorkflowAdjacency(workflow) {
  const incoming = new Map();
  const outgoing = new Map();

  for (const node of workflow.nodes || []) {
    incoming.set(node.nodeKey, []);
    outgoing.set(node.nodeKey, []);
  }

  for (const edge of workflow.edges || []) {
    if (outgoing.has(edge.sourceNodeKey)) {
      outgoing.get(edge.sourceNodeKey).push(edge);
    }
    if (incoming.has(edge.targetNodeKey)) {
      incoming.get(edge.targetNodeKey).push(edge);
    }
  }

  return { incoming, outgoing };
}

function validateWorkflowGraph(workflow, options = {}) {
  const strict = Boolean(options.strict);
  const errors = [];
  let hasCycle = false;
  let executionOrder = [];

  try {
    executionOrder = scheduler.buildTopologicalOrder(workflow.nodes, workflow.edges);
  } catch (error) {
    hasCycle = true;
    errors.push(error.message || "Workflow graph contains a cycle");
  }

  if (!strict) {
    return {
      valid: errors.length === 0,
      hasCycle,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      executionOrder,
      errors,
    };
  }

  if (!workflow.nodes.length) {
    errors.push("Workflow has no nodes");
  }

  const starts = workflow.nodes.filter((node) => node.nodeType === "start");
  const ends = workflow.nodes.filter((node) => node.nodeType === "end");
  if (starts.length !== 1) {
    errors.push("Workflow must contain exactly one start node");
  }
  if (!ends.length) {
    errors.push("Workflow must contain at least one end node");
  }

  const { incoming, outgoing } = buildWorkflowAdjacency(workflow);

  for (const node of workflow.nodes) {
    const nodeIncoming = incoming.get(node.nodeKey) || [];
    const nodeOutgoing = outgoing.get(node.nodeKey) || [];

    if (node.nodeType !== "start" && !nodeIncoming.length) {
      errors.push(`节点 ${node.nodeName} 必须至少有一条输入连线`);
    }

    switch (node.nodeType) {
      case "start":
        if (nodeIncoming.length) {
          errors.push(`Start node ${node.nodeName} cannot have incoming edges`);
        }
        if (nodeOutgoing.length !== 1) {
          errors.push(`Start node ${node.nodeName} must have exactly one outgoing edge`);
        }
        break;
      case "end":
        if (nodeOutgoing.length) {
          errors.push(`End node ${node.nodeName} cannot have outgoing edges`);
        }
        break;
      case "script":
        if (!node.scriptId) {
          errors.push(`Script node ${node.nodeName} must bind a script`);
        }
        if (nodeOutgoing.length > 1) {
          errors.push(`Script node ${node.nodeName} can have at most one outgoing edge`);
        }
        break;
      case "processing":
        if (!node.processingJobId) {
          errors.push(`数据处理节点 ${node.nodeName} 必须绑定数据处理任务`);
        }
        if (nodeOutgoing.length > 1) {
          errors.push(`数据处理节点 ${node.nodeName} 最多只能有一条输出连线`);
        }
        break;
      case "operator_task":
        if (!node.orchestrationTaskId) {
          errors.push(`算子任务节点 ${node.nodeName} 必须绑定算子任务`);
        }
        if (nodeOutgoing.length > 1) {
          errors.push(`算子任务节点 ${node.nodeName} 最多只能有一条输出连线`);
        }
        break;
      case "branch": {
        if (nodeOutgoing.length !== 2) {
          errors.push(`Branch node ${node.nodeName} must have exactly two outgoing edges`);
        }
        const labels = new Set(nodeOutgoing.map((edge) => String(edge.edgeLabel || "default").toLowerCase()));
        if (!labels.has("true") || !labels.has("false")) {
          errors.push(`Branch node ${node.nodeName} must define true and false edges`);
        }
        if (!node.nodeConfig?.datasourceId) {
          errors.push(`Branch node ${node.nodeName} must configure a datasource`);
        }
        if (!String(node.nodeConfig?.sqlText || "").trim()) {
          errors.push(`Branch node ${node.nodeName} must configure branch SQL`);
        }
        if (!String(node.nodeConfig?.operator || "").trim()) {
          errors.push(`Branch node ${node.nodeName} must configure a comparison operator`);
        }
        break;
      }
      case "parallel":
        if (nodeOutgoing.length < 2) {
          errors.push(`并行分支节点 ${node.nodeName} 至少需要两条输出连线`);
        }
        break;
      case "join":
        if (nodeIncoming.length < 2) {
          errors.push(`并行汇聚节点 ${node.nodeName} 至少需要两条输入连线`);
        }
        if (nodeOutgoing.length > 1) {
          errors.push(`并行汇聚节点 ${node.nodeName} 最多只能有一条输出连线`);
        }
        if (!["all_success", "all_done"].includes(node.triggerRule || "all_success")) {
          errors.push(`并行汇聚节点 ${node.nodeName} 的触发规则无效`);
        }
        break;
      default:
        errors.push(`Unsupported node type: ${node.nodeType}`);
        break;
    }
  }

  if (starts.length === 1) {
    const visited = new Set();
    const stack = [starts[0].nodeKey];
    while (stack.length) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const edge of outgoing.get(current) || []) {
        stack.push(edge.targetNodeKey);
      }
    }

    for (const node of workflow.nodes) {
      if (!visited.has(node.nodeKey)) {
        errors.push(`Node ${node.nodeName} is unreachable from the start node`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    hasCycle,
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    executionOrder,
    errors,
  };
}

function buildWorkflowSnapshot(workflow) {
  return {
    workflowId: workflow.id,
    name: workflow.name,
    retryTimes: workflow.retryTimes,
    timeoutSec: workflow.timeoutSec,
    runtimeConfig: workflow.runtimeConfig || {},
    nodes: (workflow.nodes || []).map((node) => ({ ...node })),
    edges: (workflow.edges || []).map((edge) => ({ ...edge })),
  };
}

async function publishWorkflowGraph(workflow, validation) {
  const latestVersion = await repository.getLatestWorkflowVersion(workflow.id);
  const versionNo = Number(latestVersion?.versionNo || 0) + 1;
  const version = await repository.createWorkflowVersion(
    workflow.id,
    versionNo,
    buildWorkflowSnapshot(workflow),
    validation
  );
  await repository.updateWorkflowPublishedVersion(workflow.id, versionNo);
  return version;
}

async function listDatasources() {
  return repository.listDatasources();
}

async function getDatasource(id) {
  return requireDatasource(id);
}

async function createDatasource(payload) {
  const datasource = await repository.createDatasource({
    ...buildPersistenceDatasourcePayload(payload),
    passwordEncrypted: encryptSecret(payload.password),
  });
  return datasource;
}

async function updateDatasource(id, payload) {
  await requireDatasource(id, true);
  return repository.updateDatasource(id, {
    ...buildPersistenceDatasourcePayload(payload),
    ...(hasPasswordValue(payload) ? { passwordEncrypted: encryptSecret(payload.password) } : {}),
  });
}

async function deleteDatasource(id) {
  const deleted = await repository.deleteDatasource(id);
  if (!deleted) {
    throw new AppError("Datasource not found", 404);
  }
}

async function testDatasource(id) {
  const datasource = materializeDatasource(await requireDatasource(id, true));
  return testDatabaseConnection({
    host: datasource.host,
    port: datasource.port,
    database: datasource.databaseName,
    username: datasource.username,
    password: datasource.password,
    jdbcUrl: datasource.extraConfig?.jdbcUrl,
    schema: datasource.extraConfig?.schema,
    driverClassName: datasource.extraConfig?.driverClassName,
  }, datasource.storageType || datasource.type);
}

async function testDatasourceConfig(payload) {
  let password = payload.password;
  if (!hasPasswordValue(payload) && payload.datasourceId) {
    const existingDatasource = await requireDatasource(payload.datasourceId, true);
    password = decryptSecret(existingDatasource.passwordEncrypted);
  }
  const resolved = resolveRuntimeDatasourceConfig(payload);
  return testDatabaseConnection({
    host: resolved.host,
    port: resolved.port,
    database: resolved.databaseName,
    username: resolved.username,
    password: resolved.password || password,
    jdbcUrl: resolved.jdbcUrl,
    schema: resolved.schema,
    driverClassName: resolved.driverClassName,
  }, normalizeDatasourceStorageType(payload.type));
}

async function listDatasourceDatabases(id) {
  const datasource = materializeDatasource(await requireDatasource(id, true));
  const adapter = getAdapter(datasource);
  return adapter.getDatabases(datasource);
}

async function listDatasourceTables(id, databaseName) {
  const datasource = materializeDatasource(await requireDatasource(id, true));
  const adapter = getAdapter(datasource);
  return adapter.getTables(datasource, databaseName || datasource.databaseName);
}

async function listDatasourceColumns(id, databaseName, tableName) {
  if (!tableName) {
    throw new AppError("tableName is required", 400);
  }
  const datasource = materializeDatasource(await requireDatasource(id, true));
  const adapter = getAdapter(datasource);
  return adapter.getColumns(datasource, databaseName || datasource.databaseName, tableName);
}

async function listDatasourceFunctions(id, databaseName) {
  const datasource = materializeDatasource(await requireDatasource(id, true));
  const adapter = getAdapter(datasource);
  if (typeof adapter.getFunctions !== "function") {
    return [];
  }
  return adapter.getFunctions(datasource, databaseName || datasource.databaseName);
}

async function listScriptFolders() {
  return repository.listScriptFolders();
}

async function createScriptFolder(payload) {
  return repository.createScriptFolder(payload);
}

async function updateScriptFolder(id, payload) {
  const folder = await repository.updateScriptFolder(id, payload);
  if (!folder) {
    throw new AppError("Script folder not found", 404);
  }
  return folder;
}

async function deleteScriptFolder(id) {
  const deleted = await repository.deleteScriptFolder(id);
  if (!deleted) {
    throw new AppError("Script folder not found", 404);
  }
}

async function listScripts(filters) {
  return repository.listScripts(filters);
}

async function getScript(id) {
  return requireScript(id);
}

async function createScript(payload) {
  await requireDatasource(payload.datasourceId);
  const script = await repository.createScript({
    ...payload,
    currentVersion: 1,
  });
  await repository.createScriptVersion(script.id, 1, script.content);
  return requireScript(script.id);
}

async function updateScript(id, payload) {
  const existing = await requireScript(id);
  await requireDatasource(payload.datasourceId);
  const nextVersion = Number(existing.currentVersion || 1) + 1;
  const script = await repository.updateScript(id, {
    ...payload,
    currentVersion: nextVersion,
  });
  await repository.createScriptVersion(id, nextVersion, payload.content);
  return script;
}

async function deleteScript(id) {
  const deleted = await repository.deleteScript(id);
  if (!deleted) {
    throw new AppError("Script not found", 404);
  }
}

async function saveScriptVersion(id) {
  const script = await requireScript(id);
  const nextVersion = Number(script.currentVersion || 1) + 1;
  const updated = await repository.updateScript(id, {
    ...script,
    tags: script.tags || [],
    currentVersion: nextVersion,
  });
  await repository.createScriptVersion(id, nextVersion, script.content);
  return updated;
}

async function listScriptVersions(id) {
  await requireScript(id);
  return repository.listScriptVersions(id);
}

async function saveScriptAs(id, payload) {
  await requireScript(id);
  return createScript(payload);
}

async function executeQuery(payload) {
  const startedAt = Date.now();
  const datasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
  const adapter = getAdapter(datasource);
  const databaseName = payload.databaseName || datasource.databaseName;

  try {
    const result = isQuerySql(payload.sqlText)
      ? await adapter.executeQuery(datasource, payload.sqlText, {
          databaseName,
          resultLimit: payload.resultLimit || 200,
        })
      : await adapter.executeStatement(datasource, payload.sqlText, {
          databaseName,
        });

    const history = await repository.createQueryHistory({
      datasourceId: payload.datasourceId,
      scriptId: payload.scriptId,
      sqlText: payload.sqlText,
      databaseName,
      status: "success",
      durationMs: Date.now() - startedAt,
      errorMessage: null,
      resultPreview: buildResultPreview(result),
    });

    return {
      ...result,
      durationMs: Date.now() - startedAt,
      status: "success",
      executedAt: formatDateTime(),
      historyId: history.id,
    };
  } catch (error) {
    const history = await repository.createQueryHistory({
      datasourceId: payload.datasourceId,
      scriptId: payload.scriptId,
      sqlText: payload.sqlText,
      databaseName,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error.message || "Query execution failed",
      resultPreview: null,
    });

    return {
      fields: [],
      rows: [],
      rowCount: 0,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorMessage: error.message || "Query execution failed",
      executedAt: formatDateTime(),
      historyId: history.id,
    };
  }
}

async function listQueryHistory(filters) {
  return repository.listQueryHistory(filters);
}

function trimText(value) {
  return String(value || "").trim();
}

function buildProcessingSummary(pipeline = {}) {
  const steps = Array.isArray(pipeline.steps) ? pipeline.steps : [];
  return {
    stepCount: steps.length,
    enabledStepCount: steps.filter((item) => item.enabled !== false).length,
    stepTypes: steps.map((item) => item.stepType),
  };
}

function buildSourceRelation(databaseName, tableName, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const normalizedTableName = trimText(tableName);
  if (["postgresql", "gaussdb"].includes(normalizedDialect)) {
    return quoteIdentifier(normalizedTableName.includes(".") ? normalizedTableName : `public.${normalizedTableName}`, dialect);
  }
  if (normalizedTableName.includes(".")) {
    return quoteIdentifier(normalizedTableName, dialect);
  }
  return databaseName
    ? `${quoteIdentifier(databaseName, dialect)}.${quoteIdentifier(normalizedTableName, dialect)}`
    : quoteIdentifier(normalizedTableName, dialect);
}

function escapeSqlString(value) {
  return String(value || "").replace(/'/g, "''");
}

function buildScopeFilterExpression(scope, dialect) {
  const mode = trimText(scope?.mode) || "all";
  if (mode === "all") return "";

  const fieldName = trimText(scope?.fieldName);
  if (!fieldName) return "";

  const fieldRef = quoteIdentifier(fieldName, dialect);
  const normalizedDialect = normalizeSqlDialect(dialect);

  if (mode === "system_time_range") {
    const timeVariable = trimText(scope?.timeVariable) || "current_date";
    const startOffset = Number(scope?.startOffset ?? 0);
    const endOffset = Number(scope?.endOffset ?? 0);
    const offsetUnit = trimText(scope?.offsetUnit) || "day";

    const baseExpression = (() => {
      if (timeVariable === "current_timestamp") {
        return ["oracle", "dm"].includes(normalizedDialect) ? "SYSTIMESTAMP" : "CURRENT_TIMESTAMP";
      }
      if (timeVariable === "current_time") {
        return ["oracle", "dm"].includes(normalizedDialect) ? "CURRENT_TIMESTAMP" : "CURRENT_TIME";
      }
      return ["oracle", "dm"].includes(normalizedDialect) ? "TRUNC(SYSDATE)" : "CURRENT_DATE";
    })();

    const buildOffsetExpression = (offset) => {
      if (!offset) return baseExpression;
      if (normalizedDialect === "postgresql") {
        return `${baseExpression} ${offset >= 0 ? "+" : "-"} INTERVAL '${Math.abs(offset)} ${offsetUnit}'`;
      }
      if (["oracle", "dm"].includes(normalizedDialect)) {
        if (offsetUnit === "day") return `${baseExpression} ${offset >= 0 ? "+" : "-"} ${Math.abs(offset)}`;
        if (offsetUnit === "month") return `ADD_MONTHS(${baseExpression}, ${offset})`;
        if (offsetUnit === "hour") return `${baseExpression} ${offset >= 0 ? "+" : "-"} NUMTODSINTERVAL(${Math.abs(offset)}, 'HOUR')`;
        return `${baseExpression} ${offset >= 0 ? "+" : "-"} NUMTODSINTERVAL(${Math.abs(offset)}, 'MINUTE')`;
      }
      if (normalizedDialect === "hive") {
        if (offsetUnit === "day") return `DATE_ADD(${baseExpression}, ${offset})`;
        return `FROM_UNIXTIME(UNIX_TIMESTAMP(${baseExpression}) + ${offset} * ${offsetUnit === "hour" ? 3600 : offsetUnit === "minute" ? 60 : 2592000})`;
      }
      if (offsetUnit === "day") return `DATE_ADD(${baseExpression}, INTERVAL ${offset} DAY)`;
      if (offsetUnit === "month") return `DATE_ADD(${baseExpression}, INTERVAL ${offset} MONTH)`;
      if (offsetUnit === "hour") return `DATE_ADD(${baseExpression}, INTERVAL ${offset} HOUR)`;
      return `DATE_ADD(${baseExpression}, INTERVAL ${offset} MINUTE)`;
    };

    const expressions = [];
    expressions.push(`${fieldRef} >= ${buildOffsetExpression(startOffset)}`);
    expressions.push(`${fieldRef} <= ${buildOffsetExpression(endOffset)}`);
    return expressions.join(" AND ");
  }

  return "";
}

function resolveTargetExecutionConfig({ databaseName, tableName, pipeline, outputMode, targetTableName }) {
  const targetConfig = pipeline?.targetConfig || null;
  const targetMode = trimText(targetConfig?.targetMode) || "";
  const configTargetTableName = trimText(targetConfig?.targetTableName);
  const effectiveOutputMode = targetMode === "source"
    ? "overwrite_source"
    : targetMode === "existing"
      ? "new_table"
      : outputMode;

  const effectiveTargetTableName = targetMode === "source"
    ? tableName
    : (configTargetTableName || trimText(targetTableName));

  const effectiveDatabaseName = trimText(targetConfig?.targetDatabaseName) || databaseName;

  return {
    effectiveOutputMode,
    effectiveTargetTableName,
    effectiveDatabaseName,
    writeMode: trimText(targetConfig?.writeMode) || "overwrite",
    targetMode: targetMode || (outputMode === "overwrite_source" ? "source" : "create"),
  };
}

function buildNumericCastExpression(fieldExpression, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  if (normalizedDialect === "postgresql") return `CAST(${fieldExpression} AS NUMERIC)`;
  if (normalizedDialect === "oracle") return `CAST(${fieldExpression} AS NUMBER)`;
  if (normalizedDialect === "dm") return `CAST(${fieldExpression} AS DECIMAL(38,10))`;
  if (normalizedDialect === "hive") return `CAST(${fieldExpression} AS DECIMAL(38,10))`;
  return `CAST(${fieldExpression} AS DECIMAL(38,10))`;
}

function buildSafeNumericExpression(fieldExpression, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  const stringExpression = buildStringCastExpression(fieldExpression, dialect);
  const numericPattern = "^[-+]?[0-9]+(\\.[0-9]+)?$";
  if (normalizedDialect === "postgresql") {
    return `CASE WHEN ${stringExpression} ~ '${numericPattern}' THEN CAST(${fieldExpression} AS NUMERIC) ELSE NULL END`;
  }
  if (normalizedDialect === "oracle") {
    return `CASE WHEN REGEXP_LIKE(${stringExpression}, '${numericPattern}') THEN CAST(${fieldExpression} AS NUMBER) ELSE NULL END`;
  }
  if (normalizedDialect === "dm") {
    return `CASE WHEN REGEXP_LIKE(${stringExpression}, '${numericPattern}') THEN CAST(${fieldExpression} AS DECIMAL(38,10)) ELSE NULL END`;
  }
  if (normalizedDialect === "hive") {
    return `CASE WHEN ${stringExpression} RLIKE '${numericPattern}' THEN CAST(${fieldExpression} AS DECIMAL(38,10)) ELSE NULL END`;
  }
  return `CASE WHEN ${stringExpression} REGEXP '${numericPattern}' THEN CAST(${fieldExpression} AS DECIMAL(38,10)) ELSE NULL END`;
}

function getColumnName(column) {
  if (!column) return "";
  if (typeof column === "string") return trimText(column);
  return trimText(column.name || column.columnName || column.fieldName);
}

function getColumnMeta(columns, fieldName) {
  return (Array.isArray(columns) ? columns : []).find((item) => getColumnName(item) === fieldName) || null;
}

function isStringLikeColumn(columnMeta) {
  const type = String(columnMeta?.columnType || columnMeta?.dataType || "").toLowerCase();
  return /(char|text|string|json|xml|uuid|enum)/.test(type);
}

function buildStringCastExpression(fieldExpression, dialect) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  if (normalizedDialect === "postgresql") return `CAST(${fieldExpression} AS TEXT)`;
  if (normalizedDialect === "oracle") return `CAST(${fieldExpression} AS VARCHAR2(4000))`;
  if (normalizedDialect === "dm") return `CAST(${fieldExpression} AS VARCHAR(4000))`;
  if (normalizedDialect === "hive") return `CAST(${fieldExpression} AS STRING)`;
  return `CAST(${fieldExpression} AS CHAR)`;
}

function buildSelectListWithOverride(columns, alias, targetField, expression, dialect) {
  const normalizedColumns = Array.isArray(columns) ? columns.map((item) => getColumnName(item)).filter(Boolean) : [];
  if (!normalizedColumns.length) {
    return [`${alias}.*`, `${expression} AS ${quoteIdentifier(targetField, dialect)}`].join(", ");
  }

  const hasTarget = normalizedColumns.includes(targetField);
  const selectSegments = normalizedColumns.map((columnName) => (
    columnName === targetField
      ? `${expression} AS ${quoteIdentifier(columnName, dialect)}`
      : `${buildIdentifierRef(alias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`
  ));

  if (!hasTarget) {
    selectSegments.push(`${expression} AS ${quoteIdentifier(targetField, dialect)}`);
  }

  return selectSegments.join(", ");
}

function normalizeProcessingStepName(step, index) {
  return trimText(step.stepName) || `${step.stepType}_${index + 1}`;
}

function compileProcessingStepSql(step, relationName, dialect, availableColumns = []) {
  const config = step.config || {};
  switch (step.stepType) {
    case "filter": {
      const expression = trimText(config.expression);
      if (!expression) {
        throw new AppError(`步骤【${step.stepName}】缺少过滤表达式`, 400);
      }
      return `SELECT * FROM ${relationName} WHERE ${expression}`;
    }
    case "deduplicate": {
      const keyFields = Array.isArray(config.keyFields) ? config.keyFields.map((item) => trimText(item)).filter(Boolean) : [];
      if (!keyFields.length) {
        throw new AppError(`步骤【${step.stepName}】至少需要一个去重键`, 400);
      }
      const orderBy = trimText(config.orderBy) || keyFields.map((field) => quoteIdentifier(field, dialect)).join(", ");
      const partitionBy = keyFields.map((field) => quoteIdentifier(field, dialect)).join(", ");
      return [
        "SELECT *",
        "FROM (",
        `  SELECT src_.*, ROW_NUMBER() OVER (PARTITION BY ${partitionBy} ORDER BY ${orderBy}) AS __rn`,
        `  FROM ${relationName} src_`,
        ") dedup_",
        "WHERE __rn = 1",
      ].join("\n");
    }
    case "format": {
      const fieldName = trimText(config.fieldName);
      const transform = trimText(config.transform);
      if (!fieldName || !transform) {
        throw new AppError(`步骤【${step.stepName}】缺少字段或转换动作`, 400);
      }
      const target = quoteIdentifier(fieldName, dialect);
      const sourceExpression = buildIdentifierRef("src_", fieldName, dialect);
      const columnMeta = getColumnMeta(availableColumns, fieldName);
      const normalizedDialect = normalizeSqlDialect(dialect);
      let expression = sourceExpression;
      if (transform === "trim") {
        expression = `TRIM(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)})`;
      } else if (transform === "remove_spaces") {
        expression = `REPLACE(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)}, ' ', '')`;
      } else if (transform === "upper") {
        expression = `UPPER(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)})`;
      } else if (transform === "lower") {
        expression = `LOWER(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)})`;
      } else if (transform === "full_to_half" || transform === "half_to_full") {
        expression = buildWidthConvertExpression(
          isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect),
          transform,
          dialect
        );
      } else if (transform === "date_format") {
        const format = trimText(config.format) || "%Y-%m-%d";
        if (normalizedDialect === "postgresql") {
          expression = `TO_CHAR(${sourceExpression}, '${toPostgresDatePattern(format)}')`;
        } else if (["oracle", "dm"].includes(normalizedDialect)) {
          expression = `TO_CHAR(${sourceExpression}, '${toOracleDatePattern(format)}')`;
        } else if (normalizedDialect === "hive") {
          expression = `DATE_FORMAT(${sourceExpression}, '${format}')`;
        } else {
          expression = `DATE_FORMAT(${sourceExpression}, '${format}')`;
        }
      } else if (transform === "regex_replace") {
        const pattern = trimText(config.pattern);
        const replacement = String(config.replacement || "");
        if (!pattern) {
          throw new AppError(`步骤【${step.stepName}】缺少替换规则`, 400);
        }
        expression = buildRegexReplaceExpression(isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect), pattern, replacement, dialect);
      } else if (transform === "substring") {
        expression = buildSubstringExpression(isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect), config.start, config.length, dialect);
      } else if (transform === "blank_to_null") {
        const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
        expression = `NULLIF(TRIM(${textExpression}), '')`;
      } else if (transform === "null_to_default") {
        const defaultValue = escapeSqlString(String(config.defaultValue ?? ""));
        expression = `COALESCE(${sourceExpression}, '${defaultValue}')`;
      } else if (transform === "desensitize_mask" || transform === "mask_mobile" || transform === "mask_id_card" || transform === "mask_email") {
        const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
        const legacyPresetMap = {
          mask_mobile: { prefixLength: 3, suffixLength: 4, maskChar: "*" },
          mask_id_card: { prefixLength: 6, suffixLength: 4, maskChar: "*" },
          mask_email: { prefixLength: 1, suffixLength: 0, maskChar: "*" },
        };
        const preset = legacyPresetMap[transform] || {};
        expression = buildMaskExpression(
          textExpression,
          Number(config.prefixLength ?? preset.prefixLength ?? 0),
          Number(config.suffixLength ?? preset.suffixLength ?? 0),
          dialect,
          String(config.maskChar ?? preset.maskChar ?? "*")
        );
      } else if (transform === "desensitize_replace") {
        const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
        const pattern = trimText(config.replacePattern || config.pattern);
        const replacement = String(config.replaceValue ?? config.replacement ?? "");
        if (!pattern) {
          throw new AppError(`步骤【${step.stepName}】缺少替换规则`, 400);
        }
        expression = buildRegexReplaceExpression(textExpression, pattern, replacement, dialect);
      } else if (transform === "desensitize_encrypt") {
        const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
        const salt = String(config.salt || "");
        const source = salt ? `CONCAT(${textExpression}, '${escapeSqlString(salt)}')` : textExpression;
        const algorithm = String(config.encryptAlgorithm || "md5").toLowerCase();
        expression = buildHashExpression(source, algorithm, dialect);
      } else if (transform === "desensitize_generalize") {
        const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
        const length = Math.max(0, Number(config.generalizeLength ?? config.truncateLength ?? 0));
        expression = buildLeftExpression(`COALESCE(${textExpression}, '')`, length, dialect);
      } else if (transform === "number_round") {
        const precision = Math.max(0, Math.min(8, Number(config.precision || 0)));
        expression = `ROUND(${buildSafeNumericExpression(sourceExpression, dialect)}, ${precision})`;
      } else {
        throw new AppError(`暂不支持的格式转换类型：${transform}`, 400);
      }
      const selectList = buildSelectListWithOverride(availableColumns, "src_", fieldName, expression, dialect);
      return `SELECT ${selectList}\nFROM ${relationName} src_`;
    }
    case "validate": {
      const expression = trimText(config.expression);
      const mode = trimText(config.mode) || "keep_valid";
      const validationType = trimText(config.validationType);
      const fieldName = trimText(config.fieldName);
      if (!expression) {
        throw new AppError(`步骤【${step.stepName}】缺少校验表达式`, 400);
      }
      let finalExpression = expression;
      if (validationType === "range" && fieldName) {
        const fieldExpression = buildIdentifierRef("src_", fieldName, dialect);
        const numericFieldExpression = buildSafeNumericExpression(fieldExpression, dialect);
        const minValue = trimText(config.minValue);
        const maxValue = trimText(config.maxValue);
        if (minValue && maxValue) {
          finalExpression = `${numericFieldExpression} >= ${minValue} AND ${numericFieldExpression} <= ${maxValue}`;
        } else if (minValue) {
          finalExpression = `${numericFieldExpression} >= ${minValue}`;
        } else if (maxValue) {
          finalExpression = `${numericFieldExpression} <= ${maxValue}`;
        }
      } else if (validationType === "length" && fieldName) {
        const fieldExpression = buildIdentifierRef("src_", fieldName, dialect);
        const lengthExpression = buildCharLengthExpression(buildStringCastExpression(fieldExpression, dialect), dialect);
        const minLength = trimText(config.minLength);
        const maxLength = trimText(config.maxLength);
        if (minLength && maxLength) {
          finalExpression = `${lengthExpression} >= ${minLength} AND ${lengthExpression} <= ${maxLength}`;
        } else if (minLength) {
          finalExpression = `${lengthExpression} >= ${minLength}`;
        } else if (maxLength) {
          finalExpression = `${lengthExpression} <= ${maxLength}`;
        }
      }
      if (mode === "drop_invalid") {
        return `SELECT * FROM ${relationName} WHERE ${finalExpression}`;
      }
      const tagFieldName = trimText(config.tagFieldName) || "__validation_status";
      return `SELECT src_.*, CASE WHEN ${finalExpression} THEN 'valid' ELSE 'invalid' END AS ${quoteIdentifier(tagFieldName, dialect)}\nFROM ${relationName} src_`;
    }
    case "lookup_fill": {
      const lookupTable = trimText(config.lookupTable);
      const lookupSqlFilter = trimText(config.lookupSqlFilter);
      const sourceField = trimText(config.sourceField);
      const lookupKeyField = trimText(config.lookupKeyField);
      const lookupValueField = trimText(config.lookupValueField);
      const targetField = trimText(config.targetField) || lookupValueField;
      if (!lookupTable || !sourceField || !lookupKeyField || !lookupValueField) {
        throw new AppError(`步骤【${step.stepName}】缺少关联回填配置`, 400);
      }
      const hasExistingTarget = availableColumns.some((item) => getColumnName(item) === targetField);
      const targetExpression = hasExistingTarget
        ? `COALESCE(src_.${quoteIdentifier(targetField, dialect)}, lk_.${quoteIdentifier(lookupValueField, dialect)})`
        : `lk_.${quoteIdentifier(lookupValueField, dialect)}`;
      const selectList = buildSelectListWithOverride(availableColumns, "src_", targetField, targetExpression, dialect);
      return [
        `SELECT ${selectList}`,
        `FROM ${relationName} src_`,
        `LEFT JOIN ${lookupTable} lk_`,
        `  ON src_.${quoteIdentifier(sourceField, dialect)} = lk_.${quoteIdentifier(lookupKeyField, dialect)}${lookupSqlFilter ? ` AND (${lookupSqlFilter})` : ""}`,
      ].join("\n");
    }
    default:
      throw new AppError(`暂不支持的处理步骤类型：${step.stepType}`, 400);
  }
}

function compileProcessingPipeline({ databaseName, tableName, pipeline, dialect, outputMode, targetTableName, sourceColumns = [] }) {
  const steps = Array.isArray(pipeline.steps) ? pipeline.steps.filter((item) => item.enabled !== false) : [];
  const sourceRelation = buildSourceRelation(databaseName, tableName, dialect);
  const ctes = [];
  const scopeExpression = buildScopeFilterExpression(pipeline?.scope, dialect);
  let currentRelation = sourceRelation;
  let currentColumns = Array.isArray(sourceColumns) ? [...sourceColumns] : [];

  if (scopeExpression) {
    ctes.push({
      cteName: "scope_base",
      sql: `SELECT * FROM ${sourceRelation} WHERE ${scopeExpression}`,
      stepKey: "__scope__",
      stepName: "处理范围过滤",
      stepType: "filter",
    });
    currentRelation = "scope_base";
  }

  steps.forEach((step, index) => {
    const cteName = `step_${index + 1}_${normalizeProcessingStepName(step, index).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
    const sql = compileProcessingStepSql(step, currentRelation, dialect, currentColumns);
    ctes.push({ cteName, sql, stepKey: step.stepKey, stepName: step.stepName, stepType: step.stepType });
    currentRelation = cteName;
    if (step.stepType === "validate" && trimText(step.config?.mode) !== "drop_invalid") {
      const tagFieldName = trimText(step.config?.tagFieldName) || "__validation_status";
      if (!currentColumns.some((item) => getColumnName(item) === tagFieldName)) {
        currentColumns = [...currentColumns, { name: tagFieldName, dataType: "text", columnType: "text" }];
      }
    } else if (step.stepType === "lookup_fill") {
      const targetField = trimText(step.config?.targetField) || trimText(step.config?.lookupValueField);
      if (targetField && !currentColumns.some((item) => getColumnName(item) === targetField)) {
        currentColumns = [...currentColumns, {
          name: targetField,
          dataType: trimText(step.config?.targetFieldDataType) || "text",
          columnType: trimText(step.config?.targetFieldDataType) || "text",
          comment: trimText(step.config?.targetFieldComment) || "关联回填新增字段",
        }];
      }
    }
  });

  const previewSql = ctes.length
    ? `WITH\n${ctes.map((item) => `${item.cteName} AS (\n${item.sql}\n)`).join(",\n")}\nSELECT * FROM ${currentRelation}`
    : `SELECT * FROM ${sourceRelation}`;

  const targetExecution = resolveTargetExecutionConfig({ databaseName, tableName, pipeline, outputMode, targetTableName });
  let executeSql = previewSql;
  if (targetExecution.effectiveOutputMode === "new_table") {
    const target = trimText(targetExecution.effectiveTargetTableName);
    if (!target) {
      throw new AppError("写入新表模式需要目标表名", 400);
    }
    const targetRelation = buildSourceRelation(targetExecution.effectiveDatabaseName, target, dialect);
    const createKeyword = targetExecution.writeMode === "append" ? null : "replace";
    executeSql = [
      ...(createKeyword === "replace" ? [`DROP TABLE IF EXISTS ${targetRelation};`] : []),
      ...(createKeyword === "replace"
        ? [`CREATE TABLE ${targetRelation} AS`, previewSql]
        : [`INSERT INTO ${targetRelation}`, previewSql]),
    ].join("\n");
  } else if (targetExecution.effectiveOutputMode === "overwrite_source") {
    const stageTable = `${trimText(tableName)}__processing_stage_${Date.now()}`;
    const stageRelation = buildSourceRelation(databaseName, stageTable, dialect);
    executeSql = [
      `DROP TABLE IF EXISTS ${stageRelation};`,
      `CREATE TABLE ${stageRelation} AS`,
      previewSql,
      `TRUNCATE TABLE ${sourceRelation};`,
      `INSERT INTO ${sourceRelation} SELECT * FROM ${stageRelation};`,
      `DROP TABLE IF EXISTS ${stageRelation};`,
    ].join("\n");
  }

  return {
    dialect,
    sourceRelation,
    previewSql,
    executeSql,
    ctes,
    finalRelation: currentRelation,
    finalColumns: currentColumns,
    targetExecution,
    warnings: [],
  };
}

async function requireProcessingJob(id) {
  const job = await repository.getProcessingJobById(id);
  if (!job) {
    throw new AppError("Processing job not found", 404);
  }
  return job;
}

async function getProcessingRuntime(job, version) {
  if (isPendingProcessingSourceTable(job.tableName)) {
    throw new AppError("请先选择源表并保存任务配置", 400);
  }
  const datasource = materializeDatasource(await requireDatasource(job.datasourceId, true));
  const adapter = getAdapter(datasource);
  const sourceColumnsMeta = await adapter.getColumns(
    datasource,
    job.databaseName || datasource.databaseName,
    job.tableName
  );
  const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
  const compiled = compileProcessingPipeline({
    databaseName: job.databaseName || datasource.databaseName,
    tableName: job.tableName,
    pipeline: version.pipeline,
    dialect: datasource.type,
    outputMode: job.outputMode,
    targetTableName: job.targetTableName,
    sourceColumns,
  });
  return { datasource, adapter, compiled };
}

async function listProcessingJobs(filters) {
  const jobs = await repository.listProcessingJobs(filters);
  const versions = await Promise.all(jobs.map((job) => repository.getLatestProcessingJobVersion(job.id)));
  return jobs.map((job, index) => ({
    ...job,
    version: versions[index] || null,
  }));
}

async function getProcessingJob(id) {
  const job = await requireProcessingJob(id);
  const version = await repository.getLatestProcessingJobVersion(id);
  const runs = await repository.listProcessingRuns(id);
  return {
    ...job,
    version,
    runs: runs.slice(0, 20),
  };
}

async function createProcessingJob(payload) {
  const datasource = await requireDatasource(payload.datasourceId);
  const runtimeDatasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
  const adapter = getAdapter(runtimeDatasource);
  const sourceColumnsMeta = payload.tableName && !isPendingProcessingSourceTable(payload.tableName)
    ? await adapter.getColumns(runtimeDatasource, payload.databaseName || runtimeDatasource.databaseName, payload.tableName)
    : [];
  const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
  const job = await repository.createProcessingJob({
    ...payload,
    status: "draft",
  });
  const compiled = compileProcessingPipeline({
    databaseName: payload.databaseName,
    tableName: payload.tableName,
    pipeline: payload.pipeline,
    dialect: inferDatasourceDialect(datasource),
    outputMode: payload.outputMode,
    targetTableName: payload.targetTableName,
    sourceColumns,
  });
  await repository.upsertProcessingJobVersion(job.id, 1, {
    versionStatus: "draft",
    pipeline: payload.pipeline,
    compiledSql: compiled.previewSql,
    summary: buildProcessingSummary(payload.pipeline),
  });
  return getProcessingJob(job.id);
}

async function updateProcessingJob(id, payload) {
  await requireProcessingJob(id);
  const datasource = await requireDatasource(payload.datasourceId);
  const runtimeDatasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
  const adapter = getAdapter(runtimeDatasource);
  const sourceColumnsMeta = payload.tableName && !isPendingProcessingSourceTable(payload.tableName)
    ? await adapter.getColumns(runtimeDatasource, payload.databaseName || runtimeDatasource.databaseName, payload.tableName)
    : [];
  const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
  const job = await repository.updateProcessingJob(id, {
    ...payload,
    status: "draft",
  });
  if (!job) {
    throw new AppError("Processing job not found", 404);
  }
  const nextVersionNo = Math.max(Number(job.currentVersionNo || 1), 1);
  const compiled = compileProcessingPipeline({
    databaseName: payload.databaseName,
    tableName: payload.tableName,
    pipeline: payload.pipeline,
    dialect: inferDatasourceDialect(datasource),
    outputMode: payload.outputMode,
    targetTableName: payload.targetTableName,
    sourceColumns,
  });
  await repository.upsertProcessingJobVersion(id, nextVersionNo, {
    versionStatus: "draft",
    pipeline: payload.pipeline,
    compiledSql: compiled.previewSql,
    summary: buildProcessingSummary(payload.pipeline),
  });
  return getProcessingJob(id);
}

async function deleteProcessingJob(id) {
  const deleted = await repository.deleteProcessingJob(id);
  if (!deleted) {
    throw new AppError("Processing job not found", 404);
  }
}

async function previewProcessingJobDraft(payload) {
  const datasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
  const adapter = getAdapter(datasource);
  const sourceColumnsMeta = await adapter.getColumns(
    datasource,
    payload.databaseName || datasource.databaseName,
    payload.tableName
  );
  const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
  const compiled = compileProcessingPipeline({
    databaseName: payload.databaseName || datasource.databaseName,
    tableName: payload.tableName,
    pipeline: payload.pipeline,
    dialect: datasource.type,
    outputMode: "preview_only",
    targetTableName: null,
    sourceColumns,
  });
  const queryResult = await adapter.executeQuery(datasource, compiled.previewSql, {
    databaseName: payload.databaseName || datasource.databaseName,
    resultLimit: payload.pipeline?.sampleLimit || 50,
  });
  return {
    previewSql: compiled.previewSql,
    fields: queryResult.fields,
    rows: queryResult.rows,
    rowCount: queryResult.rowCount,
    warnings: compiled.warnings,
    summary: buildProcessingSummary(payload.pipeline),
  };
}

async function previewProcessingJob(id) {
  const job = await requireProcessingJob(id);
  const version = await repository.getLatestProcessingJobVersion(id);
  if (!version) {
    throw new AppError("Processing job version not found", 404);
  }
  const runtime = await getProcessingRuntime(job, version);
  const queryResult = await runtime.adapter.executeQuery(runtime.datasource, runtime.compiled.previewSql, {
    databaseName: job.databaseName || runtime.datasource.databaseName,
    resultLimit: version.pipeline?.sampleLimit || 50,
  });
  return {
    previewSql: runtime.compiled.previewSql,
    fields: queryResult.fields,
    rows: queryResult.rows,
    rowCount: queryResult.rowCount,
    warnings: runtime.compiled.warnings,
    versionNo: version.versionNo,
  };
}

async function runProcessingJob(id, options = {}) {
  const job = await requireProcessingJob(id);
  const version = options.versionNo
    ? await repository.getProcessingJobVersion(id, Number(options.versionNo))
    : await repository.getLatestProcessingJobVersion(id);
  if (!version) {
    throw new AppError("Processing job version not found", 404);
  }

  const runtime = await getProcessingRuntime({
    ...job,
    outputMode: options.outputMode || job.outputMode,
    targetTableName: options.targetTableName || job.targetTableName,
  }, version);

  const startedAt = Date.now();
  const run = await repository.createProcessingRun({
    jobId: id,
    versionNo: version.versionNo,
    runStatus: "running",
    triggerType: options.triggerType || "manual",
    previewMode: false,
    startedAt: formatDateTime(),
  });

  try {
    const statementResult = await runtime.adapter.executeStatement(runtime.datasource, runtime.compiled.executeSql, {
      databaseName: job.databaseName || runtime.datasource.databaseName,
    });
    const queryResult = await runtime.adapter.executeQuery(runtime.datasource, runtime.compiled.previewSql, {
      databaseName: job.databaseName || runtime.datasource.databaseName,
      resultLimit: version.pipeline?.sampleLimit || 50,
    });
    const finished = await repository.updateProcessingRun(run.id, {
      runStatus: "completed",
      sourceRowCount: null,
      outputRowCount: queryResult.rowCount,
      affectedRows: statementResult.affectedRows ?? queryResult.rowCount,
      targetTableName: options.targetTableName || job.targetTableName,
      durationMs: Date.now() - startedAt,
      errorMessage: null,
      resultPreview: buildResultPreview(queryResult),
      executedSql: runtime.compiled.executeSql,
      startedAt: formatDateTime(new Date(startedAt)),
      finishedAt: formatDateTime(),
    });
    await repository.updateProcessingJobVersionPointers(id, {
      lastRunStatus: "completed",
      lastRunAt: formatDateTime(),
      status: "active",
      currentVersionNo: version.versionNo,
    });
    return finished;
  } catch (error) {
    const failed = await repository.updateProcessingRun(run.id, {
      runStatus: "failed",
      errorMessage: error.message || "Processing run failed",
      durationMs: Date.now() - startedAt,
      executedSql: runtime.compiled.executeSql,
      startedAt: formatDateTime(new Date(startedAt)),
      finishedAt: formatDateTime(),
    });
    await repository.updateProcessingJobVersionPointers(id, {
      lastRunStatus: "failed",
      lastRunAt: formatDateTime(),
    });
    return failed;
  }
}

async function listProcessingJobRuns(id) {
  await requireProcessingJob(id);
  return repository.listProcessingRuns(id);
}

async function runCopilotTask(payload, user) {
  return copilot.runCopilotTask(payload, { user });
}

async function runCopilotTaskStream(payload, streamContext = {}) {
  return copilot.runCopilotTaskStream(payload, streamContext);
}

async function listCopilotSessions(user, filters = {}) {
  return copilot.listCopilotSessions(user, filters);
}

async function listCopilotSessionMessages(user, sessionId) {
  return copilot.listCopilotSessionMessages(user, sessionId);
}

async function listWorkflows() {
  return repository.listWorkflows();
}

async function getWorkflow(id) {
  return requireWorkflow(id);
}

async function listOrchestrationTasks() {
  return repository.listOrchestrationTasks();
}

async function getOrchestrationTask(id) {
  return requireOrchestrationTask(id);
}

async function createOrchestrationTask(payload) {
  if (payload.datasourceId) {
    await requireDatasource(payload.datasourceId);
  }
  return repository.createOrchestrationTask(payload);
}

async function updateOrchestrationTask(id, payload) {
  await requireOrchestrationTask(id);
  if (payload.datasourceId) {
    await requireDatasource(payload.datasourceId);
  }
  return repository.updateOrchestrationTask(id, payload);
}

async function deleteOrchestrationTask(id) {
  const deleted = await repository.deleteOrchestrationTask(id);
  if (!deleted) {
    throw new AppError("Orchestration task not found", 404);
  }
}

function getOrchestrationSourceDatasourceIds(task) {
  return Array.from(new Set(
    (task.nodes || [])
      .filter((node) => node.nodeType === "source")
      .map((node) => Number(node.nodeConfig?.datasourceId || task.datasourceId || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
  ));
}

async function getOrchestrationSourceDatasources(task) {
  const datasources = [];
  for (const datasourceId of getOrchestrationSourceDatasourceIds(task)) {
    datasources.push(materializeDatasource(await requireDatasource(datasourceId, true)));
  }
  return datasources;
}

async function ensureOrchestrationDatasourceEnvironment(task) {
  const datasources = await getOrchestrationSourceDatasources(task);
  const sourceDatasourceIds = getOrchestrationSourceDatasourceIds(task);
  if (!datasources.length) {
    return { datasources, sourceDatasourceIds, effectiveDatasource: null };
  }

  const signatureMap = new Map();
  datasources.forEach((datasource) => {
    signatureMap.set(buildDatasourceEnvironmentSignature(datasource), datasource);
  });
  if (signatureMap.size > 1) {
    throw new AppError("数据编排中的所有数据输入必须来自同一数据库地址环境，仅允许同一实例下切换不同用户名。", 400);
  }

  return {
    datasources,
    sourceDatasourceIds,
    effectiveDatasource: datasources[0] || null,
  };
}

function normalizePreviewLimit(value, max = 200) {
  return Math.max(1, Math.min(Number(value || 20) || 20, max));
}

function trimText(value) {
  return String(value || "").trim();
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function isPreviewOnlyWarning(message) {
  const text = trimText(message);
  return (
    text.includes("cannot be translated to pure SQL") ||
    text.includes("SQL preview uses") ||
    text.includes("structure inspection only")
  );
}

function filterRunWarnings(values) {
  return uniqueStrings(values).filter((item) => !isPreviewOnlyWarning(item));
}

const AI_OPERATOR_CODES = new Set(["llm", "llm_row", "llm_batch"]);
const RUNTIME_OPERATOR_CODES = new Set(["string_split"]);

function normalizeAiOperatorCode(value) {
  const operatorCode = trimText(value);
  return operatorCode === "llm" ? "llm_row" : operatorCode;
}

function getAiFallbackFieldName(operatorCode) {
  return normalizeAiOperatorCode(operatorCode) === "llm_batch" ? "batch_result" : "llm_reply";
}

function normalizeAiOutputFields(value, legacyFieldName, fallbackFieldName = "llm_reply") {
  let fieldList = [];
  if (Array.isArray(value)) {
    fieldList = value;
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      fieldList = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      fieldList = [];
    }
  }

  const parsedFields = fieldList
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      fieldName: trimText(item.fieldName || item.name || item.outputFieldName),
      description: trimText(item.description || item.fieldDesc || item.label),
    }))
    .filter((item) => item.fieldName);

  if (parsedFields.length) {
    return parsedFields;
  }

  const nextFieldName = trimText(legacyFieldName) || fallbackFieldName;
  return nextFieldName ? [{ fieldName: nextFieldName, description: "" }] : [];
}

function findOrchestrationNode(task, nodeKey) {
  const node = (task.nodes || []).find((item) => item.nodeKey === nodeKey);
  if (!node) {
    throw new AppError(`Orchestration node ${nodeKey} not found`, 404);
  }
  return node;
}

function getIncomingOrchestrationNodeKeys(task, nodeKey) {
  return (task.edges || [])
    .filter((edge) => edge.targetNodeKey === nodeKey)
    .map((edge) => edge.sourceNodeKey);
}

function parseStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizePromptVariableMappings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const sourceFields = parseStringArray(item.sourceFields);
      const sourceField = trimText(item.sourceField) || sourceFields[0];
      const sourceMode = trimText(item.sourceMode) || (sourceFields.length > 1 ? "selected_fields" : sourceField ? "single_field" : "all_fields");
      return {
        variableName: trimText(item.variableName),
        sourceMode,
        sourceField,
        sourceFields: sourceFields.length ? sourceFields : (sourceField ? [sourceField] : []),
        defaultValue: item.defaultValue === undefined || item.defaultValue === null ? "" : String(item.defaultValue),
      };
    })
    .filter((item) => item.variableName);
}

function buildPromptVariableValueFromRow(row, mapping) {
  const safeRow = row || {};
  const sourceMode = trimText(mapping?.sourceMode) || "single_field";
  if (sourceMode === "all_fields") {
    return Object.keys(safeRow).length ? safeRow : mapping.defaultValue;
  }
  if (sourceMode === "selected_fields") {
    const payload = {};
    (mapping.sourceFields || []).forEach((fieldName) => {
      if (fieldName && Object.prototype.hasOwnProperty.call(safeRow, fieldName)) {
        payload[fieldName] = safeRow[fieldName];
      }
    });
    return Object.keys(payload).length ? payload : mapping.defaultValue;
  }
  const sourceValue = Object.prototype.hasOwnProperty.call(safeRow, mapping.sourceField)
    ? safeRow[mapping.sourceField]
    : undefined;
  return sourceValue === undefined || sourceValue === null || sourceValue === ""
    ? mapping.defaultValue
    : sourceValue;
}

function stringifyPromptValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function renderPromptTemplate(template, variables) {
  return String(template || "").replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawKey) => {
    const key = String(rawKey || "").trim();
    return stringifyPromptValue(variables?.[key]);
  });
}

function buildPromptVariables(row, rowIndex, mappings) {
  const variables = {
    row_index: rowIndex + 1,
    row_json: stringifyPromptValue(row || {}),
  };

  Object.entries(row || {}).forEach(([key, value]) => {
    variables[key] = value;
  });

  normalizePromptVariableMappings(mappings).forEach((item) => {
    variables[item.variableName] = buildPromptVariableValueFromRow(row, item);
  });

  return variables;
}

function buildBatchPromptVariables(rows, mappings) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const columns = uniqueStrings(safeRows.flatMap((item) => Object.keys(item || {})));
  const variables = {
    row_count: safeRows.length,
    rows_json: stringifyPromptValue(safeRows),
    sample_rows_json: stringifyPromptValue(safeRows),
    columns: columns.join(", "),
    columns_json: stringifyPromptValue(columns),
  };

  columns.forEach((columnName) => {
    variables[columnName] = safeRows.map((row) => (
      row && Object.prototype.hasOwnProperty.call(row, columnName)
        ? row[columnName]
        : ""
    ));
  });

  normalizePromptVariableMappings(mappings).forEach((item) => {
    if (trimText(item.sourceMode) === "all_fields") {
      variables[item.variableName] = safeRows.length ? safeRows : item.defaultValue;
      return;
    }
    variables[item.variableName] = safeRows.map((row) => buildPromptVariableValueFromRow(row, item));
  });

  return variables;
}

function extractJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("Model returned empty content");
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("JSON object not found in model response");
}

function parseJsonObjectWithRecovery(text = "") {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    return JSON.parse(extractJsonObject(text));
  }
}

function buildAiResponseInstruction(outputFields) {
  const fieldLines = outputFields.map((item) => `- ${item.fieldName}: ${item.description || "string"}`);
  return [
    "Return valid JSON only. The response must be a JSON object.",
    "Use exactly the configured keys below and do not add extra keys.",
    "When a value cannot be extracted, return an empty string.",
    ...fieldLines,
  ].join("\n");
}

function normalizeAiFieldValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return stringifyPromptValue(value);
}

function resolveAiOutputValues(content, outputFields) {
  const rawContent = String(content || "");
  const warnings = [];
  let parsed = null;

  try {
    parsed = parseJsonObjectWithRecovery(rawContent);
  } catch (error) {
    if (outputFields.length === 1) {
      return {
        values: { [outputFields[0].fieldName]: rawContent.trim() },
        warnings: ["AI response was not valid JSON. The raw response has been written to the only output field."],
      };
    }

    warnings.push("AI response was not valid JSON. Output fields have been left blank for this preview.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const emptyValues = {};
    outputFields.forEach((item) => {
      emptyValues[item.fieldName] = "";
    });
    if (!warnings.length) {
      warnings.push("AI response is not a JSON object. Output fields have been left blank for this preview.");
    }
    return { values: emptyValues, warnings };
  }

  const values = {};
  const missingFields = [];
  outputFields.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(parsed, item.fieldName)) {
      values[item.fieldName] = normalizeAiFieldValue(parsed[item.fieldName]);
    } else {
      values[item.fieldName] = "";
      missingFields.push(item.fieldName);
    }
  });

  if (missingFields.length) {
    warnings.push(`AI response did not contain configured keys: ${missingFields.join(", ")}.`);
  }

  return { values, warnings };
}

async function requestAiNodeOutput(runtimeProvider, systemPromptTemplate, userPromptTemplate, variables, outputFields) {
  const renderedSystemPrompt = renderPromptTemplate(systemPromptTemplate, variables);
  const renderedUserPrompt = renderPromptTemplate(userPromptTemplate, variables);
  const instruction = buildAiResponseInstruction(outputFields);
  const messages = [{
    role: "system",
    content: renderedSystemPrompt ? `${renderedSystemPrompt}\n\n${instruction}` : instruction,
  }, {
    role: "user",
    content: renderedUserPrompt,
  }];

  const completion = await modelProviderService.generateChatCompletion(runtimeProvider, messages, {
    temperature: 0.2,
    maxTokens: 1600,
    timeoutMs: 60000,
    responseFormat: { type: "json_object" },
  });

  return {
    completion,
    ...resolveAiOutputValues(completion?.content || "", outputFields),
  };
}

function parseObjectArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function indentSql(sqlText, spaces = 2) {
  const padding = " ".repeat(spaces);
  return String(sqlText || "")
    .split("\n")
    .map((line) => (line ? `${padding}${line}` : line))
    .join("\n");
}

function escapeSqlLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (value instanceof Date) {
    return `'${formatDateTime(value)}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

const VALIDATION_PATTERN_MAP = {
  id_card: /^(\d{15}|\d{17}[0-9Xx])$/,
  phone: /^1[3-9][0-9]{9}$/,
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  credit_code: /^[0-9A-Z]{18}$/,
  url: /^https?:\/\/.+/i,
  ipv4: /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/,
  postal_code: /^\d{6}$/,
};

function getValidationPattern(checkType) {
  return VALIDATION_PATTERN_MAP[trimText(checkType)] || null;
}

function parseDomainValueList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesBuiltinValidation(value, checkType) {
  const pattern = getValidationPattern(checkType);
  const text = value === undefined || value === null ? "" : String(value).trim();
  return pattern ? pattern.test(text) : false;
}

function parseConditionRules(value) {
  return parseObjectArray(value)
    .map((item) => {
      const referenceFieldRef = trimText(item.referenceFieldRef);
      const separatorIndex = referenceFieldRef.indexOf("::");
      const referenceNodeKey = trimText(item.referenceNodeKey)
        || (separatorIndex > 0 ? referenceFieldRef.slice(0, separatorIndex) : "");
      const referenceField = trimText(item.referenceField)
        || (separatorIndex > 0 ? referenceFieldRef.slice(separatorIndex + 2) : "");
      return {
        ruleType: trimText(item.ruleType)
          || (trimText(item.checkType) ? "builtin" : String(item.domainValues ?? "").trim() ? "domain" : "condition"),
        fieldName: trimText(item.fieldName),
        operator: trimText(item.operator) || "eq",
        value: item.value === undefined || item.value === null ? "" : String(item.value),
        valueSource: trimText(item.valueSource)
          || (referenceField ? "upstream_field" : trimText(item.customSql) ? "custom_sql" : "literal"),
        referenceNodeKey,
        referenceField,
        customSql: item.customSql === undefined || item.customSql === null ? "" : String(item.customSql),
        checkType: trimText(item.checkType) || "phone",
        matchMode: trimText(item.matchMode) || "valid",
        domainValues: item.domainValues === undefined || item.domainValues === null ? "" : String(item.domainValues),
      };
    })
    .filter((item) => item.fieldName);
}

function parseSortRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      fieldName: trimText(item.fieldName),
      direction: trimText(item.direction).toUpperCase() === "DESC" ? "DESC" : "ASC",
    }))
    .filter((item) => item.fieldName);
}

function parseReplaceRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      matchValue: item.matchValue === undefined || item.matchValue === null ? "" : String(item.matchValue),
      replaceValue: item.replaceValue === undefined || item.replaceValue === null ? "" : String(item.replaceValue),
    }))
    .filter((item) => item.matchValue !== "" || item.replaceValue !== "");
}

function parseFormatRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      transformType: trimText(item.transformType) || "date_to_string",
      formatPattern: item.formatPattern === undefined || item.formatPattern === null ? "" : String(item.formatPattern),
      targetType: trimText(item.targetType) || "decimal",
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function parseComplianceRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      validationType: trimText(item.validationType)
        || (String(item.customPattern ?? "").trim() ? "regex" : String(item.fixedValue ?? "").trim() ? "fixed_value" : String(item.domainValues ?? "").trim() ? "domain" : "builtin"),
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      checkType: trimText(item.checkType) || "phone",
      customPattern: item.customPattern === undefined || item.customPattern === null ? "" : String(item.customPattern),
      fixedValue: item.fixedValue === undefined || item.fixedValue === null ? "" : String(item.fixedValue),
      domainValues: item.domainValues === undefined || item.domainValues === null ? "" : String(item.domainValues),
      resultMode: trimText(item.resultMode) || "flag",
      defaultValue: item.defaultValue === undefined || item.defaultValue === null ? "" : String(item.defaultValue),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function parseStringRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      transformType: trimText(item.transformType) || "trim",
      argument1: item.argument1 === undefined || item.argument1 === null ? "" : String(item.argument1),
      argument2: item.argument2 === undefined || item.argument2 === null ? "" : String(item.argument2),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function parseDesensitizeRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      maskType: trimText(item.maskType) || trimText(item.transform) || "mask",
      transform: trimText(item.transform) || trimText(item.maskType) || "mask",
      maskChar: trimText(item.maskChar) || "*",
      prefixLength: Math.max(0, Number(item.prefixLength || 0)),
      suffixLength: Math.max(0, Number(item.suffixLength || 0)),
      truncateLength: Math.max(0, Number(item.truncateLength || 0)),
      replacePattern: trimText(item.replacePattern) || trimText(item.pattern) || "",
      replaceValue: item.replaceValue === undefined || item.replaceValue === null ? "" : String(item.replaceValue),
      encryptAlgorithm: trimText(item.encryptAlgorithm) || trimText(item.hashAlgorithm) || "md5",
      salt: trimText(item.salt) || "",
      generalizeLength: Math.max(0, Number(item.generalizeLength || item.truncateLength || 0)),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function parseJoinKeyRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      leftField: trimText(item.leftField),
      rightField: trimText(item.rightField),
    }))
    .filter((item) => item.leftField && item.rightField);
}

function parseOutputFieldMappings(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function parseColumnAlignmentRows(value) {
  return parseObjectArray(value)
    .map((row) => ({
      outputField: trimText(row.outputField),
      bindings: parseObjectArray(row.bindings)
        .map((binding) => ({
          sourceNodeKey: trimText(binding.sourceNodeKey),
          fieldName: trimText(binding.fieldName),
        }))
        .filter((binding) => binding.sourceNodeKey),
    }))
    .filter((row) => row.outputField);
}

function parseAggregationRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      aggregateFunction: trimText(item.aggregateFunction || item.func || "count").toLowerCase(),
      fieldName: trimText(item.fieldName),
      alias: trimText(item.alias),
    }))
    .filter((item) => item.aggregateFunction);
}

function parseBooleanFlag(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = trimText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseStringAggregateRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      outputField: trimText(item.outputField),
      separator: item.separator === undefined || item.separator === null ? "," : String(item.separator),
      distinct: parseBooleanFlag(item.distinct, false),
    }))
    .filter((item) => item.sourceField && item.outputField);
}

function parseStringSplitConfig(value) {
  if (!value || typeof value !== "object") {
    return {
      sourceField: "",
      outputField: "",
      separator: ",",
      trimItems: true,
      keepEmptyItems: false,
      indexField: "",
    };
  }

  return {
    sourceField: trimText(value.sourceField),
    outputField: trimText(value.outputField),
    separator: value.separator === undefined || value.separator === null ? "," : String(value.separator),
    trimItems: parseBooleanFlag(value.trimItems, true),
    keepEmptyItems: parseBooleanFlag(value.keepEmptyItems, false),
    indexField: trimText(value.indexField),
  };
}

function getActiveOrchestrationEdges(task) {
  return (task.edges || []).filter((edge) => trimText(edge.edgeStatus).toLowerCase() !== "paused");
}

function buildOrchestrationEdgeMaps(task) {
  const incoming = new Map();
  const outgoing = new Map();
  getActiveOrchestrationEdges(task).forEach((edge) => {
    incoming.set(edge.targetNodeKey, [...(incoming.get(edge.targetNodeKey) || []), edge]);
    outgoing.set(edge.sourceNodeKey, [...(outgoing.get(edge.sourceNodeKey) || []), edge]);
  });
  return { incoming, outgoing };
}

function collectActiveLineageNodeKeys(nodeKey, incoming, trail = new Set()) {
  if (!nodeKey || trail.has(nodeKey)) {
    return trail;
  }
  trail.add(nodeKey);
  (incoming.get(nodeKey) || []).forEach((edge) => {
    collectActiveLineageNodeKeys(edge.sourceNodeKey, incoming, trail);
  });
  return trail;
}

function orchestrationLineageContainsAiOperator(task, nodeKey) {
  const { incoming } = buildOrchestrationEdgeMaps(task);
  const lineageNodeKeys = collectActiveLineageNodeKeys(nodeKey, incoming);
  return (task.nodes || []).some((node) => lineageNodeKeys.has(node.nodeKey) && AI_OPERATOR_CODES.has(trimText(node.operatorCode)));
}

function orchestrationLineageContainsRuntimeOperator(task, nodeKey) {
  const { incoming } = buildOrchestrationEdgeMaps(task);
  const lineageNodeKeys = collectActiveLineageNodeKeys(nodeKey, incoming);
  return (task.nodes || []).some((node) => {
    if (!lineageNodeKeys.has(node.nodeKey)) {
      return false;
    }
    const operatorCode = trimText(node.operatorCode);
    return AI_OPERATOR_CODES.has(operatorCode) || RUNTIME_OPERATOR_CODES.has(operatorCode);
  });
}

function inferRuntimeDataType(value) {
  if (value === null || value === undefined || value === "") {
    return "string";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (value instanceof Date) {
    return "datetime";
  }
  const text = String(value).trim();
  if (/^-?\d+$/.test(text)) {
    return "integer";
  }
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return "number";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "date";
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(text)) {
    return "datetime";
  }
  return "string";
}

function inferRuntimeColumnDataType(fieldName, rows) {
  const inferredTypes = new Set(
    (rows || [])
      .map((row) => row?.[fieldName])
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map((value) => inferRuntimeDataType(value))
  );
  if (!inferredTypes.size) {
    return "string";
  }
  if (inferredTypes.size === 1) {
    return Array.from(inferredTypes)[0];
  }
  if (Array.from(inferredTypes).every((item) => ["integer", "number"].includes(item))) {
    return "number";
  }
  if (Array.from(inferredTypes).every((item) => ["date", "datetime"].includes(item))) {
    return "datetime";
  }
  return "string";
}

function buildRuntimeColumnMeta(fields, rows) {
  return (fields || []).map((fieldName, index) => {
    const dataType = inferRuntimeColumnDataType(fieldName, rows);
    return {
      name: fieldName,
      position: index + 1,
      dataType,
      columnType: dataType,
      nullable: true,
      primaryKey: false,
      defaultValue: null,
      comment: null,
    };
  });
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  const text = String(value).trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }
  return text;
}

function evaluateConditionRule(row, rule) {
  const fieldValue = row ? row[rule.fieldName] : undefined;
  const ruleType = trimText(rule.ruleType) || "condition";
  const operator = trimText(rule.operator) || "eq";
  const normalizedValue = rule.value === undefined || rule.value === null ? "" : String(rule.value);
  const left = normalizeComparableValue(fieldValue);
  const right = normalizeComparableValue(normalizedValue);
  const leftText = left === null ? "" : String(left);
  const rightText = right === null ? "" : String(right);

  if (ruleType === "builtin") {
    const matched = matchesBuiltinValidation(fieldValue, rule.checkType);
    return trimText(rule.matchMode) === "invalid" ? !matched : matched;
  }

  if (ruleType === "domain") {
    const domainValues = parseDomainValueList(rule.domainValues);
    const matched = domainValues.includes(leftText);
    return trimText(rule.matchMode) === "not_in" ? !matched : matched;
  }

  switch (operator) {
    case "ne":
      return leftText !== rightText;
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "contains":
      return leftText.includes(rightText);
    case "starts_with":
      return leftText.startsWith(rightText);
    case "ends_with":
      return leftText.endsWith(rightText);
    case "in": {
      const values = Array.isArray(rule.resolvedValues)
        ? rule.resolvedValues
        : rightText.split(",").map((item) => item.trim()).filter(Boolean);
      return values.includes(leftText);
    }
    case "not_in": {
      const values = Array.isArray(rule.resolvedValues)
        ? rule.resolvedValues
        : rightText.split(",").map((item) => item.trim()).filter(Boolean);
      return !values.includes(leftText);
    }
    case "is_null":
      return fieldValue === null || fieldValue === undefined || fieldValue === "";
    case "is_not_null":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
    case "eq":
    default:
      return leftText === rightText;
  }
}

function evaluateRuleGroup(rows, rules, logic) {
  const rawRules = Array.isArray(rules) ? rules : [];
  const normalizedRules = parseConditionRules(rules).map((rule, index) => ({
    ...rule,
    ...(Array.isArray(rawRules[index]?.resolvedValues) ? { resolvedValues: rawRules[index].resolvedValues } : {}),
  }));
  if (!normalizedRules.length) {
    return rows.slice();
  }
  const useAny = trimText(logic) === "any";
  return rows.filter((row) => {
    const results = normalizedRules.map((rule) => evaluateConditionRule(row, rule));
    return useAny ? results.some(Boolean) : results.every(Boolean);
  });
}

function normalizeRuntimeFilterSubquerySql(value) {
  let sqlText = String(value ?? "").trim().replace(/;+\s*$/, "");
  const wrappedMatch = sqlText.match(/^(?:not\s+)?in\s*\(([\s\S]*)\)$/i);
  if (wrappedMatch) {
    sqlText = String(wrappedMatch[1] || "").trim().replace(/;+\s*$/, "");
  } else if (/^\([\s\S]*\)$/.test(sqlText)) {
    const innerSql = sqlText.slice(1, -1).trim().replace(/;+\s*$/, "");
    if (/^(select|with)\b/i.test(innerSql)) {
      sqlText = innerSql;
    }
  }
  return sqlText;
}

async function resolveRuntimeFilterRules(inputResults, primaryInput, rules, context) {
  const normalizedRules = parseConditionRules(rules);
  return Promise.all(normalizedRules.map(async (rule) => {
    if (!["in", "not_in"].includes(rule.operator)) {
      return rule;
    }

    if (rule.valueSource === "upstream_field") {
      const referenceField = trimText(rule.referenceField);
      const referenceInput = trimText(rule.referenceNodeKey)
        ? inputResults.find((item) => item.sourceNodeKey === trimText(rule.referenceNodeKey))
        : primaryInput;
      if (!referenceInput) {
        throw new AppError(`数据过滤引用的上游节点 ${rule.referenceNodeKey} 未连接`, 400);
      }
      return {
        ...rule,
        resolvedValues: uniqueStrings(
          (referenceInput.rows || [])
            .map((row) => row?.[referenceField])
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(normalizeComparableValue(value) ?? ""))
        ),
      };
    }

    if (rule.valueSource === "custom_sql") {
      const sqlText = normalizeRuntimeFilterSubquerySql(rule.customSql);
      if (!isQuerySql(sqlText)) {
        throw new AppError("IN / NOT IN 自定义 SQL 必须是返回单列结果的 SELECT 查询", 400);
      }
      if (!context.adapter || !context.datasource) {
        throw new AppError("执行自定义 SQL 过滤需要可用的数据源", 400);
      }
      const queryResult = await context.adapter.executeQuery(context.datasource, sqlText, {
        databaseName: context.databaseName || context.datasource.databaseName,
      });
      const firstField = queryResult.fields?.[0] || Object.keys(queryResult.rows?.[0] || {})[0];
      if (!firstField) {
        return { ...rule, resolvedValues: [] };
      }
      return {
        ...rule,
        resolvedValues: uniqueStrings(
          (queryResult.rows || [])
            .map((row) => row?.[firstField])
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(normalizeComparableValue(value) ?? ""))
        ),
      };
    }

    return rule;
  }));
}

function compareRuntimeValues(left, right) {
  const leftValue = normalizeComparableValue(left);
  const rightValue = normalizeComparableValue(right);
  if (leftValue === rightValue) {
    return 0;
  }
  if (leftValue === null) return -1;
  if (rightValue === null) return 1;
  return leftValue > rightValue ? 1 : -1;
}

function sortRuntimeRows(rows, sortRules) {
  const rules = parseSortRules(sortRules);
  if (!rules.length) {
    return rows.slice();
  }
  return rows.slice().sort((leftRow, rightRow) => {
    for (const rule of rules) {
      const compared = compareRuntimeValues(leftRow?.[rule.fieldName], rightRow?.[rule.fieldName]);
      if (compared !== 0) {
        return rule.direction === "DESC" ? -compared : compared;
      }
    }
    return 0;
  });
}

function stringifyAggregateValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function buildStringSplitRuntimeRows(rows, splitConfig) {
  const { sourceField, outputField, separator, trimItems, keepEmptyItems, indexField } = splitConfig;
  const safeSeparator = separator || ",";
  const results = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rawValue = row?.[sourceField];
    const stringValue = rawValue === null || rawValue === undefined ? "" : String(rawValue);
    const parts = stringValue.split(safeSeparator).map((item) => (trimItems ? item.trim() : item));
    const normalizedParts = keepEmptyItems ? parts : parts.filter((item) => item !== "");
    normalizedParts.forEach((part, index) => {
      const nextRow = { ...(row || {}) };
      if (sourceField !== outputField) {
        delete nextRow[sourceField];
      }
      nextRow[outputField] = part;
      if (indexField) {
        nextRow[indexField] = index + 1;
      }
      results.push(nextRow);
    });
  });

  return results;
}

function applyReplaceRuleValue(value, rule) {
  const matchValue = rule.matchValue === undefined || rule.matchValue === null ? "" : String(rule.matchValue);
  const replaceValue = rule.replaceValue === undefined || rule.replaceValue === null ? "" : rule.replaceValue;
  const current = value === undefined || value === null ? "" : String(value);
  if (!matchValue) {
    return current === "" ? replaceValue : value;
  }
  return current === matchValue ? replaceValue : value;
}

function formatRuntimeValue(value, rule) {
  const transformType = trimText(rule.transformType);
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (transformType === "string_to_number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : "";
  }
  if (transformType === "number_to_string") {
    return String(value);
  }
  if (transformType === "datetime_to_date") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : formatDateTime(parsed).slice(0, 10);
  }
  if (["date_to_string", "datetime_to_string"].includes(transformType)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : formatDateTime(parsed);
  }
  if (["string_to_date", "string_to_datetime"].includes(transformType)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? ""
      : transformType === "string_to_date"
        ? formatDateTime(parsed).slice(0, 10)
        : formatDateTime(parsed);
  }
  return value;
}

function evaluateCompliance(value, checkType) {
  return matchesBuiltinValidation(value, checkType);
}

function evaluateComplianceRule(row, rule) {
  const sourceValue = row?.[rule.sourceField];
  const validationType = trimText(rule.validationType) || "builtin";
  const sourceText = sourceValue === undefined || sourceValue === null ? "" : String(sourceValue).trim();

  let matched = false;
  if (validationType === "domain") {
    matched = parseDomainValueList(rule.domainValues).includes(sourceText);
  } else if (validationType === "regex") {
    const patternText = trimText(rule.customPattern);
    if (patternText) {
      try {
        matched = new RegExp(patternText).test(sourceText);
      } catch (error) {
        matched = false;
      }
    }
  } else if (validationType === "fixed_value") {
    matched = sourceText === trimText(rule.fixedValue);
  } else {
    matched = evaluateCompliance(sourceValue, rule.checkType);
  }

  if (trimText(rule.resultMode) === "value") {
    if (matched) {
      return sourceValue;
    }
    return rule.defaultValue === undefined || rule.defaultValue === null ? "" : rule.defaultValue;
  }

  if (matched) {
    return 1;
  }
  if (rule.defaultValue !== undefined && rule.defaultValue !== null && String(rule.defaultValue) !== "") {
    return rule.defaultValue;
  }
  return 0;
}

function transformStringValue(value, rule) {
  const text = value === undefined || value === null ? "" : String(value);
  switch (trimText(rule.transformType)) {
    case "trim":
      return text.trim();
    case "remove_prefix":
      return text.slice(Math.max(0, Number(rule.argument1 || 0)));
    case "remove_suffix":
      return text.slice(0, Math.max(0, text.length - Math.max(0, Number(rule.argument1 || 0))));
    case "substring":
      return rule.argument2 ? text.substr(Math.max(0, Number(rule.argument1 || 0)), Math.max(0, Number(rule.argument2 || 0))) : text.slice(Math.max(0, Number(rule.argument1 || 0)));
    case "replace_text":
      return text.split(String(rule.argument1 || "")).join(String(rule.argument2 || ""));
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    default:
      return text;
  }
}

function desensitizeValue(value, rule) {
  const text = value === undefined || value === null ? "" : String(value);
  const maskType = trimText(rule.transform || rule.maskType) || "mask";
  if (maskType === "encrypt" || maskType === "hash") {
    const algorithm = trimText(rule.encryptAlgorithm || rule.hashAlgorithm) || "md5";
    const salt = trimText(rule.salt);
    const hash = require("crypto").createHash(algorithm === "sha1" ? "sha1" : algorithm === "sha256" ? "sha256" : "md5");
    hash.update(`${text}${salt}`);
    return hash.digest("hex");
  }
  if (maskType === "replace") {
    const pattern = trimText(rule.replacePattern || rule.pattern);
    const replacement = String(rule.replaceValue ?? rule.replacement ?? "");
    if (!pattern) {
      return text;
    }
    try {
      return text.replace(new RegExp(pattern, "g"), replacement);
    } catch (error) {
      return text.includes(pattern) ? text.split(pattern).join(replacement) : text;
    }
  }
  if (maskType === "generalize" || maskType === "truncate") {
    return text.slice(0, Math.max(0, Number(rule.generalizeLength || rule.truncateLength || 0)));
  }
  if (maskType === "randomize") {
    return require("crypto").randomBytes(Math.max(4, Math.min(16, Math.max(1, text.length || 8)))).toString("hex").slice(0, Math.max(8, text.length || 8));
  }
  const prefixLength = Math.max(0, Number(rule.prefixLength || 0));
  const suffixLength = Math.max(0, Number(rule.suffixLength || 0));
  if (text.length <= prefixLength + suffixLength) {
    return text;
  }
  return `${text.slice(0, prefixLength)}${String(rule.maskChar || "*").repeat(Math.max(0, text.length - prefixLength - suffixLength))}${text.slice(text.length - suffixLength)}`;
}

function buildCompiledPreviewWithClause(preview) {
  return `WITH\n${(preview.nodeSqls || [])
    .filter((item) => item.cteName)
    .map((item) => `${quoteIdentifier(item.cteName, preview.dialect)} AS (\n${indentSql(item.sql, 2)}\n)`)
    .join(",\n")}`;
}

async function materializeCompiledNodeData(task, nodeKey, context, options = {}) {
  const requestedLimit = options.limit === undefined ? 20 : options.limit;
  const preview = await orchestrationCompiler.compileOrchestrationTask(
    task,
    buildOrchestrationCompilerOptions(task, context, {
      targetNodeKey: nodeKey,
      previewLimit: requestedLimit || 20,
    })
  );

  if (!context.adapter || !context.datasource) {
    throw new AppError("Datasource is required for orchestration execution", 400);
  }

  const currentNode = preview.nodeSqls.find((item) => item.nodeKey === preview.finalNodeKey);
  const sqlText = requestedLimit === null || requestedLimit === undefined
    ? `${buildCompiledPreviewWithClause(preview)}\nSELECT *\nFROM ${quoteIdentifier(currentNode?.cteName || preview.finalNodeKey, preview.dialect)}`
    : preview.previewSql;
  const queryResult = await context.adapter.executeQuery(context.datasource, sqlText, {
    databaseName: context.databaseName || context.datasource.databaseName,
    ...(requestedLimit && requestedLimit > 0 ? { resultLimit: requestedLimit } : {}),
  });
  const resultPreview = buildResultPreview(queryResult) || { fields: [], rows: [], rowCount: 0 };
  const fields = resultPreview.fields?.length ? resultPreview.fields : preview.finalColumns || [];
  const rows = requestedLimit === null || requestedLimit === undefined ? (queryResult.rows || []) : (resultPreview.rows || []);
  return {
    preview,
    currentNode,
    fields,
    rows,
    rowCount: requestedLimit === null || requestedLimit === undefined ? Number(queryResult.rowCount || rows.length) : resultPreview.rowCount || rows.length,
    warnings: preview.warnings || [],
    columnMeta: buildRuntimeColumnMeta(fields, rows),
  };
}

function buildOutputRows(rows, mappings) {
  const normalizedMappings = parseOutputFieldMappings(mappings);
  if (!normalizedMappings.length) {
    return rows.map((row) => ({ ...(row || {}) }));
  }
  return rows.map((row) =>
    normalizedMappings.reduce((result, mapping) => {
      result[mapping.targetField] = row?.[mapping.sourceField];
      return result;
    }, {})
  );
}

async function materializeRuntimeNodeRows(task, nodeKey, context, options = {}, cache = new Map()) {
  const cacheKey = `${nodeKey}::${options.limit === null || options.limit === undefined ? "all" : options.limit}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const node = findOrchestrationNode(task, nodeKey);
  const { incoming } = buildOrchestrationEdgeMaps(task);
  const nodeIncomingEdges = incoming.get(nodeKey) || [];

  const promise = (async () => {
    const warnings = [];

    if (!orchestrationLineageContainsRuntimeOperator(task, nodeKey)) {
      return materializeCompiledNodeData(task, nodeKey, context, options);
    }

    const inputResults = [];
    for (const edge of nodeIncomingEdges) {
      const sourceNode = findOrchestrationNode(task, edge.sourceNodeKey);
      const sourceResult = await materializeRuntimeNodeRows(task, edge.sourceNodeKey, context, options, cache);
      if (trimText(sourceNode.operatorCode) === "branch") {
        const filteredRows = evaluateRuleGroup(
          sourceResult.rows || [],
          sourceNode.nodeConfig?.branchRules,
          sourceNode.nodeConfig?.branchLogic
        );
        const trueRows = filteredRows;
        const falseRows = (sourceResult.rows || []).filter((row) => !trueRows.includes(row));
        inputResults.push({
          ...sourceResult,
          sourceNodeKey: edge.sourceNodeKey,
          rows: trimText(edge.sourcePort) === "branch_false" ? falseRows : trueRows,
          rowCount: trimText(edge.sourcePort) === "branch_false" ? falseRows.length : trueRows.length,
        });
      } else {
        inputResults.push({
          ...sourceResult,
          sourceNodeKey: edge.sourceNodeKey,
        });
      }
      warnings.push(...(sourceResult.warnings || []));
    }

    if (node.nodeType === "source") {
      const sourceResult = await materializeCompiledNodeData(task, nodeKey, context, options);
      warnings.push(...(sourceResult.warnings || []));
      return { ...sourceResult, warnings: uniqueStrings(warnings.concat(sourceResult.warnings || [])) };
    }

    if (node.nodeType === "output") {
      if (inputResults.length !== 1) {
        throw new AppError(`Output node ${node.nodeName} must have exactly one upstream node`, 400);
      }
      const rows = buildOutputRows(inputResults[0].rows || [], node.nodeConfig?.outputFieldMappings);
      const fields = rows[0] ? Object.keys(rows[0]) : parseOutputFieldMappings(node.nodeConfig?.outputFieldMappings).map((item) => item.targetField);
      return {
        fields,
        rows: options.limit ? previewRows(rows, options.limit) : rows,
        rowCount: rows.length,
        warnings: uniqueStrings(warnings),
        columnMeta: buildRuntimeColumnMeta(fields, rows),
      };
    }

    const operatorCode = normalizeAiOperatorCode(node.operatorCode);
    if (operatorCode === "llm_row" || operatorCode === "llm_batch") {
      if (inputResults.length !== 1) {
        throw new AppError(`AI node ${node.nodeName} must have exactly one upstream node`, 400);
      }
      const upstreamResult = inputResults[0];
      const modelProviderId = Number(node.nodeConfig?.modelProviderId || 0);
      if (!modelProviderId) {
        throw new AppError(`AI node ${node.nodeName} must select a model configuration`, 400);
      }
      const provider = await modelProviderService.getModelProviderById(modelProviderId);
      const runtimeProvider = modelProviderService.applyModelSelection(provider, {
        modelName: trimText(node.nodeConfig?.modelName),
        modelVersion: trimText(node.nodeConfig?.modelVersion),
      });
      const outputFields = normalizeAiOutputFields(
        node.nodeConfig?.outputFields,
        node.nodeConfig?.outputFieldName,
        getAiFallbackFieldName(operatorCode)
      );
      const promptMappings = normalizePromptVariableMappings(node.nodeConfig?.promptVariables);
      const rows = [];
      if (operatorCode === "llm_batch") {
        const result = await requestAiNodeOutput(
          runtimeProvider,
          trimText(node.nodeConfig?.systemPrompt),
          trimText(node.nodeConfig?.userPrompt),
          buildBatchPromptVariables(upstreamResult.rows || [], promptMappings),
          outputFields
        );
        warnings.push(...result.warnings);
        rows.push({ ...result.values });
      } else {
        for (let index = 0; index < (upstreamResult.rows || []).length; index += 1) {
          const row = upstreamResult.rows[index];
          const result = await requestAiNodeOutput(
            runtimeProvider,
            trimText(node.nodeConfig?.systemPrompt),
            trimText(node.nodeConfig?.userPrompt),
            buildPromptVariables(row, index, promptMappings),
            outputFields
          );
          warnings.push(...result.warnings);
          rows.push({
            ...row,
            ...result.values,
          });
        }
      }
      const fields = rows[0]
        ? Object.keys(rows[0])
        : operatorCode === "llm_batch"
          ? outputFields.map((item) => item.fieldName)
          : uniqueStrings((upstreamResult.fields || []).concat(outputFields.map((item) => item.fieldName)));
      return {
        fields,
        rows: options.limit ? previewRows(rows, options.limit) : rows,
        rowCount: rows.length,
        warnings: uniqueStrings(warnings),
        columnMeta: buildRuntimeColumnMeta(fields, rows),
      };
    }

    if (!inputResults.length && node.nodeType === "operator") {
      throw new AppError(`Node ${node.nodeName} has no active upstream input`, 400);
    }

    const primary = inputResults.find((item) => item.sourceNodeKey === trimText(node.nodeConfig?.schemaSourceNodeKey))
      || inputResults[0]
      || { fields: [], rows: [] };
    let rows = (primary.rows || []).map((row) => ({ ...(row || {}) }));

    switch (trimText(node.operatorCode)) {
      case "filter": {
        const runtimeFilterRules = await resolveRuntimeFilterRules(inputResults, primary, node.nodeConfig?.filterRules, context);
        rows = evaluateRuleGroup(rows, runtimeFilterRules, node.nodeConfig?.filterLogic);
        break;
      }
      case "branch":
        break;
      case "select_columns": {
        const selectedColumns = parseStringArray(node.nodeConfig?.selectedColumns);
        rows = rows.map((row) =>
          (selectedColumns.length ? selectedColumns : Object.keys(row || {})).reduce((result, fieldName) => {
            result[fieldName] = row?.[fieldName];
            return result;
          }, {})
        );
        break;
      }
      case "rename_fields": {
        const renameMappings = parseObjectArray(node.nodeConfig?.renameMappings)
          .map((item) => ({ sourceField: trimText(item.sourceField), targetField: trimText(item.targetField) }))
          .filter((item) => item.sourceField && item.targetField);
        rows = rows.map((row) => {
          const nextRow = { ...(row || {}) };
          renameMappings.forEach((mapping) => {
            nextRow[mapping.targetField] = nextRow[mapping.sourceField];
            if (mapping.sourceField !== mapping.targetField) {
              delete nextRow[mapping.sourceField];
            }
          });
          return nextRow;
        });
        break;
      }
      case "sort":
        rows = sortRuntimeRows(rows, node.nodeConfig?.sortFields);
        break;
      case "limit_rows":
        rows = rows.slice(0, Math.max(1, Number(node.nodeConfig?.limitCount || 100)));
        break;
      case "deduplicate": {
        const keys = parseStringArray(node.nodeConfig?.dedupeKeys);
        rows = sortRuntimeRows(rows, node.nodeConfig?.dedupeSortFields);
        const seen = new Set();
        rows = rows.filter((row) => {
          const key = JSON.stringify(keys.map((fieldName) => row?.[fieldName]));
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
        break;
      }
      case "replace": {
        const fieldName = trimText(node.nodeConfig?.fieldName);
        const replaceRules = parseReplaceRules(node.nodeConfig?.replaceRules);
        rows = rows.map((row) => {
          const nextRow = { ...(row || {}) };
          replaceRules.forEach((rule) => {
            nextRow[fieldName] = applyReplaceRuleValue(nextRow[fieldName], rule);
          });
          return nextRow;
        });
        break;
      }
      case "format_convert": {
        const formatRules = parseFormatRules(node.nodeConfig?.formatRules);
        rows = rows.map((row) => {
          const nextRow = { ...(row || {}) };
          formatRules.forEach((rule) => {
            nextRow[rule.targetField] = formatRuntimeValue(row?.[rule.sourceField], rule);
          });
          return nextRow;
        });
        break;
      }
      case "compliance_check": {
        const complianceRules = parseComplianceRules(node.nodeConfig?.complianceRules);
        rows = rows.map((row) => {
          const nextRow = { ...(row || {}) };
          complianceRules.forEach((rule) => {
            nextRow[rule.targetField] = evaluateComplianceRule(row, rule);
          });
          return nextRow;
        });
        break;
      }
      case "string_transform": {
        const stringRules = parseStringRules(node.nodeConfig?.stringRules);
        rows = rows.map((row) => {
          const nextRow = { ...(row || {}) };
          stringRules.forEach((rule) => {
            nextRow[rule.targetField] = transformStringValue(row?.[rule.sourceField], rule);
          });
          return nextRow;
        });
        break;
      }
      case "desensitize": {
        const desensitizeRules = parseDesensitizeRules(node.nodeConfig?.desensitizeRules);
        rows = rows.map((row) => {
          const nextRow = { ...(row || {}) };
          desensitizeRules.forEach((rule) => {
            nextRow[rule.targetField] = desensitizeValue(row?.[rule.sourceField], rule);
          });
          return nextRow;
        });
        break;
      }
      case "union": {
        const mappings = parseColumnAlignmentRows(node.nodeConfig?.columnMappings);
        const unionMode = trimText(node.nodeConfig?.unionMode) || "all";
        if (mappings.length) {
          rows = inputResults.flatMap((result) =>
            (result.rows || []).map((row) =>
              mappings.reduce((output, mapping) => {
                const binding = (mapping.bindings || []).find((item) => item.sourceNodeKey === result.sourceNodeKey) || (mapping.bindings || [])[0];
                output[mapping.outputField] = binding?.fieldName ? row?.[binding.fieldName] : null;
                return output;
              }, {})
            )
          );
        } else {
          const allFields = uniqueStrings(inputResults.flatMap((result) => result.fields || []));
          rows = inputResults.flatMap((result) =>
            (result.rows || []).map((row) =>
              allFields.reduce((output, fieldName) => {
                output[fieldName] = row?.[fieldName];
                return output;
              }, {})
            )
          );
        }
        if (unionMode === "distinct") {
          const seen = new Set();
          rows = rows.filter((row) => {
            const key = JSON.stringify(row);
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });
        }
        break;
      }
      case "join": {
        if (inputResults.length !== 2) {
          throw new AppError(`Join node ${node.nodeName} must have exactly two upstream nodes`, 400);
        }
        const [leftResult, rightResult] = inputResults;
        const joinType = trimText(node.nodeConfig?.joinType) || "left";
        const joinKeys = parseJoinKeyRules(node.nodeConfig?.joinKeys);
        const leftOutputFields = parseStringArray(node.nodeConfig?.leftOutputFields);
        const rightOutputFields = parseStringArray(node.nodeConfig?.rightOutputFields);
        const leftFields = leftOutputFields.length ? leftOutputFields : (leftResult.fields || []);
        const rightFields = rightOutputFields.length ? rightOutputFields : (rightResult.fields || []);
        const buildJoinedRow = (leftRow, rightRow) => {
          const output = {};
          leftFields.forEach((fieldName) => {
            output[fieldName] = leftRow?.[fieldName];
          });
          rightFields.forEach((fieldName) => {
            const outputField = Object.prototype.hasOwnProperty.call(output, fieldName) ? `right_${fieldName}` : fieldName;
            output[outputField] = rightRow?.[fieldName];
          });
          return output;
        };
        const matches = (leftRow, rightRow) =>
          !joinKeys.length || joinKeys.every((rule) => String(leftRow?.[rule.leftField] ?? "") === String(rightRow?.[rule.rightField] ?? ""));
        const joinedRows = [];
        const matchedRightIndexes = new Set();
        (leftResult.rows || []).forEach((leftRow) => {
          const rightMatches = (rightResult.rows || []).map((rightRow, index) => ({ rightRow, index })).filter((item) => matches(leftRow, item.rightRow));
          if (rightMatches.length) {
            rightMatches.forEach((item) => {
              matchedRightIndexes.add(item.index);
              joinedRows.push(buildJoinedRow(leftRow, item.rightRow));
            });
          } else if (["left", "full"].includes(joinType)) {
            joinedRows.push(buildJoinedRow(leftRow, null));
          }
        });
        if (["right", "full"].includes(joinType)) {
          (rightResult.rows || []).forEach((rightRow, index) => {
            if (!matchedRightIndexes.has(index)) {
              joinedRows.push(buildJoinedRow(null, rightRow));
            }
          });
        }
        if (joinType === "inner") {
          rows = joinedRows.filter((row) => Object.values(row).some((value) => value !== undefined && value !== null));
        } else if (joinType === "cross") {
          rows = (leftResult.rows || []).flatMap((leftRow) => (rightResult.rows || []).map((rightRow) => buildJoinedRow(leftRow, rightRow)));
        } else {
          rows = joinedRows;
        }
        break;
      }
      case "string_aggregate": {
        const groupByFields = parseStringArray(node.nodeConfig?.groupByFields);
        const aggregateRules = parseStringAggregateRules(node.nodeConfig?.stringAggregateRules);
        const groups = new Map();
        rows.forEach((row) => {
          const key = JSON.stringify(groupByFields.map((fieldName) => row?.[fieldName]));
          groups.set(key, [...(groups.get(key) || []), row]);
        });
        rows = Array.from(groups.values()).map((groupRows) => {
          const base = {};
          groupByFields.forEach((fieldName) => {
            base[fieldName] = groupRows[0]?.[fieldName];
          });
          aggregateRules.forEach((rule) => {
            const values = groupRows
              .map((row) => stringifyAggregateValue(row?.[rule.sourceField]))
              .filter((value) => value !== "");
            const normalizedValues = rule.distinct ? Array.from(new Set(values)) : values;
            base[rule.outputField] = normalizedValues.join(rule.separator === undefined || rule.separator === null ? "," : String(rule.separator));
          });
          return base;
        });
        break;
      }
      case "string_split": {
        const splitConfig = parseStringSplitConfig(node.nodeConfig);
        rows = buildStringSplitRuntimeRows(rows, splitConfig);
        break;
      }
      case "aggregate": {
        const groupByFields = parseStringArray(node.nodeConfig?.groupByFields);
        const aggregationRules = parseAggregationRules(node.nodeConfig?.aggregations);
        const groups = new Map();
        rows.forEach((row) => {
          const key = JSON.stringify(groupByFields.map((fieldName) => row?.[fieldName]));
          groups.set(key, [...(groups.get(key) || []), row]);
        });
        rows = Array.from(groups.values()).map((groupRows) => {
          const base = {};
          groupByFields.forEach((fieldName) => {
            base[fieldName] = groupRows[0]?.[fieldName];
          });
          aggregationRules.forEach((rule) => {
            const values = groupRows.map((row) => row?.[rule.fieldName]).filter((value) => value !== null && value !== undefined && value !== "");
            const alias = rule.alias || `${rule.aggregateFunction}_${rule.fieldName && rule.fieldName !== "__all__" ? rule.fieldName : "rows"}`;
            switch (rule.aggregateFunction) {
              case "count_distinct":
                base[alias] = new Set(values.map((value) => String(value))).size;
                break;
              case "sum":
                base[alias] = values.reduce((sum, value) => sum + Number(value || 0), 0);
                break;
              case "avg":
                base[alias] = values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
                break;
              case "max":
                base[alias] = values.length ? values.reduce((max, value) => (compareRuntimeValues(value, max) > 0 ? value : max), values[0]) : null;
                break;
              case "min":
                base[alias] = values.length ? values.reduce((min, value) => (compareRuntimeValues(value, min) < 0 ? value : min), values[0]) : null;
                break;
              case "count":
              default:
                base[alias] = rule.fieldName && rule.fieldName !== "__all__" ? values.length : groupRows.length;
                break;
            }
          });
          return base;
        });
        break;
      }
      default:
        throw new AppError(`Runtime preview/run after AI does not support operator ${node.nodeName} / ${node.operatorCode} yet`, 400);
    }

    const fields = rows[0]
      ? Object.keys(rows[0])
      : trimText(node.operatorCode) === "string_aggregate"
        ? parseStringArray(node.nodeConfig?.groupByFields).concat(parseStringAggregateRules(node.nodeConfig?.stringAggregateRules).map((item) => item.outputField))
        : trimText(node.operatorCode) === "string_split"
          ? (() => {
            const splitConfig = parseStringSplitConfig(node.nodeConfig);
            const baseFields = (primary.fields || []).map((fieldName) => fieldName === splitConfig.sourceField ? splitConfig.outputField : fieldName);
            if (!baseFields.includes(splitConfig.outputField)) {
              baseFields.push(splitConfig.outputField);
            }
            if (splitConfig.indexField) {
              baseFields.push(splitConfig.indexField);
            }
            return baseFields;
          })()
          : primary.fields || [];
    return {
      fields,
      rows: options.limit ? previewRows(rows, options.limit) : rows,
      rowCount: rows.length,
      warnings: uniqueStrings(warnings),
      columnMeta: buildRuntimeColumnMeta(fields, rows),
    };
  })();

  cache.set(cacheKey, promise);
  return promise;
}

async function materializeRuntimeNodePreview(task, nodeKey, context, previewLimit) {
  const preview = await orchestrationCompiler.compileOrchestrationTask(
    task,
    buildOrchestrationCompilerOptions(task, context, {
      targetNodeKey: nodeKey,
      previewLimit,
    })
  );
  const currentNode = preview.nodeSqls.find((item) => item.nodeKey === preview.finalNodeKey);
  const runtimeData = await materializeRuntimeNodeRows(task, nodeKey, context, { limit: previewLimit }, new Map());
  return {
    preview,
    currentNode,
    fields: runtimeData.fields || preview.finalColumns || [],
    rows: runtimeData.rows || [],
    rowCount: runtimeData.rowCount || 0,
    warnings: uniqueStrings((preview.warnings || []).concat(runtimeData.warnings || [])),
    columnMeta: runtimeData.columnMeta || buildRuntimeColumnMeta(runtimeData.fields || preview.finalColumns || [], runtimeData.rows || []),
  };
}

function resolveRuntimeSqlType(fieldName, rows, dialect) {
  const inferredType = inferRuntimeColumnDataType(fieldName, rows);
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (["integer", "boolean"].includes(inferredType)) {
    return normalizedDialect === "oracle" ? "NUMBER(38)" : normalizedDialect === "postgresql" ? "BIGINT" : normalizedDialect === "clickhouse" ? "Int64" : normalizedDialect === "hive" ? "BIGINT" : "BIGINT";
  }
  if (inferredType === "number") {
    return normalizedDialect === "oracle" ? "NUMBER(18,6)" : normalizedDialect === "postgresql" ? "NUMERIC(18,6)" : normalizedDialect === "clickhouse" ? "Float64" : normalizedDialect === "hive" ? "DOUBLE" : "DECIMAL(18,6)";
  }
  if (inferredType === "date") {
    return "DATE";
  }
  if (inferredType === "datetime") {
    return ["postgresql", "oracle", "dm"].includes(normalizedDialect) ? "TIMESTAMP" : normalizedDialect === "clickhouse" ? "DateTime" : normalizedDialect === "hive" ? "TIMESTAMP" : "DATETIME";
  }
  return normalizedDialect === "postgresql" ? "TEXT" : normalizedDialect === "oracle" ? "VARCHAR2(2048)" : normalizedDialect === "clickhouse" ? "String" : normalizedDialect === "hive" ? "STRING" : "VARCHAR(2048)";
}

function buildCreateTableStatement(tableName, fields, rows, dialect, overwrite) {
  const normalizedDialect = normalizeSqlDialect(dialect);
  if (normalizedDialect === "oracle") {
    const dropSql = overwrite ? `BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${quoteIdentifier(tableName, dialect).replace(/'/g, "''")}'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;` : "";
    const createSql = `CREATE TABLE ${quoteIdentifier(tableName, dialect)} (\n${fields
      .map((fieldName) => `  ${quoteIdentifier(fieldName, dialect)} ${resolveRuntimeSqlType(fieldName, rows, dialect)}`)
      .join(",\n")}\n);`;
    return [dropSql, createSql].filter(Boolean);
  }
  const dropSql = overwrite ? `DROP TABLE IF EXISTS ${quoteIdentifier(tableName, dialect)};` : "";
  const createSql = `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName, dialect)} (\n${fields
    .map((fieldName) => `  ${quoteIdentifier(fieldName, dialect)} ${resolveRuntimeSqlType(fieldName, rows, dialect)}`)
    .join(",\n")}\n);`;
  return [dropSql, createSql].filter(Boolean);
}

function buildInsertStatements(tableName, fields, rows, dialect) {
  if (!fields.length || !rows.length) {
    return [];
  }
  const chunkSize = 200;
  const statements = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (normalizeSqlDialect(dialect) === "oracle") {
      const target = quoteIdentifier(tableName, dialect);
      const columns = fields.map((fieldName) => quoteIdentifier(fieldName, dialect)).join(", ");
      statements.push(`INSERT ALL\n${chunk.map((row) => `  INTO ${target} (${columns}) VALUES (${fields.map((fieldName) => escapeSqlLiteral(row?.[fieldName])).join(", ")})`).join("\n")}\nSELECT 1 FROM DUAL;`);
      continue;
    }
    const valuesSql = chunk
      .map((row) => `(${fields.map((fieldName) => escapeSqlLiteral(row?.[fieldName])).join(", ")})`)
      .join(",\n");
    statements.push(
      `INSERT INTO ${quoteIdentifier(tableName, dialect)} (${fields.map((fieldName) => quoteIdentifier(fieldName, dialect)).join(", ")})\nVALUES\n${valuesSql};`
    );
  }
  return statements;
}

async function buildOrchestrationExecutionContext(task, options = {}) {
  const environmentBundle = await ensureOrchestrationDatasourceEnvironment(task);
  const effectiveDatasourceId = environmentBundle.effectiveDatasource?.id || task.datasourceId || null;
  if (options.requireDatasource && !effectiveDatasourceId) {
    throw new AppError("The current orchestration task is not bound to an executable datasource and cannot preview node output", 400);
  }

  const datasource = environmentBundle.effectiveDatasource || (effectiveDatasourceId ? materializeDatasource(await requireDatasource(effectiveDatasourceId, true)) : null);
  const adapter = datasource ? getAdapter(datasource) : null;
  const databaseName = task.databaseName || datasource?.databaseName || null;
  const fallbackDialect = inferDatasourceDialect(task.datasourceType || "mysql");

  return {
    effectiveDatasourceId,
    datasource,
    adapter,
    databaseName,
    dialect: datasource?.type || fallbackDialect || "mysql",
  };
}

function buildOrchestrationCompilerOptions(task, context, overrides = {}) {
  return {
    datasourceId: context.effectiveDatasourceId,
    datasourceType: context.datasource?.storageType || task.datasourceType || null,
    databaseName: context.databaseName,
    dialect: context.dialect,
    ...overrides,
    async loadSourceColumns(source) {
      if (!context.adapter || !context.datasource) {
        return [];
      }
      return context.adapter.getColumns(
        context.datasource,
        source.databaseName || context.datasource.databaseName,
        source.tableName
      );
    },
  };
}

async function materializeCompiledNodePreview(task, nodeKey, context, previewLimit) {
  const preview = await orchestrationCompiler.compileOrchestrationTask(
    task,
    buildOrchestrationCompilerOptions(task, context, {
      targetNodeKey: nodeKey,
      previewLimit,
    })
  );

  if (!context.adapter || !context.datasource) {
    throw new AppError("Datasource is required for orchestration node preview", 400);
  }

  const queryResult = await context.adapter.executeQuery(context.datasource, preview.previewSql, {
    databaseName: context.databaseName || context.datasource.databaseName,
    resultLimit: previewLimit,
  });
  const resultPreview = buildResultPreview(queryResult) || { fields: [], rows: [], rowCount: 0 };
  const currentNode = preview.nodeSqls.find((item) => item.nodeKey === preview.finalNodeKey);

  return {
    preview,
    currentNode,
    fields: resultPreview.fields?.length ? resultPreview.fields : preview.finalColumns || [],
    rows: resultPreview.rows || [],
    rowCount: resultPreview.rowCount || 0,
  };
}

async function materializeAiNodePreview(task, node, context, previewLimit) {
  const normalizedOperatorCode = normalizeAiOperatorCode(node.operatorCode);
  const aiPreviewLimit = normalizePreviewLimit(previewLimit, normalizedOperatorCode === "llm_batch" ? 10 : 5);
  const previewBundle = await orchestrationCompiler.compileOrchestrationTask(
    task,
    buildOrchestrationCompilerOptions(task, context, {
      targetNodeKey: node.nodeKey,
      previewLimit: aiPreviewLimit,
    })
  );
  const currentNode = previewBundle.nodeSqls.find((item) => item.nodeKey === previewBundle.finalNodeKey);
  const incomingNodeKeys = getIncomingOrchestrationNodeKeys(task, node.nodeKey);

  if (incomingNodeKeys.length !== 1) {
    throw new AppError(`AI node ${node.nodeName} must have exactly one upstream node`, 400);
  }

  const upstreamResult = await materializeOrchestrationNodePreviewData(task, incomingNodeKeys[0], context, aiPreviewLimit);
  const modelProviderId = Number(node.nodeConfig?.modelProviderId || 0);
  if (!modelProviderId) {
    throw new AppError(`AI node ${node.nodeName} must select a model configuration`, 400);
  }

  const provider = await modelProviderService.getModelProviderById(modelProviderId);
  const runtimeProvider = modelProviderService.applyModelSelection(provider, {
    modelName: trimText(node.nodeConfig?.modelName),
    modelVersion: trimText(node.nodeConfig?.modelVersion),
  });
  const systemPromptTemplate = trimText(node.nodeConfig?.systemPrompt);
  const userPromptTemplate = trimText(node.nodeConfig?.userPrompt);
  const outputFields = normalizeAiOutputFields(
    node.nodeConfig?.outputFields,
    node.nodeConfig?.outputFieldName,
    getAiFallbackFieldName(normalizedOperatorCode)
  );
  const promptMappings = normalizePromptVariableMappings(node.nodeConfig?.promptVariables);
  const warnings = [...(previewBundle.warnings || []), ...(upstreamResult.warnings || [])];

  if (!userPromptTemplate) {
    throw new AppError(`AI node ${node.nodeName} must configure a user prompt`, 400);
  }

  if (!outputFields.length) {
    throw new AppError(`AI node ${node.nodeName} must configure at least one output field`, 400);
  }

  const outputFieldNames = outputFields.map((item) => item.fieldName);
  if (new Set(outputFieldNames).size !== outputFieldNames.length) {
    throw new AppError(`AI node ${node.nodeName} has duplicate output fields`, 400);
  }

  if (previewLimit > aiPreviewLimit) {
    warnings.push(`AI preview is limited to ${aiPreviewLimit} rows per request to control cost and latency.`);
  }

  if (!upstreamResult.rows.length) {
    warnings.push(`AI node ${node.nodeName} has no upstream preview rows to evaluate.`);
    return {
      preview: previewBundle,
      currentNode,
      fields: previewBundle.finalColumns || [],
      rows: [],
      rowCount: 0,
      warnings: uniqueStrings(warnings),
    };
  }

  const rows = [];
  if (normalizedOperatorCode === "llm_batch") {
    const batchVariables = buildBatchPromptVariables(upstreamResult.rows, promptMappings);
    const batchResult = await requestAiNodeOutput(
      runtimeProvider,
      systemPromptTemplate,
      userPromptTemplate,
      batchVariables,
      outputFields
    );

    warnings.push(...batchResult.warnings);
    rows.push({
      ...batchResult.values,
    });
    warnings.push(`AI batch node ${node.nodeName} preview uses ${upstreamResult.rows.length} sampled rows and returns a single aggregated result row.`);
  } else {
    for (let index = 0; index < upstreamResult.rows.length; index += 1) {
      const row = upstreamResult.rows[index];
      const variables = buildPromptVariables(row, index, promptMappings);
      const rowResult = await requestAiNodeOutput(
        runtimeProvider,
        systemPromptTemplate,
        userPromptTemplate,
        variables,
        outputFields
      );

      warnings.push(...rowResult.warnings);
      rows.push({
        ...row,
        ...rowResult.values,
      });
    }
  }

  warnings.push(`AI node ${node.nodeName} preview executed with ${runtimeProvider.configName} / ${runtimeProvider.selectedModelVersion || runtimeProvider.modelVersion}.`);

  return {
    preview: previewBundle,
    currentNode,
    fields: previewBundle.finalColumns || [],
    rows,
    rowCount: rows.length,
    warnings: uniqueStrings(warnings),
  };
}

async function materializeOrchestrationNodePreviewData(task, nodeKey, context, previewLimit) {
  if (orchestrationLineageContainsRuntimeOperator(task, nodeKey)) {
    return materializeRuntimeNodePreview(task, nodeKey, context, previewLimit);
  }

  const compiled = await materializeCompiledNodePreview(task, nodeKey, context, previewLimit);
  return {
    ...compiled,
    columnMeta: buildRuntimeColumnMeta(compiled.fields?.length ? compiled.fields : compiled.preview.finalColumns || [], compiled.rows || []),
    warnings: compiled.preview.warnings || [],
  };
}

async function saveOrchestrationGraph(id, graph) {
  await requireOrchestrationTask(id);
  await ensureOrchestrationDatasourceEnvironment({ ...graph, datasourceId: null });

  const nodeKeySet = new Set();
  const nodeMap = new Map();
  for (const node of graph.nodes) {
    if (nodeKeySet.has(node.nodeKey)) {
      throw new AppError(`Duplicate node key: ${node.nodeKey}`, 400);
    }
    nodeKeySet.add(node.nodeKey);
    nodeMap.set(node.nodeKey, node);
  }

  for (const edge of graph.edges) {
    if (!nodeKeySet.has(edge.sourceNodeKey) || !nodeKeySet.has(edge.targetNodeKey)) {
      throw new AppError("Orchestration edge references a node that does not exist", 400);
    }

    const sourceNode = nodeMap.get(edge.sourceNodeKey);
    if (sourceNode?.nodeType === "operator" && String(sourceNode.operatorCode || "").trim() === "branch") {
      const sourcePort = String(edge.sourcePort || "").trim();
      if (sourcePort && !["branch_true", "branch_false"].includes(sourcePort)) {
        throw new AppError(`Branch node ${sourceNode.nodeName} must connect by true/false output ports`, 400);
      }
    }
  }

  try {
    const activeEdges = graph.edges.filter((edge) => String(edge.edgeStatus || "active").trim().toLowerCase() !== "paused");
    scheduler.buildTopologicalOrder(graph.nodes, activeEdges);
  } catch (error) {
    throw new AppError(error.message || "Orchestration graph is invalid", 400);
  }

  return repository.replaceOrchestrationGraph(id, graph.nodes, graph.edges);
}

async function compileOrchestrationSql(id) {
  const task = await requireOrchestrationTask(id);

  const environmentBundle = await ensureOrchestrationDatasourceEnvironment(task);
  if (environmentBundle.sourceDatasourceIds.length > 1 && !environmentBundle.effectiveDatasource) {
    throw new AppError("当前阶段 SQL 预览仅支持单数据源编排", 400);
  }

  const effectiveDatasourceId = environmentBundle.effectiveDatasource?.id || task.datasourceId || null;
  const datasource = environmentBundle.effectiveDatasource || (effectiveDatasourceId ? materializeDatasource(await requireDatasource(effectiveDatasourceId, true)) : null);
  const adapter = datasource ? getAdapter(datasource) : null;
  const fallbackDialect = inferDatasourceDialect(task.datasourceType || "mysql");

  return orchestrationCompiler.compileOrchestrationTask(task, {
    datasourceId: effectiveDatasourceId,
    datasourceType: datasource?.storageType || task.datasourceType || null,
    databaseName: task.databaseName || datasource?.databaseName || null,
    dialect: datasource?.type || fallbackDialect || "mysql",
    async loadSourceColumns(source) {
      if (!adapter || !datasource) return [];
      return adapter.getColumns(datasource, source.databaseName || datasource.databaseName, source.tableName);
    },
  });
}

async function previewOrchestrationNode(id, nodeKey, options = {}) {
  const task = await requireOrchestrationTask(id);
  const previewContext = await buildOrchestrationExecutionContext(task, { requireDatasource: true });
  const requestedPreviewLimit = normalizePreviewLimit(options.limit);
  const previewStartedAt = Date.now();
  const previewResult = await materializeOrchestrationNodePreviewData(task, nodeKey, previewContext, requestedPreviewLimit);
  const previewData = previewResult.preview;
  const currentPreviewNode = previewResult.currentNode;

  return {
    taskId: previewData.taskId,
    taskName: previewData.taskName,
    nodeKey: previewData.finalNodeKey,
    nodeName: previewData.finalNodeName,
    nodeType: currentPreviewNode?.nodeType || "operator",
    operatorCode: currentPreviewNode?.operatorCode || "",
    cteName: currentPreviewNode?.cteName || null,
    datasourceId: previewContext.effectiveDatasourceId,
    datasourceType: previewContext.datasource?.storageType || previewData.datasourceType || task.datasourceType || null,
    databaseName: previewContext.databaseName,
    dialect: previewData.dialect,
    previewSql: previewData.previewSql,
    nodeSql: currentPreviewNode?.sql || "",
    columns: previewData.finalColumns || [],
    columnMeta: previewResult.columnMeta || buildRuntimeColumnMeta(previewResult.fields?.length ? previewResult.fields : previewData.finalColumns || [], previewResult.rows || []),
    warnings: previewResult.warnings || previewData.warnings || [],
    fields: previewResult.fields?.length ? previewResult.fields : previewData.finalColumns || [],
    rows: previewResult.rows || [],
    rowCount: previewResult.rowCount || 0,
    durationMs: Date.now() - previewStartedAt,
  };
}

async function runOrchestration(id) {
  const task = await requireOrchestrationTask(id);
  const executionContext = await buildOrchestrationExecutionContext(task, { requireDatasource: true });
  if (!executionContext.adapter || !executionContext.datasource) {
    throw new AppError("The current orchestration task is not bound to an executable datasource", 400);
  }

  const startedAt = Date.now();
  const compiled = await orchestrationCompiler.compileOrchestrationTask(
    task,
    buildOrchestrationCompilerOptions(task, executionContext)
  );

  const outputNodes = (task.nodes || []).filter((node) => node.nodeType === "output");
  if (!outputNodes.length) {
    throw new AppError("The current orchestration task has no executable output node. Please configure at least one data output operator.", 400);
  }

  const databaseName = executionContext.databaseName || executionContext.datasource.databaseName;
  const useRowRuntime = compiled.hasRuntimeOperators || outputNodes.some((node) =>
    Boolean(node.nodeConfig?.createTargetTable) || parseOutputFieldMappings(node.nodeConfig?.outputFieldMappings).length
  );
  let statementCount = 0;
  const runtimeWarnings = [...filterRunWarnings(compiled.warnings || [])];

  if (!useRowRuntime && compiled.outputStatements.length) {
    for (const statement of compiled.outputStatements) {
      await executionContext.adapter.executeStatement(executionContext.datasource, statement.sql, {
        databaseName,
      });
      statementCount += 1;
    }
  } else {
    const runtimeCache = new Map();
    for (const outputNode of outputNodes) {
      const targetTable = trimText(outputNode.nodeConfig?.targetTable);
      if (!targetTable) {
        throw new AppError(`Output node ${outputNode.nodeName} must configure a target table`, 400);
      }
      const writeMode = trimText(outputNode.nodeConfig?.writeMode) || "overwrite";
      if (writeMode === "upsert") {
        throw new AppError(`Output node ${outputNode.nodeName} does not support upsert in mixed runtime mode yet`, 400);
      }
      const outputResult = orchestrationLineageContainsRuntimeOperator(task, outputNode.nodeKey)
        ? await materializeRuntimeNodeRows(task, outputNode.nodeKey, executionContext, { limit: null }, runtimeCache)
        : await materializeCompiledNodeData(task, outputNode.nodeKey, executionContext, { limit: null });
      runtimeWarnings.push(...(outputResult.warnings || []));
      const fields = outputResult.fields?.length
        ? outputResult.fields
        : parseOutputFieldMappings(outputNode.nodeConfig?.outputFieldMappings).map((item) => item.targetField);
      const rows = outputResult.rows || [];
      const statements = [];
      if (outputNode.nodeConfig?.createTargetTable) {
        statements.push(...buildCreateTableStatement(targetTable, fields, rows, executionContext.dialect, writeMode === "overwrite"));
      } else if (writeMode === "overwrite") {
        statements.push(`TRUNCATE TABLE ${quoteIdentifier(targetTable, executionContext.dialect)};`);
      }
      statements.push(...buildInsertStatements(targetTable, fields, rows, executionContext.dialect));
      for (const sqlText of statements) {
        await executionContext.adapter.executeStatement(executionContext.datasource, sqlText, {
          databaseName,
        });
        statementCount += 1;
      }
    }
  }

  return {
    taskId: compiled.taskId,
    taskName: compiled.taskName,
    datasourceId: executionContext.effectiveDatasourceId,
    datasourceType: executionContext.datasource.storageType || compiled.datasourceType || null,
    databaseName,
    dialect: compiled.dialect,
    executedAt: formatDateTime(),
    durationMs: Date.now() - startedAt,
    statementCount,
    targetTables: outputNodes.map((item) => trimText(item.nodeConfig?.targetTable)).filter(Boolean),
    warnings: filterRunWarnings(runtimeWarnings),
  };
}

async function createWorkflow(payload) {
  if (payload.cronExpr && !scheduler.validateCronExpression(payload.cronExpr)) {
    throw new AppError("Cron 表达式格式不正确", 400);
  }
  const workflow = await repository.createWorkflow(payload);
  await scheduler.reloadSchedules();
  return workflow;
}

function buildTaskWorkflowGraph(taskType, task) {
  const taskConfig = {
    script: {
      nodeType: "script",
      idField: "scriptId",
      description: "SQL任务",
    },
    processing: {
      nodeType: "processing",
      idField: "processingJobId",
      description: "数据处理任务",
    },
    operator_task: {
      nodeType: "operator_task",
      idField: "orchestrationTaskId",
      description: "算子平台任务",
    },
  }[taskType];

  if (!taskConfig) {
    throw new AppError("不支持的调度任务类型", 400);
  }

  return {
    description: taskConfig.description,
    nodes: [
      {
        nodeType: "start",
        nodeKey: "start",
        nodeName: "开始",
        positionX: 80,
        positionY: 220,
        width: 240,
        height: 88,
        retryTimes: null,
        retryIntervalSec: 5,
        timeoutSec: null,
        triggerRule: "all_success",
        nodeConfig: {},
      },
      {
        nodeType: taskConfig.nodeType,
        [taskConfig.idField]: task.id,
        nodeKey: "task",
        nodeName: task.name,
        positionX: 400,
        positionY: 220,
        width: 240,
        height: 88,
        retryTimes: null,
        retryIntervalSec: 5,
        timeoutSec: null,
        triggerRule: "all_success",
        nodeConfig: {},
      },
      {
        nodeType: "end",
        nodeKey: "end",
        nodeName: "结束",
        positionX: 720,
        positionY: 220,
        width: 240,
        height: 88,
        retryTimes: null,
        retryIntervalSec: 5,
        timeoutSec: null,
        triggerRule: "all_success",
        nodeConfig: {},
      },
    ],
    edges: [
      { sourceNodeKey: "start", targetNodeKey: "task", edgeType: "default", edgeLabel: "default" },
      { sourceNodeKey: "task", targetNodeKey: "end", edgeType: "default", edgeLabel: "default" },
    ],
  };
}

async function createWorkflowFromTask(payload) {
  const requireTask = {
    script: requireScript,
    processing: requireProcessingJob,
    operator_task: requireOrchestrationTask,
  }[payload.taskType];
  if (!requireTask) {
    throw new AppError("不支持的调度任务类型", 400);
  }

  const task = await requireTask(payload.taskId);
  const graph = buildTaskWorkflowGraph(payload.taskType, task);
  const defaultName = `${task.name}-调度工作流`.slice(0, 128);
  const workflow = await repository.createWorkflow({
    name: payload.name || defaultName,
    description: `由${graph.description}【${task.name}】一键创建`,
    cronExpr: null,
    isPaused: true,
    retryTimes: 0,
    timeoutSec: 300,
    runtimeConfig: {
      sourceTask: {
        taskType: payload.taskType,
        taskId: task.id,
      },
    },
  });

  try {
    const saved = await saveWorkflowGraph(workflow.id, graph);
    await scheduler.reloadSchedules();
    return saved;
  } catch (error) {
    await repository.deleteWorkflow(workflow.id);
    throw error;
  }
}

async function updateWorkflow(id, payload) {
  const current = await requireWorkflow(id);
  if (payload.cronExpr && !scheduler.validateCronExpression(payload.cronExpr)) {
    throw new AppError("Cron 表达式格式不正确", 400);
  }
  if (payload.cronExpr && !payload.isPaused && !current.publishedVersionNo) {
    throw new AppError("工作流尚无可运行的发布版本，请先完成并保存工作流画布", 400);
  }
  const workflow = await repository.updateWorkflow(id, payload);
  await scheduler.reloadSchedules();
  return workflow;
}

async function deleteWorkflow(id) {
  const deleted = await repository.deleteWorkflow(id);
  if (!deleted) {
    throw new AppError("Workflow not found", 404);
  }
  await scheduler.reloadSchedules();
}

async function saveWorkflowGraph(id, graph) {
  const currentWorkflow = await requireWorkflow(id);
  const nodeKeySet = new Set();
  for (const node of graph.nodes) {
    if (nodeKeySet.has(node.nodeKey)) {
      throw new AppError(`Duplicate node key: ${node.nodeKey}`, 400);
    }
    nodeKeySet.add(node.nodeKey);
    if (node.nodeType === "script") {
      if (!node.scriptId) {
        throw new AppError(`Script node ${node.nodeName} must bind a script`, 400);
      }
      await requireScript(node.scriptId);
    }
    if (node.nodeType === "processing") {
      if (!node.processingJobId) {
        throw new AppError(`数据处理节点 ${node.nodeName} 必须绑定数据处理任务`, 400);
      }
      await requireProcessingJob(node.processingJobId);
    }
    if (node.nodeType === "operator_task") {
      if (!node.orchestrationTaskId) {
        throw new AppError(`算子任务节点 ${node.nodeName} 必须绑定算子任务`, 400);
      }
      await requireOrchestrationTask(node.orchestrationTaskId);
    }
    if (node.nodeType === "branch" && node.nodeConfig?.datasourceId) {
      await requireDatasource(Number(node.nodeConfig.datasourceId));
    }
  }

  for (const edge of graph.edges) {
    if (!nodeKeySet.has(edge.sourceNodeKey) || !nodeKeySet.has(edge.targetNodeKey)) {
      throw new AppError("Workflow edge references a node that does not exist", 400);
    }
  }

  const draftValidation = validateWorkflowGraph({
    ...currentWorkflow,
    nodes: graph.nodes,
    edges: graph.edges,
  }, { strict: false });
  if (!draftValidation.valid) {
    throw new AppError(draftValidation.errors[0] || "工作流图存在环路或无效连线", 400);
  }

  const workflow = await repository.replaceWorkflowGraph(id, graph.nodes, graph.edges);
  const validation = validateWorkflowGraph(workflow, { strict: true });
  if (validation.valid) {
    await publishWorkflowGraph(workflow, validation);
  }
  return repository.getWorkflowById(id);
}

async function validateWorkflow(id) {
  const workflow = await requireWorkflow(id);
  return validateWorkflowGraph(workflow, { strict: true });
}

async function runWorkflow(id, options = {}) {
  const workflow = await requireWorkflow(id);
  const validation = validateWorkflowGraph(workflow, { strict: true });
  if (!validation.valid) {
    throw new AppError(validation.errors.join("; "), 400);
  }
  let version = await repository.getPublishedWorkflowVersion(id);
  if (!version) {
    version = await publishWorkflowGraph(workflow, validation);
  }
  const run = await repository.createWorkflowRun({
    workflowId: id,
    triggerType: options.triggerType || "manual",
    runParams: options.runParams || {},
    status: "pending",
    workflowVersionNo: version.versionNo,
    graphSnapshot: version.graphSnapshot,
    workflowRetryCount: 0,
    startedAt: null,
  });
  scheduler.enqueueWorkflowRun(run.id);
  return run;
}

async function listWorkflowRuns(id) {
  await requireWorkflow(id);
  return repository.listWorkflowRuns(id);
}

async function listInstances(filters) {
  return repository.listInstances(filters);
}

async function getInstance(id) {
  const instance = await repository.getJobInstanceById(id);
  if (!instance) {
    throw new AppError("Instance not found", 404);
  }
  return instance;
}

async function listInstanceLogs(id) {
  await getInstance(id);
  return repository.listJobLogs(id);
}

module.exports = {
  buildTaskWorkflowGraph,
  createOrchestrationTask,
  createProcessingJob,
  createDatasource,
  createScript,
  createScriptFolder,
  createWorkflow,
  createWorkflowFromTask,
  deleteOrchestrationTask,
  deleteProcessingJob,
  deleteDatasource,
  deleteScript,
  deleteScriptFolder,
  deleteWorkflow,
  executeQuery,
  getDatasource,
  getInstance,
  getOrchestrationTask,
  getProcessingJob,
  getScript,
  getWorkflow,
  listDatasourceColumns,
  listDatasourceFunctions,
  listDatasourceDatabases,
  listDatasourceTables,
  listDatasources,
  listInstanceLogs,
  listInstances,
  listOrchestrationTasks,
  listProcessingJobs,
  listProcessingJobRuns,
  compileOrchestrationSql,
  previewProcessingJob,
  previewProcessingJobDraft,
  previewOrchestrationNode,
  runProcessingJob,
  runOrchestration,
  listQueryHistory,
  listCopilotSessionMessages,
  listCopilotSessions,
  runCopilotTask,
  runCopilotTaskStream,
  listScriptFolders,
  listScriptVersions,
  listScripts,
  listWorkflowRuns,
  listWorkflows,
  runWorkflow,
  saveOrchestrationGraph,
  saveScriptAs,
  saveScriptVersion,
  saveWorkflowGraph,
  testDatasource,
  testDatasourceConfig,
  updateOrchestrationTask,
  updateProcessingJob,
  updateDatasource,
  updateScript,
  updateScriptFolder,
  updateWorkflow,
  validateWorkflowGraph,
  validateWorkflow,
};
