const express = require("express");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const service = require("./data-service.service");

const router = express.Router();

router.use(activationMiddleware);

async function handleInvoke(req, res) {
  const servicePath = `/${req.params[0] || ""}`;
  const runtimeInput = req.method === "GET" ? req.query : (req.body || {});
  const result = await service.invokeService(req.method, servicePath, runtimeInput, {
    headers: req.headers,
    ip: req.ip,
    req,
  });

  return res.json({
    success: true,
    data: result.data,
    meta: result.meta,
    service: result.service,
    app: result.app,
  });
}

router.get("/*", asyncHandler(handleInvoke));
router.post("/*", asyncHandler(handleInvoke));

module.exports = router;
