const ACTIVE_STATUS = "active";
const SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60;

function createAuthSessionRepository({ getDatabaseRuntime }) {
  if (typeof getDatabaseRuntime !== "function") throw new TypeError("Auth session repository requires getDatabaseRuntime");

  function executor(executorOverride) {
    return executorOverride || getDatabaseRuntime().pool;
  }

  async function expireStaleSessions(executorOverride) {
    await executor(executorOverride).query(
      `UPDATE auth_sessions
       SET status = 'expired'
       WHERE status = ?
         AND (expires_at <= NOW() OR last_seen_at < DATE_SUB(NOW(), INTERVAL ? SECOND))`,
      [ACTIVE_STATUS, SESSION_IDLE_TIMEOUT_SECONDS],
    );
  }

  async function countActiveSessions(executorOverride) {
    const db = executor(executorOverride);
    await expireStaleSessions(db);
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM auth_sessions WHERE status = ?", [ACTIVE_STATUS]);
    return Number(rows[0]?.total || 0);
  }

  async function countActiveSessionsForUser(userId, executorOverride) {
    const db = executor(executorOverride);
    await expireStaleSessions(db);
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM auth_sessions WHERE status = ? AND user_id = ?", [ACTIVE_STATUS, userId]);
    return Number(rows[0]?.total || 0);
  }

  async function createSession(session, executorOverride) {
    await executor(executorOverride).query(
      `INSERT INTO auth_sessions
        (id, user_id, username, status, issued_at, expires_at, last_seen_at, user_agent, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.id, session.userId, session.username, ACTIVE_STATUS, session.issuedAt, session.expiresAt, session.issuedAt, session.userAgent || null, session.ipAddress || null],
    );
  }

  async function findActiveSession(sessionId, executorOverride) {
    if (!sessionId) return null;
    const db = executor(executorOverride);
    await expireStaleSessions(db);
    const [rows] = await db.query(
      `SELECT id, user_id AS userId, username, status, issued_at AS issuedAt, expires_at AS expiresAt, last_seen_at AS lastSeenAt
       FROM auth_sessions WHERE id = ? AND status = ? LIMIT 1`,
      [sessionId, ACTIVE_STATUS],
    );
    return rows[0] || null;
  }

  async function touchSession(sessionId, executorOverride) {
    await executor(executorOverride).query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = ? AND status = ?", [sessionId, ACTIVE_STATUS]);
  }

  async function revokeSession(sessionId, executorOverride) {
    if (!sessionId) return;
    await executor(executorOverride).query(
      "UPDATE auth_sessions SET status = 'revoked', revoked_at = NOW() WHERE id = ? AND status = ?",
      [sessionId, ACTIVE_STATUS],
    );
  }

  async function revokeActiveSessionsForUser(userId, executorOverride) {
    if (!userId) return 0;
    const [result] = await executor(executorOverride).query(
      "UPDATE auth_sessions SET status = 'revoked', revoked_at = NOW() WHERE user_id = ? AND status = ?",
      [userId, ACTIVE_STATUS],
    );
    return Number(result?.affectedRows || 0);
  }

  async function listOldestActiveSessions(limit, executorOverride) {
    const normalizedLimit = Number(limit || 0);
    if (!Number.isInteger(normalizedLimit) || normalizedLimit <= 0) return [];
    const db = executor(executorOverride);
    await expireStaleSessions(db);
    const [rows] = await db.query(
      `SELECT id, user_id AS userId, username, issued_at AS issuedAt, last_seen_at AS lastSeenAt
       FROM auth_sessions WHERE status = ? ORDER BY last_seen_at ASC, issued_at ASC, created_at ASC LIMIT ?`,
      [ACTIVE_STATUS, normalizedLimit],
    );
    return rows;
  }

  async function revokeSessionsByIds(sessionIds, executorOverride) {
    const normalizedIds = Array.from(new Set((sessionIds || []).filter(Boolean)));
    if (normalizedIds.length === 0) return 0;
    const placeholders = normalizedIds.map(() => "?").join(", ");
    const [result] = await executor(executorOverride).query(
      `UPDATE auth_sessions SET status = 'revoked', revoked_at = NOW() WHERE status = ? AND id IN (${placeholders})`,
      [ACTIVE_STATUS, ...normalizedIds],
    );
    return Number(result?.affectedRows || 0);
  }

  return Object.freeze({
    countActiveSessions,
    countActiveSessionsForUser,
    createSession,
    findActiveSession,
    touchSession,
    revokeSession,
    revokeActiveSessionsForUser,
    listOldestActiveSessions,
    revokeSessionsByIds,
    expireStaleSessions,
  });
}

module.exports = { ACTIVE_STATUS, SESSION_IDLE_TIMEOUT_SECONDS, createAuthSessionRepository };
