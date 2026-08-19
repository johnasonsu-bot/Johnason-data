#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const command = process.argv[2];
const root = process.cwd();
const installDir = resolve(root, ".local/embedded-postgres");
const packageFile = resolve(installDir, "package.json");
const databaseDir = resolve(installDir, "data");
const host = "127.0.0.1";
const port = Number(process.env.DATA_PLATFORM_PG_PORT || 46123);
const user = process.env.DATA_PLATFORM_PG_USER || "postgres";
const password = process.env.DATA_PLATFORM_PG_PASSWORD;
const database = process.env.DATA_PLATFORM_PG_DATABASE || "ods";

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("DATA_PLATFORM_PG_PORT must be an integer between 1024 and 65535");
}
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
  throw new Error("DATA_PLATFORM_PG_DATABASE must be a simple PostgreSQL identifier");
}

function install() {
  mkdirSync(installDir, { recursive: true });
  const binaryPackage = `@embedded-postgres/${process.platform}-${process.arch}`;
  const installResult = spawnSync(
    "npm",
    [
      "install",
      "--prefix",
      installDir,
      "--save-exact",
      "--no-audit",
      "--no-fund",
      "embedded-postgres@18.4.0-beta.17",
      "pg@8.23.0",
    ],
    { stdio: "inherit" },
  );
  if (installResult.status !== 0) process.exit(installResult.status || 1);

  // PostgreSQL binaries need a reviewed postinstall to restore package symlinks.
  const approvalResult = spawnSync(
    "npm",
    ["--prefix", installDir, "approve-scripts", binaryPackage],
    { stdio: "inherit" },
  );
  if (approvalResult.status !== 0) process.exit(approvalResult.status || 1);

  const rebuildResult = spawnSync(
    "npm",
    ["--prefix", installDir, "rebuild", binaryPackage],
    { stdio: "inherit" },
  );
  if (rebuildResult.status !== 0) process.exit(rebuildResult.status || 1);
}

async function modules() {
  if (!existsSync(packageFile)) {
    throw new Error("PostgreSQL runtime is not installed; run this script with 'install' first");
  }
  const localRequire = createRequire(packageFile);
  const embeddedEntry = localRequire.resolve("embedded-postgres");
  const { default: EmbeddedPostgres } = await import(pathToFileURL(embeddedEntry));
  const { Client } = localRequire("pg");
  return { EmbeddedPostgres, Client };
}

function connectionOptions(targetDatabase) {
  return {
    host,
    port,
    user,
    password,
    database: targetDatabase,
    connectionTimeoutMillis: 2000,
  };
}

async function probe(Client, targetDatabase) {
  const client = new Client(connectionOptions(targetDatabase));
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function ensureDatabase(Client) {
  const client = new Client(connectionOptions("postgres"));
  await client.connect();
  try {
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (result.rowCount === 0) await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }
}

async function status(Client) {
  const client = new Client(connectionOptions(database));
  await client.connect();
  try {
    const server = await client.query(
      "SELECT current_database() AS database, current_user AS username, current_setting('server_version') AS version",
    );
    const objects = await client.query(
      `SELECT table_type, count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = 'ods'
        GROUP BY table_type
        ORDER BY table_type`,
    );
    console.log(JSON.stringify({ host, port, ...server.rows[0], schema: "ods", objects: objects.rows }, null, 2));
  } finally {
    await client.end();
  }
}

async function serve() {
  const { EmbeddedPostgres, Client } = await modules();
  if (await probe(Client, "postgres")) {
    await ensureDatabase(Client);
    await status(Client);
    console.log("PostgreSQL is already running; no new process was started.");
    return;
  }

  const freshCluster = !existsSync(resolve(databaseDir, "PG_VERSION"));
  if (freshCluster && !password) {
    throw new Error("DATA_PLATFORM_PG_PASSWORD is required to initialize a new cluster");
  }

  const postgres = new EmbeddedPostgres({
    databaseDir,
    host,
    port,
    user,
    password,
    authMethod: "scram-sha-256",
    persistent: true,
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  });
  if (freshCluster) await postgres.initialise();
  await postgres.start();
  await ensureDatabase(Client);
  await status(Client);
  console.log("PostgreSQL is running in the foreground. Press Ctrl-C to stop it without deleting data.");

  await new Promise((resolveSignal) => {
    process.once("SIGINT", resolveSignal);
    process.once("SIGTERM", resolveSignal);
  });
  await postgres.stop();
}

if (command === "install") {
  install();
} else if (command === "serve") {
  await serve();
} else if (command === "status") {
  const { Client } = await modules();
  await status(Client);
} else {
  console.error("Usage: local-postgres.mjs <install|serve|status>");
  process.exit(2);
}
