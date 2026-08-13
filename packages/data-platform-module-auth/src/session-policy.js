function createSessionPolicy({ enforceConcurrentLimit } = {}) {
  return Object.freeze({
    enforceConcurrentLimit: typeof enforceConcurrentLimit === "function" ? enforceConcurrentLimit : async () => {},
    isActiveSession(session, now) {
      if (!session || session.status !== "active") return false;
      const expiresAt = new Date(session.expiresAt);
      return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
    },
  });
}

module.exports = { createSessionPolicy };
