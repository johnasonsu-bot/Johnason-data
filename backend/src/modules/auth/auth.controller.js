const { sendSuccess } = require("../../common/utils/response");
const authService = require("./auth.service");

async function login(req, res) {
  const result = await authService.login(req.validatedBody, {
    userAgent: req.headers["user-agent"] || "",
    ipAddress: req.ip || req.socket?.remoteAddress || ""
  });
  return sendSuccess(res, result);
}

async function profile(req, res) {
  const result = await authService.getProfile(req.user.sub);
  return sendSuccess(res, result);
}

async function logout(req, res) {
  const result = await authService.logout(req.user);
  return sendSuccess(res, result);
}

async function logoutBeacon(req, res) {
  const token = req.body?.token || "";
  const result = await authService.logoutByToken(token);
  return sendSuccess(res, result);
}

module.exports = {
  login,
  profile,
  logout,
  logoutBeacon
};
