# Task 17 Report — External API Invocation Gate

## Outcome

The API gate harness is stricter and its controlled-provider mechanics are covered, but the release gate is intentionally **blocked**. No approved real external-provider endpoint, credentials, or real command-execution evidence was available. No fabricated acceptance evidence was created.

## Candidate characterization

- Base and candidate HEAD: `623915470b2f44e79cff9891c6f85321e5ea31e2`.
- The existing `api-gate.test.js` correctly enumerated 37 classified API capabilities through the shared catalog.
- Before this change, `CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js` failed because evidence was missing (`blocked` instead of `accepted`).
- The candidate had no Task 17 external API or model-provider server fixtures and no release evidence file.
- An installed-binary probe of `data-lab analyze-scene --input '{}'` stopped at `PROFILE_REQUIRED`; it did not reach an external provider and did not issue Data Platform HTTP.

## Implemented scope

- Added a loopback external API fixture covering JSON success, pagination, rate limiting, retry progression, timeout, malformed JSON, NDJSON streaming, and request cancellation.
- Added a model-provider fixture covering model discovery and SSE completion streaming.
- Added the published service-runtime contract fixture, explicitly marking loopback as ineligible for release evidence.
- Extended the API gate to reject release evidence unless it has:
  - the existing complete, real, non-mock, zero-bypass, zero-secret-findings evidence fields;
  - a non-loopback provider fingerprint with a SHA-256 digest only;
  - exactly one successful installed `data-platform` execution record for every classified capability;
  - JSON/NDJSON format plus redacted audit, event, and idempotency references on every record; and
  - no sensitive field names in the provider fingerprint or execution records.
- Preserved the candidate's honest missing-evidence status as `blocked`; `CLI_API_GATE=1` therefore still fails, as required for absent approved infrastructure.

## TDD evidence

1. Added fixture-dependent API-gate tests first and ran them. They failed with `MODULE_NOT_FOUND` for `./fixtures/external-api-server`.
2. Added the minimal controlled fixtures and reran the focused suite: 5 tests passed.
3. Added the release-evidence rejection test first and reran. It failed with `ReferenceError: validateApiReleaseEvidence is not defined`.
4. Implemented the minimal strict validator and reran: 6 focused tests passed without `CLI_API_GATE`; the strict gate then failed only for missing evidence (`blocked != accepted`).

## Verification

| Command | Result |
| --- | --- |
| `cd packages/data-platform-cli && npm test` | 67 passed, 0 failed |
| `cd packages/data-platform-cli && npm run pack:check` | exit 0 |
| `CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js` | expected failure: 5 passed, 1 failed because real evidence is missing |
| `git diff --check` | clean |

The redacted environment fingerprint and test outputs are appended to `packages/data-platform-cli/tests/TEST.md`.

## Remaining blocker

Task 17 cannot be accepted until an approved real external API/model/service-runtime environment is supplied and all 37 classified capabilities produce the required successful installed-command evidence. Controlled loopback tests prove mechanics only and are explicitly prevented from satisfying the release gate.
