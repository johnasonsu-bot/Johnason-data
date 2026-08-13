# Task 5 — Project spaces and access policies report

## RED

`node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/execution-context.test.js` initially failed all project-capability cases with `MODULE_NOT_FOUND: Cannot find module '../src'`; the kernel policy case also failed because `createLicensePolicy` was absent. The separate Web compatibility test initially failed because `createAuthMiddleware` was absent. These failures exercise missing public capabilities rather than a test typo.

## GREEN

`@johnason/data-platform-module-project-spaces@0.2.0` provides a transport-neutral repository, service, project-context policy, immutable manifest, and capability factory. It covers project list/current/resolve/use/access-check and uses only the core-kernel package.

The kernel now supplies authorization, license, and activation policy factories. Errors have stable `code`, `statusCode`, `retryable: false`, and only public, redacted `details`. The injected Web compatibility factories preserve `req.user`, `req.project`, `req.projectId`, `req.projectMember`, and the prior project-validation error DTO.

Contract fixtures cover admin access, viewer write rejection, module-permission rejection, missing membership, disabled projects, concurrent contexts, saved default selection, zero/single/multiple resolution choices, package source API coverage, and Web DTO compatibility.

## Legacy baseline

The transport-neutral 0.1.0 baseline passed the project and Web golden contracts and was packed as `johnason-data-platform-module-project-spaces-0.1.0.tgz` (3,646 bytes; SHA-512 `fa9cdfa041cd2660739a9b89df379c5c377cfe93cb83afee464a1c3635b63db10d23c96292dc76e99101e6f56941f95e9ab8f8d75596870d1a160999f640dfa0`). Its package manifest contained only `package.json` and the four transport-neutral source files.

## Candidate verification

Fresh successful commands:

```text
node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/*.test.js backend/src/common/middleware/auth.project-context.test.js
# 29 pass, 0 fail

node scripts/check-core-package-boundaries.js
# exit 0

npm --workspace @johnason/data-platform-module-project-spaces pack --dry-run
# @johnason/data-platform-module-project-spaces@0.2.0; five publishable files

cd backend && npm test
# 32 pass, 0 fail, 4 skipped optional integration tests
```

## Commit

`refactor(core): package project and access policies`

## Concerns / handoff

1. Publishing the 0.1.0 tarball and applying the `legacy-accepted` tag could not be completed: the available loopback registries require npm authentication and no credential was supplied. No authentication material was read, created, or recorded. The tarball is available for a credentialed owner to publish and tag; do not treat it as accepted until registry readback succeeds.
2. The strict graph intentionally keeps backend from importing module or kernel packages. Task 6 must bind Web/CLI through the aggregate while retaining the compatibility factories.
3. Loopback-registry data and the rollback tarball are intentionally unstaged. Cleanup or deletion requires explicit approval.
