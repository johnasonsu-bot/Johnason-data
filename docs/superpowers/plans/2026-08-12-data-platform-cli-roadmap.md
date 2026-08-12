# Data Platform CLI Single-Stage Delivery Roadmap

> **For agentic workers:** Implement this program as one modification stage. Internal task groups and commits are checkpoints, not separate delivery phases.

**Goal:** Complete the full-platform CLI conversion in one implementation stage, then pass two sequential test gates: external API invocation and database access across MySQL, PostgreSQL, Oracle, and DM.

**Architecture:** All 596 mapped APIs, 84 frontend entries, reliability infrastructure, daemon, ontology facades, and aviation acceptance are implemented before the stage can be declared complete. Every command declares explicit execution targets so the same completed build can be tested first against external API behavior and then against each database engine without changing command semantics.

**Tech Stack:** Node.js 22.20+, CommonJS, Commander, Zod, MySQL 8.4, PostgreSQL, Oracle, DM, KafkaJS, DataX/JDBC, Node test runner, npm package distribution.

## Global Constraints

- Source branch baseline is `dev`; implementation branch is `codex/data-platform-cli`.
- CLI entrypoint is `data-platform`, distributed as `@johnason/data-platform-cli`.
- CLI calls shared application services directly and never calls Data Platform Express/HTTP.
- `api` classification means the business capability calls an external API, AI model provider, or published service runtime.
- `database` classification means the business capability reads or writes MySQL, PostgreSQL, Oracle, or DM.
- A composite command may declare both `api` and one or more `database` targets; it must pass every applicable test gate.
- Secrets remain in the OS keychain or platform secret storage and never enter ordinary config, stdout, logs, fixtures, or Git.
- Coverage remains `596/596` APIs and `84/84` frontend entries with zero unmapped, duplicate, unknown-group, or stale-fingerprint findings.
- `build-aviation-ontology` acceptance forbids curl, browser completion, direct database clients, direct service imports, and bootstrap scripts.
- No Temporal dependency; MySQL job state, Kafka, and daemon workers provide durability.

---

## One Modification Stage

The implementation stage is complete only when all of the following coexist in the same installed package and branch:

1. npm package, OS keychain, profiles, login, permissions, project context, strict output, help, and REPL;
2. audit, idempotency, transaction Outbox, Inbox, Kafka, durable jobs, retry/dead-letter, daemon, and evidence tracing;
3. all foundation and 23 business-module command families;
4. multipart, download, stream, long-task, destructive confirmation, and file-contract adapters;
5. MySQL, PostgreSQL, Oracle, and DM adapters and dialect behavior;
6. ontology contract/lineage/graph/simulation facades;
7. aviation ontology preflight/run/verify/report;
8. command-to-inventory coverage state and agent-facing `SKILL.md`.

Task groups may be implemented and committed incrementally for review, but no task group is an independently released phase. The stage stays `in_progress` until both test gates below pass.

## Mandatory Command Classification

Each registry entry must declare:

```js
{
  capabilityId: "ingestion.task.run",
  executionTargets: [
    { kind: "api", provider: "external-api" },
    { kind: "database", engine: "postgresql" }
  ]
}
```

Allowed values:

- API providers: `external-api`, `model-provider`, `service-runtime`.
- Database engines: `mysql`, `postgresql`, `oracle`, `dm`.

Classification rules:

- Platform metadata, auth/session, project, standards, maps, quality facts, audit, jobs, and configuration are at least `database/mysql` because the platform authority store is MySQL.
- External API preview/ingestion, model-provider test/generation/streaming, internet research, and service-runtime invocation include `api`.
- Datasource, development, ingestion, quality, service, and reporting commands declare the actual supported database engines rather than a generic `database` label.
- A command that reads an external API then persists to a database declares both targets.
- Pure local commands such as help, config path display, graph file verification, and package version use `local` and are excluded from the two business test denominators but remain covered by unit/subprocess tests.
- Dynamic datasource commands resolve the engine at runtime and emit `meta.executionTargets` in JSON evidence.

The coverage gate rejects any non-local business command without an API or database execution target.

## Test Gate 1: External API Invocation

Run after the entire modification stage is implemented. This gate does not call Data Platform HTTP; it invokes installed CLI commands whose application services call controlled external endpoints.

Required suites:

- external API source preview, pagination, array-path extraction, filtering, retry, timeout, rate limit, malformed JSON, and exceptional values;
- API ingestion through DataX/application services with idempotency and target-write evidence;
- AI model provider connection, normal completion, streaming NDJSON, provider error redaction, and cancellation;
- data-source internet research and AI-assisted commands;
- published service runtime GET/POST invocation, authorization, audit log, and output contract;
- daemon retry/dead-letter behavior for external dependency failures;
- secret scan proving API keys and tokens never appear in stdout, stderr, files, events, or Git diff.

Gate result fields:

```text
api classified commands        = registry count
api commands tested            = same count
api commands untested          = 0
external endpoint bypass       = 0
secret findings                = 0
unexpected retries             = 0
```

## Test Gate 2: Database Access

Run only after Test Gate 1 passes. Use the same installed package and command registry; do not patch commands between gates except to fix defects and rerun Gate 1.

### MySQL

- platform authority store: login, project, permissions, metadata CRUD, audit, Outbox/Inbox, durable jobs, daemon leases;
- datasource metadata/list/sample/query/write flows;
- transaction rollback, idempotent rerun, project isolation, read-only rejection, and connection loss recovery;
- `build-aviation-ontology` platform asset and evidence storage.

### PostgreSQL

- connection/JDBC normalization, schema/table/column discovery, query execution, pagination, transaction and rollback;
- DataX read/write and ODS governance SQL;
- quoted identifiers, `public` versus explicit schema, timestamp/numeric handling, and aviation ODS validation;
- fixed Demo versus realtime-weather separation and METAR `VRB`/`M`/`6+` handling.

### Oracle

- service-name and SID JDBC forms, schema discovery, table/column metadata, query binds, pagination, and transaction rollback;
- DataX Oracle reader/writer readiness and missing-driver diagnostics;
- quoted identifiers, uppercase schema behavior, number/date conversion, and connection failure classification.

### DM

- DM JDBC URL, schema discovery, table/column metadata, query binds, pagination, and transaction rollback;
- managed JDBC driver activation/readiness and DataX capability diagnostics;
- quoted identifiers, uppercase schema behavior, number/date conversion, and connection failure classification.

Gate result fields per engine:

```text
database classified commands   = registry count for engine
database commands tested       = same count
database commands untested     = 0
CRUD/query/transaction pass    = all
project isolation failures     = 0
dialect contract failures      = 0
secret findings                = 0
```

If real Oracle or DM is unavailable, the gate is `blocked`, not passed or skipped. Full-stage acceptance requires all four engines.

## Single-Stage Exit

The modification stage passes only when:

```text
implementation coverage        = 596/596 APIs and 84/84 frontend entries
business commands classified   = all
unclassified business commands = 0
Test Gate 1 API                = passed
Test Gate 2 MySQL              = passed
Test Gate 2 PostgreSQL         = passed
Test Gate 2 Oracle             = passed
Test Gate 2 DM                 = passed
aviation ontology run 1        = succeeded
aviation ontology run 2        = succeeded and idempotent
forbidden bypass count         = 0
Web regression                 = passed
installed npm package tests    = passed
```

Any code fix after Gate 1 invalidates Gate 1 evidence; rerun both gates in order.
