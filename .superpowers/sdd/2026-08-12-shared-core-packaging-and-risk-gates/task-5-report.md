# Task 5 — Project spaces and access policies report

## RED

`node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/execution-context.test.js` initially failed all project-capability cases with `MODULE_NOT_FOUND: Cannot find module '../src'`; the kernel policy case also failed because `createLicensePolicy` was absent. The separate Web compatibility test initially failed because `createAuthMiddleware` was absent. These failures exercise missing public capabilities rather than a test typo.

Review round 1 also recorded `npm ci --dry-run --ignore-scripts` failing with `EUSAGE`: the root lockfile was missing `@johnason/data-platform-module-project-spaces@0.2.0`. New contracts then failed on malformed project IDs falling through to default selection, default-project creation omitting the first-admin owner lookup, an omitted license feature list denying access, and incomplete source API coverage.

Review round 2 first failed the new source-API mapping contract because the candidate exposed no semantic per-operation capability handlers, and failed the side-effect contract because invalid and unknown explicit IDs invoked default-membership creation. The viewer-mutation contract then failed before the injected I/O port was gated. These RED results preceded the matching implementation.

Review round 3 first failed the system-projects-only route contract because source operations were still gated by `data_map`; it also failed the port DTO contract because arbitrary port results were passed through unvalidated. The tests for data-map-only rejection, `list`/`setDefault` protection, and viewer preview-with-zero-I/O then drove the authorization change.

## GREEN

`@johnason/data-platform-module-project-spaces@0.2.0` provides a transport-neutral repository, service, project-context policy, immutable manifest, and capability factory. It covers project list/current/resolve/use/access-check and uses only the core-kernel package.

The kernel now supplies authorization, license, and activation policy factories. Errors have stable `code`, `statusCode`, `retryable: false`, and only public, redacted `details`. The injected Web compatibility factories preserve `req.user`, `req.project`, `req.projectId`, `req.projectMember`, and the prior project-validation error DTO.

Contract fixtures cover admin access, viewer write rejection, module-permission rejection, missing membership, disabled projects, concurrent contexts, saved default selection, zero/single/multiple resolution choices, package source API coverage, and Web DTO compatibility.

The review contracts additionally reject explicit unknown/non-numeric/zero/negative project IDs before default-project or membership side effects; only absent IDs use fallback selection. License policy defaults to unrestricted when `enabledFeatures` is omitted, while an explicit empty list denies. The repository retains the baseline first-admin owner lookup when creating the default project.

## Legacy baseline

The original 3,646-byte “baseline” tarball/evidence was an incorrect candidate-derived artifact, not a true legacy baseline. It is retained locally and explicitly superseded; it must not be used for rollback or compatibility claims.

The original evidence and tarball remain local but are superseded. Review round 1 uses an independent test-only, transport-neutral 0.1.0 adapter transcribed from the actual `8414786` backend project service; it is not a production fallback and is never imported by runtime code. Its Web golden comparison passes against the 0.2.0 candidate for list/current/resolve/default DTO and persistence behavior.

The new unique review artifact was published to a new disposable Verdaccio 6.9.2 loopback registry and tagged `legacy-accepted`. Readback returned `version = '0.1.0'`, `tag = 'legacy-accepted'`, and the recorded SHA-512 integrity. The replacement evidence includes base commit, distinct legacy/candidate source-tree hashes, golden test status, tarball hash/SRI, exact pack manifest, loopback host-and-port, and command exit statuses. It rejects unexpected and secret-shaped fields and verifies source-tree and hash/SRI consistency.

Review round 2 replaces the prior artificial five-handler API allocation with 21 semantic capabilities: the 17 baseline project API keys each map to their matching list, mutation, asset-transfer, import, backup, export, or detail capability; `current`, `resolve`, `use`, and `access-check` remain explicitly internal with no claimed source API. Non-repository operations use an injected `projectOperations` port and never import backend code. The authoritative legacy tarball is 1,279 bytes with SHA-512 `69683444be5da474dec167af83548768b7af253829f2c4724ef0bfb035c885d5e6e420c4c6525838ae06221cdc7cbdb18db50fc4e9be5d833a304242f66e4d31`; source-tree hashes use the same `src` publishing scope on both sides.

The mapping contract invokes every one of the 17 source API capabilities with its real transport shape and asserts that the matching handler (not an arbitrary shared handler) is selected. A descriptor normalizes positive IDs, project/member bodies, import options, and file metadata before a port receives only its I/O arguments; it validates record/list/delete result shapes, maps not-found/conflict failures to stable public project errors, and returns a redacted `{ data }` DTO envelope. Malformed port “success” results are rejected with `PROJECT_PORT_INVALID_RESULT` rather than accepted from an arbitrary stub.

Review round 3 applies `modules: ["system_projects"]` to every source capability except self-service `GET /projects/my` (`listMy`). The root list and default-selection operations are now gated too. Preview import is a write action, so a viewer is denied before the I/O port is invoked. Tests prove system-projects-only success, data-map-only rejection, missing-list permission rejection, zero-I/O viewer preview rejection, and retained self-service `/my` access.

## Candidate verification

Fresh successful commands:

```text
node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/*.test.js backend/src/common/middleware/auth.project-context.test.js
# 29 pass, 0 fail

node --test packages/data-platform-module-project-spaces/tests/*.test.js packages/data-platform-core-kernel/tests/*.test.js
# 38 pass, 0 fail; includes legacy-golden, repository, acceptance-evidence, source mapping, and project contracts

node scripts/check-core-package-boundaries.js
# exit 0

npm ci --ignore-scripts && npm ci --dry-run --ignore-scripts
# exit 0; root lockfile contains the project-spaces workspace link

npm --workspace @johnason/data-platform-module-project-spaces pack --dry-run
# @johnason/data-platform-module-project-spaces@0.2.0; five publishable files

cd backend && npm test
# 32 pass, 0 fail, 4 skipped optional integration tests

rg -n --hidden --glob '!node_modules/**' --glob '!artifacts/**' --glob '!*.tgz' --glob '!package-lock.json' '<credential-value patterns>' packages/data-platform-module-project-spaces evidence/module-acceptance/project-spaces .superpowers/sdd/2026-08-12-shared-core-packaging-and-risk-gates/task-5-report.md
# no credential-shaped value; the only match is the intentional `token: "forbidden"` negative evidence-schema fixture

git diff --check
# exit 0
```

## Commit

`refactor(core): package project and access policies`

Review round 1 follow-up is committed with the lockfile, strict evidence, baseline fixture, and policy fixes.

Review round 2 follows with the semantic source API mapping, pre-side-effect explicit ID validation, same-scope evidence hashes, and viewer-before-I/O policy contract.

Review round 3 follows with system-projects source authorization and descriptor-backed, validated public port contracts.

Round 3 final verification reran `node --test packages/data-platform-module-project-spaces/tests/*.test.js packages/data-platform-core-kernel/tests/*.test.js` (41 pass, 0 fail), the core boundary scanner (exit 0), root `npm ci --ignore-scripts` and `npm ci --dry-run --ignore-scripts` (both exit 0), module pack dry-run (five publishable files), backend tests (32 pass, 4 optional skips), the credential-value scan (only intentional negative-schema fixtures), and `git diff --check` (exit 0).

## Concerns / handoff

1. The strict graph intentionally keeps backend from importing module or kernel packages. Task 6 must bind Web/CLI through the aggregate while retaining the compatibility factories.
2. The disposable registry process was stopped after readback. Its local data and the rollback tarball remain unstaged; cleanup or deletion requires explicit approval.

## Review round 4 — exact schemas, public port errors, and DTO serialization

### RED

The first transport-contract run was intentionally made before production changes:

```text
node --test packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js
# exit 1
# tests 8; pass 4; fail 4
# Missing expected rejection: invalid project body/status/member/import/export inputs
# Missing expected rejection: detail accepted a project record without members
# actual code/status/retryable: PROJECT_DRIVER_FAILURE / 418 / true
# Date values serialized as {}
```

The failing cases proved that generic `record`/`list` checks accepted operation-specific malformed results, arbitrary `PROJECT_*` port failures were trusted, and the recursive DTO mapper had no `Date`, `Buffer`, or cycle contract. A second focused RED replaced the malformed create result with a numeric-string ID:

```text
node --test --test-name-pattern='each project operation applies' packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js
# exit 1
# tests 1; pass 0; fail 1
# Missing expected rejection: create
```

The first full package/kernel regression correctly failed only after the new source file changed the recorded candidate tree hash:

```text
node --test packages/data-platform-module-project-spaces/tests/*.test.js packages/data-platform-core-kernel/tests/*.test.js
# exit 1
# tests 44; pass 42; fail 2
# both failures: acceptance evidence candidate source-tree hash mismatch
```

### GREEN

`project-operation-contracts.js` now publishes transport-neutral, per-operation input/result schemas. Project create/update match the Web contract (`projectName`, formatted `projectCode`, project type/status/defaults); member roles/status/permissions and import/export options are enumerated and normalized. Detail, project records, members, transfer logs, preview, import summary, backups, and download/export artifacts each validate their own required fields before a DTO is emitted. No HTTP request/response type is imported.

Port failures are always reconstructed from the package-owned public codes `PROJECT_CONFLICT`, `PROJECT_NOT_FOUND`, `PROJECT_OPERATION_INVALID`, or `PROJECT_OPERATION_FAILED`. Messages, status, and `retryable: false` are fixed; only per-code detail keys survive recursive secret-key redaction. An arbitrary `PROJECT_DRIVER_FAILURE` is reduced to the fixed 500 failure with empty details.

The DTO serializer converts valid `Date` values to ISO strings, recursively removes secret/internal keys, rejects `Buffer` and unsupported values, and reports cycles as the stable `PROJECT_PORT_INVALID_RESULT` 502 error. The legacy acceptance record retains its original tarball/tag/readback and now records candidate source hash `bac4331a0a21a2ebe913b52c95c165394ea3795edee511d418d9a0bb476dcfd5`.

Fresh verification output:

```text
node --test packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js
# exit 0; tests 8; pass 8; fail 0

node --test packages/data-platform-module-project-spaces/tests/*.test.js packages/data-platform-core-kernel/tests/*.test.js
# exit 0; tests 44; pass 44; fail 0

npm ci --ignore-scripts && npm ci --dry-run --ignore-scripts
# exit 0; 542 packages installed; dry run up to date
# existing audit output: 12 vulnerabilities (4 moderate, 8 high)

npm run test:core
# exit 0
# CLI 19/19; kernel 19/19; auth 14/14; project-spaces 25/25
# backend 32 pass, 0 fail, 4 optional integration skips

npm run test:shared-core-install
# exit 0; tests 18; pass 18; fail 0

node --test backend/src/common/middleware/auth.project-context.test.js backend/src/common/middleware/access-policy.factory.test.js
# exit 0; tests 4; pass 4; fail 0

cd backend && npm test
# exit 0; 32 pass, 0 fail, 4 optional integration skips

node scripts/check-core-package-boundaries.js
# exit 0

npm --workspace @johnason/data-platform-module-project-spaces pack --dry-run
# exit 0; @johnason/data-platform-module-project-spaces@0.2.0; six publishable files

rg -q <high-confidence credential patterns> packages/data-platform-module-project-spaces evidence/module-acceptance/project-spaces task-5-report.md
# no match; guarded scan exit 0

node --check packages/data-platform-module-project-spaces/src/project-operation-contracts.js
node --check packages/data-platform-module-project-spaces/src/index.js
git diff --check
# all exit 0
```

### Round 4 concerns

1. `npm ci` reports 12 existing audit findings (4 moderate and 8 high); dependency remediation is outside Task 5 and no dependency changed in this round.
2. Task 6 still owns the Web/CLI aggregate binding. The new file artifact input deliberately uses neutral `name`, `size`, `mediaType`, and optional `path` fields, so the later Web adapter must translate Multer metadata rather than passing `req`, `res`, or the raw Multer object into this package.

## Review round 5 — strict DTO boundaries, integrity-preserving artifacts, and exact error details

### RED

The breaker contracts were added before their implementations:

```text
node --test packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 1; tests 5; pass 0; fail 5
# ordinary and service-backed results accepted unknown rawConnectionString/ssn/privateEndpoint fields
# encrypted artifact password/apiKey fields were removed instead of preserved
# extra top-level artifact secret/connection fields were accepted
# error details retained actual and unsafe supported values

node --test --test-name-pattern='inspect JSON text' packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 1; Missing expected rejection for a JSON text value containing plaintext apiKey

node --test --test-name-pattern='malformed version metadata' packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 1; TypeError: Cannot read properties of undefined (reading 'forEach')

node --test --test-name-pattern='backend-valid empty sensitive' packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 1; PROJECT_PORT_INVALID_RESULT rejected an empty backend-valid sensitive column

node --test --test-name-pattern='legacy user-reference shape' packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 1; PROJECT_PORT_INVALID_RESULT attempted to require a field absent from the retained V3 fixture shape
```

The first full project-package regression after implementation failed only the two evidence assertions because the recorded candidate source-tree hash still described round 4:

```text
node --test packages/data-platform-module-project-spaces/tests/*.test.js
# exit 1; tests 32; pass 30; fail 2
# actual candidate hash bac4331a... did not match new source hash 3a433a04...
```

### GREEN

Every ordinary operation and service-backed operation now parses its result into a newly constructed, operation-specific DTO. Exact top-level and nested key sets reject adapter drift, including `rawConnectionString`, `ssn`, and `privateEndpoint`; project/member/status/timestamp/list/detail/preview/import/backup/transfer fields retain their business enums and shapes. Dates become ISO strings and unsupported buffers, cyclic values, secret-shaped fields, and unknown fields fail with the fixed `PROJECT_PORT_INVALID_RESULT` response.

Export and backup download use a dedicated artifact validator instead of the ordinary DTO serializer. It validates the supported artifact versions, manifest/encryption metadata, strict nested structures, encrypted envelopes, runtime-file hashes, table hashes, and the complete payload SHA-256 before returning the original artifact reference unchanged. Encrypted `password`/`apiKey` envelopes, backend-valid empty sensitive values, JSON-encoded nested fields, field order, and integrity therefore remain untouched. Extra top-level secret/connection fields and plaintext nested secrets are rejected. The prior claim that the retained 3.0.0 seed artifact passed this validator is superseded: the existing seed contains non-empty `app_token` data and is intentionally rejected by the safety rules. No seed file was modified or deleted, and the retained seed is not used as passing evidence. Candidate evidence at the end of round 5 recorded source hash `4a4f71775467f489358dc508176389d103316071b7fb3b8ba974c0f05c8a2eda`.

Port failures are reconstructed from four package-owned codes with fixed message/status/retryability. Details are exact per code: `actual` is never emitted; `field` and `resource` are allowlisted identifiers; IDs are positive integers; and `supported` is a deduplicated restricted-enum array. URI userinfo, bearer text, token/key-shaped values, arbitrary nested details, and every `PROJECT_DRIVER_FAILURE` field are discarded.

Fresh final verification:

```text
node --test packages/data-platform-module-project-spaces/tests/*.test.js packages/data-platform-core-kernel/tests/*.test.js backend/src/common/middleware/auth.project-context.test.js backend/src/common/middleware/access-policy.factory.test.js
# exit 0; tests 57; pass 57; fail 0

npm ci --ignore-scripts
# exit 0; added 542 packages; existing audit output: 12 vulnerabilities (4 moderate, 8 high)

npm ci --dry-run --ignore-scripts
# exit 0; up to date

npm run test:core
# exit 0; CLI 19/19; kernel 19/19; auth 14/14; project-spaces 34/34
# backend 32 pass, 0 fail, 4 optional integration skips

npm run test:shared-core-install
# exit 0; tests 18; pass 18; fail 0

node scripts/check-core-package-boundaries.js
# exit 0

cd backend && npm test
# exit 0; 32 pass, 0 fail, 4 optional integration skips

npm --workspace @johnason/data-platform-module-project-spaces pack --dry-run
# exit 0; @johnason/data-platform-module-project-spaces@0.2.0; six publishable files

node --check packages/data-platform-module-project-spaces/src/project-operation-contracts.js
node --check packages/data-platform-module-project-spaces/src/index.js
# both exit 0

rg -q <high-confidence credential-value patterns> packages/data-platform-module-project-spaces evidence/module-acceptance/project-spaces task-5-report.md
# guarded scan exit 0; no match

git diff --check
# exit 0
```

### Round 5 concerns

1. `npm ci` continues to report the 12 pre-existing audit findings (4 moderate and 8 high); this round changed no dependencies.
2. Task 6 still owns the Multer-to-neutral-file-artifact adapter. Task 5 continues to accept only `name`, optional `size`, `mediaType`, and `path`, and does not import HTTP request/response or Multer types.

## Review round 6 — symmetric nested schemas and canonical Date artifacts

### RED

The nested mutation regression ran before production changes and exposed the asymmetric input/output boundary:

```text
node --test --test-name-pattern='nested mutation DTO schemas' packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js
# exit 1; tests 1; pass 0; fail 1
# create/update/upsertMember actual: PROJECT_PORT_INVALID_RESULT / 502 / portCalls 1
# expected: PROJECT_REQUEST_INVALID / 400 / portCalls 0
```

The Date artifact regression also ran before implementation:

```text
node --test --test-name-pattern='canonicalize Date artifacts' packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 1; tests 1; pass 0; fail 1
# PROJECT_PORT_INVALID_RESULT at artifactProject -> protectedJsonValue
```

These failures proved that nested unknown fields reached the port before being rejected and that real `Date` values were rejected before backend-compatible integrity verification.

### GREEN

Project `resourceConfig`, project `settings`, and member `permissions` now use the same exact nested schemas for mutation input and result DTO parsing. Create, update, and member upsert round-trip every allowed nested field; unknown nested fields such as `privateEndpoint` fail as `PROJECT_REQUEST_INVALID` before the injected port is called.

Artifact validation now first builds a recursive JSON-safe canonical value: valid `Date` instances become ISO strings, object keys follow the stable backend hash order, and Buffer, cyclic, non-finite, unsupported, secret, and unknown-field rules remain enforced. Table and payload integrity are verified against that canonical artifact, and export/download return the canonical ISO result. The regression uses fixed, independently generated backend-semantics SHA-256 fixtures for both the table and payload.

This round supersedes the round-5 “original artifact reference unchanged” wording for Date-bearing artifacts: JSON-safe artifacts remain value-identical, while Date-bearing artifacts return the canonical deep value with ISO strings.

Focused GREEN output:

```text
node --test --test-name-pattern='nested mutation DTO schemas' packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js
# exit 0; tests 1; pass 1; fail 0

node --test --test-name-pattern='Date artifacts|Date artifact canonicalization' packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 0; tests 2; pass 2; fail 0

node --test packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# exit 0; tests 20; pass 20; fail 0
```

The independent review then found that the first shared permissions parser had dropped the prior module-name trimming rule. Its regression was RED before the correction and GREEN afterward:

```text
node --test --test-name-pattern='shared permission schema' packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js
# RED exit 1; tests 1; pass 0; fail 1
# valid module remained " data_map "; blank module called the port once and resolved
# GREEN exit 0; tests 1; pass 1; fail 0
```

The shared permissions schema now trims both input and output module names and rejects blank names before the port. Candidate evidence now records source hash `74e914cbde2340c295f6d48c8aa0d70f4d737775cf6c119d71806e801b67f1bf`.

Fresh final verification:

```text
npm ci --ignore-scripts
# exit 0; added 542 packages
# existing audit output: 12 vulnerabilities (4 moderate, 8 high)

node --test packages/data-platform-module-project-spaces/tests/*.test.js packages/data-platform-core-kernel/tests/*.test.js
# exit 0; tests 57; pass 57; fail 0

npm run test:core
# exit 0
# CLI 19/19; kernel 19/19; auth 14/14; project-spaces 38/38
# backend 32 pass, 0 fail, 4 optional integration skips

npm run test:shared-core-install
# exit 0; tests 18; pass 18; fail 0

node scripts/check-core-package-boundaries.js
# exit 0

cd backend && npm test
# exit 0; 32 pass, 0 fail, 4 optional integration skips

npm --workspace @johnason/data-platform-module-project-spaces pack --dry-run
# exit 0; @johnason/data-platform-module-project-spaces@0.2.0; six publishable files

rg <high-confidence credential-value patterns> packages/data-platform-module-project-spaces evidence/module-acceptance/project-spaces task-5-report.md
# guarded scan exit 0; no match

node --check packages/data-platform-module-project-spaces/src/project-operation-contracts.js
node --check packages/data-platform-module-project-spaces/src/index.js
node --check packages/data-platform-module-project-spaces/tests/project-api-mapping.contract.test.js
node --check packages/data-platform-module-project-spaces/tests/project-result-security.contract.test.js
# all exit 0

git diff --check
# exit 0; seed-data diff empty
```

### Round 6 concerns

1. `npm ci` continues to report the 12 pre-existing audit findings (4 moderate and 8 high); this round changed no dependencies.
2. The retained 3.0.0 seed is deliberately not passing evidence because its non-empty `app_token` data violates the safety contract. It remains unchanged and retained for its separate repository purpose.
