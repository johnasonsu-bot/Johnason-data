# Data Platform CLI Single-Stage Implementation Plan — Task Group 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Within the single full-platform modification stage, build the foundation required by every API-classified and database-classified command: installable package, profile-scoped direct runtime, keychain, authentication, policies, output, registry classification, foundation commands, and REPL.

**Architecture:** Add an installable CommonJS package under `packages/data-platform-cli` and extract transport-neutral execution policies under `backend/src/application/runtime`. The CLI injects a profile-scoped database runtime into shared auth/project services; both CLI and Web middleware use the same session, permission, project, license, and activation policies. A declarative registry drives Commander, REPL, help, output, and coverage source metadata.

**Tech Stack:** Node.js 22.20+, npm, CommonJS, Commander 15, Zod 3.24, YAML 2.9, `@napi-rs/keyring` 1.3, MySQL2 3.11, cli-table3 0.6, Node built-in test runner.

## Global Constraints

- Package name: `@johnason/data-platform-cli`; executable: `data-platform`.
- Minimum Node version: `>=22.20.0`.
- No HTTP request may be made by the CLI.
- No plaintext database password, platform password, JWT, token, or model key may be persisted outside the OS keychain.
- Config files may contain profile name, host, port, database, username, current profile, current project ID, and non-secret runtime paths only.
- The CLI must fail closed when the keychain is unavailable; no plaintext fallback is allowed.
- Login password is read through hidden interactive input or stdin controlled by the caller and is never echoed or logged.
- Existing Web routes and response behavior remain compatible.
- License and activation policies remain allow-all extension points.
- Global `--json` makes stdout exactly one JSON document; diagnostics use stderr.
- Every command registration includes `capabilityId`, `sourceApiKeys`, and `sourceFrontendKeys`.
- Every command registration includes `executionTargets`; foundation commands that touch platform authority state declare `{ kind: "database", engine: "mysql" }`, while pure local commands declare `{ kind: "local" }`.
- Use TDD: observe each new test fail before implementing the behavior.
- Do not commit `.env`, config state, keychain values, tokens, passwords, build output, or npm tarballs.

---

## File Structure

### Shared application runtime

- `backend/src/application/runtime/database-runtime.js`: create and close profile-scoped MySQL pools; expose `runWithDatabaseRuntime()` and `getDatabaseRuntime()` through AsyncLocalStorage.
- `backend/src/application/runtime/session-policy.js`: verify JWT, active session, current user profile, and touch session.
- `backend/src/application/runtime/authorization-policy.js`: enforce module and read-only action metadata without URL coupling.
- `backend/src/application/runtime/project-policy.js`: resolve and enter project context.
- `backend/src/application/runtime/license-policy.js`: allow-all extension point matching current Web behavior.
- `backend/src/application/runtime/activation-policy.js`: allow-all extension point matching current Web behavior.
- `backend/src/application/runtime/execution-context.js`: compose database, identity, authorization, project, audit ID, and cleanup around a command handler.
- `backend/src/application/runtime/*.test.js`: isolated policy/runtime tests with injected repositories and fake pools.

### Existing backend integration

- `backend/src/config/database.js`: make the default Web pool available through the database runtime while preserving existing exports.
- `backend/src/modules/auth/auth.repository.js`: resolve pool through the injected database runtime.
- `backend/src/modules/auth/auth-session.repository.js`: resolve pool through the injected database runtime.
- `backend/src/modules/auth/auth.service.js`: acquire the injected executor instead of importing a singleton pool.
- `backend/src/modules/project-spaces/project-space.repository.js`: resolve pool through the injected database runtime.
- `backend/src/common/middleware/auth.js`: delegate session/permission/project checks to shared policies.
- `backend/src/common/middleware/license-feature.js`: delegate to shared license policy.
- `backend/src/common/middleware/activation.js`: delegate to shared activation policy.
- `backend/package.json` and `backend/package-lock.json`: add foundation test scripts only; no CLI runtime dependency belongs here unless shared code requires it.

### Installable CLI package

- `packages/data-platform-cli/package.json` and `package-lock.json`: package metadata, exact runtime dependencies, bin mapping, files allowlist, scripts, and Node engine.
- `packages/data-platform-cli/bin/data-platform.js`: minimal executable that calls `main()` and maps unhandled errors to stable output/exit codes.
- `packages/data-platform-cli/src/main.js`: create dependencies, registry, Commander program, and default REPL.
- `packages/data-platform-cli/src/runtime/paths.js`: XDG/macOS/Windows config/data paths with injectable home/platform.
- `packages/data-platform-cli/src/runtime/profile-store.js`: schema-validated, mode-0600 atomic JSON profile storage without secrets.
- `packages/data-platform-cli/src/runtime/keychain.js`: keyring adapter for database password and platform session token.
- `packages/data-platform-cli/src/runtime/database.js`: turn a profile plus keychain password into a MySQL runtime.
- `packages/data-platform-cli/src/runtime/hidden-input.js`: terminal-safe hidden password input.
- `packages/data-platform-cli/src/runtime/cli-execution.js`: load profile/session, call shared execution context, and close resources.
- `packages/data-platform-cli/src/registry/command-registry.js`: register and validate command definitions and source keys.
- `packages/data-platform-cli/src/registry/foundation-commands.js`: config, auth, project, platform, and doctor registrations.
- `packages/data-platform-cli/src/output/envelope.js`: stable success/error envelopes and exit-code mapping.
- `packages/data-platform-cli/src/output/renderer.js`: human table/detail and strict JSON renderer.
- `packages/data-platform-cli/src/output/redaction.js`: recursive sensitive-field and connection-string redaction.
- `packages/data-platform-cli/src/commands/config.js`: profile list/add/use/show/remove-secret-safe operations.
- `packages/data-platform-cli/src/commands/auth.js`: login/profile/logout.
- `packages/data-platform-cli/src/commands/project.js`: list/current/use/resolve/access-check.
- `packages/data-platform-cli/src/commands/platform.js`: overview and database capability diagnostics.
- `packages/data-platform-cli/src/commands/system-doctor.js`: local dependency and database checks without Express.
- `packages/data-platform-cli/src/repl/repl.js`: default REPL that reuses the registry and displays profile/project context.
- `packages/data-platform-cli/tests/*.test.js`: unit, integration-with-fakes, subprocess, and package-install tests.
- `packages/data-platform-cli/tests/TEST.md`: test inventory and actual result appendix.
- `packages/data-platform-cli/README.md`: install, profile, login, JSON, REPL, and security behavior.
- `skills/cli-anything-data-platform/SKILL.md`: foundation-level agent instructions; expand in later task groups of the same implementation stage.

---

### Task 1: Scaffold the Installable Package and Installed-Command Test

**Files:**
- Create: `packages/data-platform-cli/package.json`
- Create: `packages/data-platform-cli/bin/data-platform.js`
- Create: `packages/data-platform-cli/src/main.js`
- Create: `packages/data-platform-cli/tests/TEST.md`
- Create: `packages/data-platform-cli/tests/package.test.js`
- Create: `packages/data-platform-cli/README.md`
- Create: `skills/cli-anything-data-platform/SKILL.md`

**Interfaces:**
- Produces: `async function main(argv, dependencies = {}) -> Promise<number>` from `src/main.js`.
- Produces: executable `data-platform` mapped to `bin/data-platform.js`.
- Consumes: none; this task establishes package boundaries.

- [ ] **Step 1: Write the test plan before test code**

Create `tests/TEST.md` with this inventory:

```markdown
# Data Platform CLI Foundation Test Plan

## Planned suites
- package.test.js: 5 tests for package metadata, files allowlist, bin, Node engine, and installed execution.
- paths-profile.test.js: 9 tests for OS paths, validation, atomic mode-0600 persistence, selection, and secret rejection.
- keychain.test.js: 7 tests for namespacing, set/get/delete, unavailable backend, and no plaintext fallback.
- registry-output.test.js: 12 tests for registry metadata, aliases, redaction, envelopes, JSON stdout, and exit codes.
- execution-context.test.js: 10 tests for session, permissions, read-only, project resolution, allow-all policies, and cleanup.
- auth-project.test.js: 10 tests for login/profile/logout and project list/current/use/resolve/access-check.
- repl.test.js: 5 tests for default entry, shared parsing, context prompt, exit, and JSON exclusion.
- full-e2e.test.js: 8 subprocess tests for help, config, doctor, fake-runtime login, project selection, JSON discipline, REPL, and arbitrary cwd.

## Realistic foundation workflow
Install the packed CLI into a temporary prefix, create a profile with a fake keychain/runtime, login, resolve exactly one project, select it, query profile and platform diagnostics, enter and exit REPL, and assert no HTTP server is started or contacted.
```

- [ ] **Step 2: Write the failing package test**

```js
// tests/package.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");

test("package exposes data-platform for Node 22.20+", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-cli");
  assert.equal(pkg.bin["data-platform"], "bin/data-platform.js");
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.deepEqual(pkg.files.sort(), ["README.md", "bin", "src"].sort());
});
```

- [ ] **Step 3: Run the test and observe failure**

Run: `node --test packages/data-platform-cli/tests/package.test.js`

Expected: FAIL because `packages/data-platform-cli/package.json` does not exist.

- [ ] **Step 4: Add minimal package and executable**

Use these exact package constraints:

```json
{
  "name": "@johnason/data-platform-cli",
  "version": "0.1.0",
  "private": false,
  "description": "Agent-ready CLI for the Data Platform",
  "main": "src/main.js",
  "bin": { "data-platform": "bin/data-platform.js" },
  "files": ["bin", "src", "README.md"],
  "engines": { "node": ">=22.20.0" },
  "scripts": {
    "test": "node --test tests/*.test.js",
    "pack:check": "npm pack --dry-run"
  },
  "dependencies": {
    "@napi-rs/keyring": "1.3.0",
    "cli-table3": "0.6.5",
    "commander": "15.0.0",
    "mysql2": "3.11.3",
    "yaml": "2.9.0",
    "zod": "3.24.1"
  }
}
```

`bin/data-platform.js` must contain a Node shebang, import `{ main }`, set `process.exitCode` from the returned code, and write unexpected diagnostics only to stderr.

- [ ] **Step 5: Install dependencies and run package checks**

Run: `cd packages/data-platform-cli && npm install && npm test && npm run pack:check`

Expected: PASS; dry-run tarball contains only `bin`, `src`, and `README.md` plus npm metadata.

- [ ] **Step 6: Commit the package boundary**

```bash
git add packages/data-platform-cli skills/cli-anything-data-platform/SKILL.md
git commit -m "feat(cli): scaffold installable data platform command"
```

### Task 2: Implement Config Paths and Secret-Free Profile Storage

**Files:**
- Create: `packages/data-platform-cli/src/runtime/paths.js`
- Create: `packages/data-platform-cli/src/runtime/profile-store.js`
- Create: `packages/data-platform-cli/tests/paths-profile.test.js`
- Modify: `packages/data-platform-cli/src/commands/config.js`

**Interfaces:**
- Produces: `resolveCliPaths({ platform, env, homeDir }) -> { configDir, dataDir, configFile }`.
- Produces: `createProfileStore({ configFile, fsImpl }) -> { list, get, add, remove, use, setCurrentProject }`.
- Profile type: `{ name, db: { host, port, database, user, timezone }, dataxHome?, kafkaBootstrapServers?, currentProjectId? }`.

- [ ] **Step 1: Write failing path and profile tests**

Tests must assert:

```js
assert.equal(resolveCliPaths({ platform: "darwin", homeDir: "/u", env: {} }).configFile, "/u/Library/Application Support/data-platform-cli/config.json");
assert.equal(resolveCliPaths({ platform: "linux", homeDir: "/u", env: { XDG_CONFIG_HOME: "/cfg" } }).configFile, "/cfg/data-platform-cli/config.json");
assert.throws(() => store.add({ name: "dev", db: { password: "secret" } }), /secret fields are forbidden/i);
assert.equal(fs.statSync(configFile).mode & 0o777, 0o600);
```

Also test duplicate names, invalid ports, atomic replacement, selecting a missing profile, and clearing a removed current profile.

- [ ] **Step 2: Run tests and observe missing modules**

Run: `node --test packages/data-platform-cli/tests/paths-profile.test.js`

Expected: FAIL with module-not-found for `paths.js` or `profile-store.js`.

- [ ] **Step 3: Implement exact profile validation**

Use Zod with:

```js
const profileSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  db: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    database: z.string().min(1),
    user: z.string().min(1),
    timezone: z.string().default("+08:00")
  }).strict(),
  dataxHome: z.string().min(1).optional(),
  kafkaBootstrapServers: z.array(z.string().min(1)).optional(),
  currentProjectId: z.number().int().positive().optional()
}).strict();
```

Reject any recursively discovered key matching `/password|secret|token|api[-_]?key/i`. Save via sibling temporary file, `chmod 0600`, rename, then `chmod 0600` final.

- [ ] **Step 4: Run profile tests**

Run: `node --test packages/data-platform-cli/tests/paths-profile.test.js`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit profile storage**

```bash
git add packages/data-platform-cli/src/runtime packages/data-platform-cli/src/commands/config.js packages/data-platform-cli/tests/paths-profile.test.js
git commit -m "feat(cli): add secret-free environment profiles"
```

### Task 3: Implement Fail-Closed OS Keychain Storage

**Files:**
- Create: `packages/data-platform-cli/src/runtime/keychain.js`
- Create: `packages/data-platform-cli/tests/keychain.test.js`
- Modify: `packages/data-platform-cli/src/commands/config.js`

**Interfaces:**
- Produces: `createKeychain({ EntryClass, serviceName = "data-platform-cli" })`.
- Methods: `setDatabasePassword(profile, value)`, `getDatabasePassword(profile)`, `deleteDatabasePassword(profile)`, `setSessionToken(profile, value)`, `getSessionToken(profile)`, `deleteSessionToken(profile)`.
- Account names: `profile:<name>:database-password` and `profile:<name>:session-token`.

- [ ] **Step 1: Write failing fake-keyring tests**

```js
test("namespaces database and session secrets per profile", () => {
  const keychain = createKeychain({ EntryClass: FakeEntry });
  keychain.setDatabasePassword("dev", "db-pass");
  keychain.setSessionToken("dev", "jwt");
  assert.equal(FakeEntry.values.get("data-platform-cli/profile:dev:database-password"), "db-pass");
  assert.equal(FakeEntry.values.get("data-platform-cli/profile:dev:session-token"), "jwt");
});

test("fails closed when native keyring is unavailable", () => {
  assert.throws(() => createKeychain({ EntryClass: null }), /system keychain unavailable/i);
});
```

Test deletion, missing values, invalid empty secrets, backend exception redaction, and absence of filesystem fallback.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test packages/data-platform-cli/tests/keychain.test.js`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement synchronous keyring adapter**

Wrap `@napi-rs/keyring.Entry`. Convert native exceptions to `CliError` code `KEYCHAIN_UNAVAILABLE` without including native message fields that may contain account data. Do not accept an optional file path or fallback callback.

- [ ] **Step 4: Run keychain tests**

Run: `node --test packages/data-platform-cli/tests/keychain.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit keychain support**

```bash
git add packages/data-platform-cli/src/runtime/keychain.js packages/data-platform-cli/src/commands/config.js packages/data-platform-cli/tests/keychain.test.js
git commit -m "feat(cli): store profile secrets in system keychain"
```

### Task 4: Add Profile-Scoped Database Runtime Injection

**Files:**
- Create: `backend/src/application/runtime/database-runtime.js`
- Create: `backend/src/application/runtime/database-runtime.test.js`
- Modify: `backend/src/config/database.js`
- Modify: `backend/src/modules/auth/auth.repository.js`
- Modify: `backend/src/modules/auth/auth-session.repository.js`
- Modify: `backend/src/modules/auth/auth.service.js`
- Modify: `backend/src/modules/project-spaces/project-space.repository.js`
- Create: `packages/data-platform-cli/src/runtime/database.js`
- Create: `packages/data-platform-cli/tests/database-runtime.test.js`

**Interfaces:**
- Produces: `createDatabaseRuntime(config, mysqlImpl) -> { pool, testConnection, close }`.
- Produces: `runWithDatabaseRuntime(runtime, callback) -> Promise<T>`.
- Produces: `getDatabaseRuntime() -> runtime`, falling back to Web default runtime only when explicitly configured.
- CLI produces: `createProfileDatabaseRuntime(profile, keychain, mysqlImpl) -> runtime`.

- [ ] **Step 1: Write failing AsyncLocalStorage isolation tests**

Test two concurrent callbacks receive different fake pools and that nested repository calls resolve the correct executor:

```js
const values = await Promise.all([
  runWithDatabaseRuntime({ pool: { id: "a" } }, async () => getDatabaseRuntime().pool.id),
  runWithDatabaseRuntime({ pool: { id: "b" } }, async () => getDatabaseRuntime().pool.id),
]);
assert.deepEqual(values, ["a", "b"]);
```

Also test `close()` executes exactly once after success and error, and profile runtime reads password only from keychain.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test backend/src/application/runtime/database-runtime.test.js packages/data-platform-cli/tests/database-runtime.test.js`

Expected: FAIL with missing runtime modules.

- [ ] **Step 3: Implement runtime and replace singleton imports in foundation repositories**

Use `AsyncLocalStorage`. Export `getDatabaseExecutor()` returning the injected pool. In `backend/src/config/database.js`, construct the existing Web runtime once and export its `pool` and `testConnection` unchanged for backward compatibility.

Change foundation repositories from imported `pool` calls to `getDatabaseExecutor()` calls. Change `auth.service.js` transaction acquisition to `getDatabaseExecutor().getConnection()`.

- [ ] **Step 4: Run focused and existing auth/project tests**

Run:

```bash
node --test backend/src/application/runtime/database-runtime.test.js packages/data-platform-cli/tests/database-runtime.test.js
cd backend && npm test
```

Expected: all focused tests and existing backend suite pass.

- [ ] **Step 5: Commit database injection**

```bash
git add backend/src/application/runtime backend/src/config/database.js backend/src/modules/auth backend/src/modules/project-spaces/project-space.repository.js packages/data-platform-cli/src/runtime/database.js packages/data-platform-cli/tests/database-runtime.test.js
git commit -m "refactor(core): inject profile-scoped database runtime"
```

### Task 5: Extract Shared Session, Authorization, Project, License, and Activation Policies

**Files:**
- Create: `backend/src/application/runtime/session-policy.js`
- Create: `backend/src/application/runtime/authorization-policy.js`
- Create: `backend/src/application/runtime/project-policy.js`
- Create: `backend/src/application/runtime/license-policy.js`
- Create: `backend/src/application/runtime/activation-policy.js`
- Create: `backend/src/application/runtime/execution-context.js`
- Create: `backend/src/application/runtime/execution-context.test.js`
- Modify: `backend/src/common/middleware/auth.js`
- Modify: `backend/src/common/middleware/license-feature.js`
- Modify: `backend/src/common/middleware/activation.js`

**Interfaces:**
- `authenticateSession(token, dependencies) -> Promise<user>`.
- `authorizeCommand(user, { modules, action, readOnlyAllowed }) -> void`.
- `resolveProject(user, requestedProjectId, projectService) -> Promise<{ project, member }>`.
- `executeWithContext({ token, command, projectId, auditId, dependencies }, handler) -> Promise<{ data, auditId, user, project }>`.
- Policy errors include stable `code`, `statusCode`, `message`, `retryable`, and optional redacted `details`.

- [ ] **Step 1: Write failing policy tests**

Cover exact cases:

```js
await assert.rejects(() => authenticateSession("bad", deps), { code: "INVALID_SESSION" });
assert.throws(() => authorizeCommand(viewer, { modules: ["quality"], action: "execute" }), { code: "READ_ONLY_FORBIDDEN" });
assert.throws(() => authorizeCommand(user, { modules: ["quality"], action: "read" }), { code: "MODULE_PERMISSION_FORBIDDEN" });
assert.deepEqual(await licensePolicy.check({ feature: "quality" }), { allowed: true });
```

Also test revoked session, disabled user, token/user mismatch, project membership failure, audit ID preservation, project AsyncLocalStorage, and resource cleanup on handler error.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test backend/src/application/runtime/execution-context.test.js`

Expected: FAIL because policy modules do not exist.

- [ ] **Step 3: Implement transport-neutral policies**

Reuse existing `auth.repository`, `auth-session.repository`, `project-space.service`, `user-permissions`, and `project-context`. Do not pass a fake Express request or URL. Authorization uses command metadata `{ modules, action, readOnlyAllowed }`.

- [ ] **Step 4: Adapt Web middleware without changing responses**

`auth.js` translates the request to policy inputs and translates policy errors back to the existing `{ success:false, message, code, details }` response. Preserve `req.user`, `req.project`, `req.projectId`, and `req.projectMember`.

- [ ] **Step 5: Run policy and Web regression tests**

Run:

```bash
node --test backend/src/application/runtime/execution-context.test.js
cd backend && npm test
```

Expected: policy tests and existing backend tests pass; no route response regression.

- [ ] **Step 6: Commit shared policies**

```bash
git add backend/src/application/runtime backend/src/common/middleware
git commit -m "refactor(core): share access policies across web and CLI"
```

### Task 6: Implement Stable Envelopes, Redaction, Exit Codes, and Command Registry

**Files:**
- Create: `packages/data-platform-cli/src/output/envelope.js`
- Create: `packages/data-platform-cli/src/output/redaction.js`
- Create: `packages/data-platform-cli/src/output/renderer.js`
- Create: `packages/data-platform-cli/src/registry/command-registry.js`
- Create: `packages/data-platform-cli/tests/registry-output.test.js`

**Interfaces:**
- `successEnvelope(data, { auditId, meta }) -> { success:true, data, meta, auditId }`.
- `errorEnvelope(error, auditId) -> { success:false, error:{ code,message,retryable,details? }, auditId }`.
- Exit codes: `0 success`, `2 invalid input`, `3 unauthenticated`, `4 forbidden`, `5 not found`, `6 conflict`, `7 dependency unavailable`, `8 partial success`, `1 internal error`.
- `registerCommand(definition)` validates unique `capabilityId` and explicit alias rules.

- [ ] **Step 1: Write failing registry/output tests**

Assert strict JSON and recursive redaction:

```js
assert.deepEqual(redact({ password: "x", nested: { token: "y", host: "db" } }), {
  password: "[REDACTED]",
  nested: { token: "[REDACTED]", host: "db" }
});
assert.equal(exitCodeFor({ code: "MODULE_PERMISSION_FORBIDDEN" }), 4);
assert.throws(() => registry.register({ capabilityId: "x", sourceApiKeys: [] }), /sourceApiKeys/);
```

Capture stdout/stderr and prove JSON mode writes exactly one parseable document to stdout and diagnostics only to stderr.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test packages/data-platform-cli/tests/registry-output.test.js`

Expected: FAIL with missing output/registry modules.

- [ ] **Step 3: Implement deterministic output and registry validation**

Redact keys matching `/password|secret|token|authorization|api[-_]?key|credential/i` and redact passwords embedded in URI authority. Registry requires `command`, `capabilityId`, `modules`, `action`, `sourceApiKeys`, `sourceFrontendKeys`, `handler`, and schemas. Shared command aliases require `aliasApiKeys` containing every source key.

- [ ] **Step 4: Run tests**

Run: `node --test packages/data-platform-cli/tests/registry-output.test.js`

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit output and registry**

```bash
git add packages/data-platform-cli/src/output packages/data-platform-cli/src/registry packages/data-platform-cli/tests/registry-output.test.js
git commit -m "feat(cli): add stable output and command registry"
```

### Task 7: Implement Config, Auth, Project, Platform, and Doctor Commands

**Files:**
- Create: `packages/data-platform-cli/src/runtime/hidden-input.js`
- Create: `packages/data-platform-cli/src/runtime/cli-execution.js`
- Create: `packages/data-platform-cli/src/registry/foundation-commands.js`
- Create: `packages/data-platform-cli/src/commands/config.js`
- Create: `packages/data-platform-cli/src/commands/auth.js`
- Create: `packages/data-platform-cli/src/commands/project.js`
- Create: `packages/data-platform-cli/src/commands/platform.js`
- Create: `packages/data-platform-cli/src/commands/system-doctor.js`
- Create: `packages/data-platform-cli/tests/auth-project.test.js`
- Modify: `packages/data-platform-cli/src/main.js`

**Interfaces:**
- `createFoundationCommands(dependencies) -> CommandDefinition[]`.
- Login calls `authService.login({ username, password }, { userAgent: "data-platform-cli", ipAddress: null })` inside profile database runtime.
- Project resolve: `resolve({ code?, name? }, user) -> exactly one project or CliError PROJECT_NOT_UNIQUE`.
- Access check: `{ projectId, action } -> { allowed, project, member, modules }`.

- [ ] **Step 1: Write failing command tests with injected fakes**

Required assertions:

```js
assert.equal(await commands.auth.login({ username: "alice", password: "pw" }).then(r => r.user.username), "alice");
assert.equal(fakeKeychain.getSessionToken("dev"), "signed-token");
await assert.rejects(() => commands.project.resolve({ code: "dup" }), { code: "PROJECT_NOT_UNIQUE" });
assert.deepEqual(await commands.project.accessCheck({ projectId: 12, action: "write" }), { allowed: true, projectId: 12, projectRole: "developer" });
```

Also test token deletion on logout, disabled session, profile with missing DB password, project selection persistence, database capability output, and doctor failure exit code.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test packages/data-platform-cli/tests/auth-project.test.js`

Expected: FAIL with missing command modules.

- [ ] **Step 3: Implement hidden input and command handlers**

`hidden-input.js` disables TTY echo only for the prompt duration and restores it in `finally`. `auth login` must never include password in returned data. `auth profile` revalidates the database session. `project resolve --require-one` returns errors for zero and multiple results. `system doctor` tests keychain availability, database connectivity, schema access, DataX executable, and configured Kafka address without starting Express.

- [ ] **Step 4: Bind definitions to Commander**

`main.js` creates a Commander program with global `--profile`, `--project`, `--json`, and `--no-color`. Parse using `parseAsync`. If no subcommand and stdin/stdout are TTYs, enter REPL; otherwise print help and exit 2.

- [ ] **Step 5: Run command and backend regression tests**

Run:

```bash
node --test packages/data-platform-cli/tests/auth-project.test.js packages/data-platform-cli/tests/registry-output.test.js
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit foundation commands**

```bash
git add packages/data-platform-cli/src packages/data-platform-cli/tests/auth-project.test.js
git commit -m "feat(cli): add authenticated foundation commands"
```

### Task 8: Add the Shared-Registry Default REPL

**Files:**
- Create: `packages/data-platform-cli/src/repl/repl.js`
- Create: `packages/data-platform-cli/tests/repl.test.js`
- Modify: `packages/data-platform-cli/src/main.js`

**Interfaces:**
- `runRepl({ registry, executeArgv, input, output, getContext }) -> Promise<void>`.
- Prompt format: `data-platform[<profile>/<project-code-or-id>]> `.
- Built-ins: `help`, `context`, `exit`, `quit`; all other input uses the same argv parser and handlers as one-shot mode.

- [ ] **Step 1: Write failing REPL tests**

Use `Readable.from(["context\n", "project list --json\n", "exit\n"])` and a capture stream. Assert prompt context, shared executor calls, and goodbye. Assert REPL is not entered when `--json` is supplied without a subcommand.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test packages/data-platform-cli/tests/repl.test.js`

Expected: FAIL with missing `repl.js`.

- [ ] **Step 3: Implement REPL with Node readline/promises**

Tokenize quoted input with a local deterministic parser; do not use shell evaluation. Feed tokens to `executeArgv` directly. Catch command errors per line, render them, and keep the session alive. Do not persist command lines containing sensitive option names.

- [ ] **Step 4: Run REPL tests**

Run: `node --test packages/data-platform-cli/tests/repl.test.js`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit REPL**

```bash
git add packages/data-platform-cli/src/repl packages/data-platform-cli/src/main.js packages/data-platform-cli/tests/repl.test.js
git commit -m "feat(cli): add shared-command interactive REPL"
```

### Task 9: Add Installed-Command E2E, Coverage Metadata Gate, Docs, and Final Verification

**Files:**
- Create: `packages/data-platform-cli/tests/full-e2e.test.js`
- Create: `packages/data-platform-cli/tests/fixtures/fake-runtime.js`
- Create: `packages/data-platform-cli/tests/coverage-metadata.test.js`
- Modify: `packages/data-platform-cli/tests/TEST.md`
- Modify: `packages/data-platform-cli/README.md`
- Modify: `skills/cli-anything-data-platform/SKILL.md`
- Modify: `packages/data-platform-cli/package.json`

**Interfaces:**
- Test-only dependency injection is enabled only by direct `main(argv, dependencies)` import, never by an environment variable in the installed production command.
- Coverage gate verifies foundation command source keys exist in `docs/superpowers/specs/data-platform-cli-coverage-baseline.json`.

- [ ] **Step 1: Write failing installed-command and coverage tests**

The E2E test must:

1. run `npm pack` into a temporary directory;
2. install the tarball with `npm install --prefix <temp-prefix> <tarball>`;
3. resolve `<temp-prefix>/node_modules/.bin/data-platform`;
4. run from a different temporary cwd;
5. assert `--help`, `--version`, invalid command exit 2, and JSON error discipline;
6. directly call `main()` with fake runtime for login/project workflow;
7. prove no HTTP module or URL is used.

Coverage test asserts `sourceApiKeys` for `auth login`, `auth profile`, `project list`, `platform overview`, `system doctor database-capabilities`, and `job show` exist in the baseline.

- [ ] **Step 2: Run tests and observe failure**

Run:

```bash
node --test packages/data-platform-cli/tests/full-e2e.test.js packages/data-platform-cli/tests/coverage-metadata.test.js
```

Expected: FAIL until installed command and source metadata are complete.

- [ ] **Step 3: Complete documentation and SKILL.md**

Document:

- Node 22.20+ and npm global installation;
- profile config fields and keychain-only secrets;
- login/profile/logout;
- project list/resolve/use/access-check;
- JSON stdout and exit codes;
- default REPL behavior;
- `system doctor` diagnostics;
- foundation task-group scope versus later business task groups in the same implementation stage;
- no HTTP requirement and no plaintext fallback.

- [ ] **Step 4: Run complete fresh verification**

Run:

```bash
node --check packages/data-platform-cli/bin/data-platform.js
node --check packages/data-platform-cli/src/main.js
cd packages/data-platform-cli && npm test && npm run pack:check
cd ../../backend && npm test
cd .. && node scripts/generate-cli-coverage-baseline.js '/Users/sushi/Downloads/data-platform-dev/source/api-inventory.json' /tmp/cli-coverage.verify.json
cmp docs/superpowers/specs/data-platform-cli-coverage-baseline.json /tmp/cli-coverage.verify.json
git diff --check
```

Expected: all commands exit 0; package tests report all planned foundation tests passing; backend tests pass; coverage baseline is byte-identical; diff check is clean.

- [ ] **Step 5: Append actual results to TEST.md**

Append the full `node --test` output, total count, pass rate, duration, installed binary path, tarball content summary, and known foundation-only coverage gaps. Do not claim later business domains are implemented.

- [ ] **Step 6: Commit verified foundation**

```bash
git add packages/data-platform-cli skills/cli-anything-data-platform/SKILL.md backend docs/superpowers/specs/data-platform-cli-coverage-baseline.json
git commit -m "test(cli): verify installable foundation workflow"
```

## Plan Self-Review Result

- Spec coverage: package, no-HTTP direct runtime, keychain, profile, login, session, permissions, read-only, project context, allow-all policy extension points, JSON output, REPL, source metadata, installed-command testing, and Web regression are assigned to tasks.
- Sequenced within the same implementation stage: Kafka/outbox/inbox/jobs/daemon, the remaining domain commands, ontology tooling, and aviation acceptance are implemented by the subsequent task groups in the single-stage master plan.
- Type consistency: runtime, keychain, profile store, execution context, registry, envelope, and REPL signatures are defined once and consumed consistently.
- Placeholder scan: no implementation placeholders remain; every task provides concrete files, tests, commands, expected failures, and commit boundaries.
