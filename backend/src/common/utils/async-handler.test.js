const test = require("node:test");
const assert = require("node:assert/strict");

const asyncHandler = require("./async-handler");

test("async handler delegates an owned route to aggregate core instead of the legacy controller", async () => {
  let legacyCalls = 0;
  let nextError = null;
  let resolveResponse;
  const completed = new Promise((resolve) => { resolveResponse = resolve; });
  const wrapped = asyncHandler(async () => { legacyCalls += 1; });
  const req = { method: "GET", baseUrl: "", route: { path: "/api/health" } };
  const res = {
    headers: {},
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.value = value; resolveResponse(value); return value; },
  };
  wrapped(req, res, (error) => { nextError = error || null; resolveResponse(); });
  await completed;
  assert.equal(nextError, null);
  assert.equal(legacyCalls, 0);
  assert.deepEqual(res.value, { status: "ok", service: "medata-platform" });
});
