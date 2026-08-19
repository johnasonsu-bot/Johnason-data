#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "docs", "cli", "source");
const baselineFile = path.join(root, "docs", "superpowers", "specs", "data-platform-cli-coverage-baseline.json");
const reportFile = path.join(root, "docs", "operations", "cli-coverage-verification.json");
const approved = {
  "api-inventory.json": "6cd896d1e38fb54ebd8317842eb618c4a28ede4eecf5e09f5bfb16374d696d0f",
  "PROJECT_OPERATION_MANUAL.md": "619cf9c139ebd49788acd8a1a7440d5d8574cb9034b4bb7e13de1a14ca8db350",
  "project-operation-knowledge-graph.html": "1fa8acde4615bc6bed8af23ad277fde1089643781bbb1414dd45d5302c03468f",
};

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sorted(values) {
  return [...new Set(values)].sort();
}

function loadCatalog() {
  // Resolve the workspace package exactly as the CLI does. This catches a stale
  // generated package instead of merely validating the design-time JSON.
  const { createCapabilityCatalog } = require("@johnason/data-platform-core");
  const { createDomainCommands } = require(path.join(root, "packages/data-platform-cli/src/registry/domain-commands"));
  const catalog = createCapabilityCatalog();
  return { catalog, commands: createDomainCommands(catalog) };
}

function verify() {
  const failures = [];
  const fingerprints = {};
  for (const [name, expected] of Object.entries(approved)) {
    const file = path.join(sourceRoot, name);
    if (!fs.existsSync(file)) failures.push(`missing source asset: ${name}`);
    else {
      fingerprints[name] = sha256(file);
      if (fingerprints[name] !== expected) failures.push(`stale source fingerprint: ${name}`);
    }
  }

  const inventory = JSON.parse(fs.readFileSync(path.join(sourceRoot, "api-inventory.json"), "utf8"));
  const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  const { catalog, commands } = loadCatalog();
  const capabilities = [...catalog.values()];
  const apiKeys = sorted(capabilities.flatMap((entry) => entry.sourceApiKeys || []));
  const frontendKeys = sorted(capabilities.flatMap((entry) => entry.sourceFrontendKeys || []));
  const inventoryApiKeys = sorted(inventory.routes.map((route) => `${route.method} ${route.path}`));
  const inventoryFrontendKeys = sorted(inventory.frontendPaths.map((entry) => entry.path));
  const missingApi = inventoryApiKeys.filter((key) => !apiKeys.includes(key));
  const extraApi = apiKeys.filter((key) => !inventoryApiKeys.includes(key));
  const missingFrontend = inventoryFrontendKeys.filter((key) => !frontendKeys.includes(key));
  const extraFrontend = frontendKeys.filter((key) => !inventoryFrontendKeys.includes(key));
  const duplicates = inventoryApiKeys.filter((key, index) => inventoryApiKeys.indexOf(key) !== index);
  const commandNames = new Set(commands.map((entry) => entry.command));
  const unknownCommands = capabilities
    .filter((entry) => !commandNames.has(entry.command))
    .map((entry) => entry.capabilityId);
  const bindingFile = path.join(root, "docs/superpowers/specs/data-platform-cli-handler-bindings.json");
  let binding = null;
  if (fs.existsSync(bindingFile)) {
    binding = JSON.parse(fs.readFileSync(bindingFile, "utf8"));
    if (binding.gates?.expected !== inventory.summary.routeCount || binding.gates?.bound !== inventory.summary.routeCount || binding.gates?.unresolved !== 0) {
      failures.push("handler binding gate is incomplete");
    }
  } else failures.push("handler binding file is missing");

  const gates = {
    apiExpected: inventory.summary.routeCount,
    apiMapped: missingApi.length === 0 ? apiKeys.length : apiKeys.length - missingApi.length,
    apiUnmapped: missingApi.length,
    apiExtra: extraApi.length,
    frontendExpected: inventory.summary.frontendPathCount,
    frontendMapped: missingFrontend.length === 0 ? frontendKeys.length : frontendKeys.length - missingFrontend.length,
    frontendUnmapped: missingFrontend.length,
    frontendExtra: extraFrontend.length,
    duplicateApiKeys: duplicates.length,
    unknownCliGroups: unknownCommands.length,
    staleSourceFingerprint: Object.entries(fingerprints).filter(([name, value]) => value !== approved[name]).length,
    catalogCapabilities: capabilities.length,
    commandDefinitions: commands.length,
    handlerBindings: binding?.gates || null,
  };
  if (gates.apiExpected !== 596 || gates.apiMapped !== 596 || gates.apiUnmapped !== 0 || gates.apiExtra !== 0) failures.push("API coverage is not 596/596");
  if (gates.frontendExpected !== 84 || gates.frontendMapped !== 84 || gates.frontendUnmapped !== 0 || gates.frontendExtra !== 0) failures.push("frontend coverage is not 84/84");
  if (gates.duplicateApiKeys || gates.unknownCliGroups || gates.staleSourceFingerprint) failures.push("coverage contains duplicate, unknown, or stale entries");
  if (gates.catalogCapabilities !== 596) failures.push(`catalog capability count is ${gates.catalogCapabilities}, expected 596`);
  if (baseline.gates?.apiExpected !== gates.apiExpected || baseline.gates?.frontendExpected !== gates.frontendExpected) failures.push("coverage baseline totals differ from source inventory");

  const report = {
    schemaVersion: "1.0.0",
    status: failures.length ? "failed" : "accepted",
    verifiedAt: new Date().toISOString(),
    sourceAssets: fingerprints,
    gates,
    failures,
    missingApi,
    extraApi,
    missingFrontend,
    extraFrontend,
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) process.exitCode = verify().status === "accepted" ? 0 : 1;

module.exports = { verify, approved };
