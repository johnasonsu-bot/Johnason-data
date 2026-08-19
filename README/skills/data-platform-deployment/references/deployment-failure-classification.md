# Deployment Failure Classification

Use this reference after proving the four independent layers in order:

1. Process: the expected service owns the expected loopback port.
2. Connection: the correct client can authenticate and execute a trivial query.
3. Schema: the expected database, schema, tables, and views exist.
4. Data: controlled source rows, natural keys, expected counts, and hashes exist.

Stop at the first failing layer. Preserve the command, exit code, timestamp, target host/port, database/schema, and redacted error as evidence.

## Decision matrix

| Symptom | Classification | Required evidence and action |
|---|---|---|
| Dependency executable is absent, including `vite` | `DEPLOYMENT` | Install from the repository lockfile and rerun the same command. |
| Backend or database port refuses a connection | `DEPLOYMENT` | Identify the listener, start the intended service, and repeat its health query. |
| Database authentication, database selection, or schema permission fails | `DEPLOYMENT` | Correct the secret/configuration through environment variables or keychain, then prove a trivial query. |
| PostgreSQL connects, but database `ods` or schema `ods` is absent | `DEPLOYMENT` | Create the database through the approved workflow and rerun DDL import. |
| PostgreSQL connects and schema objects exist, but controlled source rows are absent | `INPUT` | Obtain a versioned row-level baseline with expected counts, natural keys, and SHA-256. Do not synthesize rows. |
| `SOURCE_BASELINE_MISSING` | `INPUT` | The import package contains descriptions such as `SOURCE_ONLY`, not importable rows. Request the controlled baseline. |
| `POSTGRESQL_BASELINE_UNAVAILABLE` while PostgreSQL status fails | `DEPLOYMENT` | Restore database connectivity/schema first, then rerun the validation. |
| `POSTGRESQL_BASELINE_UNAVAILABLE` while PostgreSQL status passes and required tables are empty | `INPUT` | Do not reinstall PostgreSQL. Supply the missing controlled rows and rerun through the CLI. |
| `UNSUPPORTED_CLI_CAPABILITY` | `CLI_IMPLEMENTATION` | Implement/map the command, add a regression test, reinstall the CLI, and retry. |
| CLI returns success but expected table/view/asset is absent | `CLI_IMPLEMENTATION` | Treat the verification failure as real; fix dispatch, SQL, project context, or persistence. |
| Oracle, DM, or an external API is not supplied | `EXTERNAL_EVIDENCE` | Mark the specific gate blocked or skipped; never claim end-to-end success. |

## Aviation import evidence from 2026-08-14

Run `aviation-cli-excel-20260814020940` recorded 344 rows: 332 succeeded and 12 were blocked.

- Nine `SOURCE_BASELINE_MISSING` rows cover `ods_aircraft_tail`, `ods_flight_schedule`, `ods_crew_roster`, `ods_weather_metar`, `ods_runway_slot`, `ods_pax_connection`, `ods_action_log`, `ods_action_log_clean`, and `ods_china_airport_current_weather`.
- Three downstream checks, `CHK-001`, `CHK-002`, and `CHK-008`, report `POSTGRESQL_BASELINE_UNAVAILABLE` because those row-level baselines were not delivered.
- PostgreSQL 18.4 was running at `127.0.0.1:46123`; database `ods` contained schema `ods` with 16 base tables and 10 views. Therefore these 12 final failures are `INPUT`, not unresolved database installation failures.
- The deployment work did need to provision PostgreSQL because the original deployment skill covered only MySQL. The updated workflow now makes PostgreSQL installation, foreground lifecycle, connectivity, database, schema, and post-import object counts explicit gates.

The authoritative row-level record remains `航空业本体CLI导入差异清单.xlsx`. Do not replace it with this summary.
