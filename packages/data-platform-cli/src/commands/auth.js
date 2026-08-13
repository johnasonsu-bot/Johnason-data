const { assertAuthSecurity, executeWithProfile, revalidateSession } = require("../runtime/cli-execution");
const { readHiddenInput } = require("../runtime/hidden-input");

function publicUser(user) {
  if (!user || typeof user !== "object" || Array.isArray(user)) return user;
  const allowed = ["id", "sub", "username", "displayName", "roleId", "roleCode", "roleType", "roleName", "defaultProjectId", "permissions"];
  return Object.freeze(Object.fromEntries(allowed.filter((key) => Object.hasOwn(user, key)).map((key) => [key, user[key]])));
}

function createAuthCommands(dependencies) {
  const keychain = dependencies.keychain;
  if (!keychain) throw new TypeError("Auth commands require keychain");

  return Object.freeze({
    async login(input = {}) {
      assertAuthSecurity(dependencies);
      const password = input.password === undefined
        ? await (dependencies.readHiddenInput || readHiddenInput)({
          prompt: "Password: ",
          input: dependencies.stdin || process.stdin,
          output: dependencies.stderr || process.stderr,
        })
        : input.password;
      return executeWithProfile(dependencies, async ({ core, profile }) => {
        const result = await core.execute("auth.login", {
          username: input.username,
          password,
        }, { userAgent: "data-platform-cli", ipAddress: null });
        keychain.setSessionToken(profile.name, result.token);
        return Object.freeze({ user: publicUser(result.user) });
      }, { ...input, preferFactory: true });
    },

    async profile(input = {}) {
      assertAuthSecurity(dependencies);
      return executeWithProfile(dependencies, async ({ core, profile, runtimePorts }) => {
        const session = await revalidateSession(dependencies, core, profile, runtimePorts);
        return { user: session.user };
      }, { ...input, preferFactory: true });
    },

    async logout(input = {}) {
      assertAuthSecurity(dependencies);
      return executeWithProfile(dependencies, async ({ core, profile, runtimePorts }) => {
        const token = keychain.getSessionToken(profile.name);
        if (!token) return Object.freeze({ success: true });
        let remoteError;
        try {
          const session = await revalidateSession(dependencies, core, profile, runtimePorts);
          return await core.execute("auth.logout", {
            token,
            userId: session.userId,
          }, {});
        } catch (error) {
          remoteError = error;
          throw error;
        } finally {
          try {
            keychain.deleteSessionToken(profile.name);
          } catch (error) {
            if (!remoteError) throw error;
          }
        }
      }, { ...input, preferFactory: true });
    },
  });
}

module.exports = { createAuthCommands };
