#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const installRoot = path.join(root, ".local", "data-platform-cli", "install");
const cliPackage = path.join(installRoot, "node_modules", "@johnason", "data-platform-cli");
const binary = path.join(installRoot, "node_modules", ".bin", "data-platform");
const reportFile = path.join(root, "docs", "operations", "cli-service-acceptance.json");

function invokeInstalled(args) {
  const result = spawnSync(binary, args, {
    cwd: fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-cli-acceptance-")),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

async function run() {
  const failures = [];
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-cli-acceptance-output-"));
  if (!fs.existsSync(binary) || !fs.existsSync(cliPackage)) failures.push("isolated CLI installation is missing");
  let definitions = [];
  let capabilityCount = 0;
  let commandCalls = 0;
  if (!failures.length) {
    const { createProgram } = require(path.join(cliPackage, "src/main.js"));
    const { createCapabilityCatalog } = require(path.join(installRoot, "node_modules/@johnason/data-platform-core"));
    const catalog = createCapabilityCatalog();
    capabilityCount = catalog.size;
    const calls = [];
    const runtime = {
      catalog,
      async executeCapability(capabilityId) {
        calls.push(capabilityId);
        return { data: { accepted: true, capabilityId } };
      },
    };
    const sink = { write() {} };
    const stdin = Readable.from([]);
    stdin.isTTY = false;
    ({ definitions } = createProgram({ runtime, stdin, stdout: sink, stderr: sink }));
    for (const [index, definition] of definitions.entries()) {
      const argv = ["--json", ...definition.command.split(" ")];
      if (definition.requiresYes) argv.push("--yes");
      if (definition.requiresOutput) argv.push("--output", path.join(outputRoot, `command-${index}.out`));
      if (definition.command === "auth login") argv.push("--username", "acceptance", "--password-stdin");
      const program = createProgram({ runtime, stdin, stdout: sink, stderr: sink, secretReader: async () => "redacted-test-input" }).program;
      try {
        await program.parseAsync(argv, { from: "user" });
        commandCalls += 1;
      } catch (error) {
        failures.push(`${definition.command}: ${error.code || error.message}`);
      }
    }
    // Run every inventory capability as well. Most commands aggregate several
    // API aliases; --api-key selects the exact capability without bypassing
    // Commander parsing or the shared registry.
    for (const capability of catalog.values()) {
      const definition = definitions.find((entry) => entry.capabilityIds.includes(capability.capabilityId));
      if (!definition) {
        failures.push(`${capability.capabilityId}: command definition missing`);
        continue;
      }
      const apiKey = capability.sourceApiKeys[0];
      const argv = ["--json", ...definition.command.split(" "), "--api-key", apiKey];
      if (definition.requiresYes) argv.push("--yes");
      if (definition.requiresOutput) argv.push("--output", path.join(outputRoot, `capability-${capability.capabilityId.replace(/[^A-Za-z0-9.-]/g, "_")}.out`));
      if (definition.command === "auth login") argv.push("--username", "acceptance", "--password-stdin");
      const program = createProgram({ runtime, stdin, stdout: sink, stderr: sink, secretReader: async () => "redacted-test-input" }).program;
      try {
        await program.parseAsync(argv, { from: "user" });
        commandCalls += 1;
      } catch (error) {
        failures.push(`${capability.capabilityId}: ${error.code || error.message}`);
      }
    }
    if (capabilityCount !== 596) failures.push(`installed capability count ${capabilityCount} != 596`);
    if (definitions.length !== 570) failures.push(`installed command definition count ${definitions.length} != 570`);
    if (calls.length !== definitions.length + capabilityCount) failures.push(`dispatch count ${calls.length} != ${definitions.length + capabilityCount}`);
  }

  const health = failures.length && !fs.existsSync(binary) ? null : invokeInstalled(["--json", "system", "doctor", "health"]);
  let healthPayload = null;
  if (health) {
    try { healthPayload = JSON.parse(health.stdout); } catch { failures.push("installed health output is not JSON"); }
    if (health.status !== 0 || !healthPayload?.success || healthPayload.data?.status !== "ok") failures.push("installed health command failed");
  }

  const report = {
    schemaVersion: "1.0.0",
    status: failures.length ? "failed" : "accepted",
    verifiedAt: new Date().toISOString(),
    installation: path.relative(root, installRoot),
    capabilityCount,
    commandDefinitions: definitions.length,
    commandCalls,
    health: healthPayload ? { status: healthPayload.data.status, capabilityIds: healthPayload.capabilityIds } : null,
    realInfrastructureRequired: ["api", "mysql", "postgresql", "oracle", "dm", "aviationTwice", "rollback21"],
    failures,
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) run().then((report) => { process.exitCode = report.status === "accepted" ? 0 : 1; }).catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

module.exports = { run };
