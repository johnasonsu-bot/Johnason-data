#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { evaluateModuleEvidence } = require("@johnason/data-platform-core-kernel");

const MODULES = Object.freeze([
  "asset-search", "auth", "data-development", "data-lab", "data-lab-sources", "data-map",
  "data-services", "data-source-research", "data-sources", "data-standards", "dev-ai-configs",
  "file-imports", "ingestion-ai-configs", "ingestion-tasks", "model-providers", "platform",
  "project-spaces", "quality-control", "reporting", "system-knowledge-base", "system-management",
]);

function buildAcceptanceManifest({ evidenceDocuments = [], verifyPackages = true } = {}) {
  const byModule = new Map(evidenceDocuments.map((document) => [document.module, document]));
  const modules = MODULES.map((module) => {
    const evidence = byModule.get(module);
    const evaluated = evaluateModuleEvidence(evidence);
    const failures = [...evaluated.failures];
    const packageName = `@johnason/data-platform-module-${module}`;
    if (verifyPackages && evidence) {
      try {
        const packageManifest = require(`${packageName}/package.json`);
        if (packageManifest.version !== evidence.candidateVersion) failures.push("installed package version mismatch");
      } catch {
        failures.push("installed package missing");
      }
    }
    return { module, package: packageName, evidence: evidence || null, ...evaluated, failures, accepted: evaluated.accepted && failures.length === 0 };
  });
  const acceptedModules = modules.filter((entry) => entry.accepted).length;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    modules,
    acceptedModules,
    expectedModules: MODULES.length,
    status: acceptedModules === MODULES.length ? "accepted" : "blocked",
    failures: modules.filter((entry) => !entry.accepted).map((entry) => ({ module: entry.module, failures: entry.failures })),
  };
}

function readEvidence(root) {
  if (!fs.existsSync(root)) return [];
  const documents = [];
  for (const module of fs.readdirSync(root)) {
    const file = path.join(root, module, "manifest.json");
    if (fs.existsSync(file)) documents.push(JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return documents;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "../evidence/module-acceptance");
  const manifest = buildAcceptanceManifest({ evidenceDocuments: readEvidence(root) });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  if (process.argv.includes("--verify-only") && manifest.status !== "accepted") process.exitCode = 1;
}

module.exports = { buildAcceptanceManifest, MODULES, readEvidence };
