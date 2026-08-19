#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const XLSX = require("xlsx");

const root = path.resolve(__dirname, "..");
const inputFile = path.join(root, "航空业本体CLI完整导入包.xlsx");
const cli = process.env.DATA_PLATFORM_CLI_BIN || path.join(root, ".local", "data-platform-cli", "install", "node_modules", ".bin", "data-platform");
const profile = process.env.AVIATION_CLI_PROFILE || "aviation";
const projectId = Number(process.env.AVIATION_CLI_PROJECT_ID || 2);
const projectCode = process.env.AVIATION_CLI_PROJECT_CODE || "aviation_ontology_cli_20260813";
const outputFile = process.env.AVIATION_CLI_DIFF_FILE || path.join(root, "航空业本体CLI导入差异清单.xlsx");
const runId = `aviation-cli-excel-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

function sha256(value) {
  const content = typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function asBool(value) { return String(value || "").toUpperCase() === "TRUE"; }
function asJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
function rows(workbook, sheet) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: null, raw: false });
}
function resolveCell(value) {
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(String(value || "").trim());
  if (!match) return value;
  return process.env[match[1]] || value;
}
function listData(result) {
  const value = result?.parsed?.data;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}
function groupRows(values, key) {
  const grouped = new Map();
  for (const row of values) {
    const group = grouped.get(row[key]) || [];
    group.push(row);
    grouped.set(row[key], group);
  }
  return grouped;
}
function sourcePayload(row) {
  const sourceType = row.source_type === "http" ? "api" : row.source_type;
  const connectionConfig = {};
  if (row.host_or_base_url) {
    const resolved = resolveCell(row.host_or_base_url);
    if (sourceType === "api") connectionConfig.baseUrl = resolved;
    else connectionConfig.host = resolved;
  }
  if (row.port) connectionConfig.port = resolveCell(row.port);
  if (row.database_or_schema) {
    connectionConfig.database = resolveCell(row.database_or_schema);
    if (sourceType === "postgresql") connectionConfig.schema = "ods";
  }
  if (row.username) connectionConfig.username = resolveCell(row.username);
  if (row.secret_ref) connectionConfig.secretRef = row.secret_ref;
  return {
    sourceName: row.source_name,
    sourceCode: row.source_code,
    sourceType,
    ownerName: "System Administrator",
    status: "active",
    connectionConfig: { ...connectionConfig, sourceScope: row.source_scope, authMode: row.auth_mode },
  };
}
function developmentSourcePayload(row) {
  const resolvedHost = resolveCell(row.host_or_base_url);
  const resolvedPort = resolveCell(row.port);
  const resolvedDatabase = resolveCell(row.database_or_schema);
  const resolvedUsername = resolveCell(row.username);
  const host = resolvedHost && !String(resolvedHost).startsWith("${") ? resolvedHost : "127.0.0.1";
  const port = resolvedPort && !String(resolvedPort).startsWith("${") ? Number(resolvedPort) : 5432;
  const databaseName = resolvedDatabase && !String(resolvedDatabase).startsWith("${") ? resolvedDatabase : "ods";
  return {
    name: row.source_name,
    type: row.source_type === "postgresql" ? "postgresql" : "mysql",
    host,
    port,
    databaseName,
    username: resolvedUsername && !String(resolvedUsername).startsWith("${") ? resolvedUsername : "",
    extraConfig: { sourceCode: row.source_code, sourceScope: row.source_scope, schema: "ods" },
  };
}
function taskPayload(row, sourceId, targetSourceId, mappingRows = []) {
  const incremental = row.incremental_cursor && row.incremental_cursor !== "full";
  const fieldMappings = mappingRows.map((mapping) => ({
    sourceField: mapping.source_field,
    targetField: mapping.target_field,
    dataType: "text",
    isPrimaryKey: /(?:^|_)PK$/.test(String(mapping.key_role || "")),
    transformExpression: mapping.transform && mapping.transform !== "direct" ? mapping.transform : undefined,
  }));
  const isWeatherApi = row.source_code === "AVIATION_WEATHER_API";
  const sourceConfig = { sourceCode: row.source_code, taskType: row.task_type, rowAdapter: row.row_adapter };
  const parseConfig = { rowAdapter: row.row_adapter };
  if (isWeatherApi) {
    const baseUrl = resolveCell(sourceRowsByCodeForPayload.get(row.source_code)?.host_or_base_url);
    sourceConfig.endpointPath = baseUrl;
    sourceConfig.method = "GET";
    sourceConfig.bodyType = "none";
    sourceConfig.queryParams = [
      { name: "ids", value: "ZBAA", enabled: true },
      { name: "format", value: "json", enabled: true },
    ];
    parseConfig.recordPath = "";
  }
  return {
    taskName: row.task_name,
    taskCode: row.task_code,
    sourceId,
    sourceTable: row.target_table,
    targetSourceId: targetSourceId || sourceId,
    targetTable: row.target_table,
    targetTableMode: "existing",
    syncMode: incremental ? "incremental" : "full",
    status: row.status === "active" ? "active" : "draft",
    ownerName: "System Administrator",
    description: row.notes || null,
    fieldMappings: fieldMappings.length ? fieldMappings : [{ sourceField: "id", targetField: "id", dataType: "text", isPrimaryKey: true }],
    sourceConfig,
    parseConfig,
    errorConfig: { writeMode: row.write_mode },
    incrementalConfig: incremental ? { mode: "timestamp", cursorColumn: String(row.incremental_cursor).split(":").pop() } : undefined,
    scheduleConfig: { scheduleType: row.schedule === "manual" ? "manual" : "interval", timezone: "Asia/Shanghai", dependencyTaskIds: [], retryCount: 0 },
  };
}
function servicePayload(row, sourceId, fieldRows = []) {
  const sourceSql = qualifyAviationSql(row.service_code === "AVIATION_DELAY_DECISION"
    ? `SELECT flight_segment_id, 'WEATHER_DELAY_REVIEW' AS decision_action, inferred_class AS violation_type FROM dwd_rule_weather_delay_inferred UNION ALL SELECT flight_segment_id, 'CREW_DUTY_REVIEW' AS decision_action, violation_type FROM dwd_rule_crew_duty_violation`
    : "SELECT entity_id, entity_class FROM dwd_ent_flight_segment");
  const requestFields = fieldRows.filter((field) => field.direction === "request");
  const responseFields = fieldRows.filter((field) => field.direction === "response");
  return {
    serviceName: row.service_name,
    serviceCode: row.service_code,
    servicePath: row.runtime_path,
    requestMethod: "GET",
    dataDomain: "aviation",
    sourceId,
    serviceMode: "sql",
    sourceTable: null,
    sourceSql,
    serviceType: "list",
    authType: row.auth_mode === "anonymous" ? "anonymous" : "token",
    status: row.publish_status === "published" ? "published" : "draft",
    description: row.notes || undefined,
    ownerName: "System Administrator",
    queryConfig: {
      filters: requestFields.map((field) => ({ columnName: field.field_code, paramName: field.field_code, operator: "eq", required: asBool(field.required), dataType: field.data_type })),
      pagination: true,
      defaultPageSize: 50,
      maxPageSize: 200,
    },
    responseConfig: { fields: responseFields.map((field) => ({ columnName: field.field_code, fieldName: field.field_code, dataType: field.data_type, label: field.description })) },
  };
}
function serviceSourcePayload(row) {
  const source = developmentSourcePayload(row);
  return {
    sourceName: source.name,
    sourceCode: row.source_code,
    sourceType: "postgresql",
    connectionConfig: {
      host: source.host,
      port: source.port,
      database: source.databaseName,
      databaseName: source.databaseName,
      username: source.username,
      schema: source.extraConfig.schema,
    },
    ownerName: "System Administrator",
    status: "active",
  };
}
function datasetPayload(row, sourceId) {
  const names = asJson(row.fields_json, []).map((columnName) => ({ columnName, role: "metric", visible: true }));
  return { datasetName: row.dataset_name, datasetCode: row.dataset_code, sourceId, datasetType: "sql", sourceTable: null, sourceSql: qualifyAviationSql(row.source_sql), fields: names, ownerName: "System Administrator", status: row.status, description: row.notes || null };
}
function chartPayload(row, datasetId) {
  return { chartName: row.chart_name, chartCode: row.chart_code, chartType: "echarts", renderMode: "dataset", category: "aviation", datasetId, status: row.status, config: asJson(row.config_json, {}), ownerName: "System Administrator" };
}
function dashboardPayload(row, datasetId) {
  return { dashboardName: row.dashboard_name, dashboardCode: row.dashboard_code, layoutMode: row.layout_mode, themeConfig: asJson(row.theme_json, {}), filterConfig: { fields: String(row.filter_fields || "").split(",").filter(Boolean) }, datasetId, status: row.status, ownerName: "System Administrator", widgets: [] };
}

const sourceRowsByCodeForPayload = new Map();

function sqlIdentifier(value) {
  const identifier = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function qualifyAviationSql(sql) {
  const objects = [
    "ods_flight_schedule", "ods_aircraft_tail", "ods_crew_roster", "ods_weather_metar", "ods_runway_slot",
    "dim_delay_code_coda", "dwd_ent_flight_segment", "dwd_rule_weather_delay_inferred", "dwd_rule_crew_duty_violation",
  ];
  let qualified = String(sql || "");
  for (const object of objects) {
    qualified = qualified.replace(new RegExp(`(?<![A-Za-z0-9_.])${object}(?![A-Za-z0-9_])`, "g"), `ods.${object}`);
  }
  return qualified;
}

function postgresType(value) {
  const normalized = String(value || "text").trim().toLowerCase();
  if (["numeric", "decimal", "integer", "bigint", "boolean", "date", "timestamp", "timestamptz", "json", "jsonb", "text"].includes(normalized)) return normalized;
  if (/^(?:var)?char\(\d+\)$/.test(normalized)) return normalized;
  return "text";
}

function tableColumnDefinitions(tableRow, fieldRows = []) {
  const columns = new Map();
  for (const field of fieldRows) {
    const name = String(field.column_name || "").trim();
    if (!name) continue;
    const current = columns.get(name);
    const required = String(field.nullable || "").toUpperCase() === "FALSE";
    columns.set(name, { name, type: postgresType(field.data_type), required: required || Boolean(current?.required) });
  }
  for (const name of String(tableRow.natural_key_columns || "").split("#").map((value) => value.trim()).filter(Boolean)) {
    if (!columns.has(name)) columns.set(name, { name, type: "text", required: true });
  }
  const supplements = {
    meta_quality_rule: [
      { name: "field_name", type: "text" }, { name: "check_rule", type: "text" }, { name: "severity", type: "text" },
    ],
  };
  for (const column of supplements[tableRow.table_name] || []) {
    if (!columns.has(column.name)) columns.set(column.name, { ...column, required: false });
  }
  return [...columns.values()];
}

function viewSql(name) {
  const views = {
    dwd_ent_flight_segment: `SELECT flight_segment_id AS entity_id, 'FlightSegment'::text AS entity_class, flight_no, dep_airport, arr_airport, std, sta, atd, flight_status, delay_minutes, delay_code_raw, tail_no, carrier_code FROM ods.ods_flight_schedule`,
    dwd_ent_aircraft_tail: `SELECT tail_no AS entity_id, 'AircraftTail'::text AS entity_class, aircraft_model, cabin_class, remain_flight_hours, mel_defect, current_station, tail_status FROM ods.ods_aircraft_tail`,
    dwd_ent_crew_member: `SELECT crew_id AS entity_id, 'CrewMember'::text AS entity_class, crew_role, qualified_model, duty_start, duty_hours, duty_limit_hours, rest_hours, rest_min_hours, assigned_flight_no, compliance_flag FROM ods.ods_crew_roster`,
    dwd_ent_weather_event: `SELECT airport_icao || '#' || observe_time::text AS entity_id, 'WeatherEvent'::text AS entity_class, airport_icao, observe_time, weather_phenomenon, visibility_m, wind_gust_kt, severity_level FROM ods.ods_weather_metar`,
    dwd_ent_runway_capacity: `SELECT airport_icao || '#' || runway_id || '#' || slot_hour AS entity_id, 'RunwayCapacity'::text AS entity_class, airport_icao, runway_id, slot_hour, declared_capacity, available_capacity, capacity_ratio, restriction_reason FROM ods.ods_runway_slot`,
    dwd_rel_flight_operated_by_tail: `SELECT f.flight_segment_id AS src_id, 'operatedBy'::text AS rel_type, t.tail_no AS dst_id FROM ods.ods_flight_schedule f JOIN ods.ods_aircraft_tail t ON t.tail_no = f.tail_no`,
    dwd_rel_flight_staffed_by_crew: `SELECT f.flight_segment_id AS src_id, 'staffedBy'::text AS rel_type, c.crew_id AS dst_id, c.crew_role, c.duty_hours, c.duty_limit_hours, c.rest_hours, c.rest_min_hours FROM ods.ods_flight_schedule f JOIN ods.ods_crew_roster c ON c.assigned_flight_no = f.flight_no`,
    dwd_rel_weather_impacts_flight: `SELECT w.entity_id AS src_id, 'impacts'::text AS rel_type, f.flight_segment_id AS dst_id, w.weather_phenomenon, w.wind_gust_kt, f.delay_minutes FROM ods.dwd_ent_weather_event w JOIN ods.ods_flight_schedule f ON f.dep_airport = w.airport_icao AND date_trunc('hour', f.std) = date_trunc('hour', w.observe_time)`,
    dwd_rule_weather_delay_inferred: `SELECT DISTINCT r.dst_id AS flight_segment_id, 'WeatherDelayedFlight'::text AS inferred_class FROM ods.dwd_rel_weather_impacts_flight r JOIN ods.ods_flight_schedule f ON f.flight_segment_id = r.dst_id WHERE COALESCE(f.delay_minutes, 0) > 0`,
    dwd_rule_crew_duty_violation: `SELECT s.src_id AS flight_segment_id, s.dst_id AS crew_id, CASE WHEN s.duty_hours > s.duty_limit_hours THEN 'DUTY_OVER_LIMIT' WHEN s.rest_hours < s.rest_min_hours THEN 'REST_UNDER_MIN' ELSE 'OK' END::text AS violation_type FROM ods.dwd_rel_flight_staffed_by_crew s WHERE s.duty_hours > s.duty_limit_hours OR s.rest_hours < s.rest_min_hours`,
  };
  if (!views[name]) throw new Error(`No versioned view contract for ${name}`);
  return `CREATE OR REPLACE VIEW ods.${sqlIdentifier(name)} AS ${views[name]}`;
}

function tableSql(tableRow, fieldRows = []) {
  if (String(tableRow.object_type || "").toUpperCase() === "VIEW") return viewSql(tableRow.table_name);
  const columns = tableColumnDefinitions(tableRow, fieldRows);
  const primaryKey = String(tableRow.natural_key_columns || "").split("#").map((name) => name.trim()).filter(Boolean);
  const definitions = columns.map((column) => `${sqlIdentifier(column.name)} ${column.type}${column.required ? " NOT NULL" : ""}`);
  if (primaryKey.length) definitions.push(`PRIMARY KEY (${primaryKey.map(sqlIdentifier).join(", ")})`);
  const target = `ods.${sqlIdentifier(tableRow.table_name)}`;
  const create = `CREATE TABLE IF NOT EXISTS ${target} (${definitions.join(", ")})`;
  const upgrades = columns.map((column) => `ALTER TABLE ${target} ADD COLUMN IF NOT EXISTS ${sqlIdentifier(column.name)} ${column.type}`);
  return [create, ...upgrades].join("; ");
}

function fieldSql(row) {
  return `ALTER TABLE ods.${sqlIdentifier(row.table_name)} ADD COLUMN IF NOT EXISTS ${sqlIdentifier(row.column_name)} ${postgresType(row.data_type)}`;
}

function seedSql(row) {
  const raw = asJson(row.seed_payload_json, null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Invalid seed payload: ${row.natural_key}`);
  const data = row.table_name === "meta_quality_rule"
    ? { rule_code: raw.id, field_name: raw.field, check_rule: raw.check, severity: raw.severity }
    : raw;
  const columns = Object.keys(data);
  const conflictColumns = String(row.table_natural_key || "").split("#").map((part) => part.split("=")[0].trim()).filter(Boolean);
  const updates = columns.filter((column) => !conflictColumns.includes(column));
  const conflict = updates.length
    ? `DO UPDATE SET ${updates.map((column) => `${sqlIdentifier(column)} = EXCLUDED.${sqlIdentifier(column)}`).join(", ")}`
    : "DO NOTHING";
  return `INSERT INTO ods.${sqlIdentifier(row.table_name)} (${columns.map(sqlIdentifier).join(", ")}) VALUES (${columns.map((column) => sqlLiteral(data[column])).join(", ")}) ON CONFLICT (${conflictColumns.map(sqlIdentifier).join(", ")}) ${conflict}`;
}

function invoke(command, payload, extra = []) {
  const args = ["--json", "--profile", profile, "--project", String(projectId), ...command.split(" ")];
  if (payload !== undefined) args.push("--input", JSON.stringify(payload));
  args.push(...extra);
  const result = spawnSync(cli, args, { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  let parsed;
  try { parsed = JSON.parse(result.stdout || result.stderr || "{}"); } catch { parsed = null; }
  return { args, exitCode: result.status === null ? 1 : result.status, output, parsed, outputHash: sha256(output) };
}

function checkedResult(result, predicate, code, message) {
  if (result?.exitCode === 0 && result.parsed?.success !== false && predicate(result.parsed?.data)) return result;
  if (result?.exitCode !== 0 || result.parsed?.success === false) return result;
  const parsed = { success: false, error: { code, message } };
  return { ...result, exitCode: 1, parsed, outputHash: sha256(parsed) };
}

function blockedResult(code, message) {
  const parsed = { success: false, error: { code, message } };
  return { exitCode: 1, parsed, outputHash: sha256(parsed), output: JSON.stringify(parsed) };
}

function capabilityFor(command) {
  const files = fs.readdirSync(path.join(root, ".local", "data-platform-cli", "install", "node_modules", "@johnason"));
  for (const name of files) {
    const file = path.join(root, ".local", "data-platform-cli", "install", "node_modules", "@johnason", name, "src", "manifest.json");
    if (!fs.existsSync(file)) continue;
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    const hit = (manifest.capabilities || []).find((entry) => entry.command === command);
    if (hit) return hit.capabilityId;
  }
  return "";
}

function makeRecord({ sequence, sheet, rowNumber, stage, row, command, payload, result, status, errorCode, errorMessage, rootCause, optimizationAction, retryable, verificationLevel }) {
  const parsed = result?.parsed;
  const data = parsed?.data;
  const returnedId = data && typeof data === "object" ? (data.id ?? data.data?.id ?? data.taskId ?? data.serviceId ?? data.datasetId ?? data.dashboardId ?? null) : null;
  const resolvedErrorCode = errorCode || parsed?.error?.code || "";
  const resolvedErrorMessage = errorMessage || parsed?.error?.message || "";
  const inferredRootCause = rootCause || (resolvedErrorCode === "ENOTFOUND" || /\$\{[^}]+\}/.test(resolvedErrorMessage)
    ? "Excel 连接配置仍为环境变量占位符，运行环境未注入实际主机/端口"
    : resolvedErrorCode === "ECONNREFUSED"
      ? "真实 PostgreSQL 运行时未启动或目标端口不可达"
    : /Base URL/i.test(resolvedErrorMessage)
      ? "API 数据源缺少可解析的 Base URL"
      : /数据源不存在/.test(resolvedErrorMessage)
        ? "依赖数据源未创建或自然键到平台 ID 的映射缺失"
        : /提示词模板/.test(resolvedErrorMessage)
          ? "数据建模模块依赖逻辑模型构建提示词模板"
          : /编码已存在|名称已存在/.test(resolvedErrorMessage)
            ? "目标资产已存在，但当前命令仍使用 create 而不是 update"
            : "");
  const inferredOptimization = optimizationAction || (inferredRootCause.includes("占位符")
    ? "通过受控环境变量注入真实连接信息后重试，不把凭据写入 Excel 或报告"
    : inferredRootCause.includes("PostgreSQL 运行时")
      ? "启动真实 PostgreSQL 并通过 CLI test-datasource-config 后重试"
    : inferredRootCause.includes("create")
      ? "按自然键先查询资产，再调用对应 update 命令"
      : inferredRootCause.includes("提示词")
        ? "通过 CLI 创建/配置逻辑模型提示词模板，再重试模型构建"
        : "");
  return {
    run_id: runId, sequence, sheet, row_number: rowNumber, stage,
    natural_key: row.natural_key || row.step_code || row.check_code || "",
    action: row.action || "", cli_command: command || "", capability_id: command ? capabilityFor(command) : "",
    project_id: projectId, project_code: projectCode, status: status || (result?.exitCode === 0 && parsed?.success !== false ? "SUCCESS" : "FAILED"),
    verification_level: verificationLevel || "IMPORTED",
    returned_id: returnedId, error_code: resolvedErrorCode, error_message: resolvedErrorMessage,
    root_cause: inferredRootCause, optimization_action: inferredOptimization, retryable: retryable ? "TRUE" : "FALSE",
    verified_at: new Date().toISOString(), source_ref: row.source_ref || "", raw_payload_hash: payload === undefined ? "" : sha256(payload), cli_output_hash: result?.outputHash || "",
  };
}

function main() {
  if (!fs.existsSync(inputFile)) throw new Error(`Missing input workbook: ${inputFile}`);
  if (!fs.existsSync(cli)) throw new Error(`Missing CLI: ${cli}`);
  const workbook = XLSX.readFile(inputFile, { cellDates: true, raw: false });
  const mappings = new Map(rows(workbook, "90_CLI映射").map((r) => [r.sheet_name, r]));
  const taskMappings = groupRows(rows(workbook, "12_任务字段映射").filter((row) => asBool(row.enabled)), "task_code");
  const serviceFields = groupRows(rows(workbook, "31_服务字段").filter((row) => asBool(row.enabled)), "service_code");
  const sourceRowsByCode = new Map(rows(workbook, "10_数据源").filter((row) => asBool(row.enabled)).map((row) => [row.source_code, row]));
  for (const [code, row] of sourceRowsByCode) sourceRowsByCodeForPayload.set(code, row);
  const postgresFields = groupRows(rows(workbook, "51_PG字段").filter((row) => asBool(row.enabled)), "table_name");
  const records = [];
  let sequence = 0;
  const idByNaturalKey = new Map();
  const operationByNaturalKey = new Map();
  const add = (sheet, stage, rowNumber, row, command, payload, result, extra = {}) => records.push(makeRecord({ sequence: ++sequence, sheet, stage, rowNumber, row, command, payload, result, ...extra }));

  const health = invoke("system doctor health");
  add("00_导入说明", "PRECHECK", 1, { natural_key: "precheck:health", action: "VALIDATE", source_ref: "CLI" }, "system doctor health", undefined, health, { rootCause: health.parsed?.success ? "" : "CLI health check failed", optimizationAction: health.parsed?.success ? "" : "修复运行时或服务健康后重试", retryable: true });
  const resolved = invoke("project resolve", undefined, ["--code", projectCode, "--require-one"]);
  add("00_导入说明", "PRECHECK", 2, { natural_key: "precheck:project", action: "VALIDATE", source_ref: "CLI" }, "project resolve", undefined, resolved, { rootCause: resolved.parsed?.success ? "" : "目标项目解析失败", optimizationAction: resolved.parsed?.success ? "" : "确认项目编码和成员权限", retryable: false });
  const access = invoke("project access-check", undefined, ["--action", "write"]);
  add("00_导入说明", "PRECHECK", 3, { natural_key: "precheck:access", action: "VALIDATE", source_ref: "CLI" }, "project access-check", undefined, access, { rootCause: access.parsed?.success ? "" : "项目无写权限", optimizationAction: access.parsed?.success ? "" : "授予项目写权限后重试", retryable: false });
  const packageValidation = invoke("ontology package validate", undefined, ["--file", inputFile, "--project-code", projectCode]);
  add("00_导入说明", "PRECHECK", 4, { natural_key: "precheck:package", action: "VALIDATE", source_ref: inputFile }, "ontology package validate", undefined, packageValidation, { rootCause: packageValidation.parsed?.success ? "" : "Excel 包结构、自然键或依赖图校验失败", optimizationAction: packageValidation.parsed?.success ? "" : "按 CLI 返回的包校验错误修复工作簿", retryable: false, verificationLevel: "VALIDATED" });
  const packageImport = packageValidation.parsed?.success
    ? invoke("ontology package import", undefined, ["--file", inputFile, "--project-code", projectCode])
    : packageValidation;
  add("00_导入说明", "PRECHECK", 5, { natural_key: "precheck:package-import", action: "UPSERT", source_ref: inputFile }, "ontology package import", undefined, packageImport, { rootCause: packageImport.parsed?.success ? "" : "Excel 包清单导入失败", optimizationAction: packageImport.parsed?.success ? "" : "先完成 ontology package validate", retryable: false, verificationLevel: "IMPORTED" });

  const existingSources = invoke("datasource list-data-sources");
  for (const item of existingSources.parsed?.data || []) if (item.sourceCode) idByNaturalKey.set(`source:${item.sourceCode}`, item.id);
  const existingDevelopmentSources = invoke("development list-datasources");
  for (const item of existingDevelopmentSources.parsed?.data || []) if (item.name) idByNaturalKey.set(`development:${item.name}`, item.id);
  const existingReportingSources = invoke("reporting list-report-data-sources");
  for (const item of existingReportingSources.parsed?.data || []) if (item.sourceCode) idByNaturalKey.set(`reporting:${item.sourceCode}`, item.id);
  const existingMapSources = invoke("data-map list-data-sources");
  for (const item of existingMapSources.parsed?.data || []) if (item.sourceCode) idByNaturalKey.set(`map:${item.sourceCode}`, item.id);
  const existingCatalogs = invoke("standard list-catalogs");
  for (const item of existingCatalogs.parsed?.data || []) if (item.catalogCode) idByNaturalKey.set(`catalog:${item.catalogCode}`, item.id);
  const existingServiceSources = invoke("service list-service-data-sources");
  for (const item of existingServiceSources.parsed?.data || []) if (item.sourceCode) idByNaturalKey.set(`service-source:${item.sourceCode}`, item.id);
  const existingCharts = invoke("reporting list-report-chart-assets");
  for (const item of existingCharts.parsed?.data || []) if (item.chartCode) idByNaturalKey.set(`chart:${item.chartCode}`, item.id);
  const existingDashboards = invoke("reporting list-report-dashboards");
  for (const item of existingDashboards.parsed?.data || []) { if (item.dashboardCode) idByNaturalKey.set(`dashboard:${item.dashboardCode}`, item.id); if (item.dashboardName) idByNaturalKey.set(`dashboard-name:${item.dashboardName}`, item.id); }
  const existingTasks = invoke("ingestion list-tasks");
  for (const item of listData(existingTasks)) if (item.taskCode) idByNaturalKey.set(`task:${item.taskCode}`, item.id);
  const existingServices = invoke("service list-services");
  for (const item of listData(existingServices)) if (item.serviceCode) idByNaturalKey.set(`service:${item.serviceCode}`, item.id);
  const existingDatasets = invoke("reporting list-report-datasets");
  for (const item of listData(existingDatasets)) if (item.datasetCode) idByNaturalKey.set(`dataset:${item.datasetCode}`, item.id);
  const existingKnowledgeBases = invoke("knowledge-base list-knowledge-bases");
  for (const item of listData(existingKnowledgeBases)) if (item.kbName) idByNaturalKey.set(`knowledge:${item.kbName}`, item.id);
  const existingTemplates = invoke("data-lab list-business-system-templates");
  for (const item of listData(existingTemplates)) if (item.templateCode) idByNaturalKey.set(`model:${item.templateCode}`, item.id);

  const contractFile = path.join(root, ".local", "aviation-cli-acceptance", "ontology.json");
  const lineageFile = path.join(root, ".local", "aviation-cli-acceptance", "lineage.json");
  let contractImport = null;
  let lineageImport = null;
  if (fs.existsSync(contractFile)) {
    contractImport = invoke("ontology contract import", undefined, ["--file", contractFile]);
    add("20_数据模型", "MODELS", 0, { natural_key: "ontology-contract:aviation_ontology_cli_v1", action: "UPSERT", source_ref: contractFile }, "ontology contract import", undefined, contractImport, { rootCause: contractImport.parsed?.success ? "" : "本体契约导入失败", optimizationAction: contractImport.parsed?.success ? "" : "检查 contract projectId 与 --project 一致", retryable: false });
  }
  if (fs.existsSync(lineageFile)) {
    lineageImport = invoke("ontology lineage import", undefined, ["--file", lineageFile]);
    add("22_模型关系血缘", "MODELS", 0, { natural_key: "ontology-lineage:aviation_ontology_cli_v1", action: "UPSERT", source_ref: lineageFile }, "ontology lineage import", undefined, lineageImport, { rootCause: lineageImport.parsed?.success ? "" : "本体血缘导入失败", optimizationAction: lineageImport.parsed?.success ? "" : "先导入本体契约，再导入血缘", retryable: false });
  }

  for (const sheet of ["01_导入顺序", "02_环境变量", "90_CLI映射"]) {
    for (const [index, row] of rows(workbook, sheet).entries()) {
      if (!asBool(row.enabled)) continue;
      add(sheet, "PRECHECK", index + 2, row, "ontology package import", undefined, packageImport, { rootCause: packageImport.parsed?.success ? "" : "Excel 包编排清单未导入", optimizationAction: packageImport.parsed?.success ? "" : "修复包校验错误后重试", retryable: false, verificationLevel: "VALIDATED" });
    }
  }

  const departments = invoke("data-map list-departments");
  const departmentId = (departments.parsed?.data || []).find((item) => item.departmentCode === "AVIATION")?.id || null;
  if (!departmentId) {
    const createdDepartment = invoke("data-map create-department", { departmentName: "航空运行部", departmentCode: "AVIATION", dataOwner: "System Administrator", dataSteward: "System Administrator", status: "active", tags: ["aviation", "ontology"] });
    add("10_数据源", "SOURCES_TASKS", 0, { natural_key: "dependency:department:AVIATION", action: "UPSERT", source_ref: "CLI" }, "data-map create-department", { departmentName: "航空运行部", departmentCode: "AVIATION", dataOwner: "System Administrator", dataSteward: "System Administrator", status: "active", tags: ["aviation", "ontology"] }, createdDepartment, { rootCause: createdDepartment.parsed?.success ? "" : "数据地图部门依赖未就绪", optimizationAction: createdDepartment.parsed?.success ? "" : "先创建数据地图部门", retryable: false });
    idByNaturalKey.set("department:AVIATION", createdDepartment.parsed?.data?.id || null);
  } else idByNaturalKey.set("department:AVIATION", departmentId);
  const department = idByNaturalKey.get("department:AVIATION");
  const systems = invoke("data-map list-business-systems");
  let businessSystemId = (systems.parsed?.data || []).find((item) => item.systemCode === "AVIATION_ODS")?.id || null;
  if (!businessSystemId && department) {
    const createdSystem = invoke("data-map create-business-system", { departmentId: department, systemName: "航空 ODS 运行系统", systemCode: "AVIATION_ODS", systemType: "ODS", systemLevel: "核心", lifecycleStatus: "online", techOwner: "System Administrator", status: "active", tags: ["aviation", "ods"] });
    add("10_数据源", "SOURCES_TASKS", 0, { natural_key: "dependency:business-system:AVIATION_ODS", action: "UPSERT", source_ref: "CLI" }, "data-map create-business-system", { departmentId: department, systemName: "航空 ODS 运行系统", systemCode: "AVIATION_ODS", systemType: "ODS", systemLevel: "核心", lifecycleStatus: "online", techOwner: "System Administrator", status: "active", tags: ["aviation", "ods"] }, createdSystem, { rootCause: createdSystem.parsed?.success ? "" : "业务系统依赖未就绪", optimizationAction: createdSystem.parsed?.success ? "" : "先创建数据地图业务系统", retryable: false });
    businessSystemId = createdSystem.parsed?.data?.id || null;
  }
  idByNaturalKey.set("business-system:AVIATION_ODS", businessSystemId);

  for (const [sheet, stage] of [["10_数据源", "SOURCES"], ["50_PG物理表", "DDL_POSTGRES"], ["51_PG字段", "DDL_POSTGRES"], ["52_PG铺底数据", "SEED_POSTGRES"], ["11_同步任务", "SOURCES_TASKS"], ["12_任务字段映射", "SOURCES_TASKS"], ["60_MySQL物理表", "DDL_MYSQL"], ["61_MySQL字段", "DDL_MYSQL"], ["62_MySQL铺底数据", "SEED_MYSQL"], ["20_数据模型", "MODELS"], ["21_模型实体字段", "MODELS"], ["22_模型关系血缘", "MODELS"], ["30_数据服务", "SERVICES"], ["31_服务字段", "SERVICES"], ["40_报表数据集", "REPORTING"], ["41_报表图表", "REPORTING"], ["42_报表看板", "REPORTING"], ["70_资产依赖关系", "VERIFY"], ["80_导入校验", "VERIFY"]]) {
    const map = mappings.get(sheet);
    for (const [index, row] of rows(workbook, sheet).entries()) {
      const rowNumber = index + 2;
      if (!asBool(row.enabled)) continue;
      let command = null; let payload; let result; let extra = {};
      if (sheet === "10_数据源") {
        if (row.source_scope === "integration") command = "datasource create-data-source";
        else if (row.source_scope === "development") command = "development create-datasource";
        else if (row.source_scope === "data_map") command = "data-map create-data-source";
        else if (row.source_scope === "reporting") command = "reporting create-report-data-source";
        payload = command === "development create-datasource" ? developmentSourcePayload(row) : sourcePayload(row);
        if (command === "data-map create-data-source") payload = { ...payload, businessSystemId: businessSystemId || 1 };
        if (command === "reporting create-report-data-source") payload = { ...payload, sourceType: "postgresql", connectionConfig: payload.connectionConfig || {} };
        const existingId = command === "development create-datasource" ? idByNaturalKey.get(`development:${row.source_name}`) : command === "reporting create-report-data-source" ? idByNaturalKey.get(`reporting:${row.source_code}`) : command === "data-map create-data-source" ? idByNaturalKey.get(`map:${row.source_code}`) : idByNaturalKey.get(`source:${row.source_code}`);
        if (existingId && command === "datasource create-data-source") { command = "datasource update-data-source"; }
        else if (existingId && command === "development create-datasource") { command = "development update-datasource"; }
        else if (existingId && command === "reporting create-report-data-source") { command = "reporting update-report-data-source"; }
        else if (existingId && command === "data-map create-data-source") { command = "data-map update-data-source"; }
        if (existingId && / update-/.test(command)) result = invoke(command, payload, [String(existingId)]);
        else result = invoke(command, payload);
      } else if (sheet === "11_同步任务") {
        command = "ingestion create-task";
        const sourceKey = `source:${row.source_code}`;
        const sourceId = idByNaturalKey.get(sourceKey) || 1;
        payload = taskPayload(row, sourceId, sourceId, taskMappings.get(row.task_code) || []);
        payload.targetSourceId = idByNaturalKey.get("source:AVIATION_ODS_PG") || sourceId;
        const existingId = idByNaturalKey.get(`task:${row.task_code}`);
        if (existingId) {
          command = "ingestion update-task";
          result = invoke(command, payload, [String(existingId)]);
        } else result = invoke(command, payload);
        operationByNaturalKey.set(`task:${row.task_code}`, { command, payload, result });
      } else if (sheet === "12_任务字段映射") {
        const taskOperation = operationByNaturalKey.get(`task:${row.task_code}`);
        command = taskOperation?.command || "ingestion create-task";
        payload = taskOperation?.payload;
        result = taskOperation?.result || { exitCode: 1, parsed: { success: false, error: { code: "DEPENDENCY_FAILED", message: `同步任务未成功导入: ${row.task_code}` } }, outputHash: sha256(row.task_code) };
        extra.verificationLevel = "IMPORTED";
      } else if (sheet === "21_模型实体字段") {
        command = "ontology contract import";
        result = contractImport || { exitCode: 1, parsed: { success: false, error: { code: "ONTOLOGY_CONTRACT_MISSING", message: "本体契约文件不存在" } }, outputHash: "" };
        extra.verificationLevel = "IMPORTED";
      } else if (sheet === "22_模型关系血缘") {
        command = "ontology lineage import";
        result = lineageImport || { exitCode: 1, parsed: { success: false, error: { code: "ONTOLOGY_LINEAGE_MISSING", message: "本体血缘文件不存在" } }, outputHash: "" };
        extra.verificationLevel = "IMPORTED";
      } else if (sheet === "30_数据服务") {
        let serviceSourceId = idByNaturalKey.get(`service-source:${row.source_code}`);
        const sourceRow = sourceRowsByCode.get(row.source_code);
        const sourcePayloadValue = sourceRow ? serviceSourcePayload(sourceRow) : { sourceName: row.source_code, sourceCode: row.source_code, sourceType: "postgresql", connectionConfig: {}, ownerName: "System Administrator", status: "active" };
        const sourceCommand = serviceSourceId ? "service update-service-data-source" : "service create-service-data-source";
        const sourceResult = serviceSourceId ? invoke(sourceCommand, sourcePayloadValue, [String(serviceSourceId)]) : invoke(sourceCommand, sourcePayloadValue);
        add(sheet, stage, rowNumber, { ...row, natural_key: `service-source:${row.source_code}`, action: "UPSERT", source_ref: row.source_ref }, sourceCommand, sourcePayloadValue, sourceResult, { rootCause: sourceResult.parsed?.success ? "" : "服务数据源创建失败", optimizationAction: sourceResult.parsed?.success ? "" : "先创建服务数据源并绑定可用连接", retryable: false });
        serviceSourceId = serviceSourceId || sourceResult.parsed?.data?.id || null;
        if (serviceSourceId) idByNaturalKey.set(`service-source:${row.source_code}`, serviceSourceId);
        command = "service create-service";
        payload = servicePayload(row, serviceSourceId || 1, serviceFields.get(row.service_code) || []);
        const existingId = idByNaturalKey.get(`service:${row.service_code}`);
        if (existingId) {
          command = "service update-service";
          result = invoke(command, payload, [String(existingId)]);
        } else result = invoke(command, payload);
        operationByNaturalKey.set(`service:${row.service_code}`, { command, payload, result });
      } else if (sheet === "31_服务字段") {
        const serviceOperation = operationByNaturalKey.get(`service:${row.service_code}`);
        command = serviceOperation?.command || "service create-service";
        payload = serviceOperation?.payload;
        result = serviceOperation?.result || { exitCode: 1, parsed: { success: false, error: { code: "DEPENDENCY_FAILED", message: `数据服务未成功导入: ${row.service_code}` } }, outputHash: sha256(row.service_code) };
        extra.verificationLevel = "IMPORTED";
      } else if (sheet === "40_报表数据集") {
        command = "reporting create-report-dataset";
        payload = datasetPayload(row, idByNaturalKey.get(`reporting:${row.source_code}`) || idByNaturalKey.get(`source:${row.source_code}`) || 1);
        const existingId = idByNaturalKey.get(`dataset:${row.dataset_code}`);
        if (existingId) {
          command = "reporting update-report-dataset";
          result = invoke(command, payload, [String(existingId)]);
        } else result = invoke(command, payload);
      } else if (sheet === "41_报表图表") {
        command = "reporting create-report-chart-asset"; payload = chartPayload(row, idByNaturalKey.get(`dataset:${row.dataset_code}`) || 1); const existingId = idByNaturalKey.get(`chart:${row.chart_code}`); if (existingId) { command = "reporting update-report-chart-asset"; result = invoke(command, payload, [String(existingId)]); } else result = invoke(command, payload);
      } else if (sheet === "42_报表看板") {
        command = "reporting create-report-dashboard"; payload = dashboardPayload(row, idByNaturalKey.get(`dataset:${row.depends_on?.split(":").pop()}`) || 1); const existingId = idByNaturalKey.get(`dashboard:${row.dashboard_code}`) || idByNaturalKey.get("dashboard-name:航空延误处置分析报表"); if (existingId) { command = "reporting update-report-dashboard"; result = invoke(command, payload, [String(existingId)]); } else result = invoke(command, payload);
      } else if (sheet === "62_MySQL铺底数据" && row.seed_kind === "knowledge_base") {
        command = "knowledge-base create-knowledge-base"; payload = { kbName: "航空本体知识库", kbDesc: "航空本体 CLI 导入包知识库清单", tags: ["aviation", "ontology", "cli"], status: "active" }; const existingId = idByNaturalKey.get("knowledge:航空本体知识库"); if (existingId) { command = "knowledge-base update-knowledge-base"; result = invoke(command, payload, [String(existingId)]); } else result = invoke(command, payload);
      } else if (sheet === "62_MySQL铺底数据" && row.seed_kind === "platform_metadata" && row.table_name === "std_catalogs") {
        command = "standard create-catalog"; payload = { catalogName: "航空业数据标准", catalogCode: "AVIATION", catalogType: "business_domain", ownerName: "System Administrator", status: "active" }; const existingId = idByNaturalKey.get("catalog:AVIATION"); if (existingId) { command = "standard update-catalog"; result = invoke(command, payload, [String(existingId)]); } else result = invoke(command, payload);
      } else if (sheet === "62_MySQL铺底数据" && row.seed_kind === "platform_metadata" && row.table_name === "report_data_sources") {
        command = "reporting create-report-data-source";
        const reportSourceRow = sourceRowsByCode.get("AVIATION_REPORT_PG");
        payload = reportSourceRow
          ? { ...sourcePayload(reportSourceRow), sourceType: "postgresql" }
          : { sourceName: "航空报表 PostgreSQL", sourceCode: "AVIATION_REPORT_PG", sourceType: "postgresql", connectionConfig: {}, ownerName: "System Administrator", status: "active" };
        const existingId = idByNaturalKey.get("reporting:AVIATION_REPORT_PG");
        if (existingId) {
          command = "reporting update-report-data-source";
          result = invoke(command, payload, [String(existingId)]);
        } else result = invoke(command, payload);
      } else if (sheet === "20_数据模型" && contractImport) {
        command = "ontology contract import";
        result = contractImport;
        extra.verificationLevel = "IMPORTED";
      } else if (sheet === "52_PG铺底数据" && (row.seed_status === "SOURCE_ONLY" || String(row.seed_payload_json || "").startsWith("SOURCE_ONLY:"))) {
        command = "ontology package import";
        result = blockedResult("SOURCE_BASELINE_MISSING", `版本化输入缺少 ${row.table_name} 的 ${row.expected_row_count} 条逐行基线，禁止伪造数据`);
        extra = {
          rootCause: "Excel 仅包含 SOURCE_ONLY 描述，没有可导入的逐行基线",
          optimizationAction: "补充经过校验的受控基线文件及 SHA-256 后通过 CLI 重试",
          retryable: false,
          verificationLevel: "BLOCKED",
        };
      } else if (sheet === "50_PG物理表") {
        command = "development execute-query";
        const datasourceId = idByNaturalKey.get("development:航空数据开发 PostgreSQL");
        payload = { datasourceId, databaseName: "ods", sqlText: `CREATE SCHEMA IF NOT EXISTS ods; ${tableSql(row, postgresFields.get(row.table_name) || [])}` };
        result = datasourceId
          ? invoke(command, payload)
          : blockedResult("DEPENDENCY_FAILED", "航空数据开发 PostgreSQL 数据源未成功导入");
        extra = { rootCause: result.parsed?.success ? "" : "PostgreSQL 物理对象 DDL 执行失败", optimizationAction: result.parsed?.success ? "" : "修复工作簿字段/视图契约后通过 development execute-query 重试", retryable: true, verificationLevel: "IMPORTED" };
      } else if (sheet === "51_PG字段") {
        command = "development execute-query";
        const datasourceId = idByNaturalKey.get("development:航空数据开发 PostgreSQL");
        payload = { datasourceId, databaseName: "ods", sqlText: fieldSql(row) };
        result = datasourceId
          ? invoke(command, payload)
          : blockedResult("DEPENDENCY_FAILED", "航空数据开发 PostgreSQL 数据源未成功导入");
        extra = { rootCause: result.parsed?.success ? "" : "PostgreSQL 字段升级失败", optimizationAction: result.parsed?.success ? "" : "核对字段类型和所属物理表后重试", retryable: true, verificationLevel: "IMPORTED" };
      } else if (sheet === "52_PG铺底数据") {
        command = "development execute-query";
        const datasourceId = idByNaturalKey.get("development:航空数据开发 PostgreSQL");
        payload = { datasourceId, databaseName: "ods", sqlText: seedSql(row) };
        result = datasourceId
          ? invoke(command, payload)
          : blockedResult("DEPENDENCY_FAILED", "航空数据开发 PostgreSQL 数据源未成功导入");
        extra = { rootCause: result.parsed?.success ? "" : "工作簿 READY 铺底数据写入失败", optimizationAction: result.parsed?.success ? "" : "核对 seed payload 与自然键列后重试", retryable: true, verificationLevel: "IMPORTED" };
      } else if (["60_MySQL物理表", "61_MySQL字段", "70_资产依赖关系"].includes(sheet)) {
        command = "ontology package import";
        result = packageImport;
        extra.verificationLevel = "VALIDATED";
      } else if (sheet === "80_导入校验") {
        if (["CHK-003", "CHK-004", "CHK-005"].includes(row.check_code)) {
          command = "ontology contract show";
          const shown = invoke(command);
          const expected = Number(row.expected_result);
          const selector = row.check_code === "CHK-003" ? "entities" : row.check_code === "CHK-004" ? "relations" : "rules";
          result = checkedResult(shown, (data) => Array.isArray(data?.[selector]) && data[selector].length === expected, "VALIDATION_MISMATCH", `${row.check_name} 不等于 ${expected}`);
        } else if (row.check_code === "CHK-006") {
          command = "development execute-query";
          const datasourceId = idByNaturalKey.get("development:航空数据开发 PostgreSQL");
          payload = { datasourceId, databaseName: "ods", sqlText: row.validation_sql_or_action };
          const queried = datasourceId ? invoke(command, payload) : blockedResult("DEPENDENCY_FAILED", "航空数据开发 PostgreSQL 数据源未成功导入");
          result = checkedResult(queried, (data) => Number(data?.rows?.[0]?.count) === Number(row.expected_result), "VALIDATION_MISMATCH", `${row.check_name} 不等于 ${row.expected_result}`);
        } else if (row.check_code === "CHK-007") {
          command = "ontology lineage show";
          result = checkedResult(invoke(command), (data) => Array.isArray(data?.links) && data.links.length === Number(row.expected_result), "VALIDATION_MISMATCH", `字段血缘不等于 ${row.expected_result}`);
        } else if (row.check_code === "CHK-009") {
          command = "knowledge-base list-knowledge-bases";
          result = checkedResult(invoke(command), (data) => (Array.isArray(data) ? data : data?.list || []).some((item) => item.kbName === "航空本体知识库"), "KNOWLEDGE_BASE_MISSING", "航空本体知识库不存在");
        } else if (row.check_code === "CHK-010") {
          command = "ontology package validate";
          result = packageValidation;
        } else {
          command = "development execute-query";
          result = blockedResult("POSTGRESQL_BASELINE_UNAVAILABLE", `${row.check_name} 依赖缺失的 PostgreSQL 逐行基线，当前不能形成真实查询证据`);
          extra = {
            rootCause: "真实 PostgreSQL 基线未随导入包交付",
            optimizationAction: "补齐受控逐行基线并在真实 PostgreSQL 上通过 development execute-query 验证",
            retryable: false,
            verificationLevel: "BLOCKED",
          };
        }
        extra.verificationLevel ||= "VERIFIED";
      } else {
        command = "ontology package import";
        result = packageImport;
        extra.verificationLevel = "VALIDATED";
      }
      const record = makeRecord({ sequence: ++sequence, sheet, stage, rowNumber, row, command, payload, result, ...extra });
      records.push(record);
      if (record.status === "SUCCESS" && record.returned_id !== null) idByNaturalKey.set(row.natural_key || "", record.returned_id);
      if (sheet === "10_数据源" && record.status === "SUCCESS" && record.returned_id !== null) {
        if (row.source_scope === "integration") idByNaturalKey.set(`source:${row.source_code}`, record.returned_id);
        if (row.source_scope === "development") idByNaturalKey.set(`development:${row.source_name}`, record.returned_id);
        if (row.source_scope === "data_map") idByNaturalKey.set(`map:${row.source_code}`, record.returned_id);
        if (row.source_scope === "reporting") idByNaturalKey.set(`reporting:${row.source_code}`, record.returned_id);
      }
      if (sheet === "40_报表数据集" && record.status === "SUCCESS" && record.returned_id !== null) idByNaturalKey.set(`dataset:${row.dataset_code}`, record.returned_id);
    }
  }
  const stats = [{ metric: "run_id", value: runId }, { metric: "project_id", value: projectId }, { metric: "project_code", value: projectCode }, { metric: "input_sha256", value: sha256(fs.readFileSync(inputFile)) }, { metric: "total_records", value: records.length }, { metric: "success_records", value: records.filter((r) => r.status === "SUCCESS").length }, { metric: "failed_records", value: records.filter((r) => r.status !== "SUCCESS").length }, { metric: "blocked_records", value: records.filter((r) => r.verification_level === "BLOCKED").length }, { metric: "imported_records", value: records.filter((r) => r.status === "SUCCESS" && r.verification_level === "IMPORTED").length }, { metric: "validated_records", value: records.filter((r) => r.status === "SUCCESS" && r.verification_level === "VALIDATED").length }, { metric: "verified_records", value: records.filter((r) => r.status === "SUCCESS" && r.verification_level === "VERIFIED").length }, { metric: "verified_at", value: new Date().toISOString() }];
  const failures = records.filter((r) => r.status !== "SUCCESS");
  const optimization = failures.map((r) => ({ natural_key: r.natural_key, sheet: r.sheet, cli_command: r.cli_command, verification_level: r.verification_level, error_code: r.error_code, error_message: r.error_message, root_cause: r.root_cause, optimization_action: r.optimization_action, retryable: r.retryable }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stats), "统计");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(records), "全部记录");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(records.filter((r) => r.status === "SUCCESS")), "成功记录");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(failures), "失败记录");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(optimization), "待优化项");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...mappings.values()]), "CLI映射");
  XLSX.writeFile(wb, outputFile);
  process.stdout.write(JSON.stringify({ runId, outputFile, total: records.length, success: stats[5].value, failed: stats[6].value }, null, 2) + "\n");
}

if (require.main === module) main();

module.exports = {
  fieldSql,
  postgresType,
  qualifyAviationSql,
  seedSql,
  sqlIdentifier,
  sqlLiteral,
  tableColumnDefinitions,
  tableSql,
  viewSql,
};
