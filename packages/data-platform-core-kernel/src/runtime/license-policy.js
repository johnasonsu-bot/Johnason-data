const { policyError } = require("./authorization-policy");

function createLicensePolicy(options = {}) {
  const unrestricted = !Object.prototype.hasOwnProperty.call(options, "enabledFeatures");
  const enabled = new Set((options.enabledFeatures || []).filter(Boolean));
  function requireFeature(feature) {
    const requested = Array.isArray(feature) ? feature.filter(Boolean) : [feature].filter(Boolean);
    if (!unrestricted && requested.length > 0 && !requested.some((entry) => enabled.has(entry))) {
      throw policyError("当前许可证未启用该功能", "LICENSE_FEATURE_FORBIDDEN", 403, { feature: requested[0] });
    }
    return true;
  }
  return Object.freeze({ requireFeature });
}

module.exports = { createLicensePolicy };
