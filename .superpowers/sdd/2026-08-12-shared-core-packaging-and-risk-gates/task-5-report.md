# Task 5 — Project spaces and access policies report

## RED

`node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/execution-context.test.js` initially failed all project-capability cases with `MODULE_NOT_FOUND: Cannot find module '../src'`; the kernel policy case also failed because `createLicensePolicy` was absent. The separate Web compatibility test initially failed because `createAuthMiddleware` was absent. These failures exercise missing public capabilities rather than a test typo.

Review round 1 also recorded `npm ci --dry-run --ignore-scripts` failing with `EUSAGE`: the root lockfile was missing `@johnason/data-platform-module-project-spaces@0.2.0`. New contracts then failed on malformed project IDs falling through to default selection, default-project creation omitting the first-admin owner lookup, an omitted license feature list denying access, and incomplete source API coverage.

Review round 2 first failed the new source-API mapping contract because the candidate exposed no semantic per-operation capability handlers, and failed the side-effect contract because invalid and unknown explicit IDs invoked default-membership creation. The viewer-mutation contract then failed before the injected I/O port was gated. These RED results preceded the matching implementation.

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

The mapping contract invokes every one of the 17 source API capabilities with its real transport shape and asserts that the matching handler (not an arbitrary shared handler) receives unchanged inputs. Mutation operations apply the kernel module/read-only policy before they invoke the injected I/O port; a viewer is rejected with no I/O call.

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

## Concerns / handoff

1. The strict graph intentionally keeps backend from importing module or kernel packages. Task 6 must bind Web/CLI through the aggregate while retaining the compatibility factories.
2. The disposable registry process was stopped after readback. Its local data and the rollback tarball remain unstaged; cleanup or deletion requires explicit approval.
