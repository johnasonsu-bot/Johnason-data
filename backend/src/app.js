const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const requestContext = require("./common/middleware/request-context");
const errorHandler = require("./common/middleware/error-handler");
const notFoundHandler = require("./common/middleware/not-found");
const asyncHandler = require("./common/utils/async-handler");
const authMiddleware = require("./common/middleware/auth");
const optionalAuthMiddleware = require("./common/middleware/optional-auth");
const activationMiddleware = require("./common/middleware/activation");
const requireFeature = require("./common/middleware/license-feature");
const { validateBody } = require("./common/middleware/validate");
const authRoutes = require("./modules/auth/auth.routes");
const authController = require("./modules/auth/auth.controller");
const { loginSchema } = require("./modules/auth/auth.schema");
const platformRoutes = require("./modules/platform/platform.routes");
const projectSpaceRoutes = require("./modules/project-spaces/project-space.routes");
const assetSearchRoutes = require("./modules/asset-search/asset-search.routes");
const dataMapRoutes = require("./modules/data-map/data-map.routes");
const dataSourceRoutes = require("./modules/data-sources/data-source.routes");
const dataSourceResearchRoutes = require("./modules/data-source-research/data-source-research.routes");
const dataStandardsRoutes = require("./modules/data-standards/data-standards.routes");
const dataModelingSourceRoutes = require("./modules/data-lab-sources/data-lab-source.routes");
const ingestionTaskRoutes = require("./modules/ingestion-tasks/ingestion-task.routes");
const fileImportRoutes = require("./modules/file-imports/file-import.routes");
const modelProviderRoutes = require("./modules/model-providers/model-provider.routes");
const ingestionAiConfigRoutes = require("./modules/ingestion-ai-configs/ingestion-ai-config.routes");
const devAiConfigRoutes = require("./modules/dev-ai-configs/dev-ai-config.routes");
const reportingAiConfigRoutes = require("./modules/reporting/reporting-ai-config.routes");
const systemManagementRoutes = require("./modules/system-management/system-management.routes");
const systemKnowledgeBaseRoutes = require("./modules/system-knowledge-base/system-knowledge-base.routes");
const dataDevelopmentRoutes = require("./modules/data-development/data-development.routes");
const dataModelingRoutes = require("./modules/data-lab/data-lab.routes");
const qualityControlRoutes = require("./modules/quality-control/quality-control.routes");
const dataServiceRoutes = require("./modules/data-services/data-service.routes");
const dataServiceRuntimeRoutes = require("./modules/data-services/data-service.runtime.routes");
const dataServiceService = require("./modules/data-services/data-service.service");
const reportingRoutes = require("./modules/reporting/reporting.routes");
const reportingController = require("./modules/reporting/reporting.controller");
const { getRuntimeDatabaseCapabilityStatus } = require("./common/utils/datasource-capabilities");

const app = express();
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const corsOrigins = [env.frontendUrl];

app.use(helmet());
app.use(cors({ origin: [...new Set(corsOrigins)], credentials: false }));
app.use(requestContext);
app.use(morgan(":method :url :status :response-time ms :res[content-length] - :req[x-request-id]"));
app.use(express.json({ limit: "2mb" }));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "medata-platform", env: env.nodeEnv });
});
app.get("/api/v1/platform/database-capabilities", (req, res) => {
  res.json({ data: getRuntimeDatabaseCapabilityStatus() });
});
app.get("/api/v1/jobs/:id", activationMiddleware, requireFeature("services"), asyncHandler(async (req, res) => {
  const result = await dataServiceService.inspectServiceJob(Number(req.params.id), {
    headers: req.headers,
    ip: req.ip,
    req,
  });
  return res.json(result);
}));

app.post("/api/auth/login", validateBody(loginSchema), asyncHandler(authController.login));
app.get("/api/auth/profile", authMiddleware, asyncHandler(authController.profile));
app.get("/api/v1/reporting/runtime/dashboards/:id", optionalAuthMiddleware, requireFeature("reporting"), asyncHandler(reportingController.getReportDashboardRuntime));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/projects", projectSpaceRoutes);
app.use("/api/v1/platform", requireFeature("overview"), platformRoutes);
app.use("/api/v1/asset-search", requireFeature(["data_map", "ingestion", "quality", "services"]), assetSearchRoutes);
app.use("/api/v1/data-map", requireFeature("data_map"), dataMapRoutes);
app.use("/api/v1/data-standards", requireFeature("standards"), dataStandardsRoutes);
app.use("/api/v1/data-sources", requireFeature("ingestion"), dataSourceRoutes);
app.use("/api/v1/data-source-research", requireFeature("ingestion"), dataSourceResearchRoutes);
app.use("/api/v1/data-modeling-sources", requireFeature("data_modeling"), dataModelingSourceRoutes);
app.use("/api/v1/ingestion-tasks", requireFeature("ingestion"), ingestionTaskRoutes);
app.use("/api/v1/file-imports", requireFeature("ingestion"), fileImportRoutes);
app.use("/api/v1/model-providers", requireFeature(["system_models", "data_map", "standards", "ingestion", "quality", "development", "services", "reporting", "data_modeling"]), modelProviderRoutes);
app.use("/api/v1/ingestion-ai-configs", requireFeature("ingestion"), ingestionAiConfigRoutes);
app.use("/api/v1/dev-ai-configs", requireFeature("development"), devAiConfigRoutes);
app.use("/api/v1/reporting-ai-configs", requireFeature("reporting"), reportingAiConfigRoutes);
app.use("/api/v1/system-management", systemManagementRoutes);
app.use("/api/v1/system-knowledge-bases", requireFeature("system_services"), systemKnowledgeBaseRoutes);
app.use("/api/v1/data-development", requireFeature("development"), dataDevelopmentRoutes);
app.use("/api/v1/data-modeling", requireFeature("data_modeling"), dataModelingRoutes);
app.use("/api/v1/quality-control", requireFeature("quality"), qualityControlRoutes);
app.use("/api/v1/data-services", requireFeature("services"), dataServiceRoutes);
app.use("/api/v1/reporting", requireFeature("reporting"), reportingRoutes);
app.use("/api/service", requireFeature("services"), dataServiceRuntimeRoutes);

if (fs.existsSync(frontendDistPath)) {
  app.use(
    express.static(frontendDistPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          return;
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
  app.get(/^\/(?!api).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
