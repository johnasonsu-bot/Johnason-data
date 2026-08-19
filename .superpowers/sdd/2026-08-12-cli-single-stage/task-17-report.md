# Task 17 Report — External API Invocation Gate

## Outcome

The API gate harness is stricter and its controlled-provider mechanics are covered, but the release gate is intentionally **blocked**. No approved real external-provider endpoint, credentials, or real command-execution evidence was available. No fabricated acceptance evidence was created.

## Candidate characterization

- Portable base: `623915470b2f44e79cff9891c6f85321e5ea31e2`; first Task 17 candidate: `b7ceb34ca176f503463c010b9dad18c9c3f06e6d`.
- The existing `api-gate.test.js` correctly enumerated 37 classified API capabilities through the shared catalog.
- Before this change, `CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js` failed because evidence was missing (`blocked` instead of `accepted`).
- The candidate had no Task 17 external API or model-provider server fixtures and no release evidence file.
- An installed-binary probe of `data-lab analyze-scene --input '{}'` stopped at `PROFILE_REQUIRED`; it did not reach an external provider and did not issue Data Platform HTTP.

## Implemented scope

- Added a loopback external API fixture covering JSON success, pagination, rate limiting, retry progression, timeout, malformed JSON, NDJSON streaming, and request cancellation.
- Added a model-provider fixture covering model discovery and SSE completion streaming.
- Added the published service-runtime fixture contract, explicitly marking loopback as ineligible for release evidence.
- The current gate validates only actual CLI/capability contracts: committed provider policy and command cases, the repository-owned packed binary, declared output provenance, and declared audit/event/idempotency/stream-terminal fields when those fields actually exist. It does not accept self-declared evidence records.
- Preserved the candidate's honest missing-evidence status as `blocked`; `CLI_API_GATE=1` therefore still fails with classified capability IDs and precise missing-policy/provenance reasons, as required for absent approved infrastructure.

## TDD evidence

1. Added fixture-dependent API-gate tests first and ran them. They failed with `MODULE_NOT_FOUND` for `./fixtures/external-api-server`.
2. Added the minimal controlled fixtures and reran the focused suite: 5 tests passed.
3. Added the release-evidence rejection test first and reran. It failed with `ReferenceError: validateApiReleaseEvidence is not defined`.
4. Implemented the minimal strict validator and reran: 6 focused tests passed without `CLI_API_GATE`; the strict gate then failed only for missing evidence (`blocked != accepted`).

## Verification

| Command | Result |
| --- | --- |
| `cd packages/data-platform-cli && npm test` | 77 passed, 0 failed |
| `cd packages/data-platform-cli && npm run pack:check` | exit 0 |
| `CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js` | expected failure: 15 passed, 1 failed because committed policies/cases remain empty |
| `git diff --check` | clean |

The redacted environment fingerprint and test outputs are appended to `packages/data-platform-cli/tests/TEST.md`.

## Remaining blocker

Task 17 cannot be accepted until an approved real external API/model/service-runtime environment is supplied and all 37 classified capabilities produce the required successful installed-command evidence. Controlled loopback tests prove mechanics only and are explicitly prevented from satisfying the release gate.

## Review round 1 remediation

- Removed the self-declared evidence acceptance path. The gate no longer reads external evidence JSON or trusts provider/host/hash, binary, exit code, audit/event, or idempotency values supplied as records.
- Added an approved-environment command harness. It accepts only a committed service-runtime allowlist, a case file containing non-sensitive command arguments, an installed binary path, and a profile name. For each of the 37 API capabilities it derives the CLI command from the catalog, invokes the installed binary, and derives the success status, JSON envelope metadata, audit ID, event ID, idempotency-key hash, and provider host from that subprocess result.
- The committed allowlist is deliberately empty because no provider has been approved. This produces `blocked`, rather than a false `accepted`, even if a caller self-supplies an environment host.
- The harness normalizes trailing-dot hostnames, bracketed IPv6, and IPv4-mapped IPv6, and rejects both direct and DNS-resolved loopback targets. The service-runtime contract is now consumed by the harness for the allowlist and required command-result metadata.
- The cancellation test registers its `cancelled` promise before aborting, removing the event race.
- `TEST.md` now labels its retained output as concise non-release characterization and distinguishes the portable base from the Task 17 candidate.

### Review-fix TDD and verification

1. Added missing approved-harness and endpoint-validation tests; the focused suite failed with missing function references.
2. Implemented the minimal command-derived harness; added a contract metadata expectation which failed until the contract declared the consumed metadata.
3. Added a versioned-empty-allowlist test; it failed as `failed` until the harness was corrected to preserve `blocked` when no provider is approved.
4. Final focused gate: 9 passed without release mode; full CLI suite: 74 passed. Strict release mode remains expected-blocked without approved infrastructure.

## Review round 2 remediation

- Removed the environment-selected binary path. The gate discovers only `.local/data-platform-cli/install`, verifies the real path remains inside that prefix, requires package name `@johnason/data-platform-cli`, exact source-package version, and requires the local `.bin/data-platform` shim to resolve to that package's declared bin.
- Replaced the single service-runtime allowlist with committed, secret-free provider policy buckets: `external-api`, `model-provider`, and `service-runtime`. The catalog check confirms their current classified counts are 34, 1, and 2 respectively. All host lists remain empty; no placeholder host was approved.
- Added a committed, versioned command-case artifact. It is intentionally empty without approved infrastructure. The gate reports every classified capability as blocked with a precise missing policy/case/provenance reason.
- Removed invented provider/audit/event/idempotency output requirements. The current capability/runtime contract declares none, so the gate does not claim them. If a future capability declares provenance, audit, event, idempotency, or stream-terminal contracts, the harness derives and validates those fields only from the installed CLI subprocess output.
- Added format-aware output parsing: stream definitions are parsed line-by-line as NDJSON and can validate a declared terminal evidence field; JSON definitions require a successful JSON envelope.
- Full redacted outputs are appended to `TEST.md`; its base/candidate labels remain explicit.

## Review round 3 remediation

- Added current-package provenance verification. When execution prerequisites are complete, the gate runs `npm pack --dry-run --json` for the current CLI source, hashes every packed file, and compares each byte-for-byte with the repository-owned local installed package. A same-version stale or modified install now fails.
- Moved audit/event/idempotency requirements into the committed per-capability command-case schema. Every case must explicitly declare all three booleans; write capabilities must require all three and map their actual output paths. The gate reads only those mapped subprocess fields. Empty cases remain blocked.
- Reordered the gate so provider policies, cases, profiles, and case contracts are checked before package provenance. Missing approved inputs return `blocked`; a missing or non-matching local package becomes `failed` only after the gate is otherwise ready to execute.

## Review round 4 remediation

- The two standalone installed-package provenance unit tests now register with a skip reason when the repository-owned `.local/data-platform-cli/install` prerequisite is absent. A present-but-invalid install is not skipped and still fails verification.
- The production `runApprovedApiGate` order is unchanged: committed policy, cases, profile, and case contracts are evaluated before installed-package provenance.
- The current-package byte-integrity implementation is unchanged. When execution prerequisites are ready it still derives the current `npm pack --dry-run --json` manifest and hashes every packed source/install file pair.

### Review-fix TDD evidence

1. Clean-environment reproduction before the fix used an in-process filesystem shim that forced `.local/data-platform-cli/install` to be absent, then loaded `api-gate.test.js`. Exact TAP summary: `tests 16`, `pass 14`, `fail 2`, `skipped 0`, exit `1`. The only failures were the two provenance tests at then-lines 307 and 314, both with `ENOENT` from `findVerifiedLocalInstall`; the blocked-policy gate test passed.
2. Added `installed-package provenance unit tests skip when the local install prerequisite is absent` before adding the helper. Exact RED command and result:

   ```text
   node --test --test-name-pattern='installed-package provenance unit tests skip' packages/data-platform-cli/tests/api-gate.test.js
   # tests 1
   # pass 0
   # fail 1
   error: installedPackageProvenanceTestOptions is not defined
   exit 1
   ```

3. Added the minimal prerequisite test option and applied it only to the two standalone provenance tests. Exact GREEN result for the command above: `tests 1`, `pass 1`, `fail 0`, exit `0`.
4. Repeated the clean-environment shim after the fix. Exact TAP summary: `tests 17`, `pass 15`, `fail 0`, `skipped 2`, exit `0`; both provenance tests reported `# SKIP requires the repository-owned local CLI install`, while both blocked-policy tests passed.
5. Repeated that shim with `CLI_API_GATE=1`. Exact TAP summary: `tests 17`, `pass 14`, `fail 1`, `skipped 2`, exit `1`; the only failure was the expected strict `blocked != accepted` assertion listing empty policy/case/profile reasons, with no `.local`/`ENOENT` provenance failure.

### Fresh verification evidence

| Command | Exit | Exact result |
| --- | ---: | --- |
| `node --test packages/data-platform-cli/tests/api-gate.test.js` | 0 | `tests 17`, `pass 17`, `fail 0`, `skipped 0`; both real installed-package provenance tests executed |
| `cd packages/data-platform-cli && npm test` | 0 | `tests 78`, `pass 78`, `fail 0`, `skipped 0` |
| `cd packages/data-platform-cli && npm run pack:check` | 0 | `@johnason/data-platform-cli@0.2.0`, `total files: 23` |
| `CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js` | 1 (expected blocked) | `tests 17`, `pass 16`, `fail 1`, `skipped 0`; strict assertion received `blocked` because committed policies/cases remain empty |

The expected strict blocker begins with `data-development.028.runcopilottaskstream: no committed approved host for external-api` and `data-development.028.runcopilottaskstream: no committed command case`; it does not fail on `.local` provenance first.
