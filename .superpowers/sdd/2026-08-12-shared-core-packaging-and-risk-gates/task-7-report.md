# Shared-core Task 7 report

Status: complete candidate; independent review round 3/5 Ready with 0 Critical, 0 Important, and 0 Minor.

## RED / GREEN

- Initial focused RED: `MODULE_NOT_FOUND` for `src/risk/evidence-schema` and `scripts/build-module-acceptance-manifest` (0 passed, 2 failed).
- Kernel evidence accepts only the exact 11 named gates, exact lifecycle status enum, strict redacted environment fingerprint/count/duration/hash fields, chronological timestamps, exact package version plus SHA-512 SRI, and zero failed/skipped/secret findings. The normalized document is recursively frozen.
- Acceptance is computed rather than trusted. Unknown gates/fields, skipped gates, version or timestamp disagreement, `accepted:true` spoofing, mock Oracle/DM targets, and plaintext sensitive fields/arguments fail closed.
- Secret checks cover URI authority credentials, ADO password properties, Oracle thin credentials, token query parameters, Bearer/Basic authorization, private-key markers, and sensitive command options. Exact scoped npm package specs such as `@scope/package@0.2.0` remain valid.
- The manifest builder only reads candidate evidence at canonical `<evidenceRoot>/<module>/<version>/accepted.json` and rejects duplicate module names before counting.

## Installed-package evidence

- The GREEN fixture uses a real `npm pack` tarball and fresh `npm install` prefix rather than a hand-built workspace/file dependency substitute.
- The main lock must be owned by the external install prefix. Its version/resolved/integrity entries must exactly match npm's hidden install lock and the evidence document.
- Exactly one supplied tarball must match the recorded SHA-512 SRI. The builder parses that tarball and compares every installed file path and byte before calculating a deterministic installed-content SHA-256.
- Installed package version and public export keys are verified. Export loading happens in an isolated Node child whose `Module._resolveFilename`/`_load` auditor permits builtins and realpaths under the external prefix only; a real packed wrapper that loads the already cached repository kernel is rejected.
- Symlink/path escape and post-install mutation are rejected. The emitted manifest contains only a relative package locator and hashes, not machine-specific absolute paths.
- Manifest output uses an exclusive temporary file followed by atomic rename. Task code contains no physical-delete call.

## Review

- Round 1: Not Ready — fixed fake/tampered installation acceptance, parent-cache repo-source bypass, incomplete plaintext-secret matching, duplicate/path-based module counting, and absolute-path output.
- Round 2: Not Ready — refined Oracle credential detection so an exact scoped npm package argument is not misclassified as a secret.
- Round 3: Ready — 0 Critical, 0 Important, 0 Minor; cache-bypass wrapper and Oracle/scoped-package behavior independently confirmed.

## Fresh verification

- Focused evidence/builder: 11 passed, 0 failed; `--verify-only` exited 0 with `acceptedModuleCount: 0` and no accepted modules.
- Workspace `npm run test:core`: CLI 84/84; aggregate 12/12; kernel 54 passed plus 2 explicit live-environment skips; auth 14/14; project 38/38; backend 40 passed plus 4 optional live-database skips.
- `npm run test:shared-core-install`: 21/21.
- `npm run check:boundaries`, kernel `npm pack --dry-run`, changed-file syntax, no-delete scan, and `git diff --check`: exited 0.

## Concerns

- Current committed auth/project legacy publication documents are not accepted risk evidence and are deliberately excluded. Accepted module count remains zero until Task 8 supplies real rollback and re-upgrade evidence.
- No Oracle/DM mock is treated as live acceptance. The real external database gates remain future acceptance work, not claimed by this task.
- The pre-existing untracked `artifacts/` directory was not touched.
