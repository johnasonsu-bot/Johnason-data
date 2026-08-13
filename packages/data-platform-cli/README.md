# Data Platform CLI

`data-platform` is a direct-runtime command line for Data Platform. It loads the published aggregate core and connects to the configured database; it does not call or start the platform HTTP server.

## Install

Node.js 22.20 or newer is required.

```bash
npm install --global @johnason/data-platform-cli
data-platform --version
data-platform --help
```

## Configure a profile

Profiles contain only non-secret connection settings: name, database host, port, database name, database user, and optional DataX home and Kafka bootstrap servers. `config add` reads the database password with hidden TTY input and stores it only in the operating-system keychain. If the keychain is unavailable, the command fails closed; there is no plaintext fallback.

```bash
data-platform config add --name dev --db-host localhost --db-port 3306 --db-name data_platform --db-user operator
data-platform config list
data-platform config show --name dev
data-platform config use --name dev
```

Use `--profile <name>` to override the selected profile. `config remove --name <name>` removes the profile and its database-password/session-token keychain entries.

Authentication additionally requires JWT signing material supplied by the trusted runtime (`JWT_SECRET`); keep it in a secret manager or secure process environment, never in the profile or source tree. Login reads the password with hidden input, stores only the resulting session token in the keychain, and never renders the password or token.

```bash
data-platform auth login --username alice
data-platform auth profile
data-platform auth logout
```

## Projects and diagnostics

```bash
data-platform project list
data-platform project resolve --code aviation --require-one
data-platform project use --code aviation
data-platform project current
data-platform --project 12 project access-check --action read
data-platform platform overview
data-platform system doctor
data-platform system doctor health
data-platform system doctor database-capabilities
```

`project use` persists the selected project ID in the active profile. `system doctor` checks the keychain, database connection/schema, DataX, and Kafka; unavailable dependencies exit with status 7.

## Output and exit status

Add `--json` for automation. stdout contains exactly one JSON envelope per command; diagnostics go to stderr. Envelopes are recursively redacted.

| Exit | Meaning |
| ---: | --- |
| 0 | Success |
| 1 | Unclassified/internal failure |
| 2 | Invalid input or command |
| 3 | Authentication required |
| 4 | Permission denied/read-only |
| 5 | Not found |
| 6 | Conflict or ambiguous result |
| 7 | Dependency unavailable |
| 8 | Partial success |

Running with no command opens the local REPL only when both stdin and stdout are TTYs. Its `help`, `context`, `exit`, and `quit` built-ins reuse the same command registry and handlers; input is neither sent to a shell nor persisted. `--json` with no subcommand does not enter the REPL.

## Foundation scope

This foundation release covers `config`, `auth`, `project`, `platform`, and `system doctor`. Business task groups such as durable jobs and data-source operations are added later in the same implementation stage. Use `data-platform --help` as the authoritative installed command inventory.
