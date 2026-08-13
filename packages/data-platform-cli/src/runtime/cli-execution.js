class CliError extends Error {
  constructor(message, { code = "INTERNAL_ERROR", statusCode = 500, exitCode, details } = {}) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = false;
    if (exitCode !== undefined) this.exitCode = exitCode;
    if (details !== undefined) this.details = details;
  }
}

function selectedProfile(dependencies, requestedName) {
  if (dependencies.profile) {
    if (requestedName && dependencies.profile.name !== requestedName) {
      throw new CliError(`Profile not found: ${requestedName}`, { code: "PROFILE_NOT_FOUND", statusCode: 404 });
    }
    return dependencies.profile;
  }
  const store = dependencies.profileStore;
  if (!store) throw new CliError("Profile store unavailable", { code: "PROFILE_NOT_FOUND", statusCode: 404 });
  const profile = requestedName ? store.get(requestedName) : store.current();
  if (!profile) throw new CliError("No active profile", { code: "PROFILE_NOT_FOUND", statusCode: 404 });
  return profile;
}

function databaseRuntimeFor(dependencies, profile, { preferFactory = false } = {}) {
  if (!preferFactory && dependencies.databaseRuntime) {
    return Object.freeze({ runtime: dependencies.databaseRuntime, owned: false });
  }
  if (typeof dependencies.createDatabaseRuntime !== "function") {
    throw new CliError("Database runtime unavailable", { code: "DATABASE_UNAVAILABLE", statusCode: 503, exitCode: 7 });
  }
  try {
    return Object.freeze({ runtime: dependencies.createDatabaseRuntime(profile), owned: true });
  } catch (error) {
    if (error?.code) throw error;
    throw new CliError("Database password unavailable", {
      code: "DATABASE_PASSWORD_UNAVAILABLE",
      statusCode: 503,
      exitCode: 7,
    });
  }
}

function assertAuthSecurity(dependencies) {
  if (dependencies.core?.execute) return;
  if (typeof dependencies.createRuntimePorts === "function") return;
  const auth = dependencies.runtimePorts?.auth || dependencies.auth;
  if (!auth?.jwtCodec || !auth?.passwordHasher || !auth?.clock || typeof auth?.idGenerator !== "function") {
    throw new CliError("Authentication security dependencies must be explicitly injected", {
      code: "SECURITY_DEPENDENCY_MISSING",
      statusCode: 503,
      exitCode: 7,
    });
  }
}

async function revalidateSession(dependencies, core, profile, runtimePorts = dependencies.runtimePorts) {
  const token = dependencies.keychain?.getSessionToken(profile.name);
  if (!token) throw new CliError("Authentication required", { code: "AUTHENTICATION_REQUIRED", statusCode: 401 });
  const verifier = dependencies.sessionIdentity?.verify || runtimePorts?.auth?.jwtCodec?.verify;
  if (typeof verifier !== "function") {
    throw new CliError("Session verification dependency must be explicitly injected", {
      code: "SECURITY_DEPENDENCY_MISSING", statusCode: 503, exitCode: 7,
    });
  }
  let identity;
  try {
    identity = await verifier(token);
  } catch (error) {
    if (error?.code === "SECURITY_DEPENDENCY_MISSING") throw error;
    throw new CliError("Authentication required", { code: "AUTHENTICATION_REQUIRED", statusCode: 401 });
  }
  const userId = Number(identity?.sub ?? identity?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new CliError("Authentication required", { code: "AUTHENTICATION_REQUIRED", statusCode: 401 });
  }
  const result = await core.execute("auth.profile", { userId, token }, {});
  if (!result?.user) throw new CliError("Authentication required", { code: "AUTHENTICATION_REQUIRED", statusCode: 401 });
  return Object.freeze({ token, user: result.user, userId });
}

function runtimePortsFor(dependencies, profile) {
  return typeof dependencies.createRuntimePorts === "function"
    ? dependencies.createRuntimePorts(profile)
    : (dependencies.runtimePorts || {});
}

function coreFor(dependencies, databaseRuntime, runtimePorts) {
  if (dependencies.core?.execute) return dependencies.core;
  const corePackage = dependencies.corePackage;
  if (!corePackage || typeof corePackage.createDataPlatformCore !== "function") {
    throw new CliError("Aggregate core unavailable", { code: "DEPENDENCY_UNAVAILABLE", statusCode: 503, exitCode: 7 });
  }
  return corePackage.createDataPlatformCore({ ...runtimePorts, databaseRuntime });
}

async function executeWithProfile(dependencies, callback, options = {}) {
  const profile = selectedProfile(dependencies, options.profileName);
  const allocation = databaseRuntimeFor(dependencies, profile, options);
  const databaseRuntime = allocation.runtime;
  let primaryError;
  try {
    const runtimePorts = runtimePortsFor(dependencies, profile);
    const core = coreFor(dependencies, databaseRuntime, runtimePorts);
    const run = dependencies.core?.runWithDatabaseRuntime || dependencies.corePackage?.runWithDatabaseRuntime;
    if (typeof run !== "function") return await callback({ core, databaseRuntime, profile, runtimePorts });
    return await run(databaseRuntime, () => callback({ core, databaseRuntime, profile, runtimePorts }));
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (allocation.owned && typeof databaseRuntime?.close === "function") {
      try {
        await databaseRuntime.close();
      } catch (error) {
        if (!primaryError) throw error;
      }
    }
  }
}

module.exports = { CliError, assertAuthSecurity, executeWithProfile, revalidateSession, selectedProfile };
