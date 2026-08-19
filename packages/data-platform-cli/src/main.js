const fs = require("node:fs");
const os = require("node:os");
const { Command, CommanderError } = require("commander");
const { createCoreRuntime } = require("@johnason/data-platform-core");
const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { createDomainCommands } = require("./registry/domain-commands");
const { readInputFile, readUploadFile, assertOutputPath } = require("./commands/file-io");
const { envelope, errorEnvelope, exitCodeFor, writeJson, writeNdjson, writeNdjsonText } = require("./output");
const { resolveCliPaths } = require("./runtime/paths");
const { createProfileStore } = require("./runtime/profile-store");
const { createLazyKeychain } = require("./runtime/keychain");
const { createCliExecution } = require("./runtime/cli-execution");
const { readHiddenInput } = require("./runtime/hidden-input");
const { registerConfigCommands } = require("./commands/config");
const { registerFoundationCommands } = require("./commands/foundation");
const { registerDaemonCommands } = require("./commands/daemon");
const { runRepl } = require("./repl/repl");

function addCommonOptions(command, definition) {
  command
    .option("--api-key <method-and-path>", "select one API when a command is an explicit alias")
    .option("--id <id>", "resource identifier")
    .option("--input <json>", "inline JSON input")
    .option("--file <path>", definition.interactions.includes("multipart") ? "binary upload file" : "JSON or YAML input file")
    .option("--files <paths...>", "binary upload files")
    .option("--project <id>", "project context")
    .option("--idempotency-key <key>", "idempotency key for a write command");
  if (definition.requiresYes) command.option("--yes", "confirm the operation");
  if (definition.requiresOutput) command.requiredOption("--output <path>", "output file");
  if (definition.supportsWait) {
    command.option("--wait", "wait for the durable job");
    command.option("--timeout <milliseconds>", "wait timeout", (value) => Number(value));
  }
  if (definition.command === "auth login") {
    command.requiredOption("--username <username>", "platform username");
    command.option("--password-stdin", "read the platform password from stdin");
  }
}

function positionalParams(definition) {
  const names = [];
  for (const apiKey of definition.sourceApiKeys) {
    const path = apiKey.slice(apiKey.indexOf(" ") + 1);
    for (const match of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
      if (!names.includes(match[1])) names.push(match[1]);
    }
  }
  return names;
}

function commandNode(root, words, cache) {
  let parent = root;
  let key = "";
  for (const word of words) {
    key = `${key} ${word}`.trim();
    let child = cache.get(key);
    if (!child) {
      child = parent.commands.find((candidate) => candidate.name() === word)
        || parent.command(word).description(`${key} capabilities`);
      cache.set(key, child);
    }
    parent = child;
  }
  return parent;
}

function parseInput(options, definition = { interactions: [] }) {
  const multipart = definition.interactions.includes("multipart");
  if (options.file && options.input && !multipart) throw new PlatformError("INPUT_CONFLICT", "Use either --file or --input");
  let input = {};
  if (options.input) input = JSON.parse(options.input);
  if (options.files?.length && !multipart) throw new PlatformError("INPUT_INVALID", "--files is only valid for upload commands");
  if (options.file) {
    if (multipart) input.file = readUploadFile(options.file);
    else input = readInputFile(options.file);
  }
  if (options.files?.length) input.files = options.files.map(readUploadFile);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PlatformError("INPUT_INVALID", "Command input must be a JSON object");
  }
  if (options.id !== undefined) input.id = options.id;
  return input;
}

function selectCapabilities(definition, options) {
  if (!options.apiKey) return definition.capabilityIds.slice(0, 1);
  const index = definition.sourceApiKeys.indexOf(options.apiKey);
  if (index < 0) throw new PlatformError("API_ALIAS_NOT_FOUND", `Command does not own API key: ${options.apiKey}`);
  const matches = definition.capabilityIds.filter((_, capabilityIndex) => {
    return definition.capabilityIds.length === definition.sourceApiKeys.length ? capabilityIndex === index : true;
  });
  return matches.length ? matches : definition.capabilityIds;
}

function createInstalledEnvironment(options) {
  const paths = resolveCliPaths({
    platform: options.platform || process.platform,
    env: options.env || process.env,
    homeDir: options.homeDir || os.homedir(),
  });
  const profileStore = options.profileStore || createProfileStore({ configFile: paths.configFile, fsImpl: options.fsImpl || fs });
  const keychain = options.keychain || createLazyKeychain(options.keychainOptions);
  const coreRuntime = createCoreRuntime(options.dependencies);
  const runtime = createCliExecution({
    runtime: coreRuntime,
    profileStore,
    keychain,
    databaseRuntimeFactory: options.databaseRuntimeFactory,
    jwtImpl: options.jwtImpl,
  });
  return { runtime, profileStore, keychain, paths };
}

function createInstalledRuntime(options = {}) {
  return createInstalledEnvironment(options).runtime;
}

function createProgram(options = {}) {
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const environment = options.runtime
    ? { runtime: options.runtime, profileStore: options.profileStore, keychain: options.keychain, paths: options.paths }
    : createInstalledEnvironment(options);
  const { runtime, profileStore, keychain, paths } = environment;
  const secretReader = options.secretReader || readHiddenInput;
  const definitions = createDomainCommands(runtime.catalog);
  const program = new Command();
  const nodes = new Map();
  program
    .name("data-platform")
    .description("Johnason Data Platform command line interface")
    .version("0.2.0")
    .option("--json", "write a stable JSON envelope")
    .option("--ndjson", "write newline-delimited JSON")
    .option("--profile <name>", "runtime profile")
    .option("--project <id>", "project context")
    .option("--no-color", "disable color output");
  program.configureOutput({
    writeOut: (value) => stdout.write(value),
    writeErr: (value) => { if (!options.jsonMode) stderr.write(value); },
  });
  if (options.exitOverride) program.exitOverride();

  if (profileStore && keychain) {
    registerConfigCommands(program, {
      profileStore,
      keychain,
      input: options.stdin || process.stdin,
      output: stdout,
      errorOutput: stderr,
      secretReader,
    });
  }

  for (const definition of definitions) {
    const words = definition.command.split(/\s+/);
    const actionName = words.pop();
    const parent = commandNode(program, words, nodes);
    const command = parent.command(actionName)
      .description(`${definition.actions.join("/")} ${definition.sourceApiKeys.join(", ")}`);
    const params = positionalParams(definition);
    for (const name of params) command.argument(`[${name}]`);
    addCommonOptions(command, definition);
    command.action(async (...args) => {
      const commandObject = args.at(-1);
      const positionals = args.slice(0, -1);
      const localOptions = commandObject.opts();
      const rootOptions = commandObject.optsWithGlobals();
      if (definition.requiresYes && !localOptions.yes) {
        throw new PlatformError("CONFIRMATION_REQUIRED", "This operation requires --yes");
      }
      const input = parseInput(localOptions, definition);
      params.forEach((name, index) => {
        if (positionals[index] !== undefined && input[name] === undefined) input[name] = positionals[index];
      });
      if (definition.command === "auth login") {
        if (Object.hasOwn(input, "password")) {
          throw new PlatformError("SENSITIVE_INPUT_FORBIDDEN", "Platform password must be read from stdin or a hidden prompt");
        }
        input.username = localOptions.username;
        if (!localOptions.passwordStdin && !(options.stdin || process.stdin).isTTY) {
          throw new PlatformError("INPUT_REQUIRED", "Use --password-stdin when stdin is not a terminal");
        }
        input.password = await secretReader({
          input: options.stdin || process.stdin,
          output: stderr,
          prompt: "Platform password: ",
        });
        if (!input.password) throw new PlatformError("INPUT_REQUIRED", "Platform password is required");
        input.headers = { "user-agent": "data-platform-cli" };
      }
      const context = {
        profile: rootOptions.profile || null,
        projectId: localOptions.project || rootOptions.project || null,
        idempotencyKey: localOptions.idempotencyKey || null,
        wait: Boolean(localOptions.wait),
        timeout: localOptions.timeout || null,
      };
      const capabilityIds = selectCapabilities(definition, localOptions);
      const results = [];
      for (const capabilityId of capabilityIds) {
        results.push(await runtime.executeCapability(capabilityId, input, context));
      }
      const combined = results.length === 1 ? results[0] : results;
      const data = results.length === 1 && combined && typeof combined === "object" && Object.hasOwn(combined, "data")
        ? combined.data
        : combined;
      if (localOptions.output) {
        const target = assertOutputPath(localOptions.output);
        if (data?.path && fs.existsSync(data.path)) fs.copyFileSync(data.path, target);
        else {
          const content = Buffer.isBuffer(data) || typeof data === "string" ? data : JSON.stringify(data, null, 2);
          fs.writeFileSync(target, content);
        }
        writeJson(stdout, envelope({ output: target, bytes: fs.statSync(target).size }));
      } else if (rootOptions.ndjson || definition.streamOutput === "ndjson") {
        if (definition.streamOutput === "ndjson" && (Buffer.isBuffer(data) || typeof data === "string")) {
          await writeNdjsonText(stdout, data);
        } else {
          await writeNdjson(stdout, data);
        }
      } else {
        const resultMeta = results.length === 1 && combined?.meta ? combined.meta : {};
        writeJson(stdout, envelope(data, { ...resultMeta, capabilityIds }));
      }
    });
  }
  registerFoundationCommands(program, { runtime, profileStore, paths, output: stdout });
  if (profileStore && paths) {
    registerDaemonCommands(program, {
      profileStore,
      paths,
      output: stdout,
      errorOutput: stderr,
      daemonTasks: options.daemonTasks,
      daemonRuntimeFactory: options.daemonRuntimeFactory,
      processOps: options.processOps,
      spawnImpl: options.spawnImpl,
      binPath: options.binPath,
    });
  }
  return { program, definitions, runtime, profileStore, keychain, paths };
}

async function main(argv = process.argv.slice(2), options = {}) {
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const jsonMode = argv.includes("--json");
  try {
    const created = createProgram({ ...options, exitOverride: true, jsonMode });
    const { program } = created;
    const commandArguments = [];
    for (let index = 0; index < argv.length; index += 1) {
      if (["--json", "--ndjson", "--no-color"].includes(argv[index])) continue;
      if (["--profile", "--project"].includes(argv[index])) {
        index += 1;
        continue;
      }
      commandArguments.push(argv[index]);
    }
    if (commandArguments.length === 0) {
      const input = options.stdin || process.stdin;
      const output = options.stdout || process.stdout;
      if (!jsonMode && !options.disableRepl && input.isTTY && output.isTTY) {
        await runRepl({
          input,
          output,
          getContext() {
            const profile = created.profileStore?.current();
            return { profile: profile?.name || null, project: profile?.currentProjectId || null };
          },
          executeArgv: (tokens) => main(tokens, { ...options, stdin: input, stdout: output, stderr, disableRepl: true }),
        });
        return 0;
      }
      const error = new PlatformError("COMMAND_REQUIRED", "A command is required");
      error.statusCode = 400;
      throw error;
    }
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && ["commander.helpDisplayed", "commander.version"].includes(error.code)) return 0;
    writeJson(jsonMode ? stdout : stderr, errorEnvelope(error));
    return exitCodeFor(error);
  }
}

module.exports = { main, createProgram, createInstalledEnvironment, createInstalledRuntime, parseInput, selectCapabilities };
