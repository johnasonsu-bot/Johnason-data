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

## Task 17 concise non-release characterization (2026-08-19)

This is a concise non-release test summary, not aggregate release evidence. Redacted environment fingerprint: Node `v22.20.0`; Darwin `27.0.0 arm64`; CLI package `@johnason/data-platform-cli@0.2.0`; portable base `623915470b2f44e79cff9891c6f85321e5ea31e2`; first Task 17 candidate `b7ceb34ca176f503463c010b9dad18c9c3f06e6d`. No credential values, endpoint URLs, or provider identifiers were recorded.

Candidate baseline:

```text
$ CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js
# API classified capabilities: 37
# result: FAIL — api gate evidence is missing (blocked != accepted)
```

The controlled loopback fixtures cover only mechanics: successful JSON, pagination, `429` with `Retry-After`, retry progression, timeout, malformed JSON, NDJSON streaming, request cancellation, model discovery, and SSE completion. They are not command-level or release coverage. A release run requires a host committed to the versioned service-runtime allowlist and derives every result by launching the installed `data-platform` binary once for each of the 37 classified capabilities. The harness reads only command-case arguments, derives the command, idempotency hash, exit status, JSON envelope, provider-host metadata, audit ID, and event ID from subprocess results, and rejects loopback hostnames/IPs plus DNS-resolved loopback addresses.

Focused and package regression output:

```text
$ cd packages/data-platform-cli && npm test
# tests 70
# pass 70
# fail 0
# skipped 0

$ npm run pack:check
# exit 0; @johnason/data-platform-cli@0.2.0 dry-run package contains 23 files

$ CLI_API_GATE=1 node --test tests/api-gate.test.js
# tests 9
# pass 8
# fail 1
# failure: approved endpoint, case file, installed binary, and profile are required (blocked != accepted)
```

The strict gate remains intentionally blocked: no provider endpoint is approved in the committed allowlist, and approved real external-provider infrastructure plus real command execution has not been supplied. No Data Platform HTTP request was made.
