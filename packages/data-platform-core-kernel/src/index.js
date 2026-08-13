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
};
