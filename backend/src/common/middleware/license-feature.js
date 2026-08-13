function createLicenseFeatureMiddleware({ policy } = {}) {
  return (feature) => (req, res, next) => {
    policy?.requireFeature?.(feature);
    return next();
  };
}

const requireFeature = createLicenseFeatureMiddleware();
module.exports = requireFeature;
module.exports.createLicenseFeatureMiddleware = createLicenseFeatureMiddleware;
