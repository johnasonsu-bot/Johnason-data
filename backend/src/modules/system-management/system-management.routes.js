const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../../common/middleware/auth");
const requireFeature = require("../../common/middleware/license-feature");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./system-management.controller");
const {
  createServiceSchema,
  updateServiceSchema,
  createRoleSchema,
  updateRoleSchema,
  createUserSchema,
  updateUserSchema
} = require("./system-management.schema");

const router = express.Router();
const driverStagingDir = path.resolve(process.cwd(), "runtime/database-drivers/staging");
fs.mkdirSync(driverStagingDir, { recursive: true });
const driverUpload = multer({
  dest: driverStagingDir,
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => callback(null, /\.jar$/i.test(file.originalname || "")),
});

router.use(authMiddleware);

router.get("/services", requireFeature("system_services"), asyncHandler(controller.listServices));
router.post("/services", requireFeature("system_services"), validateBody(createServiceSchema), asyncHandler(controller.createService));
router.post("/services/actions/restart-web-stack", requireFeature("system_services"), asyncHandler(controller.restartWebStack));
router.post("/services/actions/start-default", requireFeature("system_services"), asyncHandler(controller.startDefaultServices));
router.post("/services/actions/run-kafka-demo-pump", requireFeature("system_services"), asyncHandler(controller.runKafkaDemoPump));
router.post("/services/:id/actions/:action", requireFeature("system_services"), asyncHandler(controller.operateService));
router.put("/services/:id", requireFeature("system_services"), validateBody(updateServiceSchema), asyncHandler(controller.updateService));
router.delete("/services/:id", requireFeature("system_services"), asyncHandler(controller.deleteService));

router.get("/database-drivers", requireFeature("system_services"), asyncHandler(controller.listDatabaseDrivers));
router.post("/database-drivers/upload-and-activate", requireFeature("system_services"), driverUpload.single("file"), asyncHandler(controller.uploadAndActivateDatabaseDriver));
router.post("/database-drivers/upload", requireFeature("system_services"), driverUpload.single("file"), asyncHandler(controller.uploadDatabaseDriver));
router.post("/database-drivers/rollback", requireFeature("system_services"), asyncHandler(controller.rollbackDatabaseDriver));
router.post("/database-drivers/deactivate", requireFeature("system_services"), asyncHandler(controller.deactivateDatabaseDriver));
router.post("/database-drivers/:id/validate", requireFeature("system_services"), asyncHandler(controller.validateDatabaseDriver));
router.post("/database-drivers/:id/activate", requireFeature("system_services"), asyncHandler(controller.activateDatabaseDriver));
router.get("/database-drivers/:id/logs", requireFeature("system_services"), asyncHandler(controller.listDatabaseDriverLogs));
router.delete("/database-drivers/:id", requireFeature("system_services"), asyncHandler(controller.deleteDatabaseDriver));

router.get("/roles", requireFeature("system_roles"), asyncHandler(controller.listRoles));
router.post("/roles", requireFeature("system_roles"), validateBody(createRoleSchema), asyncHandler(controller.createRole));
router.put("/roles/:id", requireFeature("system_roles"), validateBody(updateRoleSchema), asyncHandler(controller.updateRole));
router.delete("/roles/:id", requireFeature("system_roles"), asyncHandler(controller.deleteRole));

router.get("/users", requireFeature("system_users"), asyncHandler(controller.listUsers));
router.post("/users", requireFeature("system_users"), validateBody(createUserSchema), asyncHandler(controller.createUser));
router.put("/users/:id", requireFeature("system_users"), validateBody(updateUserSchema), asyncHandler(controller.updateUser));
router.delete("/users/:id", requireFeature("system_users"), asyncHandler(controller.deleteUser));

router.get("/resources", requireFeature(["system_services", "system_users", "system_roles", "system_models"]), asyncHandler(controller.getResources));
router.get("/database-architecture", requireFeature("system_services"), asyncHandler(controller.getDatabaseArchitecture));
module.exports = router;
