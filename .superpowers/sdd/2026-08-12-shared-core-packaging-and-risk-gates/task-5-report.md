# Task 5 — Project spaces and access policies report

## RED

`node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/execution-context.test.js` initially failed all project-capability cases with `MODULE_NOT_FOUND: Cannot find module '../src'`; the kernel policy case also failed because `createLicensePolicy` was absent. The separate Web compatibility test initially failed because `createAuthMiddleware` was absent. These failures exercise missing public capabilities rather than a test typo.

Review round 1 also recorded `npm ci --dry-run --ignore-scripts` failing with `EUSAGE`: the root lockfile was missing `@johnason/data-platform-module-project-spaces@0.2.0`. New contracts then failed on malformed project IDs falling through to default selection, default-project creation omitting the first-admin owner lookup, an omitted license feature list denying access, and incomplete source API coverage.

## GREEN

`@johnason/data-platform-module-project-spaces@0.2.0` provides a transport-neutral repository, service, project-context policy, immutable manifest, and capability factory. It covers project list/current/resolve/use/access-check and uses only the core-kernel package.

The kernel now supplies authorization, license, and activation policy factories. Errors have stable `code`, `statusCode`, `retryable: false`, and only public, redacted `details`. The injected Web compatibility factories preserve `req.user`, `req.project`, `req.projectId`, `req.projectMember`, and the prior project-validation error DTO.

Contract fixtures cover admin access, viewer write rejection, module-permission rejection, missing membership, disabled projects, concurrent contexts, saved default selection, zero/single/multiple resolution choices, package source API coverage, and Web DTO compatibility.

The review contracts additionally reject explicit unknown/non-numeric/zero/negative project IDs without changing the selected project; only absent IDs use fallback selection. License policy defaults to unrestricted when `enabledFeatures` is omitted, while an explicit empty list denies. The repository retains the baseline first-admin owner lookup when creating the default project. The five declared project capabilities now call real service methods and their source API keys equal the coverage-baseline project API set exactly.

## Legacy baseline

The transport-neutral 0.1.0 baseline passed the project and Web golden contracts and was packed as `johnason-data-platform-module-project-spaces-0.1.0.tgz` (3,646 bytes; SHA-512 `fa9cdfa041cd2660739a9b89df379c5c377cfe93cb83afee464a1c3635b63db10d23c96292dc76e99101e6f56941f95e9ab8f8d75b96870d1a16099f640dfa00`). Its package manifest contained only `package.json` and the four transport-neutral source files.

The original evidence and tarball remain local but are superseded. Review round 1 uses an independent test-only, transport-neutral 0.1.0 adapter transcribed from the actual `8414786` backend project service; it is not a production fallback and is never imported by runtime code. Its Web golden comparison passes against the 0.2.0 candidate for list/current/resolve/default DTO and persistence behavior.

The new unique review artifact was published to a new disposable Verdaccio 6.9.2 loopback registry and tagged `legacy-accepted`. Readback returned `version = '0.1.0'`, `tag = 'legacy-accepted'`, and the recorded SHA-512 integrity. The replacement evidence includes base commit, distinct legacy/candidate source-tree hashes, golden test status, tarball hash/SRI, exact pack manifest, loopback host-and-port, and command exit statuses. It rejects unexpected and secret-shaped fields and verifies source-tree and hash/SRI consistency.

## Candidate verification

Fresh successful commands:

```text
node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/*.test.js backend/src/common/middleware/auth.project-context.test.js
# 29 pass, 0 fail

node scripts/check-core-package-boundaries.js
# exit 0

npm ci --ignore-scripts && npm ci --dry-run --ignore-scripts
# exit 0; root lockfile contains the project-spaces workspace link

npm --workspace @johnason/data-platform-module-project-spaces pack --dry-run
# @johnason/data-platform-module-project-spaces@0.2.0; five publishable files

cd backend && npm test
# 32 pass, 0 fail, 4 skipped optional integration tests
```

## Commit

`refactor(core): package project and access policies`

Review round 1 follow-up is committed with the lockfile, strict evidence, baseline fixture, and policy fixes.

## Concerns / handoff

1. The strict graph intentionally keeps backend from importing module or kernel packages. Task 6 must bind Web/CLI through the aggregate while retaining the compatibility factories.
2. The disposable registry process was stopped after readback. Its local data and the rollback tarball remain unstaged; cleanup or deletion requires explicit approval.
