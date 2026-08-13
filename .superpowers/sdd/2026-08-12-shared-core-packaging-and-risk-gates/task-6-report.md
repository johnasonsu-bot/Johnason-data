# Task 6 Report: Aggregate Core and Web/CLI Binding

## Status

Implemented `@johnason/data-platform-core@0.1.0`, bound the Web and CLI consumers exclusively through it, and verified the published package chain through a disposable loopback registry. The aggregate dependency graph is `consumer -> aggregate -> kernel/modules` and `modules -> kernel`.

## RED

The initial focused test was run before creating the aggregate package:

```sh
node --test packages/data-platform-core/tests/catalog.test.js tests/shared-core-install/aggregate-install.test.js
```

It exited `1` with `MODULE_NOT_FOUND` for `../src/catalog` and the absent aggregate package. Subsequent test-first failures covered:

- aggregate-to-kernel being rejected before the dependency-direction rule was corrected;
- missing Web aggregate adapter/controller factories and missing CLI runtime-binding helpers;
- order-dependent source API alias selection and missing kernel export-version validation;
- malformed auth input reaching repositories before aggregate validation;
- a mutable exported aggregate manifest;
- eager auth module initialization requiring Web-only JWT/password ports while constructing a CLI core;
- an omitted default packaged MySQL driver;
- registry publish without authentication, non-interactive npm account creation, and aggregate resolution from the global CLI's nested dependency tree.

Each failing contract preceded its matching implementation or infrastructure correction.

## GREEN

`@johnason/data-platform-core` now provides:

- exact dependencies on kernel `0.1.0`, auth `0.2.0`, and project-spaces `0.2.0`;
- candidate `0.2.0` and rollback `0.1.0` module selections in an immutable manifest;
- catalog rejection for duplicate capability IDs, unaliased source API collisions, invalid or duplicate aliases, missing modules/factories, dependency/manifest/export mismatches, and incompatible capability schemas;
- `createDataPlatformCore(runtimeDependencies) -> { catalog, execute, moduleVersions }`, with input validation before invocation and output validation before return;
- lazy per-module construction, allowing the CLI to build the aggregate without Web-only authentication ports until those capabilities are selected.

The Web adapter constructs dependencies from environment/config, preserves the existing controller exports and HTTP response shapes, and converts Multer files into a transport-neutral `{ name, size, mediaType, path }` artifact before the aggregate boundary. The CLI constructs its database runtime and session/profile dependencies from the selected profile and system keychain, uses its packaged MySQL implementation by default, and imports only the aggregate package.

The CLI additionally exposes an explicit `runtimePorts` injection boundary. A contract constructs the real aggregate through the CLI, injects complete transport-neutral auth/project ports, and executes `auth.profile` plus `project.list-my`. Binding real CLI commands to profile selection and keychain session semantics remains Foundation Task 7; Task 6 does not fabricate JWT secrets or bypass token verification.

The boundary gate accepts `consumer -> aggregate`, `aggregate -> kernel/modules`, and `modules -> kernel`; it continues to reject `aggregate -> consumer` and `module -> aggregate/module/consumer`, as well as cross-package `src` imports.

Fresh verification commands and results:

```text
npm ci --ignore-scripts
# exit 0; 543 packages installed

npm ci --dry-run --ignore-scripts
# exit 0; up to date

npm run test:core
# exit 0; 150 tests: 146 passed, 4 optional database integration tests skipped, 0 failed

npm run test:shared-core-install
# exit 0; 21 passed, 0 failed

node scripts/check-core-package-boundaries.js
# exit 0

git -c core.whitespace=cr-at-eol diff --check
# exit 0
```

The package-lock/export audit also repacked all five packages and matched exact versions and SRI integrity in both standalone consumer lockfiles. JavaScript syntax checks and manifest/lock/export consistency checks exited `0`.

Review-driven GREEN additions include a runtime aggregate-package/manifest version check, strict auth input/output validation, project input validation through each module-owned public schema before lazy initialization or side effects, normalized Web logout inputs, and controller compatibility coverage for list metadata, mutations, imports, exports, and backup downloads. The independent re-review found no Critical or Important issues and returned `Ready`.

## Disposable Registry and Install

The acceptance test starts a fresh Verdaccio `6.9.2` instance on an OS-assigned `127.0.0.1` port, creates one ephemeral authenticated account, and writes its token only to a temporary npmrc. It packs and publishes the actual kernel, auth, project-spaces, aggregate, and CLI tarballs in dependency order, then installs `@johnason/data-platform-cli@0.1.0` globally into a new temporary prefix.

From a different arbitrary working directory, the test:

- resolves the aggregate through the installed CLI package tree;
- executes real `auth.profile` and `project.list-my` aggregate capabilities;
- runs the installed `data-platform` binary;
- audits application `fs.open*`/`fs.readFile*` access and rejects any path outside the installation prefix;
- rejects any `net.Server.listen` call, proving no Express listener starts;
- asserts every loaded application file in `require.cache` is inside the prefix;
- proves the auditor detects a deliberate repository-file access attempt.

The install uses only published semantic versions from the loopback registry; no `workspace:` or `file:` dependency substitutes are used. Temporary registry storage, account data, tarballs, npmrc, prefix, and arbitrary working directory are removed by the test cleanup.

The tracked standalone backend and CLI locks are retained. Each consumer now has a secret-free `.npmrc` that routes only the `@johnason` scope through the explicit `${JOHNASON_NPM_REGISTRY}` environment value and enables registry-host replacement for locked internal tarballs. The acceptance test copies each standalone manifest, lock, and `.npmrc` into a clean directory and successfully runs `npm ci --workspaces=false --ignore-scripts` against the disposable registry before the global-prefix install. Thus a missing registry configuration fails as missing deployment configuration instead of silently targeting unpublished public packages.

## Commit

`feat(core): aggregate shared capabilities for web and CLI` (this Task 6 commit).

## Concerns

- `npm audit --omit=dev` reports the existing backend production dependency set with 12 findings (4 moderate, 8 high, 0 critical). The new aggregate's external dependency path adds no finding; remediation is outside Task 6.
- Four optional backend database integration tests remain skipped because no integration database is configured.
- Real CLI command/session binding remains Foundation Task 7. Task 6 exposes only the safe runtime-port seam and proves real capability execution with complete injected ports.
- The pre-existing untracked `artifacts/` directory was neither modified nor staged.
