const { CliError, selectedProfile } = require("../runtime/cli-execution");
const { readHiddenInput } = require("../runtime/hidden-input");

function createConfigCommands(dependencies) {
  const store = dependencies.profileStore;
  const keychain = dependencies.keychain;
  if (!store || !keychain) throw new TypeError("Config commands require profileStore and keychain");
  return Object.freeze({
    list() { return store.list(); },
    show(input = {}) { return selectedProfile(dependencies, input.profileName); },
    async add(input) {
      const { databasePassword, ...profile } = input;
      const password = databasePassword === undefined
        ? await (dependencies.readHiddenInput || readHiddenInput)({
          prompt: "Database password: ",
          input: dependencies.stdin || process.stdin,
          output: dependencies.stderr || process.stderr,
        })
        : databasePassword;
      if (typeof password !== "string" || password.length === 0) {
        throw new CliError("Database password is required", { code: "INPUT_INVALID", statusCode: 400 });
      }
      if (store.get(profile.name)) {
        throw new CliError(`Profile already exists: ${profile.name}`, { code: "INPUT_INVALID", statusCode: 409 });
      }
      keychain.setDatabasePassword(profile.name, password);
      try {
        return store.add(profile);
      } catch (error) {
        keychain.deleteDatabasePassword(profile.name);
        throw error;
      }
    },
    use(input) { store.use(input.name); return store.get(input.name); },
    remove(input) {
      if (!store.get(input.name)) throw new CliError(`Profile not found: ${input.name}`, { code: "PROFILE_NOT_FOUND", statusCode: 404 });
      keychain.deleteSessionToken(input.name);
      keychain.deleteDatabasePassword(input.name);
      store.remove(input.name);
      return { removed: true, name: input.name };
    },
  });
}

module.exports = { createConfigCommands };
