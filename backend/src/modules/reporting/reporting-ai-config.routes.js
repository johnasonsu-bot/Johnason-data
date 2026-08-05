const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./reporting-ai-config.controller");
const { updateReportingAiConfigSchema } = require("./reporting-ai-config.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);
router.get("/", asyncHandler(controller.listConfigs));
router.put("/:id", validateBody(updateReportingAiConfigSchema), asyncHandler(controller.updateConfig));

module.exports = router;
