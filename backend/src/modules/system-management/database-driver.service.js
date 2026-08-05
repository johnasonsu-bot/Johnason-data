const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const AppError = require("../../common/errors/app-error");
const {
  getRuntimeDatabaseCapabilityStatus,
  normalizeRegisteredDatabaseType,
} = require("../../common/utils/datasource-capabilities");
const {
  DRIVER_STORE_ROOT,
  ensureDriverStore,
  materializeActiveDataXDrivers,
  readActiveManifest,
  resolveDriverFile,
  writeActiveManifest,
} = require("../../common/utils/database-driver-store");
const { runJdbcAction } = require("../../common/utils/managed-jdbc-runtime");
const repository = require("./database-driver.repository");

const ALLOWED_TYPES = new Set(["mysql", "postgresql", "oracle", "dm"]);
const ALLOWED_TARGETS = new Set(["query", "dataxReader", "dataxWriter"]);
const DEFAULT_TARGETS = ["query", "dataxReader", "dataxWriter"];
const DRIVER_DEFAULTS = Object.freeze({
  mysql: { name: "MySQL JDBC", classes: ["com.mysql.cj.jdbc.Driver", "com.mysql.jdbc.Driver", "org.mariadb.jdbc.Driver"] },
  postgresql: { name: "PostgreSQL JDBC", classes: ["org.postgresql.Driver"] },
  oracle: { name: "Oracle JDBC", classes: ["oracle.jdbc.OracleDriver", "oracle.jdbc.driver.OracleDriver"] },
  dm: { name: "达梦 JDBC", classes: ["dm.jdbc.driver.DmDriver"] },
});
const DATAX_HOME = path.resolve(process.env.DATAX_HOME || path.resolve(__dirname, "../../../datax"));

function requireAdmin(user) {
  const role = String(user?.roleCode || user?.roleType || "").toLowerCase();
  if (role !== "admin") throw new AppError("仅系统管理员可以维护数据库驱动。", 403);
}

function normalizeType(value) {
  const normalized = normalizeRegisteredDatabaseType(value);
  if (!ALLOWED_TYPES.has(normalized)) throw new AppError("仅支持 MySQL、PostgreSQL、Oracle 和达梦数据库驱动。", 400);
  return normalized;
}

function parseTargets(value) {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = value.split(","); }
  }
  const targets = Array.from(new Set((Array.isArray(parsed) ? parsed : []).map(String).filter((item) => ALLOWED_TARGETS.has(item))));
  if (!targets.length) throw new AppError("至少选择一个生效目标。", 400);
  return targets;
}

function sanitizeSegment(value, fallback) {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function inferDriverVersion(fileName) {
  const match = String(fileName || "").match(/(\d+(?:\.\d+){1,4})(?=[^\d.]*\.jar$)/i);
  return match?.[1] || "自定义版本";
}

function getDriverClassCandidates(databaseType, current) {
  return Array.from(new Set([String(current || "").trim(), ...(DRIVER_DEFAULTS[databaseType]?.classes || [])].filter(Boolean)));
}

function calculateSha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function assertJarFile(file) {
  if (!file?.path || !fs.existsSync(file.path)) throw new AppError("请选择 JDBC JAR 驱动文件。", 400);
  if (!/\.jar$/i.test(file.originalname || "")) throw new AppError("驱动文件必须是 .jar 格式。", 400);
  const descriptor = fs.openSync(file.path, "r");
  try {
    const header = Buffer.alloc(4);
    fs.readSync(descriptor, header, 0, 4, 0);
    if (header[0] !== 0x50 || header[1] !== 0x4b) throw new AppError("上传文件不是有效的 JAR 包。", 400);
  } finally {
    fs.closeSync(descriptor);
  }
}

function manifestBinding(driverPackage) {
  return {
    packageId: driverPackage.id,
    databaseType: driverPackage.databaseType,
    driverName: driverPackage.driverName,
    version: driverPackage.version,
    driverClass: driverPackage.driverClass,
    filePath: driverPackage.filePath,
    sha256: driverPackage.sha256,
  };
}

function manifestFromBindings(bindings) {
  const result = { version: 1, bindings: {} };
  for (const binding of bindings) {
    result.bindings[`${binding.databaseType}:${binding.target}`] = {
      packageId: binding.packageId,
      databaseType: binding.databaseType,
      driverName: binding.driverName,
      version: binding.version,
      driverClass: binding.driverClass,
      filePath: binding.filePath,
      sha256: binding.sha256,
    };
  }
  return result;
}

async function restoreActiveManifest() {
  const bindings = await repository.listBindings();
  const manifest = writeActiveManifest(manifestFromBindings(bindings));
  materializeActiveDataXDrivers(DATAX_HOME);
  return manifest;
}

async function listDrivers() {
  const [packages, bindings, logs, capabilities] = await Promise.all([
    repository.listPackages(),
    repository.listBindings(),
    repository.listOperationLogs(null, 50),
    Promise.resolve(getRuntimeDatabaseCapabilityStatus()),
  ]);
  return { packages, bindings, logs, capabilities, runtimeManifest: readActiveManifest() };
}

async function uploadDriver(file, body, user) {
  requireAdmin(user);
  assertJarFile(file);
  const databaseType = normalizeType(body.databaseType);
  const defaults = DRIVER_DEFAULTS[databaseType];
  const targets = parseTargets(body.targets || DEFAULT_TARGETS);
  const driverClass = String(body.driverClass || defaults.classes[0]).trim();
  if (!/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+$/.test(driverClass)) throw new AppError("Driver Class 格式不正确。", 400);
  const version = String(body.version || inferDriverVersion(file.originalname)).trim();
  if (!version || version.length > 64) throw new AppError("请输入不超过 64 个字符的驱动版本。", 400);

  const sha256 = calculateSha256(file.path);
  if (await repository.getPackageByHash(databaseType, sha256)) throw new AppError("相同数据库类型和文件校验值的驱动已存在。", 409);
  const destinationDirectory = path.join(ensureDriverStore(), databaseType, sanitizeSegment(version, "unknown"), sha256);
  fs.mkdirSync(destinationDirectory, { recursive: true });
  const destination = path.join(destinationDirectory, "driver.jar");
  fs.renameSync(file.path, destination);
  fs.chmodSync(destination, 0o644);
  const relativePath = path.relative(DRIVER_STORE_ROOT, destination).replace(/\\/g, "/");
  let driverPackage;
  try {
    driverPackage = await repository.createPackage({
      databaseType,
      driverName: String(body.driverName || defaults.name).trim().slice(0, 128),
      version,
      driverClass,
      originalFileName: path.basename(file.originalname || "driver.jar"),
      filePath: relativePath,
      fileSize: Number(file.size || fs.statSync(destination).size),
      sha256,
      targets,
      uploadedBy: user?.id || null,
      uploadedByName: user?.username || "system",
    });
  } catch (error) {
    try { fs.unlinkSync(destination); } catch {}
    throw error;
  }
  await repository.createOperationLog({ packageId: driverPackage.id, databaseType, action: "upload", status: "success", detail: { sha256, targets }, user });
  return driverPackage;
}

async function validateDriver(id, user) {
  requireAdmin(user);
  const driverPackage = await repository.getPackageById(id);
  if (!driverPackage) throw new AppError("驱动包不存在。", 404);
  let lastError;
  const candidates = getDriverClassCandidates(driverPackage.databaseType, driverPackage.driverClass);
  for (const driverClass of candidates) {
    try {
      const result = await runJdbcAction({ ...manifestBinding(driverPackage), driverClass }, "validate");
      const updated = await repository.updateValidation(id, {
        status: "validated",
        message: "驱动自动验证通过",
        javaVersion: result.javaVersion,
        driverClass,
      });
      await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "validate", status: "success", detail: { ...result, autoDetected: true }, user });
      return updated;
    } catch (error) {
      lastError = error;
    }
  }
  const message = `未识别到可用的 JDBC 驱动类（已检查：${candidates.join("、")}）`;
  await repository.updateValidation(id, { status: "failed", message });
  await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "validate", status: "failed", detail: { error: lastError?.message, candidates }, user });
  throw new AppError(`驱动自动验证失败：${message}`, 400);
}

async function uploadAndActivateDriver(file, body, user) {
  let driverPackage;
  try {
    driverPackage = await uploadDriver(file, { ...body, targets: DEFAULT_TARGETS }, user);
    const validated = await validateDriver(driverPackage.id, user);
    await activateDriver(validated.id, DEFAULT_TARGETS, user);
    return listDrivers();
  } catch (error) {
    if (driverPackage?.id) {
      try { await deleteDriver(driverPackage.id, user); } catch {}
    }
    throw error;
  }
}

async function activateDriver(id, targetsInput, user) {
  requireAdmin(user);
  const driverPackage = await repository.getPackageById(id);
  if (!driverPackage) throw new AppError("驱动包不存在。", 404);
  if (driverPackage.validationStatus !== "validated") throw new AppError("驱动必须验证通过后才能激活。", 400);
  const targets = parseTargets(targetsInput?.length ? targetsInput : driverPackage.targets);
  const unsupported = targets.filter((target) => !driverPackage.targets.includes(target));
  if (unsupported.length) throw new AppError(`驱动包未声明生效目标：${unsupported.join(", ")}`, 400);
  if (targets.some((target) => target.startsWith("datax"))) {
    const runningJobIds = require("../../services/dataxService").getRunningJobIds();
    if (runningJobIds.length) throw new AppError(`当前有 ${runningJobIds.length} 个 DataX 任务运行中，请等待任务结束后再激活驱动。`, 409);
  }

  const previousManifest = readActiveManifest();
  const nextManifest = JSON.parse(JSON.stringify(previousManifest));
  for (const target of targets) nextManifest.bindings[`${driverPackage.databaseType}:${target}`] = manifestBinding(driverPackage);
  try {
    writeActiveManifest(nextManifest);
    materializeActiveDataXDrivers(DATAX_HOME);
    await repository.replaceBindings(driverPackage, targets, user || {});
    await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "activate", status: "success", detail: { targets }, user });
    return listDrivers();
  } catch (error) {
    writeActiveManifest(previousManifest);
    try { materializeActiveDataXDrivers(DATAX_HOME); } catch {}
    await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "activate", status: "failed", detail: { targets, error: error.message }, user });
    throw new AppError(`驱动激活失败并已恢复原版本：${error.message}`, 500);
  }
}

async function rollbackDriver(databaseTypeInput, targetInput, user) {
  requireAdmin(user);
  const databaseType = normalizeType(databaseTypeInput);
  const target = parseTargets([targetInput])[0];
  const currentBindings = await repository.listBindings();
  const current = currentBindings.find((item) => item.databaseType === databaseType && item.target === target);
  if (!current?.previousPackageId) throw new AppError("当前目标没有可回滚的历史版本。", 400);
  const previousPackage = await repository.getPackageById(current.previousPackageId);
  if (!previousPackage) throw new AppError("可回滚驱动版本已不存在。", 409);
  const desiredBindings = currentBindings.map((item) => item === current ? {
    ...item,
    packageId: previousPackage.id,
    previousPackageId: current.packageId,
    driverName: previousPackage.driverName,
    version: previousPackage.version,
    driverClass: previousPackage.driverClass,
    filePath: previousPackage.filePath,
    sha256: previousPackage.sha256,
  } : item);
  const currentManifest = readActiveManifest();
  try {
    const desiredManifest = writeActiveManifest(manifestFromBindings(desiredBindings));
    materializeActiveDataXDrivers(DATAX_HOME);
    const bindings = await repository.rollbackBinding(databaseType, target, user || {});
    const active = bindings.find((item) => item.databaseType === databaseType && item.target === target);
    await repository.createOperationLog({ packageId: active?.packageId, databaseType, action: "rollback", status: "success", detail: { target }, user });
    return { bindings, runtimeManifest: desiredManifest };
  } catch (error) {
    writeActiveManifest(currentManifest);
    try { materializeActiveDataXDrivers(DATAX_HOME); } catch {}
    await repository.createOperationLog({ packageId: current.packageId, databaseType, action: "rollback", status: "failed", detail: { target, error: error.message }, user });
    throw new AppError(`驱动回滚失败并已恢复当前版本：${error.message}`, 500);
  }
}

async function deactivateDriver(databaseTypeInput, targetInput, user) {
  requireAdmin(user);
  const databaseType = normalizeType(databaseTypeInput);
  const target = parseTargets([targetInput])[0];
  if (target.startsWith("datax")) {
    const runningJobIds = require("../../services/dataxService").getRunningJobIds();
    if (runningJobIds.length) throw new AppError(`当前有 ${runningJobIds.length} 个 DataX 任务运行中，请等待任务结束后再停用驱动。`, 409);
  }
  const currentBindings = await repository.listBindings();
  const current = currentBindings.find((item) => item.databaseType === databaseType && item.target === target);
  if (!current) throw new AppError("当前目标没有已激活的用户驱动。", 404);
  const desiredBindings = currentBindings.filter((item) => item !== current);
  const currentManifest = readActiveManifest();
  try {
    const manifest = writeActiveManifest(manifestFromBindings(desiredBindings));
    materializeActiveDataXDrivers(DATAX_HOME);
    const removed = await repository.deactivateBinding(databaseType, target);
    if (!removed) throw new Error("驱动绑定状态已发生变化");
    await repository.createOperationLog({ packageId: current.packageId, databaseType, action: "deactivate", status: "success", detail: { target }, user });
    return { bindings: desiredBindings, runtimeManifest: manifest };
  } catch (error) {
    writeActiveManifest(currentManifest);
    try { materializeActiveDataXDrivers(DATAX_HOME); } catch {}
    await repository.createOperationLog({ packageId: current.packageId, databaseType, action: "deactivate", status: "failed", detail: { target, error: error.message }, user });
    throw new AppError(`驱动停用失败并已恢复当前版本：${error.message}`, 500);
  }
}

async function deleteDriver(id, user) {
  requireAdmin(user);
  const driverPackage = await repository.getPackageById(id);
  if (!driverPackage) throw new AppError("驱动包不存在。", 404);
  const bindings = await repository.listBindings();
  if (bindings.some((item) => item.packageId === driverPackage.id || item.previousPackageId === driverPackage.id)) {
    throw new AppError("当前或可回滚版本仍引用该驱动，不能删除。", 409);
  }
  await repository.deletePackage(id);
  const filePath = resolveDriverFile(driverPackage.filePath);
  try { fs.unlinkSync(filePath); } catch {}
  await repository.createOperationLog({ packageId: null, databaseType: driverPackage.databaseType, action: "delete", status: "success", detail: { version: driverPackage.version, sha256: driverPackage.sha256 }, user });
  return { id };
}

async function listLogs(packageId) {
  return repository.listOperationLogs(packageId, 200);
}

module.exports = {
  activateDriver,
  deactivateDriver,
  deleteDriver,
  listDrivers,
  listLogs,
  restoreActiveManifest,
  rollbackDriver,
  uploadAndActivateDriver,
  uploadDriver,
  validateDriver,
  __test: {
    getDriverClassCandidates,
    inferDriverVersion,
  },
};
