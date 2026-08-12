# Data Platform CLI Full Conversion Single-Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the entire Data Platform CLI conversion in one stage, classify every business command as external-API and/or database access, and pass the API gate followed by MySQL, PostgreSQL, Oracle, and DM database gates.

**Architecture:** The installed CommonJS CLI shares transport-neutral application capabilities with Express. A declarative registry binds 596 source APIs and 84 frontend entries to handlers, permissions, execution targets, I/O contracts, audit/outbox/job behavior, and tests. The completed build is tested without modification in two ordered gates: external API invocation, then four-engine database access.

**Tech Stack:** Node.js 22.20+, Commander 15, Zod 3.24, MySQL2, pg, oracledb, dmdb/managed JDBC, KafkaJS, DataX, Node test runner, Docker/real database test environments, npm global packaging.

## Global Constraints

- This is one implementation stage; task groups and commits are internal checkpoints only.
- CLI never calls Data Platform Express/HTTP.
- `api` means an application capability invokes an external API, model provider, or published service runtime.
- `database` engines are exactly `mysql`, `postgresql`, `oracle`, and `dm`.
- Composite commands declare and test every target they actually use.
- Real Oracle and DM are mandatory for the final database gate; unavailable infrastructure blocks completion.
- Secrets never enter normal config, stdout, stderr, evidence JSON, event payloads, fixtures, or Git.
- All 596 APIs and 84 frontend entries end as `verified` or reviewed `notApplicable`.
- The aviation ontology workflow runs twice through the installed CLI with zero forbidden bypasses.
- Use TDD and preserve Web behavior throughout.

---

## Task Group 1: Foundation Runtime

Execute every task in [`2026-08-12-cli-foundation.md`](./2026-08-12-cli-foundation.md). This produces the installable package, keychain, profiles, database runtime injection, shared policies, registry/output, foundation commands, REPL, and installed-command test. It is not a release or separate phase.

Before continuing, run:

```bash
cd packages/data-platform-cli && npm test && npm run pack:check
cd ../../backend && npm test
```

Expected: all foundation and existing backend tests pass.

### Task 10: Enforce Execution-Target Classification in Registry

**Files:**
- Modify: `packages/data-platform-cli/src/registry/command-registry.js`
- Create: `packages/data-platform-cli/src/registry/execution-targets.js`
- Create: `packages/data-platform-cli/tests/execution-targets.test.js`
- Modify: `scripts/generate-cli-coverage-baseline.js`
- Modify: `docs/superpowers/specs/data-platform-cli-coverage-baseline.json`

**Interfaces:**
- `validateExecutionTargets(targets) -> normalized targets`.
- `resolveRuntimeTargets(definition, input, result) -> [{ kind, provider|engine, role? }]`.
- Allowed API providers: `external-api`, `model-provider`, `service-runtime`.
- Allowed database engines: `mysql`, `postgresql`, `oracle`, `dm`; local-only definitions use `{ kind:"local" }`.

- [ ] **Step 1: Write failing classification tests**

```js
assert.throws(() => registry.register({ ...business, executionTargets: [] }), /executionTargets/);
assert.throws(() => validateExecutionTargets([{ kind: "database", engine: "sql" }]), /unsupported database engine/);
assert.deepEqual(validateExecutionTargets([
  { kind: "api", provider: "external-api" },
  { kind: "database", engine: "postgresql", role: "business-datasource" }
]), [
  { kind: "api", provider: "external-api" },
  { kind: "database", engine: "postgresql", role: "business-datasource" }
]);
```

- [ ] **Step 2: Run and observe failure**

Run: `node --test packages/data-platform-cli/tests/execution-targets.test.js`

Expected: FAIL because execution target validation is absent.

- [ ] **Step 3: Implement validation and JSON evidence**

Reject unknown keys with Zod strict objects. Deduplicate exact targets. Require non-local business commands to include `api` or `database`. Add actual runtime targets to `meta.executionTargets`; dynamic datasource commands replace declared engine candidates with the engine resolved from datasource configuration.

- [ ] **Step 4: Regenerate and verify the design baseline**

Run:

```bash
node scripts/generate-cli-coverage-baseline.js '/Users/sushi/Downloads/data-platform-dev/source/api-inventory.json' docs/superpowers/specs/data-platform-cli-coverage-baseline.json
jq -e '.gates.unclassifiedBusinessCommands == 0 and .gates.apiClassified > 0 and .gates.databaseClassified.mysql > 0 and .gates.databaseClassified.postgresql > 0 and .gates.databaseClassified.oracle > 0 and .gates.databaseClassified.dm > 0' docs/superpowers/specs/data-platform-cli-coverage-baseline.json
```

Expected: PASS.

- [ ] **Step 5: Commit classification**

```bash
git add packages/data-platform-cli/src/registry packages/data-platform-cli/tests/execution-targets.test.js scripts/generate-cli-coverage-baseline.js docs/superpowers/specs/data-platform-cli-coverage-baseline.json
git commit -m "feat(cli): classify API and database command targets"
```

### Task 11: Add Audit, Idempotency, Outbox, Inbox, and Durable Job Schema

**Files:**
- Create: `backend/src/infrastructure/cli-runtime/cli-runtime.migration.js`
- Create: `backend/src/infrastructure/cli-runtime/command.repository.js`
- Create: `backend/src/infrastructure/cli-runtime/event.repository.js`
- Create: `backend/src/infrastructure/cli-runtime/job.repository.js`
- Create: `backend/src/infrastructure/cli-runtime/cli-runtime.test.js`
- Modify: `backend/src/database/migrate.js`
- Modify: `backend/src/application/runtime/execution-context.js`

**Interfaces:**
- `acceptCommand({ idempotencyKey, capabilityId, actor, projectId, inputDigest }, connection)`.
- `appendEvent({ eventId, eventType, aggregate, payload, auditId, commandId }, connection)`.
- `enqueueJob({ type, input, actor, projectId, maxAttempts }, connection)`.
- Job states: `pending`, `running`, `waiting_approval`, `compensating`, `succeeded`, `failed`.

- [ ] **Step 1: Write failing migration/repository tests**

Tests use a disposable MySQL schema and assert one transaction can write business fixture data, command acceptance, audit, and Outbox; forced failure rolls all four back. Duplicate `(project_id, capability_id, idempotency_key)` returns the original result reference. Event payload is immutable while delivery attempts live in a separate table.

- [ ] **Step 2: Run and observe failure**

Run: `node --test backend/src/infrastructure/cli-runtime/cli-runtime.test.js`

Expected: FAIL because migration and repositories are missing.

- [ ] **Step 3: Implement exact tables and indexes**

Create tables `cli_commands`, `cli_audit_facts`, `domain_events`, `event_deliveries`, `event_inbox`, `durable_jobs`, `durable_job_attempts`, and `durable_job_approvals`. Use JSON columns only for redacted contracts; store payload SHA-256 separately. Add unique event ID, idempotency key, Inbox consumer/event, job lease, and project/time indexes.

- [ ] **Step 4: Integrate transaction wrapper**

`execution-context.js` exposes `context.transaction(handler)` and ensures command acceptance, business mutation, audit, event append, and result fixation share the injected MySQL connection.

- [ ] **Step 5: Run tests and commit**

Run: `node --test backend/src/infrastructure/cli-runtime/cli-runtime.test.js backend/src/database/migrate.test.js`

Expected: PASS.

```bash
git add backend/src/infrastructure/cli-runtime backend/src/database backend/src/application/runtime/execution-context.js
git commit -m "feat(core): persist CLI audit events and durable jobs"
```

### Task 12: Implement Kafka Delivery and No-HTTP Daemon

**Files:**
- Create: `backend/src/infrastructure/cli-runtime/outbox-publisher.js`
- Create: `backend/src/infrastructure/cli-runtime/inbox-consumer.js`
- Create: `backend/src/infrastructure/cli-runtime/job-worker.js`
- Create: `backend/src/infrastructure/cli-runtime/daemon-runtime.js`
- Create: `backend/src/infrastructure/cli-runtime/daemon-runtime.test.js`
- Create: `packages/data-platform-cli/src/daemon/process-manager.js`
- Create: `packages/data-platform-cli/src/commands/daemon.js`
- Create: `packages/data-platform-cli/tests/daemon.test.js`

**Interfaces:**
- `publishBatch({ limit, leaseMs }) -> { claimed, published, failed }`.
- `consumeEvent(consumerName, event, handler) -> duplicate-safe result`.
- `claimJobs({ workerId, limit, leaseMs }) -> jobs`.
- CLI: `daemon start|run|status|logs|restart|stop`.

- [ ] **Step 1: Write failing fault-injection tests**

Test publish-after-commit, duplicate Kafka delivery, ordered entity keys, retry backoff, dead-letter transition, expired lease reclaim, graceful shutdown, PID lock, and assertion that no network listener is opened.

- [ ] **Step 2: Run and observe failure**

Run: `node --test backend/src/infrastructure/cli-runtime/daemon-runtime.test.js packages/data-platform-cli/tests/daemon.test.js`

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement publisher, consumer, worker, and process control**

Kafka key is `${projectId}:${aggregateType}:${aggregateId}`. Inbox insert and projection mutation share a MySQL transaction. PID/lock/log files are profile-scoped in the CLI data directory. `daemon run` starts existing schedulers plus publisher/consumer/job loops, never imports `app.js` or calls `listen()`.

- [ ] **Step 4: Run tests and commit**

```bash
node --test backend/src/infrastructure/cli-runtime/daemon-runtime.test.js packages/data-platform-cli/tests/daemon.test.js
git add backend/src/infrastructure/cli-runtime packages/data-platform-cli/src/daemon packages/data-platform-cli/src/commands/daemon.js packages/data-platform-cli/tests/daemon.test.js
git commit -m "feat(cli): add durable no-HTTP daemon"
```

### Task 13: Build All Domain Application-Capability Adapters

**Files:**
- Create: `backend/src/application/capabilities/auth.js`
- Create: `backend/src/application/capabilities/projects.js`
- Create: `backend/src/application/capabilities/platform.js`
- Create: `backend/src/application/capabilities/asset-search.js`
- Create: `backend/src/application/capabilities/data-map.js`
- Create: `backend/src/application/capabilities/data-standards.js`
- Create: `backend/src/application/capabilities/data-sources.js`
- Create: `backend/src/application/capabilities/data-source-research.js`
- Create: `backend/src/application/capabilities/data-modeling-sources.js`
- Create: `backend/src/application/capabilities/ingestion-tasks.js`
- Create: `backend/src/application/capabilities/file-imports.js`
- Create: `backend/src/application/capabilities/model-providers.js`
- Create: `backend/src/application/capabilities/ai-configs.js`
- Create: `backend/src/application/capabilities/system-management.js`
- Create: `backend/src/application/capabilities/system-knowledge-bases.js`
- Create: `backend/src/application/capabilities/data-development.js`
- Create: `backend/src/application/capabilities/data-modeling.js`
- Create: `backend/src/application/capabilities/quality-control.js`
- Create: `backend/src/application/capabilities/data-services.js`
- Create: `backend/src/application/capabilities/reporting.js`
- Create: `backend/src/application/capabilities/index.js`
- Create: `backend/src/application/capabilities/capabilities.contract.test.js`
- Modify: corresponding `backend/src/modules/*/*.controller.js`

**Interfaces:**
- Every capability exports `(input, context) -> Promise<ResultDTO>` and never accepts `req` or `res`.
- Capability catalog exports `{ capabilityId, handler, inputSchema, outputSchema, modules, action, executionTargets, sourceApiKeys, sourceFrontendKeys }[]`.
- Controllers translate HTTP input/output only; CLI definitions call the same handler.

- [ ] **Step 1: Generate a failing 596-key contract test**

Load the coverage baseline and application capability catalog. Assert every API key occurs exactly once or in an explicit alias set; call each handler with schema-valid generated fixture and injected fake services; reject any handler importing a controller or Express.

- [ ] **Step 2: Run and observe coverage failure**

Run: `node --test backend/src/application/capabilities/capabilities.contract.test.js`

Expected: FAIL listing all missing API keys.

- [ ] **Step 3: Extract controller orchestration domain by domain**

For each listed file, move service orchestration into the capability handler and keep response formatting in the controller. Preserve validation schemas and status semantics. File upload capabilities accept `{ files:[{ path, originalName, mimeType, size, sha256 }], fields }`; downloads return `{ path, filename, mimeType, sha256, size }`; streams return an async iterable of typed events.

- [ ] **Step 4: Rerun contract and Web tests after each domain commit**

Run:

```bash
node --test backend/src/application/capabilities/capabilities.contract.test.js
cd backend && npm test
```

Expected at task completion: 596 source keys accounted for and all Web tests pass.

- [ ] **Step 5: Commit complete shared capability layer**

```bash
git add backend/src/application/capabilities backend/src/modules
git commit -m "refactor(core): expose all platform use cases as shared capabilities"
```

### Task 14: Generate and Bind the Full CLI Command Tree

**Files:**
- Create: `packages/data-platform-cli/src/registry/domain-commands.js`
- Create: `packages/data-platform-cli/src/commands/file-io.js`
- Create: `packages/data-platform-cli/src/commands/job.js`
- Create: `packages/data-platform-cli/src/commands/event.js`
- Create: `packages/data-platform-cli/src/commands/audit.js`
- Create: `packages/data-platform-cli/src/commands/reconcile.js`
- Create: `packages/data-platform-cli/tests/full-command-tree.test.js`
- Modify: `packages/data-platform-cli/src/main.js`

**Interfaces:**
- `createDomainCommands(capabilityCatalog) -> CommandDefinition[]`.
- `executeCapability(capabilityId, parsedInput, cliContext) -> envelope`.
- File adapters validate paths before handler call and never place binary data on stdout.

- [ ] **Step 1: Write failing command-tree tests**

Assert all 596 API keys and 84 frontend keys are represented, all command help renders, aliases are explicit, dangerous definitions require `--yes`, streams use NDJSON, downloads require `--output`, and long jobs expose `--wait/--timeout`.

- [ ] **Step 2: Run and observe failure**

Run: `node --test packages/data-platform-cli/tests/full-command-tree.test.js`

Expected: FAIL with missing source keys.

- [ ] **Step 3: Bind catalog to hierarchical Commander commands**

Use capability IDs to produce the approved domain groups. Complex payloads accept `--file` JSON/YAML. Positional IDs and query flags are defined by each input schema. CLI execution passes through shared context, transaction/idempotency, audit, and output renderer.

- [ ] **Step 4: Run full tree and installed help tests**

Run: `node --test packages/data-platform-cli/tests/full-command-tree.test.js packages/data-platform-cli/tests/full-e2e.test.js`

Expected: PASS with 596/596 and 84/84 registry coverage.

- [ ] **Step 5: Commit full command tree**

```bash
git add packages/data-platform-cli/src packages/data-platform-cli/tests/full-command-tree.test.js
git commit -m "feat(cli): expose every platform capability as commands"
```

### Task 15: Complete Four-Engine Database Adapter Contract

**Files:**
- Modify: `backend/src/modules/data-development/adapters/mysql.adapter.js`
- Modify: `backend/src/modules/data-development/adapters/postgres.adapter.js`
- Modify: `backend/src/modules/data-development/adapters/managed-jdbc.adapter.js`
- Modify: `backend/src/common/utils/datasource-capabilities.js`
- Modify: `backend/src/common/utils/datasource-dialect.js`
- Create: `backend/src/application/capabilities/database-contract.js`
- Create: `backend/src/application/capabilities/database-contract.test.js`
- Create: `packages/data-platform-cli/tests/database-gate.test.js`

**Interfaces:**
- `databaseAdapter(engine) -> { testConnection, listSchemas, listTables, listColumns, sample, execute, begin, commit, rollback }`.
- Engines: MySQL native; PostgreSQL native/JDBC; Oracle and DM through managed JDBC or configured native adapter.
- Errors normalize to `DATABASE_DRIVER_MISSING`, `DATABASE_CONNECTION_FAILED`, `DATABASE_QUERY_FAILED`, or `DATABASE_TRANSACTION_FAILED`.

- [ ] **Step 1: Write a shared failing adapter contract**

The same contract checks identifier quoting, placeholder style, pagination, type normalization, transaction rollback, connection cleanup, and secret redaction for all four adapters. Add Oracle service-name/SID and DM JDBC URL fixtures.

- [ ] **Step 2: Run and observe engine gaps**

Run: `node --test backend/src/application/capabilities/database-contract.test.js`

Expected: FAIL with missing or inconsistent adapter methods.

- [ ] **Step 3: Normalize adapters and dialects**

MySQL uses backticks and `?`; PostgreSQL uses double quotes and `$n`; Oracle uses double quotes and `:n` plus OFFSET/FETCH; DM uses double quotes and its verified pagination/bind contract. Discovery respects `public` for PostgreSQL and explicit/uppercase schemas for Oracle/DM.

- [ ] **Step 4: Implement real-engine gate harness**

`database-gate.test.js` reads connection references from keychain-backed test profiles, creates uniquely named test schemas/tables, executes classified commands, rolls back destructive fixtures, and prints only redacted evidence. It must refuse mock adapters when `CLI_DATABASE_GATE=1`.

- [ ] **Step 5: Run adapter unit contract and commit**

Run: `node --test backend/src/application/capabilities/database-contract.test.js`

Expected: PASS for dialect/unit contract; real gate runs at final Task 18.

```bash
git add backend/src/modules/data-development/adapters backend/src/common/utils backend/src/application/capabilities/database-contract* packages/data-platform-cli/tests/database-gate.test.js
git commit -m "feat(cli): normalize MySQL PostgreSQL Oracle and DM access"
```

### Task 16: Implement Ontology Facades and Aviation Acceptance Job

**Files:**
- Create: `backend/src/application/ontology/contract.js`
- Create: `backend/src/application/ontology/lineage.js`
- Create: `backend/src/application/ontology/graph.js`
- Create: `backend/src/application/ontology/simulation.js`
- Create: `backend/src/application/ontology/aviation-acceptance.js`
- Create: `backend/src/application/ontology/aviation-acceptance.test.js`
- Create: `packages/data-platform-cli/src/commands/ontology.js`
- Create: `packages/data-platform-cli/src/commands/aviation-acceptance.js`
- Create: `packages/data-platform-cli/tests/aviation-acceptance.test.js`

**Interfaces:**
- Commands exactly match `aviation-ontology-cli-acceptance.json`.
- Acceptance run persists seven checkpoints and produces `preflight`, `ingestion`, `red`, `governance`, `ontology`, `platform-load`, and `green` evidence.
- Graph verify compares contract nodes/edges to embedded HTML data; simulation verify checks decision-rule references.

- [ ] **Step 1: Write failing seven-stage tests**

Use historical Demo contract fixtures but inject dynamic project/data-source IDs. Test project mismatch, zero metadata/resource counts, dangling endpoints, knowledge not ready, wrong reporting source, partial governance, forbidden bypass, and unavailable dependency false-success rejection.

- [ ] **Step 2: Run and observe failure**

Run: `node --test backend/src/application/ontology/aviation-acceptance.test.js packages/data-platform-cli/tests/aviation-acceptance.test.js`

Expected: FAIL with missing ontology modules.

- [ ] **Step 3: Implement contract, lineage, graph, simulation, and orchestration**

Use versioned JSON as the semantic authority. Run all platform work through registered capabilities. Record executed capability IDs and process audit; reject curl/browser/database-client/bootstrap evidence. Generate self-contained HTML with embedded normalized contract and deterministic hashes.

- [ ] **Step 4: Run ontology tests and commit**

```bash
node --test backend/src/application/ontology/aviation-acceptance.test.js packages/data-platform-cli/tests/aviation-acceptance.test.js
git add backend/src/application/ontology packages/data-platform-cli/src/commands/ontology.js packages/data-platform-cli/src/commands/aviation-acceptance.js packages/data-platform-cli/tests/aviation-acceptance.test.js
git commit -m "feat(cli): add aviation ontology acceptance workflow"
```

### Task 17: Test Gate 1 — External API Invocation

**Files:**
- Create: `packages/data-platform-cli/tests/api-gate.test.js`
- Create: `packages/data-platform-cli/tests/fixtures/external-api-server.js`
- Create: `packages/data-platform-cli/tests/fixtures/model-provider-server.js`
- Create: `packages/data-platform-cli/tests/fixtures/service-runtime-contract.json`
- Modify: `packages/data-platform-cli/tests/TEST.md`

**Interfaces:**
- Gate enumerates registry definitions containing `executionTargets.kind === "api"` and requires evidence for each capability ID.
- Controlled external servers support success, pagination, rate limit, timeout, malformed response, streaming, cancellation, and retry scenarios.

- [ ] **Step 1: Write the gate and verify it fails on untested commands**

Run: `CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js`

Expected before evidence completion: FAIL listing classified API capability IDs without tests.

- [ ] **Step 2: Add command-level cases for every classified API capability**

Invoke the installed `data-platform` binary for external API source operations, ingestion, model calls, AI/analysis commands, and service runtime. Assert JSON/NDJSON, retry counts, audit/event IDs, cancellation, idempotency, and redaction. No test may call Data Platform HTTP.

- [ ] **Step 3: Run complete API gate**

Run:

```bash
cd packages/data-platform-cli
npm test
CLI_API_GATE=1 node --test tests/api-gate.test.js
```

Expected: API classified count equals tested count; untested 0; bypass 0; secret findings 0.

- [ ] **Step 4: Persist evidence and commit**

Append full output and environment fingerprints to `TEST.md`.

```bash
git add packages/data-platform-cli/tests packages/data-platform-cli/tests/TEST.md
git commit -m "test(cli): pass external API command gate"
```

### Task 18: Test Gate 2 — MySQL, PostgreSQL, Oracle, and DM

**Files:**
- Modify: `packages/data-platform-cli/tests/database-gate.test.js`
- Create: `packages/data-platform-cli/tests/fixtures/database-contracts/mysql.json`
- Create: `packages/data-platform-cli/tests/fixtures/database-contracts/postgresql.json`
- Create: `packages/data-platform-cli/tests/fixtures/database-contracts/oracle.json`
- Create: `packages/data-platform-cli/tests/fixtures/database-contracts/dm.json`
- Modify: `packages/data-platform-cli/tests/TEST.md`

**Interfaces:**
- Gate enumerates registry definitions by database engine and requires command evidence for every classified capability.
- Profiles `test-mysql`, `test-postgresql`, `test-oracle`, and `test-dm` must resolve credentials via OS keychain.

- [ ] **Step 1: Run MySQL gate**

Run: `CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=mysql node --test packages/data-platform-cli/tests/database-gate.test.js`

Expected: all MySQL-classified capabilities tested; CRUD/query/transaction/project isolation/durable runtime pass.

- [ ] **Step 2: Run PostgreSQL gate**

Run: `CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=postgresql node --test packages/data-platform-cli/tests/database-gate.test.js`

Expected: all PostgreSQL-classified capabilities tested; ODS/DataX/JDBC/schema/dialect/rollback and aviation exceptional values pass.

- [ ] **Step 3: Run Oracle gate**

Run: `CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=oracle node --test packages/data-platform-cli/tests/database-gate.test.js`

Expected: all Oracle-classified capabilities tested against a real Oracle instance; service-name/SID/schema/bind/pagination/rollback pass.

- [ ] **Step 4: Run DM gate**

Run: `CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=dm node --test packages/data-platform-cli/tests/database-gate.test.js`

Expected: all DM-classified capabilities tested against a real DM instance; JDBC/schema/bind/pagination/rollback pass.

- [ ] **Step 5: Rerun aviation acceptance twice**

Run the installed CLI twice with the approved aviation contract. Expected: both succeed; second run adds no duplicate business keys; bypass count 0.

- [ ] **Step 6: Run final regression and packaging checks**

```bash
cd packages/data-platform-cli && npm test && npm run pack:check
cd ../../backend && npm test
cd ../frontend && npm run build
cd ..
node scripts/generate-cli-coverage-baseline.js '/Users/sushi/Downloads/data-platform-dev/source/api-inventory.json' /tmp/cli-coverage.final.json
cmp docs/superpowers/specs/data-platform-cli-coverage-baseline.json /tmp/cli-coverage.final.json
git diff --check
```

Expected: all exit 0, coverage is byte-identical, and no secret scan finding exists.

- [ ] **Step 7: Append evidence and commit single-stage completion**

Append full per-engine command counts, pass counts, versions, driver hashes, and redacted environment fingerprints to `TEST.md`.

```bash
git add packages/data-platform-cli/tests/TEST.md packages/data-platform-cli/tests/fixtures skills/cli-anything-data-platform/SKILL.md
git commit -m "test(cli): pass API and four-engine database gates"
```

## Plan Self-Review Result

- All implementation work belongs to one stage; there is no independent phase release.
- API means external API/model/service runtime and never Data Platform Express.
- Every business command is classified and composite commands enter both gates.
- MySQL, PostgreSQL, Oracle, and DM each require real integration evidence.
- Coverage, reliability, all business modules, ontology, aviation acceptance, packaging, Web regression, and frontend build are included.
- No placeholders remain; tasks define files, interfaces, failure observations, verification commands, expected results, and commit boundaries.
