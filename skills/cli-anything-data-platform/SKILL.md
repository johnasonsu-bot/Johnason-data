---
name: cli-anything-data-platform
description: Operate Data Platform through the installed data-platform CLI without calling the platform HTTP server.
---

# Data Platform CLI

Use the installed `data-platform` executable for Data Platform operations. Discover commands with `data-platform --help` and prefer JSON output for automation. Never persist credentials outside the operating-system keychain.

## Operating rules

- Use `--json` for automation and interpret exit codes `0` through `8` according to the CLI README.
- Select a profile before database-backed commands and resolve/select a project before project-scoped commands.
- Pass login passwords through `--password-stdin`; never place a password, token, API key, or authorization header in command arguments, input files, logs, or evidence.
- Use `--file`/`--files` for input and `--output` for downloads. Pass `--yes` only after the requested destructive operation and target have been checked.
- Use `daemon start|run|status|logs|restart|stop` for background work. The daemon is a direct core consumer and must not start or call an HTTP server.
- Treat missing real API/database evidence as `blocked`. Never substitute mocks, skipped cases, empty checkpoint files, or claimed success.

## Repository-local acceptance install

When operating this repository, use `npm run install:cli:local`. The accepted binary is `.local/data-platform-cli/install/node_modules/.bin/data-platform`; do not replace the root dependency tree or install globally during development verification.

Before claiming aggregate acceptance, require all 596 API and 84 frontend mappings, all external API and MySQL/PostgreSQL/Oracle/DM gates, 21 real rollback/re-upgrade drills, zero secret findings/bypasses, and two idempotent installed-CLI aviation runs.
