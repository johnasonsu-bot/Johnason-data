const assert = require("node:assert/strict");
const test = require("node:test");

// A regression here catches a capability that bypasses injected ports, leaks a
// password hash, commits a failed transaction, or revokes a session belonging
// to a different token subject.
function createFixture() {
  const users = new Map([
    ["active", {
      id: 7,
      username: "active",
      passwordHash: "hash:correct",
      displayName: "Active User",
      roleId: 3,
      roleCode: "admin",
      roleType: "system",
      roleName: "Administrator",
      defaultProjectId: 12,
      permissions: JSON.stringify({ modules: ["catalog.read"] }),
      status: "active",
    }],
    ["disabled", {
      id: 8,
      username: "disabled",
      passwordHash: "hash:correct",
      displayName: "Disabled User",
      roleCode: "viewer",
      status: "disabled",
    }],
  ]);
  const sessions = new Map();
  const calls = [];
  let now = new Date("2023-11-14T22:13:20.000Z");
  const connection = {
    began: 0,
    committed: 0,
    rolledBack: 0,
    released: 0,
    failCreate: false,
    async beginTransaction() { this.began += 1; },
    async commit() { this.committed += 1; },
    async rollback() { this.rolledBack += 1; },
    release() { this.released += 1; },
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("FROM users") && sql.includes("WHERE u.username = ?")) {
        return [[users.get(params[0])].filter(Boolean)];
      }
      if (sql.includes("FROM users") && sql.includes("u.id")) {
        return [[...users.values()].filter((user) => user.id === params[0])];
      }
      if (sql.includes("INSERT INTO auth_sessions")) {
        if (this.failCreate) throw new Error("write failed");
        sessions.set(params[0], {
          id: params[0],
          userId: params[1],
          username: params[2],
          status: params[3],
          issuedAt: params[4],
          expiresAt: params[5],
          lastSeenAt: params[6],
          touchCount: 0,
        });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("FROM auth_sessions WHERE id = ? AND status = ?")) {
        const session = sessions.get(params[0]);
        return [[session].filter((entry) => entry?.status === params[1])];
      }
      if (sql.includes("SET last_seen_at = NOW()")) {
        const session = sessions.get(params[0]);
        if (session && session.status === params[1]) session.touchCount += 1;
        return [{ affectedRows: session ? 1 : 0 }];
      }
      if (sql.includes("SET status = 'revoked'") && sql.includes("id = ?")) {
        const session = sessions.get(params[0]);
        if (session && session.status === "active") session.status = "revoked";
        return [{ affectedRows: session ? 1 : 0 }];
      }
      if (sql.includes("auth_sessions")) return [[{ total: 0 }]];
      return [[]];
    },
  };
  const pool = {
    query: connection.query.bind(connection),
    async getConnection() { return connection; },
  };
  const jwtCodec = {
    sign(payload) { return `token:${payload.sub}:${payload.sessionId}`; },
    decode(token) {
      const [, sub, sessionId] = token.split(":");
      return { sub: Number(sub), sessionId, iat: 1_700_000_000, exp: 1_700_028_800 };
    },
    verify(token) {
      if (token === "invalid") throw new Error("invalid token");
      return this.decode(token);
    },
  };
  return {
    connection,
    calls,
    sessions,
    setNow(value) { now = new Date(value); },
    dependencies: {
      databaseRuntime: { pool, testConnection: async () => {}, close: async () => {} },
      jwtCodec,
      passwordHasher: { async compare(password, hash) { return hash === `hash:${password}`; } },
      clock: { now: () => now },
      idGenerator: () => "session-1",
    },
  };
}

function loadCandidate() {
  return require("../src");
}

test("auth.login returns the 0.1.0 golden active-user domain DTO without secrets", async () => {
  const fixture = createFixture();
  const { createAuthCapabilities } = loadCandidate();
  const result = await createAuthCapabilities(fixture.dependencies).auth.login({ username: "active", password: "correct" });

  assert.deepEqual(result, {
    token: "token:7:session-1",
    user: {
      id: 7,
      sub: 7,
      username: "active",
      displayName: "Active User",
      roleId: 3,
      roleCode: "admin",
      roleType: "system",
      roleName: "Administrator",
      defaultProjectId: 12,
      permissions: { modules: ["catalog.read"] },
    },
  });
  assert.equal(JSON.stringify(result).includes("passwordHash"), false);
  assert.equal(fixture.connection.committed, 1);
  assert.equal(fixture.connection.released, 1);
});

test("auth.login rejects a wrong password with the legacy unauthorized result", async () => {
  const { createAuthCapabilities } = loadCandidate();
  await assert.rejects(
    createAuthCapabilities(createFixture().dependencies).auth.login({ username: "active", password: "wrong" }),
    (error) => error.message === "用户名或密码错误" && error.statusCode === 401,
  );
});

test("auth.login rejects a disabled user before password verification", async () => {
  const { createAuthCapabilities } = loadCandidate();
  await assert.rejects(
    createAuthCapabilities(createFixture().dependencies).auth.login({ username: "disabled", password: "correct" }),
    (error) => error.message === "用户名或密码错误" && error.statusCode === 401,
  );
});

test("auth.logout revokes the active session and remains idempotent for a revoked session", async () => {
  const fixture = createFixture();
  const { createAuthCapabilities } = loadCandidate();
  const auth = createAuthCapabilities(fixture.dependencies).auth;
  await auth.login({ username: "active", password: "correct" });

  assert.deepEqual(await auth.logout({ sessionId: "session-1", userId: 7 }), { success: true });
  assert.equal(fixture.sessions.get("session-1").status, "revoked");
  assert.deepEqual(await auth.logout({ sessionId: "session-1", userId: 7 }), { success: true });
});

test("auth.logout does not revoke a token session when its subject mismatches the caller", async () => {
  const fixture = createFixture();
  const { createAuthCapabilities } = loadCandidate();
  const auth = createAuthCapabilities(fixture.dependencies).auth;
  await auth.login({ username: "active", password: "correct" });

  await assert.rejects(
    auth.logout({ token: "token:7:session-1", userId: 99 }),
    (error) => error.message === "令牌用户不匹配" && error.statusCode === 401,
  );
  assert.equal(fixture.sessions.get("session-1").status, "active");
});

test("auth.login rolls back and releases the transaction when session persistence fails", async () => {
  const fixture = createFixture();
  fixture.connection.failCreate = true;
  const { createAuthCapabilities } = loadCandidate();

  await assert.rejects(
    createAuthCapabilities(fixture.dependencies).auth.login({ username: "active", password: "correct" }),
    /write failed/,
  );
  assert.equal(fixture.connection.began, 1);
  assert.equal(fixture.connection.committed, 0);
  assert.equal(fixture.connection.rolledBack, 1);
  assert.equal(fixture.connection.released, 1);
});

test("auth.profile returns the response DTO and rejects a disabled profile", async () => {
  const fixture = createFixture();
  const { createAuthCapabilities } = loadCandidate();
  const auth = createAuthCapabilities(fixture.dependencies).auth;

  assert.deepEqual(await auth.profile({ userId: 7 }), {
    user: {
      id: 7,
      sub: 7,
      username: "active",
      displayName: "Active User",
      roleId: 3,
      roleCode: "admin",
      roleType: "system",
      roleName: "Administrator",
      defaultProjectId: 12,
      permissions: { modules: ["catalog.read"] },
    },
  });
  await assert.rejects(auth.profile({ userId: 8 }), (error) => error.message === "用户不存在或已停用" && error.statusCode === 401);
});

test("auth.profile accepts an active token session and touches it", async () => {
  const fixture = createFixture();
  const { createAuthCapabilities } = loadCandidate();
  const auth = createAuthCapabilities(fixture.dependencies).auth;
  const { token } = await auth.login({ username: "active", password: "correct" });

  const result = await auth.profile({ userId: 7, token });

  assert.equal(result.user.id, 7);
  assert.equal(fixture.sessions.get("session-1").touchCount, 1);
});

test("auth.profile uses the default validity policy when an injected session policy only enforces limits", async () => {
  const fixture = createFixture();
  fixture.dependencies.sessionPolicy = { enforceConcurrentLimit: async () => {} };
  const { createAuthCapabilities } = loadCandidate();
  const auth = createAuthCapabilities(fixture.dependencies).auth;
  const { token } = await auth.login({ username: "active", password: "correct" });

  assert.equal((await auth.profile({ userId: 7, token })).user.id, 7);
});

test("auth.profile rejects a token after its session is logged out", async () => {
  const fixture = createFixture();
  const { createAuthCapabilities } = loadCandidate();
  const auth = createAuthCapabilities(fixture.dependencies).auth;
  const { token } = await auth.login({ username: "active", password: "correct" });
  await auth.logout({ sessionId: "session-1", userId: 7 });

  await assert.rejects(
    auth.profile({ userId: 7, token }),
    (error) => error.message === "认证会话无效" && error.statusCode === 401,
  );
});

test("auth.profile rejects revoked, expired, and missing active token sessions", async () => {
  for (const state of ["revoked", "expired", "missing"]) {
    const fixture = createFixture();
    const { createAuthCapabilities } = loadCandidate();
    const auth = createAuthCapabilities(fixture.dependencies).auth;
    const { token } = await auth.login({ username: "active", password: "correct" });
    if (state === "missing") fixture.sessions.delete("session-1");
    if (state === "revoked") fixture.sessions.get("session-1").status = "revoked";
    if (state === "expired") fixture.sessions.get("session-1").expiresAt = new Date("2023-11-14T22:13:19.000Z");

    await assert.rejects(
      auth.profile({ userId: 7, token: state === "missing" ? "token:7:missing" : token }),
      (error) => error.message === "认证会话无效" && error.statusCode === 401,
      state,
    );
  }
});

test("auth.profile rejects a token whose subject does not match the requested user", async () => {
  const fixture = createFixture();
  const { createAuthCapabilities } = loadCandidate();
  const auth = createAuthCapabilities(fixture.dependencies).auth;
  await auth.login({ username: "active", password: "correct" });

  await assert.rejects(
    auth.profile({ userId: 99, token: "token:7:session-1" }),
    (error) => error.message === "令牌用户不匹配" && error.statusCode === 401,
  );
});
