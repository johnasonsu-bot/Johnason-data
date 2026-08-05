const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const AppError = require("../../common/errors/app-error");
const {
  getRuntimeDatabaseCapabilityStatus,
  isSupportedDatabaseType,
} = require("../../common/utils/datasource-capabilities");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
} = require("../../common/utils/datasource-dialect");
const { pool } = require("../../config/database");
const projectRepository = require("./project-space.repository");

const EXPORT_FORMAT_VERSION = "3.0.0";
const V2_EXPORT_FORMAT_VERSION = "2.0.0";
const LEGACY_EXPORT_FORMAT_VERSION = "1.0.0";
const SUPPORTED_EXPORT_FORMAT_VERSIONS = new Set([LEGACY_EXPORT_FORMAT_VERSION, V2_EXPORT_FORMAT_VERSION, EXPORT_FORMAT_VERSION]);
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;
const INTERNAL_EXPORT_TABLES = new Set([
  "project_asset_transfer_logs",
  "ingestion_kafka_offsets",
  "ingestion_ftp_file_states",
  "dev_sql_copilot_sessions",
  "dev_sql_copilot_messages",
  "qc_dict_mapping_template",
  "qc_dict_mapping_item",
  "qc_ops_robot_session",
  "qc_ops_robot_message",
  "std_import_batches",
  "std_import_errors",
]);
const SENSITIVE_COLUMN_PATTERN = /(password|secret|token|credential|private_key|public_key|access_key|storage_key|api_key)/i;
const SENSITIVE_JSON_KEY_PATTERN = /(password|secret|token|credential|privateKey|private_key|publicKey|public_key|accessKey|access_key|storageKey|storage_key|apiKey|api_key|saslPassword|sasl_password)/i;
const DATABASE_ASSET_TABLES = new Set([
  "data_sources",
  "ingestion_data_sources",
  "qc_data_sources",
  "dev_datasources",
  "service_data_sources",
  "report_data_sources",
  "data_lab_sources",
  "dm_data_sources",
]);
const SHARED_PRIMARY_KEY_TABLES = {
  ingestion_data_sources: "data_sources",
  qc_data_sources: "data_sources",
};
const IMPLICIT_FOREIGN_KEYS = [
  { childTable: "report_dashboard_widgets", childColumn: "dashboard_id", parentTable: "report_dashboards", parentColumn: "id" },
  { childTable: "qc_monitor_table", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
  { childTable: "qc_result_batch", childColumn: "task_id", parentTable: "qc_task", parentColumn: "id" },
  { childTable: "qc_result_batch", childColumn: "monitor_table_id", parentTable: "qc_monitor_table", parentColumn: "id" },
  { childTable: "qc_result_batch", childColumn: "source_id", parentTable: "data_sources", parentColumn: "id" },
  { childTable: "qc_result_batch", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
  { childTable: "qc_result_rule_stat", childColumn: "monitor_table_id", parentTable: "qc_monitor_table", parentColumn: "id" },
  { childTable: "qc_result_rule_stat", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
  { childTable: "qc_result_rule_stat", childColumn: "baseline_result_batch_id", parentTable: "qc_result_batch", parentColumn: "id" },
  { childTable: "qc_finding", childColumn: "monitor_table_id", parentTable: "qc_monitor_table", parentColumn: "id" },
  { childTable: "qc_finding", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
  { childTable: "qc_finding", childColumn: "result_rule_stat_id", parentTable: "qc_result_rule_stat", parentColumn: "id" },
  { childTable: "qc_issue_occurrence", childColumn: "result_rule_stat_id", parentTable: "qc_result_rule_stat", parentColumn: "id" },
  { childTable: "qc_report", childColumn: "online_document_id", parentTable: "online_documents", parentColumn: "id" },
  { childTable: "qc_report", childColumn: "baseline_report_id", parentTable: "qc_report", parentColumn: "id" },
  { childTable: "qc_report", childColumn: "current_report_id", parentTable: "qc_report", parentColumn: "id" },
  { childTable: "qc_report", childColumn: "baseline_batch_id", parentTable: "qc_result_batch", parentColumn: "id" },
  { childTable: "qc_report", childColumn: "current_batch_id", parentTable: "qc_result_batch", parentColumn: "id" },
  { childTable: "dev_workflow_nodes", childColumn: "processing_job_id", parentTable: "dev_processing_jobs", parentColumn: "id" },
  { childTable: "dev_workflow_nodes", childColumn: "orchestration_task_id", parentTable: "dev_orchestration_tasks", parentColumn: "id" },
  { childTable: "dev_job_instances", childColumn: "processing_job_id", parentTable: "dev_processing_jobs", parentColumn: "id" },
  { childTable: "dev_job_instances", childColumn: "orchestration_task_id", parentTable: "dev_orchestration_tasks", parentColumn: "id" },
];
const RUNTIME_FILE_COLUMNS = [];
const RUNTIME_ROOT = path.resolve(process.cwd(), "runtime");
const MAX_RUNTIME_FILE_SIZE = 20 * 1024 * 1024;
const PACKAGE_KEY_MIN_LENGTH = 12;
const PACKAGE_KEY_DERIVATION_ITERATIONS = 210000;

const MODULE_REGISTRY = [
  { moduleKey: "dataSources", moduleName: "数据源", tablePrefixes: ["data_sources", "ingestion_data_sources", "qc_data_sources", "dev_datasources", "service_data_sources", "report_data_sources", "data_lab_sources"] },
  { moduleKey: "dataSourceResearch", moduleName: "数据调研", tablePrefixes: ["data_source_research_"] },
  { moduleKey: "ingestion", moduleName: "数据接入", tablePrefixes: ["ingestion_"] },
  { moduleKey: "fileImports", moduleName: "文件导入", tablePrefixes: ["file_import_"] },
  { moduleKey: "qualityControl", moduleName: "质量监控", tablePrefixes: ["qc_"] },
  { moduleKey: "dataDevelopment", moduleName: "数据开发", tablePrefixes: ["dev_"] },
  { moduleKey: "dataStandards", moduleName: "数据标准", tablePrefixes: ["std_"] },
  { moduleKey: "dataMap", moduleName: "数据地图", tablePrefixes: ["dm_"] },
  { moduleKey: "dataServices", moduleName: "数据服务", tablePrefixes: ["service_"] },
  { moduleKey: "reporting", moduleName: "报表平台", tablePrefixes: ["report_"] },
  { moduleKey: "dataLab", moduleName: "数据实验室", tablePrefixes: ["lab_"] },
  { moduleKey: "assetSearch", moduleName: "资产检索", tablePrefixes: ["asset_search_"] },
];

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function calculateSha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function buildPackageIntegrity(packagePayload) {
  const packageWithoutIntegrity = {
    ...packagePayload,
    manifest: { ...packagePayload.manifest },
  };
  delete packageWithoutIntegrity.manifest.integrity;
  return {
    algorithm: "sha256",
    payloadSha256: calculateSha256(packageWithoutIntegrity),
    tables: packagePayload.tables.map((table) => ({
      tableName: table.tableName,
      rowCount: table.rows.length,
      sha256: calculateSha256({ tableName: table.tableName, columns: table.columns, rows: table.rows }),
    })),
  };
}

function createPackageCryptoContext(packageKey) {
  if (typeof packageKey !== "string" || packageKey.length < PACKAGE_KEY_MIN_LENGTH) {
    throw new AppError(`加密迁移口令至少需要 ${PACKAGE_KEY_MIN_LENGTH} 位`, 400);
  }
  const salt = crypto.randomBytes(16);
  return {
    key: crypto.pbkdf2Sync(packageKey, salt, PACKAGE_KEY_DERIVATION_ITERATIONS, 32, "sha256"),
    metadata: {
      algorithm: "aes-256-gcm",
      keyDerivation: "pbkdf2-sha256",
      iterations: PACKAGE_KEY_DERIVATION_ITERATIONS,
      saltBase64: salt.toString("base64"),
    },
  };
}

function getPackageCryptoKey(metadata, packageKey) {
  if (!metadata || metadata.algorithm !== "aes-256-gcm" || metadata.keyDerivation !== "pbkdf2-sha256") {
    throw new AppError("项目包敏感配置加密元数据不受支持", 400);
  }
  if (typeof packageKey !== "string" || packageKey.length < PACKAGE_KEY_MIN_LENGTH) {
    throw new AppError("该项目包包含加密敏感配置，请提供正确的迁移口令", 400);
  }
  const iterations = Number(metadata.iterations);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) {
    throw new AppError("项目包敏感配置加密参数不合法", 400);
  }
  return crypto.pbkdf2Sync(packageKey, Buffer.from(metadata.saltBase64, "base64"), iterations, 32, "sha256");
}

function encryptPackageValue(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    __medataEncrypted: true,
    ivBase64: iv.toString("base64"),
    authTagBase64: cipher.getAuthTag().toString("base64"),
    ciphertextBase64: ciphertext.toString("base64"),
  };
}

function decryptPackageValue(value, key) {
  if (!value || value.__medataEncrypted !== true) return value;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(value.ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(value.authTagBase64, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertextBase64, "base64")), decipher.final()]).toString("utf8"));
  } catch {
    throw new AppError("项目包敏感配置无法解密，迁移口令不正确或数据已损坏", 400);
  }
}

function isPathInside(parentPath, targetPath) {
  const relative = path.relative(parentPath, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizeRuntimeRelativePath(value, urlPrefix = "") {
  const text = String(value || "").trim().replace(/\\/g, "/");
  if (!text) return null;
  const relative = urlPrefix && text.startsWith(urlPrefix)
    ? text.slice(urlPrefix.length)
    : text.replace(/^\/+/, "").replace(/^runtime\//, "");
  if (!relative || relative.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
  return relative;
}

function resolveRuntimeFilePath(value, fileRule) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (fileRule.urlPrefix && text.startsWith(fileRule.urlPrefix)) {
    const relative = normalizeRuntimeRelativePath(text, fileRule.urlPrefix);
    return relative ? path.join(RUNTIME_ROOT, "online-docs-uploads", relative) : null;
  }
  const resolved = path.resolve(text);
  return isPathInside(RUNTIME_ROOT, resolved) ? resolved : null;
}

async function collectRuntimeFiles(tables) {
  const files = [];
  const warnings = [];
  for (const rule of RUNTIME_FILE_COLUMNS) {
    const table = tables.find((item) => item.tableName === rule.tableName);
    for (const row of table?.rows || []) {
      const sourcePath = row[rule.columnName];
      const absolutePath = resolveRuntimeFilePath(sourcePath, rule);
      if (!absolutePath) continue;
      try {
        const stat = await fs.stat(absolutePath);
        if (!stat.isFile()) continue;
        if (stat.size > MAX_RUNTIME_FILE_SIZE) {
          warnings.push(`运行时文件超过 20MB，未纳入项目包：${path.basename(absolutePath)}`);
          continue;
        }
        const content = await fs.readFile(absolutePath);
        const relativePath = path.relative(RUNTIME_ROOT, absolutePath).replace(/\\/g, "/");
        files.push({
          tableName: rule.tableName,
          rowId: row.id,
          columnName: rule.columnName,
          relativePath,
          size: content.length,
          sha256: crypto.createHash("sha256").update(content).digest("hex"),
          contentBase64: content.toString("base64"),
        });
      } catch {
        warnings.push(`运行时文件不存在，未纳入项目包：${String(sourcePath)}`);
      }
    }
  }
  return { files, warnings };
}

function adaptPackageToCurrent(packagePayload) {
  const sourceVersion = String(packagePayload?.manifest?.exportFormatVersion || "");
  if (sourceVersion === EXPORT_FORMAT_VERSION) return packagePayload;
  const legacyWarnings = sourceVersion === LEGACY_EXPORT_FORMAT_VERSION
    ? ["旧版项目包未包含完整性校验和跨环境引用映射，将按兼容模式导入。"]
    : ["V2 项目包将按 V3 兼容适配器导入；未包含的运行时文件按空集处理。"];
  return {
    ...packagePayload,
    files: Array.isArray(packagePayload.files) ? packagePayload.files : [],
    manifest: {
      ...packagePayload.manifest,
      exportFormatVersion: EXPORT_FORMAT_VERSION,
      compatibility: {
        ...(packagePayload.manifest?.compatibility || {}),
        adaptedFrom: sourceVersion,
        warnings: [...(packagePayload.manifest?.compatibility?.warnings || []), ...legacyWarnings],
      },
    },
  };
}

function quoteIdentifier(name) {
  if (!SAFE_IDENTIFIER_PATTERN.test(name)) {
    throw new AppError(`不安全的数据表标识：${name}`, 400);
  }
  return `\`${name}\``;
}

function inferModule(tableName) {
  const moduleDef = MODULE_REGISTRY.find((item) =>
    item.tablePrefixes.some((prefix) => tableName === prefix || tableName.startsWith(prefix))
  );
  return moduleDef || { moduleKey: "projectAssets", moduleName: "项目资产", tablePrefixes: [] };
}

async function listTables(connection) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME ASC`
  );
  return rows.map((row) => String(row.tableName || "")).filter((name) => SAFE_IDENTIFIER_PATTERN.test(name));
}

async function listColumns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME AS columnName, EXTRA AS extraInfo, DATA_TYPE AS dataType,
            IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION ASC`,
    [tableName]
  );
  return rows.map((row) => ({
    columnName: String(row.columnName || ""),
    extraInfo: String(row.extraInfo || ""),
    dataType: String(row.dataType || ""),
    isNullable: String(row.isNullable || "").toUpperCase() === "YES",
    hasDefault: row.columnDefault !== null && row.columnDefault !== undefined,
  })).filter((row) => SAFE_IDENTIFIER_PATTERN.test(row.columnName));
}

async function listForeignKeys(connection, tableNames) {
  if (tableNames.length === 0) return [];
  const placeholders = tableNames.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS childTable, COLUMN_NAME AS childColumn,
            REFERENCED_TABLE_NAME AS parentTable, REFERENCED_COLUMN_NAME AS parentColumn
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME IS NOT NULL
       AND TABLE_NAME IN (${placeholders})
       AND REFERENCED_TABLE_NAME IN (${placeholders})
     ORDER BY TABLE_NAME ASC, ORDINAL_POSITION ASC`,
    [...tableNames, ...tableNames]
  );
  return rows.map((row) => ({
    childTable: String(row.childTable || ""),
    childColumn: String(row.childColumn || ""),
    parentTable: String(row.parentTable || ""),
    parentColumn: String(row.parentColumn || "id"),
  })).filter((row) =>
    SAFE_IDENTIFIER_PATTERN.test(row.childTable) &&
    SAFE_IDENTIFIER_PATTERN.test(row.childColumn) &&
    SAFE_IDENTIFIER_PATTERN.test(row.parentTable) &&
    SAFE_IDENTIFIER_PATTERN.test(row.parentColumn)
  );
}

function buildImportOrder(tableNames, foreignKeys) {
  const sorted = [...tableNames].sort((left, right) => left.localeCompare(right));
  const inboundCounts = new Map(sorted.map((tableName) => [tableName, 0]));
  const adjacency = new Map(sorted.map((tableName) => [tableName, new Set()]));

  for (const foreignKey of foreignKeys) {
    if (foreignKey.childTable === foreignKey.parentTable) continue;
    if (!adjacency.has(foreignKey.parentTable) || !adjacency.has(foreignKey.childTable)) continue;
    if (!adjacency.get(foreignKey.parentTable).has(foreignKey.childTable)) {
      adjacency.get(foreignKey.parentTable).add(foreignKey.childTable);
      inboundCounts.set(foreignKey.childTable, Number(inboundCounts.get(foreignKey.childTable) || 0) + 1);
    }
  }

  const queue = sorted.filter((tableName) => Number(inboundCounts.get(tableName) || 0) === 0);
  const visited = new Set();
  const ordered = [];

  while (queue.length > 0) {
    queue.sort((left, right) => left.localeCompare(right));
    const tableName = queue.shift();
    if (!tableName || visited.has(tableName)) continue;
    visited.add(tableName);
    ordered.push(tableName);

    for (const childTable of [...(adjacency.get(tableName) || [])].sort((left, right) => left.localeCompare(right))) {
      const count = Number(inboundCounts.get(childTable) || 0) - 1;
      inboundCounts.set(childTable, count);
      if (count === 0) queue.push(childTable);
    }
  }

  return [...ordered, ...sorted.filter((tableName) => !visited.has(tableName))];
}

function moveTableBefore(tableNames, beforeTable, afterTable) {
  const beforeIndex = tableNames.indexOf(beforeTable);
  const afterIndex = tableNames.indexOf(afterTable);
  if (beforeIndex < 0 || afterIndex < 0 || beforeIndex < afterIndex) {
    return tableNames;
  }
  const next = [...tableNames];
  next.splice(beforeIndex, 1);
  next.splice(next.indexOf(afterTable), 0, beforeTable);
  return next;
}

async function getProjectScopedTables(connection) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME = 'project_id'
       AND TABLE_NAME <> 'project_spaces'
     GROUP BY TABLE_NAME
     ORDER BY TABLE_NAME ASC`
  );
  return rows
    .map((row) => String(row.tableName || ""))
    .filter((tableName) => SAFE_IDENTIFIER_PATTERN.test(tableName) && !INTERNAL_EXPORT_TABLES.has(tableName));
}

async function getRelatedChildTables(connection, projectScopedTables) {
  const allTables = await listTables(connection);
  const tableSet = new Set(projectScopedTables);
  let changed = true;

  while (changed) {
    changed = false;
    const foreignKeys = await listForeignKeys(connection, allTables);
    for (const foreignKey of foreignKeys) {
      if (tableSet.has(foreignKey.parentTable) && !tableSet.has(foreignKey.childTable) && !INTERNAL_EXPORT_TABLES.has(foreignKey.childTable)) {
        tableSet.add(foreignKey.childTable);
        changed = true;
      }
    }
  }

  return [...tableSet].sort((left, right) => left.localeCompare(right));
}

function shouldExportRow(tableName, row, projectScopedTables, exportedIds) {
  if (tableName === "qc_recommendation_run" && ["queued", "profiling"].includes(String(row.run_status || "").toLowerCase())) {
    return false;
  }
  if (projectScopedTables.has(tableName)) return true;
  return true;
}

function desensitizeRow(row) {
  const next = { ...row };
  for (const key of Object.keys(next)) {
    if (SENSITIVE_COLUMN_PATTERN.test(key) && next[key]) {
      next[key] = null;
    } else {
      next[key] = desensitizeNestedSensitiveValue(next[key]);
    }
  }
  return next;
}

function desensitizeNestedSensitiveValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => desensitizeNestedSensitiveValue(item));
  }
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.entries(value).reduce((result, [key, item]) => {
      result[key] = SENSITIVE_JSON_KEY_PATTERN.test(key) && item ? null : desensitizeNestedSensitiveValue(item);
      return result;
    }, {});
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || (!text.startsWith("{") && !text.startsWith("["))) return value;
    try {
      return JSON.stringify(desensitizeNestedSensitiveValue(JSON.parse(text)));
    } catch {
      return value;
    }
  }
  return value;
}

function encryptNestedSensitiveValue(value, key) {
  if (Array.isArray(value)) return value.map((item) => encryptNestedSensitiveValue(item, key));
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.entries(value).reduce((result, [entryKey, item]) => {
      result[entryKey] = SENSITIVE_JSON_KEY_PATTERN.test(entryKey) && item
        ? encryptPackageValue(item, key)
        : encryptNestedSensitiveValue(item, key);
      return result;
    }, {});
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || (!text.startsWith("{") && !text.startsWith("["))) return value;
    try {
      return JSON.stringify(encryptNestedSensitiveValue(JSON.parse(text), key));
    } catch {
      return value;
    }
  }
  return value;
}

function encryptSensitiveRow(row, key) {
  const next = { ...row };
  for (const columnName of Object.keys(next)) {
    if (SENSITIVE_COLUMN_PATTERN.test(columnName) && next[columnName]) {
      next[columnName] = encryptPackageValue(next[columnName], key);
    } else {
      next[columnName] = encryptNestedSensitiveValue(next[columnName], key);
    }
  }
  return next;
}

function decryptNestedSensitiveValue(value, key) {
  if (Array.isArray(value)) return value.map((item) => decryptNestedSensitiveValue(item, key));
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    if (value.__medataEncrypted === true) return decryptPackageValue(value, key);
    return Object.entries(value).reduce((result, [entryKey, item]) => {
      result[entryKey] = decryptNestedSensitiveValue(item, key);
      return result;
    }, {});
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || (!text.startsWith("{") && !text.startsWith("["))) return value;
    try {
      return JSON.stringify(decryptNestedSensitiveValue(JSON.parse(text), key));
    } catch {
      return value;
    }
  }
  return value;
}

function decryptPackageSensitiveData(packagePayload, packageKey) {
  if (packagePayload.manifest?.sensitiveMode !== "encrypted") return packagePayload;
  const key = getPackageCryptoKey(packagePayload.manifest.sensitiveEncryption, packageKey);
  return {
    ...packagePayload,
    tables: packagePayload.tables.map((table) => ({
      ...table,
      rows: table.rows.map((row) => decryptNestedSensitiveValue(row, key)),
    })),
  };
}

async function exportTable(connection, tableName, columns, projectId, projectScopedTables, foreignKeysByChild, exportedIds, sensitiveMode, encryptionKey) {
  let rows = [];
  const orderBy = columns.some((column) => column.columnName === "id") ? " ORDER BY id ASC" : "";
  if (projectScopedTables.has(tableName)) {
    const [result] = await connection.query(
      `SELECT * FROM ${quoteIdentifier(tableName)} WHERE project_id = ?${orderBy}`,
      [projectId]
    );
    rows = result;
  } else {
    const linkedParentFilters = (foreignKeysByChild.get(tableName) || [])
      .filter((foreignKey) => exportedIds.has(foreignKey.parentTable));
    const parentFilters = tableName === "report_dashboard_widgets"
      ? linkedParentFilters.filter((foreignKey) => foreignKey.parentTable === "report_dashboards")
      : linkedParentFilters;
    if (parentFilters.length === 0) {
      rows = [];
    } else {
      const clauses = [];
      const params = [];
      for (const foreignKey of parentFilters) {
        const ids = [...(exportedIds.get(foreignKey.parentTable) || [])];
        if (ids.length === 0) continue;
        clauses.push(`${quoteIdentifier(foreignKey.childColumn)} IN (${ids.map(() => "?").join(", ")})`);
        params.push(...ids);
      }
      if (clauses.length > 0) {
        const [result] = await connection.query(
          `SELECT * FROM ${quoteIdentifier(tableName)} WHERE ${clauses.join(" OR ")}${orderBy}`,
          params
        );
        rows = result;
      }
    }
  }

  const idSet = new Set();
  for (const row of rows) {
    if (row.id !== undefined && row.id !== null) {
      idSet.add(Number(row.id));
    }
  }
  exportedIds.set(tableName, idSet);

  return {
    tableName,
    moduleKey: inferModule(tableName).moduleKey,
    columns: columns.map((column) => column.columnName),
    rows: rows
      .filter((row) => shouldExportRow(tableName, row, projectScopedTables, exportedIds))
      .map((row) => {
        if (sensitiveMode === "desensitized") return desensitizeRow(row);
        if (sensitiveMode === "encrypted") return encryptSensitiveRow(row, encryptionKey);
        return row;
      }),
  };
}

function buildModuleSummary(tables) {
  const summary = new Map();
  for (const table of tables) {
    const moduleDef = inferModule(table.tableName);
    const current = summary.get(moduleDef.moduleKey) || {
      moduleKey: moduleDef.moduleKey,
      moduleName: moduleDef.moduleName,
      tableCount: 0,
      rowCount: 0,
    };
    current.tableCount += 1;
    current.rowCount += table.rows.length;
    summary.set(moduleDef.moduleKey, current);
  }
  return [...summary.values()].sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
}

async function buildPortableReferences(connection, tables) {
  const projectMemberTable = tables.find((table) => table.tableName === "project_members");
  const qualityIssueTable = tables.find((table) => table.tableName === "qc_issue");
  const projectMemberUserIds = new Set((projectMemberTable?.rows || []).map((row) => Number(row.user_id)).filter(Number.isFinite));
  const qualityIssueOwnerIds = new Set((qualityIssueTable?.rows || []).map((row) => Number(row.owner_user_id)).filter((id) => Number.isFinite(id) && id > 0));
  const userIds = [...new Set([...projectMemberUserIds, ...qualityIssueOwnerIds])];
  const providerIds = [];
  const references = { users: [], modelProviders: [] };

  if (userIds.length > 0) {
    const [rows] = await connection.query(
      `SELECT id, username, display_name AS displayName
       FROM users WHERE id IN (${userIds.map(() => "?").join(", ")})`,
      userIds
    );
    references.users = rows.map((row) => ({
      id: Number(row.id),
      username: row.username,
      displayName: row.displayName,
      required: projectMemberUserIds.has(Number(row.id)),
    }));
  }
  if (providerIds.length > 0) {
    const [rows] = await connection.query(
      `SELECT id, config_code AS configCode, config_name AS configName, model_name AS modelName
       FROM model_providers WHERE id IN (${providerIds.map(() => "?").join(", ")})`,
      providerIds
    );
    references.modelProviders = rows.map((row) => ({
      id: Number(row.id), configCode: row.configCode, configName: row.configName, modelName: row.modelName,
    }));
  }
  return references;
}

async function exportProject(projectId, options = {}, user = {}) {
  const project = await projectRepository.getProjectById(projectId);
  if (!project) {
    throw new AppError("项目不存在，无法导出", 404);
  }
  const sensitiveMode = options.sensitiveMode === "encrypted" ? "encrypted" : "desensitized";
  const cryptoContext = sensitiveMode === "encrypted" ? createPackageCryptoContext(options.packageKey) : null;

  const connection = await pool.getConnection();
  try {
    const projectScopedTableNames = await getProjectScopedTables(connection);
    const allExportTableNames = await getRelatedChildTables(connection, projectScopedTableNames);
    const foreignKeys = [
      ...(await listForeignKeys(connection, allExportTableNames)),
      ...IMPLICIT_FOREIGN_KEYS.filter((foreignKey) => allExportTableNames.includes(foreignKey.childTable) && allExportTableNames.includes(foreignKey.parentTable)),
    ];
    const importOrder = buildImportOrder(allExportTableNames, foreignKeys);
    const columnsByTable = new Map();
    for (const tableName of allExportTableNames) {
      columnsByTable.set(tableName, await listColumns(connection, tableName));
    }

    const foreignKeysByChild = new Map();
    for (const foreignKey of foreignKeys) {
      if (!foreignKeysByChild.has(foreignKey.childTable)) {
        foreignKeysByChild.set(foreignKey.childTable, []);
      }
      foreignKeysByChild.get(foreignKey.childTable).push(foreignKey);
    }

    const exportedIds = new Map();
    const projectScopedSet = new Set(projectScopedTableNames);
    const tables = [];
    for (const tableName of importOrder) {
      tables.push(await exportTable(
        connection,
        tableName,
        columnsByTable.get(tableName) || [],
        projectId,
        projectScopedSet,
        foreignKeysByChild,
        exportedIds,
        sensitiveMode,
        cryptoContext?.key
      ));
    }

    const nonEmptyTables = tables.filter((table) => table.rows.length > 0 || projectScopedSet.has(table.tableName));
    const runtimeFiles = await collectRuntimeFiles(nonEmptyTables);
    const packagePayload = {
      manifest: {
        exportFormatVersion: EXPORT_FORMAT_VERSION,
        appVersion: "2.0.0",
        packageType: "medata-project-assets",
        exportedAt: new Date().toISOString(),
        exportedBy: user.username || user.displayName || "system",
        sensitiveMode,
        ...(cryptoContext ? { sensitiveEncryption: cryptoContext.metadata } : {}),
        sourceProject: {
          id: project.id,
          code: project.projectCode,
          name: project.projectName,
          type: project.projectType,
        },
        modules: buildModuleSummary(nonEmptyTables),
        compatibility: {
          minimumImportVersion: V2_EXPORT_FORMAT_VERSION,
          supportedLegacyVersions: [LEGACY_EXPORT_FORMAT_VERSION, V2_EXPORT_FORMAT_VERSION],
        },
        coverage: {
          configurationAssets: true,
          projectRuntimeFiles: true,
          externalPhysicalData: false,
          sensitiveConfiguration: sensitiveMode,
        },
      },
      project: {
        projectName: project.projectName,
        projectCode: project.projectCode,
        projectType: project.projectType,
        description: project.description,
        ownerName: project.ownerName,
        status: project.status,
        resourceConfig: project.resourceConfig || {},
        settings: project.settings || {},
      },
      schema: {
        importOrder,
        foreignKeys,
      },
      references: await buildPortableReferences(connection, nonEmptyTables),
      tables: nonEmptyTables,
      files: runtimeFiles.files,
    };
    packagePayload.manifest.integrity = buildPackageIntegrity(packagePayload);

    await writeTransferLog({
      projectId,
      operationType: "export",
      status: "success",
      operatorName: user.username || user.displayName || "system",
      packageVersion: EXPORT_FORMAT_VERSION,
      modules: packagePayload.manifest.modules,
      summary: {
        tableCount: nonEmptyTables.length,
        rowCount: nonEmptyTables.reduce((sum, table) => sum + table.rows.length, 0),
        runtimeFileCount: runtimeFiles.files.length,
        warnings: runtimeFiles.warnings,
      },
    });

    return packagePayload;
  } catch (error) {
    await writeTransferLog({
      projectId,
      operationType: "export",
      status: "failed",
      operatorName: user.username || user.displayName || "system",
      packageVersion: EXPORT_FORMAT_VERSION,
      modules: [],
      summary: {},
      errorMessage: error.message,
    });
    throw error;
  } finally {
    connection.release();
  }
}

function validatePackage(packagePayload) {
  if (!packagePayload || typeof packagePayload !== "object") {
    throw new AppError("项目资产包格式不正确", 400);
  }
  if (packagePayload.manifest?.packageType !== "medata-project-assets") {
    throw new AppError("不是有效的 MeData 项目资产包", 400);
  }
  const sourceVersion = String(packagePayload.manifest?.exportFormatVersion || "");
  if (!SUPPORTED_EXPORT_FORMAT_VERSIONS.has(sourceVersion)) {
    throw new AppError("项目资产包版本不兼容", 400, {
      supported: [...SUPPORTED_EXPORT_FORMAT_VERSIONS],
      actual: sourceVersion,
    });
  }
  if (!Array.isArray(packagePayload.tables)) {
    throw new AppError("项目资产包缺少表数据", 400);
  }
  for (const table of packagePayload.tables) {
    if (!SAFE_IDENTIFIER_PATTERN.test(String(table?.tableName || "")) || !Array.isArray(table?.columns) || !Array.isArray(table?.rows)) {
      throw new AppError("项目资产包包含无效表数据", 400);
    }
  }
  if (packagePayload.files !== undefined && !Array.isArray(packagePayload.files)) {
    throw new AppError("项目资产包运行时文件格式不正确", 400);
  }

  const integrity = packagePayload.manifest?.integrity;
  if (sourceVersion !== LEGACY_EXPORT_FORMAT_VERSION && !integrity) {
    throw new AppError("V2/V3 项目资产包缺少完整性校验信息", 400);
  }
  if (integrity) {
    if (integrity.algorithm !== "sha256") {
      throw new AppError("项目资产包完整性算法不受支持", 400);
    }
    const expectedTables = new Map((integrity.tables || []).map((item) => [item.tableName, item]));
    if (expectedTables.size !== packagePayload.tables.length) {
      throw new AppError("项目资产包完整性清单不完整", 400);
    }
    for (const table of packagePayload.tables) {
      const expected = expectedTables.get(table.tableName);
      const actualHash = calculateSha256({ tableName: table.tableName, columns: table.columns, rows: table.rows });
      if (!expected || Number(expected.rowCount) !== table.rows.length || expected.sha256 !== actualHash) {
        throw new AppError(`项目资产包表数据校验失败：${table.tableName}`, 400);
      }
    }
    for (const file of packagePayload.files || []) {
      if (!file?.tableName || !file?.columnName || !normalizeRuntimeRelativePath(file.relativePath) || !file.contentBase64) {
        throw new AppError("项目资产包包含无效运行时文件", 400);
      }
      const content = Buffer.from(file.contentBase64, "base64");
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      if (content.length !== Number(file.size) || hash !== file.sha256) {
        throw new AppError(`项目资产包运行时文件校验失败：${file.relativePath}`, 400);
      }
    }
    const actualPayloadHash = buildPackageIntegrity({
      ...packagePayload,
      manifest: { ...packagePayload.manifest, integrity: undefined },
    }).payloadSha256;
    if (integrity.payloadSha256 !== actualPayloadHash) {
      throw new AppError("项目资产包整体校验失败，文件可能已损坏或被修改", 400);
    }
  }
  return adaptPackageToCurrent(packagePayload);
}

function collectPackageDatabaseTypes(packagePayload) {
  const types = new Set();
  for (const table of packagePayload?.tables || []) {
    if (!DATABASE_ASSET_TABLES.has(table.tableName)) continue;
    for (const row of table.rows || []) {
      const storedType = row.source_type || row.storage_type || row.datasource_type || row.sourceType || row.storageType;
      const config = parseJson(
        row.connection_config_json || row.connection_config || row.extra_config_json || row.connectionConfig,
        {},
      );
      const dialect = inferDatasourceDialect(storedType, config);
      const normalized = normalizeDatasourceType(dialect || storedType);
      if (isSupportedDatabaseType(normalized)) types.add(normalized);
    }
  }
  return [...types];
}

function validatePackageDatabaseCapabilities(packagePayload, statuses = getRuntimeDatabaseCapabilityStatus()) {
  const statusByType = new Map(statuses.map((item) => [item.type, item]));
  const errors = [];
  for (const type of collectPackageDatabaseTypes(packagePayload)) {
    const status = statusByType.get(type);
    if (!status?.queryReady) errors.push(`${status?.label || type} 查询驱动未就绪`);
    if (!status?.dataxReaderReady) errors.push(`${status?.label || type} DataX 读取插件未就绪`);
    if (!status?.dataxWriterReady) errors.push(`${status?.label || type} DataX 写入插件未就绪`);
  }
  if (errors.length) {
    throw new AppError(`目标环境数据库能力不完整：${errors.join("；")}`, 400, { databaseCapabilityErrors: errors });
  }
  return collectPackageDatabaseTypes(packagePayload);
}

async function readPackageFile(file) {
  if (!file?.path) {
    throw new AppError("请上传项目资产包文件", 400);
  }
  const raw = await fs.readFile(file.path, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError("项目资产包不是有效 JSON 文件", 400);
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
}

async function ensureTransferLogTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS project_asset_transfer_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      project_id BIGINT NULL,
      operation_type VARCHAR(16) NOT NULL,
      package_version VARCHAR(32) NULL,
      modules_json JSON NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'running',
      summary_json JSON NULL,
      error_message TEXT NULL,
      operator_name VARCHAR(64) NOT NULL DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_project_asset_transfer_project (project_id, created_at, id),
      KEY idx_project_asset_transfer_operation (operation_type, status, created_at)
    )`
  );
}

async function writeTransferLog(payload) {
  await ensureTransferLogTable();
  await pool.query(
    `INSERT INTO project_asset_transfer_logs
      (project_id, operation_type, package_version, modules_json, status, summary_json, error_message, operator_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.projectId || null,
      payload.operationType,
      payload.packageVersion || EXPORT_FORMAT_VERSION,
      JSON.stringify(payload.modules || []),
      payload.status || "success",
      JSON.stringify(payload.summary || {}),
      payload.errorMessage || null,
      payload.operatorName || "system",
    ]
  );
}

async function listTransferLogs(projectId) {
  await ensureTransferLogTable();
  const params = [];
  let where = "";
  if (projectId) {
    where = "WHERE project_id = ?";
    params.push(projectId);
  }
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, operation_type AS operationType, package_version AS packageVersion,
            modules_json AS modules, status, summary_json AS summary, error_message AS errorMessage,
            operator_name AS operatorName, created_at AS createdAt, updated_at AS updatedAt
     FROM project_asset_transfer_logs
     ${where}
     ORDER BY id DESC
     LIMIT 100`,
    params
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    projectId: row.projectId ? Number(row.projectId) : null,
    modules: parseJson(row.modules, []),
    summary: parseJson(row.summary, {}),
  }));
}

async function ensureProjectBackupTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS project_asset_backups (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      source_project_id BIGINT NOT NULL,
      package_version VARCHAR(32) NOT NULL,
      package_sha256 CHAR(64) NULL,
      package_json LONGTEXT NOT NULL,
      created_by VARCHAR(64) NOT NULL DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_project_asset_backup_project_created (source_project_id, created_at, id)
    )`
  );
}

async function createProjectBackup(projectId, user = {}) {
  const project = await projectRepository.getProjectById(projectId);
  if (!project) throw new AppError("项目不存在，无法创建备份", 404);
  const packagePayload = await exportProject(projectId, { sensitiveMode: "desensitized" }, user);
  await ensureProjectBackupTable();
  const [result] = await pool.query(
    `INSERT INTO project_asset_backups
      (source_project_id, package_version, package_sha256, package_json, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      projectId,
      packagePayload.manifest.exportFormatVersion,
      packagePayload.manifest.integrity?.payloadSha256 || null,
      JSON.stringify(packagePayload),
      user.username || user.displayName || "system",
    ]
  );
  return {
    id: Number(result.insertId),
    projectId,
    packageVersion: packagePayload.manifest.exportFormatVersion,
    packageSha256: packagePayload.manifest.integrity?.payloadSha256 || null,
    createdAt: new Date().toISOString(),
  };
}

async function listProjectBackups(projectId) {
  await ensureProjectBackupTable();
  const [rows] = await pool.query(
    `SELECT id, source_project_id AS projectId, package_version AS packageVersion,
            package_sha256 AS packageSha256, created_by AS createdBy, created_at AS createdAt
     FROM project_asset_backups
     WHERE source_project_id = ?
     ORDER BY id DESC
     LIMIT 100`,
    [projectId]
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), projectId: Number(row.projectId) }));
}

async function getProjectBackup(projectId, backupId) {
  await ensureProjectBackupTable();
  const [rows] = await pool.query(
    `SELECT package_json AS packageJson
     FROM project_asset_backups
     WHERE id = ? AND source_project_id = ?
     LIMIT 1`,
    [backupId, projectId]
  );
  if (!rows[0]) throw new AppError("项目备份不存在", 404);
  return parseJson(rows[0].packageJson, null);
}

async function buildReferenceMappings(connection, packagePayload) {
  const references = packagePayload.references || {};
  const mappings = { users: new Map(), modelProviders: new Map(), warnings: [] };
  const users = Array.isArray(references.users) ? references.users : [];
  const providers = Array.isArray(references.modelProviders) ? references.modelProviders : [];

  for (const user of users) {
    const [rows] = await connection.query("SELECT id FROM users WHERE username = ? LIMIT 1", [user.username]);
    if (!rows[0]) {
      if (user.required !== false) throw new AppError(`目标环境不存在项目成员账号：${user.username}`, 400);
      mappings.warnings.push(`质量问题负责人账号 ${user.username} 在目标环境不存在，相关问题将保留负责人名称但不自动绑定账号`);
      continue;
    }
    mappings.users.set(String(user.id), Number(rows[0].id));
  }
  for (const provider of providers) {
    const [rows] = await connection.query("SELECT id FROM model_providers WHERE config_code = ? LIMIT 1", [provider.configCode]);
    if (!rows[0]) {
      throw new AppError(`目标环境缺少智能体依赖的模型配置：${provider.configCode}`, 400);
    }
    mappings.modelProviders.set(String(provider.id), Number(rows[0].id));
  }
  if (!packagePayload.references) {
    mappings.warnings.push("旧版项目包未携带跨环境引用映射，成员与模型引用将按历史 ID 兼容导入。");
  }
  return mappings;
}

async function preflightImport(connection, packagePayload) {
  const missingTables = [];
  const missingColumns = [];
  for (const table of packagePayload.tables) {
    const targetColumns = await listColumns(connection, table.tableName);
    if (targetColumns.length === 0) {
      missingTables.push(table.tableName);
      continue;
    }
    const targetColumnNames = new Set(targetColumns.map((column) => column.columnName));
    const missing = table.columns.filter((columnName) => !targetColumnNames.has(columnName));
    if (missing.length > 0) {
      missingColumns.push({ tableName: table.tableName, columns: missing });
    }
  }
  if (missingTables.length > 0 || missingColumns.length > 0) {
    throw new AppError("目标环境尚未完成项目包所需的数据结构升级", 400, { missingTables, missingColumns });
  }
  const referenceMappings = await buildReferenceMappings(connection, packagePayload);
  return {
    referenceMappings,
    warnings: [
      ...(packagePayload.manifest?.compatibility?.warnings || []),
      ...referenceMappings.warnings,
    ],
  };
}

function buildRuntimeFileMap(packagePayload, targetProjectId, importId = crypto.randomUUID()) {
  return new Map((packagePayload.files || []).map((file) => {
    const extension = path.extname(file.relativePath || "").slice(0, 24);
    const fileName = `${crypto.createHash("sha256").update(`${file.tableName}:${file.rowId}:${file.columnName}:${file.relativePath}`).digest("hex").slice(0, 20)}${extension}`;
    return [
      `${file.tableName}:${file.rowId}:${file.columnName}`,
      { ...file, relativePath: `project-assets/${targetProjectId}/${importId}/${fileName}` },
    ];
  }));
}

function resolveImportedRuntimeValue(tableName, row, columnName, runtimeFileMap) {
  const file = runtimeFileMap?.get(`${tableName}:${row.id}:${columnName}`);
  if (!file) return undefined;
  return path.join(RUNTIME_ROOT, file.relativePath);
}

async function restoreRuntimeFiles(files = []) {
  const restoredPaths = [];
  for (const file of files) {
    const targetPath = path.resolve(RUNTIME_ROOT, file.relativePath);
    if (!isPathInside(RUNTIME_ROOT, targetPath)) {
      throw new AppError(`运行时文件路径不安全：${file.relativePath}`, 400);
    }
    const content = Buffer.from(file.contentBase64, "base64");
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content);
    restoredPaths.push(targetPath);
  }
  return restoredPaths;
}

function buildColumnValue(tableName, row, columnName, targetProjectId, idMaps, foreignKeys, referenceMappings, runtimeFileMap) {
  if (columnName === "project_id") return targetProjectId;
  if (tableName === "qc_standard_dictionary" && columnName === "source_system_id") {
    return idMaps.get("dm_business_systems")?.get(String(row.source_system_id)) || null;
  }
  if (tableName === "qc_standard_dictionary" && columnName === "source_id") {
    return idMaps.get("qc_data_sources")?.get(String(row.source_id))
      || idMaps.get("data_sources")?.get(String(row.source_id))
      || null;
  }
  if (tableName === "qc_strategy" && columnName === "current_version_id") {
    return null;
  }
  const runtimeValue = resolveImportedRuntimeValue(tableName, row, columnName, runtimeFileMap);
  if (runtimeValue !== undefined) return runtimeValue;
  if (tableName === "project_members" && columnName === "user_id" && referenceMappings?.users?.has(String(row.user_id))) {
    return referenceMappings.users.get(String(row.user_id));
  }
  if (tableName === "qc_issue" && columnName === "owner_user_id") {
    return referenceMappings?.users?.get(String(row.owner_user_id)) || null;
  }
  if (columnName === "id" && SHARED_PRIMARY_KEY_TABLES[tableName] && idMaps.has(SHARED_PRIMARY_KEY_TABLES[tableName])) {
    return idMaps.get(SHARED_PRIMARY_KEY_TABLES[tableName]).get(String(row.id)) || row.id;
  }
  const foreignKey = foreignKeys.find((item) => item.childColumn === columnName);
  if (foreignKey && foreignKey.childTable === foreignKey.parentTable) {
    return null;
  }
  if (foreignKey && idMaps.has(foreignKey.parentTable)) {
    const mapped = idMaps.get(foreignKey.parentTable).get(String(row[columnName]));
    return mapped || null;
  }
  if (foreignKey && row[columnName] !== null && row[columnName] !== undefined) {
    return null;
  }
  return row[columnName] === undefined ? null : row[columnName];
}

function formatMysqlDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatMysqlDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeImportBusinessValue(tableName, columnName, value, context) {
  if ((tableName === "dev_workflows" || tableName === "dev_orchestration_tasks") && columnName === "is_paused") {
    return 1;
  }
  if (tableName === "dev_workflows" && columnName === "published_version_no") {
    return null;
  }
  if (context.mode !== "new") return value;
  if (tableName === "service_apis" && columnName === "service_path" && value) {
    const normalizedPath = String(value).startsWith("/") ? String(value) : `/${value}`;
    return `/imported/project-${context.targetProjectId}${normalizedPath}`;
  }
  if (tableName === "service_api_call_logs" && columnName === "service_path" && value) {
    const normalizedPath = String(value).startsWith("/") ? String(value) : `/${value}`;
    return `/imported/project-${context.targetProjectId}${normalizedPath}`;
  }
  if (tableName === "service_apps" && columnName === "app_token") {
    return `imported_${context.targetProjectId}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }
  return value;
}

function buildDuplicateStrategy(tableName) {
  if (tableName === "project_members") {
    return "update";
  }
  return "error";
}

function normalizeInsertValue(value, column) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (column?.dataType === "date" && (value instanceof Date || typeof value === "string")) {
    return formatMysqlDate(value);
  }
  if (["datetime", "timestamp"].includes(column?.dataType) && (value instanceof Date || typeof value === "string")) {
    return formatMysqlDateTime(value);
  }
  if (value instanceof Date) return formatMysqlDateTime(value);
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function shouldUseColumnDefault(value, column) {
  return (value === null || value === undefined)
    && column
    && !column.isNullable
    && column.hasDefault;
}

async function backfillSelfReferences(connection, tableName, table, selfForeignKeys, idMap) {
  if (!selfForeignKeys.length || !idMap || idMap.size === 0) return;
  for (const row of table.rows) {
    const newId = idMap.get(String(row.id));
    if (!newId) continue;
    for (const foreignKey of selfForeignKeys) {
      const oldParentId = row[foreignKey.childColumn];
      if (!oldParentId) continue;
      const newParentId = idMap.get(String(oldParentId));
      if (!newParentId) continue;
      await connection.query(
        `UPDATE ${quoteIdentifier(tableName)}
         SET ${quoteIdentifier(foreignKey.childColumn)} = ?
         WHERE id = ?`,
        [newParentId, newId]
      );
    }
  }
}

async function backfillForeignReferences(connection, tablesByName, foreignKeys, idMaps) {
  for (const foreignKey of foreignKeys) {
    if (foreignKey.childTable === foreignKey.parentTable) continue;
    const childTable = tablesByName.get(foreignKey.childTable);
    const childIdMap = idMaps.get(foreignKey.childTable);
    const parentIdMap = idMaps.get(foreignKey.parentTable);
    if (!childTable || !childIdMap || !parentIdMap) continue;
    for (const row of childTable.rows || []) {
      const newChildId = childIdMap.get(String(row.id));
      const oldParentId = row[foreignKey.childColumn];
      const newParentId = oldParentId === null || oldParentId === undefined
        ? null
        : parentIdMap.get(String(oldParentId));
      if (!newChildId || (oldParentId !== null && oldParentId !== undefined && !newParentId)) continue;
      await connection.query(
        `UPDATE ${quoteIdentifier(foreignKey.childTable)}
         SET ${quoteIdentifier(foreignKey.childColumn)} = ?
         WHERE id = ?`,
        [newParentId, newChildId]
      );
    }
  }
}

async function backfillQualityPolymorphicReferences(connection, tablesByName, idMaps) {
  const strategyTable = tablesByName.get("qc_strategy");
  const strategyIdMap = idMaps.get("qc_strategy");
  const strategyVersionIdMap = idMaps.get("qc_strategy_version");
  if (strategyTable && strategyIdMap && strategyVersionIdMap) {
    for (const row of strategyTable.rows || []) {
      const newStrategyId = strategyIdMap.get(String(row.id));
      const newVersionId = row.current_version_id ? strategyVersionIdMap.get(String(row.current_version_id)) : null;
      if (newStrategyId) {
        await connection.query("UPDATE qc_strategy SET current_version_id=? WHERE id=?", [newVersionId || null, newStrategyId]);
      }
    }
  }
  for (const tableName of ["qc_report", "qc_ai_analysis_run"]) {
    const table = tablesByName.get(tableName);
    const rowIdMap = idMaps.get(tableName);
    if (!table || !rowIdMap) continue;
    for (const row of table.rows || []) {
      const newRowId = rowIdMap.get(String(row.id));
      if (!newRowId) continue;
      const scope = String(row.report_scope || row.scope_type || "").toLowerCase();
      const parentTable = scope === "system" ? "dm_business_systems" : ["table", "comparison"].includes(scope) ? "qc_monitor_table" : null;
      const mappedScopeRefId = parentTable && row.scope_ref_id
        ? idMaps.get(parentTable)?.get(String(row.scope_ref_id)) || null
        : null;
      const updates = ["scope_ref_id = ?"];
      const params = [mappedScopeRefId];
      if (tableName === "qc_report" && Object.prototype.hasOwnProperty.call(row, "object_ref_id")) {
        const objectParentTable = row.object_type === "system" ? "dm_business_systems" : row.object_type === "table" ? "qc_monitor_table" : null;
        const mappedObjectRefId = objectParentTable && row.object_ref_id
          ? idMaps.get(objectParentTable)?.get(String(row.object_ref_id)) || null
          : null;
        updates.push("object_ref_id = ?");
        params.push(mappedObjectRefId);
      }
      if (tableName === "qc_report" && row.batch_ids_json) {
        const oldBatchIds = parseJson(row.batch_ids_json, []);
        const mappedBatchIds = (Array.isArray(oldBatchIds) ? oldBatchIds : [])
          .map((id) => idMaps.get("qc_result_batch")?.get(String(id)))
          .filter(Boolean);
        updates.push("batch_ids_json = ?");
        params.push(JSON.stringify(mappedBatchIds));
      }
      if (tableName === "qc_report" && row.deterministic_summary_json) {
        const summary = parseJson(row.deterministic_summary_json, {});
        const mapId = (table, value) => value ? idMaps.get(table)?.get(String(value)) || null : null;
        if (Array.isArray(summary.batchIds)) summary.batchIds = summary.batchIds.map((id) => mapId("qc_result_batch", id)).filter(Boolean);
        if (summary.scope === "table" && summary.batch?.id) summary.batch.id = mapId("qc_result_batch", summary.batch.id);
        if (summary.scope === "comparison" && String(summary.comparisonType || "batch") === "batch") {
          if (summary.current?.id) summary.current.id = mapId("qc_result_batch", summary.current.id);
          if (summary.previous?.id) summary.previous.id = mapId("qc_result_batch", summary.previous.id);
        }
        if (summary.scope === "comparison" && String(summary.comparisonType || "batch") !== "batch") {
          if (summary.current?.reportId) summary.current.reportId = mapId("qc_report", summary.current.reportId);
          if (summary.previous?.reportId) summary.previous.reportId = mapId("qc_report", summary.previous.reportId);
          if (summary.sourceReports?.baselineReportId) summary.sourceReports.baselineReportId = mapId("qc_report", summary.sourceReports.baselineReportId);
          if (summary.sourceReports?.currentReportId) summary.sourceReports.currentReportId = mapId("qc_report", summary.sourceReports.currentReportId);
        }
        if (summary.table?.monitorTableId) summary.table.monitorTableId = mapId("qc_monitor_table", summary.table.monitorTableId);
        if (summary.object?.type === "table" && summary.object.objectRefId) summary.object.objectRefId = mapId("qc_monitor_table", summary.object.objectRefId);
        if (summary.object?.type === "system" && summary.object.objectRefId) summary.object.objectRefId = mapId("dm_business_systems", summary.object.objectRefId);
        if (summary.targetSystem?.businessSystemId) summary.targetSystem.businessSystemId = mapId("dm_business_systems", summary.targetSystem.businessSystemId);
        for (const table of summary.tables || []) {
          if (table.resultBatchId) table.resultBatchId = mapId("qc_result_batch", table.resultBatchId);
          if (table.monitorTableId) table.monitorTableId = mapId("qc_monitor_table", table.monitorTableId);
          if (table.businessSystemId) table.businessSystemId = mapId("dm_business_systems", table.businessSystemId);
        }
        updates.push("deterministic_summary_json = ?");
        params.push(JSON.stringify(summary));
      }
      params.push(newRowId);
      await connection.query(
        `UPDATE ${quoteIdentifier(tableName)} SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    }
  }
}

async function importRows(connection, packagePayload, targetProjectId, options = {}) {
  const tablesByName = new Map(packagePayload.tables.map((table) => [table.tableName, table]));
  const tableNames = packagePayload.tables.map((table) => table.tableName);
  const foreignKeys = [
    ...(await listForeignKeys(connection, tableNames)),
    ...IMPLICIT_FOREIGN_KEYS.filter((foreignKey) => tableNames.includes(foreignKey.childTable) && tableNames.includes(foreignKey.parentTable)),
  ];
  const importOrder = moveTableBefore(
    buildImportOrder(tableNames, foreignKeys),
    "report_dashboards",
    "report_dashboard_widgets"
  );
  const foreignKeysByChild = new Map();
  for (const foreignKey of foreignKeys) {
    if (!foreignKeysByChild.has(foreignKey.childTable)) {
      foreignKeysByChild.set(foreignKey.childTable, []);
    }
    foreignKeysByChild.get(foreignKey.childTable).push(foreignKey);
  }

  const idMaps = new Map();
  const summary = [];
  for (const tableName of importOrder) {
    const table = tablesByName.get(tableName);
    if (!table || !Array.isArray(table.rows) || table.rows.length === 0) continue;

    const existingColumns = await listColumns(connection, tableName);
    const columnsByName = new Map(existingColumns.map((column) => [column.columnName, column]));
    const autoColumns = new Set(existingColumns.filter((column) => column.extraInfo.includes("auto_increment")).map((column) => column.columnName));
    const insertColumns = existingColumns
      .map((column) => column.columnName)
      .filter((columnName) => !autoColumns.has(columnName) && table.columns.includes(columnName));
    const tableIdMap = new Map();

    for (const row of table.rows) {
      const insertEntries = insertColumns.map((columnName) => {
        const column = columnsByName.get(columnName);
        const businessValue = normalizeImportBusinessValue(
          tableName,
          columnName,
          buildColumnValue(tableName, row, columnName, targetProjectId, idMaps, foreignKeysByChild.get(tableName) || [], options.referenceMappings, options.runtimeFileMap),
          { mode: options.mode || "new", targetProjectId }
        );
        return {
          columnName,
          column,
          businessValue,
          value: normalizeInsertValue(
            businessValue,
            column
          ),
        };
      }).filter(({ businessValue, column }) => !shouldUseColumnDefault(businessValue, column));
      const rowInsertColumns = insertEntries.map(({ columnName }) => columnName);
      const values = insertEntries.map(({ value }) => value);
      const updateColumns = rowInsertColumns.filter(
        (columnName) => columnName !== "id" && columnName !== "project_id" && columnName !== "user_id" && columnName !== "created_at"
      );
      const duplicateUpdateSql = buildDuplicateStrategy(tableName) === "update" && updateColumns.length > 0
        ? `ON DUPLICATE KEY UPDATE ${updateColumns
          .map((columnName) => `${quoteIdentifier(columnName)} = VALUES(${quoteIdentifier(columnName)})`)
          .join(", ")}`
        : "";
      const [result] = await connection.query(
        `INSERT INTO ${quoteIdentifier(tableName)}
          (${rowInsertColumns.map(quoteIdentifier).join(", ")})
         VALUES (${rowInsertColumns.map(() => "?").join(", ")})
         ${duplicateUpdateSql}`,
        values
      );
      if (row.id !== undefined && row.id !== null) {
        const insertedIdColumnIndex = rowInsertColumns.indexOf("id");
        const insertedId = insertedIdColumnIndex >= 0 ? values[insertedIdColumnIndex] : result.insertId;
        tableIdMap.set(String(row.id), Number(insertedId || result.insertId || row.id));
      }
    }

    idMaps.set(tableName, tableIdMap);
    await backfillSelfReferences(
      connection,
      tableName,
      table,
      (foreignKeysByChild.get(tableName) || []).filter((foreignKey) => foreignKey.childTable === foreignKey.parentTable),
      tableIdMap
    );
    summary.push({ tableName, rowCount: table.rows.length });
  }
  await backfillForeignReferences(connection, tablesByName, foreignKeys, idMaps);
  await backfillQualityPolymorphicReferences(connection, tablesByName, idMaps);
  return summary;
}

function normalizeProjectCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

async function createImportedProject(connection, packagePayload, user, options = {}) {
  const sourceProject = packagePayload.project || {};
  const requestedCode = normalizeProjectCode(options.targetProjectCode);
  const baseCode = requestedCode || normalizeProjectCode(`${sourceProject.projectCode || "imported"}_import_${Date.now()}`);
  const projectName = String(options.targetProjectName || "").trim() || `${sourceProject.projectName || "导入项目"}-导入`;

  const [existingRows] = await connection.query(
    `SELECT id FROM project_spaces WHERE project_code = ? LIMIT 1`,
    [baseCode]
  );
  if (existingRows.length > 0) {
    throw new AppError("导入项目编码已存在，请重新填写项目编码", 409);
  }

  const [result] = await connection.query(
    `INSERT INTO project_spaces
      (project_name, project_code, project_type, description, owner_user_id, owner_name, status, resource_config_json, settings_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [
      projectName,
      baseCode,
      sourceProject.projectType || "standard",
      sourceProject.description || "",
      user?.sub || null,
      user?.displayName || user?.username || "system",
      JSON.stringify(sourceProject.resourceConfig || {}),
      JSON.stringify(sourceProject.settings || {}),
      user?.username || "system",
    ]
  );
  await connection.query(
    `INSERT IGNORE INTO project_members
      (project_id, user_id, project_role, permissions_json, status)
     VALUES (?, ?, 'owner', JSON_OBJECT('modules', JSON_ARRAY()), 'active')`,
    [result.insertId, user?.sub || null]
  );
  return Number(result.insertId);
}

async function importProject(packagePayload, options = {}, user = {}) {
  packagePayload = validatePackage(packagePayload);
  validatePackageDatabaseCapabilities(packagePayload);
  packagePayload = decryptPackageSensitiveData(packagePayload, options.packageKey);
  const mode = options.mode || "new";
  if (!["new", "overwrite"].includes(mode)) {
    throw new AppError("暂仅支持新建项目导入和覆盖导入", 400);
  }

  let targetProjectId = Number(options.targetProjectId || 0) || null;
  let automaticBackup = null;
  if (mode === "overwrite") {
    if (!targetProjectId) throw new AppError("覆盖导入必须选择目标项目", 400);
    const targetProject = await projectRepository.getProjectById(targetProjectId);
    if (!targetProject) throw new AppError("目标项目不存在", 404);
    if (!options.skipAutomaticBackup) {
      automaticBackup = await createProjectBackup(targetProjectId, user);
    }
  }
  const connection = await pool.getConnection();
  let restoredRuntimePaths = [];
  try {
    const preflight = await preflightImport(connection, packagePayload);
    await connection.beginTransaction();
    if (mode === "new") {
      targetProjectId = await createImportedProject(connection, packagePayload, user, options);
    } else {
      await projectRepository.deleteProjectScopedAssets(connection, targetProjectId);
    }

    const runtimeFileMap = buildRuntimeFileMap(packagePayload, targetProjectId);
    const tableSummary = await importRows(connection, packagePayload, targetProjectId, {
      mode,
      referenceMappings: preflight.referenceMappings,
      runtimeFileMap,
    });
    restoredRuntimePaths = await restoreRuntimeFiles([...runtimeFileMap.values()]);
    await connection.commit();

    const summary = {
      mode,
      tableCount: tableSummary.length,
      rowCount: tableSummary.reduce((sum, item) => sum + item.rowCount, 0),
      tables: tableSummary,
      integrity: {
        verified: Boolean(packagePayload.manifest.integrity),
        expectedRowCount: packagePayload.tables.reduce((sum, table) => sum + table.rows.length, 0),
        importedRowCount: tableSummary.reduce((sum, item) => sum + item.rowCount, 0),
        restoredRuntimeFileCount: restoredRuntimePaths.length,
      },
      warnings: preflight.warnings,
      automaticBackup,
    };
    await writeTransferLog({
      projectId: targetProjectId,
      operationType: "import",
      status: "success",
      operatorName: user.username || user.displayName || "system",
      packageVersion: packagePayload.manifest.exportFormatVersion,
      modules: packagePayload.manifest.modules || [],
      summary,
    });
    return { projectId: targetProjectId, summary };
  } catch (error) {
    await connection.rollback();
    await Promise.all(restoredRuntimePaths.map((filePath) => fs.unlink(filePath).catch(() => {})));
    await writeTransferLog({
      projectId: targetProjectId,
      operationType: "import",
      status: "failed",
      operatorName: user.username || user.displayName || "system",
      packageVersion: packagePayload.manifest?.exportFormatVersion || EXPORT_FORMAT_VERSION,
      modules: packagePayload.manifest?.modules || [],
      summary: { mode },
      errorMessage: error.message,
    });
    throw error;
  } finally {
    connection.release();
  }
}

async function previewImport(packagePayload) {
  packagePayload = validatePackage(packagePayload);
  const databaseTypes = validatePackageDatabaseCapabilities(packagePayload);
  const tables = packagePayload.tables.map((table) => ({
    tableName: table.tableName,
    moduleKey: table.moduleKey || inferModule(table.tableName).moduleKey,
    rowCount: Array.isArray(table.rows) ? table.rows.length : 0,
  }));
  return {
    sourceProject: packagePayload.manifest.sourceProject,
    exportedAt: packagePayload.manifest.exportedAt,
    sensitiveMode: packagePayload.manifest.sensitiveMode || "unknown",
    packageVersion: packagePayload.manifest.exportFormatVersion,
    sourcePackageVersion: packagePayload.manifest.compatibility?.adaptedFrom || packagePayload.manifest.exportFormatVersion,
    integrityVerified: Boolean(packagePayload.manifest.integrity),
    warnings: packagePayload.manifest.compatibility?.warnings || [],
    coverage: packagePayload.manifest.coverage || {
      configurationAssets: true,
      projectRuntimeFiles: false,
      externalPhysicalData: false,
    },
    modules: packagePayload.manifest.modules || buildModuleSummary(packagePayload.tables),
    tableCount: tables.length,
    rowCount: tables.reduce((sum, table) => sum + table.rowCount, 0),
    runtimeFileCount: (packagePayload.files || []).length,
    databaseTypes,
    tables,
  };
}

module.exports = {
  exportProject,
  importProject,
  previewImport,
  readPackageFile,
  listTransferLogs,
  createProjectBackup,
  listProjectBackups,
  getProjectBackup,
  MODULE_REGISTRY,
  __test__: {
    calculateSha256,
    buildPackageIntegrity,
    validatePackage,
    createPackageCryptoContext,
    getPackageCryptoKey,
    encryptPackageValue,
    decryptPackageValue,
    shouldExportRow,
    shouldUseColumnDefault,
    buildColumnValue,
    collectPackageDatabaseTypes,
    validatePackageDatabaseCapabilities,
  },
};
