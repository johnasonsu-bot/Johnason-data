const crypto = require("node:crypto");
const { projectError } = require("./project-policy");

const PROJECT_CODE_PATTERN = /^[a-z0-9_]+$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const PROJECT_TYPES = Object.freeze(["standard", "demo", "production", "sandbox", "government_data_project"]);
const PROJECT_STATUSES = Object.freeze(["active", "inactive"]);
const PROJECT_MEMBER_ROLES = Object.freeze(["owner", "developer", "operator", "viewer"]);
const MEMBER_STATUSES = Object.freeze(["active", "inactive"]);
const IMPORT_MODES = Object.freeze(["new", "overwrite"]);
const SENSITIVE_MODES = Object.freeze(["desensitized", "encrypted"]);
const ARTIFACT_VERSIONS = Object.freeze(["1.0.0", "2.0.0", "3.0.0"]);
const SECRET_KEY_PATTERN = /password|secret|token|credential|authorization|cookie|internal|private[_-]?key|public[_-]?key|access[_-]?key|storage[_-]?key|api[_-]?key/i;
const UNSAFE_DETAIL_VALUE_PATTERN = /(?:[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@)|(?:\bbearer\s+[A-Za-z0-9._~+/=-]+)|(?:(?:api|access|private|public|storage)[_-]?key|password|secret|token|credential)\s*[:=]|(?:\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{8,})/i;

function requestError(message = "项目空间请求无效") {
  return projectError(message, "PROJECT_REQUEST_INVALID", 400);
}

function invalidResult() {
  return projectError("项目空间返回结果无效", "PROJECT_PORT_INVALID_RESULT", 502);
}

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function inputRecord(value, label) {
  if (!isRecord(value)) throw requestError(`${label}无效`);
  return value;
}

function inputString(value, label, { min = 0, max = Infinity, allowEmpty = false } = {}) {
  if (typeof value !== "string") throw requestError(`${label}无效`);
  const normalized = value.trim();
  if ((!allowEmpty && normalized.length < Math.max(1, min)) || normalized.length < min || normalized.length > max) throw requestError(`${label}无效`);
  return normalized;
}

function inputEnum(value, allowed, label, fallback) {
  const normalized = value === undefined ? fallback : value;
  if (typeof normalized !== "string" || !allowed.includes(normalized)) throw requestError(`${label}无效`);
  return normalized;
}

function positiveInputId(value, label = "项目") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw requestError(`${label}标识无效`);
  return id;
}

function strictNestedRecord(value, allowedKeys, failure) {
  if (!isRecord(value)) throw failure();
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw failure();
  return value;
}

function nestedCount(value, failure) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw failure();
  return value;
}

function nestedBoolean(value, failure) {
  if (typeof value !== "boolean") throw failure();
  return value;
}

function nestedString(value, failure, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) throw failure();
  return value;
}

function resourceConfigSchema(value, failure) {
  const config = strictNestedRecord(value, ["maxDataSources", "maxConcurrentTasks", "schedulerEnabled"], failure);
  const dto = {};
  if (config.maxDataSources !== undefined) dto.maxDataSources = nestedCount(config.maxDataSources, failure);
  if (config.maxConcurrentTasks !== undefined) dto.maxConcurrentTasks = nestedCount(config.maxConcurrentTasks, failure);
  if (config.schedulerEnabled !== undefined) dto.schedulerEnabled = nestedBoolean(config.schedulerEnabled, failure);
  return dto;
}

function projectSettingsSchema(value, failure) {
  const settings = strictNestedRecord(value, ["defaultStoragePath"], failure);
  const dto = {};
  if (settings.defaultStoragePath !== undefined) dto.defaultStoragePath = nestedString(settings.defaultStoragePath, failure, { allowEmpty: true });
  return dto;
}

function permissionsSchema(value, failure) {
  const permissions = strictNestedRecord(value, ["modules"], failure);
  if (!Array.isArray(permissions.modules)) throw failure();
  return { modules: permissions.modules.map((name) => {
    const normalized = nestedString(name, failure).trim();
    if (normalized.length === 0) throw failure();
    return normalized;
  }) };
}

function projectBody(value) {
  const body = inputRecord(value, "项目内容");
  const projectName = inputString(body.projectName, "项目名称", { min: 2, max: 128 });
  const projectCode = inputString(body.projectCode, "项目编码", { min: 2, max: 64 });
  if (!PROJECT_CODE_PATTERN.test(projectCode)) throw requestError("项目编码无效");
  const normalized = {
    projectName,
    projectCode,
    projectType: inputEnum(body.projectType, PROJECT_TYPES, "项目类型", "standard"),
    status: inputEnum(body.status, PROJECT_STATUSES, "项目状态", "active"),
    resourceConfig: resourceConfigSchema(body.resourceConfig === undefined ? {} : body.resourceConfig, () => requestError("资源配置无效")),
    settings: projectSettingsSchema(body.settings === undefined ? {} : body.settings, () => requestError("项目设置无效")),
  };
  if (body.description !== undefined) normalized.description = inputString(body.description, "项目描述", { max: 1024, allowEmpty: true });
  if (body.ownerUserId !== undefined) normalized.ownerUserId = body.ownerUserId === null ? null : positiveInputId(body.ownerUserId, "项目所有者");
  if (body.ownerName !== undefined) normalized.ownerName = inputString(body.ownerName, "项目所有者名称", { max: 64, allowEmpty: true });
  return Object.freeze(normalized);
}

function memberBody(value) {
  const body = inputRecord(value, "项目成员");
  const rawPermissions = body.permissions === undefined ? { modules: [] } : body.permissions;
  const permissions = isRecord(rawPermissions) && rawPermissions.modules === undefined
    ? { ...rawPermissions, modules: [] }
    : rawPermissions;
  const normalizedPermissions = permissionsSchema(permissions, () => requestError("成员权限无效"));
  return Object.freeze({
    userId: positiveInputId(body.userId, "成员"),
    projectRole: inputEnum(body.projectRole, PROJECT_MEMBER_ROLES, "成员角色", "developer"),
    permissions: Object.freeze({ modules: Object.freeze(normalizedPermissions.modules) }),
    status: inputEnum(body.status, MEMBER_STATUSES, "成员状态", "active"),
  });
}

function fileArtifact(value) {
  const artifact = inputRecord(value, "导入文件元数据");
  const normalized = { name: inputString(artifact.name, "导入文件名", { min: 1, max: 512 }) };
  if (artifact.size !== undefined) {
    const size = Number(artifact.size);
    if (!Number.isSafeInteger(size) || size < 0) throw requestError("导入文件大小无效");
    normalized.size = size;
  }
  if (artifact.mediaType !== undefined) normalized.mediaType = inputString(artifact.mediaType, "导入文件类型", { min: 1, max: 255 });
  if (artifact.path !== undefined) normalized.path = inputString(artifact.path, "导入文件位置", { min: 1 });
  return Object.freeze(normalized);
}

function optionalProjectName(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  return inputString(value, label, { min: 2, max: 128 });
}

function optionalProjectCode(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const code = inputString(value, label, { min: 2, max: 64 });
  if (!PROJECT_CODE_PATTERN.test(code)) throw requestError(`${label}无效`);
  return code;
}

function importOptions(value) {
  const options = inputRecord(value || {}, "导入选项");
  const mode = inputEnum(options.mode, IMPORT_MODES, "导入模式", "new");
  const normalized = { mode };
  if (options.targetProjectId !== undefined && options.targetProjectId !== null && options.targetProjectId !== "") normalized.targetProjectId = positiveInputId(options.targetProjectId);
  if (mode === "overwrite" && !normalized.targetProjectId) throw requestError("覆盖导入必须选择目标项目");
  const targetProjectName = optionalProjectName(options.targetProjectName, "目标项目名称");
  const targetProjectCode = optionalProjectCode(options.targetProjectCode, "目标项目编码");
  if (targetProjectName !== undefined) normalized.targetProjectName = targetProjectName;
  if (targetProjectCode !== undefined) normalized.targetProjectCode = targetProjectCode;
  if (options.packageKey !== undefined) normalized.packageKey = inputString(options.packageKey, "项目包密钥", { max: 4096, allowEmpty: true });
  return Object.freeze(normalized);
}

function exportOptions(value) {
  const options = inputRecord(value || {}, "导出选项");
  const normalized = { sensitiveMode: inputEnum(options.sensitiveMode, SENSITIVE_MODES, "敏感信息模式", "desensitized") };
  if (options.packageKey !== undefined) normalized.packageKey = inputString(options.packageKey, "项目包密钥", { max: 4096, allowEmpty: true });
  return Object.freeze(normalized);
}

function strictResultRecord(value, allowedKeys) {
  if (!isRecord(value)) throw invalidResult();
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw invalidResult();
  return value;
}

function resultString(value, { allowEmpty = false, pattern } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0) || (pattern && !pattern.test(value))) throw invalidResult();
  return value;
}

function resultNullableString(value, options) {
  return value === null ? null : resultString(value, options);
}

function resultEnum(value, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) throw invalidResult();
  return value;
}

function resultId(value, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw invalidResult();
  return value;
}

function resultCount(value) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalidResult();
  return value;
}

function resultBoolean(value) {
  if (typeof value !== "boolean") throw invalidResult();
  return value;
}

function resultTimestamp(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw invalidResult();
    return value.toISOString();
  }
  if (typeof value !== "string" || value.length === 0 || Number.isNaN(Date.parse(value))) throw invalidResult();
  return value;
}

function resultStringArray(value) {
  if (!Array.isArray(value)) throw invalidResult();
  return value.map((item) => resultString(item));
}

function exactResourceConfig(value) {
  return resourceConfigSchema(value, invalidResult);
}

function exactProjectSettings(value) {
  return projectSettingsSchema(value, invalidResult);
}

function projectDto(value) {
  const project = strictResultRecord(value, [
    "id", "projectName", "projectCode", "projectType", "description", "ownerUserId", "ownerName", "status",
    "resourceConfig", "settings", "memberCount", "createdBy", "createdAt", "updatedAt",
  ]);
  const dto = {
    id: resultId(project.id),
    projectName: resultString(project.projectName),
    projectCode: resultString(project.projectCode, { pattern: PROJECT_CODE_PATTERN }),
    status: resultEnum(project.status, PROJECT_STATUSES),
  };
  if (project.projectType !== undefined) dto.projectType = resultEnum(project.projectType, PROJECT_TYPES);
  if (project.description !== undefined) dto.description = resultNullableString(project.description, { allowEmpty: true });
  if (project.ownerUserId !== undefined) dto.ownerUserId = resultId(project.ownerUserId, { nullable: true });
  if (project.ownerName !== undefined) dto.ownerName = resultNullableString(project.ownerName, { allowEmpty: true });
  if (project.resourceConfig !== undefined) dto.resourceConfig = exactResourceConfig(project.resourceConfig);
  if (project.settings !== undefined) dto.settings = exactProjectSettings(project.settings);
  if (project.memberCount !== undefined) dto.memberCount = resultCount(project.memberCount);
  if (project.createdBy !== undefined) dto.createdBy = resultString(project.createdBy);
  if (project.createdAt !== undefined) dto.createdAt = resultTimestamp(project.createdAt);
  if (project.updatedAt !== undefined) dto.updatedAt = resultTimestamp(project.updatedAt);
  return dto;
}

function permissionsDto(value) {
  return permissionsSchema(value, invalidResult);
}

function memberDto(value) {
  const member = strictResultRecord(value, ["id", "projectId", "userId", "username", "displayName", "projectRole", "permissions", "status", "createdAt", "updatedAt"]);
  const dto = {
    projectId: resultId(member.projectId),
    userId: resultId(member.userId),
    projectRole: resultEnum(member.projectRole, PROJECT_MEMBER_ROLES),
    status: resultEnum(member.status, MEMBER_STATUSES),
  };
  if (member.id !== undefined) dto.id = resultId(member.id);
  if (member.username !== undefined) dto.username = resultNullableString(member.username);
  if (member.displayName !== undefined) dto.displayName = resultNullableString(member.displayName, { allowEmpty: true });
  if (member.permissions !== undefined) dto.permissions = permissionsDto(member.permissions);
  if (member.createdAt !== undefined) dto.createdAt = resultTimestamp(member.createdAt);
  if (member.updatedAt !== undefined) dto.updatedAt = resultTimestamp(member.updatedAt);
  return dto;
}

function projectListDto(value) {
  if (!Array.isArray(value)) throw invalidResult();
  return value.map(projectDto);
}

function projectContextDto(value) {
  const context = strictResultRecord(value, ["project", "member"]);
  return { project: projectDto(context.project), member: memberDto(context.member) };
}

function defaultProjectDto(value) {
  const result = strictResultRecord(value, ["defaultProjectId", "project"]);
  return { defaultProjectId: resultId(result.defaultProjectId), project: projectDto(result.project) };
}

function detailDto(value) {
  const detail = strictResultRecord(value, [
    "id", "projectName", "projectCode", "projectType", "description", "ownerUserId", "ownerName", "status",
    "resourceConfig", "settings", "memberCount", "createdBy", "createdAt", "updatedAt", "members",
  ]);
  if (!Array.isArray(detail.members)) throw invalidResult();
  const { members, ...project } = detail;
  return { ...projectDto(project), members: members.map(memberDto) };
}

function removeDto(value) {
  const result = strictResultRecord(value, ["projectId", "deleted"]);
  if (result.deleted !== true) throw invalidResult();
  return { projectId: resultId(result.projectId), deleted: true };
}

function removeMemberDto(value) {
  const result = strictResultRecord(value, ["projectId", "userId"]);
  return { projectId: resultId(result.projectId), userId: resultId(result.userId) };
}

function moduleSummaryDto(value) {
  const summary = strictResultRecord(value, ["moduleKey", "moduleName", "tableCount", "rowCount"]);
  return {
    moduleKey: resultString(summary.moduleKey), moduleName: resultString(summary.moduleName),
    tableCount: resultCount(summary.tableCount), rowCount: resultCount(summary.rowCount),
  };
}

function backupDto(value, { includeCreator }) {
  const allowed = ["id", "projectId", "packageVersion", "packageSha256", "createdAt"];
  if (includeCreator) allowed.push("createdBy");
  const backup = strictResultRecord(value, allowed);
  const dto = {
    id: resultId(backup.id), projectId: resultId(backup.projectId), packageVersion: resultString(backup.packageVersion),
    packageSha256: backup.packageSha256 === null ? null : resultString(backup.packageSha256, { pattern: SHA256_PATTERN }),
    createdAt: resultTimestamp(backup.createdAt),
  };
  if (includeCreator) dto.createdBy = resultString(backup.createdBy);
  return dto;
}

function integritySummaryDto(value) {
  const integrity = strictResultRecord(value, ["verified", "expectedRowCount", "importedRowCount", "restoredRuntimeFileCount"]);
  return {
    verified: resultBoolean(integrity.verified), expectedRowCount: resultCount(integrity.expectedRowCount),
    importedRowCount: resultCount(integrity.importedRowCount), restoredRuntimeFileCount: resultCount(integrity.restoredRuntimeFileCount),
  };
}

function importTableSummaryDto(value) {
  const table = strictResultRecord(value, ["tableName", "rowCount"]);
  return { tableName: resultString(table.tableName, { pattern: SAFE_IDENTIFIER_PATTERN }), rowCount: resultCount(table.rowCount) };
}

function transferSummaryDto(value) {
  const summary = strictResultRecord(value, ["mode", "tableCount", "rowCount", "runtimeFileCount", "tables", "integrity", "warnings", "automaticBackup"]);
  const dto = {};
  if (summary.mode !== undefined) dto.mode = resultEnum(summary.mode, IMPORT_MODES);
  if (summary.tableCount !== undefined) dto.tableCount = resultCount(summary.tableCount);
  if (summary.rowCount !== undefined) dto.rowCount = resultCount(summary.rowCount);
  if (summary.runtimeFileCount !== undefined) dto.runtimeFileCount = resultCount(summary.runtimeFileCount);
  if (summary.tables !== undefined) {
    if (!Array.isArray(summary.tables)) throw invalidResult();
    dto.tables = summary.tables.map(importTableSummaryDto);
  }
  if (summary.integrity !== undefined) dto.integrity = integritySummaryDto(summary.integrity);
  if (summary.warnings !== undefined) dto.warnings = resultStringArray(summary.warnings);
  if (summary.automaticBackup !== undefined) dto.automaticBackup = summary.automaticBackup === null ? null : backupDto(summary.automaticBackup, { includeCreator: false });
  return dto;
}

function transferLogDto(value) {
  const log = strictResultRecord(value, ["id", "projectId", "operationType", "packageVersion", "modules", "status", "summary", "errorMessage", "operatorName", "createdAt", "updatedAt"]);
  if (!Array.isArray(log.modules)) throw invalidResult();
  return {
    id: resultId(log.id), projectId: resultId(log.projectId, { nullable: true }), operationType: resultEnum(log.operationType, ["export", "import"]),
    packageVersion: resultString(log.packageVersion), modules: log.modules.map(moduleSummaryDto), status: resultEnum(log.status, ["running", "success", "failed"]),
    summary: transferSummaryDto(log.summary), errorMessage: log.errorMessage === null ? null : resultString(log.errorMessage, { allowEmpty: true }),
    operatorName: resultString(log.operatorName), createdAt: resultTimestamp(log.createdAt), updatedAt: resultTimestamp(log.updatedAt),
  };
}

function transferLogListDto(value) {
  if (!Array.isArray(value)) throw invalidResult();
  return value.map(transferLogDto);
}

function sourceProjectDto(value) {
  const project = strictResultRecord(value, ["id", "code", "name", "type"]);
  return { id: resultId(project.id), code: resultString(project.code, { pattern: PROJECT_CODE_PATTERN }), name: resultString(project.name), type: resultEnum(project.type, PROJECT_TYPES) };
}

function coverageDto(value) {
  const coverage = strictResultRecord(value, ["configurationAssets", "projectRuntimeFiles", "externalPhysicalData", "sensitiveConfiguration"]);
  const dto = {
    configurationAssets: resultBoolean(coverage.configurationAssets), projectRuntimeFiles: resultBoolean(coverage.projectRuntimeFiles),
    externalPhysicalData: resultBoolean(coverage.externalPhysicalData),
  };
  if (coverage.sensitiveConfiguration !== undefined) dto.sensitiveConfiguration = resultEnum(coverage.sensitiveConfiguration, SENSITIVE_MODES);
  return dto;
}

function previewTableDto(value) {
  const table = strictResultRecord(value, ["tableName", "moduleKey", "rowCount"]);
  return { tableName: resultString(table.tableName, { pattern: SAFE_IDENTIFIER_PATTERN }), moduleKey: resultString(table.moduleKey), rowCount: resultCount(table.rowCount) };
}

function previewDto(value) {
  const preview = strictResultRecord(value, [
    "sourceProject", "exportedAt", "sensitiveMode", "packageVersion", "sourcePackageVersion", "integrityVerified", "warnings",
    "coverage", "modules", "tableCount", "rowCount", "runtimeFileCount", "databaseTypes", "tables",
  ]);
  if (!Array.isArray(preview.modules) || !Array.isArray(preview.tables)) throw invalidResult();
  return {
    sourceProject: sourceProjectDto(preview.sourceProject), exportedAt: resultTimestamp(preview.exportedAt),
    sensitiveMode: resultEnum(preview.sensitiveMode, [...SENSITIVE_MODES, "unknown"]), packageVersion: resultString(preview.packageVersion),
    sourcePackageVersion: resultString(preview.sourcePackageVersion), integrityVerified: resultBoolean(preview.integrityVerified),
    warnings: resultStringArray(preview.warnings), coverage: coverageDto(preview.coverage), modules: preview.modules.map(moduleSummaryDto),
    tableCount: resultCount(preview.tableCount), rowCount: resultCount(preview.rowCount), runtimeFileCount: resultCount(preview.runtimeFileCount),
    databaseTypes: resultStringArray(preview.databaseTypes), tables: preview.tables.map(previewTableDto),
  };
}

function importResultDto(value) {
  const result = strictResultRecord(value, ["projectId", "summary"]);
  const summary = transferSummaryDto(result.summary);
  for (const required of ["mode", "tableCount", "rowCount", "tables", "integrity", "warnings", "automaticBackup"]) {
    if (!Object.hasOwn(summary, required)) throw invalidResult();
  }
  return { projectId: resultId(result.projectId), summary };
}

function jsonValue(value, ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidResult();
    return;
  }
  if (value instanceof Date || Buffer.isBuffer(value) || typeof value !== "object") throw invalidResult();
  if (ancestors.has(value)) throw invalidResult();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) for (const item of value) jsonValue(item, ancestors);
    else if (!isRecord(value)) throw invalidResult();
    else for (const item of Object.values(value)) jsonValue(item, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

function canonicalJsonValue(value, ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidResult();
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw invalidResult();
    return value.toISOString();
  }
  if (Buffer.isBuffer(value) || typeof value !== "object") throw invalidResult();
  if (ancestors.has(value)) throw invalidResult();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => canonicalJsonValue(item, ancestors));
    if (!isRecord(value)) throw invalidResult();
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalJsonValue(value[key], ancestors);
      return result;
    }, {});
  } finally {
    ancestors.delete(value);
  }
}

function base64(value) {
  resultString(value);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw invalidResult();
  return value;
}

function encryptedEnvelope(value) {
  const envelope = strictResultRecord(value, ["__medataEncrypted", "ivBase64", "authTagBase64", "ciphertextBase64"]);
  if (envelope.__medataEncrypted !== true) throw invalidResult();
  base64(envelope.ivBase64);
  base64(envelope.authTagBase64);
  base64(envelope.ciphertextBase64);
}

function protectedJsonValue(value, sensitiveMode, key = "", ancestors = new WeakSet()) {
  if (SECRET_KEY_PATTERN.test(key)) {
    if (value === null || value === "" || value === false || value === 0) return;
    if (sensitiveMode !== "encrypted") throw invalidResult();
    encryptedEnvelope(value);
    return;
  }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    const text = value.trim();
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        protectedJsonValue(JSON.parse(text), sensitiveMode, "", ancestors);
      } catch (error) {
        if (error?.code === "PROJECT_PORT_INVALID_RESULT") throw error;
      }
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidResult();
    return;
  }
  if (value instanceof Date || Buffer.isBuffer(value) || typeof value !== "object") throw invalidResult();
  if (ancestors.has(value)) throw invalidResult();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) for (const item of value) protectedJsonValue(item, sensitiveMode, "", ancestors);
    else if (!isRecord(value)) throw invalidResult();
    else for (const [entryKey, item] of Object.entries(value)) protectedJsonValue(item, sensitiveMode, entryKey, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((result, key) => { result[key] = stableValue(value[key]); return result; }, {});
  return value;
}

function calculateSha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function artifactTable(value, sensitiveMode) {
  const table = strictResultRecord(value, ["tableName", "moduleKey", "columns", "rows"]);
  resultString(table.tableName, { pattern: SAFE_IDENTIFIER_PATTERN });
  resultString(table.moduleKey);
  const columns = resultStringArray(table.columns);
  if (new Set(columns).size !== columns.length || columns.some((column) => !SAFE_IDENTIFIER_PATTERN.test(column))) throw invalidResult();
  if (!Array.isArray(table.rows)) throw invalidResult();
  for (const row of table.rows) {
    if (!isRecord(row) || Object.keys(row).some((key) => !columns.includes(key))) throw invalidResult();
    protectedJsonValue(row, sensitiveMode);
  }
}

function artifactManifest(value) {
  const manifest = strictResultRecord(value, [
    "exportFormatVersion", "appVersion", "packageType", "exportedAt", "exportedBy", "sensitiveMode", "sensitiveEncryption",
    "sourceProject", "modules", "compatibility", "coverage", "integrity",
  ]);
  const version = resultEnum(manifest.exportFormatVersion, ARTIFACT_VERSIONS);
  if (manifest.packageType !== "medata-project-assets") throw invalidResult();
  resultString(manifest.appVersion);
  resultTimestamp(manifest.exportedAt);
  resultString(manifest.exportedBy);
  const sensitiveMode = resultEnum(manifest.sensitiveMode, SENSITIVE_MODES);
  sourceProjectDto(manifest.sourceProject);
  if (!Array.isArray(manifest.modules)) throw invalidResult();
  manifest.modules.forEach(moduleSummaryDto);
  const compatibility = strictResultRecord(manifest.compatibility, ["minimumImportVersion", "supportedLegacyVersions", "adaptedFrom", "warnings"]);
  resultEnum(compatibility.minimumImportVersion, ARTIFACT_VERSIONS);
  if (!Array.isArray(compatibility.supportedLegacyVersions)) throw invalidResult();
  compatibility.supportedLegacyVersions.forEach((item) => resultEnum(item, ARTIFACT_VERSIONS));
  if (compatibility.adaptedFrom !== undefined) resultEnum(compatibility.adaptedFrom, ARTIFACT_VERSIONS);
  if (compatibility.warnings !== undefined) resultStringArray(compatibility.warnings);
  coverageDto(manifest.coverage);
  if (sensitiveMode === "encrypted") {
    const encryption = strictResultRecord(manifest.sensitiveEncryption, ["algorithm", "keyDerivation", "iterations", "saltBase64"]);
    if (encryption.algorithm !== "aes-256-gcm" || encryption.keyDerivation !== "pbkdf2-sha256") throw invalidResult();
    if (!Number.isSafeInteger(encryption.iterations) || encryption.iterations < 100000 || encryption.iterations > 1000000) throw invalidResult();
    base64(encryption.saltBase64);
  } else if (manifest.sensitiveEncryption !== undefined) throw invalidResult();
  if (version !== "1.0.0" && manifest.integrity === undefined) throw invalidResult();
  return { version, sensitiveMode };
}

function artifactProject(value, sensitiveMode) {
  const project = strictResultRecord(value, ["projectName", "projectCode", "projectType", "description", "ownerName", "status", "resourceConfig", "settings"]);
  resultString(project.projectName);
  resultString(project.projectCode, { pattern: PROJECT_CODE_PATTERN });
  resultEnum(project.projectType, PROJECT_TYPES);
  resultString(project.description, { allowEmpty: true });
  resultString(project.ownerName, { allowEmpty: true });
  resultEnum(project.status, PROJECT_STATUSES);
  protectedJsonValue(project.resourceConfig, sensitiveMode);
  protectedJsonValue(project.settings, sensitiveMode);
}

function artifactSchema(value) {
  const schema = strictResultRecord(value, ["importOrder", "foreignKeys"]);
  const importOrder = resultStringArray(schema.importOrder);
  if (importOrder.some((name) => !SAFE_IDENTIFIER_PATTERN.test(name))) throw invalidResult();
  if (!Array.isArray(schema.foreignKeys)) throw invalidResult();
  for (const value of schema.foreignKeys) {
    const foreignKey = strictResultRecord(value, ["childTable", "childColumn", "parentTable", "parentColumn"]);
    for (const item of Object.values(foreignKey)) resultString(item, { pattern: SAFE_IDENTIFIER_PATTERN });
  }
}

function artifactReferences(value) {
  const references = strictResultRecord(value, ["users", "modelProviders"]);
  if (!Array.isArray(references.users) || !Array.isArray(references.modelProviders)) throw invalidResult();
  for (const value of references.users) {
    const user = strictResultRecord(value, ["id", "username", "displayName", "required"]);
    resultId(user.id); resultString(user.username); resultString(user.displayName, { allowEmpty: true });
    if (user.required !== undefined) resultBoolean(user.required);
  }
  for (const value of references.modelProviders) {
    const provider = strictResultRecord(value, ["id", "configCode", "configName", "modelName"]);
    resultId(provider.id); resultString(provider.configCode); resultString(provider.configName); resultString(provider.modelName);
  }
}

function artifactFile(value) {
  const file = strictResultRecord(value, ["tableName", "rowId", "columnName", "relativePath", "size", "sha256", "contentBase64"]);
  resultString(file.tableName, { pattern: SAFE_IDENTIFIER_PATTERN });
  if (!(["string", "number"].includes(typeof file.rowId)) || String(file.rowId).length === 0) throw invalidResult();
  resultString(file.columnName, { pattern: SAFE_IDENTIFIER_PATTERN });
  resultString(file.relativePath);
  const size = resultCount(file.size);
  resultString(file.sha256, { pattern: SHA256_PATTERN });
  base64(file.contentBase64);
  const content = Buffer.from(file.contentBase64, "base64");
  if (content.length !== size || crypto.createHash("sha256").update(content).digest("hex") !== file.sha256) throw invalidResult();
}

function validateArtifactIntegrity(artifact, version) {
  if (artifact.manifest.integrity === undefined) {
    if (version !== "1.0.0") throw invalidResult();
    return;
  }
  const integrity = strictResultRecord(artifact.manifest.integrity, ["algorithm", "payloadSha256", "tables"]);
  if (integrity.algorithm !== "sha256") throw invalidResult();
  resultString(integrity.payloadSha256, { pattern: SHA256_PATTERN });
  if (!Array.isArray(integrity.tables) || integrity.tables.length !== artifact.tables.length) throw invalidResult();
  const byName = new Map();
  for (const value of integrity.tables) {
    const table = strictResultRecord(value, ["tableName", "rowCount", "sha256"]);
    resultString(table.tableName, { pattern: SAFE_IDENTIFIER_PATTERN });
    resultCount(table.rowCount);
    resultString(table.sha256, { pattern: SHA256_PATTERN });
    if (byName.has(table.tableName)) throw invalidResult();
    byName.set(table.tableName, table);
  }
  for (const table of artifact.tables) {
    const expected = byName.get(table.tableName);
    const hash = calculateSha256({ tableName: table.tableName, columns: table.columns, rows: table.rows });
    if (!expected || expected.rowCount !== table.rows.length || expected.sha256 !== hash) throw invalidResult();
  }
  const withoutIntegrity = { ...artifact, manifest: { ...artifact.manifest } };
  delete withoutIntegrity.manifest.integrity;
  if (integrity.payloadSha256 !== calculateSha256(withoutIntegrity)) throw invalidResult();
}

function artifactDto(value) {
  const artifact = strictResultRecord(canonicalJsonValue(value), ["manifest", "project", "schema", "references", "tables", "files"]);
  const { version, sensitiveMode } = artifactManifest(artifact.manifest);
  artifactProject(artifact.project, sensitiveMode);
  artifactSchema(artifact.schema);
  artifactReferences(artifact.references);
  if (!Array.isArray(artifact.tables) || !Array.isArray(artifact.files)) throw invalidResult();
  artifact.tables.forEach((table) => artifactTable(table, sensitiveMode));
  artifact.files.forEach(artifactFile);
  validateArtifactIntegrity(artifact, version);
  jsonValue(artifact);
  return artifact;
}

const SAFE_DETAIL_FIELDS = Object.freeze([
  "projectId", "backupId", "userId", "projectName", "projectCode", "projectType", "description", "ownerUserId", "ownerName",
  "status", "resourceConfig", "settings", "projectRole", "permissions", "mode", "targetProjectId", "targetProjectName",
  "targetProjectCode", "packageKey", "sensitiveMode", "file", "name", "size", "mediaType", "path", "packageVersion", "integrity", "databaseType",
]);
const SAFE_DETAIL_RESOURCES = Object.freeze(["project", "member", "backup", "asset-package", "transfer-log"]);
const SAFE_SUPPORTED_VALUES = new Set([
  ...PROJECT_TYPES, ...PROJECT_STATUSES, ...PROJECT_MEMBER_ROLES, ...IMPORT_MODES, ...SENSITIVE_MODES, ...ARTIFACT_VERSIONS,
  "sha256", "aes-256-gcm", "pbkdf2-sha256",
]);

function safeDetailString(value, allowed) {
  if (typeof value !== "string" || !SAFE_IDENTIFIER_PATTERN.test(value) || UNSAFE_DETAIL_VALUE_PATTERN.test(value) || !allowed.includes(value)) return undefined;
  return value;
}

function safeDetailId(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

const PUBLIC_PORT_ERRORS = Object.freeze({
  PROJECT_CONFLICT: Object.freeze({ message: "项目空间资源冲突", statusCode: 409 }),
  PROJECT_NOT_FOUND: Object.freeze({ message: "项目空间资源不存在", statusCode: 404 }),
  PROJECT_OPERATION_INVALID: Object.freeze({ message: "项目空间操作无效", statusCode: 400 }),
  PROJECT_OPERATION_FAILED: Object.freeze({ message: "项目空间操作失败", statusCode: 500 }),
});

function classifyPortError(error) {
  const sourceCode = String(error?.code || "").toUpperCase();
  if (PUBLIC_PORT_ERRORS[sourceCode]) return sourceCode;
  if (["CONFLICT", "ER_DUP_ENTRY"].includes(sourceCode) || Number(error?.statusCode) === 409) return "PROJECT_CONFLICT";
  if (sourceCode === "NOT_FOUND" || Number(error?.statusCode) === 404) return "PROJECT_NOT_FOUND";
  if (["BAD_REQUEST", "VALIDATION_ERROR"].includes(sourceCode) || [400, 422].includes(Number(error?.statusCode))) return "PROJECT_OPERATION_INVALID";
  return "PROJECT_OPERATION_FAILED";
}

function publicErrorDetails(code, source) {
  if (!isRecord(source)) return {};
  const details = {};
  if (["PROJECT_CONFLICT", "PROJECT_OPERATION_INVALID"].includes(code)) {
    const field = safeDetailString(source.field, SAFE_DETAIL_FIELDS);
    if (field !== undefined) details.field = field;
  }
  if (code === "PROJECT_NOT_FOUND") {
    const resource = safeDetailString(source.resource, SAFE_DETAIL_RESOURCES);
    if (resource !== undefined) details.resource = resource;
  }
  if (["PROJECT_CONFLICT", "PROJECT_NOT_FOUND"].includes(code)) {
    for (const key of ["projectId", "backupId", "userId"]) {
      const id = safeDetailId(source[key]);
      if (id !== undefined) details[key] = id;
    }
  }
  if (code === "PROJECT_OPERATION_INVALID" && Array.isArray(source.supported)) {
    const supported = source.supported.filter((value) => typeof value === "string" && SAFE_SUPPORTED_VALUES.has(value) && !UNSAFE_DETAIL_VALUE_PATTERN.test(value));
    if (supported.length > 0) details.supported = [...new Set(supported)];
  }
  return details;
}

function mappedPortError(error) {
  const code = classifyPortError(error);
  const specification = PUBLIC_PORT_ERRORS[code];
  return projectError(specification.message, code, specification.statusCode, Object.freeze(publicErrorDetails(code, error?.details)));
}

const projectOperationSchemas = Object.freeze({
  detail: Object.freeze({ action: "read", parseInput: (id) => [positiveInputId(id)], parseResult: detailDto }),
  create: Object.freeze({ action: "write", parseInput: (body, actor) => [projectBody(body), actor], parseResult: projectDto }),
  update: Object.freeze({ action: "write", parseInput: (id, body) => [positiveInputId(id), projectBody(body)], parseResult: projectDto }),
  remove: Object.freeze({ action: "write", parseInput: (id) => [positiveInputId(id)], parseResult: removeDto }),
  setStatus: Object.freeze({ action: "write", parseInput: (id, status) => [positiveInputId(id), inputEnum(status, PROJECT_STATUSES, "项目状态")], parseResult: projectDto }),
  upsertMember: Object.freeze({ action: "write", parseInput: (id, body) => [positiveInputId(id), memberBody(body)], parseResult: memberDto }),
  removeMember: Object.freeze({ action: "write", parseInput: (id, userId) => [positiveInputId(id), positiveInputId(userId, "成员")], parseResult: removeMemberDto }),
  listTransferLogs: Object.freeze({ action: "read", parseInput: (options = {}) => { const query = inputRecord(options, "日志查询"); return [query.projectId === undefined || query.projectId === null || query.projectId === "" ? null : positiveInputId(query.projectId)]; }, parseResult: transferLogListDto }),
  previewImport: Object.freeze({ action: "write", parseInput: (file) => [fileArtifact(file)], parseResult: previewDto }),
  importAssets: Object.freeze({ action: "write", parseInput: (file, options, actor) => [fileArtifact(file), importOptions(options), actor], parseResult: importResultDto }),
  listBackups: Object.freeze({ action: "read", parseInput: (id) => [positiveInputId(id)], parseResult: (value) => { if (!Array.isArray(value)) throw invalidResult(); return value.map((item) => backupDto(item, { includeCreator: true })); } }),
  createBackup: Object.freeze({ action: "write", parseInput: (id, actor) => [positiveInputId(id), actor], parseResult: (value) => backupDto(value, { includeCreator: false }) }),
  downloadBackup: Object.freeze({ action: "read", artifact: true, parseInput: (id, backupId) => [positiveInputId(id), positiveInputId(backupId, "备份")], parseResult: artifactDto }),
  exportAssets: Object.freeze({ action: "read", artifact: true, parseInput: (id, options = {}, actor) => [positiveInputId(id), exportOptions(options), actor], parseResult: artifactDto }),
});

const projectServiceSchemas = Object.freeze({
  listMy: Object.freeze({ method: "listMyProjects", parseResult: projectListDto }),
  list: Object.freeze({ method: "listProjects", action: "read", parseResult: projectListDto }),
  current: Object.freeze({ method: "getUserDefaultProjectId", parseResult: (value) => value === null ? null : resultId(value) }),
  resolve: Object.freeze({ method: "resolveRequestProject", parseResult: projectContextDto }),
  use: Object.freeze({ method: "resolveRequestProject", parseResult: projectContextDto }),
  accessCheck: Object.freeze({ method: "resolveRequestProject", parseResult: projectContextDto }),
  setDefault: Object.freeze({ method: "setDefaultProject", action: "write", parseResult: defaultProjectDto }),
});

module.exports = { mappedPortError, projectOperationSchemas, projectServiceSchemas };
