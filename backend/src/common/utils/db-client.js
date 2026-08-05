const { Client: PgClient } = require("pg");
const OpenGaussClient = require("node-opengauss/lib/core/client");

function isGaussDbType(value) {
  return String(value || "").trim().toLowerCase() === "gaussdb";
}

function createPostgresLikeClient(config = {}, options = {}) {
  const normalized = {
    host: config.host,
    port: Number(config.port || 5432),
    database: config.database,
    user: config.user || config.username,
    username: config.username || config.user,
    password: config.password,
    connectionTimeoutMillis: Number(config.connectionTimeoutMillis || 0) || undefined,
    ssl: config.ssl,
    application_name: config.application_name,
  };

  if (isGaussDbType(options.sourceType || options.storageType || options.protocol)) {
    return new OpenGaussClient({
      host: normalized.host,
      port: normalized.port,
      database: normalized.database,
      user: normalized.user,
      password: normalized.password,
      connectionTimeoutMillis: normalized.connectionTimeoutMillis,
      ssl: normalized.ssl,
      application_name: normalized.application_name,
    });
  }

  return new PgClient({
    host: normalized.host,
    port: normalized.port,
    database: normalized.database,
    user: normalized.user,
    password: normalized.password,
    connectionTimeoutMillis: normalized.connectionTimeoutMillis,
    ssl: normalized.ssl,
    application_name: normalized.application_name,
  });
}

module.exports = {
  createPostgresLikeClient,
  isGaussDbType,
};
