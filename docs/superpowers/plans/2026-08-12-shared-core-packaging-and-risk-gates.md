# Data Platform Shared Core Packaging and Risk Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the globally installed CLI and Web backend consume the same independently packaged application core, migrate all 21 business modules behind exact module versions, and require per-module risk, rollback, and re-upgrade evidence before acceptance.

**Architecture:** An npm workspace contains a transport-neutral kernel, 21 independently versioned business module packages, an aggregate core package, the existing Web backend, and the CLI. Web and CLI depend only on the aggregate core; each module depends on the kernel and communicates across module boundaries through registered capability ports. Test-environment acceptance installs exact module tarballs from a local test registry, performs a real rollback to the previous accepted package, then re-installs the candidate and verifies idempotency.

**Tech Stack:** Node.js 22.20+, npm workspaces and lockfiles, CommonJS, Zod 3.24, MySQL2, pg, oracledb, dmdb/managed JDBC, KafkaJS, DataX, Node test runner, Verdaccio 6.9.2 bound to loopback for rollback tests.

## Global Constraints

- Business rollback granularity is one of the 21 existing business modules.
- Module migration directly replaces the legacy Service implementation; production has no runtime legacy/core router.
- Production has no shadow or canary path; gradual upgrade, rollback, and re-upgrade happen only in the test environment.
- Web, CLI, and daemon depend on `@johnason/data-platform-core`; they never import another package's `src` path.
- Kernel and module packages never import Express, Commander, `backend/src/app.js`, or the CLI keychain.
- Package versions are exact; `latest`, caret, tilde, git URL, workspace link, and file path dependencies are forbidden in acceptance manifests.
- A module is accepted only after every risk gate, actual previous-package rollback, data verification, and candidate re-upgrade passes.
- The first migration of each module publishes current behavior as exact version `0.1.0` with status `legacy-accepted`, then publishes the shared-core implementation as exact version `0.2.0` with status `core-candidate`; rollback evidence must install both real tarballs.
- Write commands are never replayed against an older implementation after transaction start or command acceptance.
- Database schema uses expand/contract and supports the candidate and previous accepted module version throughout the rollback window.
- Real MySQL, PostgreSQL, Oracle, and DM are mandatory where the module declares those execution targets; missing infrastructure blocks acceptance.
- Secrets never enter config, output, evidence, events, fixtures, manifests, lockfiles, or Git.
- Use TDD and observe each new test fail for the intended reason before implementation.

---

## File Structure

### Workspace and kernel

- `package.json`: private workspace root for `packages/*` and `backend`.
- `package-lock.json`: single exact workspace dependency graph.
- `packages/data-platform-core-kernel/package.json`: publishable kernel metadata.
- `packages/data-platform-core-kernel/src/runtime/database-runtime.js`: profile/request-scoped database runtime.
- `packages/data-platform-core-kernel/src/runtime/execution-context.js`: actor, project, permission, transaction, audit, and cleanup composition.
- `packages/data-platform-core-kernel/src/contracts/*`: capability, result, error, module manifest, and runtime-port schemas.
- `packages/data-platform-core-kernel/src/registry/*`: capability/module registration and version compatibility validation.
- `packages/data-platform-core-kernel/src/risk/*`: evidence schemas, dependency boundary scanner, and acceptance calculation.

### First extracted modules and aggregate

- `packages/data-platform-module-auth`: authentication and session capabilities.
- `packages/data-platform-module-project-spaces`: project and membership capabilities.
- `packages/data-platform-core`: aggregate manifest, capability catalog, exact module dependencies, and runtime factory.
- `backend/src/modules/auth/*`: Web controller/routes/schema plus compatibility exports to the auth package during migration.
- `backend/src/modules/project-spaces/*`: Web controller/routes/schema plus compatibility exports to the project package during migration.

### Remaining module packages

- `packages/data-platform-module-asset-search`
- `packages/data-platform-module-data-development`
- `packages/data-platform-module-data-lab`
- `packages/data-platform-module-data-lab-sources`
- `packages/data-platform-module-data-map`
- `packages/data-platform-module-data-services`
- `packages/data-platform-module-data-source-research`
- `packages/data-platform-module-data-sources`
- `packages/data-platform-module-data-standards`
- `packages/data-platform-module-dev-ai-configs`
- `packages/data-platform-module-file-imports`
- `packages/data-platform-module-ingestion-ai-configs`
- `packages/data-platform-module-ingestion-tasks`
- `packages/data-platform-module-model-providers`
- `packages/data-platform-module-platform`
- `packages/data-platform-module-quality-control`
- `packages/data-platform-module-reporting`
- `packages/data-platform-module-system-knowledge-base`
- `packages/data-platform-module-system-management`

### Acceptance and rollback tooling

- `scripts/check-core-package-boundaries.js`: dependency direction, cycles, source-path and transport import checks.
- `scripts/build-module-acceptance-manifest.js`: combines module evidence and lockfile integrity.
- `scripts/run-module-rollback-drill.js`: stops target workers, installs previous version, verifies, re-installs candidate, and verifies idempotency.
- `tests/module-acceptance/fixtures/verdaccio.yaml`: loopback-only, authentication-free disposable registry whose storage path is created per test and never committed.
- `tests/shared-core-install/*`: installed-from-tarball and arbitrary-working-directory tests.
- `tests/module-acceptance/`: one named directory per business module containing golden Web, CLI parity, execution target, failure injection, schema and rollback tests.
- `evidence/module-acceptance/`: generated redacted evidence grouped by module name and exact version; only explicitly approved evidence is committed.

---

### Task 1: Establish the Workspace and Publishable Kernel Boundary

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `packages/data-platform-core-kernel/package.json`
- Create: `packages/data-platform-core-kernel/src/index.js`
- Create: `packages/data-platform-core-kernel/src/contracts/module-manifest.js`
- Create: `packages/data-platform-core-kernel/tests/package-boundary.test.js`
- Modify: `backend/package.json`
- Modify: `packages/data-platform-cli/package.json`

**Interfaces:**
- `validateModuleManifest(input) -> { moduleName, moduleVersion, capabilitySchemaVersion, capabilities }`.
- `moduleDefinition` uses exact semantic versions and immutable capability metadata.
- Workspace packages resolve during development, but package acceptance consumes packed tarballs.

- [ ] **Step 1: Write the failing kernel package test**

```js
test("kernel is publishable and transport neutral", () => {
  const pkg = readPackage("packages/data-platform-core-kernel/package.json");
  assert.equal(pkg.name, "@johnason/data-platform-core-kernel");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src"]);
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.commander, undefined);
});

test("module manifest rejects non-exact versions", () => {
  assert.throws(() => validateModuleManifest({
    moduleName: "auth",
    moduleVersion: "^0.1.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: [],
  }), /exact version/i);
});
```

- [ ] **Step 2: Run and verify the intended failure**

Run: `node --test packages/data-platform-core-kernel/tests/package-boundary.test.js`

Expected: FAIL because the kernel package and manifest validator do not exist.

- [ ] **Step 3: Implement the root workspace and strict manifest schema**

Root package:

```json
{
  "name": "johnason-data-platform-workspace",
  "private": true,
  "workspaces": ["packages/*", "backend"],
  "engines": { "node": ">=22.20.0" },
  "scripts": {
    "test:core": "npm test --workspaces --if-present",
    "check:boundaries": "node scripts/check-core-package-boundaries.js"
  },
  "devDependencies": {
    "verdaccio": "6.9.2"
  }
}
```

The manifest Zod schema accepts only `/^\d+\.\d+\.\d+$/` versions, unique capability IDs, and immutable arrays of source keys/execution targets.

- [ ] **Step 4: Run workspace installation and tests**

Run:

```bash
npm install
node --test packages/data-platform-core-kernel/tests/package-boundary.test.js
npm --workspace @johnason/data-platform-core-kernel pack --dry-run
```

Expected: PASS; tarball contains kernel `src` and package metadata only.

- [ ] **Step 5: Commit the package boundary**

```bash
git add package.json package-lock.json packages/data-platform-core-kernel backend/package.json packages/data-platform-cli/package.json
git commit -m "feat(core): establish publishable shared kernel"
```

### Task 2: Enforce Dependency Direction and Independent Installation

**Files:**
- Create: `scripts/check-core-package-boundaries.js`
- Create: `tests/shared-core-install/package-boundaries.test.js`
- Create: `tests/shared-core-install/independent-install.test.js`
- Modify: `package.json`

**Interfaces:**
- `scanPackageBoundaries(root) -> { violations, cycles, sourceImports }`.
- Violation codes: `TRANSPORT_IMPORT`, `SOURCE_PATH_IMPORT`, `REVERSE_DEPENDENCY`, `CYCLE`, `NON_EXACT_VERSION`.

- [ ] **Step 1: Write failing behavior tests with disposable fixture packages**

Create fixtures at test runtime and assert that kernel importing Express, CLI importing `../../backend/src`, module A importing module B's `src`, a kernel-to-module dependency, and a package cycle each produce the exact violation code. A valid Web/CLI → aggregate → modules → kernel graph returns empty arrays.

- [ ] **Step 2: Run and observe missing scanner failure**

Run: `node --test tests/shared-core-install/package-boundaries.test.js`

Expected: FAIL because `scanPackageBoundaries` is absent.

- [ ] **Step 3: Implement package.json and CommonJS import scanning**

Resolve internal package dependencies by package name, parse literal `require()` targets, reject `/src/` cross-package imports, and run a depth-first cycle check. Scanner output is deterministic and contains only repository-relative paths.

- [ ] **Step 4: Test tarball-only installation**

Pack kernel into a temporary directory, install it under a temporary prefix, run `require("@johnason/data-platform-core-kernel")` from another cwd, and assert no file outside the temporary prefix is opened by the test process.

Run: `node --test tests/shared-core-install/*.test.js`

Expected: PASS.

- [ ] **Step 5: Commit dependency enforcement**

```bash
git add scripts/check-core-package-boundaries.js tests/shared-core-install package.json
git commit -m "test(core): enforce package dependency boundaries"
```

### Task 3: Move Database Runtime and Execution Contracts into the Kernel

**Files:**
- Create: `packages/data-platform-core-kernel/src/runtime/database-runtime.js`
- Create: `packages/data-platform-core-kernel/src/runtime/execution-context.js`
- Create: `packages/data-platform-core-kernel/src/contracts/errors.js`
- Create: `packages/data-platform-core-kernel/tests/database-runtime.test.js`
- Create: `packages/data-platform-cli/src/runtime/database.js`
- Create: `packages/data-platform-cli/tests/database-runtime.test.js`
- Modify: `backend/src/config/database.js`

**Interfaces:**
- `createDatabaseRuntime(config, mysqlImpl) -> { pool, testConnection, close }`.
- `runWithDatabaseRuntime(runtime, callback) -> Promise<T>`.
- `getDatabaseRuntime() -> runtime`; throws `DATABASE_RUNTIME_MISSING` without an active/default runtime.
- `runWithExecutionContext(context, callback) -> Promise<T>`.
- CLI `createProfileDatabaseRuntime(profile, keychain, mysqlImpl) -> runtime`.

- [ ] **Step 1: Write failing concurrent-isolation and cleanup tests**

Test two concurrent `AsyncLocalStorage` callbacks with pools `a` and `b`; nested calls must return `a` and `b` respectively. Test `close()` exactly once after success and failure, default Web runtime compatibility, missing runtime failure, and CLI password retrieval only through keychain.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test packages/data-platform-core-kernel/tests/database-runtime.test.js packages/data-platform-cli/tests/database-runtime.test.js
```

Expected: FAIL with missing runtime modules.

- [ ] **Step 3: Implement runtime and Web compatibility exports**

Kernel owns `AsyncLocalStorage`. `backend/src/config/database.js` creates one Web runtime and continues exporting `{ pool, testConnection }` so unmigrated modules retain behavior. CLI creates a pool from non-secret profile fields plus the keychain password and never persists the composed config.

- [ ] **Step 4: Run focused, CLI, and backend regression tests**

```bash
node --test packages/data-platform-core-kernel/tests/database-runtime.test.js packages/data-platform-cli/tests/database-runtime.test.js
cd backend && npm test
```

Expected: all focused tests and the backend suite pass.

- [ ] **Step 5: Commit runtime extraction**

```bash
git add packages/data-platform-core-kernel/src/runtime packages/data-platform-core-kernel/src/contracts packages/data-platform-core-kernel/tests packages/data-platform-cli/src/runtime/database.js packages/data-platform-cli/tests/database-runtime.test.js backend/src/config/database.js
git commit -m "refactor(core): share profile scoped database runtime"
```

### Task 4: Extract and Package Authentication

**Files:**
- Create: `packages/data-platform-module-auth/package.json`
- Create: `packages/data-platform-module-auth/src/auth.repository.js`
- Create: `packages/data-platform-module-auth/src/auth-session.repository.js`
- Create: `packages/data-platform-module-auth/src/auth.service.js`
- Create: `packages/data-platform-module-auth/src/session-policy.js`
- Create: `packages/data-platform-module-auth/src/index.js`
- Create: `packages/data-platform-module-auth/tests/auth.contract.test.js`
- Modify: `backend/src/modules/auth/auth.repository.js`
- Modify: `backend/src/modules/auth/auth-session.repository.js`
- Modify: `backend/src/modules/auth/auth.service.js`
- Modify: `backend/src/modules/auth/auth.controller.js`

**Interfaces:**
- Module exports `moduleManifest`, `createAuthCapabilities(dependencies)`, and compatibility service/repository factories.
- Capabilities: `auth.login`, `auth.profile`, `auth.logout`.
- Dependencies include `databaseRuntime`, `jwtCodec`, `passwordHasher`, `clock`, and `idGenerator`.

- [ ] **Step 1: Publish the authentication legacy baseline and capture its contract**

Package current transport-neutral auth behavior as `@johnason/data-platform-module-auth@0.1.0`; replace only repository-global dependencies with explicit legacy adapter ports. Publish the tarball to the loopback test registry and mark it `legacy-accepted` after the existing backend suite and golden fixtures pass. Golden fixtures cover active login, wrong password, disabled user, revoked session, logout, transaction rollback, token/user mismatch, response DTO, and secret redaction. Change package version to `0.2.0`, then write a test that invokes the wished-for shared-core capability and compares its domain result to the `0.1.0` golden baseline.

- [ ] **Step 2: Run and observe module-not-found failure**

Run: `node --test packages/data-platform-module-auth/tests/auth.contract.test.js`

Expected: FAIL because `0.2.0` does not yet expose the transport-neutral capability factory.

- [ ] **Step 3: Move transport-neutral auth code and inject dependencies**

Repositories call `getDatabaseRuntime().pool`; service does not import `config/env` or a global pool. JWT secret/expiry remain Web/CLI runtime configuration and enter through `jwtCodec`. Existing backend files re-export the `0.2.0` package entry points while routes/controllers retain HTTP translation. Keep the published `0.1.0` tarball unchanged for rollback.

- [ ] **Step 4: Verify package, Web compatibility, and no transport imports**

```bash
node --test packages/data-platform-module-auth/tests/auth.contract.test.js
node scripts/check-core-package-boundaries.js
cd backend && npm test
```

Expected: PASS; auth package has no Express/Commander/source-path violations.

- [ ] **Step 5: Commit the auth module**

```bash
git add packages/data-platform-module-auth backend/src/modules/auth
git commit -m "refactor(core): package authentication capabilities"
```

### Task 5: Extract and Package Project Context and Access Policies

**Files:**
- Create: `packages/data-platform-module-project-spaces/package.json`
- Create: `packages/data-platform-module-project-spaces/src/project-space.repository.js`
- Create: `packages/data-platform-module-project-spaces/src/project-space.service.js`
- Create: `packages/data-platform-module-project-spaces/src/project-policy.js`
- Create: `packages/data-platform-module-project-spaces/src/index.js`
- Create: `packages/data-platform-module-project-spaces/tests/project.contract.test.js`
- Create: `packages/data-platform-core-kernel/src/runtime/authorization-policy.js`
- Create: `packages/data-platform-core-kernel/src/runtime/license-policy.js`
- Create: `packages/data-platform-core-kernel/src/runtime/activation-policy.js`
- Modify: `backend/src/modules/project-spaces/project-space.repository.js`
- Modify: `backend/src/modules/project-spaces/project-space.service.js`
- Modify: `backend/src/common/middleware/auth.js`
- Modify: `backend/src/common/middleware/license-feature.js`
- Modify: `backend/src/common/middleware/activation.js`

**Interfaces:**
- `authorizeCapability(actor, { modules, action, readOnlyAllowed })`.
- `resolveProject(actor, requestedProjectId, projectService) -> { project, member }`.
- Module capabilities cover project list/current/resolve/use/access-check and source API keys from the coverage baseline.

- [ ] **Step 1: Publish the project legacy baseline and write failing candidate tests**

Package current transport-neutral project behavior as `@johnason/data-platform-module-project-spaces@0.1.0`, publish it to the loopback registry, and mark it `legacy-accepted` after Web golden tests pass. Change the package to `0.2.0` and write failing candidate tests covering admin, viewer write rejection, module permission rejection, missing membership, disabled project, concurrent project contexts, default project selection, zero/multiple resolve results, and exact Web response compatibility.

- [ ] **Step 2: Run and verify expected failure**

Run:

```bash
node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/execution-context.test.js
```

Expected: FAIL because packaged project policies are absent.

- [ ] **Step 3: Implement policies and adapt Web middleware**

Controller/middleware translates HTTP input/output only. Kernel errors include stable `code`, `statusCode`, `retryable`, and redacted details. Preserve `req.user`, `req.project`, `req.projectId`, and `req.projectMember`.

- [ ] **Step 4: Run contracts, boundary scan, and Web tests**

```bash
node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/*.test.js
node scripts/check-core-package-boundaries.js
cd backend && npm test
```

Expected: PASS.

- [ ] **Step 5: Commit project and policy extraction**

```bash
git add packages/data-platform-module-project-spaces packages/data-platform-core-kernel/src/runtime backend/src/modules/project-spaces backend/src/common/middleware
git commit -m "refactor(core): package project and access policies"
```

### Task 6: Build the Aggregate Core and Bind Web/CLI to Packed Packages

**Files:**
- Create: `packages/data-platform-core/package.json`
- Create: `packages/data-platform-core/src/module-manifest.json`
- Create: `packages/data-platform-core/src/catalog.js`
- Create: `packages/data-platform-core/src/runtime.js`
- Create: `packages/data-platform-core/tests/catalog.test.js`
- Modify: `backend/package.json`
- Modify: `packages/data-platform-cli/package.json`
- Modify: `packages/data-platform-cli/src/main.js`
- Create: `tests/shared-core-install/aggregate-install.test.js`

**Interfaces:**
- `createDataPlatformCore(runtimeDependencies) -> { catalog, execute, moduleVersions }`.
- `catalog.get(capabilityId)` returns exactly one definition.
- `execute(capabilityId, input, context)` validates schemas and calls the selected module capability.

- [ ] **Step 1: Write failing aggregate uniqueness and version tests**

Reject duplicate capability IDs, duplicate source API keys without aliases, manifest/lock/export version mismatch, incompatible capability schema, and a missing required module. Assert auth/project capabilities execute from an installed aggregate tarball in an arbitrary cwd.

- [ ] **Step 2: Run and observe missing aggregate failure**

Run: `node --test packages/data-platform-core/tests/catalog.test.js tests/shared-core-install/aggregate-install.test.js`

Expected: FAIL because aggregate package does not exist.

- [ ] **Step 3: Implement aggregate catalog and exact dependencies**

Initial aggregate contains the auth/project `0.2.0` candidates and records their `0.1.0` rollback versions; every subsequent module task updates the manifest and exact dependencies. CLI constructs runtime dependencies from profile/keychain. Web constructs runtime dependencies from environment/config without importing CLI.

- [ ] **Step 4: Pack and install kernel, modules, aggregate, and CLI**

Use a disposable local npm registry; publish versioned tarballs, install CLI in a new prefix, run from another cwd, and assert loading never opens a repository path or starts an Express listener.

- [ ] **Step 5: Commit aggregate and consumer binding**

```bash
git add packages/data-platform-core backend/package.json packages/data-platform-cli tests/shared-core-install
git commit -m "feat(core): aggregate shared capabilities for web and CLI"
```

### Task 7: Implement Risk Evidence and Acceptance Calculation

**Files:**
- Create: `packages/data-platform-core-kernel/src/risk/evidence-schema.js`
- Create: `packages/data-platform-core-kernel/src/risk/acceptance.js`
- Create: `packages/data-platform-core-kernel/tests/risk-acceptance.test.js`
- Create: `scripts/build-module-acceptance-manifest.js`
- Create: `tests/module-acceptance/evidence.test.js`

**Interfaces:**
- Risk gates: `dependencyBoundary`, `runtimeIsolation`, `transaction`, `webCompatibility`, `cliParity`, `executionTargets`, `faultInjection`, `packageInstall`, `schemaCompatibility`, `rollbackDrill`, `reUpgradeIdempotency`.
- `evaluateModuleEvidence(evidence) -> { accepted, status, failures }`.
- Status: `legacy-accepted`, `core-candidate`, `testing`, `rollback-drill`, `re-upgrade`, `accepted`, `blocked`, `failed`.

- [ ] **Step 1: Write failing strict evidence tests**

Accept only all-`passed`, zero-failure, zero-secret evidence. Reject skipped gates, unknown gates, mock Oracle/DM evidence, missing package integrity, version mismatch, timestamps in reverse order, plaintext secret-shaped fields, and `accepted:true` when calculation is false.

- [ ] **Step 2: Run and observe missing evaluator failure**

Run: `node --test packages/data-platform-core-kernel/tests/risk-acceptance.test.js tests/module-acceptance/evidence.test.js`

Expected: FAIL because evidence schema/evaluator is absent.

- [ ] **Step 3: Implement evidence normalization and manifest builder**

Evidence stores commands, versions, redacted environment fingerprints, counts, durations, and artifact hashes. Acceptance is computed, never trusted from input. Builder verifies lockfile integrity and installed package exports before emitting aggregate acceptance.

- [ ] **Step 4: Run evidence and secret scans**

Run:

```bash
node --test packages/data-platform-core-kernel/tests/risk-acceptance.test.js tests/module-acceptance/evidence.test.js
node scripts/build-module-acceptance-manifest.js --verify-only
```

Expected: PASS with no accepted modules until rollback evidence exists.

- [ ] **Step 5: Commit evidence gates**

```bash
git add packages/data-platform-core-kernel/src/risk packages/data-platform-core-kernel/tests/risk-acceptance.test.js scripts/build-module-acceptance-manifest.js tests/module-acceptance
git commit -m "feat(core): enforce module risk acceptance evidence"
```

### Task 8: Implement Real Package Rollback and Re-Upgrade Drill

**Files:**
- Create: `scripts/run-module-rollback-drill.js`
- Create: `tests/module-acceptance/rollback-drill.test.js`
- Create: `tests/module-acceptance/fixtures/test-module-v1/package.json`
- Create: `tests/module-acceptance/fixtures/test-module-v1/index.js`
- Create: `tests/module-acceptance/fixtures/test-module-v2/package.json`
- Create: `tests/module-acceptance/fixtures/test-module-v2/index.js`
- Create: `tests/module-acceptance/fixtures/verdaccio.yaml`
- Create: `docs/operations/module-rollback-runbook.md`

**Interfaces:**
- `runRollbackDrill({ moduleName, candidateVersion, rollbackVersion, registryUrl, commands, evidenceDir })`.
- Exit codes: `0 accepted`, `7 infrastructure blocked`, `1 validation/rollback/re-upgrade failure`.

- [ ] **Step 1: Write failing disposable-registry rollback tests**

Start Verdaccio 6.9.2 on an operating-system-assigned loopback port with temporary storage. Publish fixture `0.1.0` and `0.2.0`; install `0.2.0`, create business facts, stop target worker hooks, install `0.1.0`, prove other package versions are byte-identical, verify `0.1.0` reads upgraded schema/facts, reinstall `0.2.0`, rerun the same idempotency key, and assert no duplicate fact. Test rollback failure preserves maintenance state.

- [ ] **Step 2: Run and observe missing orchestrator failure**

Run: `node --test tests/module-acceptance/rollback-drill.test.js`

Expected: FAIL because rollback drill does not exist.

- [ ] **Step 3: Implement stop/drain/snapshot/install/verify/re-upgrade sequence**

The script refuses production environments, non-loopback test registries, dirty manifests, non-exact versions, downgrade migrations, and commands containing inline secrets. It starts/stops the disposable registry through a test-owned child process, writes redacted evidence atomically, and never removes a package version from the registry.

- [ ] **Step 4: Run rollback test and failure injection**

Run: `node --test tests/module-acceptance/rollback-drill.test.js`

Expected: PASS for success and injected failure paths.

- [ ] **Step 5: Commit rollback tooling**

```bash
git add scripts/run-module-rollback-drill.js tests/module-acceptance docs/operations/module-rollback-runbook.md
git commit -m "test(core): prove module rollback and re-upgrade"
```

### Task 9: Migrate the Remaining 19 Business Modules

**Files:**
- Create: the 19 remaining `packages/data-platform-module-*` directories listed in File Structure.
- Create: the 19 exact `tests/module-acceptance/*/module.contract.test.js` files listed in the migration matrix below.
- Modify: controller, Service, Repository, and adapter files under the 19 exact backend directories listed below; old Service/Repository/adapter entry files become compatibility exports after their callers move.
- Modify: `packages/data-platform-core/package.json`.
- Modify: `packages/data-platform-core/src/module-manifest.json`.

**Interfaces:**
- Every module exports `{ moduleManifest, createCapabilities, createRuntimeAdapters }`.
- Every capability exports `(input, executionContext) -> Promise<ResultDTO>` and includes `sourceApiKeys`, `sourceFrontendKeys`, schemas, permission metadata, mutation metadata, and `executionTargets`.

**Migration matrix and fixed order:**

| Order | Backend directory | Module package | Acceptance test | API keys |
|---:|---|---|---|---:|
| 1 | `backend/src/modules/platform` | `packages/data-platform-module-platform` | `tests/module-acceptance/platform/module.contract.test.js` | 7 |
| 2 | `backend/src/modules/asset-search` | `packages/data-platform-module-asset-search` | `tests/module-acceptance/asset-search/module.contract.test.js` | 8 |
| 3 | `backend/src/modules/data-sources` | `packages/data-platform-module-data-sources` | `tests/module-acceptance/data-sources/module.contract.test.js` | 9 |
| 4 | `backend/src/modules/data-source-research` | `packages/data-platform-module-data-source-research` | `tests/module-acceptance/data-source-research/module.contract.test.js` | 18 |
| 5 | `backend/src/modules/data-lab-sources` | `packages/data-platform-module-data-lab-sources` | `tests/module-acceptance/data-lab-sources/module.contract.test.js` | 9 |
| 6 | `backend/src/modules/ingestion-ai-configs` | `packages/data-platform-module-ingestion-ai-configs` | `tests/module-acceptance/ingestion-ai-configs/module.contract.test.js` | 2 |
| 7 | `backend/src/modules/ingestion-tasks` | `packages/data-platform-module-ingestion-tasks` | `tests/module-acceptance/ingestion-tasks/module.contract.test.js` | 14 |
| 8 | `backend/src/modules/file-imports` | `packages/data-platform-module-file-imports` | `tests/module-acceptance/file-imports/module.contract.test.js` | 11 |
| 9 | `backend/src/modules/model-providers` | `packages/data-platform-module-model-providers` | `tests/module-acceptance/model-providers/module.contract.test.js` | 5 |
| 10 | `backend/src/modules/dev-ai-configs` | `packages/data-platform-module-dev-ai-configs` | `tests/module-acceptance/dev-ai-configs/module.contract.test.js` | 2 |
| 11 | `backend/src/modules/data-standards` | `packages/data-platform-module-data-standards` | `tests/module-acceptance/data-standards/module.contract.test.js` | 31 |
| 12 | `backend/src/modules/data-map` | `packages/data-platform-module-data-map` | `tests/module-acceptance/data-map/module.contract.test.js` | 41 |
| 13 | `backend/src/modules/data-development` | `packages/data-platform-module-data-development` | `tests/module-acceptance/data-development/module.contract.test.js` | 82 |
| 14 | `backend/src/modules/data-lab` | `packages/data-platform-module-data-lab` | `tests/module-acceptance/data-lab/module.contract.test.js` | 135 |
| 15 | `backend/src/modules/quality-control` | `packages/data-platform-module-quality-control` | `tests/module-acceptance/quality-control/module.contract.test.js` | 87 |
| 16 | `backend/src/modules/data-services` | `packages/data-platform-module-data-services` | `tests/module-acceptance/data-services/module.contract.test.js` | 32 |
| 17 | `backend/src/modules/reporting` | `packages/data-platform-module-reporting` | `tests/module-acceptance/reporting/module.contract.test.js` | 43 |
| 18 | `backend/src/modules/system-knowledge-base` | `packages/data-platform-module-system-knowledge-base` | `tests/module-acceptance/system-knowledge-base/module.contract.test.js` | 12 |
| 19 | `backend/src/modules/system-management` | `packages/data-platform-module-system-management` | `tests/module-acceptance/system-management/module.contract.test.js` | 27 |

The matrix API counts plus auth (4) and project-spaces (17) equal 596. Platform owns `health`, `platform`, and `platform-runtime`; data-services owns `data-services` and `service-runtime`; data-lab owns `data-modeling`; reporting owns `reporting` and `reporting-ai-configs`.

- [ ] **Step 1: For each module, write a failing source-coverage and golden-contract test**

For the next row in the fixed matrix, load the 596/84 baseline and assert its exact API-key count from the matrix. Before changing behavior, copy the transport-neutral current implementation into the module package, replace only repository-global dependencies with explicit legacy adapter ports, set version `0.1.0`, publish the tarball to the loopback test registry, run the golden baseline, and record `legacy-accepted`. Then set version `0.2.0` and write the failing capability contract for the shared-core candidate. Capture existing Web behavior for success, validation, permission, not found, conflict, file/stream, transaction rollback, and dependency failure relevant to that module.

- [ ] **Step 2: Run each module test and observe missing capability failures**

Run the exact acceptance test path from the current matrix row against candidate version `0.2.0`.

Expected: FAIL listing that module's unmapped source keys.

- [ ] **Step 3: Move Service/Repository/adapter and bind Controller/core catalog**

Move transport-neutral code, inject runtime ports, replace HTTP context with approved call context, keep Web response conversion in Controller, and update aggregate exact module version. Preserve old backend file paths only as compatibility re-exports until every caller is moved.

- [ ] **Step 4: Run all risk gates and rollback drill for the module**

For the current matrix row, run its exact acceptance test; run `node scripts/check-core-package-boundaries.js`; run `node scripts/run-module-rollback-drill.js` using exact candidate `0.2.0` and rollback `0.1.0`; then run `cd backend && npm test`.

Expected: 11 risk gates passed, rollback/re-upgrade passed, Web regression passed, secret findings 0.

- [ ] **Step 5: Commit one module at a time**

Stage only the current matrix row's module package, backend directory, acceptance directory, aggregate manifest and lockfile. Commit with `refactor(core): package <moduleName> capabilities`, where `moduleName` is read unchanged from the candidate package's validated manifest.

Repeat Tasks 9 Steps 1–5 for all 19 modules. A module failure leaves its manifest on the previous accepted version; independent modules may continue, but full-stage acceptance remains incomplete.

### Task 10: Execute Aggregate API, Four-Database, Aviation, and Rollback Acceptance

**Files:**
- Create: `tests/module-acceptance/aggregate/aggregate-acceptance.test.js`
- Modify: `packages/data-platform-cli/tests/api-gate.test.js`
- Modify: `packages/data-platform-cli/tests/database-gate.test.js`
- Modify: `packages/data-platform-cli/tests/aviation-acceptance.test.js`
- Create: `evidence/module-acceptance/aggregate/manifest.json`
- Modify: `packages/data-platform-cli/tests/TEST.md`

**Interfaces:**
- Aggregate acceptance consumes exactly 21 module evidence documents plus the 596/84 coverage baseline.
- Release result is `accepted`, `blocked`, or `failed`; partial acceptance cannot be labeled complete.

- [ ] **Step 1: Write the failing aggregate gate**

Require 21 accepted modules, exact manifest/lock/export versions, 596/596 APIs, 84/84 frontend entries, zero unclassified commands, API gate evidence, MySQL/PG/Oracle/DM evidence, two aviation runs, zero duplicate facts, zero secrets, and independent packed CLI installation.

- [ ] **Step 2: Run and observe incomplete module evidence failure**

Run: `node --test tests/module-acceptance/aggregate/aggregate-acceptance.test.js`

Expected: FAIL listing every missing or non-accepted module/evidence gate.

- [ ] **Step 3: Execute external API gate with the packed aggregate**

Run: `CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js`

Expected: every API-classified capability tested; bypass 0; secret findings 0.

- [ ] **Step 4: Execute all four real database gates**

Run once per `mysql`, `postgresql`, `oracle`, and `dm` with `CLI_DATABASE_GATE=1`. The harness refuses mocks and records real database/driver fingerprints. Any unavailable engine produces `blocked`, not `passed`.

- [ ] **Step 5: Run aviation acceptance twice and all 21 rollback drills**

The installed CLI runs the approved aviation workflow twice. Then execute every module's rollback and re-upgrade drill against the final candidate aggregate. Expected: no duplicate business keys, no forbidden bypass, and all modules return to their candidate accepted versions.

- [ ] **Step 6: Run final regression, package, boundary, and evidence verification**

```bash
npm test --workspaces --if-present
npm run check:boundaries
cd backend && npm test
cd ../frontend && npm run build
cd ../packages/data-platform-cli && npm test && npm run pack:check
cd ../..
node scripts/build-module-acceptance-manifest.js --verify-only
node --test tests/module-acceptance/aggregate/aggregate-acceptance.test.js
git diff --check
```

Expected: all commands exit 0, 21 modules accepted, and aggregate evidence has no secret findings.

- [ ] **Step 7: Commit aggregate acceptance evidence**

```bash
git add evidence/module-acceptance/aggregate packages/data-platform-cli/tests/TEST.md
git commit -m "test(core): accept shared core with module rollback evidence"
```

## Plan Self-Review Result

- Package boundary gap is resolved before database runtime or business extraction: installed CLI consumes packed core/module packages, never backend source.
- All 21 existing business modules have an exact module package mapping and an independent rollback boundary.
- All 14 design risks map to one or more of the 11 machine-readable risk gates; driver/DataX/API/secret-specific checks are contained in `executionTargets`, `faultInjection`, `packageInstall`, and `schemaCompatibility` evidence.
- Direct Service replacement, test-only gradual upgrade, no production canary, no runtime legacy router, and no write replay are explicit.
- Rollback validates a real `0.1.0 legacy-accepted` package on the schema upgraded by `0.2.0`, keeps other module versions unchanged, and requires `0.2.0` re-upgrade idempotency.
- Type names and evidence gate names are consistent with the approved design.
- No implementation placeholders remain; module repetition uses a fixed 19-row matrix with exact directories, package paths, tests, coverage counts, ordering, and one independently reviewed commit per row.
