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

## Current verified results (2026-08-13)

- CLI tests: 57 passed, 0 failed before final repack; includes full 596/84 tree, strict API/database evidence validators, profile/keychain/session/policy cleanup, REPL, daemon, file and stream adapters.
- Core tests: 23 passed, 0 failed.
- Backend regression: 35 passed, 0 failed, 4 real database integration contracts skipped because connection environments were not supplied.
- Isolated install: 24 tarballs, 596 capabilities, 21 modules, arbitrary-cwd health command passed, repository absolute-path findings 0. Binary: `.local/data-platform-cli/install/node_modules/.bin/data-platform`.
- Rollback orchestrator contract: success, injected failure, maintenance preservation, and unsafe-environment rejection passed. The 21 real `0.1.0 -> 0.2.0` drills remain blocked until historical packages and test infrastructure are supplied.
- Frontend build: TypeScript passed; Vite transformed 6068 modules and completed production output plus gzip/brotli in `.local/frontend-build/dist`. Dependencies were installed only in `.local/frontend-build`; `frontend/node_modules` and the development service were untouched. Existing large-chunk warnings remain.

## Mandatory gates not yet accepted

- External API: 37 classified capabilities require complete real non-mock evidence.
- Databases: MySQL 595; PostgreSQL 130; Oracle 130; DM 130 classified capabilities require real engine evidence.
- Aviation: the installed CLI must execute all seven real stages twice with the same business keys and prove no duplicates.
- Aggregate: requires accepted evidence for every module plus API, four databases, package install, aviation twice, zero bypasses, and zero secret findings.
