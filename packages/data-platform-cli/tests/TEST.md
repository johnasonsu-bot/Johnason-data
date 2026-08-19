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

The controlled loopback fixtures cover only mechanics: successful JSON, pagination, `429` with `Retry-After`, retry progression, timeout, malformed JSON, NDJSON streaming, request cancellation, model discovery, and SSE completion. They are not command-level or release coverage. The gate resolves only the repository-owned packed install under `.local/data-platform-cli/install`, verifies its package name/version/bin relationship, and ignores `CLI_API_GATE_BINARY`. Its committed, secret-free policy separates approved hosts by `external-api`, `model-provider`, and `service-runtime`; all three lists are intentionally empty. The committed case artifact is also empty. Each capability therefore remains blocked with its own policy/case/provenance reason; no CLI metadata requirements are invented where the current capability/runtime contract declares none.

Focused and package regression output:

```text
$ cd packages/data-platform-cli && npm test
# tests 74
# pass 74
# fail 0
# skipped 0

$ npm run pack:check
# exit 0; @johnason/data-platform-cli@0.2.0 dry-run package contains 23 files

$ CLI_API_GATE=1 node --test tests/api-gate.test.js
# tests 13
# pass 12
# fail 1
# failure: each classified capability is listed as blocked by absent committed provider policy/case/provenance evidence
```

The strict gate remains intentionally blocked: no provider endpoint is approved in the committed policy, and approved real external-provider infrastructure plus real command execution has not been supplied. No Data Platform HTTP request was made. Full redacted command output follows in the Task 17 round-2 evidence appendix.

## Task 17 round-2 full redacted output (2026-08-19)

The following is raw command output. It contains no supplied credential values, provider hosts, or command case payloads.

```text
$ cd packages/data-platform-cli && npm test
Your user’s .npmrc file (${HOME}/.npmrc)
has a `globalconfig` and/or a `prefix` setting, which are incompatible with nvm.
Run `nvm use --delete-prefix v22.20.0 --silent` to unset it.

> @johnason/data-platform-cli@0.2.0 test
> node --test tests/*.test.js

TAP version 13
# Subtest: every generated command parses and invokes its default shared-core capability
ok 1 - every generated command parses and invokes its default shared-core capability
  ---
  duration_ms: 3185.017375
  type: 'test'
  ...
# Subtest: controlled external API fixture preserves success, pagination, rate-limit, retry, and malformed contracts
ok 2 - controlled external API fixture preserves success, pagination, rate-limit, retry, and malformed contracts
  ---
  duration_ms: 35.965166
  type: 'test'
  ...
# Subtest: controlled external API fixture supports NDJSON streaming, timeout, and cancellation
ok 3 - controlled external API fixture supports NDJSON streaming, timeout, and cancellation
  ---
  duration_ms: 39.775
  type: 'test'
  ...
# Subtest: controlled model-provider fixture supports model discovery and streaming completion
ok 4 - controlled model-provider fixture supports model discovery and streaming completion
  ---
  duration_ms: 6.48875
  type: 'test'
  ...
# Subtest: API gate enumerates every classified capability
ok 5 - API gate enumerates every classified capability
  ---
  duration_ms: 1.384167
  type: 'test'
  ...
# Subtest: gate locates and verifies only the repository-owned packed CLI install
ok 6 - gate locates and verifies only the repository-owned packed CLI install
  ---
  duration_ms: 0.675875
  type: 'test'
  ...
# Subtest: provider policy is committed by provider and begins with no approved hosts
ok 7 - provider policy is committed by provider and begins with no approved hosts
  ---
  duration_ms: 0.157709
  type: 'test'
  ...
# Subtest: API classifications map to the committed provider policy buckets
ok 8 - API classifications map to the committed provider policy buckets
  ---
  duration_ms: 0.898542
  type: 'test'
  ...
# Subtest: stream output is parsed as NDJSON rather than as one JSON envelope
ok 9 - stream output is parsed as NDJSON rather than as one JSON envelope
  ---
  duration_ms: 0.123916
  type: 'test'
  ...
# Subtest: approved command harness lists classified capabilities blocked by absent committed policy and cases
ok 10 - approved command harness lists classified capabilities blocked by absent committed policy and cases
  ---
  duration_ms: 1.565625
  type: 'test'
  ...
# Subtest: profile or arbitrary binary input does not override the committed provider policy
ok 11 - profile or arbitrary binary input does not override the committed provider policy
  ---
  duration_ms: 1.724792
  type: 'test'
  ...
# Subtest: approved endpoint validation rejects normalized and DNS-resolved loopback hosts
ok 12 - approved endpoint validation rejects normalized and DNS-resolved loopback hosts
  ---
  duration_ms: 0.211792
  type: 'test'
  ...
# Subtest: service-runtime contract stays limited to controlled-fixture mechanics
ok 13 - service-runtime contract stays limited to controlled-fixture mechanics
  ---
  duration_ms: 0.03575
  type: 'test'
  ...
# Subtest: API gate requires command-derived real evidence
ok 14 - API gate requires command-derived real evidence
  ---
  duration_ms: 1.38875
  type: 'test'
  ...
# Subtest: ontology CLI writes and verifies graph and simulation files
ok 15 - ontology CLI writes and verifies graph and simulation files
  ---
  duration_ms: 4.574708
  type: 'test'
  ...
# Subtest: aviation CLI executes only injected registered stages
ok 16 - aviation CLI executes only injected registered stages
  ---
  duration_ms: 0.526875
  type: 'test'
  ...
# Subtest: aviation facade rejects stage files that merely claim successful checkpoints
ok 17 - aviation facade rejects stage files that merely claim successful checkpoints
  ---
  duration_ms: 5.500959
  type: 'test'
  ...
# Subtest: injects the selected profile runtime and closes it after success
ok 18 - injects the selected profile runtime and closes it after success
  ---
  duration_ms: 0.785625
  type: 'test'
  ...
# Subtest: closes the database runtime exactly once after failure
ok 19 - closes the database runtime exactly once after failure
  ---
  duration_ms: 0.411167
  type: 'test'
  ...
# Subtest: stores login token in keychain but removes it from command output
ok 20 - stores login token in keychain but removes it from command output
  ---
  duration_ms: 0.302042
  type: 'test'
  ...
# Subtest: local capabilities execute without loading profile, keychain, or database
ok 21 - local capabilities execute without loading profile, keychain, or database
  ---
  duration_ms: 0.100625
  type: 'test'
  ...
# Subtest: loadActor verifies token, active session, current user, and touches the session
ok 22 - loadActor verifies token, active session, current user, and touches the session
  ---
  duration_ms: 0.244625
  type: 'test'
  ...
# Subtest: loadActor rejects revoked sessions before capability execution
ok 23 - loadActor rejects revoked sessions before capability execution
  ---
  duration_ms: 0.114417
  type: 'test'
  ...
# Subtest: capability policy rejects missing module permission and viewer writes
ok 24 - capability policy rejects missing module permission and viewer writes
  ---
  duration_ms: 0.1865
  type: 'test'
  ...
# Subtest: project policy rejects a user without active membership
ok 25 - project policy rejects a user without active membership
  ---
  duration_ms: 0.140958
  type: 'test'
  ...
# Subtest: profile daemon lock is exclusive and recoverable
ok 26 - profile daemon lock is exclusive and recoverable
  ---
  duration_ms: 3.158542
  type: 'test'
  ...
# Subtest: daemon start and status are profile-scoped and detached
ok 27 - daemon start and status are profile-scoped and detached
  ---
  duration_ms: 5.105041
  type: 'test'
  ...
# Subtest: database gate enumerates every engine-classified capability
ok 28 - database gate enumerates every engine-classified capability
  ---
  duration_ms: 3.949458
  type: 'test'
  ...
# Subtest: database gate requires complete real non-mock evidence
ok 29 - database gate requires complete real non-mock evidence
  ---
  duration_ms: 10.681084
  type: 'test'
  ...
# Subtest: database password is read only from keychain
ok 30 - database password is read only from keychain
  ---
  duration_ms: 0.467375
  type: 'test'
  ...
# Subtest: missing keychain password fails closed
ok 31 - missing keychain password fails closed
  ---
  duration_ms: 0.192916
  type: 'test'
  ...
# Subtest: accepts and deduplicates approved execution targets
ok 32 - accepts and deduplicates approved execution targets
  ---
  duration_ms: 0.754875
  type: 'test'
  ...
# Subtest: rejects empty, unknown, and malformed targets
ok 33 - rejects empty, unknown, and malformed targets
  ---
  duration_ms: 0.313125
  type: 'test'
  ...
# Subtest: resolves dynamic datasource engine to the real target
ok 34 - resolves dynamic datasource engine to the real target
  ---
  duration_ms: 0.13675
  type: 'test'
  ...
# Subtest: config profile add reads secrets from stdin and persists only non-secret fields
ok 35 - config profile add reads secrets from stdin and persists only non-secret fields
  ---
  duration_ms: 37.371917
  type: 'test'
  ...
# Subtest: JSON mode emits exactly one document and stable code for invalid commands
ok 36 - JSON mode emits exactly one document and stable code for invalid commands
  ---
  duration_ms: 0.817
  type: 'test'
  ...
# Subtest: generated command executes through Commander with positional IDs and one JSON document
ok 37 - generated command executes through Commander with positional IDs and one JSON document
  ---
  duration_ms: 0.757375
  type: 'test'
  ...
# Subtest: project facade resolves through the shared catalog and selects profile project
ok 38 - project facade resolves through the shared catalog and selects profile project
  ---
  duration_ms: 0.903083
  type: 'test'
  ...
# Subtest: catalog and command tree cover all inventory entries
ok 39 - catalog and command tree cover all inventory entries
  ---
  duration_ms: 13.332708
  type: 'test'
  ...
# Subtest: every definition enforces its I/O and safety contract
ok 40 - every definition enforces its I/O and safety contract
  ---
  duration_ms: 8.754334
  type: 'test'
  ...
# Subtest: all generated command help renders
ok 41 - all generated command help renders
  ---
  duration_ms: 20.92975
  type: 'test'
  ...
# Subtest: shared command aliases execute one canonical capability by default
ok 42 - shared command aliases execute one canonical capability by default
  ---
  duration_ms: 3.009667
  type: 'test'
  ...
# Subtest: namespaces database and session secrets per profile
ok 43 - namespaces database and session secrets per profile
  ---
  duration_ms: 0.663709
  type: 'test'
  ...
# Subtest: reads database and session values without exposing account internals
ok 44 - reads database and session values without exposing account internals
  ---
  duration_ms: 0.158833
  type: 'test'
  ...
# Subtest: deletes each secret independently
ok 45 - deletes each secret independently
  ---
  duration_ms: 0.108083
  type: 'test'
  ...
# Subtest: returns null for a missing secret
ok 46 - returns null for a missing secret
  ---
  duration_ms: 0.92075
  type: 'test'
  ...
# Subtest: rejects empty profile names and secret values
ok 47 - rejects empty profile names and secret values
  ---
  duration_ms: 0.733459
  type: 'test'
  ...
# Subtest: fails closed when native keyring is unavailable
ok 48 - fails closed when native keyring is unavailable
  ---
  duration_ms: 0.215834
  type: 'test'
  ...
# Subtest: redacts native failures and offers no filesystem fallback
ok 49 - redacts native failures and offers no filesystem fallback
  ---
  duration_ms: 0.10475
  type: 'test'
  ...
# Subtest: ontology package inspection distinguishes valid rows from missing source baselines
ok 50 - ontology package inspection distinguishes valid rows from missing source baselines
  ---
  duration_ms: 22.652084
  type: 'test'
  ...
# Subtest: ontology package validation rejects duplicate natural keys and dangling dependencies
ok 51 - ontology package validation rejects duplicate natural keys and dangling dependencies
  ---
  duration_ms: 6.474792
  type: 'test'
  ...
# Subtest: ontology package reports required environment names without exposing values
ok 52 - ontology package reports required environment names without exposing values
  ---
  duration_ms: 5.52925
  type: 'test'
  ...
# Subtest: package exposes data-platform for Node 22.20+
ok 53 - package exposes data-platform for Node 22.20+
  ---
  duration_ms: 0.762791
  type: 'test'
  ...
# Subtest: workspace local installer is pinned below .local and verifies the installed catalog
ok 54 - workspace local installer is pinned below .local and verifies the installed catalog
  ---
  duration_ms: 0.194625
  type: 'test'
  ...
# Subtest: resolves the macOS application support config path
ok 55 - resolves the macOS application support config path
  ---
  duration_ms: 0.965334
  type: 'test'
  ...
# Subtest: resolves the Linux XDG config path
ok 56 - resolves the Linux XDG config path
  ---
  duration_ms: 0.117959
  type: 'test'
  ...
# Subtest: persists profile state atomically with mode 0600
ok 57 - persists profile state atomically with mode 0600
  ---
  duration_ms: 3.015333
  type: 'test'
  ...
# Subtest: rejects recursively nested secret fields
ok 58 - rejects recursively nested secret fields
  ---
  duration_ms: 0.489625
  type: 'test'
  ...
# Subtest: rejects duplicate profile names
ok 59 - rejects duplicate profile names
  ---
  duration_ms: 1.110459
  type: 'test'
  ...
# Subtest: rejects invalid database ports
ok 60 - rejects invalid database ports
  ---
  duration_ms: 0.8245
  type: 'test'
  ...
# Subtest: selects an existing profile and lists deterministic names
ok 61 - selects an existing profile and lists deterministic names
  ---
  duration_ms: 8.469375
  type: 'test'
  ...
# Subtest: refuses to select a missing profile
ok 62 - refuses to select a missing profile
  ---
  duration_ms: 0.282417
  type: 'test'
  ...
# Subtest: removing the current profile clears selection and supports project selection
ok 63 - removing the current profile clears selection and supports project selection
  ---
  duration_ms: 3.63825
  type: 'test'
  ...
# Subtest: recursively redacts credentials and URI passwords
ok 64 - recursively redacts credentials and URI passwords
  ---
  duration_ms: 2.033542
  type: 'test'
  ...
# Subtest: error envelopes are redacted
ok 65 - error envelopes are redacted
  ---
  duration_ms: 0.210875
  type: 'test'
  ...
# Subtest: maps stable exit codes
ok 66 - maps stable exit codes
  ---
  duration_ms: 0.249917
  type: 'test'
  ...
# Subtest: renders collected NDJSON buffers line by line with redaction
ok 67 - renders collected NDJSON buffers line by line with redaction
  ---
  duration_ms: 0.208708
  type: 'test'
  ...
# Subtest: REPL tokenizes quotes and escapes without shell evaluation
ok 68 - REPL tokenizes quotes and escapes without shell evaluation
  ---
  duration_ms: 0.90525
  type: 'test'
  ...
# Subtest: REPL reuses argv execution and exposes profile/project context
ok 69 - REPL reuses argv execution and exposes profile/project context
  ---
  duration_ms: 1.596834
  type: 'test'
  ...
# Subtest: JSON mode without a command fails once and never enters REPL
ok 70 - JSON mode without a command fails once and never enters REPL
  ---
  duration_ms: 1.652708
  type: 'test'
  ...
# Subtest: three acceptance source assets match the architecture-approved fingerprints
ok 71 - three acceptance source assets match the architecture-approved fingerprints
  ---
  duration_ms: 1.158458
  type: 'test'
  ...
# Subtest: inventory totals and every route handler binding are complete
ok 72 - inventory totals and every route handler binding are complete
  ---
  duration_ms: 0.519708
  type: 'test'
  ...
# Subtest: generated CLI response is a real Writable and collects piped content
ok 73 - generated CLI response is a real Writable and collects piped content
  ---
  duration_ms: 1.617667
  type: 'test'
  ...
# Subtest: generated CLI response keeps download paths for --output handling
ok 74 - generated CLI response keeps download paths for --output handling
  ---
  duration_ms: 0.441375
  type: 'test'
  ...
1..74
# tests 74
# suites 0
# pass 74
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3828.112083

$ npm run pack:check
Your user’s .npmrc file (${HOME}/.npmrc)
has a `globalconfig` and/or a `prefix` setting, which are incompatible with nvm.
Run `nvm use --delete-prefix v22.20.0 --silent` to unset it.

> @johnason/data-platform-cli@0.2.0 pack:check
> npm pack --dry-run

npm notice
npm notice 📦  @johnason/data-platform-cli@0.2.0
npm notice Tarball Contents
npm notice 3.0kB README.md
npm notice 259B bin/data-platform.js
npm notice 756B package.json
npm notice 405B src/commands/aviation-acceptance.js
npm notice 5.1kB src/commands/config.js
npm notice 5.4kB src/commands/daemon.js
npm notice 1.3kB src/commands/file-io.js
npm notice 12.0kB src/commands/foundation.js
npm notice 9.5kB src/commands/ontology-package.js
npm notice 1.5kB src/commands/ontology.js
npm notice 1.6kB src/daemon/process-manager.js
npm notice 12.8kB src/main.js
npm notice 2.8kB src/output.js
npm notice 2.6kB src/registry/domain-commands.js
npm notice 2.3kB src/registry/execution-targets.js
npm notice 2.3kB src/repl/repl.js
npm notice 7.2kB src/runtime/cli-execution.js
npm notice 795B src/runtime/database.js
npm notice 1.5kB src/runtime/hidden-input.js
npm notice 3.2kB src/runtime/keychain.js
npm notice 984B src/runtime/paths.js
npm notice 5.3kB src/runtime/policies.js
npm notice 3.7kB src/runtime/profile-store.js
npm notice Tarball Details
npm notice name: @johnason/data-platform-cli
npm notice version: 0.2.0
npm notice filename: johnason-data-platform-cli-0.2.0.tgz
npm notice package size: 22.9 kB
npm notice unpacked size: 86.2 kB
npm notice shasum: 44a59989eaf687274f90c1425fd0dcdc010f7a0e
npm notice integrity: sha512-PdLch21MiAlBa[...]hpfEYRByvuQAA==
npm notice total files: 23
npm notice
johnason-data-platform-cli-0.2.0.tgz

$ CLI_API_GATE=1 node --test tests/api-gate.test.js
Your user’s .npmrc file (${HOME}/.npmrc)
has a `globalconfig` and/or a `prefix` setting, which are incompatible with nvm.
Run `nvm use --delete-prefix v22.20.0 --silent` to unset it.
TAP version 13
# Subtest: controlled external API fixture preserves success, pagination, rate-limit, retry, and malformed contracts
ok 1 - controlled external API fixture preserves success, pagination, rate-limit, retry, and malformed contracts
  ---
  duration_ms: 29.198208
  type: 'test'
  ...
# Subtest: controlled external API fixture supports NDJSON streaming, timeout, and cancellation
ok 2 - controlled external API fixture supports NDJSON streaming, timeout, and cancellation
  ---
  duration_ms: 29.646541
  type: 'test'
  ...
# Subtest: controlled model-provider fixture supports model discovery and streaming completion
ok 3 - controlled model-provider fixture supports model discovery and streaming completion
  ---
  duration_ms: 5.083833
  type: 'test'
  ...
# Subtest: API gate enumerates every classified capability
ok 4 - API gate enumerates every classified capability
  ---
  duration_ms: 1.310458
  type: 'test'
  ...
# Subtest: gate locates and verifies only the repository-owned packed CLI install
ok 5 - gate locates and verifies only the repository-owned packed CLI install
  ---
  duration_ms: 0.649834
  type: 'test'
  ...
# Subtest: provider policy is committed by provider and begins with no approved hosts
ok 6 - provider policy is committed by provider and begins with no approved hosts
  ---
  duration_ms: 0.151375
  type: 'test'
  ...
# Subtest: API classifications map to the committed provider policy buckets
ok 7 - API classifications map to the committed provider policy buckets
  ---
  duration_ms: 0.839083
  type: 'test'
  ...
# Subtest: stream output is parsed as NDJSON rather than as one JSON envelope
ok 8 - stream output is parsed as NDJSON rather than as one JSON envelope
  ---
  duration_ms: 0.113708
  type: 'test'
  ...
# Subtest: approved command harness lists classified capabilities blocked by absent committed policy and cases
ok 9 - approved command harness lists classified capabilities blocked by absent committed policy and cases
  ---
  duration_ms: 1.42625
  type: 'test'
  ...
# Subtest: profile or arbitrary binary input does not override the committed provider policy
ok 10 - profile or arbitrary binary input does not override the committed provider policy
  ---
  duration_ms: 1.660875
  type: 'test'
  ...
# Subtest: approved endpoint validation rejects normalized and DNS-resolved loopback hosts
ok 11 - approved endpoint validation rejects normalized and DNS-resolved loopback hosts
  ---
  duration_ms: 0.199958
  type: 'test'
  ...
# Subtest: service-runtime contract stays limited to controlled-fixture mechanics
ok 12 - service-runtime contract stays limited to controlled-fixture mechanics
  ---
  duration_ms: 0.034625
  type: 'test'
  ...
# Subtest: API gate requires command-derived real evidence
not ok 13 - API gate requires command-derived real evidence
  ---
  duration_ms: 1.666916
  type: 'test'
  location: '/Users/sushi/Documents/ChatGPT/Johnason-data/.worktrees/data-platform-cli/packages/data-platform-cli/tests/api-gate.test.js:325:1'
  failureType: 'testCodeFailure'
  error: |-
    data-development.028.runcopilottaskstream: no committed approved host for external-api
    data-development.028.runcopilottaskstream: no committed command case
    data-development.028.runcopilottaskstream: CLI_API_GATE_PROFILE is required
    data-development.028.runcopilottaskstream: capability does not declare provider-output provenance
    data-development.028.runcopilottaskstream: stream capability does not declare a terminal evidence contract
    data-development.029.runcopilottask: no committed approved host for external-api
    data-development.029.runcopilottask: no committed command case
    data-development.029.runcopilottask: CLI_API_GATE_PROFILE is required
    data-development.029.runcopilottask: capability does not declare provider-output provenance
    data-lab.014.analyzescene: no committed approved host for external-api
    data-lab.014.analyzescene: no committed command case
    data-lab.014.analyzescene: CLI_API_GATE_PROFILE is required
    data-lab.014.analyzescene: capability does not declare provider-output provenance
    data-lab.086.generateaibusinessdataplan: no committed approved host for external-api
    data-lab.086.generateaibusinessdataplan: no committed command case
    data-lab.086.generateaibusinessdataplan: CLI_API_GATE_PROFILE is required
    data-lab.086.generateaibusinessdataplan: capability does not declare provider-output provenance
    data-lab.088.generateaibusinessdatabatch: no committed approved host for external-api
    data-lab.088.generateaibusinessdatabatch: no committed command case
    data-lab.088.generateaibusinessdatabatch: CLI_API_GATE_PROFILE is required
    data-lab.088.generateaibusinessdatabatch: capability does not declare provider-output provenance
    data-lab.089.loadaibusinessdatabatch: no committed approved host for external-api
    data-lab.089.loadaibusinessdatabatch: no committed command case
    data-lab.089.loadaibusinessdatabatch: CLI_API_GATE_PROFILE is required
    data-lab.089.loadaibusinessdatabatch: capability does not declare provider-output provenance
    data-lab.091.saveaibusinessdatatask: no committed approved host for external-api
    data-lab.091.saveaibusinessdatatask: no committed command case
    data-lab.091.saveaibusinessdatatask: CLI_API_GATE_PROFILE is required
    data-lab.091.saveaibusinessdatatask: capability does not declare provider-output provenance
    data-lab.092.updateaibusinessdatataskschedule: no committed approved host for external-api
    data-lab.092.updateaibusinessdatataskschedule: no committed command case
    data-lab.092.updateaibusinessdatataskschedule: CLI_API_GATE_PROFILE is required
    data-lab.092.updateaibusinessdatataskschedule: capability does not declare provider-output provenance
    data-lab.093.runaibusinessdatatask: no committed approved host for external-api
    data-lab.093.runaibusinessdatatask: no committed command case
    data-lab.093.runaibusinessdatatask: CLI_API_GATE_PROFILE is required
    data-lab.093.runaibusinessdatatask: capability does not declare provider-output provenance
    data-lab.094.deleteaibusinessdatatask: no committed approved host for external-api
    data-lab.094.deleteaibusinessdatatask: no committed command case
    data-lab.094.deleteaibusinessdatatask: CLI_API_GATE_PROFILE is required
    data-lab.094.deleteaibusinessdatatask: capability does not declare provider-output provenance
    data-map.037.analyzeresourcecontentprofile: no committed approved host for external-api
    data-map.037.analyzeresourcecontentprofile: no committed command case
    data-map.037.analyzeresourcecontentprofile: CLI_API_GATE_PROFILE is required
    data-map.037.analyzeresourcecontentprofile: capability does not declare provider-output provenance
    data-map.038.analyzeresourcefieldprofile: no committed approved host for external-api
    data-map.038.analyzeresourcefieldprofile: no committed command case
    data-map.038.analyzeresourcefieldprofile: CLI_API_GATE_PROFILE is required
    data-map.038.analyzeresourcefieldprofile: capability does not declare provider-output provenance
    data-map.039.analyzeresourceprofile: no committed approved host for external-api
    data-map.039.analyzeresourceprofile: no committed command case
    data-map.039.analyzeresourceprofile: CLI_API_GATE_PROFILE is required
    data-map.039.analyzeresourceprofile: capability does not declare provider-output provenance
    data-services.013.recommendserviceconfig: no committed approved host for external-api
    data-services.013.recommendserviceconfig: no committed command case
    data-services.013.recommendserviceconfig: CLI_API_GATE_PROFILE is required
    data-services.013.recommendserviceconfig: capability does not declare provider-output provenance
    data-services.031.handleinvoke: no committed approved host for service-runtime
    data-services.031.handleinvoke: no committed command case
    data-services.031.handleinvoke: CLI_API_GATE_PROFILE is required
    data-services.031.handleinvoke: capability does not declare provider-output provenance
    data-services.032.handleinvoke: no committed approved host for service-runtime
    data-services.032.handleinvoke: no committed command case
    data-services.032.handleinvoke: CLI_API_GATE_PROFILE is required
    data-services.032.handleinvoke: capability does not declare provider-output provenance
    data-sources.005.samplerows: no committed approved host for external-api
    data-sources.005.samplerows: no committed command case
    data-sources.005.samplerows: CLI_API_GATE_PROFILE is required
    data-sources.005.samplerows: capability does not declare provider-output provenance
    data-sources.009.testconnection: no committed approved host for external-api
    data-sources.009.testconnection: no committed command case
    data-sources.009.testconnection: CLI_API_GATE_PROFILE is required
    data-sources.009.testconnection: capability does not declare provider-output provenance
    data-standards.031.suggestdataelements: no committed approved host for external-api
    data-standards.031.suggestdataelements: no committed command case
    data-standards.031.suggestdataelements: CLI_API_GATE_PROFILE is required
    data-standards.031.suggestdataelements: capability does not declare provider-output provenance
    ingestion-tasks.007.recommendtaskconfig: no committed approved host for external-api
    ingestion-tasks.007.recommendtaskconfig: no committed command case
    ingestion-tasks.007.recommendtaskconfig: CLI_API_GATE_PROFILE is required
    ingestion-tasks.007.recommendtaskconfig: capability does not declare provider-output provenance
    ingestion-tasks.009.previewsourcedata: no committed approved host for external-api
    ingestion-tasks.009.previewsourcedata: no committed command case
    ingestion-tasks.009.previewsourcedata: CLI_API_GATE_PROFILE is required
    ingestion-tasks.009.previewsourcedata: capability does not declare provider-output provenance
    ingestion-tasks.014.analyzejobrunfailure: no committed approved host for external-api
    ingestion-tasks.014.analyzejobrunfailure: no committed command case
    ingestion-tasks.014.analyzejobrunfailure: CLI_API_GATE_PROFILE is required
    ingestion-tasks.014.analyzejobrunfailure: capability does not declare provider-output provenance
    model-providers.002.testmodelprovider: no committed approved host for model-provider
    model-providers.002.testmodelprovider: no committed command case
    model-providers.002.testmodelprovider: CLI_API_GATE_PROFILE is required
    model-providers.002.testmodelprovider: capability does not declare provider-output provenance
    quality-control.014.analyzeregexrule: no committed approved host for external-api
    quality-control.014.analyzeregexrule: no committed command case
    quality-control.014.analyzeregexrule: CLI_API_GATE_PROFILE is required
    quality-control.014.analyzeregexrule: capability does not declare provider-output provenance
    quality-control.021.analyzedictionarytable: no committed approved host for external-api
    quality-control.021.analyzedictionarytable: no committed command case
    quality-control.021.analyzedictionarytable: CLI_API_GATE_PROFILE is required
    quality-control.021.analyzedictionarytable: capability does not declare provider-output provenance
    quality-control.042.recommendstrategy: no committed approved host for external-api
    quality-control.042.recommendstrategy: no committed command case
    quality-control.042.recommendstrategy: CLI_API_GATE_PROFILE is required
    quality-control.042.recommendstrategy: capability does not declare provider-output provenance
    quality-control.043.startrecommendation: no committed approved host for external-api
    quality-control.043.startrecommendation: no committed command case
    quality-control.043.startrecommendation: CLI_API_GATE_PROFILE is required
    quality-control.043.startrecommendation: capability does not declare provider-output provenance
    quality-control.045.applyrecommendationrun: no committed approved host for external-api
    quality-control.045.applyrecommendationrun: no committed command case
    quality-control.045.applyrecommendationrun: CLI_API_GATE_PROFILE is required
    quality-control.045.applyrecommendationrun: capability does not declare provider-output provenance
    quality-control.046.rejectrecommendationrun: no committed approved host for external-api
    quality-control.046.rejectrecommendationrun: no committed command case
    quality-control.046.rejectrecommendationrun: CLI_API_GATE_PROFILE is required
    quality-control.046.rejectrecommendationrun: capability does not declare provider-output provenance
    quality-control.084.runqualityaianalysis: no committed approved host for external-api
    quality-control.084.runqualityaianalysis: no committed command case
    quality-control.084.runqualityaianalysis: CLI_API_GATE_PROFILE is required
    quality-control.084.runqualityaianalysis: capability does not declare provider-output provenance
    quality-control.087.queryqualityopsrobot: no committed approved host for external-api
    quality-control.087.queryqualityopsrobot: no committed command case
    quality-control.087.queryqualityopsrobot: CLI_API_GATE_PROFILE is required
    quality-control.087.queryqualityopsrobot: capability does not declare provider-output provenance
    reporting.006.suggestaichartanalysis: no committed approved host for external-api
    reporting.006.suggestaichartanalysis: no committed command case
    reporting.006.suggestaichartanalysis: CLI_API_GATE_PROFILE is required
    reporting.006.suggestaichartanalysis: capability does not declare provider-output provenance
    reporting.007.planaichartsql: no committed approved host for external-api
    reporting.007.planaichartsql: no committed command case
    reporting.007.planaichartsql: CLI_API_GATE_PROFILE is required
    reporting.007.planaichartsql: capability does not declare provider-output provenance
    reporting.008.reviseaichartsql: no committed approved host for external-api
    reporting.008.reviseaichartsql: no committed command case
    reporting.008.reviseaichartsql: CLI_API_GATE_PROFILE is required
    reporting.008.reviseaichartsql: capability does not declare provider-output provenance
    reporting.009.runaichartquery: no committed approved host for external-api
    reporting.009.runaichartquery: no committed command case
    reporting.009.runaichartquery: CLI_API_GATE_PROFILE is required
    reporting.009.runaichartquery: capability does not declare provider-output provenance
    reporting.010.recommendaichart: no committed approved host for external-api
    reporting.010.recommendaichart: no committed command case
    reporting.010.recommendaichart: CLI_API_GATE_PROFILE is required
    reporting.010.recommendaichart: capability does not declare provider-output provenance
    reporting.011.allocateaichartfieldmap: no committed approved host for external-api
    reporting.011.allocateaichartfieldmap: no committed command case
    reporting.011.allocateaichartfieldmap: CLI_API_GATE_PROFILE is required
    reporting.011.allocateaichartfieldmap: capability does not declare provider-output provenance
    + actual - expected

    + 'blocked'
    - 'accepted'

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'accepted'
  actual: 'blocked'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/Users/sushi/Documents/ChatGPT/Johnason-data/.worktrees/data-platform-cli/packages/data-platform-cli/tests/api-gate.test.js:328:25)
    process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..13
# tests 13
# suites 0
# pass 12
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 483.963084
```
