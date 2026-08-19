const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { envelope, writeJson } = require("../output");

function requiredSecret(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new PlatformError("INPUT_REQUIRED", `${name} is required`);
  }
  return value;
}

function selectedProfile(profileStore, name) {
  const profile = name ? profileStore.get(name) : profileStore.current();
  if (!profile) throw new PlatformError("PROFILE_REQUIRED", name ? `Profile not found: ${name}` : "Select a profile or pass a profile name");
  return profile;
}

function registerConfigCommands(program, options) {
  const { profileStore, keychain, input, output, secretReader } = options;
  const config = program.command("config").description("local profile and keychain configuration");
  const profile = config.command("profile").description("environment profiles");

  profile.command("list").action(() => writeJson(output, envelope(profileStore.list())));
  profile.command("show [name]").action((name) => writeJson(output, envelope(selectedProfile(profileStore, name))));
  profile.command("use <name>").action((name) => {
    profileStore.use(name);
    writeJson(output, envelope({ currentProfile: name }));
  });
  profile.command("remove <name>").requiredOption("--yes", "confirm profile removal").action((name) => {
    profileStore.remove(name);
    keychain.deleteDatabasePassword(name);
    keychain.deleteSessionToken(name);
    keychain.deleteRuntimeSigningSecret(name);
    writeJson(output, envelope({ removed: name }));
  });

  profile.command("add <name>")
    .requiredOption("--host <host>", "MySQL host")
    .requiredOption("--port <port>", "MySQL port", (value) => Number(value))
    .requiredOption("--database <database>", "MySQL database")
    .requiredOption("--user <user>", "MySQL user")
    .option("--timezone <timezone>", "database timezone", "+08:00")
    .option("--datax-home <path>", "DataX installation path")
    .option("--kafka <servers...>", "Kafka bootstrap servers")
    .option("--secrets-stdin", "read a JSON object containing databasePassword and runtimeSigningSecret from stdin")
    .action(async (name, localOptions) => {
      let secrets;
      if (localOptions.secretsStdin) {
        const raw = await secretReader({ input, output: options.errorOutput, prompt: "" });
        try {
          secrets = JSON.parse(raw);
        } catch {
          throw new PlatformError("INPUT_INVALID", "Secret stdin must be a JSON object");
        }
      } else {
        if (!input.isTTY) throw new PlatformError("INPUT_REQUIRED", "Use --secrets-stdin when stdin is not a terminal");
        secrets = {
          databasePassword: await secretReader({ input, output: options.errorOutput, prompt: "Database password: " }),
          runtimeSigningSecret: await secretReader({ input, output: options.errorOutput, prompt: "Runtime signing secret: " }),
        };
      }
      const value = profileStore.add({
        name,
        db: {
          host: localOptions.host,
          port: localOptions.port,
          database: localOptions.database,
          user: localOptions.user,
          timezone: localOptions.timezone,
        },
        ...(localOptions.dataxHome ? { dataxHome: localOptions.dataxHome } : {}),
        ...(localOptions.kafka ? { kafkaBootstrapServers: localOptions.kafka } : {}),
      });
      try {
        keychain.setDatabasePassword(name, requiredSecret(secrets.databasePassword, "databasePassword"));
        keychain.setRuntimeSigningSecret(name, requiredSecret(secrets.runtimeSigningSecret, "runtimeSigningSecret"));
      } catch (error) {
        profileStore.remove(name);
        throw error;
      }
      writeJson(output, envelope(value));
    });

  const secret = config.command("secret").description("profile secrets in the system keychain");
  for (const definition of [
    ["database-password", "setDatabasePassword", "deleteDatabasePassword"],
    ["runtime-signing-secret", "setRuntimeSigningSecret", "deleteRuntimeSigningSecret"],
  ]) {
    const [name, setter, deleter] = definition;
    secret.command(`set-${name} [profile]`).option("--stdin", "read the secret from stdin").action(async (profileName) => {
      const selected = selectedProfile(profileStore, profileName);
      if (!input.isTTY && !secretReader) throw new PlatformError("INPUT_REQUIRED", "Secret stdin is required");
      const value = await secretReader({ input, output: options.errorOutput, prompt: `${name}: ` });
      keychain[setter](selected.name, requiredSecret(value, name));
      writeJson(output, envelope({ profile: selected.name, secret: name, stored: true }));
    });
    secret.command(`delete-${name} [profile]`).requiredOption("--yes", "confirm secret deletion").action((profileName) => {
      const selected = selectedProfile(profileStore, profileName);
      writeJson(output, envelope({ profile: selected.name, secret: name, deleted: keychain[deleter](selected.name) }));
    });
  }
  return config;
}

module.exports = { registerConfigCommands, selectedProfile };
