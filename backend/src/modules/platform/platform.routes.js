const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const controller = require("./platform.controller");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);
router.get("/overview", asyncHandler(controller.overview));

module.exports = router;
