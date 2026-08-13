const assert = require("node:assert/strict");
const test = require("node:test");
const { createAuthMiddleware } = require("./auth");

function response() {
  return {
    statusCode: null, body: null,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}

function dependencies(overrides = {}) {
  return {
    jwtCodec: { verify: () => ({ sub: 7, sessionId: "session-7" }) }, jwtSecret: "test-only",
    sessionRepository: { async findActiveSession() { return { userId: 7 }; }, async touchSession() {} },
    authRepository: { async findProfileById() { return { id: 7, username: "ada", displayName: "Ada", roleId: 1, roleCode: "admin", roleType: "system", roleName: "Administrator", defaultProjectId: 2, permissions: { modules: ["data_map"] }, status: "active" }; } },
    projectSpaceService: { async resolveRequestProject() { return { project: { id: 2, projectName: "Core", status: "active" }, member: { projectId: 2, userId: 7, projectRole: "owner", status: "active" } }; } },
    runWithProjectContext(context, callback) { return callback(context); },
    getRequiredModulesForApiPath() { return ["data_map"]; }, hasAnyModulePermission() { return true; },
    isReadOnlyUser() { return false; }, isReadOnlyAllowedRequest() { return false; }, ...overrides,
  };
}

test("auth middleware keeps the legacy Web project request DTO fields", async () => {
  const req = { headers: { authorization: "Bearer valid", "x-project-id": "2" }, query: {}, originalUrl: "/api/v1/data-map/items", path: "/api/v1/data-map/items", method: "GET" };
  const res = response();
  let nextCalls = 0;
  await createAuthMiddleware(dependencies())(req, res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.deepEqual(req.user, { sub: 7, sessionId: "session-7", id: 7, username: "ada", displayName: "Ada", roleId: 1, roleCode: "admin", roleType: "system", roleName: "Administrator", defaultProjectId: 2, permissions: { modules: ["data_map"] } });
  assert.deepEqual(req.project, { id: 2, projectName: "Core", status: "active" });
  assert.equal(req.projectId, 2);
  assert.deepEqual(req.projectMember, { projectId: 2, userId: 7, projectRole: "owner", status: "active" });
  assert.equal(res.body, null);
});

test("auth middleware preserves the project validation failure Web DTO", async () => {
  const req = { headers: { authorization: "Bearer valid" }, query: {}, originalUrl: "/api/v1/data-map/items", path: "/api/v1/data-map/items", method: "GET" };
  const res = response();
  const error = Object.assign(new Error("当前项目空间不存在或已停用"), { statusCode: 403, details: { projectId: 3 } });
  await createAuthMiddleware(dependencies({ projectSpaceService: { async resolveRequestProject() { throw error; } } }))(req, res, () => assert.fail("next must not run"));
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { success: false, message: "当前项目空间不存在或已停用", details: { projectId: 3 } });
});
