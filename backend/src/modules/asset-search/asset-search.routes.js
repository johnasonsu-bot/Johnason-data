const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const { validateBody } = require("../../common/middleware/validate");
const asyncHandler = require("../../common/utils/async-handler");
const controller = require("./asset-search.controller");
const { aiConfigSchema, businessDataSearchSchema, feedbackSchema, searchSchema } = require("./asset-search.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);

router.post("/search", validateBody(searchSchema), asyncHandler(controller.search));
router.post("/business-data/search", validateBody(businessDataSearchSchema), asyncHandler(controller.businessDataSearch));
router.get("/suggest", asyncHandler(controller.suggest));
router.get("/facets", asyncHandler(controller.facets));
router.get("/ai-configs", asyncHandler(controller.listAiConfigs));
router.put("/ai-configs/:id", validateBody(aiConfigSchema), asyncHandler(controller.updateAiConfig));
router.get("/ai-runs", asyncHandler(controller.listAiRuns));
router.post("/feedback", validateBody(feedbackSchema), asyncHandler(controller.feedback));

module.exports = router;
