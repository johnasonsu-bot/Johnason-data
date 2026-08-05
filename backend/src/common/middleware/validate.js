const { z } = require("zod");
const AppError = require("../errors/app-error");

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new AppError("请求参数校验失败", 400, result.error.flatten()));
    }

    req.validatedBody = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  z
};
