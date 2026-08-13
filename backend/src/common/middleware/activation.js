function createActivationMiddleware({ policy } = {}) {
  return (req, res, next) => {
    policy?.requireActive?.();
    return next();
  };
}

const activationMiddleware = createActivationMiddleware();
module.exports = activationMiddleware;
module.exports.createActivationMiddleware = createActivationMiddleware;
