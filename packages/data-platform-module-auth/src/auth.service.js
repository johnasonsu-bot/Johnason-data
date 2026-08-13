const { createSessionPolicy } = require("./session-policy");

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
    permissions: user.permissions || { modules: [] },
  };
}

function authError(message, statusCode, errorFactory) {
  if (typeof errorFactory === "function") return errorFactory(message, statusCode);
  const error = new Error(message);
  error.name = "AuthError";
  error.statusCode = statusCode;
  return error;
}

function createAuthService({ databaseRuntime, authRepository, sessionRepository, jwtCodec, passwordHasher, clock, idGenerator, errorFactory, sessionPolicy }) {
  if (!databaseRuntime?.pool || typeof databaseRuntime.pool.getConnection !== "function") throw new TypeError("Auth service requires databaseRuntime.pool");
  if (!authRepository || !sessionRepository) throw new TypeError("Auth service requires repositories");
  if (!jwtCodec || typeof jwtCodec.sign !== "function" || typeof jwtCodec.decode !== "function" || typeof jwtCodec.verify !== "function") throw new TypeError("Auth service requires jwtCodec");
  if (!passwordHasher || typeof passwordHasher.compare !== "function") throw new TypeError("Auth service requires passwordHasher");
  if (!clock || typeof clock.now !== "function") throw new TypeError("Auth service requires clock");
  if (typeof idGenerator !== "function") throw new TypeError("Auth service requires idGenerator");
  const policy = sessionPolicy || createSessionPolicy();

  async function login(payload, context = {}) {
    const user = await authRepository.findByUsername(payload?.username);
    if (!user || user.status !== "active") throw authError("用户名或密码错误", 401, errorFactory);
    if (!await passwordHasher.compare(payload?.password, user.passwordHash)) throw authError("用户名或密码错误", 401, errorFactory);

    const authUser = toAuthUser(user);
    const sessionId = idGenerator();
    const token = jwtCodec.sign({
      sub: authUser.id,
      sessionId,
      username: authUser.username,
      displayName: authUser.displayName,
      roleId: authUser.roleId,
      roleCode: authUser.roleCode,
      roleType: authUser.roleType,
      roleName: authUser.roleName,
      permissions: authUser.permissions,
    });
    const decoded = jwtCodec.decode(token);
    const now = clock.now();
    const issuedAt = decoded?.iat ? new Date(decoded.iat * 1000) : now;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const connection = await databaseRuntime.pool.getConnection();
    try {
      await connection.beginTransaction();
      await policy.enforceConcurrentLimit(authUser.id, connection);
      await sessionRepository.createSession({
        id: sessionId,
        userId: authUser.id,
        username: authUser.username,
        issuedAt,
        expiresAt,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      }, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return { token, user: authUser };
  }

  async function profile(input) {
    const userId = typeof input === "object" ? input.userId : input;
    if (typeof input === "object" && input.token) {
      const tokenUser = jwtCodec.verify(input.token);
      if (Number(tokenUser?.sub) !== Number(userId)) throw authError("令牌用户不匹配", 401, errorFactory);
    }
    const user = await authRepository.findProfileById(userId);
    if (!user || user.status !== "active") throw authError("用户不存在或已停用", 401, errorFactory);
    return { user: toAuthUser(user) };
  }

  async function logout(input = {}) {
    const caller = typeof input === "object" ? input : { sessionId: input };
    let sessionId = caller.sessionId;
    if (caller.token) {
      const tokenUser = jwtCodec.verify(caller.token);
      const callerUserId = caller.userId ?? caller.user?.sub;
      if (callerUserId != null && Number(tokenUser?.sub) !== Number(callerUserId)) throw authError("令牌用户不匹配", 401, errorFactory);
      sessionId = tokenUser?.sessionId;
    }
    await sessionRepository.revokeSession(sessionId);
    return { success: true };
  }

  async function logoutByToken(token) {
    if (!token) return { success: true };
    try {
      const user = jwtCodec.verify(token);
      await sessionRepository.revokeSession(user?.sessionId);
    } catch {
      return { success: true };
    }
    return { success: true };
  }

  return Object.freeze({ login, profile, getProfile: profile, logout, logoutByToken });
}

module.exports = { authError, createAuthService, toAuthUser };
