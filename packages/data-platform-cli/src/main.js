const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { Command } = require("commander");
const { createRenderer } = require("./output/renderer");
const { runRepl } = require("./repl/repl");
const { createCommandRegistry } = require("./registry/command-registry");
const { resolveRuntimeTargets } = require("./registry/execution-targets");
const { createFoundationCommands } = require("./registry/foundation-commands");
const { createProfileDatabaseRuntime } = require("./runtime/database");
const { createKeychain } = require("./runtime/keychain");
const { resolveCliPaths } = require("./runtime/paths");
const { createProfileStore } = require("./runtime/profile-store");
const { createProcessManager } = require("./daemon/process-manager");
const { CliError } = require("./runtime/cli-execution");
const packageManifest = require("../package.json");

function loadCorePackage() {
  return require("@johnason/data-platform-core");
}

function createCliRuntimeDependencies({ profile, keychain, mysqlImpl, runtimePorts = {}, corePackage = loadCorePackage() }) {
  if (!keychain || typeof keychain.getSessionToken !== "function") throw new TypeError("Keychain must expose getSessionToken");
  if (!runtimePorts || typeof runtimePorts !== "object" || Array.isArray(runtimePorts)) throw new TypeError("CLI runtime ports must be an object");
  const databaseRuntime = createProfileDatabaseRuntime(profile, keychain, mysqlImpl || require("mysql2/promise"), corePackage);
  const sessionToken = keychain.getSessionToken(profile.name);
  return Object.freeze({
    ...runtimePorts,
    databaseRuntime,
    session: Object.freeze({ token: sessionToken }),
    profile: Object.freeze({
      name: profile.name,
      ...(profile.dataxHome === undefined ? {} : { dataxHome: profile.dataxHome }),
      ...(profile.kafkaBootstrapServers === undefined ? {} : { kafkaBootstrapServers: Object.freeze([...profile.kafkaBootstrapServers]) }),
      ...(profile.currentProjectId === undefined ? {} : { currentProjectId: profile.currentProjectId }),
    }),
  });
}

function createCliDataPlatformCore(options) {
  const corePackage = options?.corePackage || loadCorePackage();
  return corePackage.createDataPlatformCore(createCliRuntimeDependencies({ ...options, corePackage }));
}

function createDoctorPorts({ keychain, fsImpl = fs }) {
  return Object.freeze({
    async keychain(profile) {
      const password = keychain.getDatabasePassword(profile.name);
      if (typeof password !== "string" || password.length === 0) throw new Error("Keychain database password unavailable");
    },
    async schema(_profile, databaseRuntime) {
      if (typeof databaseRuntime?.pool?.query !== "function") throw new Error("Database schema check unavailable");
      await databaseRuntime.pool.query("SELECT 1 FROM information_schema.tables LIMIT 1");
    },
    async datax(profile) {
      if (!profile.dataxHome) throw new Error("DataX home is not configured");
      fsImpl.accessSync(path.join(profile.dataxHome, "bin", "datax.py"), fsImpl.constants?.X_OK ?? fs.constants.X_OK);
    },
    async kafka(profile) {
      const addresses = profile.kafkaBootstrapServers;
      if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((value) => !/^[^\s:,]+:\d{1,5}$/.test(value))) {
        throw new Error("Kafka bootstrap servers are not configured");
      }
    },
  });
}

function createAuthRuntimePort(_profile, _keychain, overrides = {}) {
  function signingSecret() {
    const value = overrides.authSigningSecret ?? (overrides.env || process.env).JWT_SECRET;
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new CliError("JWT_SECRET is required for CLI authentication", {
        code: "SECURITY_DEPENDENCY_MISSING", statusCode: 503, exitCode: 7,
      });
    }
    return value.trim();
  }
  const jwtImpl = overrides.jwtImpl || require("jsonwebtoken");
  return Object.freeze({
    ...(overrides.runtimePorts?.auth || {}),
    jwtCodec: Object.freeze({
      sign(payload) {
        const expiresIn = String(overrides.jwtExpiresIn ?? (overrides.env || process.env).JWT_EXPIRES_IN ?? "8h").trim() || "8h";
        return jwtImpl.sign(payload, signingSecret(), { expiresIn });
      },
      decode(token) { return jwtImpl.decode(token); },
      verify(token) { return jwtImpl.verify(token, signingSecret()); },
    }),
    passwordHasher: overrides.passwordHasher || require("bcryptjs"),
    clock: overrides.clock || Object.freeze({ now: () => new Date() }),
    idGenerator: overrides.idGenerator || crypto.randomUUID,
  });
}

function createProductionDaemonRuntimeFactory(dependencies) {
  return ({ profileName }) => {
    const ports = dependencies.daemonPorts;
    const corePackage = dependencies.corePackage;
    if (!ports || typeof ports !== "object" || Array.isArray(ports)) throw new TypeError("Production daemon ports are unavailable");
    if (typeof ports.transaction !== "function") throw new TypeError("Production daemon ports require a MySQL transaction port");
    if (!ports.producer || ["connect", "send", "disconnect"].some((name) => typeof ports.producer[name] !== "function")) {
      throw new TypeError("Production daemon ports require a Kafka producer port");
    }
    if (!ports.jobHandlers || typeof ports.jobHandlers !== "object" || Array.isArray(ports.jobHandlers)
      || Object.keys(ports.jobHandlers).length === 0 || typeof ports.authorize !== "function") {
      throw new TypeError("Production daemon ports require job handlers and authorization");
    }
    if (typeof ports.createConsumerSchedulers !== "function") {
      throw new TypeError("Production daemon ports require Inbox consumer schedulers");
    }
    for (const name of ["createOutboxPublisher", "createInboxConsumer", "createJobWorker", "createDaemonRuntime"]) {
      if (typeof corePackage?.[name] !== "function") throw new TypeError(`Aggregate core daemon port is unavailable: ${name}`);
    }
    const publisher = corePackage.createOutboxPublisher({
      transaction: ports.transaction,
      producer: ports.producer,
      topic: ports.topic,
      destination: ports.destination,
      workerId: ports.publisherWorkerId,
      maxAttempts: ports.publisherMaxAttempts,
      backoffMs: ports.publisherBackoffMs,
    });
    const inbox = corePackage.createInboxConsumer({ transaction: ports.transaction });
    const worker = corePackage.createJobWorker({
      transaction: ports.transaction,
      handlers: ports.jobHandlers,
      authorize: ports.authorize,
      backoffMs: ports.jobBackoffMs,
    });
    const consumerSchedulers = ports.createConsumerSchedulers({ inbox, profileName });
    if (!Array.isArray(consumerSchedulers)) throw new TypeError("Inbox consumer schedulers must be an array");
    const publisherInput = Object.freeze({ limit: ports.publisherBatchSize || 10, leaseMs: ports.publisherLeaseMs || 30_000 });
    const workerInput = Object.freeze({
      workerId: ports.jobWorkerId,
      limit: ports.jobBatchSize || 10,
      leaseMs: ports.jobLeaseMs || 30_000,
    });
    return corePackage.createDaemonRuntime({
      loops: [
        Object.freeze({ runBatch: () => publisher.publishBatch(publisherInput) }),
        Object.freeze({ runBatch: () => worker.runBatch(workerInput) }),
      ],
      schedulers: [
        Object.freeze({ start: () => ports.producer.connect(), stop: () => ports.producer.disconnect() }),
        ...consumerSchedulers,
      ],
      checkpoint: ports.checkpoint,
      resources: ports.resources || [],
      wait: ports.wait,
    });
  };
}

function createDefaultDependencies(overrides = {}) {
  const paths = overrides.paths || resolveCliPaths({ homeDir: os.homedir() });
  const profileStore = overrides.profileStore || createProfileStore({ configFile: paths.configFile, fsImpl: fs });
  const keychain = overrides.keychain || createKeychain();
  const corePackage = overrides.corePackage || loadCorePackage();
  const processManager = overrides.processManager || createProcessManager({
    dataDir: paths.dataDir,
    binPath: path.resolve(__dirname, "../bin/data-platform.js"),
  });
  const dependencies = {
    ...overrides,
    corePackage,
    keychain,
    profileStore,
    processManager,
    doctorPorts: overrides.doctorPorts || createDoctorPorts({ keychain, fsImpl: overrides.fsImpl || fs }),
    createRuntimePorts: overrides.createRuntimePorts || ((profile) => Object.freeze({
      ...(overrides.runtimePorts || {}),
      auth: createAuthRuntimePort(profile, keychain, overrides),
    })),
    createDatabaseRuntime: overrides.createDatabaseRuntime || ((profile) => createProfileDatabaseRuntime(
      profile,
      keychain,
      overrides.mysqlImpl || require("mysql2/promise"),
      corePackage,
    )),
  };
  dependencies.createDaemonRuntime = overrides.createDaemonRuntime || createProductionDaemonRuntimeFactory(dependencies);
  return dependencies;
}

function commandFor(program, commandName) {
  let parent = program;
  for (const name of commandName.split(/\s+/)) {
    const existing = Array.isArray(parent.commands)
      ? parent.commands.find((candidate) => typeof candidate.name === "function" && candidate.name() === name)
      : null;
    parent = existing || parent.command(name);
  }
  return parent;
}

const commandOptions = Object.freeze({
  "auth.login": [["requiredOption", "--username <username>", "Platform username"]],
  "auth.profile": [["option", "--user-id <id>", "Authenticated user ID"]],
  "auth.logout": [["option", "--user-id <id>", "Authenticated user ID"]],
  "config.show": [["option", "--name <name>", "Profile name"]],
  "config.add": [
    ["requiredOption", "--name <name>", "Profile name"],
    ["requiredOption", "--db-host <host>", "Database host"],
    ["option", "--db-port <port>", "Database port", "3306"],
    ["requiredOption", "--db-name <database>", "Database name"],
    ["requiredOption", "--db-user <user>", "Database user"],
    ["option", "--datax-home <path>", "DataX home"],
    ["option", "--kafka-bootstrap-servers <addresses>", "Comma-separated Kafka bootstrap servers"],
  ],
  "config.use": [["requiredOption", "--name <name>", "Profile name"]],
  "config.remove": [["requiredOption", "--name <name>", "Profile name"]],
  "project.resolve": [
    ["option", "--code <code>", "Project code"],
    ["option", "--name <name>", "Project name"],
    ["option", "--require-one", "Require exactly one result"],
  ],
  "project.use": [
    ["option", "--code <code>", "Project code"],
    ["option", "--name <name>", "Project name"],
  ],
  "project.access-check": [["requiredOption", "--action <action>", "Access action"]],
  "daemon.start": [["option", "--readiness-timeout-ms <milliseconds>", "Daemon readiness timeout", "10000"]],
  "daemon.run": [
    ["option", "--instance-id <id>", "Internal daemon instance ID"],
    ["option", "--readiness-id <id>", "Internal daemon readiness ID"],
  ],
  "daemon.logs": [["option", "--lines <count>", "Number of log lines", "100"]],
  "daemon.restart": [["option", "--timeout-ms <milliseconds>", "Graceful stop timeout", "10000"]],
  "daemon.stop": [["option", "--timeout-ms <milliseconds>", "Graceful stop timeout", "10000"]],
});

function positiveInteger(value, label) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError(`${label} must be a positive integer`);
  return parsed;
}

function inputFor(definition, options) {
  const input = { ...options };
  delete input.color;
  delete input.json;
  if (input.profile !== undefined) {
    input.profileName = input.profile;
    delete input.profile;
  }
  if (input.project !== undefined) {
    input.projectId = positiveInteger(input.project, "project");
    delete input.project;
  }
  if (input.userId !== undefined) input.userId = positiveInteger(input.userId, "user-id");
  if (input.lines !== undefined) input.lines = positiveInteger(input.lines, "lines");
  if (input.timeoutMs !== undefined) input.timeoutMs = positiveInteger(input.timeoutMs, "timeout-ms");
  if (input.readinessTimeoutMs !== undefined) input.readinessTimeoutMs = positiveInteger(input.readinessTimeoutMs, "readiness-timeout-ms");
  if (definition.capabilityId === "config.show" && input.name !== undefined) {
    input.profileName = input.name;
    delete input.name;
  }
  if (definition.capabilityId === "config.add") {
    input.db = {
      host: input.dbHost,
      port: positiveInteger(input.dbPort, "db-port"),
      database: input.dbName,
      user: input.dbUser,
    };
    delete input.dbHost;
    delete input.dbPort;
    delete input.dbName;
    delete input.dbUser;
    if (input.kafkaBootstrapServers !== undefined) {
      input.kafkaBootstrapServers = input.kafkaBootstrapServers.split(",").map((value) => value.trim()).filter(Boolean);
    }
  }
  return input;
}

function configureCommand(command, definition) {
  for (const [method, flags, description, defaultValue] of commandOptions[definition.capabilityId] || []) {
    command[method](flags, description, defaultValue);
  }
}

function bindDefinitions(program, definitions, renderer, state) {
  if (!program || typeof program.command !== "function") return;
  for (const definition of definitions) {
    const command = commandFor(program, definition.command);
    configureCommand(command, definition);
    command.action(async (...args) => {
      state.executed = true;
      const commanderCommand = args.at(-1);
      const options = typeof commanderCommand?.optsWithGlobals === "function" ? commanderCommand.optsWithGlobals() : {};
      try {
        const parsedInput = definition.inputSchema.parse(inputFor(definition, options));
        const result = definition.outputSchema.parse(await definition.handler(parsedInput));
        const executionTargets = resolveRuntimeTargets(definition, parsedInput, result);
        state.exitCode = renderer.success(result, { meta: { executionTargets } });
      } catch (error) {
        state.exitCode = renderer.error(error);
      }
    });
  }
}

function defaultProgram() {
  return new Command()
    .name("data-platform")
    .version(packageManifest.version)
    .exitOverride()
    .description("Direct-runtime CLI for the Data Platform")
    .option("--profile <name>")
    .option("--project <id>")
    .option("--json")
    .option("--no-color");
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const stdin = dependencies.stdin || process.stdin;
  const stdout = dependencies.stdout || process.stdout;
  const stderr = dependencies.stderr || process.stderr;
  const program = dependencies.program || defaultProgram();
  const commandRoots = new Set(["auth", "config", "daemon", "platform", "project", "system"]);
  const interactive = argv.length === 0 && stdin.isTTY && stdout.isTTY;
  const needsDefaultRuntime = !dependencies.createCommands
    && (interactive || argv.some((value) => commandRoots.has(value) || value === "--help" || value === "-h"));
  let runtimeDependencies;
  let candidates;
  try {
    runtimeDependencies = needsDefaultRuntime ? createDefaultDependencies(dependencies) : dependencies;
    candidates = dependencies.createCommands
      ? dependencies.createCommands(runtimeDependencies)
      : (needsDefaultRuntime ? createFoundationCommands(runtimeDependencies) : []);
  } catch (error) {
    const renderer = dependencies.renderer || createRenderer({ json: argv.includes("--json"), stdout, stderr });
    return renderer.error(error);
  }
  const registry = dependencies.registry || createCommandRegistry();
  for (const candidate of candidates) registry.register(candidate);
  const definitions = registry.values();
  const json = argv.includes("--json");
  const renderer = dependencies.renderer || createRenderer({ json, stdout, stderr });
  const state = { exitCode: 0, executed: false };
  bindDefinitions(program, definitions, renderer, state);

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (["commander.helpDisplayed", "commander.version"].includes(error?.code)) return 0;
    if (typeof error?.code === "string" && error.code.startsWith("commander.")) {
      return renderer.error(new CliError(error.message, { code: "INPUT_INVALID", statusCode: 400 }));
    }
    return renderer.error(error);
  }

  if (!state.executed) {
    if (interactive) {
      const replDependencies = { ...runtimeDependencies, stdin, stdout, stderr };
      delete replDependencies.program;
      delete replDependencies.renderer;
      delete replDependencies.runRepl;
      const executeArgv = dependencies.executeArgv || ((tokens) => main(tokens, replDependencies));
      const getContext = dependencies.getContext || (() => {
        const profile = runtimeDependencies.profile || runtimeDependencies.profileStore?.current?.();
        return { profile: profile?.name || null, projectId: profile?.currentProjectId ?? null };
      });
      await (dependencies.runRepl || runRepl)({ registry, executeArgv, input: stdin, output: stdout, getContext });
      return 0;
    }
    if (typeof program.configureOutput === "function") {
      program.configureOutput({ writeOut: (text) => stdout.write(text), writeErr: (text) => stderr.write(text) });
    }
    if (typeof program.outputHelp === "function") program.outputHelp({ error: false });
    return 2;
  }
  return state.exitCode;
}

module.exports = {
  createAuthRuntimePort,
  createCliDataPlatformCore,
  createCliRuntimeDependencies,
  createDefaultDependencies,
  createDoctorPorts,
  createProductionDaemonRuntimeFactory,
  main,
};
