const assert = require("node:assert/strict");
const test = require("node:test");
const activation = require("./activation");
const license = require("./license-feature");

test("activation compatibility factory delegates an injected policy before next", () => {
  let checked = 0;
  activation.createActivationMiddleware({ policy: { requireActive() { checked += 1; } } })({}, {}, () => { checked += 10; });
  assert.equal(checked, 11);
});

test("license compatibility factory preserves feature arguments while allowing an injected policy", () => {
  let received = null;
  license.createLicenseFeatureMiddleware({ policy: { requireFeature(value) { received = value; } } })(["data_map", "quality"])({}, {}, () => {});
  assert.deepEqual(received, ["data_map", "quality"]);
});
