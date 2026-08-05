const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const { validateBody } = require("../../common/middleware/validate");
const asyncHandler = require("../../common/utils/async-handler");
const controller = require("./data-map.controller");
const {
  aiConfigSchema,
  analyzeResourceProfileSchema,
  batchDeleteResourcesSchema,
  businessSystemSchema,
  catalogSchema,
  dataSourceSchema,
  departmentSchema,
  refreshResourceProfileSchema,
  registerResourcesSchema,
  resourceContentSchema,
  testDataSourceSchema,
  updateResourceFieldSchema,
  updateResourceSchema,
} = require("./data-map.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);

router.get("/overview", asyncHandler(controller.getOverview));

router.get("/departments", asyncHandler(controller.listDepartments));
router.post("/departments", validateBody(departmentSchema), asyncHandler(controller.createDepartment));
router.put("/departments/:id", validateBody(departmentSchema), asyncHandler(controller.updateDepartment));
router.delete("/departments/:id", asyncHandler(controller.deleteDepartment));

router.get("/business-systems", asyncHandler(controller.listBusinessSystems));
router.post("/business-systems", validateBody(businessSystemSchema), asyncHandler(controller.createBusinessSystem));
router.put("/business-systems/:id", validateBody(businessSystemSchema), asyncHandler(controller.updateBusinessSystem));
router.delete("/business-systems/:id", asyncHandler(controller.deleteBusinessSystem));

router.get("/data-sources/external", asyncHandler(controller.listExternalDataSources));
router.get("/data-sources", asyncHandler(controller.listDataSources));
router.post("/data-sources", validateBody(dataSourceSchema), asyncHandler(controller.createDataSource));
router.put("/data-sources/:id", validateBody(dataSourceSchema), asyncHandler(controller.updateDataSource));
router.delete("/data-sources/:id", asyncHandler(controller.deleteDataSource));
router.post("/data-sources/test-connection", validateBody(testDataSourceSchema), asyncHandler(controller.testDataSource));
router.get("/data-sources/:id/tables", asyncHandler(controller.listDataSourceTables));
router.get("/data-sources/:id/tables/:tableName/columns", asyncHandler(controller.listDataSourceColumns));

router.get("/catalogs/tree", asyncHandler(controller.listCatalogTree));
router.get("/catalogs", asyncHandler(controller.listCatalogs));
router.post("/catalogs", validateBody(catalogSchema), asyncHandler(controller.createCatalog));
router.put("/catalogs/:id", validateBody(catalogSchema), asyncHandler(controller.updateCatalog));
router.delete("/catalogs/:id", asyncHandler(controller.deleteCatalog));
router.post("/catalogs/:id/register-resources", validateBody(registerResourcesSchema), asyncHandler(controller.registerResources));

router.post("/lineage/refresh-ingestion", asyncHandler(controller.refreshIngestionLineage));

router.get("/ai-configs", asyncHandler(controller.listAiConfigs));
router.put("/ai-configs/:id", validateBody(aiConfigSchema), asyncHandler(controller.updateAiConfig));

router.get("/search/resources", asyncHandler(controller.searchResources));

router.get("/resources", asyncHandler(controller.listResources));
router.post("/resources/batch-delete", validateBody(batchDeleteResourcesSchema), asyncHandler(controller.deleteResources));
router.get("/resources/:id", asyncHandler(controller.getResourceDetail));
router.put("/resources/:id", validateBody(updateResourceSchema), asyncHandler(controller.updateResource));
router.delete("/resources/:id", asyncHandler(controller.deleteResource));
router.put("/resources/:id/content", validateBody(resourceContentSchema), asyncHandler(controller.updateResourceContent));
router.put("/resources/:id/fields/:columnName", validateBody(updateResourceFieldSchema), asyncHandler(controller.updateResourceField));
router.get("/resources/:id/profile", asyncHandler(controller.getResourceProfile));
router.post("/resources/:id/profile/refresh", validateBody(refreshResourceProfileSchema), asyncHandler(controller.refreshResourceProfile));
router.post("/resources/:id/profile/content-ai-analyze", validateBody(analyzeResourceProfileSchema), asyncHandler(controller.analyzeResourceContentProfile));
router.post("/resources/:id/profile/fields-ai-analyze", validateBody(analyzeResourceProfileSchema), asyncHandler(controller.analyzeResourceFieldProfile));
router.post("/resources/:id/profile/ai-analyze", validateBody(analyzeResourceProfileSchema), asyncHandler(controller.analyzeResourceProfile));
router.get("/resources/:id/lineage-graph", asyncHandler(controller.getResourceLineageGraph));
router.get("/resources/:id/sample", asyncHandler(controller.sampleResourceRows));

module.exports = router;
