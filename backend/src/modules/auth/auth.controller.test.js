const assert = require("node:assert/strict");
const test = require("node:test");

const { createAuthController } = require("./auth.controller");

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("auth Web controller preserves HTTP DTOs while invoking only aggregate capabilities", async () => {
  const calls = [];
  const results = {
    "auth.login": { token: "fixture-token", user: { id: 7 } },
    "auth.profile": { user: { id: 7 } },
    "auth.logout": { success: true },
  };
  const controller = createAuthController({
    getCore() {
      return {
        async execute(capabilityId, input, context) {
          calls.push({ capabilityId, input, context });
          return results[capabilityId];
        },
      };
    },
  });

  const loginResponse = response();
  await controller.login({
    validatedBody: { username: "operator", password: "fixture-password" },
    headers: { "user-agent": "agent" },
    ip: "127.0.0.1",
  }, loginResponse);
  const profileResponse = response();
  const user = { sub: 7, sessionId: "session-1" };
  await controller.profile({ user }, profileResponse);
  const logoutResponse = response();
  await controller.logout({ user }, logoutResponse);

  assert.deepEqual(calls, [
    {
      capabilityId: "auth.login",
      input: { username: "operator", password: "fixture-password" },
      context: { userAgent: "agent", ipAddress: "127.0.0.1" },
    },
    { capabilityId: "auth.profile", input: { userId: 7 }, context: { actor: user } },
    { capabilityId: "auth.logout", input: { sessionId: "session-1", userId: 7 }, context: { actor: user } },
  ]);
  assert.deepEqual(loginResponse.body, { success: true, data: results["auth.login"], meta: undefined });
  assert.deepEqual(profileResponse.body, { success: true, data: results["auth.profile"], meta: undefined });
  assert.deepEqual(logoutResponse.body, { success: true, data: results["auth.logout"], meta: undefined });
});

test("logout beacon retains idempotent success when aggregate token validation rejects", async () => {
  const controller = createAuthController({
    getCore() {
      return { async execute() { throw new Error("invalid token"); } };
    },
  });
  const res = response();
  await controller.logoutBeacon({ body: { token: "invalid-fixture-token" } }, res);
  assert.deepEqual(res.body, { success: true, data: { success: true }, meta: undefined });
});
