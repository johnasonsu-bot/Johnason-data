const assert = require("node:assert/strict");
const test = require("node:test");

test("authorization, license, and activation policies expose redacted stable errors", () => {
  const { createLicensePolicy, createActivationPolicy } = require("../src");
  assert.throws(() => createLicensePolicy({ enabledFeatures: ["data_map"] }).requireFeature("quality"), (error) => error.code === "LICENSE_FEATURE_FORBIDDEN" && error.statusCode === 403 && error.retryable === false && Object.keys(error.details).join(",") === "feature");
  assert.throws(() => createActivationPolicy({ active: false }).requireActive(), (error) => error.code === "ACTIVATION_REQUIRED" && error.statusCode === 403 && error.retryable === false && Object.keys(error.details).length === 0);
});

test("license defaults to unrestricted but an explicit empty feature list denies unavailable features", () => {
  const { createLicensePolicy, createActivationPolicy } = require("../src");
  assert.equal(createLicensePolicy().requireFeature("quality"), true);
  assert.equal(createLicensePolicy({ enabledFeatures: ["quality"] }).requireFeature("quality"), true);
  assert.throws(() => createLicensePolicy({ enabledFeatures: ["quality"] }).requireFeature("data_map"), (error) => error.code === "LICENSE_FEATURE_FORBIDDEN");
  assert.throws(() => createLicensePolicy({ enabledFeatures: [] }).requireFeature("quality"), (error) => error.code === "LICENSE_FEATURE_FORBIDDEN");
  assert.equal(createActivationPolicy().requireActive(), true);
});
