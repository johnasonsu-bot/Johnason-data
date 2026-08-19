const { executeWebCapability } = require("./web-core-adapter");

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(executeWebCapability(req, res))
      .then((handled) => handled || handler(req, res, next))
      .catch(next);
  };
}

module.exports = asyncHandler;
