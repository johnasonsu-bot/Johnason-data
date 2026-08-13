const {
  moduleManifestSchema,
  validateModuleManifest,
} = require("./contracts/module-manifest");
const { DatabaseRuntimeMissingError } = require("./contracts/errors");
const {
  createDatabaseRuntime,
  getDatabaseRuntime,
  runWithDatabaseRuntime,
  setDefaultDatabaseRuntime,
} = require("./runtime/database-runtime");
const { getExecutionContext, runWithExecutionContext } = require("./runtime/execution-context");
const { authorizeCapability, normalizePermissions, policyError } = require("./runtime/authorization-policy");
const { createLicensePolicy } = require("./runtime/license-policy");
const { createActivationPolicy } = require("./runtime/activation-policy");

module.exports = {
  moduleManifestSchema,
  validateModuleManifest,
  DatabaseRuntimeMissingError,
  createDatabaseRuntime,
  getDatabaseRuntime,
  runWithDatabaseRuntime,
  setDefaultDatabaseRuntime,
  getExecutionContext,
  runWithExecutionContext,
  authorizeCapability,
  normalizePermissions,
  policyError,
  createLicensePolicy,
  createActivationPolicy,
};
