const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AppError = require("../../common/errors/app-error");
const { pool } = require("../../config/database");
const env = require("../../config/env");
const authRepository = require("./auth.repository");
const sessionRepository = require("./auth-session.repository");
function toAuthUser(user) {
  return {
    id: user.id,
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    roleId: user.roleId || null,
    roleCode: user.roleCode,
    roleType: user.roleType || null,
    roleName: user.roleName || user.roleCode,
    defaultProjectId: user.defaultProjectId || null,
    permissions: user.permissions || { modules: [] }
  };
}

async function enforceConcurrentLimit(){return;}

async function login(payload, context = {}) {
  const user = await authRepository.findByUsername(payload.username);

  if (!user || user.status !== "active") {
    throw new AppError("用户名或密码错误", 401);
  }

  const isMatched = await bcrypt.compare(payload.password, user.passwordHash);

  if (!isMatched) {
    throw new AppError("用户名或密码错误", 401);
  }

  const authUser = toAuthUser(user);
  const connection = await pool.getConnection();

  const sessionId = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: authUser.id,
      sessionId,
      username: authUser.username,
      displayName: authUser.displayName,
      roleId: authUser.roleId,
      roleCode: authUser.roleCode,
      roleType: authUser.roleType,
      roleName: authUser.roleName,
      permissions: authUser.permissions
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
  const decoded = jwt.decode(token);
  const issuedAt = decoded?.iat ? new Date(decoded.iat * 1000) : new Date();
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 8 * 60 * 60 * 1000);

  try {
    await connection.beginTransaction();
    await enforceConcurrentLimit(authUser.id, connection);
    await sessionRepository.createSession({
      id: sessionId,
      userId: authUser.id,
      username: authUser.username,
      issuedAt,
      expiresAt,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress
    }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    token,
    user: authUser
  };
}

async function getProfile(userId) {
  const user = await authRepository.findProfileById(userId);

  if (!user || user.status !== "active") {
    throw new AppError("用户不存在或已停用", 401);
  }

  return {
    user: toAuthUser(user)
  };
}

async function logout(user) {
  await sessionRepository.revokeSession(user?.sessionId);
  return { success: true };
}

async function logoutByToken(token) {
  if (!token) {
    return { success: true };
  }

  try {
    const user = jwt.verify(token, env.jwtSecret);
    await sessionRepository.revokeSession(user?.sessionId);
  } catch {
    return { success: true };
  }

  return { success: true };
}

module.exports = {
  login,
  getProfile,
  logout,
  logoutByToken
};
