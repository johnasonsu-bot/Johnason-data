const { sendSuccess } = require("../../common/utils/response");
const { getWebDataPlatformCore } = require("../../core/data-platform");

function createAuthController({ getCore = getWebDataPlatformCore } = {}) {
  async function login(req, res) {
    const result = await getCore().execute("auth.login", req.validatedBody, {
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.socket?.remoteAddress || "",
    });
    return sendSuccess(res, result);
  }

  async function profile(req, res) {
    const result = await getCore().execute("auth.profile", { userId: req.user.sub }, { actor: req.user });
    return sendSuccess(res, result);
  }

  async function logout(req, res) {
    const result = await getCore().execute("auth.logout", {
      sessionId: req.user.sessionId,
      userId: req.user.sub,
    }, { actor: req.user });
    return sendSuccess(res, result);
  }

  async function logoutBeacon(req, res) {
    try {
      const result = await getCore().execute("auth.logout", { token: req.body?.token || "" }, {});
      return sendSuccess(res, result);
    } catch {
      return sendSuccess(res, { success: true });
    }
  }

  return Object.freeze({ login, profile, logout, logoutBeacon });
}

module.exports = Object.freeze({ ...createAuthController(), createAuthController });
