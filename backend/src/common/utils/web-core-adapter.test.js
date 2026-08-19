const test = require("node:test");
const assert = require("node:assert/strict");

const inventory = require("../../../../docs/cli/source/api-inventory.json");
const { apiKeyForRequest, capabilityIdForRequest, mappedApiKeys } = require("./web-core-adapter");

test("Web aggregate core owns every inventory API key", () => {
  const expected = inventory.routes.map((route) => `${route.method} ${route.path}`);
  assert.equal(new Set(expected).size, 596);
  assert.deepEqual(mappedApiKeys, [...new Set(expected)].sort());
});

test("Web route request templates resolve to exact aggregate capabilities", () => {
  const requests = [
    { method: "GET", baseUrl: "/api/v1/projects", route: { path: "/:id" }, expected: "GET /api/v1/projects/:id" },
    { method: "POST", baseUrl: "", route: { path: "/api/auth/login" }, expected: "POST /api/auth/login" },
    { method: "GET", baseUrl: "/api/service", route: { path: "/*" }, expected: "GET /api/service/*" },
  ];
  for (const req of requests) {
    assert.equal(apiKeyForRequest(req), req.expected);
    assert.ok(capabilityIdForRequest(req), req.expected);
  }
});
