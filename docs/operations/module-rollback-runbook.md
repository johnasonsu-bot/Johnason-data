# Module rollback and re-upgrade drill

## Decision

Run this drill only in an isolated test environment against an OS-assigned loopback Verdaccio 6.9.2 registry. A candidate is not accepted until the exact candidate package is installed, rolled back to the exact prior package, verified against the upgraded schema and facts, and reinstalled without duplicating the original idempotent write.

## Preconditions

- Use Node.js 22.20 or newer and the repository-pinned Verdaccio 6.9.2 dependency.
- Publish both immutable package versions to a disposable loopback registry. Never unpublish either version.
- Supply exact versions, a clean module manifest, expand-only migrations, a fresh external install prefix, and an evidence directory.
- Supply all lifecycle commands: create facts, enter maintenance, drain, stop workers, snapshot, verify rollback, verify re-upgrade, and exit maintenance.
- Put registry credentials in a process environment injection. A temporary npmrc may reference an environment variable but must not contain its value.
- Do not place passwords, tokens, authorization headers, connection strings, or other secrets in command arguments.

## Required sequence

1. Install the exact candidate package and verify its installed export version.
2. Execute the test write once with a stable idempotency key.
3. Put the module in maintenance, drain active work, and stop its scheduler, consumer, and job-worker hooks.
4. Snapshot facts and hash every installed non-target package.
5. Install the exact rollback version without running a database downgrade.
6. Verify the rollback version reads the already-upgraded schema and the candidate-created fact.
7. Confirm all non-target installed package bytes remain unchanged.
8. Reinstall the exact candidate version and execute the same idempotency key.
9. Require one final fact, zero duplicates, unchanged non-target packages, and an unchanged manifest.
10. Exit maintenance only after every check passes.

## Failure handling

- Exit `0`: rollback and re-upgrade accepted; maintenance was exited.
- Exit `1`: validation, compatibility, rollback, or idempotency failure. Keep the target module in maintenance and investigate the evidence code.
- Exit `7`: package registry or installation infrastructure unavailable. Keep the result blocked; do not claim acceptance.

On any failure after maintenance begins, do not replay writes through another version and do not run a downgrade migration. Retain both registry versions, the install prefix, the database snapshot, and the atomically written redacted evidence for diagnosis. The drill and its tests terminate the owned Verdaccio child process but do not physically delete temporary storage or evidence.

## Evidence review

Confirm that evidence records the candidate/rollback version sequence, command exit codes and duration, environment fingerprint, transcript hashes, maintenance result, non-target byte identity, fact/duplicate counts, and the two rollback risk gates. Paths, stdout/stderr bodies, npm credentials, and raw environment values must not appear.
