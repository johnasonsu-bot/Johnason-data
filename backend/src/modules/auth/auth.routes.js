const express = require("express");
const asyncHandler = require("../../common/utils/async-handler");
const authMiddleware = require("../../common/middleware/auth");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./auth.controller");
const { loginSchema } = require("./auth.schema");

const router = express.Router();

router.post("/login", validateBody(loginSchema), asyncHandler(controller.login));
router.get("/profile", authMiddleware, asyncHandler(controller.profile));
router.post("/logout", authMiddleware, asyncHandler(controller.logout));
router.post("/logout-beacon", asyncHandler(controller.logoutBeacon));

module.exports = router;
