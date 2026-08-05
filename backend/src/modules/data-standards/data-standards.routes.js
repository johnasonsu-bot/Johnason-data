const express = require("express");
const multer = require("multer");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const { validateBody } = require("../../common/middleware/validate");
const asyncHandler = require("../../common/utils/async-handler");
const controller = require("./data-standards.controller");
const {
  aiConfigSchema,
  aiSuggestElementSchema,
  catalogSchema,
  dataElementSchema,
  publishElementSchema,
  referenceStandardSchema,
  valueDomainSchema,
} = require("./data-standards.schema");

const router = express.Router();
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, /\.xlsx?$/i.test(file.originalname || "")),
});

router.use(authMiddleware, activationMiddleware);

router.get("/overview", asyncHandler(controller.getOverview));
router.get("/import-templates", asyncHandler(controller.downloadImportTemplate));
router.get("/exports", asyncHandler(controller.exportStandards));
router.get("/imports", asyncHandler(controller.listImportBatches));
router.get("/imports/:id/errors", asyncHandler(controller.downloadImportErrors));
router.post("/imports/preview", excelUpload.single("file"), asyncHandler(controller.previewImport));
router.post("/imports", excelUpload.single("file"), asyncHandler(controller.commitImport));

router.get("/catalogs/tree", asyncHandler(controller.listCatalogTree));
router.get("/catalogs", asyncHandler(controller.listCatalogs));
router.post("/catalogs", validateBody(catalogSchema), asyncHandler(controller.createCatalog));
router.put("/catalogs/:id", validateBody(catalogSchema), asyncHandler(controller.updateCatalog));
router.delete("/catalogs/:id", asyncHandler(controller.deleteCatalog));

router.get("/reference-standards", asyncHandler(controller.listReferenceStandards));
router.post("/reference-standards", validateBody(referenceStandardSchema), asyncHandler(controller.createReferenceStandard));
router.put("/reference-standards/:id", validateBody(referenceStandardSchema), asyncHandler(controller.updateReferenceStandard));
router.delete("/reference-standards/:id", asyncHandler(controller.deleteReferenceStandard));

router.get("/value-domains", asyncHandler(controller.listValueDomains));
router.get("/value-domains/:id", asyncHandler(controller.getValueDomainDetail));
router.post("/value-domains", validateBody(valueDomainSchema), asyncHandler(controller.createValueDomain));
router.put("/value-domains/:id", validateBody(valueDomainSchema), asyncHandler(controller.updateValueDomain));
router.delete("/value-domains/:id", asyncHandler(controller.deleteValueDomain));

router.get("/elements", asyncHandler(controller.listDataElements));
router.get("/elements/:id", asyncHandler(controller.getDataElementDetail));
router.post("/elements", validateBody(dataElementSchema), asyncHandler(controller.createDataElement));
router.put("/elements/:id", validateBody(dataElementSchema), asyncHandler(controller.updateDataElement));
router.post("/elements/:id/publish", validateBody(publishElementSchema), asyncHandler(controller.publishDataElement));
router.delete("/elements/:id", asyncHandler(controller.deleteDataElement));

router.get("/mappings", asyncHandler(controller.listFieldMappings));

router.get("/ai-configs", asyncHandler(controller.listAiConfigs));
router.put("/ai-configs/:id", validateBody(aiConfigSchema), asyncHandler(controller.updateAiConfig));
router.post("/ai/suggest-elements", validateBody(aiSuggestElementSchema), asyncHandler(controller.suggestDataElements));

module.exports = router;
