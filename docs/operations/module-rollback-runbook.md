# Module Rollback And Re-Upgrade Runbook

This procedure is valid only in a non-production test environment against a loopback test registry. It never runs a database downgrade migration.

1. Confirm the candidate and rollback package versions are exact and both exist in the private test registry.
2. Put only the target module into maintenance and reject new writes.
3. Drain transactions and workers, then snapshot the aggregate manifest, lockfile, package versions, unfinished work, and business facts.
4. Install the candidate, verify its exported version, and create one fact using a fixed idempotency key.
5. Install the rollback version, verify the upgraded schema and candidate fact remain readable, and verify every other package version is unchanged.
6. Reinstall the candidate and repeat the same idempotency key. The original fact must be returned without a duplicate write.
7. Leave maintenance only after all checks pass. A failed drill keeps maintenance enabled and records failed evidence.

Use `runRollbackDrill()` from `scripts/run-module-rollback-drill.js` with environment-specific lifecycle hooks. Evidence must be written below the test evidence directory and must not contain credentials, tokens, authorization headers, or registry authentication data.
