const fs = require("fs");
const path = require("path");

const DRIVER_STORE_ROOT = path.resolve(process.cwd(), "runtime/database-drivers");
const ACTIVE_MANIFEST_PATH = path.join(DRIVER_STORE_ROOT, "active.json");

const DATAX_TARGETS = {
  mysql: {
    dataxReader: { relativePath: "reader/mysqlreader/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i },
    dataxWriter: { relativePath: "writer/mysqlwriter/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i },
  },
  postgresql: {
    dataxReader: { relativePath: "reader/postgresqlreader/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i },
    dataxWriter: { relativePath: "writer/postgresqlwriter/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i },
  },
  oracle: {
    dataxReader: { relativePath: "reader/oraclereader/libs", pattern: /ojdbc.*\.jar$/i },
    dataxWriter: { relativePath: "writer/oraclewriter/libs", pattern: /ojdbc.*\.jar$/i },
  },
  dm: {
    dataxReader: { relativePath: "reader/rdbmsreader/libs", pattern: /dm.*jdbcdriver.*\.jar$/i },
    dataxWriter: { relativePath: "writer/rdbmswriter/libs", pattern: /dm.*jdbcdriver.*\.jar$/i },
  },
};

function ensureDriverStore() {
  fs.mkdirSync(DRIVER_STORE_ROOT, { recursive: true });
  return DRIVER_STORE_ROOT;
}

function emptyManifest() {
  return { version: 1, bindings: {}, updatedAt: null };
}

function readActiveManifest() {
  ensureDriverStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(ACTIVE_MANIFEST_PATH, "utf8"));
    return parsed && typeof parsed === "object" && parsed.bindings ? parsed : emptyManifest();
  } catch {
    return emptyManifest();
  }
}

function writeActiveManifest(manifest) {
  ensureDriverStore();
  const next = { version: 1, bindings: manifest?.bindings || {}, updatedAt: new Date().toISOString() };
  const tempPath = `${ACTIVE_MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tempPath, ACTIVE_MANIFEST_PATH);
  return next;
}

function getActiveDriverBinding(databaseType, target = "query") {
  const key = `${String(databaseType || "").toLowerCase()}:${target}`;
  return readActiveManifest().bindings[key] || null;
}

function resolveDriverFile(relativePath) {
  const resolved = path.resolve(DRIVER_STORE_ROOT, String(relativePath || ""));
  const relative = path.relative(DRIVER_STORE_ROOT, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("驱动文件路径超出持久化仓库");
  }
  return resolved;
}

function restoreBuiltInDrivers(directory) {
  if (!fs.existsSync(directory)) return;
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith(".builtin-disabled")) continue;
    const source = path.join(directory, name);
    const target = path.join(directory, name.slice(0, -".builtin-disabled".length));
    if (!fs.existsSync(target)) fs.renameSync(source, target);
    else fs.unlinkSync(source);
  }
}

function materializeDataXTarget(dataxHome, databaseType, target, binding) {
  const config = DATAX_TARGETS[databaseType]?.[target];
  if (!config) return;
  const directory = path.join(dataxHome, "plugin", config.relativePath);
  if (!fs.existsSync(directory)) throw new Error(`DataX 插件目录不存在: ${config.relativePath}`);

  const managedName = `medata-managed-${databaseType}.jar`;
  const managedPath = path.join(directory, managedName);
  if (fs.existsSync(managedPath)) fs.unlinkSync(managedPath);
  restoreBuiltInDrivers(directory);
  if (!binding) return;

  for (const name of fs.readdirSync(directory)) {
    if (name === managedName || !config.pattern.test(name)) continue;
    fs.renameSync(path.join(directory, name), path.join(directory, `${name}.builtin-disabled`));
  }
  const sourcePath = resolveDriverFile(binding.filePath);
  if (!fs.existsSync(sourcePath)) throw new Error(`激活驱动文件不存在: ${binding.filePath}`);
  fs.copyFileSync(sourcePath, managedPath);
}

function materializeActiveDataXDrivers(dataxHome) {
  const manifest = readActiveManifest();
  for (const databaseType of Object.keys(DATAX_TARGETS)) {
    for (const target of ["dataxReader", "dataxWriter"]) {
      materializeDataXTarget(dataxHome, databaseType, target, manifest.bindings[`${databaseType}:${target}`] || null);
    }
  }
  return manifest;
}

module.exports = {
  ACTIVE_MANIFEST_PATH,
  DRIVER_STORE_ROOT,
  ensureDriverStore,
  getActiveDriverBinding,
  materializeDataXTarget,
  materializeActiveDataXDrivers,
  readActiveManifest,
  resolveDriverFile,
  writeActiveManifest,
};
