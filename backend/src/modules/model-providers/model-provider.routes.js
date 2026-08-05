const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./model-provider.controller");
const { createModelProviderSchema, updateModelProviderSchema, testModelProviderSchema } = require("./model-provider.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);
router.get("/", asyncHandler(controller.listModelProviders));
router.post("/test-connection", validateBody(testModelProviderSchema), asyncHandler(controller.testModelProvider));
router.post("/", validateBody(createModelProviderSchema), asyncHandler(controller.createModelProvider));
router.put("/:id", validateBody(updateModelProviderSchema), asyncHandler(controller.updateModelProvider));
router.delete("/:id", asyncHandler(controller.deleteModelProvider));

module.exports = router;
