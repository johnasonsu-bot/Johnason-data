#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const baseline = require(path.join(root, "docs/superpowers/specs/data-platform-cli-coverage-baseline.json"));

const ownership = {
  auth: ["auth"],
  "project-spaces": ["projects"],
  platform: ["platform", "health", "platform-runtime"],
  "asset-search": ["asset-search"],
  "data-development": ["data-development"],
  "data-lab": ["data-modeling"],
  "data-lab-sources": ["data-modeling-sources"],
  "data-map": ["data-map"],
  "data-services": ["data-services", "service-runtime"],
  "data-source-research": ["data-source-research"],
  "data-sources": ["data-sources"],
  "data-standards": ["data-standards"],
  "dev-ai-configs": ["dev-ai-configs"],
  "file-imports": ["file-imports"],
  "ingestion-ai-configs": ["ingestion-ai-configs"],
  "ingestion-tasks": ["ingestion-tasks"],
  "model-providers": ["model-providers"],
  "quality-control": ["quality-control"],
  reporting: ["reporting", "reporting-ai-configs"],
  "system-knowledge-base": ["system-knowledge-bases"],
  "system-management": ["system-management"],
};

function idPart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

function frontendMatches(entry, frontend) {
  const command = `${entry.cliCommand} `;
  const surface = `${frontend.cliSurface} `;
  return command.startsWith(surface) || surface.startsWith(command.split(" ")[0] + " ");
}

const allFrontend = new Set(baseline.frontendCoverage.map((entry) => entry.frontendKey));
const assignedFrontend = new Set();

for (const [moduleName, inventoryModules] of Object.entries(ownership)) {
  const entries = baseline.apiCoverage.filter((entry) => inventoryModules.includes(entry.module));
  const capabilities = entries.map((entry, index) => {
    const frontend = baseline.frontendCoverage
      .filter((candidate) => !assignedFrontend.has(candidate.frontendKey) && frontendMatches(entry, candidate))
      .map((candidate) => candidate.frontendKey);
    frontend.forEach((key) => assignedFrontend.add(key));
    return {
      capabilityId: `${moduleName}.${String(index + 1).padStart(3, "0")}.${idPart(entry.controller || entry.apiKey)}`,
      command: entry.cliCommand,
      sourceApiKeys: [entry.apiKey],
      sourceFrontendKeys: frontend,
      module: entry.module,
      action: entry.action,
      interaction: entry.interaction,
      inputMode: entry.inputMode,
      outputMode: entry.outputMode,
      executionMode: entry.executionMode,
      executionTargets: entry.executionTargets,
      authRequired: entry.authRequired,
      projectScoped: entry.projectScoped,
      featureGuard: entry.featureGuard,
      validationSchemas: entry.validationSchemas,
      confirmationRequired: entry.confirmationRequired,
      sharedCommandAlias: entry.sharedCommandAlias || false,
      aliasApiKeys: entry.aliasApiKeys || [],
    };
  });

  const moduleDir = path.join(root, `packages/data-platform-module-${moduleName}`);
  fs.mkdirSync(path.join(moduleDir, "src"), { recursive: true });
  const pkg = {
    name: `@johnason/data-platform-module-${moduleName}`,
    version: "0.2.0",
    private: false,
    main: "src/index.js",
    files: ["src"],
    engines: { node: ">=22.20.0" },
    dependencies: { "@johnason/data-platform-core-kernel": "0.2.0" },
    license: "UNLICENSED",
  };
  fs.writeFileSync(path.join(moduleDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  fs.writeFileSync(path.join(moduleDir, "src/manifest.json"), `${JSON.stringify({
    moduleName,
    moduleVersion: "0.2.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities,
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(moduleDir, "src/index.js"), [
    'const { validateModuleManifest, PlatformError } = require("@johnason/data-platform-core-kernel");',
    'const moduleManifest = validateModuleManifest(require("./manifest.json"));',
    '',
    'function createCapabilities(dependencies = {}) {',
    '  const execute = dependencies.executeCapability;',
    '  return new Map(moduleManifest.capabilities.map((definition) => [definition.capabilityId, {',
    '    ...definition,',
    '    async execute(input, context) {',
    '      if (typeof execute !== "function") {',
    '        throw new PlatformError("CAPABILITY_HANDLER_MISSING", `No runtime handler for ${definition.capabilityId}`);',
    '      }',
    '      return execute(definition, input, context);',
    '    },',
    '  }]));',
    '}',
    '',
    'module.exports = { moduleManifest, createCapabilities };',
    '',
  ].join("\n"));
}

const leftovers = [...allFrontend].filter((key) => !assignedFrontend.has(key));
if (leftovers.length) {
  const packageDir = path.join(root, "packages/data-platform-module-system-management/src/manifest.json");
  const manifest = JSON.parse(fs.readFileSync(packageDir, "utf8"));
  manifest.capabilities[0].sourceFrontendKeys.push(...leftovers);
  fs.writeFileSync(packageDir, `${JSON.stringify(manifest, null, 2)}\n`);
}

process.stdout.write(`Generated ${Object.keys(ownership).length} module packages with ${baseline.apiCoverage.length} capabilities and ${baseline.frontendCoverage.length} frontend entries.\n`);
