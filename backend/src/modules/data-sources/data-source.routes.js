const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./data-source.controller");
const { createDataSourceSchema, updateDataSourceSchema } = require("./data-source.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);
router.get("/", asyncHandler(controller.listDataSources));
router.get("/:id/tasks", asyncHandler(controller.listReferencedTasks));
router.get("/:id/tables", asyncHandler(controller.listTables));
router.get("/:id/tables/:tableName/columns", asyncHandler(controller.listColumns));
router.get("/:id/tables/:tableName/sample", asyncHandler(controller.sampleRows));
router.post("/", validateBody(createDataSourceSchema), asyncHandler(controller.createDataSource));
router.put("/:id", validateBody(updateDataSourceSchema), asyncHandler(controller.updateDataSource));
router.delete("/:id", asyncHandler(controller.deleteDataSource));
router.post("/test-connection", asyncHandler(controller.testConnection));

module.exports = router;
