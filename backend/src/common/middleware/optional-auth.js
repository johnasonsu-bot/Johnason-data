const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const sessionRepository = require("../../modules/auth/auth-session.repository");

async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return next();
  }

  try {
    const user = jwt.verify(token, env.jwtSecret);
    const session = await sessionRepository.findActiveSession(user.sessionId);
    if (session && Number(session.userId) === Number(user.sub)) {
      req.user = user;
      await sessionRepository.touchSession(user.sessionId);
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  return next();
}

module.exports = optionalAuthMiddleware;
