---
name: cli-anything-data-platform
description: Use when an agent needs to operate or automate an installed Data Platform CLI, configure profiles, authenticate, select projects, check access, or diagnose local runtime dependencies.
---

# Data Platform CLI

Operate Data Platform through the installed `data-platform` executable. It connects through the aggregate core and database runtime; never replace it with platform HTTP calls.

## Safety boundary

- Require Node.js 22.20+ and install with `npm install --global @johnason/data-platform-cli`.
- Profiles may contain host, port, database, user, DataX home, and Kafka addresses only.
- Let hidden prompts collect database/login passwords. The OS keychain stores database passwords and session tokens; there is no plaintext fallback.
- Supply JWT signing material through the trusted runtime or secure `JWT_SECRET` environment. Never write secrets into profiles, scripts, logs, or command arguments.

## Quick reference

| Goal | Command |
| --- | --- |
| Discover | `data-platform --help` |
| Add/select profile | `data-platform config add --name NAME --db-host HOST --db-port PORT --db-name DB --db-user USER`; `config use --name NAME` |
| Authenticate | `data-platform auth login --username USER`; `auth profile`; `auth logout` |
| Find/select project | `data-platform project list`; `project resolve --code CODE --require-one`; `project use --code CODE` |
| Check access | `data-platform --project ID project access-check --action ACTION` |
| Inspect platform | `data-platform platform overview` |
| Diagnose | `data-platform system doctor`; `system doctor database-capabilities` |

Use `--profile NAME` to override the selected profile. Prefer `--json` for automation: stdout is exactly one redacted success envelope `{success,data,meta,auditId}` or error envelope `{success,error,auditId}`; diagnostics stay on stderr. Interpret exits as: 0 success, 1 internal, 2 input, 3 authentication, 4 permission, 5 not found, 6 conflict/ambiguous, 7 dependency, 8 partial success.

With no arguments, an interactive TTY enters the shared-command REPL. Use `help`, `context`, `exit`, or `quit`. `--json` without a subcommand never opens it.

Foundation scope is `config`, `auth`, `project`, `platform`, and `system doctor`; inspect `--help` before assuming later business command groups exist.

## Common mistakes

- Do not put passwords or tokens in flags, config files, transcripts, or REPL input.
- Do not continue after keychain/signing/database checks fail; exit 7 is fail-closed.
- Do not parse human output in automation; request `--json` and check both envelope and exit status.
- Do not bypass the CLI with HTTP, import package `src` paths, or start Express.
