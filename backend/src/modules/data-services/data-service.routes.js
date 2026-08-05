const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./data-service.controller");
const {
  authorizationSchema,
  serviceAiConfigSchema,
  serviceAppSchema,
  serviceConfigSchema,
  serviceDataSourceSchema,
  serviceStatusSchema,
  serviceRecommendSchema,
  serviceSqlPreviewSchema,
} = require("./data-service.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);

router.get("/overview", asyncHandler(controller.getOverview));
router.get("/ops-dashboard", asyncHandler(controller.getOpsDashboard));

router.get("/data-sources", asyncHandler(controller.listServiceDataSources));
router.post("/data-sources", validateBody(serviceDataSourceSchema), asyncHandler(controller.createServiceDataSource));
router.put("/data-sources/:id", validateBody(serviceDataSourceSchema), asyncHandler(controller.updateServiceDataSource));
router.delete("/data-sources/:id", asyncHandler(controller.deleteServiceDataSource));
router.post("/data-sources/test-connection", validateBody(serviceDataSourceSchema), asyncHandler(controller.testServiceDataSourceConnection));
router.get("/data-sources/:id/tables", asyncHandler(controller.listServiceDataSourceTables));
router.get("/data-sources/:id/tables/:tableName/columns", asyncHandler(controller.listServiceDataSourceColumns));
router.get("/data-sources/:id/tables/:tableName/sample", asyncHandler(controller.sampleServiceDataSourceRows));
router.post("/data-sources/sql-preview", validateBody(serviceSqlPreviewSchema), asyncHandler(controller.previewServiceSql));

router.get("/services", asyncHandler(controller.listServices));
router.post("/services/recommend-config", validateBody(serviceRecommendSchema), asyncHandler(controller.recommendServiceConfig));
router.post("/services", validateBody(serviceConfigSchema), asyncHandler(controller.createService));
router.put("/services/:id/status", validateBody(serviceStatusSchema), asyncHandler(controller.updateServiceStatus));
router.put("/services/:id", validateBody(serviceConfigSchema), asyncHandler(controller.updateService));
router.delete("/services/:id", asyncHandler(controller.deleteService));
router.get("/services/:id/docx", asyncHandler(controller.exportServiceInterfaceDoc));
router.post("/services/:id/debug", asyncHandler(controller.debugService));

router.get("/ai-configs", asyncHandler(controller.listServiceAiConfigs));
router.put("/ai-configs/:id", validateBody(serviceAiConfigSchema), asyncHandler(controller.updateServiceAiConfig));

router.get("/apps", asyncHandler(controller.listServiceApps));
router.post("/apps", validateBody(serviceAppSchema), asyncHandler(controller.createServiceApp));
router.put("/apps/:id", validateBody(serviceAppSchema), asyncHandler(controller.updateServiceApp));
router.delete("/apps/:id", asyncHandler(controller.deleteServiceApp));

router.get("/authorizations", asyncHandler(controller.listAuthorizations));
router.post("/authorizations", validateBody(authorizationSchema), asyncHandler(controller.createAuthorization));
router.put("/authorizations/:id", validateBody(authorizationSchema), asyncHandler(controller.updateAuthorization));
router.delete("/authorizations/:id", asyncHandler(controller.deleteAuthorization));

router.get("/logs", asyncHandler(controller.listServiceLogs));

module.exports = router;
