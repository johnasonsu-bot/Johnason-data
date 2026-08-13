const assert = require("node:assert/strict");
const test = require("node:test");

test("authorization, license, and activation policies expose redacted stable errors", () => {
  const { createLicensePolicy, createActivationPolicy } = require("../src");
  assert.throws(() => createLicensePolicy({ enabledFeatures: ["data_map"] }).requireFeature("quality"), (error) => error.code === "LICENSE_FEATURE_FORBIDDEN" && error.statusCode === 403 && error.retryable === false && Object.keys(error.details).join(",") === "feature");
  assert.throws(() => createActivationPolicy({ active: false }).requireActive(), (error) => error.code === "ACTIVATION_REQUIRED" && error.statusCode === 403 && error.retryable === false && Object.keys(error.details).length === 0);
});
