const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

process.env.TZ = process.env.TZ || "Asia/Shanghai";

const defaultDataxHome = path.resolve(__dirname, "../../datax");
const defaultDataxBin = path.join(defaultDataxHome, "bin", "datax.py");
const normalizeEnvText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const env = {
  nodeEnv: normalizeEnvText(process.env.NODE_ENV, "development"),
  port: Number(normalizeEnvText(process.env.PORT, "44121")),
  frontendUrl: normalizeEnvText(process.env.FRONTEND_URL, "http://localhost:44120"),
  chartdbPublicUrl: normalizeEnvText(process.env.CHARTDB_PUBLIC_URL, "/devtools/chartdb/"),
  jwtSecret: normalizeEnvText(process.env.JWT_SECRET, "medata-dev-secret"),
  jwtExpiresIn: normalizeEnvText(process.env.JWT_EXPIRES_IN, "8h"),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  backgroundSchedulersEnabled: normalizeEnvText(process.env.BACKGROUND_SCHEDULERS_ENABLED, "true").toLowerCase() !== "false",
  dataxHome: normalizeEnvText(process.env.DATAX_HOME, defaultDataxHome),
  dataxBin: normalizeEnvText(process.env.DATAX_BIN, defaultDataxBin),
  db: {
    host: normalizeEnvText(process.env.DB_HOST, "localhost"),
    port: Number(normalizeEnvText(process.env.DB_PORT, "3306")),
    user: normalizeEnvText(process.env.DB_USER, "root"),
    password: normalizeEnvText(process.env.DB_PASSWORD, "123456"),
    database: normalizeEnvText(process.env.DB_NAME, "medata"),
    timezone: normalizeEnvText(process.env.DB_TIMEZONE, "+08:00"),
  },
  kafka: {
    bootstrapServers: normalizeEnvText(process.env.KAFKA_BOOTSTRAP_SERVERS || process.env.KAFKA_BOOTSTRAP_SERVER, "localhost:9092")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    clientId: normalizeEnvText(process.env.KAFKA_CLIENT_ID, "medata-data-lab"),
    groupIdPrefix: normalizeEnvText(process.env.KAFKA_GROUP_ID_PREFIX, "medata-data-lab-group"),
    enabled: normalizeEnvText(process.env.KAFKA_ENABLED, "true").toLowerCase() !== "false",
  },
  licenseStorageKey: normalizeEnvText(process.env.LICENSE_STORAGE_KEY || process.env.JWT_SECRET, "medata-dev-storage-key"),
  seedDemoData: process.env.SEED_DEMO_DATA
    ? String(process.env.SEED_DEMO_DATA).toLowerCase() !== "false"
    : (process.env.NODE_ENV || "development") !== "production",
  projectAssetBackup: {
    enabled: normalizeEnvText(process.env.PROJECT_ASSET_BACKUP_ENABLED, "true").toLowerCase() !== "false",
    cron: normalizeEnvText(process.env.PROJECT_ASSET_BACKUP_CRON, "0 2 * * *"),
  },
};

module.exports = env;
