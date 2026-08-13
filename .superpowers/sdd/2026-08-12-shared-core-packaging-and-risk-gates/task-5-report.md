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
