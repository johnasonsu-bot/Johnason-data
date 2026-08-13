const { projectError } = require("./project-policy");

const PROJECT_CODE_PATTERN = /^[a-z0-9_]+$/;
const PROJECT_TYPES = Object.freeze(["standard", "demo", "production", "sandbox", "government_data_project"]);
const PROJECT_STATUSES = Object.freeze(["active", "inactive"]);
const PROJECT_MEMBER_ROLES = Object.freeze(["owner", "developer", "operator", "viewer"]);
const MEMBER_STATUSES = Object.freeze(["active", "inactive"]);
const IMPORT_MODES = Object.freeze(["new", "overwrite"]);
const SENSITIVE_MODES = Object.freeze(["desensitized", "encrypted"]);
const SECRET_KEY_PATTERN = /password|secret|token|credential|authorization|cookie|internal|private[_-]?key|public[_-]?key|access[_-]?key|storage[_-]?key|api[_-]?key/i;
const OMIT = Symbol("omit");

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
  if ((!allowEmpty && normalized.length < Math.max(1, min)) || normalized.length < min || normalized.length > max) {
    throw requestError(`${label}无效`);
  }
  return normalized;
}

function inputEnum(value, allowed, label, fallback) {
  const normalized = value === undefined ? fallback : value;
  if (typeof normalized !== "string" || !allowed.includes(normalized)) throw requestError(`${label}无效`);
  return normalized;
}

function positiveId(value, label = "项目") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw requestError(`${label}标识无效`);
  return id;
}

function optionalInputObject(value, label, fallback = {}) {
  if (value === undefined) return fallback;
  return { ...inputRecord(value, label) };
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
    resourceConfig: optionalInputObject(body.resourceConfig, "资源配置"),
    settings: optionalInputObject(body.settings, "项目设置"),
  };
  if (body.description !== undefined) normalized.description = inputString(body.description, "项目描述", { max: 1024, allowEmpty: true });
  if (body.ownerUserId !== undefined) normalized.ownerUserId = body.ownerUserId === null ? null : positiveId(body.ownerUserId, "项目所有者");
  if (body.ownerName !== undefined) normalized.ownerName = inputString(body.ownerName, "项目所有者名称", { max: 64, allowEmpty: true });
  return Object.freeze(normalized);
}

function memberBody(value) {
  const body = inputRecord(value, "项目成员");
  const permissions = optionalInputObject(body.permissions, "成员权限", { modules: [] });
  const modules = permissions.modules === undefined ? [] : permissions.modules;
  if (!Array.isArray(modules)) throw requestError("成员权限无效");
  const normalizedModules = modules.map((moduleName) => inputString(moduleName, "成员权限模块", { min: 1 }));
  return Object.freeze({
    userId: positiveId(body.userId, "成员"),
    projectRole: inputEnum(body.projectRole, PROJECT_MEMBER_ROLES, "成员角色", "developer"),
    permissions: Object.freeze({ modules: Object.freeze(normalizedModules) }),
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
  if (options.targetProjectId !== undefined && options.targetProjectId !== null && options.targetProjectId !== "") {
    normalized.targetProjectId = positiveId(options.targetProjectId);
  }
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

function resultRecord(value) {
  if (!isRecord(value)) throw invalidResult();
  return value;
}

function resultString(value, { allowEmpty = false, pattern } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0) || (pattern && !pattern.test(value))) throw invalidResult();
  return value;
}

function resultEnum(value, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) throw invalidResult();
  return value;
}

function resultId(value, { nullable = false } = {}) {
  if (nullable && value === null) return value;
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
    return value;
  }
  if (typeof value !== "string" || value.length === 0 || Number.isNaN(Date.parse(value))) throw invalidResult();
  return value;
}

function resultStringArray(value) {
  if (!Array.isArray(value)) throw invalidResult();
  for (const item of value) resultString(item);
  return value;
}

function resultProjectType(value) {
  return resultEnum(value, PROJECT_TYPES);
}

function validateProjectRecord(value) {
  const project = resultRecord(value);
  resultId(project.id);
  resultString(project.projectName);
  resultString(project.projectCode, { pattern: PROJECT_CODE_PATTERN });
  resultProjectType(project.projectType);
  resultString(project.description, { allowEmpty: true });
  resultId(project.ownerUserId, { nullable: true });
  resultString(project.ownerName, { allowEmpty: true });
  resultEnum(project.status, PROJECT_STATUSES);
  resultRecord(project.resourceConfig);
  resultRecord(project.settings);
  if (project.memberCount !== undefined) resultCount(project.memberCount);
  resultString(project.createdBy);
  resultTimestamp(project.createdAt);
  resultTimestamp(project.updatedAt);
  return project;
}

function validateMemberRecord(value) {
  const member = resultRecord(value);
  if (member.id !== undefined) resultId(member.id);
  resultId(member.projectId);
  resultId(member.userId);
  if (member.username !== undefined && member.username !== null) resultString(member.username);
  if (member.displayName !== undefined && member.displayName !== null) resultString(member.displayName, { allowEmpty: true });
  resultEnum(member.projectRole, PROJECT_MEMBER_ROLES);
  const permissions = resultRecord(member.permissions);
  resultStringArray(permissions.modules);
  resultEnum(member.status, MEMBER_STATUSES);
  if (member.createdAt !== undefined) resultTimestamp(member.createdAt);
  if (member.updatedAt !== undefined) resultTimestamp(member.updatedAt);
  return member;
}

function validateDetailResult(value) {
  const detail = validateProjectRecord(value);
  if (!Array.isArray(detail.members)) throw invalidResult();
  for (const member of detail.members) validateMemberRecord(member);
  return detail;
}

function validateCreateResult(value) {
  return validateProjectRecord(value);
}

function validateUpdateResult(value) {
  return validateProjectRecord(value);
}

function validateRemoveResult(value) {
  const result = resultRecord(value);
  resultId(result.projectId);
  if (result.deleted !== true) throw invalidResult();
  return result;
}

function validateSetStatusResult(value) {
  return validateProjectRecord(value);
}

function validateUpsertMemberResult(value) {
  return validateMemberRecord(value);
}

function validateRemoveMemberResult(value) {
  const result = resultRecord(value);
  resultId(result.projectId);
  resultId(result.userId);
  return result;
}

function validateTransferLog(value) {
  const log = resultRecord(value);
  resultId(log.id);
  resultId(log.projectId, { nullable: true });
  resultEnum(log.operationType, ["export", "import"]);
  resultString(log.packageVersion);
  if (!Array.isArray(log.modules)) throw invalidResult();
  resultEnum(log.status, ["running", "success", "failed"]);
  resultRecord(log.summary);
  if (log.errorMessage !== null && log.errorMessage !== undefined) resultString(log.errorMessage, { allowEmpty: true });
  resultString(log.operatorName);
  resultTimestamp(log.createdAt);
  resultTimestamp(log.updatedAt);
  return log;
}

function validateListTransferLogsResult(value) {
  if (!Array.isArray(value)) throw invalidResult();
  for (const log of value) validateTransferLog(log);
  return value;
}

function validateSourceProject(value) {
  const project = resultRecord(value);
  resultId(project.id);
  resultString(project.code, { pattern: PROJECT_CODE_PATTERN });
  resultString(project.name);
  resultProjectType(project.type);
  return project;
}

function validateModuleSummary(value) {
  const moduleSummary = resultRecord(value);
  resultString(moduleSummary.moduleKey);
  resultString(moduleSummary.moduleName);
  resultCount(moduleSummary.tableCount);
  resultCount(moduleSummary.rowCount);
  return moduleSummary;
}

function validatePreviewImportResult(value) {
  const preview = resultRecord(value);
  validateSourceProject(preview.sourceProject);
  resultTimestamp(preview.exportedAt);
  resultEnum(preview.sensitiveMode, ["desensitized", "encrypted", "unknown"]);
  resultString(preview.packageVersion);
  resultString(preview.sourcePackageVersion);
  resultBoolean(preview.integrityVerified);
  resultStringArray(preview.warnings);
  const coverage = resultRecord(preview.coverage);
  resultBoolean(coverage.configurationAssets);
  resultBoolean(coverage.projectRuntimeFiles);
  resultBoolean(coverage.externalPhysicalData);
  if (!Array.isArray(preview.modules)) throw invalidResult();
  for (const moduleSummary of preview.modules) validateModuleSummary(moduleSummary);
  resultCount(preview.tableCount);
  resultCount(preview.rowCount);
  resultCount(preview.runtimeFileCount);
  resultStringArray(preview.databaseTypes);
  if (!Array.isArray(preview.tables)) throw invalidResult();
  for (const item of preview.tables) {
    const table = resultRecord(item);
    resultString(table.tableName);
    resultString(table.moduleKey);
    resultCount(table.rowCount);
  }
  return preview;
}

function validateBackupRecord(value, { includeCreator }) {
  const backup = resultRecord(value);
  resultId(backup.id);
  resultId(backup.projectId);
  resultString(backup.packageVersion);
  if (backup.packageSha256 !== null && backup.packageSha256 !== undefined) resultString(backup.packageSha256, { pattern: /^[a-f0-9]{64}$/i });
  if (includeCreator) resultString(backup.createdBy);
  resultTimestamp(backup.createdAt);
  return backup;
}

function validateListBackupsResult(value) {
  if (!Array.isArray(value)) throw invalidResult();
  for (const backup of value) validateBackupRecord(backup, { includeCreator: true });
  return value;
}

function validateCreateBackupResult(value) {
  return validateBackupRecord(value, { includeCreator: false });
}

function validatePackageArtifact(value) {
  const artifact = resultRecord(value);
  const manifest = resultRecord(artifact.manifest);
  if (manifest.packageType !== "medata-project-assets") throw invalidResult();
  resultString(manifest.exportFormatVersion);
  validateSourceProject(manifest.sourceProject);
  if (manifest.modules !== undefined) {
    if (!Array.isArray(manifest.modules)) throw invalidResult();
    for (const moduleSummary of manifest.modules) validateModuleSummary(moduleSummary);
  }
  if (!Array.isArray(artifact.tables)) throw invalidResult();
  for (const item of artifact.tables) {
    const table = resultRecord(item);
    resultString(table.tableName);
    resultStringArray(table.columns);
    if (!Array.isArray(table.rows)) throw invalidResult();
  }
  if (artifact.files !== undefined && !Array.isArray(artifact.files)) throw invalidResult();
  return artifact;
}

function validateDownloadBackupResult(value) {
  return validatePackageArtifact(value);
}

function validateExportAssetsResult(value) {
  return validatePackageArtifact(value);
}

function validateImportAssetsResult(value) {
  const result = resultRecord(value);
  resultId(result.projectId);
  const summary = resultRecord(result.summary);
  resultEnum(summary.mode, IMPORT_MODES);
  resultCount(summary.tableCount);
  resultCount(summary.rowCount);
  if (!Array.isArray(summary.tables)) throw invalidResult();
  for (const item of summary.tables) {
    const table = resultRecord(item);
    resultString(table.tableName);
    resultCount(table.rowCount);
  }
  const integrity = resultRecord(summary.integrity);
  resultBoolean(integrity.verified);
  resultCount(integrity.expectedRowCount);
  resultCount(integrity.importedRowCount);
  resultCount(integrity.restoredRuntimeFileCount);
  resultStringArray(summary.warnings);
  if (summary.automaticBackup !== null) validateBackupRecord(summary.automaticBackup, { includeCreator: false });
  return result;
}

function publicDtoValue(value, ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidResult();
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw invalidResult();
    return value.toISOString();
  }
  if (Buffer.isBuffer(value) || typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || value === undefined) {
    throw invalidResult();
  }
  if (!Array.isArray(value) && !isRecord(value)) throw invalidResult();
  if (ancestors.has(value)) throw invalidResult();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return Object.freeze(value.map((item) => publicDtoValue(item, ancestors)));
    const entries = [];
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      entries.push([key, publicDtoValue(item, ancestors)]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } finally {
    ancestors.delete(value);
  }
}

function sanitizeErrorDetail(value, ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : OMIT;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? OMIT : value.toISOString();
  if (Buffer.isBuffer(value) || value === undefined || typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") return OMIT;
  if (!Array.isArray(value) && !isRecord(value)) return OMIT;
  if (ancestors.has(value)) return OMIT;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => sanitizeErrorDetail(item, ancestors)).filter((item) => item !== OMIT));
    }
    const entries = [];
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      const sanitized = sanitizeErrorDetail(item, ancestors);
      if (sanitized !== OMIT) entries.push([key, sanitized]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } finally {
    ancestors.delete(value);
  }
}

const PUBLIC_PORT_ERRORS = Object.freeze({
  PROJECT_CONFLICT: Object.freeze({ message: "项目空间资源冲突", statusCode: 409, detailKeys: Object.freeze(["field", "projectId"]) }),
  PROJECT_NOT_FOUND: Object.freeze({ message: "项目空间资源不存在", statusCode: 404, detailKeys: Object.freeze(["resource", "projectId", "backupId", "userId"]) }),
  PROJECT_OPERATION_INVALID: Object.freeze({ message: "项目空间操作无效", statusCode: 400, detailKeys: Object.freeze(["field", "supported", "actual"]) }),
  PROJECT_OPERATION_FAILED: Object.freeze({ message: "项目空间操作失败", statusCode: 500, detailKeys: Object.freeze([]) }),
});

function classifyPortError(error) {
  const sourceCode = String(error?.code || "").toUpperCase();
  if (PUBLIC_PORT_ERRORS[sourceCode]) return sourceCode;
  if (["CONFLICT", "ER_DUP_ENTRY"].includes(sourceCode) || Number(error?.statusCode) === 409) return "PROJECT_CONFLICT";
  if (sourceCode === "NOT_FOUND" || Number(error?.statusCode) === 404) return "PROJECT_NOT_FOUND";
  if (["BAD_REQUEST", "VALIDATION_ERROR"].includes(sourceCode) || [400, 422].includes(Number(error?.statusCode))) return "PROJECT_OPERATION_INVALID";
  return "PROJECT_OPERATION_FAILED";
}

function mappedPortError(error) {
  const code = classifyPortError(error);
  const specification = PUBLIC_PORT_ERRORS[code];
  const sourceDetails = isRecord(error?.details) ? error.details : {};
  const details = {};
  for (const key of specification.detailKeys) {
    if (!Object.hasOwn(sourceDetails, key) || SECRET_KEY_PATTERN.test(key)) continue;
    const sanitized = sanitizeErrorDetail(sourceDetails[key]);
    if (sanitized !== OMIT) details[key] = sanitized;
  }
  return projectError(specification.message, code, specification.statusCode, Object.freeze(details));
}

const projectOperationSchemas = Object.freeze({
  detail: Object.freeze({ action: "read", parseInput: (id) => [positiveId(id)], parseResult: validateDetailResult }),
  create: Object.freeze({ action: "write", parseInput: (body, actor) => [projectBody(body), actor], parseResult: validateCreateResult }),
  update: Object.freeze({ action: "write", parseInput: (id, body) => [positiveId(id), projectBody(body)], parseResult: validateUpdateResult }),
  remove: Object.freeze({ action: "write", parseInput: (id) => [positiveId(id)], parseResult: validateRemoveResult }),
  setStatus: Object.freeze({ action: "write", parseInput: (id, status) => [positiveId(id), inputEnum(status, PROJECT_STATUSES, "项目状态")], parseResult: validateSetStatusResult }),
  upsertMember: Object.freeze({ action: "write", parseInput: (id, body) => [positiveId(id), memberBody(body)], parseResult: validateUpsertMemberResult }),
  removeMember: Object.freeze({ action: "write", parseInput: (id, userId) => [positiveId(id), positiveId(userId, "成员")], parseResult: validateRemoveMemberResult }),
  listTransferLogs: Object.freeze({ action: "read", parseInput: (options = {}) => { const query = inputRecord(options, "日志查询"); return [query.projectId === undefined || query.projectId === null || query.projectId === "" ? null : positiveId(query.projectId)]; }, parseResult: validateListTransferLogsResult }),
  previewImport: Object.freeze({ action: "write", parseInput: (file) => [fileArtifact(file)], parseResult: validatePreviewImportResult }),
  importAssets: Object.freeze({ action: "write", parseInput: (file, options, actor) => [fileArtifact(file), importOptions(options), actor], parseResult: validateImportAssetsResult }),
  listBackups: Object.freeze({ action: "read", parseInput: (id) => [positiveId(id)], parseResult: validateListBackupsResult }),
  createBackup: Object.freeze({ action: "write", parseInput: (id, actor) => [positiveId(id), actor], parseResult: validateCreateBackupResult }),
  downloadBackup: Object.freeze({ action: "read", parseInput: (id, backupId) => [positiveId(id), positiveId(backupId, "备份")], parseResult: validateDownloadBackupResult }),
  exportAssets: Object.freeze({ action: "read", parseInput: (id, options = {}, actor) => [positiveId(id), exportOptions(options), actor], parseResult: validateExportAssetsResult }),
});

module.exports = {
  mappedPortError,
  projectOperationSchemas,
  publicDtoValue,
};
