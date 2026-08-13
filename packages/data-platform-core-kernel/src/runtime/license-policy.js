const { policyError } = require("./authorization-policy");

function createLicensePolicy({ enabledFeatures = [] } = {}) {
  const enabled = new Set(enabledFeatures.filter(Boolean));
  function requireFeature(feature) {
    const requested = Array.isArray(feature) ? feature.filter(Boolean) : [feature].filter(Boolean);
    if (requested.length > 0 && !requested.some((entry) => enabled.has(entry))) {
      throw policyError("当前许可证未启用该功能", "LICENSE_FEATURE_FORBIDDEN", 403, { feature: requested[0] });
    }
    return true;
  }
  return Object.freeze({ requireFeature });
}

module.exports = { createLicensePolicy };
