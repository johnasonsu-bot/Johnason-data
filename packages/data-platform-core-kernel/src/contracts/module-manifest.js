const { z } = require("zod");

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

const exactVersion = z.string().regex(EXACT_VERSION, "Expected an exact version");
const immutableStringArray = z.array(z.string()).transform((values) => Object.freeze([...values]));

const capabilityDefinition = z.object({
  capabilityId: z.string().min(1),
  sourceApiKeys: immutableStringArray,
  sourceFrontendKeys: immutableStringArray,
  executionTargets: immutableStringArray,
}).strict().transform((capability) => Object.freeze(capability));

const moduleManifestSchema = z.object({
  moduleName: z.string().min(1),
  moduleVersion: exactVersion,
  capabilitySchemaVersion: exactVersion,
  capabilities: z.array(capabilityDefinition),
}).strict().superRefine((manifest, context) => {
  const capabilityIds = new Set();

  for (const [index, capability] of manifest.capabilities.entries()) {
    if (capabilityIds.has(capability.capabilityId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate capability ID: ${capability.capabilityId}`,
        path: ["capabilities", index, "capabilityId"],
      });
    }
    capabilityIds.add(capability.capabilityId);
  }
}).transform((manifest) => Object.freeze({
  ...manifest,
  capabilities: Object.freeze([...manifest.capabilities]),
}));

function validateModuleManifest(input) {
  return moduleManifestSchema.parse(input);
}

module.exports = {
  moduleManifestSchema,
  validateModuleManifest,
};
