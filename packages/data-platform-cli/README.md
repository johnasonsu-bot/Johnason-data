# Data Platform CLI

Agent-ready command-line access to Data Platform application capabilities without calling the platform HTTP server.

Requires Node.js 22.20 or newer.

## Local isolated install

From the repository root, build all 24 workspace tarballs and install the CLI without changing the repository `node_modules` or a global prefix:

```bash
npm run install:cli:local
./.local/data-platform-cli/install/node_modules/.bin/data-platform --json system doctor health
```

Tarballs, npm cache, the independent dependency tree, and machine-readable install evidence remain below `.local/data-platform-cli/` and are git-ignored.

## Profiles and secrets

```bash
data-platform --json config profile add dev \
  --host 127.0.0.1 --port 3306 --database platform --user cli --secrets-stdin
data-platform --json config profile use dev
data-platform --json auth login --username alice --password-stdin
data-platform --json project list-my-projects
data-platform --json project resolve --code AVIATION --require-one
data-platform --json project use 9
data-platform --json project access-check --project 9 --action read
```

Database passwords, runtime signing secrets, and session tokens are stored only in the operating-system keychain. Profile JSON contains non-secret connection metadata and the current project only. Keychain failures are fatal; there is no plaintext fallback.

## Command behavior

- Run `data-platform --help` to inspect the generated hierarchy for all 596 catalog capabilities.
- Run `data-platform` in a TTY to enter the default REPL. `context`, `help`, `exit`, and `quit` are built in; other lines use the same parser and handlers as one-shot commands.
- Use `--json` for one stable JSON document or `--ndjson` for stream output. Output and errors are recursively redacted.
- Download commands require `--output`; upload commands accept `--file` or `--files` according to their multipart contract.
- Destructive commands require `--yes`. Async-capable commands accept `--wait` and `--timeout`.
- `daemon start|run|status|logs|restart|stop` manages profile-scoped worker loops and never opens an HTTP listener.

Exit codes are `0` success, `1` internal failure, `2` invalid input, `3` unauthenticated, `4` forbidden, `5` not found, `6` conflict, `7` unavailable dependency, and `8` partial success.

## Acceptance

The local install proof validates 24 tarballs, 596 capabilities, 21 modules, arbitrary-cwd execution, and zero repository absolute-path leaks. It does not replace real infrastructure gates. External API, MySQL, PostgreSQL, Oracle, and DM evidence must declare real non-mock infrastructure, complete classified capability IDs, zero bypasses, zero secret findings, and a redacted environment fingerprint.

Aviation acceptance requires a validated ontology contract plus seven ordered real stage checkpoints. Missing or mock evidence is rejected. Aggregate acceptance remains `blocked` until all 21 module rollback/re-upgrade drills and every real infrastructure gate have passed.
