# SDD ledger — plan: docs/superpowers/plans/2026-08-12-cli-single-stage.md

Baseline: codex/data-platform-cli at 4f7e146e4474743feb06ca66a20eb853320bf0ee
Workspace: /Users/sushi/Documents/ChatGPT/Johnason-data/.worktrees/data-platform-cli
CLI baseline: 17/17 tests passed; npm pack dry-run passed.
Backend baseline: 32 passed, 4 optional live-database tests skipped.
Plan order: shared-core Tasks 1–6; foundation Tasks 6–9; master Tasks 10–12; shared-core Tasks 7–9 (master Task 13); master Tasks 14–16; master Tasks 17–18 and shared-core Task 10.
Known final-environment constraint: the approved plans require real MySQL, PostgreSQL, Oracle, DM, Kafka/DataX and external API dependencies for full acceptance. Missing infrastructure will be reported as blocked/limited, never simulated as end-to-end success.

Foundation Task 1: complete before session (commit 1119951)
Foundation Task 2: complete before session (commit 610426e)
Foundation Task 3: complete before session (commit 3c98355)
Shared-core Task 1: fix round 1/5 (4 addressed, 2 open; commits 2ba319d..e5350ea)
Shared-core Task 1: fix round 2/5 (3 addressed, 0 open; commits e5350ea..c18a60c)
Shared-core Task 1: complete (commits 2ba319d, e5350ea, c18a60c; reviewer approved)
Shared-core Task 1: deferred risk: existing backend production dependency audit reports 8 high and 4 moderate findings at root; classified as pre-existing and outside Task 1, must be revisited by final review.
Shared-core Task 2: fix round 1/5 (core role/import/install findings addressed; commits 7a8b615..f6de78c)
Shared-core Task 2: fix round 2/5 (string bin and fs URL/symlink escape addressed; commits f6de78c..1dd35df)
Shared-core Task 2: complete (commits 7a8b615, f6de78c, 1dd35df; reviewer approved; install suite 18/18)
Shared-core Task 3: fix round 1/5 (shared runtime close timing addressed; commits 4670386..3fc1027)
Shared-core Task 3: complete (commits 4670386, 3fc1027; reviewer approved; focused 12/12)
Shared-core Task 3: architecture decision: consumer aggregate binding deferred to Task 6; backend/CLI use injected runtime ports until then.
Shared-core Task 3: deferred minor: explicitly calling runtime.close() from inside an active scope can self-wait; no current caller, revisit in final review.
Shared-core Task 4: fix round 1/5 (active-session validation and redacted legacy evidence addressed; commits a94bae9..8414786)
Shared-core Task 4: complete (commits a94bae9, 8414786; reviewer approved; auth 14/14)
Shared-core Task 4: local registry storage and tarball retained outside Git; actual rollback drill remains Task 8.
Shared-core Task 5: fix round 1/5 (lock, explicit project ID, license default, owner, real legacy evidence; db6637a..f12b6d9)
Shared-core Task 5: fix round 2/5 (API mapping/evidence/side effects; f12b6d9..c4f2a48)
Shared-core Task 5: fix round 3/5 (system_projects authorization and operation contracts; c4f2a48..b9e7037)
Shared-core Task 5: fix round 4/5 (input/result/error/DTO contracts; b9e7037..b0bc6f1)
Shared-core Task 5: fix round 5/5 (strict DTO, artifact integrity, error detail safety; b0bc6f1..e315791)
Shared-core Task 5: BLOCKED by five-round breaker — load-bearing findings remain: (1) nested create input accepts unknown resourceConfig/settings fields, port writes, then result validation returns 502; input/output must share one strict schema and reject before I/O. (2) real export/download artifacts containing database Date values are rejected; canonical JSON-safe Date-to-ISO conversion must precede backend-compatible integrity verification. Minor: report overstates retained seed validation.
Shared-core Task 5: user authorized breaker override for one targeted round.
Shared-core Task 5: fix round 6/6 (nested pre-I/O validation and Date artifact canonicalization addressed; e315791..f37c046)
Shared-core Task 5: complete (commits 7fcd6e8, db6637a, f12b6d9, c4f2a48, b9e7037, b0bc6f1, e315791, f37c046; reviewer approved; project/kernel 57/57)
Shared-core Task 6: complete candidate (aggregate core, strict capability catalog/runtime validation, Web/CLI aggregate-only binding, Multer-neutral adapter, consumer boundary graph, and real registry install; reviewer approved)
Shared-core Task 6: standalone locks retained with secret-free explicit `JOHNASON_NPM_REGISTRY` scope configuration; clean standalone backend and CLI `npm ci --workspaces=false` both pass against the disposable published package set.
Shared-core Task 6: Foundation Task 7 owns real CLI command/profile/session binding; Task 6 exposes and verifies the complete runtime-port injection seam without fabricating JWT/keychain secrets.
Shared-core Task 6: verification — core 150 total (146 passed, 4 optional DB skips), shared install 21/21, boundary scan clean.
Shared-core Task 6: deferred risk — existing backend production dependency audit reports 8 high and 4 moderate findings; no new aggregate dependency finding.
Foundation Task 6: RED — registry/output test failed with missing output modules before implementation; review regressions separately failed for undefined failure exit status and nested execution-target immutability.
Foundation Task 6: fix round 1/5 (undefined/unclassified failures now exit 1; execution-target metadata recursively frozen; focused 12/12).
Foundation Task 6: complete candidate (stable envelopes, recursive redaction, JSON stdout discipline, deterministic exit codes, strict command registry; reviewer Ready with 0 Critical and 0 Important).
Foundation Task 6: deferred minor — recursive execution-target freezing also freezes caller-shared nested metadata because the intentionally broad Task 6 schema uses z.unknown(); Task 10 strict execution-target schema should remove shared references.
Foundation Task 7: RED — `auth-project.test.js` failed with `MODULE_NOT_FOUND` for `src/runtime/hidden-input`; later focused REDs covered injected hidden login/database passwords and real Commander option/context binding.
Foundation Task 7: complete candidate (aggregate-only config/auth/project/platform/doctor handlers, keychain-only secrets, explicit auth security-port gate, TTY echo restoration, unified registry/Commander binding, and non-TTY exit 2; awaiting independent review).
Foundation Task 7: review round 1/5 fixes — default auth now uses exact bcrypt/jsonwebtoken with explicit `JWT_SECRET` and no fallback; every auth/project session is verified and database-revalidated; aggregate access-check enforces action plus membership role; doctor has real default ports; config add compensates failed profile persistence; owned database runtimes close on both paths.
Foundation Task 7: review round 2/5 fix — logout clears expired, revoked, and missing active-session tokens in `finally` while preserving the remote fail-closed error; focused auth/project tests 18/18.
Foundation Task 7: verification — CLI 55/55; complete workspace `test:core` passed; backend 40 passed and 4 optional live-database tests skipped; boundary and syntax checks clean; CLI pack dry-run passed.
Foundation Task 7: scope note — the default REPL remains an injected hook; shared REPL implementation belongs to Foundation Task 8. The pre-existing untracked `artifacts/` directory remains untouched.
