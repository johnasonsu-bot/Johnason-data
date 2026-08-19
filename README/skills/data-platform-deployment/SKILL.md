---
name: data-platform-deployment
description: Install, build, start, verify, diagnose, and stop the Johnason Data Platform backend, frontend, MySQL metadata store, PostgreSQL ODS, and repository-local data-platform CLI. Use for local deployment, login-page startup, aviation ontology prerequisites, database installation or connectivity failures, and authenticated Web/CLI acceptance.
---

# Data Platform Local Deployment

Run this workflow from the repository root. Keep passwords and signing secrets in environment variables or the operating-system keychain. Never put them in source files, command arguments, logs, evidence, or Git history.

## Runtime contract

- Frontend: `http://127.0.0.1:46120/login`
- Backend: `http://127.0.0.1:46121`
- MySQL platform store: `127.0.0.1:46122`, database `data_platform_source`
- PostgreSQL ODS: `127.0.0.1:46123`, database `ods`, schema `ods`
- CLI: `.local/data-platform-cli/install/node_modules/.bin/data-platform`
- Node: `>=22.20.0`

MySQL is required for the platform backend. PostgreSQL is additionally required for database-backed CLI and aviation ontology acceptance. The checked-in CLI acceptance sources are under `docs/cli/source/`.

Treat service readiness, schema readiness, and source-data readiness as separate gates. A running PostgreSQL process does not prove that the ODS schema exists, and an empty but queryable ODS table is not evidence that source data was delivered.

## Preflight

1. Confirm the repository, branch, Node version, Docker daemon, and occupied ports:

   ```bash
   git status --short --branch
   node --version
   docker info
   lsof -nP -iTCP:46120 -iTCP:46121 -iTCP:46122 -iTCP:46123 -sTCP:LISTEN
   ```

2. Reuse a listener only after identifying its process and proving it belongs to this checkout. Never kill an unknown process to free a port.
3. Set `DB_PASSWORD`, `JWT_SECRET`, and, when PostgreSQL is required, `DATA_PLATFORM_PG_PASSWORD` in the current shell or secret manager. Do not use `.env.example` values as real credentials.

## Install and build

1. Install root and frontend dependencies:

   ```bash
   npm install
   npm --prefix frontend install --no-audit --no-fund
   ```

2. Build and test before starting services:

   ```bash
   npm run build
   npm test
   npm --workspace backend test
   ```

3. Install the CLI into its isolated repository-local prefix:

   ```bash
   npm run install:cli:local
   ```

   Do not install globally or replace the root `node_modules`.

## Start MySQL and the platform

Start MySQL and confirm that the expected container is running:

```bash
docker compose --env-file .env.example -f compose.dev.yml up -d mysql
docker compose --env-file .env.example -f compose.dev.yml ps mysql
```

Wait for MySQL to accept connections. Then bootstrap the schema and seed user using shell-provided values:

```bash
env NODE_ENV=development \
  DB_HOST=127.0.0.1 DB_PORT=46122 DB_USER=root \
  DB_PASSWORD="$DB_PASSWORD" DB_NAME=data_platform_source \
  JWT_SECRET="$JWT_SECRET" PORT=46121 \
  BACKGROUND_SCHEDULERS_ENABLED=false \
  npm --prefix backend run bootstrap
```

Start the backend in a foreground terminal with the same database settings:

```bash
env NODE_ENV=development \
  DB_HOST=127.0.0.1 DB_PORT=46122 DB_USER=root \
  DB_PASSWORD="$DB_PASSWORD" DB_NAME=data_platform_source \
  JWT_SECRET="$JWT_SECRET" PORT=46121 \
  BACKGROUND_SCHEDULERS_ENABLED=false \
  npm --prefix backend run dev
```

Start the frontend in another foreground terminal:

```bash
env VITE_PROXY_TARGET=http://127.0.0.1:46121 \
  npm --prefix frontend run dev -- --host 127.0.0.1 --port 46120
```

Verify the direct backend, frontend proxy, and login entry:

```bash
curl -fsS http://127.0.0.1:46121/api/health
curl -fsS http://127.0.0.1:46120/api/health
curl -fsS -I http://127.0.0.1:46120/login
```

Do not hand over the login URL until all three checks pass.

## Start PostgreSQL ODS

Prefer an existing managed PostgreSQL when it is explicitly supplied and queryable. For a repository-local macOS/Linux acceptance instance, use the bundled lifecycle script:

```bash
node README/skills/data-platform-deployment/scripts/local-postgres.mjs install
node README/skills/data-platform-deployment/scripts/local-postgres.mjs serve
```

Keep `serve` in its own foreground terminal. It persists the cluster under `.local/embedded-postgres/data`, binds only to `127.0.0.1`, creates the `ods` database idempotently, and obtains the password only from `DATA_PLATFORM_PG_PASSWORD`. Do not commit `.local/` or broaden PostgreSQL to a non-loopback listener.

From another terminal, prove connectivity and inspect the ODS object counts:

```bash
node README/skills/data-platform-deployment/scripts/local-postgres.mjs status
```

Before aviation import, a successful connection and existing `ods` database are sufficient. After DDL import, require the expected schema objects. The current aviation package creates 16 base tables and 10 views in schema `ods`; baseline-dependent tables can still be empty when the package lacks controlled source rows.

Configure the platform PostgreSQL data source with database `ods` and schema `ods`, not schema `public`. Put the database password and runtime signing secret into the OS keychain using `config profile add --secrets-stdin`. If the keychain is unavailable, stop with `KEYCHAIN_UNAVAILABLE`; do not add a plaintext filesystem fallback.

## Login and acceptance

Open `http://127.0.0.1:46120/login`. Use the bootstrap account only for this local instance and rotate it outside disposable development environments.

After login, hold the token in memory and verify project-scoped access:

```bash
printf 'Authorization: Bearer %s\n' "$TOKEN" | \
  curl -fsS -H @- http://127.0.0.1:46121/api/auth/profile
printf 'Authorization: Bearer %s\n' "$TOKEN" | \
  curl -fsS -H @- http://127.0.0.1:46121/api/v1/projects/my
```

Run installed-CLI dispatch acceptance:

```bash
npm run acceptance:cli
```

The current contract expects 596 capabilities, 570 command definitions, 1,166 successful dispatches, and installed health status `ok`. Run aviation package validation/import only after MySQL, backend, CLI profile, and PostgreSQL gates pass. After import, rerun PostgreSQL `status` and query the imported assets through the CLI.

`npm run acceptance` is stricter. Keep it blocked until real external API, MySQL/PostgreSQL/Oracle/DM, rollback, and repeat-run aviation evidence exists; never substitute mocks for required external evidence.

## Classify failures

Read [deployment-failure-classification.md](references/deployment-failure-classification.md) whenever a deployment or aviation acceptance run reports failures. Record each failure as one of:

- `DEPLOYMENT`: dependency installation, process startup, port, authentication, database, schema, or network readiness failed.
- `INPUT`: the service and schema are queryable, but controlled source rows or their hashes were not delivered.
- `CLI_IMPLEMENTATION`: a supported CLI operation is missing, dispatches incorrectly, or fails to create/query the expected asset.
- `EXTERNAL_EVIDENCE`: a required external system is intentionally unavailable and no real evidence can be produced.

Do not infer `DEPLOYMENT` from an error name alone. In particular, classify `POSTGRESQL_BASELINE_UNAVAILABLE` as `INPUT` when PostgreSQL status passes and the required tables exist but are empty.

## Stop safely

Stop frontend, backend, and local PostgreSQL with `Ctrl-C` in their foreground terminals. Stop MySQL without deleting its volume:

```bash
docker compose --env-file .env.example -f compose.dev.yml stop mysql
```

Do not remove the MySQL volume or `.local/embedded-postgres/data` unless the user explicitly authorizes data destruction. Remove temporary CLI profiles and keychain entries after acceptance.

## Common repairs

- `vite: command not found`: reinstall frontend dependencies from `frontend/package-lock.json`.
- Backend `ECONNREFUSED` on `46122`: start MySQL, wait for readiness, and rerun bootstrap.
- PostgreSQL `ECONNREFUSED` on `46123`: start the local or managed PostgreSQL service, then rerun `status` before import.
- `database "ods" does not exist`: run the local PostgreSQL `serve` command or create the database through the approved managed-database workflow.
- `relation ... does not exist` with PostgreSQL otherwise healthy: verify database `ods`, schema `ods`, DDL import status, and the data-source schema setting.
- `PROFILE_REQUIRED`: select a named profile or pass `--profile`; do not bypass profile isolation.
- Coverage or aggregate acceptance fails: inspect the reports under `docs/operations/` and preserve missing real evidence as blocked.
