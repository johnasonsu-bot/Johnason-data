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
const { cliRuntimeMigration } = require("./infrastructure/cli-runtime.migration");
const commandRepository = require("./infrastructure/command.repository");
const eventRepository = require("./infrastructure/event.repository");
const jobRepository = require("./infrastructure/job.repository");
const { createOutboxPublisher } = require("./infrastructure/outbox-publisher");
const { createInboxConsumer } = require("./infrastructure/inbox-consumer");
const { createJobWorker } = require("./infrastructure/job-worker");
const { createDaemonRuntime } = require("./infrastructure/daemon-runtime");
const {
  RISK_GATES,
  RISK_STATUSES,
  moduleEvidenceSchema,
  normalizeModuleEvidence,
} = require("./risk/evidence-schema");
const { evaluateModuleEvidence } = require("./risk/acceptance");

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
  cliRuntimeMigration,
  commandRepository,
  eventRepository,
  jobRepository,
  createOutboxPublisher,
  createInboxConsumer,
  createJobWorker,
  createDaemonRuntime,
  RISK_GATES,
  RISK_STATUSES,
  moduleEvidenceSchema,
  normalizeModuleEvidence,
  evaluateModuleEvidence,
};
