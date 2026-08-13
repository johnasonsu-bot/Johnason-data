# Shared-core Task 8 report

Status: complete candidate; focused rollback/re-upgrade acceptance is green. The independent review slot was unavailable after the module workers completed, so final review remains a release checkpoint.

## RED / GREEN

- Initial RED: `node --test tests/module-acceptance/rollback-drill.test.js` failed because `scripts/run-module-rollback-drill.js` was absent.
- GREEN: the drill publishes and installs real `0.1.0` and `0.2.0` fixture tarballs through Verdaccio 6.9.2 on loopback, creates one fact, enters maintenance, drains/stops workers, snapshots, rolls back, verifies the upgraded schema/fact, re-installs the candidate, and checks idempotency.
- Validation is fail-closed for production (including `NODE_ENV`), non-loopback registries, dirty manifest/lock digests, non-exact or downgrade versions, untrusted/symlink-escaping paths, inline credential forms, and downgrade migrations.
- Evidence is redacted, hashed, written with exclusive temporary creation and atomic rename, and preserves the real maintenance state when command output or evidence writing fails. Registry versions are retained; no physical deletion is used.

## Fresh verification

- `node --test tests/module-acceptance/rollback-drill.test.js`: 6 passed, 0 failed.
- Success path proves version sequence `0.2.0 -> 0.1.0 -> 0.2.0`, schema/fact identity, non-target package byte identity, and one idempotency fact.
- Failure paths prove maintenance retention, safe evidence, path/secret/production rejection, malformed maintenance output handling, and evidence-write failure handling.
- The pre-existing untracked `artifacts/` directory was not touched.

## Remaining release gate

- Real module-specific rollback evidence for each of the 19 migrated business modules and live MySQL/PostgreSQL/Oracle/DM/Kafka gates remain in later plan tasks. This fixture drill does not claim live external infrastructure acceptance.
